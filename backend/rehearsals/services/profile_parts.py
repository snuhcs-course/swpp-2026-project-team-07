"""Bounded OpenRouter calls for complete v5 profiles of public, long decks."""
import base64
import hashlib
from typing import Annotated, Literal

from pydantic import Field

from . import feedback_provider as provider
from .feedback import (Fact, FeedbackError, MAX_CONTEXT_BYTES, MAX_OUTPUT_BYTES,
                       PreparedDeck, PrivateModel, ShortText, SlideIndex,
                       description_facts, json_bytes, validated)
from .pdf import PUBLIC_MAX_PAGES
from .slide_profile_schema import Cue, PROFILE_SCHEMAS, canonical_guidance, cue_word_count, validate_profiles


PART_THRESHOLD = 10
PART_SLIDES = 5
FACTS = 'facts'
ENRICHMENT = 'enrichment'
PART_PROTOCOL = 'profile-parts-v1'
V5 = PROFILE_SCHEMAS['openrouter']
# Leave room for provenance and envelope inside build 42's 1.2M-character limit.
MAX_ASSEMBLED_BYTES = MAX_CONTEXT_BYTES

_CUE_RULES = """Preserve the source language, including mixed languages. Cues are glanceable
speaking objectives: normally 8–16 words, at most 25 whitespace-separated words, one distinct
idea each. Do not repeat the source verbatim, split one idea into repeated cues, write scripts,
or pad sparse/title/closing/unreadable slides. Either cue category can legitimately be empty.
Return each requested global slide_index exactly once, with no additional slides or fields.
"""
_FACT_RULES = provider.COMMON_RULES + _CUE_RULES + """Extract facts and Must Cover objectives for
the target slides. Each image belongs to the target at the same position in the input array.
Use only that slide's image and extracted text for its facts. Summarize its message concisely.
Keep distinct key ideas and visual evidence, including readable graph axes, units, numerical
values, comparisons and trends. Mark unreadable/ambiguous readings uncertain and explain why;
otherwise uncertainty is empty. Never guess a missing number, trend or label. For an unreadable
summary explain the uncertainty. Give up to three important speaking objectives about the meaning
of the slide. Reference only its certain summary, key_ideas/0..4 or visual_facts/0..4. For example,
distinguish a 12 percentage-point increase from a 12 percent relative increase. Group related
facts; keep factual wording short. Do not generate optional enrichments in this phase.
"""
_ENRICHMENT_RULES = provider.COMMON_RULES + _CUE_RULES + """The registry contains the frozen,
certain facts and Must Cover objectives from the entire deck. For each target, give zero to
three optional Go Deeper cues: supported implications, comparisons, limitations or specific
questions. Consider the whole deck, including later slides. Avoid repeating that target's
Must Cover, visible facts or another enrichment. Cite each supporting fact with exactly its
global slide_index and fact_ref from certain_facts. Never guess a selector, quote, result,
causal explanation or external fact. For a supported connection, kind is connection and
information_needed is empty. For an unanswered question, keep established premises distinct,
use kind=question, and state precisely what evidence is still needed in information_needed.
If no grounded addition is useful, return an empty go_deeper array for that target.
"""


class _FactsSlide(PrivateModel):
    slide_index: SlideIndex
    slide_kind: Literal['title', 'content', 'closing', 'unknown']
    summary: Fact
    key_ideas: Annotated[tuple[Fact, ...], Field(max_length=5)]
    visual_facts: Annotated[tuple[Fact, ...], Field(max_length=5)]
    must_cover: Annotated[tuple[Cue, ...], Field(max_length=3)]


class _FactsOutput(PrivateModel):
    slides: Annotated[tuple[_FactsSlide, ...], Field(min_length=1, max_length=PART_SLIDES)]


class _FactSelector(PrivateModel):
    slide_index: SlideIndex
    fact_ref: Annotated[str, Field(pattern=r'^(summary|key_ideas/[0-4]|visual_facts/[0-4])$')]


class _EnrichmentCue(PrivateModel):
    text: ShortText
    kind: Literal['connection', 'question']
    evidence_refs: Annotated[tuple[_FactSelector, ...], Field(min_length=1, max_length=5)]
    information_needed: Annotated[str, Field(max_length=400)]


class _EnrichmentSlide(PrivateModel):
    slide_index: SlideIndex
    go_deeper: Annotated[tuple[_EnrichmentCue, ...], Field(max_length=3)]


class _EnrichmentOutput(PrivateModel):
    slides: Annotated[tuple[_EnrichmentSlide, ...], Field(min_length=1, max_length=PART_SLIDES)]


