"""Experiment-only index selection. Original citations/validator remain authoritative."""
from collections import Counter
from copy import deepcopy
import hashlib
import re
from typing import Annotated, Literal

from pydantic import Field

from . import presentation_score as scorer
from .feedback import FeedbackError, PrivateModel, json_bytes, validated

VERSION = 'speech-index-selection-v1'
RECONSTRUCTION_VERSION = 'speech-reconstruction-v1'
_old_instructions = scorer.RULES.index('For speech citations,')
_end_instructions = scorer.RULES.index('Give rubric-specific justifications')
RULES = (scorer.RULES[:_old_instructions] + '''For speech evidence return ONLY {"kind":"speech","word_start":integer,"word_end":integer}.
Indices are original zero-based word positions, inclusive, in this request's frozen transcript.
Never index effective/corrected text. Never return quotations, timestamps or identities inside
speech selections. The backend derives those fields exactly from the selected original words.
Choose a bounded range within ONE visit. Split noncontiguous/cross-visit evidence into separate
selections yourself; the backend never repairs, expands or guesses selected indices.
''' + scorer.RULES[_end_instructions:]).replace(
    'source_id is the bundle identity.',
    'The ROOT source_id is the supplied bundle identity. Other evidence types retain their schema-defined identities.')


class SpeechSelection(PrivateModel):
    kind: Literal['speech']
    word_start: scorer.Index
    word_end: scorer.Index


Evidence = SpeechSelection | scorer.SlideEvidence | scorer.MeasurementEvidence | scorer.RequirementEvidence | scorer.FullAttemptEvidence
References = Annotated[tuple[Evidence, ...], Field(max_length=20)]


class Deduction(scorer.Deduction):
    evidence: References


class Assessment(scorer.Assessment):
    evidence: References
    deductions: Annotated[tuple[Deduction, ...], Field(max_length=10)]


class Weakness(scorer.Weakness):
    evidence: References


class Advice(scorer.Advice):
    evidence: References


class Output(scorer.Output):
    assessments: Annotated[tuple[Assessment, ...], Field(min_length=10, max_length=10)]
    weaknesses: Annotated[tuple[Weakness, ...], Field(max_length=20)]
    strengths: Annotated[tuple[Advice, ...], Field(min_length=1, max_length=5)]
    improvements: Annotated[tuple[Advice, ...], Field(max_length=3)]


def digest(value):
    return hashlib.sha256(json_bytes(value)).hexdigest()


def protocol():
    return {'selection_version': VERSION, 'reconstruction_version': RECONSTRUCTION_VERSION,
            'prompt_sha256': digest(RULES), 'schema_sha256': digest(Output.model_json_schema())}


def bind(bundle, input_hash):
    """Server-only request binding; never accept a model/client-authored binding."""
    scorer._check_bundle(bundle)
    if type(input_hash) is not str or not re.fullmatch('[a-f0-9]{64}', input_hash):
        raise FeedbackError('source_mismatch')
    return {**protocol(), 'source_id': bundle.identity, 'attempt_id': bundle.analysis.source.attempt_id,
            'transcript_id': bundle.analysis.transcript_id,
            'source_revisions': deepcopy(bundle.revisions), 'input_hash': input_hash}


