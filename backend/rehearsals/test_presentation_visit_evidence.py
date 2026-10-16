"""Original local words and strict frozen reconstruction regressions."""
from copy import deepcopy
from dataclasses import replace
from unittest import TestCase
from .services.feedback import FeedbackError
from .test_feedback import fixture
from .test_presentation_score_v2 import make_bundle,speech

class PresentationVisitEvidenceTests(TestCase):
    def setUp(self):
        from .services import presentation_visit_evidence as evidence
        self.evidence=evidence;source,images=fixture(slides=3)
        self.bundle=make_bundle(source=source,images=images)

    def test_local_zero_selects_later_original_word(self):
        ref=self.evidence.reconstruct(self.bundle,[speech('v2')])[0]
        self.assertEqual(ref['word_start'],4);self.assertEqual(ref['quote'],'Return.')
        self.assertEqual((ref['visit_id'],ref['slide_index'],ref['start_ms']),(2,0,2200))

    def test_registry_has_enumerated_visits_certain_facts_without_global_index(self):
        registry=self.evidence.registry(self.bundle)
        self.assertEqual([v['visit_id'] for v in registry['visits']],['v0','v1','v2'])
        self.assertEqual(registry['visits'][2]['words'][0]['visit_word_index'],0)
        self.assertNotIn('word_index',registry['visits'][2]['words'][0])
        self.assertNotIn('s0:visual_facts/0',[f['fact_id'] for f in registry['facts']])
        ref=self.evidence.reconstruct(self.bundle,[{'kind':'slide','fact_id':'s0:key_ideas/0'}])[0]
        self.assertEqual(ref['quote'],'Save before analysis.')

    def test_bad_indices_unknown_handles_and_extra_fields_reject(self):
        bad=[speech('v99'),speech(start=True),speech(end=1.0),speech(start=1,end=0),speech(end=2),
            {**speech(),'word_start':0},{'kind':'slide','fact_id':'s0:visual_facts/0'},
            {'kind':'speech','word_start':0,'word_end':0}]
        for ref in bad:
            with self.subTest(ref=ref),self.assertRaises(FeedbackError):self.evidence.reconstruct(self.bundle,[ref])

    def test_separate_repeated_visits_original_quotes_survive_corrections(self):
        source,images=fixture(slides=3)
        correction={'revision':1,'edits':[{'word_start':4,'word_end':4,'text':'Corrected word.'}],
            'effective_text':'Hello, 안녕! Hello, 안녕! Corrected word.'}
        b=make_bundle(source=source,images=images,correction=correction,
            revisions={'audio_hash':'a'*64,'transcript_revision':1,'profile_revision':1,'requirements_revision':None})
        refs=self.evidence.reconstruct(b,[speech(),speech('v2')])
        self.assertEqual([r['quote'] for r in refs],['Hello,','Return.']);self.assertEqual([r['visit_id'] for r in refs],[0,2])
        registry=self.evidence.registry(b)
        self.assertEqual(registry['corrections']['effective_text'],correction['effective_text'])
        self.assertEqual(registry['corrections']['edits'][0]['selections'],[speech('v2')])

    def test_mutated_source_or_segments_reject(self):
        b=replace(self.bundle,analysis=replace(self.bundle.analysis,segments=()))
        with self.assertRaises(FeedbackError):self.evidence.reconstruct(b,[speech()])
        b=deepcopy(self.bundle);b.revisions['transcript_revision']=2
        with self.assertRaises(FeedbackError):self.evidence.reconstruct(b,[speech()])

    def test_40_word_segment_boundary_is_deterministic_not_repaired(self):
        words=[{'text':f'w{i}','start_ms':i*10,'end_ms':i*10+9} for i in range(45)]
        source,images=fixture(words=words,events=[{'slide_index':0,'at_ms':0}],slides=1,duration_ms=500)
        b=make_bundle(source=source,images=images,measurements={**self.bundle.measurements,'duration_ms':500,
            'items':[{'id':'speech_0','kind':'speech','start_ms':0,'end_ms':449,'value':449,'unit':'ms'}]})
        ref=self.evidence.reconstruct(b,[speech(start=39,end=41)])[0]
        self.assertEqual((ref['word_start'],ref['word_end'],ref['segment_id']),(39,41,'v0s0'))
        self.assertEqual(ref['quote'],'w39 w40 w41')


    def test_non_speech_references_derive_source_identity_and_exact_bounds(self):
        refs = self.evidence.reconstruct(self.bundle, [
            {'kind': 'measurement', 'measurement_id': 'speech_0'},
            {'kind': 'full_attempt'},
            {'kind': 'slide', 'fact_id': 's0:summary'},
        ])
        measurement, full, slide = refs
        self.assertEqual(measurement, {
            'kind': 'measurement', 'measurement_id': 'speech_0',
            'attempt_id': '33333333-3333-4333-8333-333333333333',
            'audio_hash': 'a' * 64, 'start_ms': 100, 'end_ms': 500,
            'measurement': {'id': 'speech_0', 'kind': 'speech', 'start_ms': 100,
                            'end_ms': 500, 'value': 400, 'unit': 'ms'},
        })
        self.assertEqual(full, {
            'kind': 'full_attempt', 'attempt_id': '33333333-3333-4333-8333-333333333333',
            'source_id': self.bundle.identity, 'start_ms': 0, 'end_ms': 3000,
        })
        self.assertEqual(slide['source_id'], self.bundle.analysis.source_ids[0])
        self.assertEqual((slide['slide_index'], slide['fact_ref'], slide['quote']),
                         (0, 'summary', 'Synthetic slide 0'))
        registry = self.evidence.registry(self.bundle)
        self.assertEqual(registry['measurements']['items'][0]['id'], 'speech_0')
        self.assertEqual(registry['requirements']['context_id'], None)
        registry['measurements']['items'][0]['value'] = 0
        self.assertEqual(self.bundle.measurements['items'][0]['value'], 400)

    def test_saved_requirement_fields_derive_exact_revision_and_quote(self):
        from .services import presentation_score as v1
        requirements = {'context_id': '55555555-5555-4555-8555-555555555555',
                        'revision': 3, 'audience': 'First year students',
                        'required_duration_seconds': 300}
        bundle = v1.capture(self.bundle.analysis, self.bundle.descriptions,
            measurements=self.bundle.measurements, requirements=requirements,
            correction=self.bundle.correction,
            revisions={**self.bundle.revisions, 'requirements_revision': 3})
        refs = self.evidence.reconstruct(bundle, [
            {'kind': 'requirement', 'field': 'audience'},
            {'kind': 'requirement', 'field': 'required_duration_seconds'},
        ])
        self.assertEqual(refs, [
            {'kind': 'requirement', 'context_id': requirements['context_id'],
             'revision': 3, 'field': 'audience', 'quote': 'First year students'},
            {'kind': 'requirement', 'context_id': requirements['context_id'],
             'revision': 3, 'field': 'required_duration_seconds', 'quote': '300'},
        ])
        self.assertEqual(self.evidence.registry(bundle)['requirements']['revision'], 3)

    def test_unavailable_measurements_and_missing_requirements_reject(self):
        unavailable = make_bundle(measurements={**self.bundle.measurements,
                                               'status': 'unavailable', 'items': []})
        for bundle, selection in [
            (unavailable, {'kind': 'measurement', 'measurement_id': 'speech_0'}),
            (self.bundle, {'kind': 'requirement', 'field': 'audience'}),
            (self.bundle, {'kind': 'requirement', 'field': 'required_duration_seconds'}),
        ]:
            with self.subTest(selection=selection), self.assertRaises(FeedbackError):
                self.evidence.reconstruct(bundle, [selection])

    def test_malformed_handles_and_forged_non_speech_fields_reject(self):
        bad = [
            {'kind': 'slide', 'fact_id': 's00:summary'},
            {'kind': 'slide', 'fact_id': 's0:key_ideas/00'},
            {'kind': 'slide', 'fact_id': 's0:key_ideas/-1'},
            {'kind': 'slide', 'fact_id': 's3:summary'},
            {'kind': 'slide', 'fact_id': []},
            {'kind': 'measurement', 'measurement_id': 'speech_999'},
            {'kind': 'measurement', 'measurement_id': True},
            {'kind': 'measurement', 'measurement_id': 'speech_0', 'start_ms': 0},
            {'kind': 'requirement', 'field': 'purpose'},
            {'kind': 'requirement', 'field': []},
            {'kind': 'full_attempt', 'source_id': self.bundle.identity},
            {'kind': 'full_attempt', 'end_ms': 3000},
            {'kind': []}, {}, None, 'speech',
            speech('v00'), speech(0), speech('v0', -1, 0),
        ]
        for selection in bad:
            with self.subTest(selection=selection), self.assertRaises(FeedbackError):
                self.evidence.reconstruct(self.bundle, [selection])
        for selections in (None, {}, 'speech', (speech(),)):
            with self.subTest(selections=selections), self.assertRaises(FeedbackError):
                self.evidence.reconstruct(self.bundle, selections)

    def test_locally_adjacent_words_with_global_gap_are_not_joined(self):
        words = [
            {'text': 'First.', 'start_ms': 100, 'end_ms': 200},
            {'text': 'Other.', 'start_ms': 1200, 'end_ms': 1300},
            {'text': 'Earlier.', 'start_ms': 300, 'end_ms': 400},
        ]
        source, images = fixture(words=words, slides=3)
        bundle = make_bundle(source=source, images=images)
        self.assertEqual([w['text'] for w in self.evidence.registry(bundle)['visits'][0]['words']],
                         ['First.', 'Earlier.'])
        with self.assertRaises(FeedbackError):
            self.evidence.reconstruct(bundle, [speech('v0', 0, 1)])
        refs = self.evidence.reconstruct(bundle, [speech(), speech('v0', 1, 1)])
        self.assertEqual([(r['word_start'], r['segment_id'], r['quote']) for r in refs],
                         [(0, 'v0s0', 'First.'), (2, 'v0s1', 'Earlier.')])

    def test_mutated_ambiguous_segments_reject_for_registry_and_reconstruction(self):
        first = self.bundle.analysis.segments[0]
        segments = self.bundle.analysis.segments + (replace(first, segment_id='forged'),)
        bundle = replace(self.bundle, analysis=replace(self.bundle.analysis, segments=segments))
        for operation in (lambda: self.evidence.registry(bundle),
                          lambda: self.evidence.reconstruct(bundle, [speech()])):
            with self.assertRaises(FeedbackError):
                operation()

    def test_correction_spanning_visits_maps_original_intervals_without_replacing_words(self):
        source, images = fixture(slides=3)
        correction = {'revision': 1,
            'edits': [{'word_start': 1, 'word_end': 2, 'text': 'recognized phrase'}],
            'effective_text': 'Hello, recognized phrase 안녕! Return.'}
        bundle = make_bundle(source=source, images=images, correction=correction,
            revisions={**self.bundle.revisions, 'transcript_revision': 1})
        registry = self.evidence.registry(bundle)
        self.assertEqual(registry['corrections']['edits'], [
            {'text': 'recognized phrase', 'selections': [speech('v0', 1, 1), speech('v1')]},
        ])
        refs = self.evidence.reconstruct(bundle, registry['corrections']['edits'][0]['selections'])
        self.assertEqual([r['quote'] for r in refs], ['안녕!', 'Hello,'])
        self.assertEqual([r['word_start'] for r in refs], [1, 2])
