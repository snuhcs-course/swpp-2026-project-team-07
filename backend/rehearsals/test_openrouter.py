"""Synthetic OpenRouter wire and compatibility checks; no paid provider traffic.

AI-assisted by OpenAI Codex; see the Iteration 2 collaboration log.
"""
import json
import os
from unittest import TestCase
from unittest.mock import patch
from types import SimpleNamespace

import httpx

from .services import feedback_provider as provider, qa, audience_qa, slide_review, transcript_suggestions
from .services import presentation_score, presentation_score_v2
from .services.feedback import FeedbackError, prepare_analysis
from .services.feedback_config import Selection, QuotaPolicy
from .services.slide_profile_schema import PROFILE_SCHEMAS
from .test_feedback import fixture, description_value
from .test_feedback_provider import envelope
from .test_presentation_score_v2 import make_bundle


ENV = {'FEEDBACK_ENABLED': 'true', 'FEEDBACK_PROVIDER': 'openrouter',
       'OPENROUTER_API_KEY': 'synthetic-router-key', 'OPENAI_API_KEY': 'personal-key-must-not-be-used',
       'FEEDBACK_OPENROUTER_PROJECT_ID': 'router-synthetic',
       'FEEDBACK_OPENROUTER_RPM': '10', 'FEEDBACK_OPENROUTER_TPM': '1000000'}


