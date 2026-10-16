"""Score lifecycle through the existing worker; synthetic evidence and blocked network."""
from copy import deepcopy
from datetime import timedelta
import json
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from .models import FeedbackAnalysis, FeedbackJob, FeedbackRequest, PresentationContext
from .services import coaching, feedback_provider as provider, presentation_scoring as scoring
from .services.feedback import FeedbackError
from .test_coaching import SyntheticCoaching
from . import test_presentation_scoring as transport_tests
from .test_presentation_score_v2 import output, set_level


class PresentationScoreLifecycleTests(SyntheticCoaching, TestCase):
    complete = transport_tests.PresentationScoringTests.complete
    post_score = transport_tests.PresentationScoringTests.post_score

    def setUp(self):
        super().setUp()
        self.url = f'/api/attempts/{self.attempt.pk}/presentation-score/'
        self.measurements = {'version': 'presentation-measurements-v1', 'status': 'available',
            'audio_hash': 'a' * 64, 'attempt_id': str(self.attempt.pk), 'duration_ms': 2000,
            'items': [{'id': 'speech_0', 'kind': 'speech', 'start_ms': 100, 'end_ms': 1500,
                       'value': 1400, 'unit': 'ms'}], 'limitations': ['Synthetic audio measurements.']}
        self.level = 'advanced'

    def owner(self):
        return FeedbackAnalysis.objects.get(attempt=self.attempt, analysis_type__startswith='score_')

    def score_receipt(self, prepared):
        owner = self.owner()
        job = self.job(owner)
        bundle = scoring._bundle(job.description_set, job,
            job.source_snapshot['presentation_score']['measurements'])
        raw = output(bundle)
        if self.level != 'advanced':
            set_level(raw, self.level)
        return self.coaching_receipt(prepared, output=raw)

    def execute_score(self, owner):
        with patch('rehearsals.services.presentation_measurements.measure_audio',
                   return_value=deepcopy(self.measurements)) as measure, \
             patch.object(provider, 'request_raw', side_effect=self.score_receipt) as call:
            coaching.run_coaching(owner.pk, owner.feedback_revision)
        return measure.call_count, call.call_count

    def test_absent_and_current_responses_include_frozen_requirement_contract(self):
        before = self.client.get(self.url)
        self.assertEqual(before.status_code, 200)
        self.assertEqual(before.json()['requirements'], {'context_id': None, 'revision': None,
            'audience': '', 'required_duration_seconds': None})
        self.complete()
        self.assertEqual(self.post_score().status_code, 202)
        self.assertEqual(self.client.get(self.url).json()['requirements'], before.json()['requirements'])

    def test_successful_worker_is_one_request_and_read_or_duplicate_post_never_regenerates(self):
        self.complete()
        self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner()
        self.assertEqual(self.execute_score(owner), (1, 1))
        state = self.client.get(self.url).json()
        self.assertEqual(state['state'], 'completed', state)
        self.assertEqual(state['assessment_status'], 'scored')
        self.assertEqual(state['result']['overall']['score'], 100)
        self.assertEqual(state['result']['slides'][0]['score'], 100)
        self.assertEqual(state['source_identity'], state['result']['source_identity'])
        self.assertNotIn('private_audit', state['result'])
        self.assertIn('private_audit', self.job(owner).result)
        with patch.object(provider, 'request_raw') as call, \
             patch('rehearsals.services.presentation_measurements.measure_audio') as measure:
            for _ in range(3):
                self.assertEqual(self.client.get(self.url).json()['result'], state['result'])
                self.assertEqual(self.post_score().status_code, 200)
                coaching.run_coaching(owner.pk, 1)
            call.assert_not_called(); measure.assert_not_called()
        self.assertEqual(owner.jobs.count(), 1)
        self.assertFalse(FeedbackAnalysis.objects.filter(analysis_type__startswith='review_').exists())

    def test_saved_receipt_recovers_without_audio_keys_or_second_provider_request(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner()
        with patch('rehearsals.services.presentation_measurements.measure_audio',
                   return_value=deepcopy(self.measurements)):
            value, job, _ = coaching.claim(owner.pk, 1)
            prepared = coaching._prepared(value, job)
            prepared, request = coaching.submit(value, job, prepared)
            receipt = self.score_receipt(prepared)
            coaching.save_receipt(value, job, request, receipt)
        self.expire(owner)
        with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': '', 'OPENAI_API_KEY': ''}), \
             patch.object(provider, 'request_raw', side_effect=AssertionError('No second inference')), \
             patch('rehearsals.services.presentation_measurements.measure_audio', side_effect=AssertionError('No audio read')):
            coaching.recover_coaching()
            coaching.run_coaching(owner.pk, 1)
            coaching.run_coaching(owner.pk, 1)
            state = self.client.get(self.url).json()
        self.assertEqual(state['state'], 'completed', state)
        self.assertEqual(state['result']['overall']['score'], 100)
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'completed')
        self.assertEqual(FeedbackRequest.objects.filter(coaching_job=job).count(), 1)

    def test_singleton_and_scoring_owners_stay_independent(self):
        self.complete()
        scope = {'context_id': None, 'slides': [{'slide_index': 0, 'segments': [
            {'start_ms': v['start_ms'], 'end_ms': v['end_ms']} for v in self.attempt.visits
            if v['end_ms'] > v['start_ms']]}]}
        review_url = f'/api/attempts/{self.attempt.pk}/slide-review/'
        first = self.client.post(review_url, {'scope': scope}, content_type='application/json')
        self.assertEqual(first.status_code, 202, first.content)
        self.assertEqual(self.post_score().status_code, 202)
        self.assertEqual(self.execute_score(self.owner()), (1, 1))
        repeated = self.client.post(review_url, {'scope': scope}, content_type='application/json')
        self.assertEqual(repeated.status_code, 202)
        self.assertEqual(first.json()['feedback_revision'], repeated.json()['feedback_revision'])
        self.assertEqual(FeedbackAnalysis.objects.filter(analysis_type__startswith='review_').count(), 1)
        self.assertEqual(FeedbackAnalysis.objects.filter(analysis_type__startswith='score_').count(), 1)
        self.assertEqual(FeedbackJob.objects.count(), 2)

    def test_pending_update_does_not_present_previous_generation_as_current_score(self):
        self.complete()
        context = PresentationContext.objects.create(deck=self.deck, audience='Students')
        context_id = str(context.pk)
        self.assertEqual(self.post_score(context_id=context_id).status_code, 202)
        owner = self.owner(); self.assertEqual(self.execute_score(owner), (1, 1))
        old = self.client.get(self.url, {'context_id': context_id}).json()
        self.assertEqual(old['result']['overall']['score'], 100)
        context.revision += 1; context.audience = 'Researchers'; context.save()
        stale = self.client.get(self.url, {'context_id': context_id}).json()
        self.assertTrue(stale['stale'])
        self.assertIsNone(stale['result'], 'Old score must be withheld after relevant source changes')
        response = self.post_score(context_id=context_id, feedback_revision=1)
        self.assertEqual(response.status_code, 202, response.content)
        pending = response.json()
        self.assertEqual(pending['assessment_status'], 'pending')
        self.assertIsNone(pending['result'], 'Old generation must not be rebound to new source identity')
        self.assertEqual(pending['requirements']['revision'], context.revision)
        self.assertIsNotNone(owner.jobs.get(generation=1).result, 'Historical result is retained in storage')
        owner.refresh_from_db(); self.level = 'competent'
        self.assertEqual(self.execute_score(owner), (1, 1))
        current = self.client.get(self.url, {'context_id': context_id}).json()
        self.assertEqual(current['result']['overall']['score'], 67)
        self.assertNotEqual(current['source_identity'], old['source_identity'])

    def test_uncertain_submission_requires_explicit_revision_and_acknowledgement(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner()
        with patch('rehearsals.services.presentation_measurements.measure_audio', return_value=self.measurements), \
             patch.object(provider, 'request_raw', side_effect=FeedbackError('network_error', uncertain=True)) as call:
            coaching.run_coaching(owner.pk, 1)
        self.assertEqual(call.call_count, 1)
        state = self.client.get(self.url).json()
        self.assertEqual(state['state'], 'needs_confirmation')
        self.assertTrue(state['requires_confirmation'])
        self.assertEqual(self.post_score(feedback_revision=1).status_code, 409)
        response = self.post_score(feedback_revision=1, acknowledge_uncertain=True)
        self.assertEqual(response.status_code, 202, response.content)
        self.assertEqual(response.json()['feedback_revision'], 2)
        self.assertEqual(owner.jobs.count(), 2)

    def test_generation_update_between_coaching_read_and_projection_remains_self_consistent(self):
        self.complete()
        context = PresentationContext.objects.create(deck=self.deck, audience='Students')
        context_id = str(context.pk)
        self.assertEqual(self.post_score(context_id=context_id).status_code, 202)
        owner = self.owner(); self.assertEqual(self.execute_score(owner), (1, 1))
        original_read = coaching.read
        advanced = False
        def interleaved_read(attempt_id, kind):
            nonlocal advanced
            state = original_read(attempt_id, kind)
            if not advanced:
                advanced = True
                context.revision += 1; context.save()
                scoring.generate(attempt_id, {'feedback_revision': 1}, context_id)
            return state
        with patch.object(coaching, 'read', side_effect=interleaved_read):
            state = scoring.read(self.attempt.pk, context_id)
        self.assertEqual(state['feedback_revision'], 1)
        self.assertEqual(state['requirements']['revision'], 0)
        self.assertEqual(state['source_identity'], state['result']['source_identity'])
        self.assertEqual(state['result']['overall']['score'], 100)
        self.assertEqual(self.owner().feedback_revision, 2)

    def rejected_score(self):
        self.complete()
        self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner()
        def rejected(prepared):
            job = self.job(owner)
            bundle = scoring._bundle(job.description_set, job,
                job.source_snapshot['presentation_score']['measurements'])
            raw = output(bundle)
            raw['whole'][-1]['evidence'] = [{'kind': 'measurement', 'measurement_id': 'speech_0'}]
            return self.coaching_receipt(prepared, output=raw)
        with patch.object(self, 'score_receipt', side_effect=rejected):
            self.assertEqual(self.execute_score(owner), (1, 1))
        self.assertEqual(self.client.get(self.url).json()['assessment_status'], 'invalid_evidence')
        return owner

    def prior_protocol(self, job):
        previous = deepcopy(scoring.protocol())
        previous['prompt_version'] = 'presentation-score-v2'
        previous['definition']['prompt_version'] = 'presentation-score-prompt-v2'
        previous['definition']['prompt_sha256'] = 'b34ba4784daae6fdaf8d06d7714d81889c6d35e07a0217bdcc12a147e9592037'
        self.assertEqual(coaching._digest(previous), '3c4c634861209d739d76e31068e6caaad00b4c7e905ed68c52fabcb9ce9a83f0')
        job.prompt_version = 'presentation-score-v2'
        job.prompt_digest = coaching._digest(previous)
        # PostgreSQL JSONB does not retain insertion order. Persist equivalent
        # reordered protocol fields even on SQLite so upgrade coverage is portable.
        job.source_snapshot['presentation_score']['protocol'] = json.loads(json.dumps(previous, sort_keys=True))
        job.save(update_fields=['prompt_version', 'prompt_digest', 'source_snapshot'])

    def test_completed_rejected_total_requires_explicit_retry_and_preserves_receipt(self):
        owner = self.rejected_score()
        state = self.client.get(self.url).json()
        self.assertEqual(state['state'], 'completed')
        self.assertTrue(state['retry_available'])
        self.assertEqual(state['result']['slides'][0]['score'], 100)
        first = self.job(owner)
        request = FeedbackRequest.objects.get(coaching_job=first)
        receipt = deepcopy(request.raw_body)
        saved_result = deepcopy(first.result)
        for _ in range(2):
            self.assertEqual(self.post_score().status_code, 200)
        self.assertEqual(owner.jobs.count(), 1)
        response = self.post_score(feedback_revision=1, expected_selection=state['selection']['token'])
        self.assertEqual(response.status_code, 202, response.content)
        self.assertEqual(response.json()['feedback_revision'], 2)
        self.assertEqual(self.post_score(feedback_revision=1).status_code, 409)
        first.refresh_from_db(); request.refresh_from_db()
        self.assertEqual(first.result, saved_result)
        self.assertEqual(request.raw_body, receipt)
        owner.refresh_from_db()
        self.assertEqual(self.execute_score(owner), (1, 1))
        self.assertEqual(self.client.get(self.url).json()['result']['overall']['score'], 100)

    def test_completed_rejected_retry_obeys_existing_cooldown_and_uncertainty(self):
        owner = self.rejected_score()
        job = self.job(owner)
        job.retry_at = timezone.now() + timedelta(minutes=5)
        job.save(update_fields=['retry_at'])
        self.assertFalse(self.client.get(self.url).json()['retry_available'])
        response = self.post_score(feedback_revision=1)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()['error']['code'], 'retry_not_available')
        job.retry_at = timezone.now() - timedelta(seconds=1)
        job.save(update_fields=['retry_at'])
        self.assertTrue(self.client.get(self.url).json()['retry_available'])
        FeedbackRequest.objects.filter(coaching_job=job).update(outcome='uncertain')
        response = self.post_score(feedback_revision=1)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()['error']['code'], 'confirmation_required')
        response = self.post_score(feedback_revision=1, acknowledge_uncertain=True)
        self.assertEqual(response.status_code, 202, response.content)

    def test_successful_completed_explicit_revision_is_still_a_noop(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); self.assertEqual(self.execute_score(owner), (1, 1))
        self.assertEqual(self.post_score(feedback_revision=1).status_code, 200)
        self.assertEqual(owner.jobs.count(), 1)

    def test_supported_prior_protocol_creates_new_generation_without_reinterpreting_receipt(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); self.assertEqual(self.execute_score(owner), (1, 1))
        old = self.job(owner)
        self.prior_protocol(old)
        old_snapshot, old_result = deepcopy(old.source_snapshot), deepcopy(old.result)
        request = FeedbackRequest.objects.get(coaching_job=old)
        old_receipt = deepcopy(request.raw_body)
        state = self.client.get(self.url).json()
        self.assertTrue(state['stale'])
        self.assertTrue(state['retry_available'])
        self.assertIsNone(state['result'])
        self.assertEqual(self.post_score().status_code, 409)
        response = self.post_score(feedback_revision=1, expected_selection=state['selection']['token'])
        self.assertEqual(response.status_code, 202, response.content)
        fresh = self.job(owner)
        self.assertEqual(fresh.source_snapshot['presentation_score']['protocol'], scoring.protocol())
        self.assertNotEqual(fresh.prompt_digest, old.prompt_digest)
        old.refresh_from_db(); request.refresh_from_db()
        self.assertEqual(old.source_snapshot, old_snapshot)
        self.assertEqual(old.result, old_result)
        self.assertEqual(request.raw_body, old_receipt)
        with self.assertRaises(FeedbackError) as caught:
            scoring.prepared(old.description_set, old)
        self.assertEqual(caught.exception.code, 'snapshot_unavailable')
        with self.assertRaises(FeedbackError) as caught:
            scoring.normalize(old.description_set, old, None, None)
        self.assertEqual(caught.exception.code, 'snapshot_unavailable')
        owner.refresh_from_db(); self.assertEqual(self.execute_score(owner), (1, 1))
        self.assertEqual(self.client.get(self.url).json()['result']['overall']['score'], 100)

    def test_unknown_prior_protocol_cannot_be_retried_as_supported_upgrade(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); self.assertEqual(self.execute_score(owner), (1, 1))
        old = self.job(owner)
        self.prior_protocol(old)
        old.source_snapshot['presentation_score']['protocol']['definition']['prompt_sha256'] = 'f' * 64
        old.prompt_digest = coaching._digest(old.source_snapshot['presentation_score']['protocol'])
        old.save(update_fields=['prompt_digest', 'source_snapshot'])
        state = self.client.get(self.url).json()
        self.assertFalse(state['retry_available'])
        response = self.post_score(feedback_revision=1)
        self.assertEqual(response.status_code, 503, response.content)
        self.assertEqual(response.json()['error']['code'], 'snapshot_unavailable')
        self.assertEqual(owner.jobs.count(), 1)
