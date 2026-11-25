"""Lifetime spend checks with synthetic keys, audio, prices and HTTP responses."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Barrier
from unittest.mock import patch
import wave

import httpx
from django.db import connections, transaction
from django.test import TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone

from rehearsals.feedback_v3 import llm
from rehearsals.models import Attempt, CaptureSegment, CaptureSession, Deck
from rehearsals.services import display_translator, feedback_provider, incremental, processing, qa, transcription
from rehearsals.services.feedback import FeedbackError
from rehearsals.test_storage import audio_file
from . import budget
from .models import LifetimeBudget, ProviderCharge


MODEL = 'openai/example'
FIRST_HOLD = 4 * (1_500_000 + 45_060)
PRICES = {
    'OUTLOUD_PUBLIC_AI_UNTIL': '2099-01-01T00:00:00Z',
    'OUTLOUD_PUBLIC_OPENROUTER_MODEL': MODEL, 'OUTLOUD_PUBLIC_OPENROUTER_CONTEXT_TOKENS': '30000',
    'OUTLOUD_PUBLIC_OPENROUTER_INPUT_USD_PER_MTOK': '1.5', 'OUTLOUD_PUBLIC_OPENROUTER_OUTPUT_USD_PER_MTOK': '6',
    'OUTLOUD_PUBLIC_SCRIBE_USD_PER_HOUR': '0.6', 'ELEVENLABS_API_KEY': 'synthetic-scribe',
    'OPENROUTER_API_KEY': 'synthetic-router', 'FEEDBACK_ENABLED': 'true', 'FEEDBACK_PROVIDER': 'openrouter',
    'FEEDBACK_OPENROUTER_MODEL': MODEL, 'FEEDBACK_OPENROUTER_PROJECT_ID': 'synthetic',
    'FEEDBACK_OPENROUTER_RPM': '20', 'FEEDBACK_OPENROUTER_TPM': '1000000',
}


def response_body(usage=None):
    if usage is not None:
        usage = {'is_byok': False, 'cost_details': {'upstream_inference_cost': 0}, **usage}
    return {'status': 'completed', 'usage': usage, 'output': [
        {'type': 'message', 'content': [{'type': 'output_text', 'text': '{"ok":true}'}]}]}


@override_settings(OUTLOUD_PUBLIC_SERVICE=True)
class PublicBudgetTests(TransactionTestCase):
    def setUp(self):
        self.enterContext(patch.dict(os.environ, PRICES))
        self.network = self.enterContext(patch.object(httpx.HTTPTransport, 'handle_request',
                                                      side_effect=AssertionError('Real provider traffic forbidden')))
        self.media = self.enterContext(TemporaryDirectory())
        self.enterContext(override_settings(MEDIA_ROOT=self.media))
        LifetimeBudget.objects.update_or_create(pk=1, defaults={'committed_microusd': 0, 'halted': False})
        self.config = llm.Config('synthetic-router', MODEL, retries=1)

    def call(self, handler, config=None):
        with httpx.Client(transport=httpx.MockTransport(handler)) as client:
            return llm.complete_json(client, config or self.config, name='test', system='Synthetic', user={},
                                     schema={'type': 'object'}, max_output_tokens=10, sleep=lambda _: None)

    def committed(self):
        return LifetimeBudget.objects.get(pk=1).committed_microusd

    def test_funding_deadline_stops_both_providers_before_spending(self):
        payload = {'model': MODEL, 'max_output_tokens': 10}
        for until in ('', '2000-01-01T00:00:00Z', '2099-01-01T00:00:00', 'invalid'):
            with self.subTest(until=until), patch.dict(os.environ, {'OUTLOUD_PUBLIC_AI_UNTIL': until}):
                with self.assertRaises(budget.BudgetError):
                    budget.authorize_openrouter(budget.OPENROUTER_URL, dict(payload), 'synthetic')
                with self.assertRaises(budget.BudgetError):
                    budget.authorize_scribe('synthetic', 16000)
        self.assertEqual(self.committed(), 0)
        self.assertFalse(ProviderCharge.objects.exists())
        with patch.dict(os.environ, {'OUTLOUD_PUBLIC_AI_UNTIL': '2099-01-01T00:00:00+09:00'}):
            budget.authorize_scribe('synthetic', 16000)
        self.assertGreater(self.committed(), 0)

    def test_retry_reserves_before_each_send_including_increased_reasoning_budget(self):
        sent = []
        def handle(request):
            payload = json.loads(request.content)
            sent.append((payload['max_output_tokens'], self.committed()))
            self.assertEqual(payload['provider']['only'], ['openai'])
            self.assertFalse(payload['provider']['allow_fallbacks'])
            self.assertEqual((payload['tools'], payload['tool_choice'], payload['max_tool_calls']), ([], 'none', 1))
            self.assertIn({'id': 'web', 'enabled': False}, payload['plugins'])
            self.assertEqual(payload['provider']['max_price'], {'prompt': 1.5, 'completion': 6, 'image': 0, 'request': 0})
            return httpx.Response(200, json={'status': 'incomplete'} if len(sent) == 1 else response_body())
        self.assertEqual(self.call(handle).tries, 2)
        total = FIRST_HOLD + 4 * (1_500_000 + 45_120)
        self.assertEqual(sent, [(10, FIRST_HOLD), (20, total)])
        self.assertEqual(self.committed(), total)  # Missing receipt prices retain both full holds.
        self.assertEqual(set(ProviderCharge.objects.values_list('credential_sha256', flat=True)),
                         {hashlib.sha256(b'synthetic-router').hexdigest()})

    def test_last_affordable_call_survives_timeout_and_retry_stops_at_the_cap(self):
        LifetimeBudget.objects.update(committed_microusd=budget.LIMIT_MICROUSD - FIRST_HOLD)
        sent = []
        def timeout(request):
            sent.append(request.url)
            raise httpx.ReadTimeout('synthetic failure')
        with self.assertRaises(llm.LLMError) as error:
            self.call(timeout)
        self.assertEqual(error.exception.code, 'public_budget_exhausted')
        self.assertFalse(error.exception.retryable)
        self.assertEqual((len(sent), ProviderCharge.objects.count(), self.committed()), (1, 1, budget.LIMIT_MICROUSD))
        with self.assertRaises(budget.BudgetError) as scribe:
            budget.authorize_scribe('different-key', 10)
        self.assertEqual(scribe.exception.code, 'public_budget_exhausted')

    def test_completed_receipt_conservatively_settles_once_and_an_underpriced_route_halts(self):
        payload = {'model': MODEL, 'max_output_tokens': 10}
        reservation = budget.authorize_openrouter(budget.OPENROUTER_URL, dict(payload), 'synthetic')
        for raw in (b'{"usage":{"cost":1e999999999999999999999}}',
                    b'{"status":"completed","usage":{"cost":0.1,"cost":0.000001,"input_tokens":1,"output_tokens":1}}'):
            budget.settle_openrouter(reservation, raw)
        self.assertEqual(self.committed(), reservation.reserved_microusd)
        raw = json.dumps(response_body({'cost': 0.00005, 'input_tokens': 10, 'output_tokens': 10})).encode()
        budget.settle_openrouter(reservation, raw)
        budget.settle_openrouter(reservation, raw)
        self.assertEqual(self.committed(), 75)  # Token ceilings exceed the reported fifty microdollars.
        charge = budget.authorize_openrouter(budget.OPENROUTER_URL, dict(payload), 'replacement-key')
        budget.settle_openrouter(charge, json.dumps(response_body(
            {'cost': 10, 'input_tokens': 20, 'output_tokens': 1})).encode())
        self.assertTrue(LifetimeBudget.objects.get(pk=1).halted)
        with self.assertRaises(budget.BudgetError):
            budget.authorize_scribe('synthetic-scribe', 1)

    def test_output_limit_receipt_settles_before_the_independently_reserved_retry(self):
        held_at_send = []

        def handle(request):
            held_at_send.append(self.committed())
            if len(held_at_send) == 1:
                receipt = response_body({'input_tokens': 10, 'output_tokens': 10, 'cost': 0.00005})
                receipt.update(status='incomplete', incomplete_details={'reason': 'max_output_tokens'}, error=None)
                return httpx.Response(200, json=receipt)
            return httpx.Response(200, json=response_body({'input_tokens': 10, 'output_tokens': 5, 'cost': 0.0001}))

        self.assertEqual(self.call(handle).tries, 2)
        retry_hold = 4 * (1_500_000 + 45_120)
        self.assertEqual(held_at_send, [FIRST_HOLD, 75 + retry_hold])
        self.assertEqual(list(ProviderCharge.objects.order_by('pk').values_list('confirmed_microusd', flat=True)),
                         [75, 100])
        self.assertEqual(self.committed(), 175)

    def test_reported_token_limit_bills_settle_once_with_upward_rounding(self):
        # Sanitized billing metadata from three separate 6,000-output-token responses.
        cases = ((119789, 0.0149789, 14979), (29079, 0.0059079, 5908), (72085, 0.0102085, 10209))
        prices = {'OUTLOUD_PUBLIC_OPENROUTER_CONTEXT_TOKENS': '150000',
                  'OUTLOUD_PUBLIC_OPENROUTER_INPUT_USD_PER_MTOK': '0.1',
                  'OUTLOUD_PUBLIC_OPENROUTER_OUTPUT_USD_PER_MTOK': '0.5'}
        with patch.dict(os.environ, prices):
            for inputs, cost, expected in cases:
                with self.subTest(input_tokens=inputs):
                    charge = budget.authorize_openrouter(budget.OPENROUTER_URL, {'model': MODEL, 'max_output_tokens': 6000}, 'synthetic')
                    body = response_body({'input_tokens': inputs, 'output_tokens': 6000, 'cost': cost,
                                          'cost_details': {'upstream_inference_cost': cost}})
                    body.update(status='incomplete', incomplete_details={'reason': 'max_output_tokens'}, alignment={'calls': []})
                    body['output'].insert(0, {'type': 'reasoning'})
                    if inputs != cases[0][0]:
                        body['error'] = None
                        body['usage']['cost_details']['server_tool_cost'] = None
                    raw = json.dumps(body).encode()
                    budget.settle_openrouter(charge, raw)
                    budget.settle_openrouter(charge, raw)
                    self.assertEqual(ProviderCharge.objects.get(pk=charge.charge_id).confirmed_microusd, expected)
        self.assertEqual(self.committed(), sum(case[2] for case in cases))

    def test_ambiguous_terminal_status_or_incomplete_billing_evidence_keeps_the_hold(self):
        receipt = response_body({'cost': 0.0001, 'input_tokens': 10, 'output_tokens': 10})
        receipt.update(status='incomplete', incomplete_details={'reason': 'max_output_tokens'})
        usage = receipt['usage']
        for target, changes in (
                (receipt, {'status': 'in_progress'}), (receipt, {'status': 'cancelled'}),
                (receipt, {'status': 'failed'}), (receipt, {'status': 'completed'}),
                (receipt, {'incomplete_details': None}), (receipt, {'incomplete_details': {}}),
                (receipt, {'incomplete_details': {'reason': 'content_filter'}}), (receipt, {'output': None}),
                (receipt, {'error': {'code': 'provider_error'}}), (receipt, {'error': {}}),
                (usage, {'cost': None}), (usage, {'cost': '0.0001'}), (usage, {'cost': 0}),
                (usage, {'cost': 0, 'cost_details': {'upstream_inference_cost': 0.001}}),
                (usage, {'is_byok': None}), (usage, {'cost_details': {}}),
                (usage, {'cost_details': {'upstream_inference_cost': '0'}}),
                (usage, {'input_tokens': None}), (usage, {'output_tokens': True}), (usage, {'output_tokens': 0})):
            with self.subTest(changes=changes), patch.dict(target, changes):
                LifetimeBudget.objects.update(committed_microusd=0)
                charge = budget.authorize_openrouter(budget.OPENROUTER_URL, {'model': MODEL, 'max_output_tokens': 10}, 'synthetic')
                budget.settle_openrouter(charge, json.dumps(receipt).encode())
                self.assertEqual(self.committed(), charge.reserved_microusd)
                self.assertIsNone(ProviderCharge.objects.get(pk=charge.charge_id).confirmed_microusd)

    def test_receipt_without_explicit_route_or_upstream_cost_keeps_the_reservation(self):
        charge = budget.authorize_openrouter(budget.OPENROUTER_URL, {'model': MODEL, 'max_output_tokens': 10}, 'synthetic')
        for missing in ('is_byok', 'cost_details'):
            body = response_body({'cost': 0.00001, 'input_tokens': 5, 'output_tokens': 2})
            del body['usage'][missing]
            budget.settle_openrouter(charge, json.dumps(body).encode())
            self.assertEqual(self.committed(), charge.reserved_microusd)
            self.assertIsNone(ProviderCharge.objects.get(pk=charge.charge_id).confirmed_microusd)

    def test_unexpected_route_or_search_keeps_hold_and_halts_future_work(self):
        for mode in ('byok', 'search', 'alignment', 'incomplete_search', 'output_limit_with_tool', 'output_limit_tool_count'):
            with self.subTest(mode=mode):
                LifetimeBudget.objects.update(halted=False, committed_microusd=0)
                charge = budget.authorize_openrouter(budget.OPENROUTER_URL, {'model': MODEL, 'max_output_tokens': 10}, 'synthetic')
                body = response_body({'cost': 0.00001, 'input_tokens': 4, 'output_tokens': 1,
                                      'is_byok': mode == 'byok', 'cost_details': {'upstream_inference_cost': 0.00002}})
                if mode == 'search':
                    body['output'][0]['content'][0]['annotations'] = [{'type': 'url_citation'}]
                if mode == 'alignment':
                    body['alignment'] = {'calls': [{'outcome': 'allowed'}]}
                if mode == 'incomplete_search':
                    body = {'status': 'incomplete', 'usage': {'server_tool_use': {'web_search_requests': 1}}}
                if mode.startswith('output_limit'):
                    body.update(status='incomplete', incomplete_details={'reason': 'max_output_tokens'})
                    if mode == 'output_limit_tool_count':
                        body['usage']['server_tool_use'] = {'file_search_requests': 1}
                    else:
                        body['output'] = [{'type': 'web_search_call'}]
                budget.settle_openrouter(charge, json.dumps(body).encode())
                self.assertEqual(self.committed(), charge.reserved_microusd)
                self.assertTrue(LifetimeBudget.objects.get(pk=1).halted)
                if mode.startswith('output_limit'):
                    self.assertIsNone(ProviderCharge.objects.get(pk=charge.charge_id).confirmed_microusd)

    def test_submissions_fail_closed_for_unverified_tariffs_routes_and_ledger(self):
        def forbidden(request):
            self.fail('A rejected request reached HTTP')
        for changes in ({'OUTLOUD_PUBLIC_OPENROUTER_MODEL': 'openai/unknown'},
                        {'OUTLOUD_PUBLIC_OPENROUTER_CONTEXT_TOKENS': '0'},
                        {'OUTLOUD_PUBLIC_OPENROUTER_OUTPUT_USD_PER_MTOK': 'NaN'},
                        {'OUTLOUD_PUBLIC_OPENROUTER_INPUT_USD_PER_MTOK': ''}):
            with self.subTest(changes=changes), patch.dict(os.environ, changes), self.assertRaises(llm.LLMError) as error:
                self.call(forbidden)
            self.assertEqual(error.exception.code, 'public_budget_unavailable')
        with self.assertRaises(llm.LLMError):
            self.call(forbidden, llm.Config('synthetic', MODEL, base_url='https://example.invalid'))
        legacy = feedback_provider.ProviderConfig('openai', 'example', 'synthetic')
        prepared = qa._payload(legacy, 'qa_questions', 'test', {}, qa.Questions.model_json_schema())
        with patch.dict(os.environ, {'FEEDBACK_PROVIDER': 'openai'}), self.assertRaises(FeedbackError) as non_router:
            feedback_provider.request_raw(prepared)
        self.assertEqual(non_router.exception.code, 'public_budget_unavailable')
        with transaction.atomic(), self.assertRaises(llm.LLMError):
            self.call(forbidden)
        LifetimeBudget.objects.all().delete()
        with self.assertRaises(llm.LLMError):
            self.call(forbidden)
        self.assertFalse(ProviderCharge.objects.exists())
        self.network.assert_not_called()

    def test_sdk_request_adds_price_caps_at_final_transport_and_settles_at_confirmed_usage(self):
        config, _ = qa.configured()
        prepared = qa._payload(config, 'qa_questions', 'test', {}, qa.Questions.model_json_schema())
        def handle(request):
            self.assertGreater(self.committed(), 0)
            payload = json.loads(request.content)
            self.assertEqual(payload['provider']['only'], ['openai'])
            self.assertEqual(payload['service_tier'], 'default')
            self.assertEqual(int(request.headers['Content-Length']), len(request.content))
            return httpx.Response(200, json=response_body({'input_tokens': 5, 'output_tokens': 5, 'cost': 0.0001}))
        feedback_provider.request_raw(prepared, _transport=httpx.MockTransport(handle))
        self.assertEqual(self.committed(), 100)
        self.assertEqual(ProviderCharge.objects.get().confirmed_microusd, 100)

    def test_scribe_charges_the_actual_normalized_file_rounded_up_to_a_minute(self):
        original = Path(self.media) / 'input.wav'
        frames = 960_001
        with wave.open(str(original), 'wb') as wav:
            wav.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            wav.writeframes(b'\0\0' * frames)
        def scribe(request):
            self.assertEqual(self.committed(), 20_000)
            multipart = request.read()
            with wave.open(BytesIO(multipart[multipart.index(b'RIFF'):]), 'rb') as normalized:
                self.assertEqual((normalized.getnframes(), normalized.getframerate(), normalized.getnchannels()),
                                 (frames, 16000, 1))
            self.assertIn(b'keyterms', multipart)
            return httpx.Response(200, json={'text': '', 'words': []})
        self.network.side_effect = scribe
        transcription.transcribe(original, keyterms=['synthetic'])
        self.assertEqual(self.network.call_count, 1)
        self.assertEqual(ProviderCharge.objects.get().provider, 'elevenlabs')
        original.write_bytes(b'invalid')
        with self.assertRaises(transcription.TranscriptionError):
            transcription.transcribe(original)
        self.assertEqual(self.network.call_count, 1)

    def test_scribe_timeout_remains_charged_after_key_rotation_and_calendar_change(self):
        original = Path(self.media) / 'input.wav'
        original.write_bytes(audio_file().read())
        with transcription.prepare_request(original) as prepared:
            prepared.options['model_id'] = 'unknown'
            with self.assertRaises(transcription.TranscriptionError) as unknown:
                transcription.request_raw(prepared)
            self.assertEqual(unknown.exception.code, 'public_budget_unavailable')
        with patch.dict(os.environ, {'OUTLOUD_PUBLIC_SCRIBE_USD_PER_HOUR': ''}):
            with self.assertRaises(transcription.TranscriptionError):
                transcription.transcribe(original)
        self.network.assert_not_called()
        LifetimeBudget.objects.update(committed_microusd=budget.LIMIT_MICROUSD - 10_000)
        self.network.side_effect = httpx.ReadTimeout('synthetic')
        with self.assertRaises(transcription.TranscriptionError) as timeout:
            transcription.transcribe(original)
        self.assertTrue(timeout.exception.uncertain)
        ProviderCharge.objects.update(created_at=timezone.now() - timedelta(days=400))
        with patch.dict(os.environ, {'ELEVENLABS_API_KEY': 'synthetic-replacement'}):
            with self.assertRaises(transcription.TranscriptionError) as exhausted:
                transcription.transcribe(original)
        self.assertEqual(exhausted.exception.code, 'public_budget_exhausted')
        self.assertFalse(exhausted.exception.uncertain)
        self.assertEqual((self.network.call_count, ProviderCharge.objects.count(), self.committed()),
                         (1, 1, budget.LIMIT_MICROUSD))

    def test_durable_full_segment_answer_and_both_translation_transports_stop_before_network(self):
        LifetimeBudget.objects.update(committed_microusd=budget.LIMIT_MICROUSD)
        deck = Deck.objects.create(title='Synthetic', pdf='synthetic.pdf', page_count=1)
        attempt = Attempt.objects.create(deck=deck, audio=audio_file(), duration_ms=2000,
            slide_events=[{'slide_index': 0, 'at_ms': 0}], status='processing', processing_state='queued',
            processing_revision=1)
        with patch.object(processing, 'has_speech', return_value=True):
            processing.run_attempt(attempt.pk, 1)
        attempt.refresh_from_db()
        self.assertEqual((attempt.processing_state, attempt.error['code']), ('failed', 'public_budget_exhausted'))
        self.assertEqual(attempt.provider_requests.get().outcome, 'rejected')
        part = CaptureSegment.objects.create(capture=CaptureSession.objects.create(attempt=attempt),
            sequence=0, slide_index=0, start_ms=0, end_ms=2000, audio=audio_file(), status='queued')
        with patch.object(incremental, 'has_speech', return_value=True), patch.object(incremental, 'refresh'):
            incremental.transcribe_segment(part.pk)
        part.refresh_from_db()
        self.assertEqual((part.status, part.receipts[-1]['outcome'], part.error['code']),
                         ('failed', 'rejected', 'public_budget_exhausted'))
        with self.assertRaises(transcription.TranscriptionError) as answer:
            qa.review_answer(deck, {'question': 'Why?', 'main_question': 'Why?', 'part': 0, 'slide_index': 0,
                                    'duration_ms': 1}, audio_file())
        self.assertEqual(answer.exception.code, 'public_budget_exhausted')
        config, selection = qa.configured()
        with self.assertRaises(FeedbackError) as question:
            qa.write_questions(deck, {'audience': 'Test', 'slides': [{'slide_index': 0, 'title': 'test', 'transcript': 'test'}]})
        self.assertEqual(question.exception.code, 'public_budget_exhausted')
        for config, selection in ((config, selection), (self.config, None)):
            with self.subTest(selection=selection), self.assertRaises((FeedbackError, llm.LLMError)) as translated:
                display_translator._provider_fields('test', {'note': 'test'}, config, selection)
            self.assertEqual(translated.exception.code, 'public_budget_exhausted')
        self.network.assert_not_called()

    @override_settings(OUTLOUD_PUBLIC_SERVICE=False)
    def test_demo_sends_without_public_pricing_or_ledger(self):
        LifetimeBudget.objects.all().delete()
        with patch.dict(os.environ, {'OUTLOUD_PUBLIC_OPENROUTER_INPUT_USD_PER_MTOK': ''}):
            def demo(request):
                self.assertNotIn('provider', json.loads(request.content))
                return httpx.Response(200, json=response_body())
            self.assertTrue(self.call(demo).data['ok'])
        self.assertFalse(ProviderCharge.objects.exists())

    @skipUnlessDBFeature('has_select_for_update')
    def test_postgresql_workers_and_rotated_keys_compete_for_one_remaining_reservation(self):
        LifetimeBudget.objects.update(committed_microusd=budget.LIMIT_MICROUSD - 100)
        gate = Barrier(8)
        def admit(index):
            try:
                gate.wait(timeout=10)
                budget._reserve(('elevenlabs', 'openrouter')[index % 2], f'synthetic-{index}', Decimal('100'))
                return 'sent'
            except budget.BudgetError as error:
                return error.code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(admit, range(8)))
        self.assertCountEqual(results, ['sent'] + ['public_budget_exhausted'] * 7)
        self.assertEqual((self.committed(), ProviderCharge.objects.count()), (budget.LIMIT_MICROUSD, 1))
