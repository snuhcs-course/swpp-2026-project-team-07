"""Tests for the rebuilt feedback pipeline (rehearsals/feedback_v3).

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
No test calls a real provider: LLM traffic uses httpx.MockTransport or a fake call_llm.
"""
from datetime import timedelta
from fractions import Fraction
import json
import os
from unittest import mock

import httpx
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .feedback_v3 import llm, measurements, pipeline, prompts, rubric, transcript
from .models import (Attempt, Deck, DescriptionSet, FeedbackAnalysis, FeedbackJob, FeedbackRun,
                     PresentationContext, QaAnswer, Slide)

ENV = {'FEEDBACK_V3_ENABLED': 'true', 'OPENROUTER_API_KEY': 'test-key', 'FEEDBACK_V3_MODEL': 'openai/gpt-6-luna'}


def words_for(text, start_ms, step=400, length=300):
    return [{'text': w, 'start_ms': start_ms + i * step, 'end_ms': start_ms + i * step + length}
            for i, w in enumerate(text.split())]


class RubricTests(SimpleTestCase):
    def test_reference_slide_example_is_80(self):
        levels = {'essential_coverage': 'advanced', 'explanation_depth': 'competent', 'clarity_relevance': 'competent'}
        self.assertEqual(rubric.component_points(rubric.RUBRIC_V2.slide, levels), 80)

    def test_all_competent_overall_is_200_over_3_and_publishes_67(self):
        slide = rubric.component_points(rubric.RUBRIC_V2.slide, {c.id: 'competent' for c in rubric.RUBRIC_V2.slide})
        whole = rubric.component_points(rubric.RUBRIC_V2.whole, {c.id: 'competent' for c in rubric.RUBRIC_V2.whole})
        overall = rubric.overall_points(rubric.RUBRIC_V2, [slide, slide], whole)
        self.assertEqual(overall, Fraction(200, 3))
        self.assertEqual(rubric.round_half_up(overall), 67)
        self.assertEqual(rubric.round_half_up(Fraction(133, 2)), 67)  # 66.5 rounds up.

    def test_level_bands_assign_ties_higher(self):
        self.assertEqual(rubric.overall_level(Fraction(50)), 'competent')
        self.assertEqual(rubric.overall_level(Fraction(4999, 100)), 'emerging')
        self.assertEqual(rubric.overall_level(Fraction(100)), 'advanced')

    def test_next_level_gain_and_incomplete_levels(self):
        coverage = rubric.RUBRIC_V2.slide[0]
        self.assertEqual(rubric.next_level_gain(coverage, 'emerging'), Fraction(40, 3))
        self.assertEqual(rubric.next_level_gain(coverage, 'advanced'), 0)
        with self.assertRaises(ValueError):
            rubric.component_points(rubric.RUBRIC_V2.slide, {'essential_coverage': 'advanced'})


class TranscriptTests(SimpleTestCase):
    events = [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 5000}, {'slide_index': 0, 'at_ms': 9000}]

    def test_sentences_split_on_punctuation_gaps_and_visits(self):
        words = (words_for('Hello there. This is', 0) + words_for('after a pause', 3000)
                 + words_for('slide two talk', 5000) + words_for('back again', 9000))
        speech = transcript.build(words, self.events, 12000, [])
        self.assertEqual([s.text for s in speech.sentences],
                         ['Hello there.', 'This is', 'after a pause', 'slide two talk', 'back again'])
        self.assertEqual([s.slide_index for s in speech.sentences], [0, 0, 0, 1, 0])
        self.assertEqual(speech.slides[0].visit_ms, [(0, 5000), (9000, 12000)])
        self.assertEqual(speech.sentences[1].start_ms, 800)

    def test_corrections_change_text_but_keep_original_timing(self):
        words = words_for('the cat sat down.', 0)
        speech = transcript.build(words, self.events[:1], 4000, [{'word_start': 1, 'word_end': 2, 'text': 'cassette'}])
        self.assertEqual(speech.sentences[0].text, 'the cassette down.')
        self.assertEqual((speech.sentences[0].start_ms, speech.sentences[0].end_ms), (0, 1500))

    def test_language_detection(self):
        self.assertEqual(transcript.detect_language('오늘은 서울의 API 설계를 소개하겠습니다'), 'ko')
        self.assertEqual(transcript.detect_language('Today I will introduce the API design'), 'en')
        self.assertEqual(transcript.detect_language('123 ...'), 'und')


