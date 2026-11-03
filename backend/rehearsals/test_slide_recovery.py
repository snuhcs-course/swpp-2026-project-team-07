"""Issue #49 recovery over synthetic saved reviews; no live provider calls."""
# OpenAI Codex: docs/ai-collaboration-prompts-iteration-2.md, issue #49.
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import json
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from .models import FeedbackJob, FeedbackRequest
from .services import coaching, descriptions, feedback_provider as provider, slide_profiles, slide_review
from .test_coaching import SyntheticCoaching
from .test_descriptions import description_value


class SyntheticSlideRecovery(SyntheticCoaching):
    def setUp(self):
        super().setUp()
        self.url = f'/api/attempts/{self.attempt.pk}/slide-review/'
        self.scope = {'context_id': None, 'slides': [{'slide_index': 0, 'segments': [
            {'start_ms': 0, 'end_ms': 1000}, {'start_ms': 1000, 'end_ms': 2000}]}]}

    def complete_review(self, status='invalid_evidence'):
        value = slide_profiles.ensure(self.deck.pk)
        def profiles(prepared):
            output = description_value(prepared.analysis)
            for slide in output['slides']:
                slide.update(slide_kind='content', must_cover=[], go_deeper=[])
            return self.coaching_receipt(prepared, output=output)
        with patch.object(provider, 'request_raw', side_effect=profiles):
            descriptions.run_description(value.pk, value.processing_revision)
        owner = coaching.generate(self.attempt.pk, {}, slide_review.analysis_type(self.scope), self.scope)
        def review(prepared):
            findings = []
            if status in {'invalid_evidence', 'partial'}:
                findings.append(self.card(prepared, category='content', priority=1, speech_quote='invented'))
            if status == 'model_error':
                findings.append(self.card(prepared, category='content', priority=1, observation=''))
            if status == 'partial':
                findings.append(self.card(prepared, category='repetition', priority=2,
                    description_ref='', slide_quote=''))
            return self.coaching_receipt(prepared, output={
                'evaluation_mode': 'informative_descriptive', 'slides': [{
                    'slide_index': 0, 'status': 'insufficient_evidence' if status == 'insufficient_evidence' else 'successful',
                    'findings': findings, 'enrichments': []}]})
        with patch.object(provider, 'request_raw', side_effect=review):
            self.execute_feedback(owner)
        job = self.job(owner)
        self.assertEqual(job.state, 'completed')
        self.assertEqual(job.result['slides'][0]['status'], status)
        return job

    def state(self):
        response = self.client.get(self.url, {'scope': json.dumps(self.scope)})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def retry(self, state, **changes):
        return self.client.post(self.url, {'scope': self.scope,
            'feedback_revision': state['feedback_revision'], 'expected_selection': state['selection']['token'],
            'transcript_revision': state['transcript_revision'], **changes}, content_type='application/json')


