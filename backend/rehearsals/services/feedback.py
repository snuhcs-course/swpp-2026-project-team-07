"""Private, immutable deck and rehearsal evidence; no network or database I/O.

Small schema/prompt ideas from prototype 33907d3; indexed evidence replaces its
substring matching. See docs/ai-feedback.md for boundaries and canonicalization.
"""
from bisect import bisect_right
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
import hashlib
import io
import json
import logging
import math
from typing import Annotated, Literal

from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, ValidationError

MAX_IMAGE_BYTES = 1_048_576
MAX_TOTAL_IMAGE_BYTES = 8_388_608
MAX_IMAGE_EDGE = 1600
MAX_IMAGE_PIXELS = 2_560_000
MAX_CONTEXT_BYTES = 1_000_000
MAX_WORDS = 6000
MAX_VISITS = 1000
MAX_OUTPUT_BYTES = 65_536
UUIDText = Annotated[str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
SlideIndex = Annotated[int, Field(ge=0, le=9)]
Time = Annotated[int, Field(ge=0, le=600_000)]
Language = Annotated[str, Field(min_length=1, max_length=40)]
ShortText = Annotated[str, Field(min_length=1, max_length=400)]


class FeedbackError(Exception):
    """Only fixed codes/messages, never provider/source material."""

    def __init__(self, code, *, uncertain=False, retry_at=None):
        self.code, self.uncertain, self.retry_at = code, uncertain, retry_at
        super().__init__(f"Feedback unavailable ({code}).")


class PrivateModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True, hide_input_in_errors=True)

    def __repr__(self):
        return f"<{type(self).__name__}: private>"

    __str__ = __repr__


def json_bytes(value):
    try:
        return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError, UnicodeError, RecursionError):
        raise FeedbackError("invalid_input") from None


def strict_json(raw, limit=MAX_OUTPUT_BYTES):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError()
            result[key] = value
        return result

    def invalid_constant(_):
        raise ValueError()

    def finite_float(value):
        result = float(value)
        if not math.isfinite(result):
            raise ValueError()
        return result

    if type(raw) is not bytes or len(raw) > limit:
        raise FeedbackError("invalid_response")
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid_constant, parse_float=finite_float)
    except (ValueError, UnicodeError, RecursionError):
        raise FeedbackError("invalid_response") from None


def validated(model, value, code="invalid_input", limit=MAX_CONTEXT_BYTES):
    try:
        raw = json_bytes(value)
        if len(raw) > limit:
            raise FeedbackError(code)
        # Strict JSON allows arrays for immutable tuples, without scalar coercion.
        return model.model_validate_json(raw, strict=True)
    except (ValidationError, FeedbackError, ValueError):
        raise FeedbackError(code) from None


def canonical_quote(text):
    """Whitespace only: no case folding, punctuation removal or Unicode rewrite."""
    return " ".join(text.split())


class SlideText(PrivateModel):
    deck_id: UUIDText
    slide_index: SlideIndex
    extracted_text: Annotated[str, Field(max_length=8000)]
    source_language: Language


class DeckInput(PrivateModel):
    deck_id: UUIDText
    content_hash: Digest
    preparation_version: Annotated[str, Field(min_length=1, max_length=40)]
    slides: Annotated[tuple[SlideText, ...], Field(min_length=1, max_length=10)]


class Word(PrivateModel):
    text: Annotated[str, Field(min_length=1, max_length=200)]
    start_ms: Time
    end_ms: Time


class Transcript(PrivateModel):
    text: Annotated[str, Field(max_length=60_000)]
    words: Annotated[tuple[Word, ...], Field(max_length=MAX_WORDS)]


class Visit(PrivateModel):
    slide_index: SlideIndex
    start_ms: Time
    end_ms: Time
    word_indexes: Annotated[tuple[Annotated[int, Field(ge=0, lt=MAX_WORDS)], ...], Field(max_length=MAX_WORDS)]


class AnalysisInput(PrivateModel):
    attempt_id: UUIDText
    deck_id: UUIDText
    duration_ms: Annotated[int, Field(gt=0, le=600_000)]
    speaker_language: Language
    audience: Annotated[str, Field(max_length=500)]
    slides: Annotated[tuple[SlideText, ...], Field(min_length=1, max_length=10)]
    transcript: Transcript | None
    visits: Annotated[tuple[Visit, ...], Field(min_length=1, max_length=MAX_VISITS)]


