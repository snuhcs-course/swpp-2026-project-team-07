"""Synthetic index-selection regressions. No provider calls or private speech."""
from copy import deepcopy
from dataclasses import replace
from unittest import TestCase

from .services.feedback import FeedbackError


class IndexSelectionTests(TestCase):
    def setUp(self):
        from .test_presentation_score import PresentationScoreTests
        self.fixture = PresentationScoreTests()
        self.fixture.setUp()
        self.bundle = self.fixture.bundle

    def selection(self):
        raw = deepcopy(self.fixture.output())
        for key in ('assessments', 'weaknesses', 'strengths', 'improvements'):
            for item in raw[key]:
                for owner in [item, *item.get('deductions', [])]:
                    owner['evidence'] = [
                        {k: r[k] for k in ('kind', 'word_start', 'word_end')} if r['kind'] == 'speech' else r
                        for r in owner['evidence']]
        return raw

    def reconstruct(self, raw=None, bundle=None, binding=None):
        from .services import presentation_evidence_selection as selection
        bundle = bundle or self.bundle
        return selection.reconstruct_output(bundle, raw or self.selection(),
            binding=binding or selection.bind(self.bundle, 'a' * 64))

    def test_contract_reconstructs_existing_citations_without_mutating_selection(self):
        raw = self.selection(); before = deepcopy(raw)
        result = self.reconstruct(raw)
        self.assertEqual(raw, before)
        self.assertEqual(result['model_selection'], before)
        self.assertEqual(result['derived_output'], self.fixture.output())
        self.assertEqual(result['audit']['invalid_occurrences'], 0)
        self.assertEqual(result['audit']['reference_occurrences'], 12)  # 11 speech + pacing measurement.
        score = self.fixture.scorer.validate_output(self.bundle, result['derived_output'])
        self.assertEqual(score['total_numerator'], 300)

    def test_inclusive_ranges_and_last_word_keep_original_visit_and_times(self):
        raw = self.selection()
        for start, end, quote, times, visit in [(0, 1, 'Hello, 안녕!', (100, 1100), 0),
                (4, 4, 'Return.', (2200, 2500), 2)]:
            raw['assessments'][0]['evidence'] = [{'kind': 'speech', 'word_start': start, 'word_end': end}]
            result = self.reconstruct(raw)
            self.assertEqual(result['audit']['invalid_occurrences'], 0)
            ref = result['derived_output']['assessments'][0]['evidence'][0]
            self.assertEqual((ref['quote'], ref['start_ms'], ref['end_ms'], ref['visit_id']), (quote, *times, visit))
            self.assertEqual(ref['slide_index'], 0)

    def test_invalid_index_types_and_extra_fields_never_coerce(self):
        for change in [{'word_start': True}, {'word_start': 0.0}, {'word_end': '1'},
                {'word_start': -1}, {'quote': 'invented'}]:
            raw = self.selection(); raw['assessments'][0]['evidence'][0].update(change)
            with self.subTest(change=change), self.assertRaises(FeedbackError): self.reconstruct(raw)

    def test_reversed_out_of_bounds_and_cross_visit_ranges_are_audited_not_repaired(self):
        for start, end, reason in [(2, 1, 'invalid_indices'), (0, 5, 'invalid_indices'),
                (1, 2, 'cross_visit'), (0, 4, 'cross_visit')]:
            raw = self.selection(); raw['assessments'][0]['evidence'][0].update(word_start=start, word_end=end)
            result = self.reconstruct(raw)
            self.assertIsNone(result['derived_output'])
            self.assertEqual(result['audit']['invalid_occurrences'], 1)
            self.assertEqual(result['audit']['rejection_reasons'], {reason: 1})
            self.assertEqual(result['model_selection'], raw)

    def test_binding_cannot_move_valid_indices_to_another_attempt(self):
        from .services import presentation_evidence_selection as selection
        from .services.feedback import prepare_analysis, validate_descriptions
        from .test_feedback import fixture, description_value
        source, images = fixture(slides=3)
        source['attempt_id'] = '44444444-4444-4444-8444-444444444444'
        source['transcript']['words'][2].update(start_ms=1000, end_ms=2000)
        analysis = prepare_analysis(source, images)
        other = self.fixture.scorer.capture(analysis, validate_descriptions(description_value(analysis), analysis),
            requirements=self.bundle.requirements, correction=self.bundle.correction, revisions=self.bundle.revisions,
            measurements={**self.bundle.measurements, 'attempt_id': source['attempt_id']})
        raw = self.selection(); raw['source_id'] = other.identity
        with self.assertRaises(FeedbackError):
            selection.reconstruct_output(other, raw, binding=selection.bind(self.bundle, 'a' * 64))
        derived = self.reconstruct()['derived_output']
        derived['assessments'][0]['evidence'][0]['attempt_id'] = source['attempt_id']
        with self.assertRaises(FeedbackError): self.fixture.scorer.validate_output(self.bundle, derived)

    def test_transcript_and_source_revision_changes_invalidate_binding(self):
        from .services import presentation_evidence_selection as selection
        for revisions in [dict(self.bundle.revisions, transcript_revision=1),
                dict(self.bundle.revisions, profile_revision=2), dict(self.bundle.revisions, audio_hash='b'*64),
                dict(self.bundle.revisions, profile_generation=2), dict(self.bundle.revisions, requirements_revision=1)]:
            changed = replace(self.bundle, revisions=revisions)
            with self.subTest(revisions=revisions), self.assertRaises(FeedbackError): self.reconstruct(bundle=changed)
        changed = replace(self.bundle, analysis=replace(self.bundle.analysis, transcript_id='b'*64))
        with self.assertRaises(FeedbackError): self.reconstruct(bundle=changed)
        raw = self.selection(); raw['source_id'] = 'b'*64
        with self.assertRaises(FeedbackError): self.reconstruct(raw)

    def test_corrections_remain_original_index_overlays_with_partial_overlap(self):
        from .services import presentation_evidence_selection as selection
        from .services.corrections import effective_text
        edits = [{'word_start': 0, 'word_end': 1, 'text': 'Recognized replacement words'}]
        correction = {'revision': 1, 'edits': edits,
            'effective_text': effective_text(self.bundle.analysis.source.transcript.model_dump(mode='json'), edits)}
        changed = self.fixture.scorer.capture(self.bundle.analysis, self.bundle.descriptions,
            measurements=self.bundle.measurements, requirements=self.bundle.requirements,
            correction=correction, revisions=dict(self.bundle.revisions, transcript_revision=1))
        raw = self.selection(); raw['source_id'] = changed.identity
        result = selection.reconstruct_output(changed, raw, binding=selection.bind(changed, 'a'*64))
        ref = result['derived_output']['assessments'][0]['evidence'][0]
        self.assertEqual((ref['word_start'], ref['word_end'], ref['quote']), (0, 0, 'Hello,'))
        self.assertEqual(result['evidence'][0]['correction_mappings'], edits)
        self.assertEqual(result['binding']['source_revisions']['transcript_revision'], 1)
        with self.assertRaises(FeedbackError): self.reconstruct(raw, bundle=changed)

    def test_ambiguous_source_ownership_is_rejected(self):
        from .services import presentation_evidence_selection as selection
        a = self.bundle.analysis
        # Direct resolver also refuses ambiguity; bundle validation separately rejects tampering.
        for changed in [replace(a, segments=(*a.segments, a.segments[0])),
                replace(a, source=a.source.model_copy(update={'visits': (*a.source.visits, a.source.visits[0])}))]:
            with self.assertRaises(FeedbackError):
                selection.reconstruct_speech(replace(self.bundle, analysis=changed),
                    {'kind': 'speech', 'word_start': 0, 'word_end': 0})

    def test_bad_non_speech_references_still_fail_strict_validation(self):
        raw = self.selection()
        raw['assessments'][0]['evidence'].append({'kind': 'measurement',
            'attempt_id': self.bundle.analysis.source.attempt_id, 'audio_hash': 'a'*64,
            'measurement_id': 'missing', 'start_ms': 0, 'end_ms': 100})
        result = self.reconstruct(raw)
        self.assertIsNone(result['derived_output'])
        self.assertEqual(result['audit']['rejection_reasons'], {'strict_evidence': 1})

    def test_same_visit_multisegment_span_and_quote_limit(self):
        from .services import presentation_evidence_selection as selection
        from .services.feedback import prepare_analysis, validate_descriptions
        from .test_feedback import fixture, description_value
        words = [{'text': 'word', 'start_ms': i*100, 'end_ms': (i+1)*100} for i in range(201)]
        source, images = fixture(words=words, events=[{'slide_index': 0, 'at_ms': 0}], duration_ms=21000)
        a = prepare_analysis(source, images)
        b = replace(self.bundle, analysis=a)
        self.assertGreater(len(a.segments), 1)
        end = a.segments[1].word_indexes[0]
        ref = selection.reconstruct_speech(b, {'kind': 'speech', 'word_start': 0, 'word_end': end})
        self.assertEqual(ref['segment_id'], 'v0s0')
        self.assertEqual(ref['word_end'], end)
        with self.assertRaises(FeedbackError):
            selection.reconstruct_speech(b, {'kind': 'speech', 'word_start': 0, 'word_end': 200})

    def test_nested_deductions_weaknesses_and_noncontiguous_improvements_reconstruct(self):
        raw = self.selection(); ref = {'kind': 'speech', 'word_start': 0, 'word_end': 0}
        raw['weaknesses'] = [{'id': 'opening', 'primary': 'purpose_introduction',
            'observation': 'Synthetic missing orientation.', 'evidence': [deepcopy(ref)], 'omission_basis': None}]
        raw['assessments'][0].update(level='competent', deductions=[{'weakness_id': 'opening',
            'distinct_consequence': '', 'evidence': [deepcopy(ref)]}])
        raw['improvements'] = [{'text': 'State the purpose in the opening.', 'evidence': [deepcopy(ref),
            {'kind': 'speech', 'word_start': 4, 'word_end': 4}]}]
        result = self.reconstruct(raw)
        derived = result['derived_output']
        self.assertEqual(derived['assessments'][0]['deductions'][0]['evidence'][0]['quote'], 'Hello,')
        self.assertEqual(derived['weaknesses'][0]['evidence'][0]['quote'], 'Hello,')
        self.assertEqual([r['visit_id'] for r in derived['improvements'][0]['evidence']], [0, 2])
        self.assertEqual(self.fixture.scorer.validate_output(self.bundle, derived)['total_numerator'], 292)
        raw['assessments'][0]['deductions'][0]['evidence'][0]['word_end'] = 99
        self.assertIsNone(self.reconstruct(raw)['derived_output'])
