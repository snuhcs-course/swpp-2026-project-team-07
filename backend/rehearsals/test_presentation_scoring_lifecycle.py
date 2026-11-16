"""Score lifecycle through the existing worker; synthetic evidence and blocked network."""
from copy import deepcopy
from datetime import timedelta
import json
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from .models import (FeedbackAnalysis, FeedbackJob, FeedbackRequest, PresentationContext,
                     SlideReviewMembership, TranscriptCorrection)
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
        self.measurements = {'version': 'presentation-measurements-v2', 'status': 'available', 'reason': None,
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

    def test_singleton_and_scoring_owners_stay_independent_with_no_memberships(self):
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
        self.assertFalse(SlideReviewMembership.objects.exists())
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
        previous['measurement_version'] = 'presentation-measurements-v1'
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

    def prior_v21_protocol(self, job):
        previous = deepcopy(scoring.protocol())
        previous['measurement_version'] = 'presentation-measurements-v1'
        previous['prompt_version'] = 'presentation-score-prompt-v2.1'
        previous['definition']['prompt_version'] = 'presentation-score-prompt-v2.1'
        previous['definition']['prompt_sha256'] = '052cb290d412b5a0bebc927465c08e3391edca140a189bcfb0504356a6a715fd'
        self.assertEqual(coaching._digest(previous),
                         'cfd48a4c2992dc175a115b7739dc226b6c961a07c292ac8dc4ae0e5a549e4510')
        self.assertEqual(scoring.v1._digest(previous),
                         '8320b6497c480dc642ecd87a372e57e58317a351d5288b00d8c30e4eaaf3754f')
        job.prompt_version = 'presentation-score-prompt-v2.1'
        job.prompt_digest = coaching._digest(previous)
        job.source_snapshot['presentation_score']['protocol'] = json.loads(json.dumps(previous, sort_keys=True))
        job.save(update_fields=['prompt_version', 'prompt_digest', 'source_snapshot'])

    def test_v21_rejected_result_upgrades_only_explicitly_and_keeps_old_receipt(self):
        owner = self.rejected_score()
        old = self.job(owner)
        self.prior_v21_protocol(old)
        snapshot, result = deepcopy(old.source_snapshot), deepcopy(old.result)
        request = FeedbackRequest.objects.get(coaching_job=old)
        receipt = bytes(request.raw_body)
        state = self.client.get(self.url).json()
        self.assertTrue(state['stale'])
        self.assertTrue(state['retry_available'])
        self.assertIsNone(state['result'])
        self.assertEqual(self.post_score().status_code, 409)
        response = self.post_score(feedback_revision=1, expected_selection=state['selection']['token'])
        self.assertEqual(response.status_code, 202, response.content)
        fresh = self.job(owner)
        self.assertEqual(fresh.prompt_version, 'presentation-score-prompt-v2.3')
        self.assertEqual(fresh.source_snapshot['presentation_score']['protocol'], scoring.protocol())
        self.assertNotEqual(fresh.prompt_digest, old.prompt_digest)
        old.refresh_from_db(); request.refresh_from_db()
        self.assertEqual(old.source_snapshot, snapshot)
        self.assertEqual(old.result, result)
        self.assertEqual(bytes(request.raw_body), receipt)
        with self.assertRaises(FeedbackError) as caught:
            scoring.prepared(old.description_set, old)
        self.assertEqual(caught.exception.code, 'snapshot_unavailable')
        with self.assertRaises(FeedbackError) as caught:
            scoring.normalize(old.description_set, old, None, None)
        self.assertEqual(caught.exception.code, 'snapshot_unavailable')
        owner.refresh_from_db()
        self.assertEqual(self.execute_score(owner), (1, 1))
        self.assertEqual(self.client.get(self.url).json()['result']['overall']['score'], 100)
        self.assertEqual(self.post_score(feedback_revision=1).status_code, 409)
        old.refresh_from_db(); request.refresh_from_db()
        self.assertEqual(old.source_snapshot, snapshot)
        self.assertEqual(old.result, result)
        self.assertEqual(bytes(request.raw_body), receipt)

    def test_unsent_v21_job_fails_closed_without_measurement_or_provider(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); old = self.job(owner)
        self.prior_v21_protocol(old)
        snapshot = deepcopy(old.source_snapshot)
        self.assertEqual(self.execute_score(owner), (0, 0))
        old.refresh_from_db()
        # Existing freshness fences leave superseded unsent jobs untouched.
        self.assertEqual(old.state, 'queued')
        self.assertEqual(old.source_snapshot, snapshot)
        self.assertFalse(FeedbackRequest.objects.filter(coaching_job=old).exists())
        state = self.client.get(self.url).json()
        self.assertTrue(state['stale'])
        self.assertIsNone(state['result'])
        with self.assertRaises(FeedbackError) as caught:
            scoring.prepared(old.description_set, old)
        self.assertEqual(caught.exception.code, 'snapshot_unavailable')

    def test_v21_upgrade_rejects_a_changed_protocol_with_the_known_digest(self):
        owner = self.rejected_score(); old = self.job(owner)
        self.prior_v21_protocol(old)
        old.source_snapshot['presentation_score']['protocol']['definition']['prompt_sha256'] = 'f' * 64
        old.save(update_fields=['source_snapshot'])
        state = self.client.get(self.url).json()
        self.assertFalse(state['retry_available'])
        response = self.post_score(feedback_revision=1)
        self.assertEqual(response.status_code, 503, response.content)
        self.assertEqual(response.json()['error']['code'], 'snapshot_unavailable')
        self.assertEqual(owner.jobs.count(), 1)

    # OpenAI Codex, 2026-11-03: #45 prompt-upgrade receipt preservation.
    def prior_v22_protocol(self, job):
        previous = deepcopy(scoring.protocol())
        previous['measurement_version'] = 'presentation-measurements-v1'
        previous['prompt_version'] = 'presentation-score-prompt-v2.2'
        previous['definition']['prompt_version'] = 'presentation-score-prompt-v2.2'
        previous['definition']['prompt_sha256'] = 'ce6eebac47b75479d9fc7945e106b91f0e33d5e24798b20f093b9c6aac42dce1'
        self.assertEqual(coaching._digest(previous),
                         '842ef8c656c1bf7042bfb4f312424a303d3b8f530dc33792b735f323b01cd8a7')
        self.assertEqual(scoring.v1._digest(previous),
                         '9fda083caf1af6c4927025f148bdd5df773184846d311baba2fbb31af9ab1f07')
        job.prompt_version = 'presentation-score-prompt-v2.2'
        job.prompt_digest = coaching._digest(previous)
        job.source_snapshot['presentation_score']['protocol'] = json.loads(json.dumps(previous, sort_keys=True))
        job.save(update_fields=['prompt_version', 'prompt_digest', 'source_snapshot'])

    def test_v22_feedback_upgrade_keeps_old_result_and_receipt_until_fresh_generation(self):
        owner, old = self.legacy_score('v2.2')
        snapshot, result = deepcopy(old.source_snapshot), deepcopy(old.result)
        request = FeedbackRequest.objects.get(coaching_job=old)
        receipt = bytes(request.raw_body)
        with patch.object(provider, 'request_raw') as call, \
             patch('rehearsals.services.presentation_measurements.measure_audio') as measure:
            for _ in range(2):
                state = self.client.get(self.url).json()
                self.assertFalse(state['stale'])
                self.assertEqual(state['result']['overall']['score'], 100)
            call.assert_not_called(); measure.assert_not_called()
        self.assertEqual(self.post_score().status_code, 200)
        self.assertEqual(self.post_score(feedback_revision=1).status_code, 200)
        self.assertEqual(owner.jobs.count(), 1)
        # A real profile revision makes the historical result stale; explicit Update can replace it.
        old.description_set.description_revision += 1
        old.description_set.save(update_fields=['description_revision'])
        state = self.client.get(self.url).json()
        self.assertTrue(state['stale'])
        self.assertIsNone(state['result'])
        response = self.post_score(feedback_revision=1, expected_selection=state['selection']['token'])
        self.assertEqual(response.status_code, 202, response.content)
        fresh = self.job(owner)
        self.assertEqual(fresh.prompt_version, 'presentation-score-prompt-v2.3')
        self.assertNotEqual(fresh.prompt_digest, old.prompt_digest)
        with self.assertRaises(FeedbackError) as caught:
            scoring.normalize(old.description_set, old, None, None)
        self.assertEqual(caught.exception.code, 'snapshot_unavailable')
        owner.refresh_from_db(); self.assertEqual(self.execute_score(owner), (1, 1))
        self.assertEqual(self.client.get(self.url).json()['result']['overall']['score'], 100)
        old.refresh_from_db(); request.refresh_from_db()
        self.assertEqual(old.source_snapshot, snapshot)
        self.assertEqual(old.result, result)
        self.assertEqual(bytes(request.raw_body), receipt)

    def legacy_score(self, version='v2.3', *, failed=False, context_id=None):
        self.complete()
        current = self.measurements
        self.measurements = {k: v for k, v in current.items() if k != 'reason'}
        self.measurements['version'] = 'presentation-measurements-v1'
        if failed:
            self.measurements.update(status='unavailable', items=[], limitations=['Historical 100 ms duration mismatch.'])
        try:
            with patch('rehearsals.services.presentation_measurements.VERSION', 'presentation-measurements-v1'):
                self.assertEqual(self.post_score(context_id=context_id).status_code, 202)
                owner = self.owner()
                self.assertEqual(self.execute_score(owner), (1, 0 if failed else 1))
        finally:
            self.measurements = current
        old = self.job(owner)
        if version == 'v2.2':
            self.prior_v22_protocol(old)
        return owner, old

    def test_v23_v1_completed_history_reads_without_regeneration_and_keeps_identity(self):
        owner, old = self.legacy_score()
        snapshot, result = deepcopy(old.source_snapshot), deepcopy(old.result)
        request = FeedbackRequest.objects.get(coaching_job=old)
        receipt = bytes(request.raw_body)
        with patch.object(provider, 'request_raw') as call, \
             patch('rehearsals.services.presentation_measurements.measure_audio') as measure:
            state = self.client.get(self.url).json()
            self.assertEqual((state['state'], state['stale']), ('completed', False))
            self.assertEqual(state['source_identity'], snapshot['presentation_score']['source_identity'])
            self.assertEqual(state['result']['overall']['score'], 100)
            self.assertEqual(self.post_score(feedback_revision=1).status_code, 200)
            coaching.run_coaching(owner.pk, 1)
            call.assert_not_called(); measure.assert_not_called()
        with self.assertRaises(FeedbackError): scoring.prepared(old.description_set, old)
        with self.assertRaises(FeedbackError): scoring.normalize(old.description_set, old, None, None)
        old.refresh_from_db(); request.refresh_from_db()
        self.assertEqual((old.source_snapshot, old.result, bytes(request.raw_body)), (snapshot, result, receipt))
        self.assertEqual(owner.jobs.count(), 1)

    def test_legacy_failed_generation_stays_failed_and_explicit_retry_remeasures_v2(self):
        for version in ('v2.2', 'v2.3'):
            with self.subTest(version=version):
                if version == 'v2.3':
                    # Independent attempt avoids sharing the owner generated above.
                    self.attempt = self.new_attempt(self.deck)
                    self.url = f'/api/attempts/{self.attempt.pk}/presentation-score/'
                    self.measurements['attempt_id'] = str(self.attempt.pk)
                owner, old = self.legacy_score(version, failed=True)
                snapshot = deepcopy(old.source_snapshot)
                with patch.object(provider, 'request_raw') as call, \
                     patch('rehearsals.services.presentation_measurements.measure_audio') as measure:
                    state = self.client.get(self.url).json()
                    self.assertEqual((state['state'], state['stale']), ('failed', False))
                    self.assertEqual(state['error']['code'], 'audio_unavailable')
                    self.assertTrue(state['retry_available'])
                    self.assertEqual(self.post_score().status_code, 409)
                    self.assertEqual(self.post_score(feedback_revision=0).status_code, 409)
                    self.assertEqual(self.post_score(feedback_revision=1).status_code, 202)
                    call.assert_not_called(); measure.assert_not_called()
                fresh = self.job(owner)
                self.assertNotIn('measurements', fresh.source_snapshot['presentation_score'])
                self.assertEqual(fresh.source_snapshot['presentation_score']['protocol']['measurement_version'],
                                 'presentation-measurements-v2')
                owner.refresh_from_db(); self.assertEqual(self.execute_score(owner), (1, 1))
                fresh.refresh_from_db()
                self.assertEqual(fresh.source_snapshot['presentation_score']['measurements']['version'], 'presentation-measurements-v2')
                self.assertNotEqual(fresh.source_snapshot['presentation_score']['source_identity'],
                                    snapshot['presentation_score']['source_identity'])
                old.refresh_from_db(); self.assertEqual(old.source_snapshot, snapshot)
                self.assertFalse(FeedbackRequest.objects.filter(coaching_job=old).exists())

    def test_terminal_legacy_read_preserves_correction_source_profile_and_provider_fences(self):
        owner, old = self.legacy_score()
        snapshot, result = deepcopy(old.source_snapshot), deepcopy(old.result)
        self.assertTrue(coaching._source_current(old))
        for overrides in ({'FEEDBACK_GEMINI_PROJECT_ID': 'another-project'},
                          {'FEEDBACK_GEMINI_MODEL': 'gemini-2.5-flash'}, {'FEEDBACK_PROVIDER': 'openai'}):
            with self.subTest(overrides=overrides), patch.dict('os.environ', overrides):
                state = self.client.get(self.url).json()
                self.assertTrue(state['stale']); self.assertIsNone(state['result'])
        self.attempt.upload_hash = 'f'*64
        self.attempt.save(update_fields=['upload_hash'])
        self.assertFalse(coaching._source_current(old))
        self.attempt.upload_hash = ''; self.attempt.save(update_fields=['upload_hash'])
        row = TranscriptCorrection.objects.create(attempt=self.attempt,
            base_transcript_id=coaching.transcript_identity(self.attempt), revision=1, edits=[])
        self.assertFalse(coaching._source_current(old))
        row.delete()
        value = old.description_set
        value.processing_revision += 1; value.save(update_fields=['processing_revision'])
        self.assertTrue(self.client.get(self.url).json()['stale'])
        value.processing_revision -= 1; value.save(update_fields=['processing_revision'])
        slide = self.deck.slides.get()
        original_text = slide.extracted_text
        slide.extracted_text = 'Changed source'; slide.save(update_fields=['extracted_text'])
        self.assertFalse(coaching._source_current(old))
        slide.extracted_text = original_text; slide.save(update_fields=['extracted_text'])
        self.assertTrue(coaching._source_current(old))
        old.refresh_from_db(); self.assertEqual((old.source_snapshot, old.result), (snapshot, result))
        self.assertEqual(owner.jobs.count(), 1)

    def test_legacy_requirements_change_requires_explicit_update(self):
        context = PresentationContext.objects.create(deck=self.deck, audience='Students')
        context_id = str(context.pk)
        owner, old = self.legacy_score(context_id=context_id)
        old_snapshot = deepcopy(old.source_snapshot)
        self.assertFalse(self.client.get(self.url, {'context_id': context_id}).json()['stale'])
        context.revision += 1; context.required_duration_seconds = 120; context.save()
        state = self.client.get(self.url, {'context_id': context_id}).json()
        self.assertTrue(state['stale']); self.assertIsNone(state['result'])
        self.assertEqual(self.post_score(context_id=context_id).status_code, 409)
        self.assertEqual(self.post_score(context_id=context_id, feedback_revision=1).status_code, 202)
        fresh = self.job(owner)
        self.assertEqual(fresh.source_snapshot['presentation_score']['requirements']['required_duration_seconds'], 120)
        self.assertNotIn('measurements', fresh.source_snapshot['presentation_score'])
        old.refresh_from_db(); self.assertEqual(old.source_snapshot, old_snapshot)

    def test_v23_legacy_protocol_tampering_rejects_known_and_recomputed_digests(self):
        owner, old = self.legacy_score()
        old.source_snapshot['presentation_score']['protocol']['definition']['prompt_sha256'] = 'f'*64
        for recompute_digest in (False, True):
            if recompute_digest:
                old.prompt_digest = coaching._digest(old.source_snapshot['presentation_score']['protocol'])
            old.save(update_fields=['prompt_digest', 'source_snapshot'])
            state = self.client.get(self.url).json()
            self.assertTrue(state['stale']); self.assertIsNone(state['result'])
            self.assertFalse(state['retry_available'])
            self.assertEqual(self.post_score(feedback_revision=1).status_code, 503)
        self.assertEqual(owner.jobs.count(), 1)

    def test_unsent_v23_v1_job_and_current_worker_with_v1_measurements_fail_closed(self):
        self.complete()
        with patch('rehearsals.services.presentation_measurements.VERSION', 'presentation-measurements-v1'):
            self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); old = self.job(owner)
        snapshot = deepcopy(old.source_snapshot)
        self.assertEqual(self.execute_score(owner), (0, 0))
        old.refresh_from_db(); self.assertEqual(old.source_snapshot, snapshot)
        self.assertEqual(old.state, 'queued')
        with self.assertRaises(FeedbackError): scoring.prepared(old.description_set, old)
        with self.assertRaises(FeedbackError): scoring.normalize(old.description_set, old, None, None)
        self.assertEqual(self.post_score(feedback_revision=1).status_code, 202)
        self.measurements = {k:v for k,v in self.measurements.items() if k!='reason'}
        self.measurements['version'] = 'presentation-measurements-v1'
        owner.refresh_from_db(); self.assertEqual(self.execute_score(owner), (1, 0))
        fresh = self.job(owner)
        self.assertEqual((fresh.state, fresh.error_code), ('failed', 'snapshot_unavailable'))
        self.assertNotIn('measurements', fresh.source_snapshot['presentation_score'])
        self.assertFalse(FeedbackRequest.objects.filter(coaching_job=fresh).exists())

    def test_current_frozen_measurement_version_cannot_be_downgraded_for_receipt_replay(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); self.assertEqual(self.execute_score(owner), (1, 1))
        job = self.job(owner)
        measured = job.source_snapshot['presentation_score']['measurements']
        measured['version'] = 'presentation-measurements-v1'; measured.pop('reason')
        job.save(update_fields=['source_snapshot'])
        state = self.client.get(self.url).json()
        self.assertTrue(state['stale']); self.assertIsNone(state['result'])
        with self.assertRaises(FeedbackError): scoring.prepared(job.description_set, job)
        with self.assertRaises(FeedbackError): scoring.normalize(job.description_set, job, None, None)
        job.source_snapshot['presentation_score']['measurements'] = []
        self.assertFalse(scoring.current(self.attempt, job))

    def test_unsent_v22_job_cannot_dispatch_under_feedback_prompt_v23(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); old = self.job(owner); self.prior_v22_protocol(old)
        snapshot = deepcopy(old.source_snapshot)
        self.assertEqual(self.execute_score(owner), (0, 0))
        old.refresh_from_db()
        self.assertEqual(old.state, 'queued')
        self.assertEqual(old.source_snapshot, snapshot)
        self.assertFalse(FeedbackRequest.objects.filter(coaching_job=old).exists())

    def test_v22_feedback_upgrade_requires_both_frozen_fingerprints(self):
        self.complete(); self.assertEqual(self.post_score().status_code, 202)
        owner = self.owner(); old = self.job(owner); self.prior_v22_protocol(old)
        old.source_snapshot['presentation_score']['protocol']['definition']['prompt_sha256'] = 'f' * 64
        for recompute_digest in (False, True):
            with self.subTest(recompute_digest=recompute_digest):
                if recompute_digest:
                    old.prompt_digest = coaching._digest(old.source_snapshot['presentation_score']['protocol'])
                old.save(update_fields=['prompt_digest', 'source_snapshot'])
                state = self.client.get(self.url).json()
                self.assertFalse(state['retry_available'])
                response = self.post_score(feedback_revision=1)
                self.assertEqual(response.status_code, 503, response.content)
                self.assertEqual(response.json()['error']['code'], 'snapshot_unavailable')
                self.assertEqual(owner.jobs.count(), 1)
