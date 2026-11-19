"""Grading budget regressions; synthetic receipts, no network/provider inference."""
# AI-assisted by OpenAI Codex; see docs/ai-collaboration-prompts-iteration-2.md.
from dataclasses import replace
import json
from unittest import TestCase
from unittest.mock import patch
import httpx
from .services import feedback_provider as provider, presentation_score_v2 as scorer
from .services.feedback import FeedbackError, MAX_OUTPUT_BYTES, json_bytes
from .test_feedback_provider import envelope
from .test_presentation_score_v2 import make_bundle, output, speech


class PresentationScoreBudgetTests(TestCase):
    def setUp(self):
        self.bundle = make_bundle()
        self.config = provider.ProviderConfig('openrouter', 'openai/gpt-6-luna', '')
        self.prepared = scorer.prepare(self.bundle, self.config)

    def receipt(self, raw=None, *, text=None, status='completed'):
        value = envelope('openai', raw if raw is not None else output(self.bundle))
        if text is not None: value['output'][0]['content'][0]['text'] = text
        value['status'] = status
        return provider.RawReceipt(self.config.provider, self.config.model, 'coaching', self.prepared.input_hash,
                                   200, json_bytes(value), True, None, None, ())

    def padded_receipt(self, size):
        text = json.dumps(output(self.bundle), ensure_ascii=False)
        self.assertLess(len(text.encode('utf-8')), size)
        return self.receipt(text=text + ' ' * (size-len(text.encode('utf-8'))))

    def large_output(self):
        raw = output(self.bundle)
        raw['feedback']['strengths'] = [{'text': f'Synthetic strength {index}: ' + 'x'*960,
                                        'evidence': [speech()]} for index in range(70)]
        self.assertGreater(len(json_bytes(raw)), 65536)
        self.assertLess(len(json_bytes(raw)), 131072)
        return raw

    def test_v2_budget_and_protocol_are_frozen_without_mutable_descriptor_state(self):
        for name, model in (('openai', 'synthetic'), ('openrouter', 'openai/gpt-6-luna'), ('gemini', 'synthetic')):
            prepared = scorer.prepare(self.bundle, provider.ProviderConfig(name, model, ''))
            self.assertEqual(provider.output_token_limit(prepared), 24000)
        policy = scorer.protocol_descriptor()['request_policy']
        self.assertEqual(policy, {'version': 'presentation-score-request-policy-v2',
                                 'max_output_tokens': 24000, 'max_output_bytes': 131072, 'timeout_seconds': 240})
        policy['max_output_tokens'] = 1
        self.assertEqual(scorer.protocol_descriptor()['request_policy']['max_output_tokens'], 24000)
        self.assertEqual(scorer.PROMPT_VERSION, 'presentation-score-prompt-v2.4')
        self.assertEqual((provider.MAX_RESPONSE_BYTES, MAX_OUTPUT_BYTES), (262144, 65536))
        from .services import presentation_scoring as scoring
        self.assertEqual(scoring.prompt_digest(), '31ec7d5185bc199dc1d81fe5808ea05dd4d10f3e1019963a5fc498a53c08f282')
        self.assertEqual(scoring.v1._digest(scoring.protocol()), '920ced59f9f81b9f617878c5c4589de12b8dfde8e4ef80822ea5373e2af12fa4')
        self.assertEqual(scorer.protocol_descriptor()['prompt_sha256'], '90a3fbd5815d5ab097dc783f62f8f1caca315340307f0473376b20c50fcb5bc4')

    def test_large_valid_grading_passes_full_validation_but_generic_parser_stays_bounded(self):
        receipt = self.receipt(self.large_output())
        with self.assertRaises(FeedbackError) as error: provider.output_json(receipt)
        self.assertEqual(error.exception.code, 'invalid_response')
        result, audit = scorer.normalize_with_audit(self.bundle, self.prepared, receipt)
        self.assertEqual(result['overall']['score'], 100)
        self.assertEqual(result['validation']['score_critical']['rejected_count'], 0)
        self.assertEqual(len(result['feedback']['strengths']), 70)
        self.assertEqual(audit['binding']['input_hash'], self.prepared.input_hash)

    def test_exact_128k_inner_boundary_passes_and_one_byte_over_fails(self):
        result, _ = scorer.normalize_with_audit(self.bundle, self.prepared, self.padded_receipt(131072))
        self.assertEqual(result['overall']['score'], 100)
        with self.assertRaises(FeedbackError) as error:
            scorer.normalize_with_audit(self.bundle, self.prepared, self.padded_receipt(131073))
        self.assertEqual(error.exception.code, 'invalid_response')

    def test_more_budget_does_not_accept_incomplete_malformed_or_invalid_evidence(self):
        with self.assertRaises(FeedbackError) as error:
            scorer.normalize_with_audit(self.bundle, self.prepared, self.receipt(self.large_output(), status='incomplete'))
        self.assertEqual(error.exception.code, 'provider_incomplete')
        for text in ('{"slides":', '{"x":NaN}', '{"x":1,"x":2}'):
            with self.assertRaises(FeedbackError):
                scorer.normalize_with_audit(self.bundle, self.prepared, self.receipt(text=text))
        raw = self.large_output(); raw['slides'][0]['criteria'][0]['evidence'] = [speech('v999')]
        result, _ = scorer.normalize_with_audit(self.bundle, self.prepared, self.receipt(raw))
        self.assertIsNone(result['overall']['score'])
        self.assertEqual(result['assessment_status'], 'invalid_evidence')

    def test_wire_bound_and_generic_limit_cannot_be_bypassed(self):
        value = self.receipt()
        oversized = replace(value, body=b'x'*(provider.MAX_RESPONSE_BYTES+1))
        with self.assertRaises(FeedbackError) as error:
            scorer.normalize_with_audit(self.bundle, self.prepared, oversized)
        self.assertEqual(error.exception.code, 'invalid_response')
        for limit in (True, 0, -1, provider.MAX_RESPONSE_BYTES+1):
            with self.assertRaises(FeedbackError): provider.output_json(value, max_output_bytes=limit)
        for size, accepted in ((65536, True), (65537, False)):
            receipt = self.padded_receipt(size)
            if accepted: self.assertIsInstance(provider.output_json(receipt), dict)
            else:
                with self.assertRaises(FeedbackError): provider.output_json(receipt)

    def test_historical_v1_keeps_12k_tokens_and_64k_inner_json(self):
        from .test_presentation_score import PresentationScoreTests
        from .services import presentation_score as v1
        case = PresentationScoreTests(); case.setUp()
        prepared = v1.prepare(case.bundle, self.config)
        self.assertEqual(provider.output_token_limit(prepared), 12000)
        value = envelope('openai', case.output())
        text = value['output'][0]['content'][0]['text']
        value['output'][0]['content'][0]['text'] = text + ' '*(65537-len(text.encode('utf-8')))
        receipt = provider.RawReceipt(self.config.provider, self.config.model, 'coaching', prepared.input_hash,
                                     200, json_bytes(value), True, None, None, ())
        with self.assertRaises(FeedbackError) as error: v1.normalize(case.bundle, prepared, receipt)
        self.assertEqual(error.exception.code, 'invalid_response')


    def test_request_deadlines_are_bounded_and_default_timeout_patch_stays_compatible(self):
        config = replace(self.config, key='synthetic-budget-key')
        grade = replace(self.prepared, config=config)
        generic = provider.FeedbackAdapter(config, preparation_only=True).prepare_coaching(self.bundle.analysis,
            provider.DescriptionResult(config.provider, config.model, self.bundle.analysis.deck.input_id, self.bundle.descriptions))
        self.assertEqual(grade.timeout_seconds, 240)
        self.assertIsNone(generic.timeout_seconds)
        for prepared, expected, default in ((grade, 240, 120), (generic, 120, 120), (generic, .5, .5)):
            seen = []
            def handle(request):
                seen.append(request.extensions['timeout'])
                return httpx.Response(200, json=envelope('openai', {'synthetic': True}))
            with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openrouter'}), \
                 patch.object(provider, 'TIMEOUT_SECONDS', default):
                receipt = provider.request_raw(prepared, _transport=httpx.MockTransport(handle))
            self.assertTrue(receipt.body_complete)
            self.assertEqual(len(seen), 1)
            self.assertEqual(seen[0], {'connect': 10.0, 'read': expected, 'write': 30.0, 'pool': 5.0})
        calls = []
        for limit in (True, 0, -1, 241, float('inf'), float('nan'), '240'):
            with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openrouter'}), self.assertRaises(FeedbackError) as error:
                provider.request_raw(replace(grade, timeout_seconds=limit),
                    _transport=httpx.MockTransport(lambda request: calls.append(request)))
            self.assertEqual(error.exception.code, 'invalid_configuration')
        self.assertEqual(calls, [])

    def test_transport_elapsed_deadline_accepts_180s_grade_but_still_stops_at_240s(self):
        config = replace(self.config, key='synthetic-budget-key')
        grade = replace(self.prepared, config=config)
        for prepared, elapsed, complete in ((grade, 180, True), (replace(grade, timeout_seconds=None), 180, False),
                                            (grade, 240.001, False)):
            clock = {'now': 0}
            class TimedStream(httpx.SyncByteStream):
                def __iter__(self):
                    clock['now'] = elapsed
                    yield b'{}'
            def handle(request): return httpx.Response(200, stream=TimedStream())
            with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openrouter'}), \
                 patch.object(provider.time, 'monotonic', side_effect=lambda: clock['now']):
                receipt = provider.request_raw(prepared, _transport=httpx.MockTransport(handle))
            self.assertEqual(receipt.body_complete, complete)
            if not complete:
                self.assertEqual(receipt.body_issue, 'response_timeout')
                self.assertTrue(provider.receipt_is_uncertain(receipt.status_code, receipt.body_complete, receipt.body, receipt.provider))

    def test_changed_local_deadline_cannot_normalize_as_the_frozen_grading_request(self):
        with self.assertRaises(FeedbackError) as error:
            scorer.normalize_with_audit(self.bundle, replace(self.prepared, timeout_seconds=120), self.receipt())
        self.assertEqual(error.exception.code, 'source_mismatch')
