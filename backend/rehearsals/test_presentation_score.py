"""AI-assisted scoring contracts. Synthetic evidence, never pilot reliability results."""
from copy import deepcopy
from dataclasses import replace
from fractions import Fraction
from unittest import TestCase
from unittest.mock import patch

from .services.feedback import FeedbackError, prepare_analysis, validate_descriptions, json_bytes
from .services import feedback_provider as provider
from .test_feedback import fixture, description_value
from .test_feedback_provider import envelope


IDS = ('purpose_introduction', 'progression_transitions', 'audience_framing',
       'relevance_coverage', 'explanation_depth', 'support_reasoning', 'synthesis_conclusion',
       'language_clarity', 'fluency_continuity', 'pacing_timing')


class PresentationScoreTests(TestCase):
    def test_punctuated_or_retimed_model_quote_cannot_be_published(self):
        # A real model reformatted full-transcript punctuation and guessed timing.
        # Those are not faithful references to the original indexed words.
        original=self.output()
        self.scorer.validate_output(self.bundle,original)
        for change in [{'quote':self.speech()['quote']+','},
                       {'end_ms':self.speech()['end_ms']+1},
                       {'word_end':self.speech()['word_end']+1}]:
            output=deepcopy(original);output['assessments'][0]['evidence'][0].update(change)
            with self.assertRaises(FeedbackError):self.scorer.validate_output(self.bundle,output)

    def test_experiment_purpose_is_explicit_and_changes_the_source_identity(self):
        from .services import presentation_score as scorer
        req={**self.bundle.requirements,'purpose':'Introduce the topic.',
             'purpose_source':'user_confirmed_experiment'}
        b=scorer.capture(self.analysis,self.descriptions,measurements=self.measurements,
            requirements=req,correction=self.bundle.correction,revisions=self.revisions)
        self.assertNotEqual(b.identity,self.bundle.identity)
        prepared=scorer.prepare(b,provider.ProviderConfig('openai','test',''))
        context=__import__('json').loads(__import__('json').loads(prepared.payload)['input'][0]['content'][0]['text'])
        self.assertEqual(context['requirements']['purpose'],'Introduce the topic.')
        output=self.output();output['source_id']=b.identity
        output['assessments'][0]['evidence'].append({'kind':'requirement',
            'context_id':'00000000-0000-4000-8000-000000000000','revision':0,
            'field':'purpose','quote':req['purpose']})
        with self.assertRaises(FeedbackError):scorer.validate_output(b,output)
        for change in [{'purpose_source':'unspecified'},{'purpose':''},{'purpose_source':'slide_inferred'}]:
            with self.assertRaises(FeedbackError):
                scorer.capture(self.analysis,self.descriptions,measurements=self.measurements,
                    requirements=req|change,correction=self.bundle.correction,revisions=self.revisions)

    def setUp(self):
        from .services import presentation_score as scorer
        self.scorer = scorer
        source, images = fixture(slides=3)
        # Required middle slide contains one second of original timed speech.
        source['transcript']['words'][2].update(start_ms=1000, end_ms=2000)
        self.analysis = prepare_analysis(source, images)
        self.descriptions = validate_descriptions(description_value(self.analysis), self.analysis)
        self.measurements = {
            'version': 'presentation-measurements-v1', 'status': 'available', 'audio_hash': 'a' * 64,
            'attempt_id': source['attempt_id'], 'duration_ms': 3000,
            'items': [{'id': 'pause_0', 'kind': 'pause', 'start_ms': 1700, 'end_ms': 2200, 'value': 500, 'unit': 'ms'},
                      {'id': 'speech_0', 'kind':'speech', 'start_ms':1000, 'end_ms':2000,'value':1000,'unit':'ms'}],
            'limitations': ['Synthetic measurement for contract tests.'],
        }
        self.revisions = {'audio_hash': 'a' * 64, 'transcript_revision': 0,
                          'profile_revision': 1, 'requirements_revision': None}
        self.bundle = scorer.capture(self.analysis, self.descriptions, measurements=self.measurements,
            requirements={'context_id': None, 'revision': None, 'audience': '', 'required_duration_seconds': None},
            correction={'revision': 0, 'edits': [], 'effective_text': source['transcript']['text']},
            revisions=self.revisions, recording_scope='full_attempt')

    def speech(self, index=0):
        a = self.analysis
        segment = next(s for s in a.segments if index in s.word_indexes)
        w = a.source.transcript.words[index]
        return {'kind': 'speech', 'attempt_id': a.source.attempt_id, 'transcript_id': a.transcript_id,
                'source_id': a.source_ids[segment.slide_index], 'slide_index': segment.slide_index,
                'visit_id': segment.visit_id, 'segment_id': segment.segment_id,
                'word_start': index, 'word_end': index, 'quote': w.text,
                'start_ms': w.start_ms, 'end_ms': w.end_ms}

    def output(self):
        value = {'rubric_version': 'presentation-score-v1', 'source_id': self.bundle.identity,
                'full_attempt_reviewed': True, 'assessments': [
                    {'subcriterion': key, 'status': 'assessed', 'level': 'advanced',
                     'justification': 'Synthetic anchored judgment; not a quality evaluation.',
                     'evidence': [self.speech()], 'limitations': [], 'deductions': []} for key in IDS],
                'weaknesses': [], 'strengths': [{'text': 'Synthetic strength.', 'evidence': [self.speech()]}],
                'improvements': [], 'improvement_shortage': 'No further useful improvements supported by this synthetic response.'}
        value['assessments'][9]['evidence'].append({'kind': 'measurement', 'measurement_id': 'pause_0',
            'attempt_id': self.analysis.source.attempt_id, 'audio_hash': 'a'*64, 'start_ms': 1700, 'end_ms': 2200})
        return value

    def test_backend_reproduces_scores_without_model_numbers(self):
        output = self.output()
        self.assertEqual(self.scorer.validate_output(self.bundle, output)['total_numerator'], 300)
        # 8*0 + 8*1 + 4*2 + remaining 80*3 = 256; exact score 256/3.
        for item, level in zip(output['assessments'][:3], ('beginning', 'emerging', 'competent')):
            item['level'] = level
            key = item['subcriterion']
            output['weaknesses'].append({'id': key, 'primary': key, 'observation': 'Synthetic communication gap.',
                'evidence': [self.speech()], 'omission_basis': None})
            item['deductions'] = [{'weakness_id': key, 'distinct_consequence': '', 'evidence': []}]
        result = self.scorer.validate_output(self.bundle, output)
        self.assertEqual(result['total_numerator'], 256)
        self.assertEqual(result['total_display'], '85.3')
        self.assertEqual(result['categories'][0]['numerator'], 16)
        self.assertEqual(result['overall_level'], 'advanced')
        self.assertEqual(self.scorer.reproduce(result['selections'])['total_numerator'], 256)

    def test_all_competent_is_66_point_7_with_no_double_weighting(self):
        from .services.presentation_rubric import score
        result = score({key: 'competent' for key in IDS})
        self.assertEqual(result['total_numerator'], 200)
        self.assertEqual(result['total_display'], '66.7')
        self.assertEqual([c['numerator'] for c in result['categories']], [40, 100, 60])
        self.assertEqual(result['overall_level'], 'competent')

    def test_descriptor_boundaries_use_exact_unrounded_fractions(self):
        from .services.presentation_rubric import overall_level
        for value, expected in [(Fraction(0), 'beginning'), (Fraction(100, 6), 'emerging'),
                                (Fraction(499, 10), 'emerging'), (Fraction(50), 'competent'),
                                (Fraction(250, 3), 'advanced'), (Fraction(100), 'advanced')]:
            self.assertEqual(overall_level(value), expected)

    def test_model_cannot_supply_total_or_omit_duplicate_or_invent_criteria(self):
        variants = []
        o = self.output(); o['total'] = 99; variants.append(o)
        o = self.output(); o['assessments'].pop(); variants.append(o)
        o = self.output(); o['assessments'][-1] = deepcopy(o['assessments'][0]); variants.append(o)
        o = self.output(); o['assessments'][0]['level'] = 'excellent'; variants.append(o)
        o = self.output(); o['assessments'][0]['level'] = 3; variants.append(o)
        for output in variants:
            with self.subTest(output=output), self.assertRaises(FeedbackError):
                self.scorer.validate_output(self.bundle, output)

    def test_noncontiguous_evidence_keeps_original_visits_and_timestamps(self):
        o = self.output()
        o['assessments'][0]['evidence'] = [self.speech(0), self.speech(4)]
        result = self.scorer.validate_output(self.bundle, o)
        refs = result['assessments'][0]['evidence']
        self.assertEqual([(e['start_ms'], e['end_ms'], e['visit_id']) for e in refs], [(100, 500, 0), (2200, 2500, 2)])

    def test_forged_source_quote_span_or_measurement_rejects_entire_score(self):
        for field, bad in [('attempt_id', '0' * 36), ('source_id', '0' * 64), ('transcript_id', '0' * 64),
                           ('start_ms', 0), ('word_start', 4), ('quote', 'Unspoken improvement'), ('visit_id', 2)]:
            o = self.output(); o['assessments'][0]['evidence'][0][field] = bad
            with self.subTest(field=field), self.assertRaises(FeedbackError):
                self.scorer.validate_output(self.bundle, o)
        o = self.output(); o['assessments'][9]['evidence'] = [{'kind': 'measurement', 'measurement_id': 'invented',
            'attempt_id': self.analysis.source.attempt_id, 'audio_hash': 'a' * 64, 'start_ms': 0, 'end_ms': 3000}]
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)

    def test_insufficient_evidence_retains_assessments_but_never_renormalizes(self):
        o = self.output(); item = o['assessments'][9]
        item.update(status='insufficient_evidence', level=None, limitations=['Speech evidence is inadequate.'], evidence=[])
        result = self.scorer.validate_output(self.bundle, o)
        self.assertEqual(result['status'], 'insufficient_evidence')
        self.assertIsNone(result['total_numerator']); self.assertIsNone(result['overall_level'])
        item['level'] = 'competent'
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)

    def test_weakness_cannot_penalize_two_criteria_without_distinct_evidence(self):
        o = self.output()
        o['weaknesses'] = [{'id': 'gap', 'primary': IDS[0], 'observation': 'Opening obscures purpose.',
                            'evidence': [self.speech()], 'omission_basis': None}]
        for item in o['assessments'][:2]:
            item.update(level='emerging', deductions=[{'weakness_id': 'gap', 'distinct_consequence': '', 'evidence': []}])
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)
        o['assessments'][1]['deductions'][0].update(distinct_consequence='Later transition also loses the connection.', evidence=[self.speech(4)])
        self.assertEqual(self.scorer.validate_output(self.bundle, o)['status'], 'scored')

    def test_no_omission_claim_from_one_excerpt_and_no_uncertain_slide_fact(self):
        o = self.output()
        o['weaknesses'] = [{'id': 'gap', 'primary': IDS[3], 'observation': 'Essential explanation absent.',
            'evidence': [self.speech()], 'omission_basis': {'kind': 'essential_explanation', 'explanation': 'Why this meaning is essential.'}}]
        o['assessments'][3].update(level='beginning', deductions=[{'weakness_id': 'gap', 'distinct_consequence': '', 'evidence': []}])
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)
        o['weaknesses'][0]['evidence'].append({'kind': 'full_attempt', 'source_id': self.bundle.identity,
            'attempt_id': self.analysis.source.attempt_id, 'start_ms': 0, 'end_ms': 3000})
        o['weaknesses'][0]['evidence'].append({'kind': 'slide', 'slide_index': 0, 'source_id': self.analysis.source_ids[0],
            'fact_ref': 'summary', 'quote': 'Synthetic slide 0'})
        self.assertEqual(self.scorer.validate_output(self.bundle, o)['status'], 'scored')
        o['weaknesses'][0]['evidence'][-1].update(fact_ref='visual_facts/0', quote='An unreadable chart value.')
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)

    def test_revision_or_audio_change_changes_identity_and_refuses_old_output(self):
        b = replace(self.bundle, identity='b' * 64)
        with self.assertRaises(FeedbackError): self.scorer.validate_output(b, self.output())
        self.assertFalse(self.scorer.is_current(self.bundle, {**self.revisions, 'transcript_revision': 1}))
        self.assertFalse(self.scorer.is_current(self.bundle, {**self.revisions, 'profile_revision': 2}))

    def test_capture_rejects_untrusted_rewrite_and_ignores_caller_completeness_claim(self):
        args = dict(measurements=self.measurements, requirements=self.bundle.requirements,
            correction={'revision': 0, 'edits': [], 'effective_text': 'A polished replacement.'},
            revisions=self.revisions, recording_scope='full_attempt')
        with self.assertRaises(FeedbackError): self.scorer.capture(self.analysis, self.descriptions, **args)
        args['correction']['effective_text'] = self.analysis.source.transcript.text
        args['recording_scope'] = 'selected_slides'
        self.assertTrue(self.scorer.capture(self.analysis, self.descriptions, **args).eligibility['eligible'])
        args['measurements']={**self.measurements,'items':self.measurements['items'][:1]}
        args['recording_scope']='full_attempt'
        b=self.scorer.capture(self.analysis,self.descriptions,**args)
        self.assertFalse(b.eligibility['eligible'])
        with self.assertRaises(FeedbackError): self.scorer.prepare(b,provider.ProviderConfig('openai','synthetic',''))

    def test_unavailable_audio_does_not_prepare_provider_request(self):
        b = self.scorer.capture(self.analysis, self.descriptions,
            measurements={**self.measurements, 'status': 'unavailable', 'items': []},
            requirements=self.bundle.requirements, correction=self.bundle.correction,
            revisions=self.revisions, recording_scope='full_attempt')
        with self.assertRaises(FeedbackError) as error:
            self.scorer.prepare(b, provider.ProviderConfig('openai', 'synthetic-model', ''))
        self.assertEqual(error.exception.code, 'audio_unavailable')
        output = {**self.output(), 'source_id': b.identity}
        output['assessments'][9].update(status='insufficient_evidence', level=None, evidence=[], limitations=['Audio unavailable.'])
        with self.assertRaises(FeedbackError): self.scorer.validate_output(b, output)

    def test_existing_transport_schema_receipt_and_full_context_without_network(self):
        for name in ('openai', 'gemini'):
            with self.subTest(provider=name), patch.object(provider, 'request_raw', side_effect=AssertionError('No live calls in tests')):
                prepared = self.scorer.prepare(self.bundle, provider.ProviderConfig(name, 'synthetic-model', ''))
                payload = prepared.payload.decode()
                self.assertIn(self.analysis.source.transcript.text, payload)
                self.assertEqual(prepared.stage, 'coaching')  # Existing transport/quota stage.
                receipt = provider.RawReceipt(name, 'synthetic-model', 'coaching', prepared.input_hash, 200,
                    json_bytes(envelope(name, self.output())), True, None, None, ())
                self.assertEqual(self.scorer.normalize(self.bundle, prepared, receipt)['total_display'], '100.0')
                with self.assertRaises(FeedbackError):
                    self.scorer.normalize(self.bundle, prepared, replace(receipt, input_hash='f' * 64))

    def test_mutated_bundle_and_malformed_measurements_are_not_valid_inputs(self):
        changed = deepcopy(self.bundle)
        changed.requirements['audience'] = 'Changed after capture'
        with self.assertRaises(FeedbackError): self.scorer.prepare(changed, provider.ProviderConfig('openai', 'synthetic', ''))
        measurements = deepcopy(self.measurements)
        measurements['items'][0]['end_ms'] = 99999
        with self.assertRaises(FeedbackError):
            self.scorer.capture(self.analysis, self.descriptions, measurements=measurements,
                requirements=self.bundle.requirements, correction=self.bundle.correction,
                revisions=self.revisions, recording_scope='full_attempt')

    def test_cached_analysis_ids_cannot_hide_mutated_source_or_segments(self):
        changed_analysis = replace(self.analysis, source=self.analysis.source.model_copy(update={'duration_ms': 4000}))
        changed = replace(self.bundle, analysis=changed_analysis)
        with self.assertRaises(FeedbackError): self.scorer.prepare(changed, provider.ProviderConfig('openai', 'synthetic', ''))
        changed = replace(self.bundle, analysis=replace(self.analysis, segments=()))
        with self.assertRaises(FeedbackError): self.scorer.validate_output(changed, self.output())

    def test_negative_boolean_or_missing_revisions_are_not_valid_snapshots(self):
        for revisions in [{**self.revisions, 'profile_revision': -2},
                          {**self.revisions, 'transcript_revision': True},
                          {'audio_hash': 'a'*64}]:
            with self.subTest(revisions=revisions), self.assertRaises(FeedbackError):
                self.scorer.capture(self.analysis, self.descriptions, measurements=self.measurements,
                    requirements=self.bundle.requirements, correction=self.bundle.correction,
                    revisions=revisions, recording_scope='full_attempt')

    def test_negative_pause_or_rate_cannot_be_treated_as_measurement_evidence(self):
        measurements = deepcopy(self.measurements)
        measurements['items'][0]['value'] = -500
        with self.assertRaises(FeedbackError):
            self.scorer.capture(self.analysis, self.descriptions, measurements=measurements,
                requirements=self.bundle.requirements, correction=self.bundle.correction,
                revisions=self.revisions, recording_scope='full_attempt')

    def test_full_attempt_marker_and_slide_facts_cannot_replace_speech_for_high_grades(self):
        o = self.output()
        for item in o['assessments']:
            item['evidence'] = [
                {'kind': 'full_attempt', 'source_id': self.bundle.identity, 'attempt_id': self.analysis.source.attempt_id,
                 'start_ms': 0, 'end_ms': 3000},
                {'kind': 'slide', 'source_id': self.analysis.source_ids[0], 'slide_index': 0,
                 'fact_ref': 'summary', 'quote': 'Synthetic slide 0'},
                self.output()['assessments'][9]['evidence'][1]]
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)

    def test_presenter_quality_never_comes_from_measurements_or_slide_only(self):
        o = self.output()
        o['assessments'][0]['evidence'] = [{'kind': 'slide', 'slide_index': 0, 'source_id': self.analysis.source_ids[0],
                                          'fact_ref': 'summary', 'quote': 'Synthetic slide 0'}]
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)

    def test_even_advanced_pacing_requires_measured_support_not_text_alone(self):
        o = self.output(); o['assessments'][9]['evidence'] = [self.speech()]
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)
        o = self.output()
        o['assessments'][7]['level'] = 'emerging'
        o['weaknesses'] = [{'id': 'signal', 'primary': IDS[7], 'observation': 'Synthetic delivery problem.',
                            'evidence': [self.speech()], 'omission_basis': None}]
        o['assessments'][7]['evidence'] = [{'kind': 'measurement', 'measurement_id': 'pause_0',
            'attempt_id': self.analysis.source.attempt_id, 'audio_hash': 'a'*64, 'start_ms': 1700, 'end_ms': 2200}]
        o['assessments'][7]['deductions'] = [{'weakness_id': 'signal', 'distinct_consequence': '', 'evidence': []}]
        with self.assertRaises(FeedbackError): self.scorer.validate_output(self.bundle, o)

    def test_source_payload_does_not_leak_legacy_audience_into_unspecified_requirements(self):
        source=self.analysis.source.model_dump(mode='json'); source['audience']='Legacy invented target'
        _,images=fixture(slides=3)
        a = prepare_analysis(source, images)
        bundle = self.scorer.capture(a, validate_descriptions(description_value(a), a), measurements=self.measurements,
            requirements=self.bundle.requirements, correction=self.bundle.correction,
            revisions=self.revisions, recording_scope='full_attempt')
        request = self.scorer.prepare(bundle, provider.ProviderConfig('openai', 'synthetic', ''))
        self.assertFalse('Legacy invented target' in request.payload.decode())