@dataclass(frozen=True)
class PreparedImage:
    data: bytes = field(repr=False)
    mime: str


@dataclass(frozen=True)
class Segment:
    segment_id: str
    visit_id: int
    slide_index: int
    word_indexes: tuple[int, ...]


@dataclass(frozen=True)
class PreparedDeck:
    source: DeckInput = field(repr=False)
    images: tuple[PreparedImage, ...] = field(repr=False)
    source_ids: tuple[str, ...] = field(repr=False)
    input_id: str


@dataclass(frozen=True)
class PreparedAnalysis:
    source: AnalysisInput = field(repr=False)
    images: tuple[PreparedImage, ...] = field(repr=False)
    source_ids: tuple[str, ...] = field(repr=False)
    transcript_id: str
    input_id: str
    segments: tuple[Segment, ...] = field(repr=False)
    deck: PreparedDeck = field(repr=False)


_private_image_call = ContextVar("private_feedback_image", default=False)


class _PrivateImageLogFilter(logging.Filter):
    def filter(self, record):
        return not _private_image_call.get()


_image_log_filter = _PrivateImageLogFilter()


@contextmanager
def _private_image_logging():
    # Create producer loggers before Pillow's lazy imports. Parent logger filters
    # do not cover child records. Restrict decoding below to the reviewed PNG/JPEG
    # paths; recheck these producers when upgrading Pillow. Other calls/threads
    # retain their logging, including after a decode/verification exception.
    for name in ("PIL.Image", "PIL.ImageFile", "PIL.PngImagePlugin", "PIL.JpegImagePlugin", "PIL.TiffImagePlugin"):
        logging.getLogger(name).addFilter(_image_log_filter)
    token = _private_image_call.set(True)
    try:
        yield
    finally:
        _private_image_call.reset(token)


@_private_image_logging()
def _image(data):
    if type(data) is not bytes or not 0 < len(data) <= MAX_IMAGE_BYTES:
        raise FeedbackError("invalid_image")
    try:
        with Image.open(io.BytesIO(data), formats=("PNG", "JPEG")) as image:
            if image.format not in ("PNG", "JPEG") or getattr(image, "n_frames", 1) != 1:
                raise ValueError()
            w, h = image.size
            if not (0 < w <= MAX_IMAGE_EDGE and 0 < h <= MAX_IMAGE_EDGE and w * h <= MAX_IMAGE_PIXELS):
                raise ValueError()
            mime = Image.MIME[image.format]
            image.verify()
        with Image.open(io.BytesIO(data), formats=("PNG", "JPEG")) as image:
            image.load()  # Headers alone are insufficient.
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise FeedbackError("invalid_image") from None
    return PreparedImage(data, mime)


def deck_identity(source, source_ids):
    return hashlib.sha256(json_bytes([source.model_dump(mode="json"), source_ids])).hexdigest()


def prepare_deck(value: dict, images: tuple[bytes, ...]) -> PreparedDeck:
    """Prepare a saved deck independently of recordings, audience or speech."""
    source = validated(DeckInput, value)
    if (tuple(s.slide_index for s in source.slides) != tuple(range(len(source.slides)))
            or any(s.deck_id != source.deck_id or not s.source_language.strip() for s in source.slides)):
        raise FeedbackError("invalid_slides")
    if type(images) is not tuple or len(images) != len(source.slides):
        raise FeedbackError("invalid_image")
    if any(type(image) is not bytes for image in images) or sum(len(image) for image in images) > MAX_TOTAL_IMAGE_BYTES:
        raise FeedbackError("invalid_image")
    prepared = tuple(_image(image) for image in images)
    ids = tuple(hashlib.sha256(json_bytes(slide.model_dump(mode="json")) + image.data).hexdigest()
                for slide, image in zip(source.slides, prepared))
    return PreparedDeck(source, prepared, ids, deck_identity(source, ids))


