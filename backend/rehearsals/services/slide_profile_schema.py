"""Immutable, audience-independent slide profiles for Iteration 2."""
from typing import Annotated, Literal
import re
from .evidence import verified_excerpt
from pydantic import Field
from .feedback import (Description, Descriptions, PrivateModel, ShortText, FeedbackError,
                       MAX_OUTPUT_BYTES, validated, description_facts, validate_descriptions)

PROFILE_PROMPT_VERSION = 'slide-profile-v5'
PROFILE_SCHEMAS = {'openai': 'slide-profile-v5', 'gemini': 'slide-profile-gemini-v5'}
STRICT_PROFILE_SCHEMAS = {'openai': 'slide-profile-v4', 'gemini': 'slide-profile-gemini-v4'}
HISTORICAL_PROFILE_SCHEMAS = {'openai': 'slide-profile-v1', 'gemini': 'slide-profile-gemini-v1'}
CATEGORY_PROFILE_SCHEMAS = {'openai': 'slide-profile-v2', 'gemini': 'slide-profile-gemini-v2'}
REFINED_PROFILE_SCHEMAS = {'openai': 'slide-profile-v3', 'gemini': 'slide-profile-gemini-v3'}
# Explicit union of Unicode whitespace used by Python and ECMAScript. Keep the
# same policy in mobile/slideProfiles.ts so accepted outputs survive parsing.
CUE_WORD_SEPARATOR = re.compile(r'[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+')


def cue_word_count(text):
    return sum(bool(word) for word in CUE_WORD_SEPARATOR.split(text))


class Cue(PrivateModel):
    text: ShortText
    evidence_refs: Annotated[tuple[Annotated[str, Field(pattern=r'^(summary|key_ideas/[0-4]|visual_facts/[0-4])$')], ...], Field(min_length=1, max_length=5)]


class SlideProfile(Description):
    slide_kind: Literal['title', 'content', 'closing', 'unknown']
    cues: Annotated[tuple[Cue, ...], Field(max_length=4)]


class SlideProfiles(Descriptions):
    slides: Annotated[tuple[SlideProfile, ...], Field(min_length=1)]


class DeckFactReference(PrivateModel):
    slide_index: Annotated[int, Field(ge=0)]
    source_id: Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]
    fact_ref: Annotated[str, Field(pattern=r'^(summary|key_ideas/[0-4]|visual_facts/[0-4])$')]
    quote: ShortText


class Enrichment(PrivateModel):
    text: ShortText
    kind: Literal['connection', 'question']
    evidence_refs: Annotated[tuple[DeckFactReference, ...], Field(min_length=1, max_length=5)]
    information_needed: Annotated[str, Field(max_length=400)]


class GuidanceProfile(Description):
    slide_kind: Literal['title', 'content', 'closing', 'unknown']
    must_cover: Annotated[tuple[Cue, ...], Field(max_length=3)]
    go_deeper: Annotated[tuple[Enrichment, ...], Field(max_length=3)]


class GuidanceProfiles(Descriptions):
    slides: Annotated[tuple[GuidanceProfile, ...], Field(min_length=1)]


def is_profile_schema(version):
    return version in (*PROFILE_SCHEMAS.values(), *STRICT_PROFILE_SCHEMAS.values(), *HISTORICAL_PROFILE_SCHEMAS.values(), *CATEGORY_PROFILE_SCHEMAS.values(), *REFINED_PROFILE_SCHEMAS.values())


def profile_prompt_version(version):
    if version in STRICT_PROFILE_SCHEMAS.values():
        return 'slide-profile-v4'
    if version in HISTORICAL_PROFILE_SCHEMAS.values():
        return 'slide-profile-v1'
    if version in REFINED_PROFILE_SCHEMAS.values():
        return 'slide-profile-v3'
    return 'slide-profile-v2' if version in CATEGORY_PROFILE_SCHEMAS.values() else PROFILE_PROMPT_VERSION


def canonical_guidance(text):
    return re.sub(r'[^\w]', '', text.casefold())


def validate_profiles(value, prepared, schema_version=None):
    historical = schema_version in HISTORICAL_PROFILE_SCHEMAS.values()
    limit = 25 if schema_version is None or schema_version in PROFILE_SCHEMAS.values() else 15 if schema_version in STRICT_PROFILE_SCHEMAS.values() else None
    profiles = validated(SlideProfiles if historical else GuidanceProfiles, value, 'invalid_descriptions', MAX_OUTPUT_BYTES)
    # Reuse strict source identities and fact/uncertainty checks without changing
    # the historical description schemas or their serialized bytes.
    legacy = {'slides': [{k: v for k, v in s.model_dump(mode='json').items()
                          if k not in {'slide_kind', 'cues', 'must_cover', 'go_deeper'}} for s in profiles.slides]}
    validate_descriptions(legacy, prepared)
    deck_facts = {s.slide_index: (s.source_id, description_facts(s)) for s in profiles.slides}
    for slide in profiles.slides:
        facts = description_facts(slide)
        seen = set()
        for cue in (slide.cues if historical else slide.must_cover):
            if limit is not None and cue_word_count(cue.text) > limit:
                raise FeedbackError('invalid_descriptions')
            key = cue.text if historical else canonical_guidance(cue.text)
            if (not key or key in seen or len(set(cue.evidence_refs)) != len(cue.evidence_refs)
                    or any(ref not in facts or facts[ref].uncertain for ref in cue.evidence_refs)):
                raise FeedbackError('invalid_descriptions')
            if not historical and any(key == canonical_guidance(f.text) for f in facts.values()):
                raise FeedbackError('invalid_descriptions')
            seen.add(key)
        if historical:
            continue
        for cue in slide.go_deeper:
            if limit is not None and cue_word_count(cue.text) > limit:
                raise FeedbackError('invalid_descriptions')
            key = canonical_guidance(cue.text)
            refs = [(r.slide_index, r.source_id, r.fact_ref) for r in cue.evidence_refs]
            if (not key or key in seen or len(set(refs)) != len(refs)
                    or (cue.kind == 'question') != bool(cue.information_needed.strip())):
                raise FeedbackError('invalid_descriptions')
            for ref in cue.evidence_refs:
                source, other = deck_facts.get(ref.slide_index, (None, {}))
                fact = other.get(ref.fact_ref)
                if source != ref.source_id or fact is None or fact.uncertain or verified_excerpt(ref.quote,fact.text) is None:
                    raise FeedbackError('invalid_descriptions')
                if key == canonical_guidance(fact.text):
                    raise FeedbackError('invalid_descriptions')
            seen.add(key)
    return profiles
