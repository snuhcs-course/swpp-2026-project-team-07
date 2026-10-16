"""Frozen visit-local selections reconstructed from trusted original evidence.

The registry exposes no second selectable global word index. Model selections
never supply quotes, source identities or timestamps, and invalid selections are
never clipped, split, text matched or repaired. Historical v1 reconstruction and
its strict evidence validator remain authoritative.
"""
from copy import deepcopy

from . import presentation_score as v1
from .feedback import FeedbackError, description_facts, validated
from .presentation_evidence_selection import reconstruct_speech

VERSION = 'presentation-visit-evidence-v1'


def _shape(raw, keys):
    if type(raw) is not dict or set(raw) != set(keys):
        raise FeedbackError('invalid_evidence_selection')


def _visits(bundle):
    return {f'v{i}': (i, visit) for i, visit in enumerate(bundle.analysis.source.visits)}


def _facts(bundle):
    return {f's{slide.slide_index}:{path}': (slide, path, fact)
            for slide in bundle.descriptions.slides
            for path, fact in description_facts(slide).items() if not fact.uncertain}


def _speech(bundle, raw, visits):
    _shape(raw, ('kind', 'visit_id', 'visit_word_start', 'visit_word_end'))
    handle, start, end = raw['visit_id'], raw['visit_word_start'], raw['visit_word_end']
    if type(handle) is not str or handle not in visits:
        raise FeedbackError('unknown_visit')
    if type(start) is not int or type(end) is not int:
        raise FeedbackError('invalid_indices')
    _, visit = visits[handle]
    if not 0 <= start <= end < len(visit.word_indexes):
        raise FeedbackError('invalid_indices')
    indexes = visit.word_indexes[start:end + 1]
    if tuple(indexes) != tuple(range(indexes[0], indexes[-1] + 1)):
        raise FeedbackError('noncontiguous_indices')
    # Original-index reconstruction checks every word's unique visit owner and
    # the unique starting segment. A 40-word chunk boundary is not a visit gap.
    return reconstruct_speech(bundle, {'kind': 'speech',
        'word_start': indexes[0], 'word_end': indexes[-1]})


def _correction_edits(bundle, visits):
    positions = {}
    for handle, (_, visit) in visits.items():
        for local, original in enumerate(visit.word_indexes):
            if original in positions:
                raise FeedbackError('ambiguous_visit')
            positions[original] = (handle, local)
    result = []
    for edit in bundle.correction['edits']:
        selections = []
        for original in range(edit['word_start'], edit['word_end'] + 1):
            if original not in positions:
                raise FeedbackError('invalid_correction_mapping')
            handle, local = positions[original]
            if (selections and selections[-1]['visit_id'] == handle
                    and selections[-1]['visit_word_end'] + 1 == local):
                selections[-1]['visit_word_end'] = local
            else:
                selections.append({'kind': 'speech', 'visit_id': handle,
                                   'visit_word_start': local, 'visit_word_end': local})
        for selection in selections:
            _speech(bundle, selection, visits)
        result.append({'text': edit['text'], 'selections': selections})
    return result


def registry(bundle):
    """Return fresh JSON data describing the frozen source's selectable handles."""
    v1._check_bundle(bundle)
    visits = _visits(bundle)
    words = bundle.analysis.source.transcript.words
    return {
        'version': VERSION,
        'visits': [{'visit_id': handle, 'slide_index': visit.slide_index,
                    'start_ms': visit.start_ms, 'end_ms': visit.end_ms,
                    'words': [{'visit_word_index': local, 'text': words[index].text,
                               'start_ms': words[index].start_ms, 'end_ms': words[index].end_ms}
                              for local, index in enumerate(visit.word_indexes)]}
                   for handle, (_, visit) in visits.items()],
        'facts': [{'fact_id': handle, 'slide_index': slide.slide_index, 'text': fact.text}
                  for handle, (slide, _, fact) in _facts(bundle).items()],
        'corrections': {'revision': bundle.correction['revision'],
                        'effective_text': bundle.correction['effective_text'],
                        'edits': _correction_edits(bundle, visits)},
        'measurements': deepcopy(bundle.measurements),
        'requirements': deepcopy(bundle.requirements),
    }


def reconstruct(bundle, selections):
    """Derive full v1 references and validate them; reject the complete bad array.

    full_attempt deliberately retains the v1 bundle identity here. A versioned
    caller may rebind that public identity only after this strict validation.
    """
    v1._check_bundle(bundle)
    if type(selections) is not list or len(selections) > 20:
        raise FeedbackError('invalid_evidence_selection')
    visits, facts = _visits(bundle), _facts(bundle)
    source = bundle.analysis.source
    models = []
    for raw in selections:
        if type(raw) is not dict or type(raw.get('kind')) is not str:
            raise FeedbackError('invalid_evidence_selection')
        kind = raw['kind']
        if kind == 'speech':
            ref = _speech(bundle, raw, visits)
            model = v1.SpeechEvidence
        elif kind == 'slide':
            _shape(raw, ('kind', 'fact_id'))
            handle = raw['fact_id']
            if type(handle) is not str or handle not in facts:
                raise FeedbackError('unknown_fact')
            slide, path, fact = facts[handle]
            ref = {'kind': kind, 'slide_index': slide.slide_index,
                   'source_id': slide.source_id, 'fact_ref': path, 'quote': fact.text}
            model = v1.SlideEvidence
        elif kind == 'measurement':
            _shape(raw, ('kind', 'measurement_id'))
            handle = raw['measurement_id']
            if type(handle) is not str:
                raise FeedbackError('unknown_measurement')
            item = next((item for item in bundle.measurements['items'] if item['id'] == handle), None)
            if bundle.measurements['status'] != 'available' or item is None:
                raise FeedbackError('unknown_measurement')
            ref = {'kind': kind, 'measurement_id': handle, 'attempt_id': source.attempt_id,
                   'audio_hash': bundle.revisions['audio_hash'],
                   'start_ms': item['start_ms'], 'end_ms': item['end_ms']}
            model = v1.MeasurementEvidence
        elif kind == 'requirement':
            _shape(raw, ('kind', 'field'))
            field, requirements = raw['field'], bundle.requirements
            if (type(field) is not str or field not in ('audience', 'required_duration_seconds')
                    or not requirements['context_id'] or requirements.get(field) in (None, '')):
                raise FeedbackError('unknown_requirement')
            ref = {'kind': kind, 'context_id': requirements['context_id'],
                   'revision': requirements['revision'], 'field': field,
                   'quote': str(requirements[field])}
            model = v1.RequirementEvidence
        elif kind == 'full_attempt':
            _shape(raw, ('kind',))
            ref = {'kind': kind, 'attempt_id': source.attempt_id, 'source_id': bundle.identity,
                   'start_ms': 0, 'end_ms': source.duration_ms}
            model = v1.FullAttemptEvidence
        else:
            raise FeedbackError('invalid_evidence_selection')
        models.append(validated(model, ref, 'invalid_score_evidence'))
    return v1._references(bundle, models)