from django.test import TestCase as DatabaseTestCase
from .test_coaching import SyntheticCoaching


class SavedPresentationScoreTests(SyntheticCoaching, DatabaseTestCase):
    """Real persistence and recognition admission; synthetic media/provider data only."""
    def prepared(self):
        from .services.coaching import prepare_attempt
        from .test_feedback import image_bytes
        from .test_descriptions import description_value as saved_descriptions
        a = prepare_analysis(prepare_attempt(self.attempt), (image_bytes(),))
        return a, validate_descriptions(saved_descriptions(a), a)

    def test_saved_capture_excludes_legacy_rewrites_and_preserves_original_source(self):
        from .models import TranscriptCorrection, FeedbackJob
        from .services.coaching import transcript_identity
        from .services.presentation_score import capture_saved
        TranscriptCorrection.objects.create(attempt=self.attempt, base_transcript_id=transcript_identity(self.attempt),
            revision=1, edits=[{'word_start': 0, 'word_end': 0, 'text': 'An eloquent rewritten introduction'}])
        a, descriptions = self.prepared()
        jobs_before = FeedbackJob.objects.count()
        bundle = capture_saved(self.attempt, a, descriptions, profile_revision=1, recording_scope='full_attempt',
            requirements={'context_id': None, 'revision': None, 'audience': '', 'required_duration_seconds': None})
        self.assertEqual(bundle.correction['effective_text'], 'Echo Echo')
        self.assertEqual(bundle.correction['edits'], [])
        self.assertEqual(bundle.measurements['status'], 'unavailable')  # Synthetic path is absent.
        self.assertEqual(FeedbackJob.objects.count(), jobs_before)

    def test_only_admitted_recognition_correction_changes_effective_speech_and_identity(self):
        from .test_corrections import seed_ai_offer
        from .services import coaching
        from .services.presentation_score import capture_saved
        a, descriptions = self.prepared()
        args = dict(profile_revision=1, recording_scope='full_attempt',
            requirements={'context_id': None, 'revision': None, 'audience': '', 'required_duration_seconds': None})
        before = capture_saved(self.attempt, a, descriptions, **args)
        edit = {'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}
        seed_ai_offer(self, [edit])
        response = self.client.patch(f'/api/attempts/{self.attempt.pk}/corrections/', {
            'base_transcript_id': coaching.transcript_identity(self.attempt), 'expected_revision': 0, 'edits': [edit]},
            content_type='application/json')
        self.assertEqual(response.status_code, 200)
        after = capture_saved(self.attempt, a, descriptions, **args)
        self.assertEqual(after.correction['effective_text'], 'ChatGPT Echo')
        self.assertNotEqual(before.identity, after.identity)
        self.assertEqual(after.analysis.source.transcript.words[0].text, 'Echo')


class PresentationMeasurementTests(TestCase):
    def test_waveform_measurements_keep_pause_and_signal_times_without_quality_grade(self):
        import numpy as np
        from .services.presentation_measurements import measure_waveform
        waveform = np.full(48000, .1, dtype=np.float32)
        spans = [{'start': 1600, 'end': 16000}, {'start': 32000, 'end': 40000}]
        result = measure_waveform(waveform, spans, attempt_id='a', audio_hash='a'*64,
                                 duration_ms=3000, text='Hello 안녕', language='ko/en')
        pause = next(i for i in result['items'] if i['kind'] == 'pause')
        self.assertEqual((pause['start_ms'], pause['end_ms'], pause['value']), (1000, 2000, 1000))
        self.assertEqual(result['status'], 'available')
        self.assertEqual({i['unit'] for i in result['items'] if i['kind'] == 'rate'}, {'English words/min', 'Korean Hangul runs/min'})
        self.assertNotIn('score', result)

    def test_gain_changes_signal_evidence_but_not_speech_or_rate_measurements(self):
        import numpy as np
        from .services.presentation_measurements import measure_waveform
        args = dict(attempt_id='a', audio_hash='a'*64, duration_ms=3000, text='Hello 안녕', language='ko/en')
        spans = [{'start': 1600, 'end': 16000}, {'start': 32000, 'end': 40000}]
        a = measure_waveform(np.full(48000, .1), spans, **args)
        b = measure_waveform(np.full(48000, .01), spans, **args)
        self.assertEqual([i for i in a['items'] if not i['kind'].startswith('signal')],
                         [i for i in b['items'] if not i['kind'].startswith('signal')])
        self.assertAlmostEqual(next(i['value'] for i in a['items'] if i['kind']=='signal_rms') -
                               next(i['value'] for i in b['items'] if i['kind']=='signal_rms'), 20)

    def test_invalid_silent_or_short_audio_never_fabricates_measurements(self):
        import numpy as np
        from .services.presentation_measurements import measure_waveform, measure_audio
        for wave, spans in [(np.zeros(16000), []), (np.array([float('nan')]), []),
                            (np.ones(16000), [{'start': 0, 'end': 32000}])]:
            r = measure_waveform(wave, spans, attempt_id='a', audio_hash='a'*64,
                duration_ms=3000, text='Hello', language='en')
            self.assertNotEqual(r['status'], 'available'); self.assertEqual(r['items'], [])
        r = measure_audio('/nonexistent/synthetic.wav', attempt_id='a', duration_ms=3000, text='Hello', language='en')
        self.assertEqual(r['status'], 'unavailable'); self.assertEqual(r['items'], [])