def prepare_analysis(value: dict, images: tuple[bytes, ...], *, prepared_deck: PreparedDeck | None = None) -> PreparedAnalysis:
    """No I/O. Visits use original transcript indexes, never matched word copies.

    Missing/no speech is an explicit preflight error, before either paid stage.
    Every source word must occur exactly once in its assignment-by-start visit.
    """
    source = validated(AnalysisInput, value)
    if tuple(s.slide_index for s in source.slides) != tuple(range(len(source.slides))):
        raise FeedbackError("invalid_slides")
    if any(s.deck_id != source.deck_id or not s.source_language.strip() for s in source.slides):
        raise FeedbackError("invalid_slides")
    if not source.speaker_language.strip():
        raise FeedbackError("invalid_input")
    starts = [v.start_ms for v in source.visits]
    if starts[0] != 0 or starts != sorted(starts) or starts[-1] >= source.duration_ms:
        raise FeedbackError("invalid_timeline")
    for i, visit in enumerate(source.visits):
        end = starts[i + 1] if i + 1 < len(starts) else source.duration_ms
        if visit.end_ms != end or visit.slide_index >= len(source.slides):
            raise FeedbackError("invalid_timeline")
    if source.transcript is None:
        if any(v.word_indexes for v in source.visits):
            raise FeedbackError("invalid_timeline")
        raise FeedbackError("missing_transcript")
    words = source.transcript.words
    expected = [[] for _ in source.visits]
    for i, word in enumerate(words):
        if not word.text.strip() or not 0 <= word.start_ms < source.duration_ms or not word.start_ms <= word.end_ms <= source.duration_ms:
            raise FeedbackError("invalid_timeline")
        expected[bisect_right(starts, word.start_ms) - 1].append(i)
    if any(tuple(indexes) != v.word_indexes for indexes, v in zip(expected, source.visits)):
        raise FeedbackError("invalid_timeline")
    if not words and not source.transcript.text.strip():
        raise FeedbackError("no_speech")
    if not words or not source.transcript.text.strip():
        raise FeedbackError("invalid_transcript")
    # Compatibility for existing analysis callers; saved-deck callers supply the
    # actual content hash/preparation version via prepare_deck. No attempt data
    # enters this deck identity.
    deck = prepare_deck({"deck_id": source.deck_id,
                         "content_hash": hashlib.sha256(json_bytes([s.model_dump(mode="json") for s in source.slides])).hexdigest(),
                         "preparation_version": "analysis-slides-v1",
                         "slides": [s.model_dump(mode="json") for s in source.slides]}, images)
    if prepared_deck is not None:
        if (not isinstance(prepared_deck, PreparedDeck) or prepared_deck.source.deck_id != source.deck_id
                or prepared_deck.source.slides != source.slides or prepared_deck.source_ids != deck.source_ids
                or prepared_deck.images != deck.images):
            raise FeedbackError("description_source_mismatch")
        deck = prepared_deck
    prepared_images, source_ids = deck.images, deck.source_ids
    transcript_id = hashlib.sha256(json_bytes([source.attempt_id, source.transcript.model_dump(mode="json")])).hexdigest()
    input_id = hashlib.sha256(json_bytes([source.model_dump(mode="json"), source_ids])).hexdigest()
    segments = []
    for visit_id, visit in enumerate(source.visits):
        # Do not sort/recover identity from words. Split at index gaps as well as
        # 40-word boundaries, so every selectable span is globally contiguous.
        chunks = []
        for index in visit.word_indexes:
            if not chunks or len(chunks[-1]) == 40 or chunks[-1][-1] + 1 != index:
                chunks.append([])
            chunks[-1].append(index)
        for ordinal, indexes in enumerate(chunks):
            segments.append(Segment(f"v{visit_id}s{ordinal}", visit_id, visit.slide_index, tuple(indexes)))
    return PreparedAnalysis(source, prepared_images, source_ids, transcript_id, input_id, tuple(segments), deck)


class Fact(PrivateModel):
    text: ShortText
    uncertain: bool
    uncertainty: Annotated[str, Field(max_length=400)]


class Description(PrivateModel):
    deck_id: UUIDText
    slide_index: SlideIndex
    source_id: Digest
    summary: Fact
    key_ideas: Annotated[tuple[Fact, ...], Field(max_length=5)]
    visual_facts: Annotated[tuple[Fact, ...], Field(max_length=5)]


class Descriptions(PrivateModel):
    slides: Annotated[tuple[Description, ...], Field(min_length=1, max_length=10)]


def description_facts(slide):
    return {"summary": slide.summary,
            **{f"key_ideas/{i}": fact for i, fact in enumerate(slide.key_ideas)},
            **{f"visual_facts/{i}": fact for i, fact in enumerate(slide.visual_facts)}}