class SlideRecoveryTests(SyntheticSlideRecovery, TestCase):
    def test_invalid_completion_retries_explicitly_once_and_preserves_receipt(self):
        job = self.complete_review()
        original = deepcopy(job.result), deepcopy(job.source_snapshot)
        receipt = FeedbackRequest.objects.filter(coaching_job=job).values().get()
        state = self.state()
        self.assertEqual(state['state'], 'completed')
        self.assertTrue(state['retry_available'])
        self.assertEqual(state['error']['code'], 'review_invalid_evidence')
        no_revision = self.client.post(self.url, {'scope': self.scope}, content_type='application/json')
        self.assertEqual(no_revision.status_code, 200)
        self.assertEqual(no_revision.json()['feedback_revision'], state['feedback_revision'])
        with patch.object(provider, 'request_raw') as call:
            response = self.retry(state)
            self.assertEqual(response.status_code, 202)
            current = response.json()
            self.assertEqual(current['feedback_revision'], state['feedback_revision'] + 1)
            self.assertEqual(self.retry(state).status_code, 409)
            self.assertEqual(self.retry(current).json()['feedback_revision'], current['feedback_revision'])
            call.assert_not_called()
        self.assertEqual(FeedbackJob.objects.filter(analysis=job.analysis).count(), 2)
        job.refresh_from_db()
        self.assertEqual((job.result, job.source_snapshot), original)
        self.assertEqual(FeedbackRequest.objects.filter(coaching_job=job).values().get(), receipt)

    def test_model_error_and_missing_summary_are_visible_and_recoverable(self):
        job = self.complete_review('model_error')
        self.assertEqual(self.state()['error']['code'], 'review_model_error')
        self.assertTrue(self.state()['retry_available'])
        job.result['slides'] = []
        job.save(update_fields=['result'])
        original = deepcopy(job.result)
        state = self.state()
        self.assertEqual(state['error']['code'], 'review_summary_missing')
        self.assertIsNone(state['result'])
        self.assertTrue(state['retry_available'])
        self.assertEqual(self.retry(state).status_code, 202)
        job.refresh_from_db()
        self.assertEqual(job.result, original)

    def test_usable_partial_and_insufficient_results_are_not_retryable(self):
        job = self.complete_review('partial')
        self.assertFalse(self.state()['retry_available'])
        self.assertEqual(len(self.state()['result']['slides'][0]['findings']), 1)
        for status in ('successful', 'insufficient_evidence'):
            job.result['slides'][0].update(status=status, findings=[])
            job.save(update_fields=['result'])
            state = self.state()
            self.assertFalse(state['retry_available'])
            self.assertIsNone(state['error'])
            self.assertEqual(self.retry(state).json()['feedback_revision'], job.generation)
        self.assertEqual(FeedbackJob.objects.filter(analysis=job.analysis).count(), 1)

    def test_missing_summary_stays_hidden_while_retry_is_queued(self):
        job = self.complete_review()
        job.result['slides'] = []
        job.save(update_fields=['result'])
        original = deepcopy(job.result), deepcopy(job.source_snapshot)
        receipt = FeedbackRequest.objects.filter(coaching_job=job).values().get()
        response = self.retry(self.state())
        self.assertEqual(response.status_code, 202)
        for state in (response.json(), self.state()):
            self.assertEqual(state['state'], 'queued')
            self.assertIsNone(state['result'])
            self.assertIsNone(state['error'])
            self.assertFalse(state['retry_available'])
            self.assertEqual(state['scope'], self.scope)
        job.refresh_from_db()
        self.assertEqual((job.result, job.source_snapshot), original)
        self.assertEqual(FeedbackRequest.objects.filter(coaching_job=job).values().get(), receipt)

    def test_recovery_keeps_cooldown_and_uncertainty_guards(self):
        job = self.complete_review()
        job.retry_at = timezone.now() + timedelta(minutes=2)
        job.save(update_fields=['retry_at'])
        state = self.state()
        self.assertFalse(state['retry_available'])
        self.assertEqual(self.retry(state).json()['error']['code'], 'retry_not_available')
        job.retry_at = None
        job.save(update_fields=['retry_at'])
        FeedbackRequest.objects.filter(coaching_job=job).update(outcome='uncertain')
        state = self.state()
        self.assertTrue(state['requires_confirmation'])
        self.assertEqual(self.retry(state).json()['error']['code'], 'confirmation_required')
        self.assertEqual(self.retry(state, acknowledge_uncertain=True).status_code, 202)

    def test_recovery_keeps_selection_revision_and_transcript_guards(self):
        job = self.complete_review()
        state = self.state()
        self.assertEqual(self.retry(state, expected_selection='0' * 64).json()['error']['code'], 'selection_mismatch')
        self.assertEqual(self.retry(state, feedback_revision=0).json()['error']['code'], 'stale_revision')
        self.assertEqual(self.retry(state, transcript_revision=1).json()['error']['code'], 'correction_conflict')
        self.assertEqual(FeedbackJob.objects.filter(analysis=job.analysis).count(), 1)

    def test_failed_retry_and_changed_source_preserve_original_generation(self):
        job = self.complete_review()
        original = deepcopy(job.source_snapshot)
        job.state = 'failed'
        job.error_code = 'provider_timeout'
        job.save(update_fields=['state', 'error_code'])
        state = self.state()
        self.assertTrue(state['retry_available'])
        self.attempt.upload_hash = 'f' * 64
        self.attempt.save(update_fields=['upload_hash'])
        self.assertEqual(self.retry(state).json()['error']['code'], 'source_changed')
        self.attempt.upload_hash = ''
        self.attempt.save(update_fields=['upload_hash'])
        self.assertEqual(self.retry(self.state()).status_code, 202)
        job.refresh_from_db()
        self.assertEqual(job.source_snapshot, original)
        self.assertEqual(job.state, 'failed')

    def test_recovery_predicate_excludes_other_analyses_and_malformed_scopes(self):
        job = self.complete_review()
        self.assertEqual(slide_review.recovery_error(job), 'review_invalid_evidence')
        job.analysis.analysis_type = 'coaching'
        self.assertIsNone(slide_review.recovery_error(job))
        job.analysis.analysis_type = slide_review.analysis_type(self.scope)
        job.source_snapshot['slide_review']['scope']['slides'].append(deepcopy(self.scope['slides'][0]))
        self.assertIsNone(slide_review.recovery_error(job))


@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL row locks required')
class SlideRecoveryRaces(SyntheticSlideRecovery, TransactionTestCase):
    def test_concurrent_retries_admit_one_generation(self):
        job = self.complete_review()
        state = self.state()
        fence = Barrier(2)
        attempt_id, scope = self.attempt.pk, deepcopy(self.scope)
        payload = {'feedback_revision': state['feedback_revision'],
            'expected_selection': state['selection']['token'], 'transcript_revision': state['transcript_revision']}
        def retry():
            connections.close_all()
            try:
                fence.wait(timeout=10)
                try:
                    owner = coaching.generate(attempt_id, payload, slide_review.analysis_type(scope), scope)
                    return owner.feedback_revision
                except descriptions.Conflict as error:
                    return error.code
            finally:
                connections.close_all()
        with patch.object(provider, 'request_raw') as call, ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: retry(), range(2)))
            call.assert_not_called()
        self.assertCountEqual(results, [job.generation + 1, 'stale_revision'])
        self.assertEqual(FeedbackJob.objects.filter(analysis=job.analysis).count(), 2)