def _indexes(deck, offset):
    if not isinstance(deck, PreparedDeck):
        raise FeedbackError('invalid_request')
    count = len(deck.source.slides)
    if (not 1 <= count <= PUBLIC_MAX_PAGES or type(offset) is not int or
            not 0 <= offset < count or offset % PART_SLIDES or len(deck.source_ids) != count):
        raise FeedbackError('invalid_request')
    return tuple(range(offset, min(offset + PART_SLIDES, count)))


def _ordered(rows, indexes):
    if (not isinstance(rows, list) or len(rows) != len(indexes) or
            any(not isinstance(row, dict) or type(row.get('slide_index')) is not int for row in rows)):
        raise FeedbackError('invalid_descriptions')
    rows = sorted(rows, key=lambda row: row['slide_index'])
    if tuple(row['slide_index'] for row in rows) != indexes:
        raise FeedbackError('invalid_descriptions')
    return rows


def _collect(deck, parts):
    """A saved part covers exactly one group; collection order has no significance."""
    count = len(deck.source.slides)
    groups = {}
    for part in parts:
        if (not isinstance(part, dict) or set(part) != {'slides'} or not isinstance(part['slides'], list) or
                not part['slides'] or not isinstance(part['slides'][0], dict)):
            raise FeedbackError('invalid_descriptions')
        first = part['slides'][0].get('slide_index')
        if type(first) is not int or not 0 <= first < count:
            raise FeedbackError('invalid_descriptions')
        offset = first // PART_SLIDES * PART_SLIDES
        if offset in groups:
            raise FeedbackError('invalid_descriptions')
        groups[offset] = _ordered(part['slides'], _indexes(deck, offset))
    if set(groups) != set(range(0, count, PART_SLIDES)):
        raise FeedbackError('invalid_descriptions')
    return [row for offset in sorted(groups) for row in groups[offset]]


def _frozen_facts(deck, parts):
    rows = _collect(deck, parts)
    if any(row.get('go_deeper') != [] for row in rows):
        raise FeedbackError('invalid_descriptions')
    return validate_profiles({'slides': rows}, deck, V5, max_bytes=MAX_ASSEMBLED_BYTES).slides


def _fact_registry(facts):
    return [{'slide_index': slide.slide_index, 'slide_kind': slide.slide_kind,
             'certain_facts': {ref: fact.text for ref, fact in description_facts(slide).items()
                               if not fact.uncertain},
             'must_cover': [cue.text for cue in slide.must_cover]} for slide in facts]


def _request(deck, config, phase, indexes, facts):
    context = {'protocol': PART_PROTOCOL, 'source_revision': deck.input_id, 'targets': indexes}
    if phase == FACTS:
        if len(deck.images) != len(deck.source.slides):
            raise FeedbackError('snapshot_unavailable')
        context['slides'] = [{'slide_index': i, 'source_language': deck.source.slides[i].source_language,
                              'extracted_text': deck.source.slides[i].extracted_text} for i in indexes]
        schema, rules = _FactsOutput, _FACT_RULES
    else:
        context['deck'] = _fact_registry(facts)
        schema, rules = _EnrichmentOutput, _ENRICHMENT_RULES
    content = [{'type': 'input_text', 'text': json_bytes(context).decode('utf-8')}]
    if phase == FACTS:
        for i in indexes:
            image = deck.images[i]
            data = base64.b64encode(image.data).decode('ascii')
            content.append({'type': 'input_image', 'image_url': f'data:{image.mime};base64,{data}', 'detail': 'auto'})
    body = json_bytes({'model': config.model, 'instructions': rules, 'input': [{'role': 'user', 'content': content}],
                       'text': {'format': {'type': 'json_schema', 'name': f'profile_{phase}',
                                           'strict': True, 'schema': schema.model_json_schema()}},
                       'max_output_tokens': provider.OUTPUT_TOKENS['descriptions'], 'store': False})
    if len(body) > provider.MAX_REQUEST_BYTES:
        raise FeedbackError('request_too_large')
    return provider.PreparedRequest(config, deck, 'descriptions', body, hashlib.sha256(body).hexdigest(),
                                    description_schema_version=V5)


def prepare_part(deck, config, phase, offset, *, fact_parts=()):
    """Prepare one frozen, bounded public Responses request; performs no I/O."""
    indexes = _indexes(deck, offset)
    if (config.provider != 'openrouter' or not provider.valid_model(config.provider, config.model) or
            phase not in (FACTS, ENRICHMENT)):
        raise FeedbackError('invalid_request')
    facts = _frozen_facts(deck, fact_parts) if phase == ENRICHMENT else ()
    return _request(deck, config, phase, indexes, facts)