def validate_descriptions(value, analysis):
    descriptions = validated(Descriptions, value, "invalid_descriptions", MAX_OUTPUT_BYTES)
    if sorted(s.slide_index for s in descriptions.slides) != list(range(len(analysis.source.slides))):
        raise FeedbackError("invalid_descriptions")
    for slide in descriptions.slides:
        if slide.deck_id != analysis.source.deck_id or slide.source_id != analysis.source_ids[slide.slide_index]:
            raise FeedbackError("invalid_descriptions")
        for fact in description_facts(slide).values():
            # PostgreSQL JSONB cannot represent U+0000. Reject it in generated
            # and edited facts before persistence; preserve all other Unicode.
            if ("\x00" in fact.text or "\x00" in fact.uncertainty
                    or not fact.text.strip() or fact.uncertain != bool(fact.uncertainty.strip())):
                raise FeedbackError("invalid_descriptions")
    return descriptions


class Suggestion(PrivateModel):
    category: Literal["consistency", "clarity", "audience"]
    slide_index: SlideIndex
    source_id: Digest
    transcript_id: Digest
    visit_id: Annotated[int, Field(ge=0, lt=MAX_VISITS)]
    segment_id: Annotated[str, Field(pattern=r"^v[0-9]{1,4}s[0-9]{1,4}$")]
    word_start: Annotated[int, Field(ge=0, lt=MAX_WORDS)]
    word_end: Annotated[int, Field(ge=0, lt=MAX_WORDS)]
    speech_quote: Annotated[str, Field(min_length=1, max_length=1000)]
    description_ref: Annotated[str, Field(pattern=r"^(summary|key_ideas/[0-4]|visual_facts/[0-4])$")]
    slide_quote: ShortText
    observation: Annotated[str, Field(min_length=1, max_length=600)]
    suggestion: Annotated[str, Field(min_length=1, max_length=700)]


class Suggestions(PrivateModel):
    suggestions: Annotated[tuple[Suggestion, ...], Field(max_length=3)]


class VerifiedSuggestion(Suggestion):
    start_ms: Time
    end_ms: Time


@dataclass(frozen=True)
class FeedbackResult:
    state: Literal["accepted", "partial", "empty", "all_invalid"]
    suggestions: tuple[VerifiedSuggestion, ...] = field(repr=False)
    accepted_count: int
    discarded_count: int


def validate_suggestions(value, analysis, descriptions):
    # Envelope violations fail the entire response; structurally valid but
    # unsupported/duplicate cards are individually discarded, with a count.
    candidates = validated(Suggestions, value, "invalid_suggestions", MAX_OUTPUT_BYTES)
    descriptions = validate_descriptions(descriptions.model_dump(mode="json"), analysis)
    slides = {slide.slide_index: slide for slide in descriptions.slides}
    segments = {s.segment_id: s for s in analysis.segments}
    used_words, accepted = set(), []
    for card in candidates.suggestions:
        segment, slide = segments.get(card.segment_id), slides.get(card.slide_index)
        if not segment or not slide or segment.slide_index != card.slide_index or segment.visit_id != card.visit_id:
            continue
        if card.transcript_id != analysis.transcript_id or card.source_id != slide.source_id:
            continue
        if card.category == "audience" and not analysis.source.audience.strip():
            continue
        if not card.observation.strip() or not card.suggestion.strip():
            continue
        if not card.word_start <= card.word_end or not set(range(card.word_start, card.word_end + 1)).issubset(segment.word_indexes):
            continue
        indexes = set(range(card.word_start, card.word_end + 1))
        if indexes & used_words:
            continue
        words = analysis.source.transcript.words[card.word_start:card.word_end + 1]
        quote = canonical_quote(" ".join(w.text for w in words))
        if canonical_quote(card.speech_quote) != quote:
            continue
        fact = description_facts(slide).get(card.description_ref)
        if not fact or fact.uncertain or card.slide_quote != fact.text:
            continue
        # Overlap and unsorted source timings are legal. Cover all selected words;
        # never clip to the visit end or stretch authoritative recording duration.
        start, end = min(w.start_ms for w in words), max(w.end_ms for w in words)
        accepted.append(VerifiedSuggestion(**card.model_dump(), start_ms=start, end_ms=end))
        used_words.update(indexes)
    discarded = len(candidates.suggestions) - len(accepted)
    state = "partial" if accepted and discarded else "accepted" if accepted else "all_invalid" if discarded else "empty"
    return FeedbackResult(state, tuple(accepted), len(accepted), discarded)
