"""Synthetic boundary regressions; no provider dispatch or grading claims."""
from copy import deepcopy
from dataclasses import replace
import hashlib
import json
from unittest import TestCase
from unittest.mock import patch

from .services import feedback_provider as provider
from .services import presentation_score_v2 as scorer, presentation_score as v1
from .services.feedback import FeedbackError, has_nul, json_bytes
from .test_feedback import fixture
from .test_feedback_provider import envelope
from .test_presentation_score_v2 import make_bundle, output, speech


class PresentationScoreV2BoundaryTests(TestCase):
    def setUp(self):
        self.bundle = make_bundle()
        self.config = provider.ProviderConfig('openai', 'synthetic', '')

    def receipt(self, prepared, raw=None):
        return provider.RawReceipt(prepared.config.provider, prepared.config.model, prepared.stage,
            prepared.input_hash, 200, json_bytes(envelope(prepared.config.provider, raw or output(self.bundle))),
            True, None, None, ())

    def test_lower_anchor_does_not_automatically_need_a_deduction(self):
        raw = output(self.bundle)
        for slide in raw['slides']:
            for criterion in slide['criteria']:
                criterion['level'] = 'competent'
        for criterion in raw['whole']:
            criterion['level'] = 'competent'
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['overall']['score'], 67)
        self.assertEqual(result['validation']['score_critical']['rejected_count'], 0)

    def test_public_invalid_criterion_contains_no_rejected_citations(self):
        raw = output(self.bundle)
        raw['slides'][0]['criteria'][0]['evidence'] = [speech('v999')]
        result = scorer.validate_output(self.bundle, raw)
        criterion = result['slides'][0]['criteria'][0]
        self.assertEqual((criterion['status'], criterion['level'], criterion['evidence'], criterion['deductions']),
                         ('insufficient_evidence', None, [], []))
        self.assertTrue(criterion['limitations'])
        self.assertNotIn('v999', json.dumps(result))
        self.assertEqual(result['slides'][1]['score'], 100)

    def test_primary_omission_inherits_validated_evidence_with_v2_identity(self):
        raw = output(self.bundle)
        refs = [{'kind': 'full_attempt'}, {'kind': 'slide', 'fact_id': 's0:key_ideas/0'}]
        row = raw['slides'][0]['criteria'][0]
        row.update(level='beginning', evidence=deepcopy(refs), deductions=[
            {'weakness_id': 'omission', 'consequence': 'Essential meaning is missing.', 'evidence': []}])
        raw['weaknesses'] = [{'id': 'omission', 'primary_criterion': 'slide:0:essential_coverage',
            'observation': 'An essential explanation was not communicated.', 'evidence': refs,
            'omission_basis': {'kind': 'essential_explanation', 'explanation': 'Needed to establish the central idea.'}}]
        result = scorer.validate_output(self.bundle, raw)
        criterion = result['slides'][0]['criteria'][0]
        self.assertEqual(result['slides'][0]['score'], 60)
        self.assertEqual(criterion['deductions'][0]['evidence'], criterion['evidence'])
        self.assertEqual(criterion['evidence'][0]['source_id'], result['source_identity'])
        self.assertNotEqual(criterion['evidence'][0]['source_id'], self.bundle.identity)
        raw['full_attempt_reviewed'] = False
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['slides'][0]['status'], 'invalid_evidence')

    def test_invalid_primary_deduction_citation_is_not_repaired_by_inheritance(self):
        raw = output(self.bundle)
        row = raw['slides'][0]['criteria'][0]
        row.update(level='emerging', deductions=[
            {'weakness_id': 'gap', 'consequence': 'The relationship is obscured.', 'evidence': [speech('v999')]}])
        raw['weaknesses'] = [{'id': 'gap', 'primary_criterion': 'slide:0:essential_coverage',
            'observation': 'Meaning is obscured.', 'evidence': [speech()], 'omission_basis': None}]
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['slides'][0]['status'], 'invalid_evidence')
        self.assertEqual(result['slides'][0]['criteria'][0]['deductions'], [])

    def test_secondary_duplicate_suppresses_secondary_component_only(self):
        raw = output(self.bundle)
        raw['weaknesses'] = [{'id': 'gap', 'primary_criterion': 'slide:0:essential_coverage',
            'observation': 'Meaning is obscured.', 'evidence': [speech()], 'omission_basis': None}]
        raw['slides'][0]['criteria'][0].update(level='emerging', deductions=[
            {'weakness_id': 'gap', 'consequence': 'The same gap impedes understanding.', 'evidence': [speech()]}])
        raw['whole'][0].update(level='emerging', deductions=[
            {'weakness_id': 'gap', 'consequence': 'The same gap impedes understanding.', 'evidence': [speech()]}])
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['slides'][0]['status'], 'scored')
        self.assertEqual(result['whole'][0]['status'], 'insufficient_evidence')
        self.assertEqual(result['assessment_status'], 'invalid_evidence')

    def test_shared_deduction_invalid_primary_propagates_to_dependent_secondary(self):
        raw = output(self.bundle)
        raw['weaknesses'] = [{'id': 'a', 'primary_criterion': 'slide:0:essential_coverage',
            'observation': 'One supported weakness.', 'evidence': [speech()], 'omission_basis': None},
            {'id': 'b', 'primary_criterion': 'whole:structure',
             'observation': 'A second supported weakness.', 'evidence': [speech()], 'omission_basis': None}]
        raw['slides'][0]['criteria'][0]['deductions'] = [
            {'weakness_id': 'a', 'consequence': 'A primary gap.', 'evidence': [speech()]}]
        raw['whole'][0]['deductions'] = [
            {'weakness_id': 'a', 'consequence': 'A primary gap.', 'evidence': [speech()]},
            {'weakness_id': 'b', 'consequence': 'An independent structural consequence.', 'evidence': [speech()]}]
        raw['whole'][1]['deductions'] = [
            {'weakness_id': 'b', 'consequence': 'A distinct sequencing consequence.', 'evidence': [speech()]}]
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['whole'][0]['status'], 'insufficient_evidence')
        self.assertEqual(result['whole'][1]['status'], 'insufficient_evidence')
        self.assertEqual(result['slides'][0]['status'], 'scored')

    def test_unvisited_and_wordless_states_are_derived_even_with_model_claims(self):
        source, images = fixture(slides=3)
        bundle = make_bundle(source=source, images=images)
        raw = output(bundle)
        raw['slides'][2]['evidence'] = [speech('v999')]
        raw['slides'][2]['criteria'][0]['evidence'] = [speech()]
        result = scorer.validate_output(bundle, raw)
        self.assertEqual(result['slides'][2]['status'], 'not_recorded')
        self.assertEqual(result['assessment_status'], 'incomplete')
        words = [{'text': 'Only first.', 'start_ms': 100, 'end_ms': 300}]
        source, images = fixture(words=words, slides=3,
            events=[{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 1000}, {'slide_index': 2, 'at_ms': 2000}])
        bundle = make_bundle(source=source, images=images)
        raw = output(bundle)
        raw['slides'][1]['evidence'] = [speech('v999')]
        result = scorer.validate_output(bundle, raw)
        self.assertEqual(result['slides'][1]['status'], 'insufficient_evidence')
        self.assertIsNone(result['overall']['score'])
        self.assertEqual(result['slides'][0]['score'], 100)

    def test_all_slides_not_applicable_cannot_produce_a_total(self):
        source, images = fixture(slides=1, events=[{'slide_index': 0, 'at_ms': 0}])
        bundle = make_bundle(source=source, images=images)
        raw = output(bundle)
        raw['slides'][0].update(status='not_applicable', criteria=[],
            justification='Title only with no essential communication required.',
            evidence=[{'kind': 'slide', 'fact_id': 's0:summary'}])
        result = scorer.validate_output(bundle, raw)
        self.assertIsNone(result['overall']['score'])
        self.assertEqual(result['assessment_status'], 'insufficient_evidence')

    def test_signal_measurement_does_not_establish_delivery(self):
        measurements = deepcopy(self.bundle.measurements)
        measurements['items'] = [{'id': 'signal_0', 'kind': 'signal_rms',
            'start_ms': 100, 'end_ms': 500, 'value': -20, 'unit': 'dBFS'}]
        bundle = make_bundle(measurements=measurements)
        raw = output(bundle)
        raw['whole'][-1]['evidence'] = [speech(), {'kind': 'measurement', 'measurement_id': 'signal_0'}]
        result = scorer.validate_output(bundle, raw)
        self.assertEqual(result['assessment_status'], 'invalid_evidence')
        self.assertEqual(result['slides'][0]['score'], 100)

    def test_prepare_enumerates_handles_preserves_visits_and_does_not_dispatch(self):
        source, images = fixture(slides=3)
        bundle = make_bundle(source=source, images=images)
        for name in ('openai', 'gemini'):
            with self.subTest(provider=name), patch.object(provider, 'request_raw', side_effect=AssertionError('No inference')):
                prepared = scorer.prepare(bundle, provider.ProviderConfig(name, 'synthetic', ''))
            payload = json.loads(prepared.payload)
            if name == 'openai':
                context = json.loads(payload['input'][0]['content'][0]['text'])
                schema = payload['text']['format']['schema']
            else:
                context = json.loads(payload['contents'][0]['parts'][0]['text'])
                schema = payload['generationConfig']['responseJsonSchema']
            self.assertEqual(provider.output_token_limit(prepared), 12000)
            self.assertEqual([v['visit_id'] for v in context['evidence_registry']['visits']], ['v0', 'v1', 'v2'])
            self.assertEqual([v['slide_index'] for v in context['evidence_registry']['visits']], [0, 1, 0])
            self.assertTrue(all('word_index' not in word for visit in context['evidence_registry']['visits'] for word in visit['words']))
            self.assertIn('"enum":["v0","v1","v2"]', json.dumps(schema, separators=(',', ':')))
            self.assertEqual(context['source_revisions'], bundle.revisions)
            self.assertEqual(context['evidence_registry']['corrections']['effective_text'], bundle.correction['effective_text'])

    def test_rehashed_other_payload_or_changed_snapshot_cannot_bind(self):
        prepared = scorer.prepare(self.bundle, self.config)
        payload = json.loads(prepared.payload)
        payload['instructions'] = 'A different scoring protocol.'
        body = json_bytes(payload)
        forged = replace(prepared, payload=body, input_hash=hashlib.sha256(body).hexdigest())
        with self.assertRaises(FeedbackError):
            scorer.normalize(self.bundle, forged, self.receipt(forged))
        changed = make_bundle(revisions={**self.bundle.revisions, 'profile_revision': 9})
        with self.assertRaises(FeedbackError):
            scorer.normalize(changed, prepared, self.receipt(prepared))
        with self.assertRaises(FeedbackError):
            scorer.normalize(self.bundle, replace(prepared, description_schema_version='forged'), self.receipt(prepared))

    def test_receipt_identity_tampering_and_v1_request_rejected(self):
        prepared = scorer.prepare(self.bundle, self.config)
        receipt = self.receipt(prepared)
        for changed in (replace(receipt, provider='gemini'), replace(receipt, model='other'),
                        replace(receipt, stage='descriptions')):
            with self.subTest(receipt=changed), self.assertRaises(FeedbackError):
                scorer.normalize(self.bundle, prepared, changed)
        adapter = provider.FeedbackAdapter(self.config, preparation_only=True)
        description = provider.DescriptionResult('openai', 'synthetic', self.bundle.analysis.deck.input_id, self.bundle.descriptions)
        old = adapter.prepare_coaching(self.bundle.analysis, description)
        with self.assertRaises(FeedbackError):
            scorer.normalize(self.bundle, old, self.receipt(old))

    def test_optional_improvement_overflow_filters_without_suppressing_score(self):
        raw = output(self.bundle)
        raw['feedback']['improvements'] = [
            {'text': f'Supported improvement {index}.', 'evidence': [speech()]} for index in range(4)]
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['overall']['score'], 100)
        self.assertEqual(len(result['feedback']['improvements']), 3)
        self.assertEqual(result['validation']['optional']['rejected_count'], 1)
        self.assertNotIn('model_selection', result)
        self.assertNotIn('reconstruction', result)

    def test_unknown_optional_field_does_not_discard_other_valid_advice(self):
        raw = output(self.bundle)
        raw['feedback']['strengths'] = [{'text': 'Supported strength.', 'evidence': [speech()]}]
        raw['feedback']['unexpected'] = 'Malformed optional field.'
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual(result['overall']['score'], 100)
        self.assertEqual(result['feedback']['strengths'][0]['text'], 'Supported strength.')
        self.assertEqual(result['validation']['optional']['rejected_count'], 1)

    def test_unsafe_optional_text_isolated_and_private_audit_reversibly_encoded(self):
        raw = output(self.bundle)
        raw['feedback']['strengths'] = [
            {'text': 'Malformed' + chr(0) + 'advice.', 'evidence': [speech()]},
            {'text': 'Supported strength.', 'evidence': [speech()]},
        ]
        prepared = scorer.prepare(self.bundle, self.config)
        receipt = self.receipt(prepared, raw)
        original_body = receipt.body
        result, audit = scorer.normalize_with_audit(self.bundle, prepared, receipt)
        self.assertEqual(result['overall']['score'], 100)
        self.assertEqual(result['feedback']['strengths'], [
            {'text': 'Supported strength.', 'evidence': result['slides'][0]['criteria'][0]['evidence']}])
        self.assertEqual(result['validation']['optional']['rejected_count'], 1)
        self.assertFalse(has_nul(result))
        self.assertFalse(has_nul(audit))
        self.assertEqual(audit['audit_encoding'], 'json-text-v1')
        decoded = json.loads(audit['audit_json'])
        self.assertEqual(decoded['model_selection'], raw)
        self.assertEqual(decoded['binding']['input_hash'], prepared.input_hash)
        self.assertEqual(receipt.body, original_body)

    def test_unsafe_criterion_text_suppresses_only_its_component(self):
        raw = output(self.bundle)
        raw['slides'][1]['criteria'][0]['justification'] = 'Malformed' + chr(0) + 'criterion.'
        result = scorer.validate_output(self.bundle, raw)
        self.assertEqual([slide['status'] for slide in result['slides']],
                         ['scored', 'invalid_evidence', 'scored'])
        self.assertEqual([slide['score'] for slide in result['slides']], [100, None, 100])
        self.assertFalse(has_nul(result))
        self.assertIsNone(result['overall']['score'])

    def test_source_protocol_is_static_and_mutating_returned_descriptor_is_safe(self):
        first = scorer.protocol_descriptor()
        before = scorer.source_identity(self.bundle)
        first['rubric']['version'] = 'forged'
        self.assertEqual(scorer.protocol_descriptor()['rubric']['version'], 'presentation-score-v2')
        self.assertEqual(scorer.source_identity(self.bundle), before)
        altered = deepcopy(self.bundle)
        altered.revisions['profile_revision'] = 100
        with self.assertRaises(FeedbackError):
            scorer.source_identity(altered)

    def test_delivery_instructions_require_direct_speech_and_eligible_measurement(self):
        self.assertEqual(scorer.PROMPT_VERSION, 'presentation-score-prompt-v2.1')
        for phrase in ('direct supporting speech selection',
                       'Measurements and duration requirements alone',
                       'delivery weakness and delivery deduction'):
            self.assertIn(phrase, scorer.RULES)

    def test_measurement_and_duration_only_delivery_rejects_total_but_retains_slide_scores(self):
        bundle = v1.capture(self.bundle.analysis, self.bundle.descriptions,
            measurements=self.bundle.measurements,
            requirements={'context_id': '11111111-1111-4111-8111-111111111111', 'revision': 0,
                          'audience': 'Students', 'required_duration_seconds': 300},
            correction=self.bundle.correction,
            revisions={**self.bundle.revisions, 'requirements_revision': 0})
        raw = output(bundle)
        raw['whole'][-1]['evidence'] = [
            {'kind': 'measurement', 'measurement_id': 'speech_0'},
            {'kind': 'requirement', 'field': 'required_duration_seconds'}]
        result = scorer.validate_output(bundle, raw)
        self.assertEqual(result['assessment_status'], 'invalid_evidence')
        self.assertIsNone(result['overall']['score'])
        self.assertIn('whole:delivery: unsupported_assessment', result['validation']['score_critical']['reasons'])
        self.assertEqual([slide['score'] for slide in result['slides']], [100, 100, 100])
        raw['whole'][-1]['evidence'].insert(0, speech())
        self.assertEqual(scorer.validate_output(bundle, raw)['overall']['score'], 100)

    def test_old_prompt_receipt_is_never_renormalized_under_new_instructions(self):
        with patch.object(scorer, 'PROMPT_VERSION', 'presentation-score-prompt-v2'), \
             patch.object(scorer, 'RULES', 'A previous frozen scoring prompt.'):
            prepared = scorer.prepare(self.bundle, self.config)
            receipt = self.receipt(prepared)
        original = receipt.body
        with self.assertRaises(FeedbackError) as caught:
            scorer.normalize(self.bundle, prepared, receipt)
        self.assertEqual(caught.exception.code, 'source_mismatch')
        self.assertEqual(receipt.body, original)