def reconstruct_speech(bundle, raw):
    selection = validated(SpeechSelection, raw, 'invalid_speech_selection')
    a = bundle.analysis
    start, end = selection.word_start, selection.word_end
    words = a.source.transcript.words
    if not 0 <= start <= end < len(words): raise FeedbackError('invalid_indices')
    owners = []
    for index in range(start, end + 1):
        visits = [i for i, visit in enumerate(a.source.visits) if index in visit.word_indexes]
        if len(visits) != 1: raise FeedbackError('ambiguous_visit')
        owners.append(visits[0])
    if len(set(owners)) != 1: raise FeedbackError('cross_visit')
    visit_id = owners[0]; visit = a.source.visits[visit_id]
    segments = [s for s in a.segments if start in s.word_indexes]
    if (len(segments) != 1 or segments[0].visit_id != visit_id
            or segments[0].slide_index != visit.slide_index):
        raise FeedbackError('ambiguous_segment')
    selected = words[start:end + 1]
    quote = scorer.authoritative_quote(' '.join(w.text for w in selected))
    if not quote: raise FeedbackError('quote_limit')
    start_ms, end_ms = min(w.start_ms for w in selected), max(w.end_ms for w in selected)
    if not 0 <= start_ms < end_ms <= a.source.duration_ms: raise FeedbackError('invalid_timing')
    ref = {'kind': 'speech', 'word_start': start, 'word_end': end,
           'attempt_id': a.source.attempt_id, 'transcript_id': a.transcript_id,
           'source_id': a.source_ids[visit.slide_index], 'slide_index': visit.slide_index,
           'visit_id': visit_id, 'segment_id': segments[0].segment_id,
           'quote': quote, 'start_ms': start_ms, 'end_ms': end_ms}
    scorer._references(bundle, [validated(scorer.SpeechEvidence, ref)])
    return ref


def reference_arrays(output):
    for group in ('assessments', 'weaknesses', 'strengths', 'improvements'):
        for i, item in enumerate(output[group]):
            yield f'{group}.{i}.evidence', item['evidence']
            for j, deduction in enumerate(item.get('deductions', [])):
                yield f'{group}.{i}.deductions.{j}.evidence', deduction['evidence']


def reconstruct_output(bundle, raw_selection, *, binding):
    """Preserve selections and provenance separately; any rejection suppresses output.

    The caller must match binding.input_hash to the dispatched request before calling.
    A valid reconstruction still requires scorer.validate_output before any score.
    """
    if type(binding) is not dict or binding != bind(bundle, binding.get('input_hash')):
        raise FeedbackError('source_mismatch')
    parsed = validated(Output, raw_selection, 'invalid_score_selection').model_dump(mode='json')
    if parsed['source_id'] != bundle.identity: raise FeedbackError('source_mismatch')
    derived = deepcopy(parsed); records = []; failures = []; reasons = Counter()
    unique = set(); bad = set(); count = 0
    for path, refs in reference_arrays(derived):
        for i, raw in enumerate(refs):
            count += 1; key = digest(raw); unique.add(key)
            record = {'path': f'{path}.{i}', 'selection': deepcopy(raw)}
            try:
                if raw['kind'] == 'speech':
                    ref = reconstruct_speech(bundle, raw)
                    record['correction_mappings'] = [deepcopy(e) for e in bundle.correction['edits']
                        if e['word_start'] <= raw['word_end'] and raw['word_start'] <= e['word_end']]
                else:
                    # Preserve model fields; validation may enrich measurements later.
                    ref = deepcopy(raw)
                    model = {'slide': scorer.SlideEvidence, 'measurement': scorer.MeasurementEvidence,
                             'requirement': scorer.RequirementEvidence, 'full_attempt': scorer.FullAttemptEvidence}[raw['kind']]
                    parsed_ref = validated(model, raw)
                    scorer._references(bundle, [parsed_ref])
                refs[i] = ref; record['derived'] = deepcopy(ref)
            except FeedbackError as error:
                reason = error.code if raw['kind'] == 'speech' else 'strict_evidence'
                reasons[reason] += 1; bad.add(key)
                record['rejection'] = reason
                failures.append({'path': record['path'], 'kind': raw['kind'], 'reasons': [reason]})
            records.append(record)
    audit = {'status': 'audited', 'reference_occurrences': count, 'unique_references': len(unique),
             'invalid_occurrences': len(failures), 'invalid_unique_references': len(bad),
             'rejection_reasons': dict(reasons), 'failures': failures}
    return {'binding': deepcopy(binding), 'model_selection': deepcopy(raw_selection),
            'derived_output': None if failures else derived, 'evidence': records, 'audit': audit}
