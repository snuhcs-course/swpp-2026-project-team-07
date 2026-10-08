"""Durable coaching proofs use synthetic saved sources and mocked providers only."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
from threading import Barrier, Event
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, connections, DatabaseError, IntegrityError, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from .models import (Attempt, FeedbackAnalysis, FeedbackJob, FeedbackRequest, FeedbackReservation,
                     DescriptionSet, DescriptionJob, ProviderRequest)
from .services import coaching as service, descriptions, feedback_provider as provider
from .services.alignment import align_words
from .services.feedback import FeedbackError, json_bytes
from .test_descriptions import SyntheticDecks, description_value
from .test_feedback_provider import envelope


class SyntheticCoaching(SyntheticDecks):
    def setUp(self):
        super().setUp()
        broker = patch('rehearsals.tasks.coach_attempt.delay')
        self.coaching_broker = broker.start()
        self.addCleanup(broker.stop)
        whisper = patch('rehearsals.services.transcription.request_raw', side_effect=AssertionError('Whisper forbidden'))
        self.whisper = whisper.start()
        self.addCleanup(whisper.stop)
        self.addCleanup(self.whisper.assert_not_called)
        self.attempt = self.new_attempt()
        self.feedback_url = f'/api/attempts/{self.attempt.pk}/feedback/'

    def new_attempt(self, deck=None):
        words = [{'text': 'Echo', 'start_ms': 100, 'end_ms': 1200},
                 {'text': 'Echo', 'start_ms': 1000, 'end_ms': 1500}]
        events = [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 0, 'at_ms': 1000}, {'slide_index': 0, 'at_ms': 1000}]
        return Attempt.objects.create(deck=deck or self.deck, audio='synthetic/unopened.wav', duration_ms=2000,
            slide_events=events, transcript={'text': 'Echo Echo', 'words': words},
            visits=align_words(words, events, 2000), metrics={'detected_language': 'en'},
            analysis_outcome='speech', status='completed', processing_state='completed', processing_revision=1)

    def admit_feedback(self, attempt=None, payload=None):
        return service.generate((attempt or self.attempt).pk, payload or {})

    def feedback_state(self, attempt=None):
        return service.read((attempt or self.attempt).pk)

    def job(self, analysis):
        analysis.refresh_from_db()
        return analysis.jobs.get(generation=analysis.feedback_revision)

    def card(self, prepared, index=0, **changes):
        segment = next(s for s in prepared.analysis.segments if index in s.word_indexes)
        slide = prepared.descriptions.slides[segment.slide_index]
        return {'category': 'clarity', 'slide_index': segment.slide_index, 'source_id': slide.source_id,
            'transcript_id': prepared.analysis.transcript_id, 'visit_id': segment.visit_id, 'segment_id': segment.segment_id,
            'word_start': index, 'word_end': index, 'speech_quote': 'Echo', 'description_ref': 'summary',
            'slide_quote': slide.summary.text, 'observation': 'Synthetic observation', 'suggestion': 'Synthetic suggestion', **changes}

    def coaching_receipt(self, prepared, *, output=None, status=200, body=None, retry_at=None, complete=True):
        if output is None:
            output = description_value(prepared.analysis) if prepared.stage == 'descriptions' else {'suggestions': [self.card(prepared)]}
        return provider.RawReceipt(prepared.config.provider, prepared.config.model, prepared.stage, prepared.input_hash,
            status, body if body is not None else json_bytes(envelope(prepared.config.provider, output)), complete,
            None if complete else 'response_too_large', retry_at, (('totalTokenCount', 23),))

    def ready(self):
        self.complete()  # Existing checkpoint-2 path; exactly one description call.
        return self.admit_feedback()

    def execute_feedback(self, analysis):
        service.run_coaching(analysis.pk, analysis.feedback_revision)

    def expire(self, analysis, revision=None):
        analysis.jobs.filter(generation=revision or analysis.feedback_revision).update(claimed_at=timezone.now() - timedelta(seconds=361))

    def submit_only(self, analysis):
        value, job, _ = service.claim(analysis.pk, analysis.feedback_revision)
        prepared, request = service.submit(value, job, service._prepared(value, job))
        return value, job, prepared, request


class CoachingTests(SyntheticCoaching, TestCase):
    def test_missing_descriptions_durable_dependency_then_exactly_two_calls(self):
        original = Attempt.objects.filter(pk=self.attempt.pk).values().get()
        analysis = self.admit_feedback()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 0)
            self.assertEqual(self.feedback_state()['state'], 'waiting_descriptions')
            value = self.job(analysis).description_set
            descriptions.run_description(value.pk, value.processing_revision)
            service.recover_coaching()  # Works even if description completion publish is lost.
            self.execute_feedback(analysis)
            self.execute_feedback(analysis)
            self.assertEqual([c.args[0].stage for c in call.call_args_list], ['descriptions', 'coaching'])
        state = self.feedback_state()
        self.assertEqual(state['state'], 'completed')
        self.assertEqual(state['result']['status'], 'accepted')
        self.assertEqual(state['result']['suggestions'][0]['end_ms'], 1200)  # Crosses visit boundary, never clipped.
        self.assertEqual(FeedbackRequest.objects.count(), 2)
        self.assertEqual(FeedbackReservation.objects.count(), 2)
        self.assertEqual(Attempt.objects.filter(pk=self.attempt.pk).values().get(), original)
        self.assertFalse(ProviderRequest.objects.exists())

    def test_cache_hit_only_coaching_and_read_current_post_do_no_work(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_feedback(analysis)
            for path in [self.feedback_url, f'/api/attempts/{self.attempt.pk}/', f'/api/decks/{self.deck.pk}/attempts/']:
                self.assertEqual(self.client.get(path).status_code, 200)
            self.assertEqual(self.client.post(self.feedback_url + 'generate/', {}, format='json').status_code, 200)
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
            self.assertEqual(call.call_args.args[0].stage, 'coaching')
        with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}):
            state = self.feedback_state()
            self.assertEqual(state['state'], 'completed')
            self.assertEqual(state['availability']['state'], 'disabled')
            self.assertEqual(len(state['result']['suggestions']), 1)

    def test_preflight_invalid_no_speech_missing_and_nul_do_not_admit_either_stage(self):
        valid = deepcopy(self.attempt.transcript)
        mutations = [{'transcript': None}, {'analysis_outcome': 'no_speech'},
            {'transcript': {'text': '', 'words': []}, 'visits': align_words([], self.attempt.slide_events, 2000)},
            {'visits': None}, {'visits': []}, {'audience': 'bad\x00context'}, {'audience': 'x' * 501},
            {'transcript': {**valid, 'text': 'bad\x00text'}},
            {'transcript': {**valid, 'words': [{**valid['words'][0], 'end_ms': 2001}]}},
            {'transcript': {**valid, 'words': [{**valid['words'][0], 'original_index': 20}]}},
            {'metrics': {'detected_language': 'bad\x00language'}}]
        with patch.object(provider, 'request_raw') as call, patch.object(descriptions, 'prepare_saved') as prepare:
            for mutation in mutations:
                attempt = self.new_attempt()
                original = Attempt.objects.filter(pk=attempt.pk).values().get()
                preflight = service.prepare_attempt

                def malformed_source(saved):
                    # PostgreSQL cannot store NUL in text/JSONB. Inject at the
                    # read/preflight boundary, then run the real validator.
                    for field, value in mutation.items():
                        setattr(saved, field, value)
                    return preflight(saved)

                with self.subTest(mutation=mutation), patch.object(service, 'prepare_attempt', side_effect=malformed_source):
                    with self.assertRaises(FeedbackError):
                        self.admit_feedback(attempt)
                self.assertEqual(Attempt.objects.filter(pk=attempt.pk).values().get(), original)
            call.assert_not_called()
            prepare.assert_not_called()
        self.assertFalse(FeedbackAnalysis.objects.exists())
        self.assertFalse(DescriptionSet.objects.exists())
        self.assertFalse(DescriptionJob.objects.exists())
        self.assertFalse(FeedbackRequest.objects.exists())

    def test_source_slide_nul_rejected_before_description_persistence(self):
        preflight = service.prepare_attempt

        def malformed_source(attempt):
            slides = list(attempt.deck.slides.all())
            slides[0].extracted_text = 'NUL\x00source'
            with patch.object(type(attempt.deck.slides), 'all', return_value=slides):
                return preflight(attempt)

        with patch.object(service, 'prepare_attempt', side_effect=malformed_source), \
                patch.object(descriptions, 'prepare_saved') as prepare, patch.object(provider, 'request_raw') as call:
            with self.assertRaises(FeedbackError):
                self.admit_feedback()
            call.assert_not_called()
            prepare.assert_not_called()
        self.assertEqual(self.deck.slides.get().extracted_text, 'Synthetic slide one')
        self.assertFalse(FeedbackAnalysis.objects.exists())
        self.assertFalse(DescriptionSet.objects.exists())
        self.assertFalse(DescriptionJob.objects.exists())
        self.assertFalse(FeedbackRequest.objects.exists())

    def test_dependency_transitions_advance_public_feedback_freshness_without_changing_its_job(self):
        analysis = self.admit_feedback()
        value = self.job(analysis).description_set
        original_job = FeedbackJob.objects.filter(pk=self.job(analysis).pk).values().get()
        previous = self.feedback_state()
        clock = timezone.now()

        def check(state):
            nonlocal previous
            current = self.feedback_state()
            self.assertEqual(current['dependency']['state'], state)
            self.assertGreater(current['updated_at'], previous['updated_at'])
            self.assertEqual(current['dependency']['updated_at'], current['updated_at'])
            self.assertEqual(current['feedback_revision'], 1)
            self.assertEqual(current['state'], 'waiting_descriptions')
            self.assertEqual(FeedbackJob.objects.filter(pk=self.job(analysis).pk).values().get(), original_job)
            previous = current
            return current

        with patch.object(provider, 'request_raw') as call:
            with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=1)):
                value, job, request = descriptions.claim(value.pk, 1)
                check('preparing')
            with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=2)):
                deck, _ = descriptions.prepare_saved(value.deck_id)
                prepared = descriptions.submit(value, job, descriptions.Selection.saved(value).adapter().prepare_descriptions(deck))
                check('submitted')
            with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=362)):
                descriptions.recover_descriptions()
                current = check('needs_confirmation')
                self.assertTrue(current['dependency']['requires_confirmation'])
                self.assertEqual(current['dependency']['retry_action'], 'generate_descriptions')
                response = self.client.get(self.feedback_url).json()
                nested = self.client.get(f'/api/attempts/{self.attempt.pk}/').json()['feedback_analysis']
                self.assertEqual(response['updated_at'], nested['updated_at'])
                self.assertEqual(response['dependency'], nested['dependency'])
            with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=363)):
                # Late durable output can resolve uncertainty within the same
                # generation. Its lower state rank must have newer freshness.
                descriptions.save_receipt(value, job, request, self.coaching_receipt(prepared))
                check('queued')
            with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=364)):
                descriptions.run_description(value.pk, 1)
                check('completed')
            call.assert_not_called()

    def test_stale_current_coaching_receipts_advance_freshness_without_publishing_results(self):
        self.complete()
        for expired in [False, True]:
            with self.subTest(expired=expired), patch.object(provider, 'request_raw') as call:
                attempt = self.new_attempt()
                analysis = self.admit_feedback(attempt)
                value, job, prepared, request = self.submit_only(analysis)
                clock = timezone.now()
                with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=1)):
                    descriptions.edit(value.deck_id, self.edited(value))
                if expired:
                    with patch('django.utils.timezone.now', return_value=clock + timedelta(seconds=362)):
                        service.recover_coaching()
                before = self.feedback_state(attempt)
                self.assertEqual(before['state'], 'stale')
                self.assertTrue(before['requires_confirmation'])
                old_set = DescriptionSet.objects.filter(pk=value.pk).values().get()
                old_job = FeedbackJob.objects.filter(pk=job.pk).values().get()
                receipt = self.coaching_receipt(prepared)
                received_at = clock + timedelta(seconds=363 if expired else 2)
                with patch('django.utils.timezone.now', return_value=received_at):
                    service.save_receipt(value, job, request, receipt)
                received = self.feedback_state(attempt)
                self.assertFalse(received['requires_confirmation'])
                self.assertGreater(received['updated_at'], before['updated_at'])
                self.assertEqual(received['updated_at'], received_at)
                self.assertEqual(received['received_at'], received_at)
                self.assertEqual(FeedbackJob.objects.filter(pk=job.pk).values().get(), old_job)
                completed_at = received_at + timedelta(microseconds=100)
                with patch('django.utils.timezone.now', return_value=completed_at):
                    service.finish(value, job, result=provider.normalize(prepared, receipt))
                final = self.feedback_state(attempt)
                self.assertGreater(final['updated_at'], received['updated_at'])
                self.assertEqual(final['updated_at'], completed_at)
                self.assertEqual(final['feedback_revision'], 1)
                self.assertEqual(final['state'], 'stale')
                self.assertFalse(final['requires_confirmation'])
                self.assertIsNone(final['result'])
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'completed')
                self.assertEqual(bytes(request.raw_body), receipt.body)
                self.assertEqual(request.usage, dict(receipt.usage))
                # Reads expose the same receipt freshness without writes or work.
                response = self.client.get(f'/api/attempts/{attempt.pk}/feedback/').json()
                nested = self.client.get(f'/api/attempts/{attempt.pk}/').json()['feedback_analysis']
                history = self.client.get(f'/api/decks/{value.deck_id}/attempts/').json()
                self.assertEqual(response, nested)
                self.assertEqual(response, next(a for a in history if a['attempt_id'] == str(attempt.pk))['feedback_analysis'])
                with patch('django.utils.timezone.now', return_value=completed_at + timedelta(seconds=1)):
                    service.save_receipt(value, job, request, receipt)
                self.assertEqual(self.feedback_state(attempt), final)
                self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), old_set)
                if expired:  # Finalization can update only request evidence, not the job.
                    self.assertEqual(FeedbackJob.objects.filter(pk=job.pk).values().get(), old_job)
                call.assert_not_called()

    def test_disabled_missing_key_and_quotas_no_calls(self):
        for env in [{'FEEDBACK_ENABLED': 'false'}, {'GEMINI_API_KEY': ''}, {'FEEDBACK_GEMINI_TPM': ''}]:
            with patch.dict('os.environ', env), patch.object(provider, 'request_raw') as call:
                with self.assertRaises(FeedbackError):
                    self.admit_feedback()
                call.assert_not_called()
        self.assertFalse(FeedbackAnalysis.objects.exists())

    def test_saved_provider_scope_model_and_key_rotation(self):
        analysis = self.admit_feedback()
        value = self.job(analysis).description_set
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai', 'FEEDBACK_GEMINI_MODEL': 'new-model', 'GEMINI_API_KEY': 'rotated-synthetic'}), \
                patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            descriptions.run_description(value.pk, 1)
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 2)
            for invocation in call.call_args_list:
                self.assertEqual(invocation.args[0].config.provider, 'gemini')
                self.assertEqual(invocation.args[0].config.model, 'gemini-3.1-flash-lite')
                self.assertEqual(invocation.args[0].config.key, 'rotated-synthetic')
        self.assertEqual(self.feedback_state()['state'], 'completed')

    def test_different_provider_cached_description_not_reused(self):
        self.complete()
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}):
            analysis = self.admit_feedback()
        value = self.job(analysis).description_set
        self.assertEqual(value.provider, 'openai')
        self.assertIsNone(value.descriptions)
        self.assertEqual(DescriptionSet.objects.count(), 2)
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            descriptions.run_description(value.pk, 1)
            self.execute_feedback(analysis)
            self.assertEqual([c.args[0].config.provider for c in call.call_args_list], ['openai', 'openai'])

    def test_queued_disabled_or_project_mismatch_never_calls_and_retry_preserves_selection(self):
        for env in [{'FEEDBACK_ENABLED': 'false'}, {'FEEDBACK_GEMINI_PROJECT_ID': 'other-project'}, {'GEMINI_API_KEY': ''}]:
            with self.subTest(env=env):
                attempt = self.new_attempt()
                self.complete() if not DescriptionSet.objects.filter(descriptions__isnull=False).exists() else None
                analysis = self.admit_feedback(attempt)
                with patch.dict('os.environ', env), patch.object(provider, 'request_raw') as call:
                    self.execute_feedback(analysis)
                    call.assert_not_called()
                self.assertEqual(self.feedback_state(attempt)['state'], 'failed')
                with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}):
                    analysis = self.admit_feedback(attempt, {'feedback_revision': 1})
                with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
                    self.execute_feedback(analysis)
                    self.assertEqual(call.call_count, 1)
                    self.assertEqual(call.call_args.args[0].config.provider, 'gemini')

    def test_dependency_failure_uses_its_own_explicit_retry_revision(self):
        analysis = self.admit_feedback()
        value = self.job(analysis).description_set
        admitted = self.feedback_state()
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.coaching_receipt(p, status=401)) as call:
            descriptions.run_description(value.pk, 1)
            service.recover_coaching()
            self.execute_feedback(analysis)
            self.admit_feedback()
            self.assertEqual(call.call_count, 1)
        failed = self.feedback_state()
        self.assertGreater(failed['updated_at'], admitted['updated_at'])
        dep = failed['dependency']
        self.assertEqual(dep['updated_at'], failed['updated_at'])
        self.assertEqual(dep['retry_action'], 'generate_descriptions')
        self.assertEqual(dep['processing_revision'], 1)
        self.assertEqual(dep['description_set_id'], str(value.pk))
        descriptions.generate(value.deck_id, {'description_set_id': str(value.pk), 'processing_revision': 1})
        retried = self.feedback_state()
        self.assertGreater(retried['updated_at'], failed['updated_at'])
        self.assertEqual(retried['dependency']['processing_revision'], 2)
        self.assertEqual(retried['dependency']['state'], 'queued')
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            descriptions.run_description(value.pk, 2)
            service.recover_coaching()
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 2)
        self.assertEqual(self.feedback_state()['feedback_revision'], 1)
        self.assertEqual(self.feedback_state()['state'], 'completed')

    def test_uncertain_dependency_cannot_be_retried_by_feedback_ack(self):
        analysis = self.admit_feedback()
        value = self.job(analysis).description_set
        with patch.object(provider, 'request_raw', side_effect=FeedbackError('timeout', uncertain=True)) as call:
            descriptions.run_description(value.pk, 1)
            self.admit_feedback(payload={'feedback_revision': 1, 'acknowledge_uncertain': True})
            service.recover_coaching()
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        dep = self.feedback_state()['dependency']
        self.assertTrue(dep['requires_confirmation'])
        with self.assertRaises(descriptions.Conflict):
            descriptions.generate(value.deck_id, {'description_set_id': str(value.pk), 'processing_revision': 1})
        self.assertEqual(DescriptionJob.objects.count(), 1)

    def test_result_distinctions_and_repeated_original_indexes(self):
        self.complete()
        for mode in ['accepted', 'partial', 'empty', 'all_invalid']:
            attempt = self.new_attempt()
            analysis = self.admit_feedback(attempt)
            def send(p):
                cards = [] if mode == 'empty' else [self.card(p, 1)]
                if mode == 'partial':
                    cards.append(self.card(p, 0, speech_quote='invented'))
                if mode == 'all_invalid':
                    cards[0]['source_id'] = '0' * 64
                return self.coaching_receipt(p, output={'suggestions': cards})
            with patch.object(provider, 'request_raw', side_effect=send) as call:
                self.execute_feedback(analysis)
                self.execute_feedback(analysis)
                self.assertEqual(call.call_count, 1)
            state = self.feedback_state(attempt)
            self.assertEqual(state['result']['status'], mode)
            self.assertEqual(state['state'], 'failed' if mode == 'all_invalid' else 'completed')
            if mode in {'accepted', 'partial'}:
                card = state['result']['suggestions'][0]
                self.assertEqual((card['word_start'], card['visit_id'], card['start_ms']), (1, 2, 1000))
            self.assertEqual(state['result']['discarded_count'], int(mode in {'partial', 'all_invalid'}))

    def test_malformed_refusal_truncation_nul_and_unsupported_envelopes_fail_once(self):
        self.complete()
        for mode in ['malformed', 'refusal', 'truncated', 'nul_observation', 'nul_suggestion', 'extras']:
            attempt = self.new_attempt()
            analysis = self.admit_feedback(attempt)
            def send(p):
                if mode == 'malformed':
                    return self.coaching_receipt(p, body=b'not JSON')
                body = envelope(p.config.provider, {'suggestions': [self.card(p)]})
                if mode == 'refusal':
                    body = {'promptFeedback': {'blockReason': 'SAFETY'}}
                elif mode == 'truncated':
                    body['candidates'][0]['finishReason'] = 'MAX_TOKENS'
                elif mode.startswith('nul_'):
                    return self.coaching_receipt(p, output={'suggestions': [self.card(p, **{mode[4:]: 'bad\x00text'})]})
                elif mode == 'extras':
                    return self.coaching_receipt(p, output={'suggestions': [], 'execute': 'untrusted'})
                return self.coaching_receipt(p, body=json_bytes(body))
            with patch.object(provider, 'request_raw', side_effect=send) as call:
                self.execute_feedback(analysis)
                service.recover_coaching()
                self.execute_feedback(analysis)
                self.assertEqual(call.call_count, 1)
            state = self.feedback_state(attempt)
            self.assertEqual(state['state'], 'failed')
            self.assertIsNone(state['result'])
            request = FeedbackRequest.objects.get(coaching_job__analysis=analysis)
            self.assertIsNotNone(request.received_at)
            self.assertEqual(request.outcome, 'invalid')
            self.assertIsNotNone(request.completed_at)

    def test_edit_retains_stale_result_and_explicit_reanalysis_uses_edited_revision(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_feedback(analysis)
            original = deepcopy(self.feedback_state()['result'])
            value = self.job(analysis).description_set
            descriptions.edit(value.deck_id, self.edited(value))
            state = self.feedback_state()
            self.assertEqual(state['state'], 'stale')
            self.assertTrue(state['result']['stale'])
            self.assertEqual(state['result']['suggestions'], original['suggestions'])
            self.execute_feedback(analysis)
            with self.assertRaises(service.Conflict):
                self.admit_feedback()
            analysis = self.admit_feedback(payload={'feedback_revision': 1})
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 2)
            self.assertEqual(call.call_args.args[0].descriptions.slides[0].summary.text, 'User correction')
        state = self.feedback_state()
        self.assertFalse(state['stale'])
        self.assertEqual(state['description_revision'], 2)
        self.assertEqual(state['feedback_revision'], 2)
        self.assertEqual(self.attempt.processing_revision, 1)

    def test_failed_reanalysis_exposes_prior_suggestions_and_current_invalid_counts(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        before = self.feedback_state()['result']
        value = self.job(analysis).description_set
        descriptions.edit(value.deck_id, self.edited(value))
        analysis = self.admit_feedback(payload={'feedback_revision': 1})
        waiting = self.feedback_state()
        self.assertEqual(waiting['state'], 'queued')
        self.assertEqual(waiting['result']['suggestions'], before['suggestions'])
        self.assertTrue(waiting['result']['stale'])
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.coaching_receipt(p,
                output={'suggestions': [self.card(p, speech_quote='Unsupported')]})) as call:
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        state = self.feedback_state()
        self.assertEqual(state['state'], 'failed')
        self.assertEqual(state['last_output'], {'status': 'all_invalid', 'accepted_count': 0, 'discarded_count': 1})
        self.assertEqual(state['result']['suggestions'], before['suggestions'])
        self.assertEqual(state['result']['description_revision'], 1)
        self.assertEqual(state['description_revision'], 2)
        self.assertTrue(state['result']['stale'])

    def test_edit_fences_queued_work_only_in_affected_scope(self):
        analysis = self.ready()
        other_attempt = self.new_attempt(self.new_deck('other'))
        other = self.admit_feedback(other_attempt)
        value = self.job(analysis).description_set
        descriptions.edit(value.deck_id, self.edited(value))
        with patch.object(provider, 'request_raw') as call:
            self.execute_feedback(analysis)
            service.recover_coaching()
            call.assert_not_called()
        self.assertEqual(self.feedback_state()['state'], 'stale')
        self.assertEqual(self.feedback_state(other_attempt)['state'], 'waiting_descriptions')
        self.assertEqual(self.job(other).generation, 1)

    def test_edit_while_waiting_descriptions_requires_explicit_reanalysis(self):
        analysis = self.admit_feedback()
        value = self.job(analysis).description_set
        descriptions.edit(value.deck_id, self.edited(value))
        with patch.object(provider, 'request_raw') as call:
            self.execute_feedback(analysis)
            call.assert_not_called()
        self.assertEqual(self.feedback_state()['state'], 'stale')
        retry = self.admit_feedback(payload={'feedback_revision': 1})
        self.assertEqual(self.job(retry).description_revision, 1)

    def test_retries_are_single_consumption_and_uncertainty_requires_ack(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=FeedbackError('timeout', uncertain=True)) as call:
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        for payload in [{}, {'feedback_revision': 0}, {'feedback_revision': 1}]:
            with self.assertRaises(service.Conflict):
                self.admit_feedback(payload=payload)
        self.assertTrue(self.feedback_state()['requires_confirmation'])
        analysis = self.admit_feedback(payload={'feedback_revision': 1, 'acknowledge_uncertain': True})
        with self.assertRaises(service.Conflict):
            self.admit_feedback(payload={'feedback_revision': 1, 'acknowledge_uncertain': True})
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        self.assertEqual(FeedbackRequest.objects.filter(stage='coaching').count(), 2)
        self.assertEqual(FeedbackReservation.objects.filter(request__stage='coaching', released_at__isnull=True).count(), 2)

    def test_shared_quota_and_429_cooldown_apply_across_stages(self):
        analysis = self.ready()
        until = timezone.now() + timedelta(minutes=2)
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.coaching_receipt(p, status=429, retry_at=until)) as call:
            self.execute_feedback(analysis)
            other = descriptions.generate(self.new_deck('shared').pk, {})
            descriptions.run_description(other.pk, 1)
            self.assertEqual(call.call_count, 1)
        self.assertEqual(descriptions.read(other.deck_id, other.pk)['state'], 'waiting_quota')
        self.assertEqual(self.feedback_state()['retry_at'], until)
        self.assertFalse(self.feedback_state()['retry_available'])
        with self.assertRaises(service.Conflict):
            self.admit_feedback(payload={'feedback_revision': 1})

    def test_description_reservation_causes_coaching_local_wait_then_safe_resume(self):
        analysis = self.ready()
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_RPM': '1'}), patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 0)
            self.assertEqual(self.feedback_state()['state'], 'waiting_quota')
            FeedbackReservation.objects.update(reserved_at=timezone.now() - timedelta(seconds=61))
            analysis.jobs.update(retry_at=timezone.now() - timedelta(seconds=1))
            service.recover_coaching()
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        self.assertEqual(self.feedback_state()['state'], 'completed')

    def test_strict_bounded_api_and_allowlisted_public_result(self):
        for payload in [{'provider': 'openai'}, {'model': 'other'}, {'feedback_revision': True},
                        {'feedback_revision': -1}, {'feedback_revision': 2**31}, [],
                        {'feedback_revision': 1, 'acknowledge_uncertain': 1}]:
            self.assertEqual(self.client.post(self.feedback_url + 'generate/', payload, format='json').status_code, 400)
        for raw in ['{"feedback_revision":1,"feedback_revision":1}', '{' + ' ' * 1025 + '}']:
            self.assertEqual(self.client.post(self.feedback_url + 'generate/', raw, content_type='application/json').status_code, 400)
        analysis = self.ready()
        self.assertEqual(self.client.post(self.feedback_url + 'generate/', {}, format='json').status_code, 202)
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        raw = self.client.get(self.feedback_url).content.decode()
        for name in ['input_hash', 'claim_token', 'raw_body', 'source_snapshot', 'attempt_identity', 'synthetic-key']:
            self.assertNotIn(name, raw)
        nested = self.client.get(f'/api/attempts/{self.attempt.pk}/').json()
        self.assertEqual(nested['feedback'], [])  # Legacy shape preserved, never duplicate cards.
        self.assertEqual(nested['feedback_analysis']['result']['status'], 'accepted')
        self.assertEqual(nested['transcript_id'], self.feedback_state()['result']['evidence']['transcript_id'])

    def test_public_transcript_identity_uses_typed_order_not_jsonb_object_key_order(self):
        transcript = self.attempt.transcript
        # PostgreSQL JSONB orders word object keys differently from the typed
        # adapter. Simulate that ordering on SQLite as well.
        reordered = {'words': [{'end_ms': w['end_ms'], 'text': w['text'], 'start_ms': w['start_ms']}
                              for w in transcript['words']], 'text': transcript['text']}
        Attempt.objects.filter(pk=self.attempt.pk).update(transcript=reordered)
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        response = self.client.get(f'/api/attempts/{self.attempt.pk}/').json()
        self.assertEqual(response['transcript_id'], response['feedback_analysis']['result']['evidence']['transcript_id'])

    def test_uncertain_ack_without_revision_is_a_revision_conflict(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=FeedbackError('timeout', uncertain=True)):
            self.execute_feedback(analysis)
        response = self.client.post(self.feedback_url + 'generate/', {'acknowledge_uncertain': True}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'revision_required')

    def test_unsorted_original_words_keep_indexes_and_saved_copies_must_agree(self):
        words = list(reversed(self.attempt.transcript['words']))
        self.attempt.transcript = {'text': 'Echo Echo', 'words': words}
        self.attempt.visits = align_words(words, self.attempt.slide_events, 2000)
        self.attempt.save(update_fields=['transcript', 'visits'])
        source = service.prepare_attempt(self.attempt)
        self.assertEqual([v['word_indexes'] for v in source['visits']], [[1], [], [0]])
        self.attempt.visits[0]['words'][0]['text'] = 'Not the saved source'
        with self.assertRaises(FeedbackError):
            service.prepare_attempt(self.attempt)

    def test_request_database_exactly_one_owner_and_matching_stage(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        request = FeedbackRequest.objects.get(stage='coaching')
        desc_job = DescriptionJob.objects.first()
        for update in [{'job': desc_job}, {'coaching_job': None}, {'stage': 'descriptions'}]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                FeedbackRequest.objects.filter(pk=request.pk).update(**update)


class PendingCoachingReceiptTests(SyntheticCoaching, TestCase):
    """Pause between durable receipt and normalization; no outbound transport."""

    def pending_receipt(self, **options):
        analysis = self.admit_feedback(self.new_attempt())
        value, job, prepared, request = self.submit_only(analysis)
        receipt = self.coaching_receipt(prepared, **options)
        service.save_receipt(value, job, request, receipt)
        return analysis, value, job, request, receipt

    def assert_edited_retry(self, *, status=200, complete=True, outcome, error_code=''):
        with patch.object(provider, 'request_raw') as call:
            analysis, value, job, request, receipt = self.pending_receipt(status=status, complete=complete)
            url = f'/api/attempts/{analysis.attempt_id}/feedback/'
            descriptions.edit(value.deck_id, self.edited(value))
            original_source = Attempt.objects.filter(pk=analysis.attempt_id).values().get()
            state = self.client.get(url).json()
            uncertain = outcome == 'uncertain'
            self.assertEqual(state['state'], 'stale')
            self.assertEqual(state['feedback_revision'], 1)
            self.assertEqual(state['requires_confirmation'], uncertain)
            request.refresh_from_db()
            self.assertEqual(request.outcome, 'received')  # GET did not normalize.
            self.assertIsNone(request.completed_at)
            if uncertain:
                for payload in [{'feedback_revision': 1}, {'feedback_revision': 1, 'acknowledge_uncertain': False}]:
                    response = self.client.post(url + 'generate/', payload, format='json')
                    self.assertEqual(response.status_code, 409)
                    self.assertEqual(response.json()['error']['code'], 'confirmation_required')
                self.assertEqual(analysis.jobs.count(), 1)
            # Exact revision and acknowledgement still admit only one new job.
            payload = {'feedback_revision': 1}
            if uncertain:
                payload['acknowledge_uncertain'] = True
            response = self.client.post(url + 'generate/', payload, format='json')
            self.assertEqual(response.status_code, 202)
            self.assertEqual(response.json()['feedback_revision'], 2)
            self.assertEqual(response.json()['description_revision'], value.description_revision + 1)
            replay = self.client.post(url + 'generate/', payload, format='json')
            self.assertEqual(replay.status_code, 409)
            self.assertEqual(replay.json()['error']['code'], 'stale_revision')
            current = analysis.jobs.filter(generation=2).values().get()
            edited = DescriptionSet.objects.filter(pk=value.pk).values().get()
            # The original receipt is finalized once, even after the retry/edit.
            self.expire(analysis, revision=1)
            with patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                service.recover_coaching()
                service.run_coaching(analysis.pk, 1)
                service.run_coaching(analysis.pk, 1)
                self.assertEqual(normalize.call_count, 1)
            request.refresh_from_db()
            self.assertEqual(request.outcome, outcome)
            self.assertEqual(request.error_code, error_code)
            self.assertIsNotNone(request.completed_at)
            self.assertEqual(bytes(request.raw_body), receipt.body)
            self.assertEqual(request.usage, dict(receipt.usage))
            self.assertTrue(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).exists())
            self.assertEqual(FeedbackRequest.objects.filter(coaching_job__analysis=analysis).count(), 1)
            self.assertIsNone(FeedbackJob.objects.get(pk=job.pk).result)
            self.assertEqual(analysis.jobs.filter(generation=2).values().get(), current)
            self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), edited)
            self.assertEqual(Attempt.objects.filter(pk=analysis.attempt_id).values().get(), original_source)
            call.assert_not_called()

    def test_saved_500_before_normalization_then_edit_requires_ack(self):
        self.complete()
        self.assert_edited_retry(status=500, outcome='uncertain', error_code='provider_error')

    def test_incomplete_200_before_normalization_then_edit_requires_ack(self):
        self.complete()
        self.assert_edited_retry(complete=False, outcome='uncertain', error_code='response_too_large')

    def test_pending_408_and_5xx_require_ack_regardless_of_body_completeness(self):
        self.complete()
        for status, error_code in [(408, 'provider_rejected'), (500, 'provider_error'), (503, 'provider_error')]:
            for complete in [True, False]:
                with self.subTest(status=status, complete=complete):
                    self.assert_edited_retry(status=status, complete=complete, outcome='uncertain', error_code=error_code)

    def test_pending_complete_success_and_known_rejections_do_not_require_ack(self):
        self.complete()
        self.assert_edited_retry(outcome='completed')
        for status, error_code in [(302, 'provider_rejected'), (400, 'provider_rejected'),
                                   (401, 'provider_auth'), (403, 'provider_auth'), (429, 'provider_rate_limit')]:
            for complete in [True, False]:
                with self.subTest(status=status, complete=complete):
                    self.assert_edited_retry(status=status, complete=complete, outcome='rejected', error_code=error_code)

    def test_pending_uncertainty_survives_same_generation_recovery_and_source_staleness(self):
        self.complete()
        for options in [{'status': 500}, {'complete': False}]:
            with self.subTest(options=options), patch.object(provider, 'request_raw') as call:
                analysis, value, _, request, receipt = self.pending_receipt(**options)
                url = f'/api/attempts/{analysis.attempt_id}/feedback/'
                # A source-freshness fixture exercises the other invalidation
                # path without editing the saved recording or transcript.
                with patch.object(service, '_source_current', return_value=False):
                    self.assertTrue(self.client.get(url).json()['requires_confirmation'])
                    response = self.client.post(url + 'generate/', {'feedback_revision': 1}, format='json')
                    self.assertEqual(response.status_code, 409)
                    self.assertEqual(response.json()['error']['code'], 'confirmation_required')
                descriptions.edit(value.deck_id, self.edited(value))
                self.expire(analysis)
                service.recover_coaching()
                self.execute_feedback(analysis)
                state = self.client.get(url).json()
                self.assertEqual(state['state'], 'stale')
                self.assertTrue(state['requires_confirmation'])
                self.assertEqual(state['feedback_revision'], 1)
                self.assertIsNone(state['result'])
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'uncertain')
                self.assertEqual(bytes(request.raw_body), receipt.body)
                self.assertEqual(request.usage, dict(receipt.usage))
                self.assertEqual(analysis.jobs.count(), 1)
                call.assert_not_called()

    def test_pending_incomplete_429_preserves_cooldown_without_uncertainty(self):
        self.complete()
        until = timezone.now() + timedelta(minutes=2)
        with patch.object(provider, 'request_raw') as call:
            analysis, value, _, _, _ = self.pending_receipt(status=429, complete=False, retry_at=until)
            descriptions.edit(value.deck_id, self.edited(value))
            state = service.read(analysis.attempt_id)
            self.assertFalse(state['requires_confirmation'])
            self.assertFalse(state['retry_available'])
            self.assertEqual(state['retry_at'], until)
            with self.assertRaises(service.Conflict) as caught:
                service.generate(analysis.attempt_id, {'feedback_revision': 1})
            self.assertEqual(caught.exception.code, 'retry_not_available')
            self.assertEqual(analysis.jobs.count(), 1)
            call.assert_not_called()


class CoachingRecoveryTests(SyntheticCoaching, TransactionTestCase):
    def test_lost_broker_claim_expiry_and_duplicate_delivery(self):
        self.complete()
        with patch.object(service, 'publish') as publish:
            analysis = self.admit_feedback()
            publish.assert_called_once()
        service.claim(analysis.pk, 1)  # Interrupted before submission.
        self.expire(analysis)
        self.coaching_broker.reset_mock()
        service.recover_coaching()
        self.coaching_broker.assert_called_once_with(analysis.pk, 1)
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.execute_feedback(analysis)
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        self.assertEqual(self.feedback_state()['state'], 'completed')

    def test_real_publish_failure_keeps_committed_intent(self):
        self.complete()
        with patch('rehearsals.tasks.coach_attempt.delay', side_effect=RuntimeError('Synthetic broker unavailable')):
            analysis = self.admit_feedback()
        self.assertEqual(self.job(analysis).state, 'queued')
        self.coaching_broker.reset_mock()
        service.recover_coaching()
        self.coaching_broker.assert_called_once_with(analysis.pk, 1)

    def test_submitted_expiry_keeps_reservation_and_requires_confirmation(self):
        analysis = self.ready()
        _, _, _, request = self.submit_only(analysis)
        self.expire(analysis)
        with patch.object(provider, 'request_raw') as call:
            service.recover_coaching()
            self.execute_feedback(analysis)
            call.assert_not_called()
        self.assertEqual(self.feedback_state()['state'], 'needs_confirmation')
        self.assertTrue(self.feedback_state()['requires_confirmation'])
        self.assertTrue(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).exists())

    def test_submission_persistence_failure_prevents_outbound_even_ack_loss(self):
        for committed in [False, True]:
            attempt = self.new_attempt()
            if not DescriptionSet.objects.filter(descriptions__isnull=False).exists():
                self.complete()
            analysis = self.admit_feedback(attempt)
            real_submit = service.submit
            def submit(*args):
                if committed:
                    real_submit(*args)
                raise DatabaseError('Synthetic persistence fault')
            with patch.object(service, 'submit', side_effect=submit), patch.object(provider, 'request_raw') as call:
                self.execute_feedback(analysis)
                call.assert_not_called()
            self.expire(analysis)
            service.recover_coaching()
            self.assertEqual(self.feedback_state(attempt)['state'], 'needs_confirmation' if committed else 'queued')

    def test_receipt_save_failure_never_normalizes_in_memory_or_recharges(self):
        for committed in [False, True]:
            attempt = self.new_attempt()
            if not DescriptionSet.objects.filter(descriptions__isnull=False).exists():
                self.complete()
            analysis = self.admit_feedback(attempt)
            original = service.save_receipt
            def save(*args, **kwargs):
                if committed:
                    original(*args, **kwargs)
                raise DatabaseError('Synthetic receipt acknowledgement failure')
            with patch.object(service, 'save_receipt', side_effect=save), \
                    patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call, \
                    patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                self.execute_feedback(analysis)
                self.assertEqual(call.call_count, 1)
                normalize.assert_not_called()
            self.expire(analysis)
            with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}), \
                    patch.object(descriptions, 'prepare_saved', side_effect=AssertionError('No media on receipt recovery')), \
                    patch.object(provider, 'request_raw') as call:
                service.recover_coaching()
                self.execute_feedback(analysis)
                call.assert_not_called()
            self.assertEqual(self.feedback_state(attempt)['state'], 'completed' if committed else 'needs_confirmation')

    def test_completion_write_and_commit_failures_recover_saved_receipt_once(self):
        for point in ['row', 'commit']:
            attempt = self.new_attempt()
            if not DescriptionSet.objects.filter(descriptions__isnull=False).exists():
                self.complete()
            analysis = self.admit_feedback(attempt)
            original_save, original_commit = FeedbackJob.save, connection.commit
            def save(job, *args, **kwargs):
                if job.state == 'completed':
                    raise DatabaseError('Synthetic completion row failure')
                return original_save(job, *args, **kwargs)
            fired = False
            def commit():
                nonlocal fired
                if not fired and FeedbackJob.objects.filter(analysis=analysis, state='completed').exists():
                    fired = True
                    raise DatabaseError('Synthetic completion commit failure')
                return original_commit()
            seam = patch.object(FeedbackJob, 'save', new=save) if point == 'row' else patch.object(connection, 'commit', side_effect=commit)
            with seam, patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
                self.execute_feedback(analysis)
                self.assertEqual(call.call_count, 1)
            request = FeedbackRequest.objects.get(coaching_job__analysis=analysis)
            self.assertEqual(request.outcome, 'received')
            self.assertIsNone(request.completed_at)
            self.assertIsNotNone(request.received_at)
            self.expire(analysis)
            with patch.object(provider, 'request_raw') as call:
                service.recover_coaching()
                self.execute_feedback(analysis)
                call.assert_not_called()
            self.assertEqual(self.feedback_state(attempt)['state'], 'completed')

    def test_late_old_receipt_after_acknowledged_retry_or_edit_finalizes_only_old_evidence(self):
        self.complete()
        for replacement in ['queued_retry', 'completed_retry', 'edit']:
            attempt = self.new_attempt()
            analysis = self.admit_feedback(attempt)
            value, job, prepared, request = self.submit_only(analysis)
            self.expire(analysis)
            service.recover_coaching()
            self.assertTrue(self.feedback_state(attempt)['requires_confirmation'])
            if replacement == 'edit':
                descriptions.edit(value.deck_id, self.edited(value))
                self.assertTrue(self.feedback_state(attempt)['requires_confirmation'])
                with self.assertRaises(service.Conflict):
                    self.admit_feedback(attempt, {'feedback_revision': 1})
            else:
                analysis = self.admit_feedback(attempt, {'feedback_revision': 1, 'acknowledge_uncertain': True})
                if replacement == 'completed_retry':
                    with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
                        self.execute_feedback(analysis)
            before_public = self.feedback_state(attempt)
            service.save_receipt(value, job, request, self.coaching_receipt(prepared))
            if replacement != 'edit':
                self.assertEqual(self.feedback_state(attempt), before_public)
            before_set = DescriptionSet.objects.filter(pk=value.pk).values().get()
            before_new = analysis.jobs.filter(generation=2).values().first()
            with patch.object(provider, 'request_raw') as call, patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                service.recover_coaching()
                service.run_coaching(analysis.pk, 1)
                service.run_coaching(analysis.pk, 1)
                call.assert_not_called()
                self.assertEqual(normalize.call_count, 1)
            request.refresh_from_db()
            self.assertEqual(request.outcome, 'completed')
            self.assertIsNotNone(request.completed_at)
            self.assertIsNone(analysis.jobs.get(generation=1).result)
            self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), before_set)
            self.assertEqual(analysis.jobs.filter(generation=2).values().first(), before_new)
            if replacement != 'edit':
                self.assertEqual(self.feedback_state(attempt), before_public)

    def test_edit_during_response_preserves_raw_usage_but_no_current_result(self):
        analysis = self.ready()
        value = self.job(analysis).description_set
        def send(p):
            self.assertFalse(connection.in_atomic_block)
            descriptions.edit(value.deck_id, self.edited(value))
            return self.coaching_receipt(p)
        with patch.object(provider, 'request_raw', side_effect=send) as call:
            self.execute_feedback(analysis)
            self.assertEqual(call.call_count, 1)
        state = self.feedback_state()
        self.assertEqual(state['state'], 'stale')
        self.assertFalse(state['requires_confirmation'])
        self.assertIsNone(state['result'])
        request = FeedbackRequest.objects.get(stage='coaching')
        self.assertEqual(request.outcome, 'completed')
        self.assertEqual(request.usage, {'totalTokenCount': 23})

    def test_raw_nul_recovery_terminates_without_media_credentials_or_second_call(self):
        analysis = self.ready()
        value, job, prepared, request = self.submit_only(analysis)
        receipt = self.coaching_receipt(prepared, output={'suggestions': [self.card(prepared, observation='bad\x00text')]})
        service.save_receipt(value, job, request, receipt)
        self.expire(analysis)
        with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}), patch.object(provider, 'request_raw') as call:
            service.recover_coaching()
            self.execute_feedback(analysis)
            service.recover_coaching()
            self.execute_feedback(analysis)
            call.assert_not_called()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'invalid')
        self.assertIn(b'\\u0000', bytes(request.raw_body))
        self.assertEqual(self.feedback_state()['error']['code'], 'invalid_suggestions')


@skipUnless(connection.vendor == 'postgresql', 'Requires real PostgreSQL row locks; SQLite is not concurrency evidence')
class ConcurrentCoachingTests(SyntheticCoaching, TransactionTestCase):
    def race(self, functions):
        barrier = Barrier(len(functions))
        def invoke(fn):
            try:
                barrier.wait(timeout=15)
                return fn()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(functions)) as pool:
            return list(pool.map(invoke, functions))

    def test_concurrent_admission_dependencies_and_workers_deduplicate(self):
        values = self.race([self.admit_feedback, self.admit_feedback])
        self.assertEqual(values[0].pk, values[1].pk)
        self.assertEqual(DescriptionJob.objects.count(), 1)
        self.assertEqual(FeedbackJob.objects.count(), 1)
        analysis = values[0]
        value = self.job(analysis).description_set
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.race([lambda: descriptions.run_description(value.pk, 1), lambda: descriptions.run_description(value.pk, 1)])
            self.race([lambda: self.execute_feedback(analysis), lambda: self.execute_feedback(analysis)])
            self.assertEqual(call.call_count, 2)
        self.assertEqual(FeedbackRequest.objects.count(), 2)
        self.assertEqual(FeedbackReservation.objects.count(), 2)

    def test_concurrent_retry_consumes_revision_once(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.coaching_receipt(p, status=401)):
            self.execute_feedback(analysis)
        def retry():
            try:
                return self.admit_feedback(payload={'feedback_revision': 1}).feedback_revision
            except service.Conflict:
                return 'conflict'
        self.assertCountEqual(self.race([retry, retry]), [2, 'conflict'])
        self.assertEqual(FeedbackJob.objects.count(), 2)

    def test_shared_description_coaching_bucket_has_one_winner(self):
        analysis = self.ready()
        other = descriptions.generate(self.new_deck('concurrent-quota').pk, {})
        FeedbackReservation.objects.update(reserved_at=timezone.now() - timedelta(seconds=61))
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_RPM': '1'}), patch.object(provider, 'request_raw', side_effect=self.coaching_receipt) as call:
            self.race([lambda: self.execute_feedback(analysis), lambda: descriptions.run_description(other.pk, 1)])
            self.assertEqual(call.call_count, 1)
        self.assertCountEqual([self.feedback_state()['state'], descriptions.read(other.deck_id, other.pk)['state']], ['completed', 'waiting_quota'])

    def test_description_edit_response_race_fences_result_retains_request(self):
        analysis = self.ready()
        value = self.job(analysis).description_set
        sent, edited = Event(), Event()
        def send(p):
            self.assertFalse(connection.in_atomic_block)
            sent.set()
            if not edited.wait(15):
                raise AssertionError('Synthetic edit timed out')
            return self.coaching_receipt(p)
        def edit():
            if not sent.wait(15):
                raise AssertionError('Synthetic submission timed out')
            try:
                descriptions.edit(value.deck_id, self.edited(value))
            finally:
                edited.set()
        with patch.object(provider, 'request_raw', side_effect=send) as call:
            self.race([lambda: self.execute_feedback(analysis), edit])
            self.assertEqual(call.call_count, 1)
        self.assertEqual(self.feedback_state()['state'], 'stale')
        self.assertIsNone(self.feedback_state()['result'])
        self.assertEqual(FeedbackRequest.objects.get(stage='coaching').outcome, 'completed')

    def test_duplicate_old_receipt_normalizers_leave_new_generation_unchanged(self):
        analysis = self.ready()
        value, job, prepared, request = self.submit_only(analysis)
        self.expire(analysis)
        service.recover_coaching()
        analysis = self.admit_feedback(payload={'feedback_revision': 1, 'acknowledge_uncertain': True})
        service.save_receipt(value, job, request, self.coaching_receipt(prepared))
        before = self.job(analysis)
        expected = FeedbackJob.objects.filter(pk=before.pk).values().get()
        with patch.object(provider, 'request_raw') as call, patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
            service.recover_coaching()
            self.race([lambda: service.run_coaching(analysis.pk, 1), lambda: service.run_coaching(analysis.pk, 1)])
            call.assert_not_called()
            self.assertEqual(normalize.call_count, 1)
        self.assertEqual(FeedbackJob.objects.filter(pk=before.pk).values().get(), expected)
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'completed')
