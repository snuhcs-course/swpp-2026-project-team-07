"""Synthetic fixtures; provider/VAD mocked. SQLite does not prove row locking."""
import tempfile
from unittest.mock import patch
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient
from .models import Attempt, Deck
from .test_storage import audio_file


class ProcessingTests(TransactionTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        config = override_settings(MEDIA_ROOT=tmp.name)
        config.enable()
        self.addCleanup(config.disable)
        self.client = APIClient()
        deck = Deck.objects.create(title='Synthetic', pdf='synthetic.pdf', page_count=2)
        self.attempt = Attempt.objects.create(deck=deck, audio=audio_file(), duration_ms=2000,
            slide_events=[{'slide_index': 1, 'at_ms': 0}, {'slide_index': 0, 'at_ms': 1000}])
        self.route = f'/api/attempts/{self.attempt.id}/process/'

    def test_explicit_start_is_durable_and_duplicate_safe(self):
        # No processing occurs during upload or GET; two start requests queue once.
        self.assertEqual(self.client.get(self.route.removesuffix('process/')).data['processing_state'], 'awaiting_analysis')
        with patch('rehearsals.tasks.process_attempt.delay') as publish:
            first = self.client.post(self.route, {}, format='json')
            second = self.client.post(self.route, {}, format='json')
        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.data['processing_revision'], 1)
        self.assertEqual(second.data['processing_revision'], 1)
        self.assertEqual(publish.call_count, 1)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_state, 'queued')
        self.assertIsNotNone(self.attempt.queued_at)

    def queue(self, body=None):
        with patch('rehearsals.tasks.process_attempt.delay'):
            response = self.client.post(self.route, body or {}, format='json')
        self.assertEqual(response.status_code, 202, response.data)
        return response.data['processing_revision']

    def run_worker(self, raw=None, speech=True, failure=None):
        from .services.processing import run_attempt
        self.attempt.refresh_from_db()
        raw = raw if raw is not None else {'text': 'Hello 안녕', 'language': 'english', 'words': [
            {'word': 'Hello', 'start': 0.1, 'end': 0.4}, {'word': '안녕', 'start': 1, 'end': 1.5}]}
        with patch('rehearsals.services.processing.has_speech', return_value=speech), \
             patch.dict('os.environ', {'OPENAI_API_KEY': 'synthetic-test-key'}), \
             patch('rehearsals.services.transcription.request_raw', return_value=raw, side_effect=failure) as outbound:
            run_attempt(str(self.attempt.id), self.attempt.processing_revision)
        self.attempt.refresh_from_db()
        return outbound.call_count

    def test_no_speech_completes_without_provider_and_keeps_audio_events(self):
        events = [{'slide_index': 1, 'at_ms': 0}, {'slide_index': 0, 'at_ms': 0},
            {'slide_index': 0, 'at_ms': 500}, {'slide_index': 1, 'at_ms': 1200},
            {'slide_index': 0, 'at_ms': 1600}]
        self.attempt.slide_events = events
        self.attempt.save(update_fields=['slide_events'])
        original_audio = self.attempt.audio.read()
        self.queue()
        self.assertEqual(self.run_worker(speech=False), 0)
        self.assertEqual(self.attempt.processing_state, 'completed')
        self.assertEqual(self.attempt.analysis_outcome, 'no_speech')
        self.assertEqual(self.attempt.transcript, {'text': '', 'words': []})
        self.assertEqual(self.attempt.visits, [
            {'slide_index': 1, 'start_ms': 0, 'end_ms': 0, 'words': []},
            {'slide_index': 0, 'start_ms': 0, 'end_ms': 500, 'words': []},
            {'slide_index': 0, 'start_ms': 500, 'end_ms': 1200, 'words': []},
            {'slide_index': 1, 'start_ms': 1200, 'end_ms': 1600, 'words': []},
            {'slide_index': 0, 'start_ms': 1600, 'end_ms': 2000, 'words': []}])
        self.assertEqual(self.attempt.duration_ms, 2000)
        self.assertEqual(self.attempt.metrics['duration_ms'], 2000)
        self.assertEqual(self.attempt.metrics['time_per_slide'], [
            {'slide_index': 0, 'duration_ms': 1600}, {'slide_index': 1, 'duration_ms': 400}])
        self.assertEqual(self.attempt.metrics['detected_language'], 'und')
        self.assertEqual(self.attempt.metrics['speaking_rates'], [])
        self.assertIn('total rehearsal time', self.attempt.metrics['rate_note'])
        self.assertEqual(self.attempt.provider_requests.count(), 0)
        self.assertEqual(self.attempt.slide_events, events)
        self.assertEqual(self.attempt.audio.read(), original_audio)
        public = self.client.get(self.route.removesuffix('process/')).data
        self.assertEqual(public['visits'], self.attempt.visits)
        self.assertEqual(public['metrics'], self.attempt.metrics)
        self.assertEqual(public['partial_available'], {'transcript': True, 'alignment': True})
        self.assertEqual(public['feedback'], [])
        self.assertEqual(public['feedback_state'], 'disabled')
        self.assertIsNone(public['provenance']['provider'])
        self.assertEqual(public['provenance']['speech_gate'], 'silero-vad')
        self.assertEqual(self.client.get(f'/api/decks/{self.attempt.deck_id}/attempts/').data[0], public)
        completed = self.client.post(self.route, {}, format='json')
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.data, public)
        self.assertEqual(self.run_worker(), 0)

    def test_no_speech_alignment_failure_reuses_saved_empty_transcript(self):
        self.queue()
        with patch('rehearsals.services.processing.align_words', side_effect=ValueError('synthetic alignment failure')):
            self.assertEqual(self.run_worker(speech=False), 0)
        self.assertEqual(self.attempt.processing_state, 'failed')
        self.assertEqual(self.attempt.failed_stage, 'aligning')
        self.assertEqual(self.attempt.error['code'], 'alignment_failed')
        self.assertEqual(self.attempt.analysis_outcome, 'no_speech')
        self.assertEqual(self.attempt.transcript, {'text': '', 'words': []})
        public = self.client.get(self.route.removesuffix('process/')).data
        self.assertEqual(public['partial_available'], {'transcript': True, 'alignment': False})
        revision = self.queue({'processing_revision': 1})
        from .services.processing import run_attempt
        with patch('rehearsals.services.processing.has_speech') as gate, \
             patch('rehearsals.services.transcription.request_raw') as outbound:
            run_attempt(str(self.attempt.id), revision)
        gate.assert_not_called()
        outbound.assert_not_called()
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, 'completed')
        self.assertEqual(self.attempt.analysis_outcome, 'no_speech')
        self.assertEqual(self.attempt.visits, [
            {'slide_index': 1, 'start_ms': 0, 'end_ms': 1000, 'words': []},
            {'slide_index': 0, 'start_ms': 1000, 'end_ms': 2000, 'words': []}])
        self.assertEqual(self.attempt.metrics['duration_ms'], 2000)
        self.assertEqual(self.attempt.provider_requests.count(), 0)

    def test_no_speech_worker_exit_after_transcript_save_resumes_without_provider(self):
        from datetime import timedelta
        from django.utils import timezone
        from .services.processing import recover_work, run_attempt
        revision = self.queue()
        with patch('rehearsals.services.processing.align_words', side_effect=SystemExit('synthetic worker exit')):
            with self.assertRaises(SystemExit):
                self.run_worker(speech=False)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_state, 'aligning')
        self.assertEqual(self.attempt.transcript, {'text': '', 'words': []})
        self.assertEqual(self.attempt.analysis_outcome, 'no_speech')
        Attempt.objects.filter(pk=self.attempt.pk).update(claimed_at=timezone.now() - timedelta(seconds=361))
        with patch('rehearsals.tasks.process_attempt.delay'):
            recover_work()
        with patch('rehearsals.services.processing.has_speech') as gate, \
             patch('rehearsals.services.transcription.request_raw') as outbound:
            run_attempt(str(self.attempt.id), revision)
        gate.assert_not_called()
        outbound.assert_not_called()
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, 'completed')
        self.assertEqual(self.attempt.analysis_outcome, 'no_speech')
        self.assertEqual(self.attempt.processing_revision, revision)
        self.assertEqual(self.attempt.metrics['time_per_slide'], [
            {'slide_index': 0, 'duration_ms': 1000}, {'slide_index': 1, 'duration_ms': 1000}])
        self.assertTrue(all(visit['words'] == [] for visit in self.attempt.visits))
        self.assertEqual(self.attempt.provider_requests.count(), 0)

    def test_success_persists_private_raw_transcript_alignment_metrics(self):
        self.queue()
        self.assertEqual(self.run_worker(), 1)
        self.assertEqual(self.run_worker(), 0)
        self.assertEqual(self.attempt.processing_state, 'completed')
        self.assertEqual([v['slide_index'] for v in self.attempt.visits], [1, 0])
        self.assertEqual(self.attempt.visits[1]['words'][0]['text'], '안녕')
        self.assertEqual(self.attempt.metrics['time_per_slide'], [{'slide_index': 0, 'duration_ms': 1000}, {'slide_index': 1, 'duration_ms': 1000}])
        self.assertEqual([r['per_minute'] for r in self.attempt.metrics['speaking_rates']], [30.0, 30.0])
        self.assertIsNotNone(self.attempt.provider_requests.get().raw_response)
        public = self.client.get(self.route.removesuffix('process/')).data
        self.assertNotIn('raw_response', str(public))
        self.assertNotIn('input_hash', str(public))
        self.assertEqual(public['feedback'], [])
        self.assertEqual(public['feedback_state'], 'disabled')
        self.assertEqual(self.client.post(self.route, {}, format='json').status_code, 200)
        history = self.client.get(f'/api/decks/{self.attempt.deck_id}/attempts/').data
        self.assertEqual(history[0], public)

    def test_alignment_failure_retains_transcript_and_retry_never_retranscribes(self):
        self.queue()
        self.assertEqual(self.run_worker(raw={'text': 'past end', 'words': [{'word': 'past', 'start': 1.9, 'end': 3}]}), 1)
        self.assertEqual(self.attempt.error['code'], 'alignment_failed')
        self.assertEqual(self.attempt.failed_stage, 'aligning')
        self.assertEqual(self.attempt.duration_ms, 2000)
        self.queue({'processing_revision': 1})
        self.assertEqual(self.run_worker(), 0)
        self.assertEqual(self.attempt.error['code'], 'alignment_failed')
        self.assertEqual(self.attempt.transcript['words'][0]['end_ms'], 3000)
        self.assertEqual(self.client.post(self.route, {'processing_revision': 1}, format='json').status_code, 409)
        self.assertEqual(self.attempt.provider_requests.count(), 1)

    def test_invalid_raw_is_retained_and_retried_without_provider(self):
        self.queue()
        self.assertEqual(self.run_worker(raw={'text': 'missing words'}), 1)
        self.assertEqual(self.attempt.error['code'], 'invalid_response')
        self.queue({'processing_revision': 1})
        self.assertEqual(self.run_worker(), 0)
        self.assertIsNone(self.attempt.transcript)
        self.assertEqual(self.attempt.provider_requests.get().raw_response, {'text': 'missing words'})

    def test_manual_retry_revision_and_uncertainty_acknowledgement(self):
        from .services.transcription import TranscriptionError
        self.queue()
        self.assertEqual(self.run_worker(failure=TranscriptionError('provider_timeout', 'Timed out.', uncertain=True)), 1)
        self.assertEqual(self.attempt.processing_state, 'needs_confirmation')
        for body in [{}, {'processing_revision': 0, 'acknowledge_uncertain': True}, {'processing_revision': 1}]:
            self.assertEqual(self.client.post(self.route, body, format='json').status_code, 409)
        self.queue({'processing_revision': 1, 'acknowledge_uncertain': True})
        self.assertEqual(self.run_worker(), 1)
        self.assertEqual(self.attempt.provider_requests.count(), 2)

    def test_strict_process_payloads(self):
        for body in [[], 'bad', {'extra': 1}, {'processing_revision': True}, {'processing_revision': '1'},
                     {'processing_revision': -1}, {'acknowledge_uncertain': 'true'}, {'processing_revision': None}]:
            self.assertEqual(self.client.post(self.route, body, format='json').status_code, 400, body)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_revision, 0)

    def test_rate_limit_rejects_early_retry_without_auto_queue(self):
        from datetime import timedelta
        from django.utils import timezone
        from .services.transcription import TranscriptionError
        self.queue()
        future = timezone.now() + timedelta(seconds=90)
        self.run_worker(failure=TranscriptionError('provider_rate_limit', 'Try later.', retry_at=future))
        self.assertEqual(self.attempt.processing_state, 'failed')
        self.assertEqual(self.client.post(self.route, {'processing_revision': 1}, format='json').status_code, 409)
        self.assertFalse(self.client.get(self.route.removesuffix('process/')).data['retry_available'])

    def test_missing_key_and_gate_errors_fail_before_submitted_marker(self):
        from .services.processing import run_attempt
        from .services.transcription import TranscriptionError
        revision = self.queue()
        with patch('rehearsals.services.processing.has_speech', return_value=True), patch.dict('os.environ', {'OPENAI_API_KEY': ''}):
            run_attempt(str(self.attempt.id), revision)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.error['code'], 'missing_api_key')
        self.assertEqual(self.attempt.provider_requests.count(), 0)
        revision = self.queue({'processing_revision': revision})
        with patch('rehearsals.services.processing.has_speech', side_effect=TranscriptionError('audio_check_failed', 'Decode failed.')):
            run_attempt(str(self.attempt.id), revision)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.failed_stage, 'checking_audio')
        self.assertEqual(self.attempt.provider_requests.count(), 0)

    def test_missed_publish_is_durable_and_scheduler_republishes(self):
        from .services.processing import recover_work
        with patch('rehearsals.tasks.process_attempt.delay', side_effect=RuntimeError('broker offline')):
            self.assertEqual(self.client.post(self.route, {}, format='json').status_code, 202)
        with patch('rehearsals.tasks.process_attempt.delay') as publish:
            recover_work()
        self.assertEqual(publish.call_count, 1)
        self.assertEqual(self.run_worker(), 1)

    def test_crash_before_marker_recovers_but_after_marker_requires_confirmation(self):
        from datetime import timedelta
        from django.utils import timezone
        from .services.processing import claim_attempt, recover_work
        from .models import ProviderRequest
        revision = self.queue()
        claimed = claim_attempt(str(self.attempt.id), revision)
        Attempt.objects.filter(pk=self.attempt.pk).update(claimed_at=timezone.now() - timedelta(seconds=361))
        with patch('rehearsals.tasks.process_attempt.delay'):
            recover_work()
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_state, 'queued')
        next_claim = claim_attempt(str(self.attempt.id), revision)
        self.assertNotEqual(next_claim.claim_token, claimed.claim_token)
        ProviderRequest.objects.create(attempt=self.attempt, generation=revision, claim_token=next_claim.claim_token,
            input_hash='0' * 64, submitted_at=timezone.now())
        Attempt.objects.filter(pk=self.attempt.pk).update(claimed_at=timezone.now() - timedelta(seconds=361))
        with patch('rehearsals.tasks.process_attempt.delay') as publish:
            recover_work()
        publish.assert_not_called()
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_state, 'needs_confirmation')
        self.assertEqual(self.run_worker(), 0)

    def test_raw_saved_crash_resumes_without_provider(self):
        from datetime import timedelta
        from django.utils import timezone
        from .services.processing import claim_attempt, recover_work
        from .models import ProviderRequest
        revision = self.queue()
        claimed = claim_attempt(str(self.attempt.id), revision)
        ProviderRequest.objects.create(attempt=self.attempt, generation=revision, claim_token=claimed.claim_token,
            input_hash='0' * 64, submitted_at=timezone.now(), raw_received_at=timezone.now(), outcome='received',
            raw_response={'text': 'saved', 'words': [{'word': 'saved', 'start': 0, 'end': 1}]})
        Attempt.objects.filter(pk=self.attempt.pk).update(claimed_at=timezone.now() - timedelta(seconds=361))
        with patch('rehearsals.tasks.process_attempt.delay'):
            recover_work()
        self.assertEqual(self.run_worker(), 0)
        self.assertEqual(self.attempt.transcript['text'], 'saved')
        self.assertEqual(self.attempt.status, 'completed')

    def test_stale_claim_cannot_write_or_submit_and_marker_failure_never_calls(self):
        from .services.processing import claim_attempt, write_claim, StaleClaim, run_attempt
        revision = self.queue()
        stale = claim_attempt(str(self.attempt.id), revision)
        Attempt.objects.filter(pk=self.attempt.pk).update(claim_token=None, processing_state='queued')
        with self.assertRaises(StaleClaim):
            write_claim(stale, transcript={'text': 'stale', 'words': []})
        with patch('rehearsals.services.processing.has_speech', return_value=True), \
             patch.dict('os.environ', {'OPENAI_API_KEY': 'synthetic-test-key'}), \
             patch('rehearsals.services.processing.mark_submitted', side_effect=RuntimeError('save failed')), \
             patch('rehearsals.services.transcription.request_raw') as outbound:
            run_attempt(str(self.attempt.id), revision)
        outbound.assert_not_called()
        self.assertEqual(self.attempt.provider_requests.count(), 0)

    def test_provider_auth_is_manual_retry_and_missing_attempt_is_404(self):
        from .services.transcription import TranscriptionError
        self.queue()
        self.assertEqual(self.run_worker(failure=TranscriptionError('provider_auth', 'Check backend credentials.')), 1)
        self.assertEqual(self.attempt.processing_state, 'failed')
        self.assertEqual(self.run_worker(), 0)
        self.queue({'processing_revision': 1})
        self.assertEqual(self.run_worker(), 1)
        self.assertEqual(self.client.post('/api/attempts/00000000-0000-4000-8000-000000000001/process/', {}, format='json').status_code, 404)

    def test_raw_persistence_failure_never_auto_recalls(self):
        from .services.processing import run_attempt, recover_work
        revision = self.queue()
        with patch('rehearsals.services.processing.has_speech', return_value=True), \
             patch.dict('os.environ', {'OPENAI_API_KEY': 'synthetic-test-key'}), \
             patch('rehearsals.services.processing.save_raw', side_effect=RuntimeError('database lost')), \
             patch('rehearsals.services.transcription.request_raw', return_value={'text': '', 'words': []}) as outbound:
            run_attempt(str(self.attempt.id), revision)
            recover_work()
            run_attempt(str(self.attempt.id), revision)
        self.assertEqual(outbound.call_count, 1)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_state, 'needs_confirmation')

    def test_stale_generation_job_cannot_submit_and_old_claim_cannot_save_raw(self):
        from .services.processing import claim_attempt, save_raw, StaleClaim
        from .models import ProviderRequest
        revision = self.queue()
        claim = claim_attempt(str(self.attempt.id), revision)
        request = ProviderRequest.objects.create(attempt=self.attempt, generation=revision, claim_token=claim.claim_token, input_hash='0' * 64)
        Attempt.objects.filter(pk=self.attempt.pk).update(status='failed', processing_state='failed', claim_token=None)
        self.queue({'processing_revision': revision})
        with self.assertRaises(StaleClaim):
            save_raw(claim, request.pk, {'text': 'old', 'words': []})
        request.refresh_from_db()
        self.assertIsNone(request.raw_response)
        from .services.processing import run_attempt
        with patch('rehearsals.services.transcription.request_raw') as outbound:
            run_attempt(str(self.attempt.id), revision)
        outbound.assert_not_called()

    def test_retry_replay_after_new_failure_cannot_consume_new_generation(self):
        from .services.transcription import TranscriptionError
        self.queue()
        self.run_worker(failure=TranscriptionError('provider_auth', 'Check backend credentials.'))
        self.queue({'processing_revision': 1})
        self.run_worker(failure=TranscriptionError('provider_auth', 'Check backend credentials.'))
        self.assertEqual(self.client.post(self.route, {'processing_revision': 1}, format='json').status_code, 409)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.processing_revision, 2)
        self.assertEqual(self.attempt.provider_requests.count(), 2)


    def test_expired_claim_cannot_submit_even_before_scheduler_runs(self):
        from datetime import timedelta
        from django.utils import timezone
        from .services.processing import claim_attempt, mark_submitted, StaleClaim
        revision = self.queue()
        claim = claim_attempt(str(self.attempt.pk), revision)
        Attempt.objects.filter(pk=self.attempt.pk).update(claimed_at=timezone.now() - timedelta(seconds=361))
        with self.assertRaises(StaleClaim):
            mark_submitted(claim, '0' * 64)
        self.assertEqual(self.attempt.provider_requests.count(), 0)

    def test_private_evidence_order_original_bytes_and_no_network_transaction(self):
        import hashlib
        from django.db import connection
        from .services.processing import run_attempt
        from .services.transcription import _normalize
        from .services.alignment import align_words
        original = self.attempt.audio.read()
        raw = {'text': 'hello', 'words': [{'word': 'hello', 'start': 0, 'end': 1}],
               'usage': {'seconds': 2}, 'private_extra': 'private-provider-sentinel'}
        revision = self.queue()
        def outbound(prepared):
            self.assertFalse(connection.in_atomic_block)
            request = self.attempt.provider_requests.get()
            self.assertIsNotNone(request.submitted_at)
            self.assertIsNone(request.raw_received_at)
            self.assertEqual(request.input_hash, hashlib.sha256(original).hexdigest())
            self.assertEqual(prepared.audio.read(), original)
            return raw
        def normalize(value):
            self.assertEqual(self.attempt.provider_requests.get().raw_response, raw)
            return _normalize(value)
        def align(*args):
            self.attempt.refresh_from_db()
            self.assertEqual(self.attempt.transcript['text'], 'hello')
            return align_words(*args)
        with patch('rehearsals.services.processing.has_speech', return_value=True), \
             patch.dict('os.environ', {'OPENAI_API_KEY': 'synthetic-test-key'}), \
             patch('rehearsals.services.transcription.request_raw', side_effect=outbound) as called, \
             patch('rehearsals.services.transcription._normalize', side_effect=normalize), \
             patch('rehearsals.services.processing.align_words', side_effect=align):
            run_attempt(str(self.attempt.pk), revision)
        self.assertEqual(called.call_count, 1)
        self.assertEqual(self.attempt.provider_requests.get().usage, {'seconds': 2})
        public = self.client.get(self.route.removesuffix('process/')).data
        self.assertEqual(public['status'], 'completed')
        self.assertNotIn('private-provider-sentinel', str(public))
        self.assertNotIn('usage', str(public))