def _with_enrichments(deck, facts, enrichments):
    rows = [{**slide.model_dump(mode='json'), 'go_deeper': enrichments.get(slide.slide_index, [])}
            for slide in facts]
    return validate_profiles({'slides': rows}, deck, V5, max_bytes=MAX_ASSEMBLED_BYTES)


def _citable_facts(cue, selectors, registry, seen, *, slide_facts=None):
    """An existing uncertain fact disqualifies just this candidate; other v5 rules still apply."""
    facts = [registry.get(selector) for selector in selectors]
    if any(fact is None for fact in facts):
        raise FeedbackError('invalid_descriptions')
    key = canonical_guidance(cue['text'])
    verbatim = facts if slide_facts is None else slide_facts
    if (not key or key in seen or cue_word_count(cue['text']) > 25 or
            len(set(selectors)) != len(selectors) or any(key == canonical_guidance(fact.text) for fact in verbatim) or
            ('kind' in cue and (cue['kind'] == 'question') != bool(cue['information_needed'].strip()))):
        raise FeedbackError('invalid_descriptions')
    seen.add(key)
    return None if any(fact.uncertain for fact in facts) else facts


def normalize_part(prepared, receipt, phase, offset, *, fact_parts=()):
    """Normalize a persisted receipt without keys, media, or a second provider call."""
    deck = prepared.analysis
    indexes = _indexes(deck, offset)
    if (phase not in (FACTS, ENRICHMENT) or prepared.config.provider != 'openrouter' or
            prepared.stage != 'descriptions' or prepared.description_schema_version != V5 or
            (receipt.provider, receipt.model, receipt.stage, receipt.input_hash) !=
            (prepared.config.provider, prepared.config.model, prepared.stage, prepared.input_hash)):
        raise FeedbackError('receipt_mismatch')
    value = provider.output_json(receipt, max_output_bytes=MAX_OUTPUT_BYTES)
    schema = _FactsOutput if phase == FACTS else _EnrichmentOutput
    parsed = validated(schema, value, 'invalid_descriptions', MAX_OUTPUT_BYTES)
    rows = _ordered(parsed.model_dump(mode='json')['slides'], indexes)
    if phase == FACTS:
        by_slide = {slide.slide_index: description_facts(slide) for slide in parsed.slides}
        for row in rows:
            i = row['slide_index']
            row.update(deck_id=deck.source.deck_id, source_id=deck.source_ids[i], go_deeper=[])
            registry, seen = by_slide[i], set()
            row['must_cover'] = [cue for cue in row['must_cover']
                                 if _citable_facts(cue, cue['evidence_refs'], registry, seen, slide_facts=registry.values())]
        return validate_profiles({'slides': rows}, deck, V5, slide_indexes=indexes).model_dump(mode='json')

    facts = _frozen_facts(deck, fact_parts)
    # Receipt-only recovery can rebuild this text request from the frozen facts, even if
    # the original slide files are gone. A different registry cannot reinterpret a selector.
    if _request(deck, prepared.config, phase, indexes, facts).input_hash != prepared.input_hash:
        raise FeedbackError('receipt_mismatch')
    registry = {(slide.slide_index, ref): fact for slide in facts for ref, fact in description_facts(slide).items()}
    for row in rows:
        i = row['slide_index']
        row.update(deck_id=deck.source.deck_id, source_id=deck.source_ids[i])
        retained = []
        seen = {canonical_guidance(cue.text) for cue in facts[i].must_cover}
        for cue in row['go_deeper']:
            refs = cue['evidence_refs']
            selected = _citable_facts(cue, [(ref['slide_index'], ref['fact_ref']) for ref in refs], registry, seen)
            if selected is None:
                continue
            for ref, fact in zip(refs, selected):
                ref.update(source_id=deck.source_ids[ref['slide_index']], quote=fact.text)
            retained.append(cue)
        row['go_deeper'] = retained
    _with_enrichments(deck, facts, {row['slide_index']: row['go_deeper'] for row in rows})
    return {'slides': rows}


def assemble_profiles(deck, fact_parts, enrichment_parts):
    """Only completed, original-source groups publish a full public v5 profile."""
    _indexes(deck, 0)
    facts = _frozen_facts(deck, fact_parts)
    rows = _collect(deck, enrichment_parts)
    for row in rows:
        if (set(row) != {'slide_index', 'deck_id', 'source_id', 'go_deeper'} or
                row['deck_id'] != deck.source.deck_id or row['source_id'] != deck.source_ids[row['slide_index']]):
            raise FeedbackError('invalid_descriptions')
    return _with_enrichments(deck, facts, {row['slide_index']: row['go_deeper'] for row in rows})
