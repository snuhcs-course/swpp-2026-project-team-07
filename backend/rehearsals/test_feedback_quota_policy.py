"""Provider policy regressions: synthetic stored sources and mocked calls only."""
from datetime import timedelta
from unittest.mock import patch
import uuid

from django.test import SimpleTestCase, TestCase
from django.db import transaction
from django.utils import timezone

from .models import FeedbackRequest, FeedbackReservation
from .services import coaching, descriptions, feedback_provider as provider
from .services.feedback import FeedbackError
from .services.feedback_config import Selection
from .test_coaching import SyntheticCoaching


class ProviderDefaultTests(SimpleTestCase):
    def test_omitted_provider_is_openai_at_both_entry_points_without_fallback(self):
        env = {'FEEDBACK_ENABLED': 'true', 'FEEDBACK_OPENAI_PROJECT_ID': 'synthetic-openai',
               'FEEDBACK_GEMINI_PROJECT_ID': 'synthetic-gemini', 'GEMINI_API_KEY': 'synthetic-gemini-key',
               'OPENAI_API_KEY': 'synthetic-openai-key'}
        for selected, model in [('openai', 'gpt-6-luna'), ('gemini', 'gemini-3.1-flash-lite')]:
            with self.subTest(provider=selected):
                settings = {**env, **({'FEEDBACK_PROVIDER': selected} if selected == 'gemini' else {})}
                selection = Selection.current(settings)
                config = provider.ProviderConfig.from_env(settings)
                self.assertEqual((selection.provider, selection.model), (selected, model))
                self.assertEqual((config.provider, config.model), (selected, model))
        del env['OPENAI_API_KEY']
        for resolve in [provider.ProviderConfig.from_env, lambda e: Selection.current(e).credentials(e)]:
            with self.assertRaises(FeedbackError) as caught:
                resolve(env)
            self.assertEqual(caught.exception.code, 'missing_api_key')
        del env['FEEDBACK_ENABLED']
        for resolve in [provider.ProviderConfig.from_env, lambda e: Selection.current(e).credentials(e)]:
            with self.assertRaises(FeedbackError) as caught:
                resolve(env)
            self.assertEqual(caught.exception.code, 'disabled')