class OpenRouterTests(TestCase):
    def setUp(self):
        env = patch.dict(os.environ, ENV, clear=True)
        env.start(); self.addCleanup(env.stop)
        network = patch('httpx.HTTPTransport.handle_request', side_effect=AssertionError('live network forbidden'))
        network.start(); self.addCleanup(network.stop)
        self.analysis = prepare_analysis(*fixture())
        self.calls = []

    def adapter(self):
        return provider.FeedbackAdapter()

    def coaching(self):
        adapter = self.adapter()
        return adapter.prepare_coaching(self.analysis, adapter.edited_descriptions(self.analysis, description_value(self.analysis)))

    def raw(self, prepared, *, status=200, body=None, headers=None):
        def handle(request):
            self.calls.append(request)
            return httpx.Response(status, json=body if body is not None else envelope('openai', {'suggestions': []}), headers=headers)
        return provider.request_raw(prepared, _transport=httpx.MockTransport(handle))

    def test_default_selection_uses_router_credentials_and_namespaced_luna(self):
        del os.environ['FEEDBACK_PROVIDER']
        selection = Selection.current()
        config = selection.credentials()
        self.assertEqual((selection.provider, selection.model, selection.project_id),
                         ('openrouter', 'openai/gpt-6-luna', 'router-synthetic'))
        self.assertEqual(config.key, 'synthetic-router-key')
        self.assertEqual(QuotaPolicy.current(selection).rpm, 10)
        self.assertEqual(Selection.profiles().schema_version, 'slide-profile-v5')

    def test_missing_router_key_never_uses_personal_openai_key(self):
        del os.environ['OPENROUTER_API_KEY']
        for resolve in (provider.ProviderConfig.from_env, lambda: Selection.current().credentials()):
            with self.assertRaises(FeedbackError) as caught:
                resolve()
            self.assertEqual(caught.exception.code, 'missing_api_key')
        self.assertEqual(self.calls, [])

    def test_router_model_validation_rejects_urls_traversal_and_oversized_ids(self):
        for model in ('gpt-6-luna', '../evil', 'openai/../evil', 'https://example.com/model',
                      'openai/gpt?key=x', 'openai/gpt:latest', 'x/' + 'x' * 100):
            with self.subTest(model=model), patch.dict(os.environ, {'FEEDBACK_OPENROUTER_MODEL': model}):
                with self.assertRaises(FeedbackError): Selection.current()
                with self.assertRaises(FeedbackError): provider.ProviderConfig.from_env()

    def test_real_sdk_sends_only_router_key_and_preserves_structured_payload(self):
        prepared = self.coaching()
        with patch.dict(os.environ, {'OPENAI_BASE_URL': 'https://untrusted.invalid',
                                     'OPENAI_CUSTOM_HEADERS': 'X-Private: do-not-send'}):
            receipt = self.raw(prepared)
        self.assertEqual(len(self.calls), 1)
        request = self.calls[0]
        self.assertEqual(str(request.url), 'https://openrouter.ai/api/v1/responses')
        self.assertEqual(request.headers['authorization'], 'Bearer synthetic-router-key')
        self.assertNotIn('x-private', request.headers)
        self.assertNotIn('personal-key', str(request.headers))
        payload = json.loads(request.content)
        self.assertEqual(payload['model'], 'openai/gpt-6-luna')
        self.assertIs(payload['store'], False)
        self.assertIs(payload['text']['format']['strict'], True)
        self.assertEqual(payload['max_output_tokens'], 2500)
        self.assertEqual(dict(receipt.usage), {'input_tokens': 11, 'output_tokens': 12, 'total_tokens': 23})
        self.assertEqual(provider.normalize(prepared, receipt).state, 'empty')

    def test_descriptions_keep_image_payload_and_existing_schema(self):
        prepared = self.adapter().prepare_descriptions(self.analysis)
        payload = json.loads(prepared.payload)
        self.assertTrue(any(part['type'] == 'input_image' for part in payload['input'][0]['content']))
        self.assertEqual(payload['text']['format']['schema'], provider.response_schema('openai', 'descriptions'))
        self.assertEqual(payload['max_output_tokens'], 6000)
        self.assertEqual(PROFILE_SCHEMAS['openrouter'], 'slide-profile-v5')

    def test_all_request_augmenters_preserve_responses_format_and_output_limits(self):
        base = self.coaching()
        snapshot = {'transcript_revision': 0, 'corrections': [], 'effective_text': 'Synthetic speech.',
                    'correction_analysis_version': 'corrections-v1'}
        from .services.corrections import ANALYSIS_VERSION
        snapshot['correction_analysis_version'] = ANALYSIS_VERSION
        review = {**snapshot, 'slide_review': {'version': 'slide-review-v2',
                  'scope': {'context_id': None, 'slides': [{'slide_index': 0, 'segments': []}]}}}
        answer = {**snapshot, 'qa_answer': {'part': 0, 'question': {'question': 'Why?', 'follow_up': 'How?'}}}
        questions = {**snapshot, 'audience_qa': {'question_schema': 'names-v1', 'sources': {},
                     'scope': {'slides': [{'slide_index': 0}]}, 'selected_slides': []}}
        source, images = fixture(slides=3)
        source['transcript']['words'][2].update(start_ms=1000, end_ms=2000)
        measurements = {'version': 'presentation-measurements-v1', 'status': 'available', 'audio_hash': 'a' * 64,
                        'attempt_id': source['attempt_id'], 'duration_ms': 3000,
                        'items': [{'id': 'speech_0', 'kind': 'speech', 'start_ms': 1000, 'end_ms': 2000,
                                   'value': 1000, 'unit': 'ms'}], 'limitations': ['Synthetic measurement.']}
        bundle = make_bundle(source=source, images=images, measurements=measurements)
        requests = [
            transcript_suggestions.augment_request(base, snapshot, 'transcription_suggestions'),
            slide_review.augment(base, review), audience_qa.augment(base, questions), audience_qa.augment(base, answer),
            qa._payload(base.config, 'qa_questions', qa.QUESTION_RULES, {}, qa.Questions.model_json_schema()),
            qa._payload(base.config, 'qa_answer', qa.ANSWER_RULES, {}, qa.AnswerReview.model_json_schema()),
            presentation_score.prepare(bundle, base.config), presentation_score_v2.prepare(bundle, base.config),
        ]
        for prepared, limit in zip(requests, (2500, 2500, 2500, 2500, 1500, 800, 12000, 12000)):
            with self.subTest(limit=limit, stage=prepared.stage):
                payload = json.loads(prepared.payload)
                self.assertEqual(payload['model'], 'openai/gpt-6-luna')
                self.assertEqual(payload['max_output_tokens'], limit)
                self.assertIs(payload['text']['format']['strict'], True)
                self.assertEqual(provider.output_token_limit(prepared), limit)
                self.raw(prepared)
        self.assertEqual({str(r.url) for r in self.calls}, {'https://openrouter.ai/api/v1/responses'})

    def test_saved_direct_provider_cannot_submit_after_cutover(self):
        config = provider.ProviderConfig('openai', 'gpt-6-luna', 'personal-key-must-not-be-used')
        prepared = provider.FeedbackAdapter(config).prepare_descriptions(self.analysis)
        with self.assertRaises(FeedbackError) as caught: self.raw(prepared)
        self.assertEqual(caught.exception.code, 'provider_changed')
        self.assertEqual(self.calls, [])

    def test_invalid_active_provider_cannot_unlock_saved_personal_openai_credentials(self):
        legacy = Selection('openai', 'old-project', 'gpt-6-luna', 'description-v2', 'description-v2')
        prepared = provider.FeedbackAdapter(provider.ProviderConfig('openai', 'gpt-6-luna', 'old-key')).prepare_descriptions(self.analysis)
        with patch.dict(os.environ, {'FEEDBACK_PROVIDER': 'OpenRouter', 'FEEDBACK_OPENAI_PROJECT_ID': 'old-project'}):
            for resolve in (legacy.credentials, lambda: self.raw(prepared)):
                with self.assertRaises(FeedbackError) as caught: resolve()
                self.assertEqual(caught.exception.code, 'invalid_configuration')
        self.assertEqual(self.calls, [])

    def test_router_errors_keep_single_submission_and_uncertainty_semantics(self):
        prepared = self.coaching()
        for status, code, uncertain in ((402, 'provider_credits', False), (429, 'provider_rate_limit', False),
                                        (503, 'provider_error', True)):
            with self.subTest(status=status):
                before = len(self.calls)
                receipt = self.raw(prepared, status=status, body={'error': {'message': 'private'}},
                                   headers={'retry-after': '60', 'x-should-retry': 'true'})
                with self.assertRaises(FeedbackError) as caught: provider.normalize(prepared, receipt)
                self.assertEqual((caught.exception.code, caught.exception.uncertain), (code, uncertain))
                self.assertEqual(len(self.calls), before + 1)
                self.assertNotIn('private', str(caught.exception))
        for body in ({}, {'status': 'failed', 'error': {'code': 'server_error'}, 'output': []},
                     {'status': 'completed', 'output': []}):
            with self.assertRaises(FeedbackError): provider.normalize(prepared, self.raw(prepared, body=body))

    def test_timeout_is_uncertain_and_never_retried(self):
        def handle(request):
            self.calls.append(request)
            raise httpx.ReadTimeout('private', request=request)
        with self.assertRaises(FeedbackError) as caught:
            provider.request_raw(self.coaching(), _transport=httpx.MockTransport(handle))
        self.assertEqual((caught.exception.code, caught.exception.uncertain), ('provider_timeout', True))
        self.assertEqual(len(self.calls), 1)

    def test_error_after_http_200_requires_charge_acknowledgement_even_before_normalization(self):
        from .services.descriptions import uncertain_submission
        prepared = self.coaching()
        for error in ({'code': 'server_error'}, {'code': 502}):
            receipt = self.raw(prepared, body={'status': 'failed', 'error': error})
            with self.assertRaises(FeedbackError) as caught: provider.normalize(prepared, receipt)
            self.assertEqual(caught.exception.code, 'provider_error')
            self.assertTrue(caught.exception.uncertain)
            request = SimpleNamespace(outcome='received', submitted_at=True, received_at=True, completed_at=None,
                status_code=200, body_complete=True, raw_body=receipt.body, provider='openrouter')
            self.assertTrue(uncertain_submission(request))
