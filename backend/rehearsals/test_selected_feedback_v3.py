"""Synthetic selected-run score tests. No external provider requests."""
from copy import deepcopy
import os
from unittest import mock
from uuid import UUID

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .feedback_v3 import llm, pipeline
from .models import (
    Attempt, Deck, DescriptionSet, FeedbackAnalysis, FeedbackJob, FeedbackRun, PresentationContext,
    QaAnswer, Slide, TranscriptCorrection,
)
from .test_feedback_v3 import ENV, fake_answer, words_for


@mock.patch.dict(os.environ, ENV)
@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class SelectedFeedbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.deck = Deck.objects.create(title='Selected rehearsal', pdf='synthetic/selected.pdf', page_count=3)
        for index in range(self.deck.page_count):
            Slide.objects.create(deck=self.deck, slide_index=index, image='synthetic/slide.png',
                                 extracted_text='Enough slide text here to require a score on this slide')
        self.context = PresentationContext.objects.create(deck=self.deck, audience='Students', required_duration_seconds=60)
        self.anchor = self.make_attempt(1, 9000, [(0, 0), (1, 2000), (2, 4000), (0, 7000)],
                                        [(0, 'Start with the first idea.'), (2000, 'Excluded original draft stays unselected.'),
                                         (4000, 'End with the verified conclusion.'), (7000, 'Revisit that first main idea.')])
        self.retake = self.make_attempt(2, 4000, [(2, 0), (1, 1000)],
                                        [(0, 'Excluded retake lead.'), (1000, 'New example explains the result.')])
        self.scope = {
            'context_id': str(self.context.pk),
            'slides': [self.item(0, self.anchor, [(0, 2000), (7000, 9000)]),
                       self.item(1, self.retake, [(1000, 4000)]),
                       self.item(2, self.anchor, [(4000, 7000)])],
        }
        self.calls = []

    def make_attempt(self, pk, duration, events, speech):
        return Attempt.objects.create(
            pk=UUID(int=pk), deck=self.deck, audio=f'synthetic/take-{pk}.m4a', duration_ms=duration,
            status='completed', processing_state='completed',
            slide_events=[{'slide_index': index, 'at_ms': at} for index, at in events],
            transcript={'text': ' '.join(text for _, text in speech),
                        'words': [w for start, text in speech for w in words_for(text, start, step=250, length=180)]},
        )

    @staticmethod
    def item(slide, attempt, visits):
        return {'slide_index': slide, 'attempt_id': str(attempt.pk),
                'segments': [{'start_ms': start, 'end_ms': end} for start, end in visits]}

    def endpoint(self, run_id=None, anchor=None):
        base = f'/api/attempts/{(anchor or self.anchor).pk}/selected-feedback-run/'
        return f'{base}{run_id}/' if run_id else base

    def post(self, scope=None, *, retry=False, anchor=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.endpoint(anchor=anchor),
                                    {'scope': self.scope if scope is None else scope, 'retry': retry}, format='json')

    def assessor(self, failed=None):
        def call(_http, _config, kind, payload, deadline=None):
            index = payload['slide']['index'] if kind == 'slide' else None
            self.calls.append((kind, index, payload))
            if failed is not None and failed == index:
                raise llm.LLMError('timeout')
            answer = fake_answer(kind, payload, 'competent' if kind == 'slide' else 'advanced')
            if kind == 'whole':
                evidence = [s['id'] for s in payload['speech']]
                for row in answer.data['criteria'].values():
                    row['evidence'] = evidence
            return answer
        return mock.patch.object(pipeline, 'call_llm', side_effect=call)

    def test_selected_audio_is_scored_in_playback_order_and_keeps_original_evidence(self):
        supplied = {**self.scope, 'slides': list(reversed(self.scope['slides']))}
        with self.assessor():
            admitted = self.post(supplied)
            self.assertEqual(admitted.status_code, 202, admitted.data)
            run_id = admitted.data['run_id']
            result = self.client.get(self.endpoint(run_id)).data
        self.assertEqual(result['scope'], self.scope)
        self.assertEqual(result['attempt_id'], str(self.anchor.pk))
        self.assertEqual(result['scores']['overall'], 77)  # 70% × 66⅔ + 30% × 100.
        self.assertEqual(result['measurements']['total_seconds'], 10.0)
        self.assertFalse(result['outdated'])
        whole = next(payload for kind, _, payload in self.calls if kind == 'whole')
        self.assertEqual([sentence['text'] for sentence in whole['speech']],
                         ['Start with the first idea.', 'Revisit that first main idea.',
                          'New example explains the result.', 'End with the verified conclusion.'])
        evidence = result['whole']['criteria'][0]['evidence']
        self.assertEqual([(e['attempt_id'], e['start_ms']) for e in evidence],
                         [(str(self.anchor.pk), 0), (str(self.anchor.pk), 7000),
                          (str(self.retake.pk), 1000), (str(self.anchor.pk), 4000)])
        self.assertEqual(result['slides'][1]['criteria'][0]['evidence'][0]['attempt_id'], str(self.retake.pk))

    def test_legacy_route_and_other_selections_do_not_share_a_selected_score(self):
        with self.assessor():
            run_id = self.post().data['run_id']
            self.assertEqual(self.post().data['run_id'], run_id)
            regular = self.client.get(f'/api/attempts/{self.anchor.pk}/feedback-run/').data
            self.assertEqual(regular['status'], 'absent')
            other_scope = {**self.scope, 'context_id': None}
            second_id = self.post(other_scope).data['run_id']
            other = self.client.get(self.endpoint(second_id)).data
        self.assertNotEqual(second_id, run_id)
        self.assertIsNone(other['context_id'])
        self.assertIsNone(other['scope']['context_id'])
        self.assertEqual(self.client.get(self.endpoint(run_id, anchor=self.retake)).status_code, 404)
        self.assertEqual(FeedbackRun.objects.count(), 2)

    def test_pending_upload_and_invalid_selection_do_not_queue_provider_work(self):
        clipped = deepcopy(self.scope)
        clipped['slides'][1]['segments'][0]['start_ms'] += 1
        foreign = self.make_attempt(3, 4000, [(1, 0)], [(0, 'Foreign deck recording has words.')])
        foreign.deck = Deck.objects.create(title='Other', pdf='synthetic/other.pdf', page_count=3)
        foreign.save(update_fields=['deck'])
        wrong_deck = deepcopy(self.scope)
        wrong_deck['slides'][1] = self.item(1, foreign, [(0, 4000)])
        with self.assessor():
            for scope in (clipped, wrong_deck):
                response = self.post(scope)
                self.assertEqual((response.status_code, response.data['error']['code']), (400, 'invalid_request'))
            self.assertEqual(self.post(anchor=self.retake).status_code, 400)
            self.retake.status = 'processing'
            self.retake.save(update_fields=['status'])
            response = self.post()
        self.assertEqual((response.status_code, response.data['error']['code']), (409, 'transcript_not_ready'))
        self.assertEqual(list(FeedbackRun.objects.all()), [])
        self.assertEqual(self.calls, [])

    def test_retry_runs_only_failed_part_and_changed_transcript_makes_old_score_outdated(self):
        with self.assessor(failed=1):
            run_id = self.post().data['run_id']
        first = self.client.get(self.endpoint(run_id)).data
        self.assertIsNone(first['scores']['overall'])
        self.calls.clear()
        with self.assessor():
            self.assertEqual(self.post(retry=True).data['run_id'], run_id)
            self.assertEqual(self.client.get(self.endpoint(run_id)).data['scores']['overall'], 77)
        self.assertEqual([(kind, index) for kind, index, _ in self.calls], [('slide', 1)])
        self.retake.transcript['words'][-1]['text'] = 'outcome.'
        self.retake.save(update_fields=['transcript'])
        with self.assessor():
            self.assertTrue(self.client.get(self.endpoint(run_id)).data['outdated'])
            self.calls.clear()
            replacement = self.post().data['run_id']
            self.assertNotEqual(run_id, replacement)
        self.assertEqual({(kind, index) for kind, index, _ in self.calls}, {('slide', 1), ('whole', None)})

    def test_new_selection_and_anchor_reuse_only_unchanged_slide_parts(self):
        with self.assessor():
            previous_id = self.post().data['run_id']
        new_take = self.make_attempt(0, 4000, [(2, 0), (1, 1000)],
                                     [(0, 'Excluded retake lead.'), (1000, 'New example explains the result.')])
        new_scope = deepcopy(self.scope)
        new_scope['slides'][1] = self.item(1, new_take, [(1000, 4000)])
        self.calls.clear()
        with self.assessor():
            new_id = self.post(new_scope, anchor=new_take).data['run_id']
        self.assertNotEqual(new_id, previous_id)
        self.assertEqual({(kind, index) for kind, index, _ in self.calls}, {('slide', 1), ('whole', None)})
        result = self.client.get(self.endpoint(new_id, anchor=new_take)).data
        self.assertEqual(result['scores']['overall'], 77)
        self.assertEqual(result['slides'][1]['criteria'][0]['evidence'][0]['attempt_id'], str(new_take.pk))

    def test_selected_scope_rejects_question_answer_recording(self):
        analysis = FeedbackAnalysis.objects.create(attempt=self.anchor, analysis_type='qa_fixture')
        description = DescriptionSet.objects.create(deck=self.deck, source_snapshot={})
        job = FeedbackJob.objects.create(analysis=analysis, generation=1, description_set=description,
                                         description_generation=1, source_snapshot={}, queued_at=timezone.now())
        QaAnswer.objects.create(attempt=self.retake, question_job=job, question_id='question', part=0)
        with self.assessor():
            response = self.post()
        self.assertEqual((response.status_code, response.data['error']['code']), (400, 'invalid_request'))
        self.assertFalse(FeedbackRun.objects.exists())
        self.assertEqual(self.calls, [])

    def test_stale_corrections_fail_closed_for_a_selected_source(self):
        with self.assessor():
            run_id = self.post().data['run_id']
        self.calls.clear()
        TranscriptCorrection.objects.create(attempt=self.retake, base_transcript_id='a' * 64)
        with self.assessor():
            self.assertTrue(self.client.get(self.endpoint(run_id)).data['outdated'])
            response = self.post()
        self.assertEqual((response.status_code, response.data['error']['code']), (409, 'transcript_source_changed'))
        self.assertEqual(FeedbackRun.objects.count(), 1)
        self.assertEqual(self.calls, [])

    def test_selected_stale_partial_result_stays_readable_until_explicit_update(self):
        with mock.patch.object(pipeline, 'publish'):
            run_id = self.post().data['run_id']
        FeedbackRun.objects.filter(pk=run_id).update(result={'slides': {'0': {'status': 'failed'}}})
        self.retake.transcript['words'][-1]['text'] = 'outcome.'
        self.retake.save(update_fields=['transcript'])
        with self.assessor(), mock.patch.object(pipeline, 'publish') as publish:
            pipeline.run(run_id)
            result = self.client.get(self.endpoint(run_id)).data
            publish.assert_not_called()
        self.assertEqual((result['status'], result['outdated']), ('stale', True))
        self.assertEqual(FeedbackRun.objects.count(), 1)
        self.assertEqual(self.calls, [])
        with self.assessor():
            replacement_id = self.post().data['run_id']
        self.assertNotEqual(run_id, replacement_id)
        self.assertEqual(self.client.get(self.endpoint(replacement_id)).data['scores']['overall'], 77)

    def test_incomplete_selected_coverage_withholds_whole_using_existing_rules(self):
        scope = {**self.scope, 'slides': self.scope['slides'][:2]}
        with self.assessor():
            run_id = self.post(scope).data['run_id']
        result = self.client.get(self.endpoint(run_id)).data
        self.assertIsNone(result['scores']['overall'])
        self.assertEqual(result['whole']['reason'], 'presentation_incomplete')
        self.assertNotIn('whole', {kind for kind, _, _ in self.calls})