class QuotaPolicyCases(SyntheticCoaching):
    """Run the same observable stop/retry/receipt guarantees for both stages."""
    def stage_scope(self):
        if self.stage == 'descriptions':
            self.complete()  # A prior request consumes this shared bucket.
            value = self.admit(self.new_deck('quota-target'))
            job = value.jobs.get(generation=1)
            owner = value
        else:
            owner = self.ready()  # Description reservation contends with coaching.
            job = self.job(owner)
            value = job.description_set
        return value, owner, job

    def execute_stage(self, owner, revision=1):
        self.service.run_description(owner.pk, revision) if self.stage == 'descriptions' else self.service.run_coaching(owner.pk, revision)

    def recover_stage(self):
        self.service.recover_descriptions() if self.stage == 'descriptions' else self.service.recover_coaching()

    def request_for(self, job):
        return FeedbackRequest.objects.filter(**{('job' if self.stage == 'descriptions' else 'coaching_job'): job}).first()

    def state_for(self, value):
        return descriptions.read(value.deck_id, value.pk) if self.stage == 'descriptions' else self.feedback_state()

    def retry(self, value, revision):
        url = f'/api/decks/{value.deck_id}/descriptions/generate/' if self.stage == 'descriptions' else self.feedback_url + 'generate/'
        payload = {'description_set_id': str(value.pk), 'processing_revision': revision} if self.stage == 'descriptions' else {'feedback_revision': revision}
        return self.client.post(url, payload, format='json')

    def prepared(self, value, job):
        if self.stage == 'coaching':
            return coaching._prepared(value, job)
        return Selection.saved(value).adapter().prepare_descriptions(descriptions.prepare_saved(value.deck_id)[0])

    def submitted(self, owner):
        value, job, request = self.service.claim(owner.pk, 1)
        prepared = self.prepared(value, job)
        if self.stage == 'descriptions':
            prepared = descriptions.submit(value, job, prepared)
        else:
            prepared, request = coaching.submit(value, job, prepared)
        request.refresh_from_db()
        return value, job, prepared, request

    def assert_quota_stop(self, mode):
        value, owner, job = self.stage_scope()
        original_source = value.source_snapshot
        original_attempt = type(self.attempt).objects.filter(pk=self.attempt.pk).values().get()
        prior = FeedbackReservation.objects.get()
        bucket = prior.bucket
        settings = {}
        if mode == 'cooldown':
            bucket.blocked_until = timezone.now() + timedelta(seconds=90)
            bucket.save(update_fields=['blocked_until'])
        else:
            units = len(self.prepared(value, job).payload) + provider.OUTPUT_TOKENS[self.stage]
            key, limit = {'rpm': ('RPM', 1), 'tpm': ('TPM', max(prior.units, units)),
                          'daily': ('DAILY_REQUEST_LIMIT', 1)}[mode]
            settings['FEEDBACK_GEMINI_' + key] = str(limit)
        with patch.dict('os.environ', settings), patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_stage(owner)
            job.refresh_from_db()
            self.assertEqual((job.state, job.error_code), ('failed', 'quota_stopped'))
            self.assertIsNotNone(job.completed_at)
            self.assertIsNone(job.claim_token)
            self.assertGreater(job.retry_at, timezone.now())
            self.assertEqual(self.state_for(value)['error'], {'code': 'quota_stopped',
                'message': 'Generation stopped because the Gemini quota is unavailable. '
                           'After the retry time, refresh and choose Retry to try again.'})
            request = self.request_for(job)
            if self.stage == 'descriptions':
                self.assertEqual((request.outcome, request.error_code), ('local', 'quota_stopped'))
                self.assertIsNotNone(request.completed_at)
                self.assertIsNone(request.submitted_at)
            else:
                self.assertIsNone(request)  # Creation rolled back with quota rejection.
            self.assertEqual(FeedbackReservation.objects.count(), 1)
            self.assertEqual(self.retry(value, 1).status_code, 409)
            self.execute_stage(owner)
            self.recover_stage()
            call.assert_not_called()
            # A changed default and elapsed cooldown never authorize this generation.
            with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}), \
                    patch.object(timezone, 'now', return_value=job.retry_at + timedelta(seconds=1)):
                for _ in range(2):
                    self.recover_stage()
                    self.execute_stage(owner)
                call.assert_not_called()
                self.assertTrue(self.state_for(value)['retry_available'])
                self.assertEqual(self.retry(value, 1).status_code, 202)
                self.assertEqual(self.retry(value, 1).status_code, 409)
                self.execute_stage(owner, 1)  # Stale task cannot consume the new generation.
                call.assert_not_called()
                self.execute_stage(owner, 2)
                self.execute_stage(owner, 2)
                self.assertEqual(call.call_count, 1)
                self.assertEqual(call.call_args.args[0].config.provider, 'gemini')
                self.assertEqual(self.state_for(value)['state'], 'completed')
                self.assertEqual(self.retry(value, 1).status_code, 409)
        value.refresh_from_db()
        self.assertEqual(value.source_snapshot, original_source)
        self.assertEqual(type(self.attempt).objects.filter(pk=self.attempt.pk).values().get(), original_attempt)

    def test_openai_local_quotas_resume_in_same_generation(self):
        for mode in ['rpm', 'tpm', 'daily', 'cooldown']:
            with self.subTest(mode=mode), transaction.atomic(), patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}):
                value, owner, job = self.stage_scope()
                prior = FeedbackReservation.objects.get()
                bucket = prior.bucket
                settings = {}
                if mode == 'cooldown':
                    bucket.blocked_until = timezone.now() + timedelta(seconds=90)
                    bucket.save(update_fields=['blocked_until'])
                else:
                    units = len(self.prepared(value, job).payload) + provider.OUTPUT_TOKENS[self.stage]
                    key, limit = {'rpm': ('RPM', 1), 'tpm': ('TPM', max(prior.units, units)),
                                  'daily': ('DAILY_REQUEST_LIMIT', 1)}[mode]
                    settings['FEEDBACK_OPENAI_' + key] = str(limit)
                with patch.dict('os.environ', settings), patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
                    self.execute_stage(owner)
                    job.refresh_from_db()
                    self.assertEqual((job.state, job.error_code), ('waiting_quota', 'waiting_quota'))
                    self.assertIsNone(job.completed_at)
                    self.recover_stage()
                    self.execute_stage(owner)
                    call.assert_not_called()
                    with patch.object(timezone, 'now', return_value=job.retry_at + timedelta(seconds=1)), \
                            patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'gemini'}):
                        self.recover_stage()
                        self.execute_stage(owner)
                        self.execute_stage(owner)
                    self.assertEqual(call.call_count, 1)
                    self.assertEqual(call.call_args.args[0].config.provider, 'openai')
                    job.refresh_from_db()
                    self.assertEqual((job.state, job.generation), ('completed', 1))
                    self.assertEqual(FeedbackReservation.objects.count(), 2)
                transaction.set_rollback(True)

    def test_gemini_rpm_stops_until_explicit_revision_retry(self):
        self.assert_quota_stop('rpm')

    def test_gemini_tpm_stops_until_explicit_revision_retry(self):
        self.assert_quota_stop('tpm')

    def test_gemini_daily_stops_until_explicit_revision_retry(self):
        self.assert_quota_stop('daily')

    def test_gemini_shared_cooldown_stops_until_explicit_revision_retry(self):
        self.assert_quota_stop('cooldown')

    def test_legacy_wait_direct_and_recovery_stop_with_or_without_request(self):
        value, owner, job = self.stage_scope()
        for queued in [False, True]:
            for has_request in [False, True]:
                for recover, expired in [(False, False), (False, True), (True, False), (True, True)]:
                    with self.subTest(queued=queued, request=has_request, recover=recover, expired=expired), transaction.atomic():
                        FeedbackRequest.objects.filter(**{('job' if self.stage == 'descriptions' else 'coaching_job'): job}).delete()
                        if has_request:
                            FeedbackRequest.objects.create(**{('job' if self.stage == 'descriptions' else 'coaching_job'): job},
                                generation=1, claim_token=uuid.uuid4(), claimed_at=timezone.now(), provider='gemini', project_id=value.project_id, model=value.model,
                                stage=self.stage, input_hash=value.input_hash, queued_at=job.queued_at, outcome='local', error_code='waiting_quota')
                        until = timezone.now() + timedelta(seconds=-60 if expired else 60)
                        type(job).objects.filter(pk=job.pk).update(state='queued' if queued else 'waiting_quota',
                            error_code='waiting_quota', retry_at=until, completed_at=None, claim_token=None)
                        before = self.state_for(value)['updated_at']
                        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}), patch.object(provider, 'request_raw') as call:
                            if recover:
                                self.recover_stage()
                            else:
                                self.execute_stage(owner)
                            job.refresh_from_db()
                            self.assertEqual((job.state, job.error_code, job.retry_at), ('failed', 'quota_stopped', until))
                            self.assertIsNotNone(job.completed_at)
                            self.assertGreater(self.state_for(value)['updated_at'], before)
                            request = self.request_for(job)
                            if has_request:
                                self.assertEqual((request.outcome, request.error_code), ('local', 'quota_stopped'))
                                self.assertIsNotNone(request.completed_at)
                            with patch.object(timezone, 'now', return_value=timezone.now() + timedelta(seconds=61)):
                                self.recover_stage()
                                self.execute_stage(owner)
                                self.recover_stage()
                            call.assert_not_called()

    def test_legacy_wait_preserves_receipt_and_submitted_uncertainty(self):
        value, owner, _ = self.stage_scope()
        value, job, prepared, request = self.submitted(owner)
        until = timezone.now() + timedelta(seconds=90)
        type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota',
            retry_at=until, claim_token=None)
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}), patch.object(provider, 'request_raw') as call:
            self.execute_stage(owner)
            self.recover_stage()
            job.refresh_from_db()
            self.assertEqual(job.state, 'needs_confirmation')
            self.assertTrue(self.state_for(value)['requires_confirmation'])
            request.refresh_from_db()
            self.assertEqual(request.outcome, 'uncertain')
            self.assertIsNone(request.reservation.released_at)
            receipt = self.coaching_receipt(prepared)
            self.service.save_receipt(value, job, request, receipt)
            # A saved outcome wins even if a legacy wait marker and future retry survive.
            type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota', retry_at=until)
            self.recover_stage()
            self.execute_stage(owner)
            request.refresh_from_db()
            self.assertEqual(request.outcome, 'completed')
            self.assertEqual(bytes(request.raw_body), receipt.body)
            self.assertEqual(self.state_for(value)['state'], 'completed')
            call.assert_not_called()

    def test_direct_legacy_wait_claim_normalizes_receipt_before_future_cooldown(self):
        value, owner, _ = self.stage_scope()
        value, job, prepared, request = self.submitted(owner)
        receipt = self.coaching_receipt(prepared)
        self.service.save_receipt(value, job, request, receipt)
        type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota',
            retry_at=timezone.now() + timedelta(seconds=90), claim_token=None)
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}), patch.object(provider, 'request_raw') as call:
            self.execute_stage(owner)
            self.execute_stage(owner)
            call.assert_not_called()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'completed')
        self.assertEqual(bytes(request.raw_body), receipt.body)
        self.assertEqual(self.state_for(value)['state'], 'completed')

    def test_legacy_wait_live_claim_is_not_stopped_until_lease_recovery(self):
        value, owner, job = self.stage_scope()
        self.service.claim(owner.pk, 1)
        type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota')
        before = type(job).objects.filter(pk=job.pk).values().get()
        with patch.object(provider, 'request_raw') as call:
            self.execute_stage(owner)
            self.recover_stage()
            self.assertEqual(type(job).objects.filter(pk=job.pk).values().get(), before)
            with patch.object(timezone, 'now', return_value=timezone.now() + timedelta(seconds=361)):
                self.recover_stage()
            job.refresh_from_db()
            self.assertEqual((job.state, job.error_code), ('failed', 'quota_stopped'))
            self.assertIsNone(job.claim_token)
            call.assert_not_called()

    def test_legacy_wait_receipt_only_recovery_preserves_edit_and_newer_generation(self):
        for supersession in ['edit', 'retry']:
            with self.subTest(supersession=supersession), transaction.atomic():
                value, owner, _ = self.stage_scope()
                value, job, prepared, request = self.submitted(owner)
                until = timezone.now() + timedelta(seconds=90)
                type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota',
                    retry_at=until, claim_token=None)
                self.recover_stage()  # Original submission becomes uncertain.
                if supersession == 'edit':
                    deck, _ = descriptions.prepare_saved(value.deck_id)
                    from .test_descriptions import description_value
                    edited = description_value(deck)
                    edited['slides'][0]['summary']['text'] = 'Synthetic saved correction'
                    descriptions.edit(value.deck_id, {'description_set_id': str(value.pk),
                        'description_revision': value.description_revision, 'descriptions': edited})
                else:
                    with patch.object(timezone, 'now', return_value=until + timedelta(seconds=1)):
                        if self.stage == 'descriptions':
                            descriptions.generate(value.deck_id, {'description_set_id': str(value.pk),
                                'processing_revision': 1, 'acknowledge_uncertain': True})
                        else:
                            coaching.generate(self.attempt.pk, {'feedback_revision': 1, 'acknowledge_uncertain': True})
                        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
                            self.execute_stage(owner, 2)
                # A stale legacy marker must never beat the scope/revision fences.
                type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota', claim_token=None)
                before_set = type(value).objects.filter(pk=value.pk).values().get()
                before_jobs = list(type(job).objects.filter(**{('description_set' if self.stage == 'descriptions' else 'analysis'): owner}).exclude(pk=job.pk).values())
                with patch.object(provider, 'request_raw') as call:
                    self.execute_stage(owner)
                    self.recover_stage()
                    self.assertEqual(type(value).objects.filter(pk=value.pk).values().get(), before_set)
                    receipt = self.coaching_receipt(prepared)
                    self.service.save_receipt(value, job, request, receipt)
                    self.recover_stage()
                    self.execute_stage(owner)
                    self.execute_stage(owner)
                    call.assert_not_called()
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'completed')
                self.assertEqual(bytes(request.raw_body), receipt.body)
                self.assertIsNone(request.reservation.released_at)
                self.assertEqual(type(value).objects.filter(pk=value.pk).values().get(), before_set)
                self.assertEqual(list(type(job).objects.filter(**{('description_set' if self.stage == 'descriptions' else 'analysis'): owner}).exclude(pk=job.pk).values()), before_jobs)
                # Reuse the synthetic fixture within this test without changing data across cases.
                transaction.set_rollback(True)

    def test_gemini_actual_429_keeps_rate_limit_and_explicit_retry(self):
        value, owner, job = self.stage_scope()
        until = timezone.now() + timedelta(seconds=90)
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.coaching_receipt(p, status=429, retry_at=until)) as call:
            self.execute_stage(owner)
            self.execute_stage(owner)
            self.recover_stage()
            self.assertEqual(call.call_count, 1)
        job.refresh_from_db()
        self.assertEqual((job.state, job.error_code, job.retry_at), ('failed', 'provider_rate_limit', until))
        request = self.request_for(job)
        self.assertEqual(request.retry_at, until)
        self.assertEqual(request.outcome, 'rejected')
        self.assertEqual(self.retry(value, 1).status_code, 409)
        with patch.object(timezone, 'now', return_value=until + timedelta(seconds=1)), \
                patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.recover_stage()
            self.execute_stage(owner)
            call.assert_not_called()
            self.assertEqual(self.retry(value, 1).status_code, 202)
            self.assertEqual(self.retry(value, 1).status_code, 409)
            self.execute_stage(owner, 2)
            self.execute_stage(owner, 2)
            self.assertEqual(call.call_count, 1)

    def test_legacy_wait_does_not_override_completed_request_or_live_claim(self):
        value, owner, job = self.stage_scope()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_stage(owner)
        request = self.request_for(job)
        original = (request.outcome, request.completed_at)
        type(job).objects.filter(pk=job.pk).update(state='queued', error_code='waiting_quota')
        with patch.object(provider, 'request_raw') as call:
            self.execute_stage(owner)
            self.recover_stage()
            request.refresh_from_db()
            self.assertEqual((request.outcome, request.completed_at), original)
            call.assert_not_called()
        # A live claim is fenced even if an old wait marker survives on its job.
        type(job).objects.filter(pk=job.pk).update(state='waiting_quota', error_code='waiting_quota',
            claim_token=uuid.uuid4(), claimed_at=timezone.now())
        before = type(job).objects.filter(pk=job.pk).values().get()
        self.execute_stage(owner)
        self.recover_stage()
        self.assertEqual(type(job).objects.filter(pk=job.pk).values().get(), before)


class DescriptionQuotaPolicyTests(QuotaPolicyCases, TestCase):
    stage = 'descriptions'
    service = descriptions


class CoachingQuotaPolicyTests(QuotaPolicyCases, TestCase):
    stage = 'coaching'
    service = coaching