class MeasurementTests(SimpleTestCase):
    def test_english_rate_uses_words_per_minute_of_speaking_time(self):
        words = words_for(' '.join(['word'] * 50), 0, step=400)  # 50 words in 19.9 s of continuous speech.
        speech = transcript.build(words, [{'slide_index': 0, 'at_ms': 0}], 60000, [])
        rate = measurements.measure(speech, ['slide text'], 60000, None)['slides'][0]['rate']
        self.assertEqual(rate['unit'], 'words/min')
        self.assertAlmostEqual(rate['value'], 50 / (19.9 / 60), places=0)
        self.assertEqual(rate['band'], 'comfortable')
        quick = transcript.build(words_for(' '.join(['word'] * 50), 0, step=250, length=200),
                                 [{'slide_index': 0, 'at_ms': 0}], 60000, [])
        self.assertEqual(measurements.measure(quick, ['s'], 60000, None)['slides'][0]['rate']['band'], 'fast')

    def test_korean_rate_counts_syllables_and_fillers(self):
        text = ' '.join(['안녕하세요'] * 20 + ['음', '어'])  # 100 Hangul syllables + 2 filler syllables.
        speech = transcript.build(words_for(text, 0, step=800, length=700), [{'slide_index': 0, 'at_ms': 0}], 30000, [])
        result = measurements.measure(speech, ['슬라이드'], 30000, None)
        self.assertEqual(result['whole']['language'], 'ko')
        self.assertEqual(result['slides'][0]['rate']['unit'], 'syllables/min')
        self.assertEqual(result['slides'][0]['filler_count'], 2)

    def test_long_pauses_repeats_and_time_targets(self):
        words = words_for('we we need', 0) + words_for('this now', 5000)
        speech = transcript.build(words, [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 8000}], 10000, [])
        result = measurements.measure(speech, ['first slide words', 'second'], 10000, 120)
        self.assertEqual(result['slides'][0]['long_pauses'], 1)
        self.assertEqual(result['slides'][0]['repeated_words'], 1)
        self.assertEqual(sum(m['target_seconds'] for m in result['slides'].values()), 120)
        self.assertEqual(result['whole']['time_ratio'], round(10 / 120, 2))


class SchemaTests(SimpleTestCase):
    def test_schemas_are_strict_mode_compatible(self):
        def check(node):
            if isinstance(node, dict):
                if node.get('type') == 'object':
                    self.assertFalse(node['additionalProperties'])
                    self.assertEqual(set(node['required']), set(node['properties']))
                for value in node.values():
                    check(value)
            elif isinstance(node, list):
                for value in node:
                    check(value)
        check(prompts.slide_schema(rubric.RUBRIC_V2))
        check(prompts.whole_schema(rubric.RUBRIC_V2))