from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from django.db import connection, connections


@skipUnless(connection.vendor == 'postgresql', 'Requires real PostgreSQL row locks, not SQLite concurrency')
class ConcurrentProcessingTests(TransactionTestCase):
    def setUp(self):
        deck = Deck.objects.create(title='Synthetic', pdf='synthetic.pdf', page_count=1)
        self.attempt = Attempt.objects.create(deck=deck, audio='synthetic.wav', duration_ms=1000,
            slide_events=[{'slide_index': 0, 'at_ms': 0}])

    def race(self, fn):
        barrier = Barrier(2)
        def run(_):
            try:
                barrier.wait(timeout=10)
                return fn()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run, range(2)))

    def test_concurrent_start_and_claim_allow_only_one_generation_and_worker(self):
        from .services.processing import admit, claim_attempt
        with patch('rehearsals.tasks.process_attempt.delay') as publish:
            results = self.race(lambda: admit(self.attempt.pk, {}).processing_revision)
        self.assertEqual(results, [1, 1])
        self.assertEqual(publish.call_count, 1)
        claims = self.race(lambda: claim_attempt(self.attempt.pk, 1))
        self.assertEqual(sum(claim is not None for claim in claims), 1)

    def test_concurrent_retry_consumes_revision_once(self):
        from .services.processing import admit, ProcessConflict
        Attempt.objects.filter(pk=self.attempt.pk).update(status='failed', processing_state='failed', processing_revision=1)
        def retry():
            try:
                return admit(self.attempt.pk, {'processing_revision': 1}).processing_revision
            except ProcessConflict:
                return 'conflict'
        with patch('rehearsals.tasks.process_attempt.delay') as publish:
            results = self.race(retry)
        self.assertCountEqual(results, [2, 'conflict'])
        self.assertEqual(publish.call_count, 1)

    def test_duplicate_workers_make_only_one_provider_call(self):
        from .services.processing import admit, run_attempt
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            self.attempt.audio.save('synthetic.wav', audio_file())
            self.attempt.duration_ms = 2000
            self.attempt.save(update_fields=['duration_ms'])
            with patch('rehearsals.tasks.process_attempt.delay'):
                admit(self.attempt.pk, {})
            with patch('rehearsals.services.processing.has_speech', return_value=True), \
                 patch.dict('os.environ', {'OPENAI_API_KEY': 'synthetic-test-key'}), \
                 patch('rehearsals.services.transcription.request_raw', return_value={'text': 'hello', 'words': [{'word': 'hello', 'start': 0, 'end': 1}]}) as outbound:
                self.race(lambda: run_attempt(str(self.attempt.pk), 1))
            self.assertEqual(outbound.call_count, 1)
            self.attempt.refresh_from_db()
            self.assertEqual(self.attempt.status, 'completed')
