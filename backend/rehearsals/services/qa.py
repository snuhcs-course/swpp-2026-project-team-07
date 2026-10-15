# AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
# Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
"""Audience Q&A: panel questions from slide text and a transcript, and a review of one spoken answer.

Explicit and synchronous: each call follows one user action in the app. It uses the same
feedback provider selection as descriptions/coaching (FEEDBACK_ENABLED, provider, model, key,
project id and quota settings) and hosted Whisper for the answer audio. One provider request
per call, no retries, no provider fallback. Nothing is stored on the server: the answer audio
is written to a temporary file for Whisper and deleted afterwards.

Limit: these calls are not recorded as FeedbackReservation rows (that table belongs to
description/coaching jobs), so they do not count against the configured RPM/TPM windows.
They do respect an active provider cooldown and set one after a 429.
"""
from contextlib import contextmanager
import hashlib
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated, Literal

from django.db import transaction
from django.utils import timezone
from pydantic import Field

from ..models import FeedbackQuotaBucket
from . import feedback_provider as provider
from . import transcription
from .feedback import FeedbackError, PrivateModel, json_bytes, validated
from .feedback_config import QuotaPolicy, Selection
from .feedback_quota import cooldown

QA_PROMPT_VERSION = "qa-v1"
OUTPUT_TOKENS = {"qa_questions": 1500, "qa_answer": 800}
MAX_SLIDE_TEXT = 2000
MIN_ANSWER_WORDS = 15
MIN_ANSWER_MS = 8000
MAX_ANSWER_MS = 300_000

QUESTION_RULES = provider.COMMON_RULES + """You play a panel of three audience members after a rehearsal.
Write exactly three questions, one per panelist, each about one supplied slide, as the
supplied audience would ask them. Each question has one short follow-up that presses on
the likely weak point of an answer. Ask about substance in the slides and transcript:
evidence, scope, method, trade-offs, next steps. No grading or comments on delivery.
Use the language of the transcript (or of the slide text when there is no transcript).
panelist is P1, P2, P3. role is a short audience role (for example "Methods reviewer").
topic is two to four words. slide_index must be one of the supplied slide indexes.
"""
ANSWER_RULES = provider.COMMON_RULES + """Review one spoken answer to an audience question.
verdict is "answered" when the answer addresses the question directly with support,
otherwise "partly". did: one sentence on what the answer did. evidence: one sentence on
which supporting detail it gave or lacked. clarify: one concrete thing to add or say more
directly next time. Quote the speaker only with words from the transcript. No grading,
emotion, pronunciation or personality judgments. Use the language of the answer.
"""


class Question(PrivateModel):
    panelist: Annotated[str, Field(min_length=1, max_length=64)]
    role: Annotated[str, Field(min_length=1, max_length=60)]
    slide_index: Annotated[int, Field(ge=0)]
    topic: Annotated[str, Field(max_length=80)]
    question: Annotated[str, Field(min_length=1, max_length=600)]
    follow_up: Annotated[str, Field(min_length=1, max_length=600)]


class Questions(PrivateModel):
    questions: Annotated[tuple[Question, ...], Field(min_length=1, max_length=3)]


class AnswerReview(PrivateModel):
    verdict: Literal["answered", "partly"]
    did: Annotated[str, Field(min_length=1, max_length=400)]
    evidence: Annotated[str, Field(min_length=1, max_length=400)]
    clarify: Annotated[str, Field(min_length=1, max_length=400)]


class SlideRequest(PrivateModel):
    slide_index: Annotated[int, Field(ge=0)]
    title: Annotated[str, Field(max_length=200)]
    transcript: Annotated[str, Field(max_length=6000)]


class QuestionRequest(PrivateModel):
    audience: Annotated[str, Field(max_length=200)]
    slides: Annotated[tuple[SlideRequest, ...], Field(min_length=1)]


class AnswerRequest(PrivateModel):
    question: Annotated[str, Field(min_length=1, max_length=600)]
    main_question: Annotated[str, Field(min_length=1, max_length=600)]
    part: Literal[0, 1]
    slide_index: Annotated[int, Field(ge=0)]
    duration_ms: Annotated[int, Field(ge=1, le=MAX_ANSWER_MS)]


def configured():
    """Same gates as other feedback calls; raises FeedbackError before any I/O."""
    config = provider.ProviderConfig.from_env()
    selection = Selection.current()
    QuotaPolicy.current(selection)  # The server must have explicit allowances configured.
    return config, selection


def _check_cooldown(selection):
    bucket = FeedbackQuotaBucket.objects.filter(provider=selection.provider, project_id=selection.project_id,
                                                model=selection.model).first()
    if bucket and bucket.blocked_until and bucket.blocked_until > timezone.now():
        raise FeedbackError("waiting_quota", retry_at=bucket.blocked_until)