def provider_body(data, status='completed'):
    return {'status': status, 'usage': {'input_tokens': 11, 'output_tokens': 7},
            'output': [{'type': 'reasoning', 'summary': []},
                       {'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(data)}]}]}


class LLMTests(SimpleTestCase):
    config = llm.Config(api_key='k', model='openai/gpt-6-luna', retries=2)

    def call(self, handler):
        seen = []
        def record(request):
            seen.append(json.loads(request.content))
            return handler(len(seen))
        with httpx.Client(transport=httpx.MockTransport(record)) as http:
            result = llm.complete_json(http, self.config, name='t', system='s', user={'a': 1},
                                       schema={'type': 'object'}, max_output_tokens=100, sleep=lambda _: None)
        return result, seen

    def test_success_parses_message_text_and_usage(self):
        result, seen = self.call(lambda n: httpx.Response(200, json=provider_body({'ok': True})))
        self.assertEqual((result.data, result.input_tokens, result.output_tokens, result.tries), ({'ok': True}, 11, 7, 1))
        self.assertEqual(seen[0]['reasoning'], {'effort': 'low'})
        self.assertTrue(seen[0]['text']['format']['strict'])

    def test_rate_limit_and_invalid_json_are_retried(self):
        responses = [httpx.Response(429, headers={'retry-after': '1'}),
                     httpx.Response(200, json={'status': 'completed', 'output': [
                         {'type': 'message', 'content': [{'type': 'output_text', 'text': '{bad'}]}]}),
                     httpx.Response(200, json=provider_body({'ok': 1}))]
        result, seen = self.call(lambda n: responses[n - 1])
        self.assertEqual((result.data, result.tries, len(seen)), ({'ok': 1}, 3, 3))

    def test_cut_off_output_retries_with_a_larger_budget(self):
        result, seen = self.call(lambda n: httpx.Response(200, json=provider_body({}, 'incomplete' if n == 1 else 'completed')))
        self.assertEqual([s['max_output_tokens'] for s in seen], [100, 200])

    def test_auth_errors_and_refusals_are_not_retried(self):
        with self.assertRaises(llm.LLMError) as caught:
            self.call(lambda n: httpx.Response(401))
        self.assertEqual(caught.exception.code, 'provider_auth')
        refusal = {'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'no'}]}]}
        with self.assertRaises(llm.LLMError) as caught:
            self.call(lambda n: httpx.Response(200, json=refusal))
        self.assertEqual(caught.exception.code, 'provider_refusal')

    def test_retries_stop_after_the_limit(self):
        with self.assertRaises(llm.LLMError) as caught:
            self.call(lambda n: httpx.Response(503))
        self.assertEqual(caught.exception.code, 'provider_error')

    def test_deadline_stops_new_attempts_and_shortens_timeouts(self):
        clock = iter([0.0, 0.0, 100.0, 100.0]).__next__
        with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as http:
            with self.assertRaises(llm.LLMError) as caught:
                llm.complete_json(http, self.config, name='t', system='s', user={}, schema={}, max_output_tokens=10,
                                  deadline=102.0, sleep=lambda _: None, clock=clock)
        self.assertEqual(caught.exception.code, 'provider_error')  # No retry: the backoff would pass the deadline.
        with self.assertRaises(llm.LLMError) as caught:
            llm.complete_json(None, self.config, name='t', system='s', user={}, schema={}, max_output_tokens=10,
                              deadline=3.0, clock=lambda: 0.0)
        self.assertEqual(caught.exception.code, 'run_deadline')

    def test_content_filter_is_a_refusal_and_decoding_errors_are_retried(self):
        filtered = {'status': 'incomplete', 'incomplete_details': {'reason': 'content_filter'}, 'output': []}
        with self.assertRaises(llm.LLMError) as caught:
            self.call(lambda n: httpx.Response(200, json=filtered))
        self.assertEqual((caught.exception.code, caught.exception.retryable), ('provider_refusal', False))
        attempts = []
        def handler(request):
            attempts.append(1)
            if len(attempts) == 1:
                raise httpx.DecodingError('bad gzip', request=request)
            return httpx.Response(200, json=provider_body({'ok': 1}))
        with httpx.Client(transport=httpx.MockTransport(handler)) as http:
            result = llm.complete_json(http, self.config, name='t', system='s', user={}, schema={},
                                       max_output_tokens=10, sleep=lambda _: None)
        self.assertEqual((result.data, result.tries), ({'ok': 1}, 2))

    def test_config_requires_explicit_enable_and_key(self):
        with self.assertRaises(llm.LLMError) as caught:
            llm.Config.from_env({})
        self.assertEqual(caught.exception.code, 'feedback_disabled')
        with self.assertRaises(llm.LLMError) as caught:
            llm.Config.from_env({'FEEDBACK_V3_ENABLED': 'true'})
        self.assertEqual(caught.exception.code, 'missing_api_key')
        config = llm.Config.from_env({**ENV, 'FEEDBACK_V3_REASONING_EFFORT': '', 'FEEDBACK_V3_TEMPERATURE': '0'})
        self.assertEqual((config.model, config.reasoning_effort, config.temperature), ('openai/gpt-6-luna', None, 0.0))


def fake_answer(kind, payload, level='competent'):
    if kind == 'slide':
        ids = [s['id'] for s in payload['speech']['sentences']]
        data = {'criteria': {c.id: {'level': level, 'reason': 'fits', 'evidence': ids[:1] + ['s999'],
                                    'next_level': 'connect the result to the next slide'}
                             for c in rubric.RUBRIC_V2.slide},
                'must_cover': [{'point': 'p', 'status': 'partial', 'evidence': ids[:1]}, {'point': 'x', 'status': 'bogus', 'evidence': []}],
                'strength': {'text': 'clear opening', 'evidence': ids[-1:]},
                'improvements': [{'criterion': 'explanation_depth', 'problem': 'no reason given',
                                  'action': 'say why it matters', 'example': 'This matters because...', 'evidence': ids[:1]},
                                 {'criterion': 'not_a_criterion', 'problem': 'x', 'action': 'y', 'example': '', 'evidence': []}]}
    else:
        data = {'criteria': {c.id: {'level': level, 'reason': 'fits', 'evidence': ['s0', 'm:pace'], 'next_level': 'n'}
                             for c in rubric.RUBRIC_V2.whole},
                'top_priorities': [{'title': 'Explain why', 'action': 'Add one reason per slide', 'why': 'clarity', 'slide_index': 1},
                                   {'title': 'bad index', 'action': 'a', 'why': 'w', 'slide_index': 99}],
                'summary': 'Solid rehearsal.'}
    return llm.Result(data, 100, 50, 0.4, 1)


@mock.patch.dict(os.environ, ENV)
class PipelineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.deck = Deck.objects.create(title='Demo', pdf='synthetic/demo.pdf', page_count=3)
        for index, text in enumerate(['OutLoud demo', 'Seoul population grew because of jobs',
                                      'Conclusion: three lessons for city planners about housing, transit and jobs']):
            Slide.objects.create(deck=self.deck, slide_index=index, image='synthetic/s.png', extracted_text=text)
        self.context = PresentationContext.objects.create(deck=self.deck, audience='Students', required_duration_seconds=60)
        words = (words_for('Hello everyone, welcome.', 0) + words_for('Seoul grew fast. Jobs drew people in.', 3000)
                 + words_for('So we learned three lessons today.', 20000))
        self.attempt = Attempt.objects.create(
            deck=self.deck, audio='synthetic/a.m4a', duration_ms=40000, status='completed', processing_state='completed',
            slide_events=[{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 3000}, {'slide_index': 2, 'at_ms': 20000}],
            transcript={'text': '', 'words': words})
        self.calls = []

    def fake(self, failing=()):
        def call(http, config, kind, payload, deadline=None):
            index = payload['slide']['index'] if kind == 'slide' else None
            self.calls.append((kind, index))
            if (kind, index) in failing:
                raise llm.LLMError('timeout', retryable=True)
            return fake_answer(kind, payload)
        return mock.patch.object(pipeline, 'call_llm', side_effect=call)

    def post(self, body=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(f'/api/attempts/{self.attempt.pk}/feedback-run/', body or {}, format='json')

    def get(self):
        return self.client.get(f'/api/attempts/{self.attempt.pk}/feedback-run/')

    def test_get_before_start_is_absent_and_never_starts_work(self):
        with self.fake():
            response = self.get()
        self.assertEqual(response.json(), {'status': 'absent', 'enabled': True})
        self.assertEqual((FeedbackRun.objects.count(), self.calls), (0, []))

    def test_full_run_scores_slides_and_presentation_in_code(self):
        with self.fake():
            self.post()
            body = self.get().json()
        self.assertEqual(body['status'], 'completed')
        self.assertEqual(sorted(self.calls, key=str), [('slide', 1), ('slide', 2), ('whole', None)])
        slides = {s['slide_index']: s for s in body['slides']}
        self.assertEqual(slides[0]['status'], 'not_applicable')  # Short title slide, first position.
        self.assertEqual((slides[1]['status'], slides[1]['score']), ('scored', 67))
        evidence = slides[1]['criteria'][0]['evidence']
        self.assertEqual([e['id'] for e in evidence], ['s1'])  # Unknown id s999 dropped, not fatal.
        self.assertEqual((evidence[0]['start_ms'], evidence[0]['text']), (3000, 'Seoul grew fast.'))
        self.assertEqual(slides[1]['must_cover'], [{'point': 'p', 'status': 'partial', 'evidence': evidence}])
        improvement, = slides[1]['improvements']
        self.assertEqual((improvement['gain_slide_points'], improvement['gain_overall_points']), (11.7, 4.1))
        self.assertEqual(body['scores']['overall'], 67)
        self.assertEqual(body['scores']['overall_level'], 'competent')
        self.assertEqual(body['whole']['top_priorities'][1]['slide_index'], None)
        self.assertEqual(body['progress'], {'slides_total': 2, 'slides_done': 2, 'whole_done': True})
        self.assertEqual(body['measurements']['target_seconds'], 60)

    def test_payloads_carry_language_audience_measurements_and_sentence_ids(self):
        with self.fake():
            self.post()
        run = FeedbackRun.objects.get()
        inputs = pipeline.load_inputs(self.attempt, self.context, run.model)
        payload = pipeline.slide_payload(inputs, 1)
        self.assertEqual(payload['presentation']['audience'], 'Students')
        self.assertEqual(payload['presentation']['language'], 'en')
        self.assertEqual([s['id'] for s in payload['speech']['sentences']], ['s1', 's2'])
        whole = pipeline.whole_payload(inputs)
        self.assertIn('m:pace', [m['id'] for m in whole['measurements']])

    def test_failed_slide_keeps_other_results_and_retry_reruns_only_it(self):
        with self.fake(failing={('slide', 2)}):
            self.post()
        body = self.get().json()
        self.assertEqual(body['status'], 'completed')
        slides = {s['slide_index']: s for s in body['slides']}
        self.assertEqual((slides[1]['status'], slides[2]['status'], slides[2]['error']), ('scored', 'failed', 'timeout'))
        self.assertIsNone(body['scores']['overall'])
        self.assertEqual(body['scores']['withheld'], [{'reason': 'slides_not_scored', 'slides': [2]}])
        self.calls.clear()
        with self.fake():
            self.post({'retry': True})
        self.assertEqual(self.calls, [('slide', 2)])
        self.assertEqual(self.get().json()['scores']['overall'], 67)
        self.assertEqual(FeedbackRun.objects.count(), 1)

    def test_all_parts_failing_marks_the_run_failed(self):
        with self.fake(failing={('slide', 1), ('slide', 2), ('whole', None)}):
            self.post()
        body = self.get().json()
        self.assertEqual((body['status'], body['error']['code'], body['error']['detail']), ('failed', 'all_parts_failed', 'timeout'))

    def test_same_inputs_reuse_the_run_and_changed_inputs_create_a_new_one(self):
        with self.fake():
            first = self.post().json()
            again = self.post().json()
            self.assertEqual(first['run_id'], again['run_id'])
            self.context.audience, self.context.revision = 'Engineers', 1
            self.context.save()
            changed = self.post().json()
        self.assertNotEqual(changed['run_id'], first['run_id'])
        self.assertEqual(len([c for c in self.calls if c[0] == 'whole']), 2)

    def test_unvisited_slide_withholds_the_overall_score(self):
        self.attempt.slide_events = [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 3000}]
        self.attempt.save()
        with self.fake():
            self.post()
        body = self.get().json()
        slides = {s['slide_index']: s for s in body['slides']}
        self.assertEqual(slides[2]['status'], 'not_recorded')
        self.assertIn({'reason': 'slides_not_scored', 'slides': [2]}, body['scores']['withheld'])

    def test_inputs_changed_before_the_worker_starts_mark_the_run_stale(self):
        with mock.patch.object(pipeline, 'publish'):
            response = self.post()
        self.context.audience = 'Changed'
        self.context.save()
        with self.fake(), mock.patch.object(pipeline, 'publish'):
            pipeline.run(response.json()['run_id'])
        self.assertEqual(FeedbackRun.objects.get(pk=response.json()['run_id']).status, 'stale')
        self.assertEqual(self.calls, [])  # No paid call for outdated inputs.

    def test_zero_length_visits_leave_the_skipped_slide_unvisited(self):
        speech = transcript.build(words_for('one two three', 0), [{'slide_index': 0, 'at_ms': 0},
                                  {'slide_index': 1, 'at_ms': 0}], 3000, [])
        self.assertEqual((list(speech.slides), speech.slides[1].visit_ms), ([1], [(0, 3000)]))


        self.attempt.status = 'processing'
        self.attempt.save()
        response = self.post()
        self.assertEqual((response.status_code, response.json()['error']['code']), (409, 'transcript_not_ready'))
        with mock.patch.dict(os.environ, {'FEEDBACK_V3_ENABLED': 'false'}):
            response = self.post()
        self.assertEqual(response.json()['error']['code'], 'feedback_disabled')
        self.assertEqual(self.client.post(f'/api/attempts/{self.attempt.pk}/feedback-run/', {'bad': 1},
                                          format='json').status_code, 400)
        response = self.client.get(f'/api/attempts/{self.attempt.pk}/feedback-run/?context_id=not-a-uuid')
        self.assertEqual((response.status_code, response.json()['error']['code']), (400, 'invalid_context'))

    def test_recovery_requeues_dead_workers_then_gives_up(self):
        with mock.patch.object(pipeline, 'publish'):
            run_id = self.post().json()['run_id']
        old = timezone.now() - timedelta(seconds=pipeline.STALE_SECONDS + 5)
        FeedbackRun.objects.filter(pk=run_id).update(status='running', heartbeat_at=old, worker_attempts=1)
        with mock.patch.object(pipeline, 'publish') as publish:
            pipeline.recover()
        publish.assert_called_once()
        self.assertEqual(FeedbackRun.objects.get().status, 'queued')
        FeedbackRun.objects.filter(pk=run_id).update(status='running', heartbeat_at=old,
                                                     worker_attempts=pipeline.MAX_WORKER_ATTEMPTS)
        pipeline.recover()
        run = FeedbackRun.objects.get()
        self.assertEqual((run.status, run.error['code']), ('failed', 'worker_lost'))

    def profile(self, **extra):
        slides = [{'slide_index': i, 'slide_kind': kind, 'summary': {'text': f'summary {i}', 'uncertain': False},
                   'key_ideas': [{'text': 'idea', 'uncertain': False}, {'text': 'unsure', 'uncertain': True}],
                   'visual_facts': [], 'must_cover': [{'text': f'must {i}', 'evidence_refs': ['summary']}]}
                  for i, kind in enumerate(['title', 'content', 'closing'])]
        values = dict(deck=self.deck, source_fingerprint='f', provider='openrouter', project_id='p',
                      model='m', prompt_version='slide-profile-v5', schema_version='slide-profile-v5',
                      source_snapshot={}, prompt_digest='d', input_hash='h', descriptions={'slides': slides})
        values.update(extra)
        return DescriptionSet.objects.create(**values)

    def test_profile_comes_from_slide_profile_sets_not_coaching_sets(self):
        self.profile()
        self.profile(schema_version='descriptions-v1', prompt_version='descriptions-v1', source_fingerprint='g',
                     descriptions={'slides': [{'slide_index': 1, 'summary': {'text': 'coaching', 'uncertain': False}}]})
        inputs = pipeline.load_inputs(self.attempt, self.context, 'm')
        self.assertEqual((inputs.slides[1]['must_cover'], inputs.slides[1]['key_ideas'], inputs.slides[2]['kind']),
                         (['must 1'], ['idea'], 'closing'))
        self.assertEqual(pipeline.plan_slide(inputs, 2), 'not_applicable')  # Closing profile, last slide.

    def test_retry_that_fails_again_keeps_the_run_completed(self):
        with self.fake(failing={('slide', 2)}):
            self.post()
            self.post({'retry': True})
        body = self.get().json()
        self.assertEqual((body['status'], body['error']), ('completed', None))
        self.assertEqual(body['whole']['status'], 'scored')

    def test_slide_evidence_cannot_cite_another_slides_sentences(self):
        def call(http, config, kind, payload, deadline=None):
            answer = fake_answer(kind, payload)
            if kind == 'slide' and payload['slide']['index'] == 1:
                answer.data['criteria']['essential_coverage']['evidence'] = ['s3', 's1']  # s3 is slide 2.
            return answer
        with mock.patch.object(pipeline, 'call_llm', side_effect=call):
            self.post()
        slide = {s['slide_index']: s for s in self.get().json()['slides']}[1]
        self.assertEqual([e['id'] for e in slide['criteria'][0]['evidence']], ['s1'])

    def test_whole_delivery_can_cite_measurements(self):
        with self.fake():
            self.post()
        evidence = self.get().json()['whole']['criteria'][3]['evidence']
        self.assertEqual([(e['kind'], e['id']) for e in evidence], [('speech', 's0'), ('measurement', 'm:pace')])

    def test_unexpected_output_shapes_never_raise(self):
        sentences = {}
        for value in (1, 2.5, True, 'x', None, {}):
            slide = pipeline.normalize_slide({'criteria': value, 'must_cover': value, 'improvements': value,
                                              'strength': value}, sentences)
            whole = pipeline.normalize_whole({'criteria': value, 'top_priorities': value, 'summary': value},
                                             sentences, 3)
            self.assertEqual((slide['status'], whole['status']), ('insufficient_evidence', 'insufficient_evidence'))
        odd = pipeline.normalize_slide({'improvements': [{'criterion': ['x'], 'action': 'a'}, {'criterion': {}}],
                                        'criteria': {'essential_coverage': {'level': ['advanced'], 'evidence': 's1'}}},
                                       sentences)
        self.assertEqual((odd['improvements'], odd['criteria'][0]['level']), ([], None))

    def test_stale_runs_are_replaced_not_reused(self):
        with mock.patch.object(pipeline, 'publish'):
            run_id = self.post().json()['run_id']
        self.context.audience = 'Changed'
        self.context.save()
        with mock.patch.object(pipeline, 'publish'):
            pipeline.run(run_id)
        runs = list(FeedbackRun.objects.order_by('created_at'))
        self.assertEqual([r.status for r in runs], ['stale', 'queued'])
        self.context.audience = 'Students'
        self.context.save()
        with self.fake():
            fresh = self.post().json()
            current = self.get().json()
        self.assertNotIn(fresh['run_id'], [str(r.pk) for r in runs])
        self.assertEqual((current['run_id'], current['status']), (fresh['run_id'], 'completed'))

    def test_recovery_republishes_lost_queue_messages_and_duplicates_are_ignored(self):
        with mock.patch.object(pipeline, 'publish'):
            run_id = self.post().json()['run_id']
        FeedbackRun.objects.filter(pk=run_id).update(queued_at=timezone.now() - timedelta(seconds=200))
        with mock.patch.object(pipeline, 'publish') as publish:
            pipeline.recover()
            pipeline.recover()  # queued_at was refreshed, so no second publish yet.
        publish.assert_called_once()
        with self.fake():
            pipeline.run(run_id)
            pipeline.run(run_id)  # Duplicate delivery: nothing to claim.
        self.assertEqual(len([c for c in self.calls if c[0] == 'whole']), 1)

    def test_korean_run_with_profile_passes_must_cover_and_language(self):
        self.profile()
        self.attempt.transcript = {'text': '', 'words': words_for('안녕하세요 여러분.', 0)
                                   + words_for('서울은 일자리 때문에 빠르게 성장했습니다.', 3000)
                                   + words_for('정리하면 세 가지 교훈이 있습니다 감사합니다.', 20000)}
        self.attempt.save()
        payloads = []
        def call(http, config, kind, payload, deadline=None):
            payloads.append((kind, payload))
            return fake_answer(kind, payload)
        with mock.patch.object(pipeline, 'call_llm', side_effect=call):
            self.post()
        body = self.get().json()
        slide_payload = next(p for k, p in payloads if k == 'slide')
        self.assertEqual((slide_payload['presentation']['language'], slide_payload['slide']['must_cover']),
                         ('ko', ['must 1']))
        self.assertEqual((body['language'], body['measurements']['rate']), ('ko', None))  # Under 5 s of speech.
        self.assertEqual(body['scores']['overall'], 67)  # Slides 0 and 2 are title/closing: not graded.

    def test_auto_start_skips_audience_qa_answers(self):
        profile = self.profile()
        analysis = FeedbackAnalysis.objects.create(attempt=self.attempt, analysis_type='qa_x')
        job = FeedbackJob.objects.create(analysis=analysis, generation=1, description_set=profile,
                                         description_generation=1, source_snapshot={}, prompt_version='v',
                                         schema_version='s', prompt_digest='d', queued_at=timezone.now())
        QaAnswer.objects.create(attempt=self.attempt, question_job=job, question_id='q1', part=0)
        with mock.patch.dict(os.environ, {'FEEDBACK_V3_AUTO_START': 'true'}), mock.patch.object(pipeline, 'publish'):
            pipeline.auto_start(self.attempt.pk)
        self.assertEqual(FeedbackRun.objects.count(), 0)

    def test_failed_run_post_returns_200_not_202(self):
        with self.fake(failing={('slide', 1), ('slide', 2), ('whole', None)}):
            self.post()
            response = self.post()
        self.assertEqual((response.status_code, response.json()['status']), (200, 'failed'))

    def test_auto_start_is_off_by_default_and_never_raises(self):
        pipeline.auto_start(self.attempt.pk)
        self.assertEqual(FeedbackRun.objects.count(), 0)
        with mock.patch.dict(os.environ, {'FEEDBACK_V3_AUTO_START': 'true'}), \
                mock.patch.object(pipeline, 'publish'):
            pipeline.auto_start(self.attempt.pk)
            self.attempt.status = 'processing'
            self.attempt.save()
            pipeline.auto_start(self.attempt.pk)  # Logged and skipped, not raised.
        self.assertEqual(FeedbackRun.objects.get().context, self.context)