def _payload(config, stage, instructions, context, schema):
    text = json_bytes(context).decode("utf-8")
    if config.provider == "openai":
        payload = {"model": config.model, "instructions": instructions,
                   "input": [{"role": "user", "content": [{"type": "input_text", "text": text}]}],
                   "text": {"format": {"type": "json_schema", "name": stage, "strict": True, "schema": schema}},
                   "max_output_tokens": OUTPUT_TOKENS[stage], "store": False}
    else:
        payload = {"systemInstruction": {"parts": [{"text": instructions}]},
                   "contents": [{"role": "user", "parts": [{"text": text}]}],
                   "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": provider.gemini_schema(schema),
                                        "maxOutputTokens": OUTPUT_TOKENS[stage], "candidateCount": 1}}
    body = json_bytes(payload)
    if len(body) > provider.MAX_REQUEST_BYTES:
        raise FeedbackError("request_too_large")
    return provider.PreparedRequest(config, None, stage, body, hashlib.sha256(body).hexdigest())


def _call(config, selection, stage, instructions, context, model, *, _transport=None):
    _check_cooldown(selection)
    prepared = _payload(config, stage, instructions, context, model.model_json_schema())
    receipt = provider.request_raw(prepared, _transport=_transport)
    if receipt.status_code == 429 and receipt.retry_at:
        with transaction.atomic():
            bucket, _ = FeedbackQuotaBucket.objects.get_or_create(provider=selection.provider,
                project_id=selection.project_id, model=selection.model)
            cooldown(bucket, receipt.retry_at)
    return validated(model, provider.output_json(receipt), code="invalid_response")


def write_questions(deck, payload, *, _transport=None):
    request = validated(QuestionRequest, payload, code="invalid_request")
    config, selection = configured()
    texts = {s.slide_index: s.extracted_text for s in deck.slides.all()}
    if any(s.slide_index >= deck.page_count for s in request.slides):
        raise FeedbackError("invalid_request")
    context = {"prompt_version": QA_PROMPT_VERSION, "deck_title": deck.title, "audience": request.audience or "General audience",
               "slides": [{"slide_index": s.slide_index, "title": s.title, "slide_text": texts.get(s.slide_index, "")[:MAX_SLIDE_TEXT],
                           "transcript": s.transcript} for s in request.slides]}
    result = _call(config, selection, "qa_questions", QUESTION_RULES, context, Questions, _transport=_transport)
    allowed = {s.slide_index for s in request.slides}
    questions = [q.model_dump(mode="json") for q in result.questions if q.slide_index in allowed]
    if not questions:
        raise FeedbackError("invalid_response")
    return {"questions": questions, "provider": config.provider, "model": config.model}


@contextmanager
def _saved_audio(upload):
    suffix = Path(getattr(upload, "name", "") or "").suffix.lower() or ".m4a"
    if suffix not in transcription.SUPPORTED_SUFFIXES:
        raise transcription.TranscriptionError("unsupported_audio", "Unsupported audio file extension.")
    if not 0 < upload.size <= transcription.MAX_AUDIO_BYTES:
        raise transcription.TranscriptionError("invalid_audio_size", "Audio must contain 1 to 25,000,000 bytes.")
    file = NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        with file:
            for chunk in upload.chunks():
                file.write(chunk)
        yield Path(file.name)
    finally:
        try:
            os.unlink(file.name)
        except OSError:
            pass


def review_answer(deck, metadata, upload, *, _transport=None):
    request = validated(AnswerRequest, metadata, code="invalid_request")
    if request.slide_index >= deck.page_count:
        raise FeedbackError("invalid_request")
    config, selection = configured()
    with _saved_audio(upload) as path:
        heard = transcription.transcribe(path)
    transcript = {"text": heard["text"], "words": [{k: w[k] for k in ("text", "start_ms", "end_ms")} for w in heard["words"]]}
    result = {"transcript": transcript, "duration_ms": request.duration_ms}
    if request.duration_ms < MIN_ANSWER_MS or len(transcript["words"]) < MIN_ANSWER_WORDS:
        # Not enough to judge: no feedback request is made.
        return {**result, "verdict": "too_short", "did": "", "evidence": "", "clarify": ""}
    slide = deck.slides.filter(slide_index=request.slide_index).first()
    context = {"prompt_version": QA_PROMPT_VERSION, "question": request.question, "main_question": request.main_question,
               "is_follow_up": request.part == 1, "slide_index": request.slide_index,
               "slide_text": (slide.extracted_text if slide else "")[:MAX_SLIDE_TEXT], "answer_transcript": transcript["text"][:12000]}
    review = _call(config, selection, "qa_answer", ANSWER_RULES, context, AnswerReview, _transport=_transport)
    return {**result, **review.model_dump(mode="json")}
