"""Phase 4: synthetic sources, real persistence; no provider network calls."""
from copy import deepcopy
from unittest.mock import patch
from unittest import skipUnless
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from .test_coaching import SyntheticCoaching
from .models import FeedbackJob, FeedbackRequest
from .services import coaching, feedback_provider as provider


def seed_ai_offer(case, edits):
    """Synthetic saved provider result; request normalization has separate coverage."""
    case.admit()
    current = coaching.read(case.attempt.pk, 'transcription_suggestions')['feedback_revision']
    owner = coaching.generate(case.attempt.pk, {'feedback_revision': current} if current else {}, 'transcription_suggestions')
    job = case.job(owner)
    job.state = 'completed'
    job.result = {'status': 'accepted', 'accepted_count': len(edits), 'discarded_count': 0,
        'suggestions': [{'word_start': e['word_start'], 'word_end': e['word_end'],
            'original': ' '.join(w['text'] for w in case.attempt.transcript['words'][e['word_start']:e['word_end'] + 1]),
            'replacements': [e['text']], 'error_type': 'technical_term', 'reason': 'Synthetic recognition candidate.'} for e in edits]}
    job.save(update_fields=['state', 'result'])
    return job


class CorrectionTests(SyntheticCoaching, TestCase):
    def setUp(self):
        super().setUp()
        self.url = f'/api/attempts/{self.attempt.pk}/corrections/'
        self.base = coaching.transcript_identity(self.attempt)

    def save(self, revision=0, edits=None, base=None):
        return self.client.patch(self.url, {'base_transcript_id': base or self.base,
            'expected_revision': revision, 'edits': edits or []}, content_type='application/json')

    def test_save_revision_noop_conflict_and_original_preservation(self):
        original = deepcopy(self.attempt.transcript)
        edit = {'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}
        seed_ai_offer(self, [edit])
        with patch.object(provider, 'request_raw', side_effect=AssertionError('no AI on save')):
            self.assertEqual(self.client.get(self.url).json()['revision'], 0)
            first = self.save(edits=[edit])
            self.assertEqual(first.status_code, 200)
            self.assertEqual(first.json()['revision'], 1)
            self.assertEqual(first.json()['effective_text'], 'ChatGPT Echo')
            self.assertEqual(self.save(1, [edit]).json()['revision'], 1)
            self.assertEqual(self.save(0, [edit]).status_code, 409)
            self.assertEqual(self.save(1, []).json()['revision'], 2)
            self.assertEqual(self.save(2, [{'word_start': 0, 'word_end': 0, 'text': 'Echo'}]).json()['revision'], 2)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.transcript, original)
        self.assertFalse(FeedbackJob.objects.filter(analysis__analysis_type='coaching').exists())

    def test_invalid_ranges_types_overlap_and_stale_base_do_not_write(self):
        for edits in [[{'word_start': True, 'word_end': 0, 'text': 'x'}],
                      [{'word_start': 0, 'word_end': 2, 'text': 'x'}],
                      [{'word_start': 0, 'word_end': 1, 'text': 'x'}, {'word_start': 1, 'word_end': 1, 'text': 'y'}],
                      [{'word_start': 0, 'word_end': 0, 'text': '\x00'}]]:
            self.assertEqual(self.save(edits=edits).status_code, 400)
        self.assertEqual(self.save(base='0' * 64).status_code, 409)
        self.assertEqual(self.client.get(self.url).json()['revision'], 0)

    def test_saved_feedback_retained_outdated_and_only_explicit_regeneration_uses_latest(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        self.assertEqual(self.feedback_state()['state'], 'completed')
        old_job = self.job(analysis)
        seed_ai_offer(self, [{'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}])
        self.assertEqual(self.save(edits=[{'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}]).status_code, 200)
        state = self.feedback_state()
        self.assertTrue(state['stale'])
        self.assertIsNotNone(state['result'])
        self.assertTrue(state['result']['stale'])
        self.assertEqual(FeedbackRequest.objects.count(), 2)
        updated = self.admit_feedback(payload={'feedback_revision': state['feedback_revision']})
        self.assertEqual(self.job(updated).source_snapshot['transcript_revision'], 1)
        self.assertEqual(self.job(updated).source_snapshot['corrections'][0]['text'], 'ChatGPT')
        self.assertEqual(self.admit_feedback().pk, updated.pk)
        self.assertEqual(FeedbackJob.objects.filter(analysis__analysis_type='coaching').count(), 2)
        old_job.refresh_from_db()
        self.assertIsNotNone(old_job.result)

    def test_running_result_cannot_publish_after_correction(self):
        analysis = self.ready()
        value, job, prepared, request = self.submit_only(analysis)
        seed_ai_offer(self, [{'word_start': 0, 'word_end': 1, 'text': 'ChatGPT 한국어'}])
        self.save(edits=[{'word_start': 0, 'word_end': 1, 'text': 'ChatGPT 한국어'}])
        receipt = self.coaching_receipt(prepared)
        coaching.save_receipt(value, job, request, receipt)
        coaching.finish(value, job, result=provider.normalize(prepared, receipt))
        self.assertTrue(self.feedback_state()['stale'])
        self.assertIsNone(self.job(analysis).result)

    def test_suggestion_pipeline_is_independent_deduplicated_and_revision_bound(self):
        self.complete()
        url = f'/api/attempts/{self.attempt.pk}/correction-suggestions/'
        response = self.client.post(url, {}, content_type='application/json')
        self.assertEqual(response.status_code, 202)
        from .models import FeedbackAnalysis
        owner = FeedbackAnalysis.objects.get(analysis_type='transcription_suggestions')
        def receipt(prepared):
            self.assertIn(b'likely speech-to-text', prepared.payload)
            return self.coaching_receipt(prepared, output={'suggestions': [{
                'word_start': 1, 'word_end': 1, 'original': 'Echo', 'error_type': 'acronym', 'replacements': ['ECHO'], 'reason': 'Possible acronym.'}]})
        with patch.object(provider, 'request_raw', side_effect=receipt) as call:
            self.execute_feedback(owner)
            self.assertEqual(self.client.post(url, {}, content_type='application/json').status_code, 200)
            self.execute_feedback(owner)
            self.assertEqual(call.call_count, 1)
        state = self.client.get(url).json()
        self.assertEqual(state['result']['analysis_type'], 'transcription_suggestions')
        self.assertEqual(state['result']['suggestions'][0]['replacements'], ['ECHO'])
        self.assertEqual(self.feedback_state()['feedback_revision'], 0)
        self.save(edits=[{'word_start': 1, 'word_end': 1, 'text': 'ECHO'}])
        self.assertTrue(self.client.get(url).json()['stale'])

    def test_overlay_reaches_feedback_prompt_without_rewriting_evidence(self):
        seed_ai_offer(self, [{'word_start': 0, 'word_end': 1, 'text': 'ChatGPT 한국어'}])
        self.save(edits=[{'word_start': 0, 'word_end': 1, 'text': 'ChatGPT 한국어'}])
        analysis = self.ready()
        value, job, prepared, _ = self.submit_only(analysis)
        self.assertIn('ChatGPT 한국어', prepared.payload.decode())
        self.assertEqual(prepared.analysis.source.transcript.text, 'Echo Echo')
        self.assertEqual(self.client.get(self.url).json()['revision'], 1)

    def test_effective_text_preserves_unedited_punctuation_and_sentence_edits_do_not_double_it(self):
        from .services.corrections import effective_text
        transcript = {**self.attempt.transcript, 'text': 'Echo Echo.'}
        self.assertEqual(effective_text(transcript, [{'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}]), 'ChatGPT Echo.')
        self.assertEqual(effective_text(transcript, [{'word_start': 0, 'word_end': 1, 'text': 'ChatGPT 한국어.'}]), 'ChatGPT 한국어.')

    def test_analysis_version_change_selects_new_scope_only_on_explicit_regeneration(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        job = self.job(analysis)
        job.source_snapshot = {**job.source_snapshot, 'correction_analysis_version': 'corrections-obsolete'}
        job.save(update_fields=['source_snapshot'])
        self.assertTrue(self.feedback_state()['stale'])
        self.assertEqual(analysis.jobs.count(), 1)
        updated = self.admit_feedback(payload={'feedback_revision': 1})
        self.assertEqual(self.job(updated).source_snapshot['correction_analysis_version'], 'recognition-v2')
        self.assertEqual(analysis.jobs.count(), 2)


@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL row locks required')
class CorrectionConcurrencyTests(SyntheticCoaching, TransactionTestCase):
    def test_conflicting_corrections_allow_only_one_revision_zero_writer(self):
        from .services.corrections import save, read
        seed_ai_offer(self, [{'word_start': 0, 'word_end': 0, 'text': t} for t in ['First', 'Second']])
        barrier = Barrier(2)
        base = coaching.transcript_identity(self.attempt)
        def writer(text):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                try:
                    return save(self.attempt.pk, {'base_transcript_id': base, 'expected_revision': 0,
                        'edits': [{'word_start': 0, 'word_end': 0, 'text': text}]})['revision']
                except coaching.Conflict:
                    return 'conflict'
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(writer, ['First', 'Second']))
        self.assertCountEqual(results, [1, 'conflict'])
        self.assertEqual(read(self.attempt.pk)['revision'], 1)
        self.assertFalse(FeedbackJob.objects.filter(analysis__analysis_type='coaching').exists())

    def test_concurrent_regeneration_for_same_correction_revision_queues_once(self):
        from .services.corrections import save
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        seed_ai_offer(self, [{'word_start': 0, 'word_end': 0, 'text': 'Corrected'}])
        save(self.attempt.pk, {'base_transcript_id': coaching.transcript_identity(self.attempt), 'expected_revision': 0,
            'edits': [{'word_start': 0, 'word_end': 0, 'text': 'Corrected'}]})
        barrier = Barrier(2)
        def generate(_):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return coaching.generate(self.attempt.pk, {'transcript_revision': 1}).pk
            finally:
                connections.close_all()
        # A stale generation must explicitly authorize replacing the old scope.
        # Concurrent clients may retry with the current generation after a 409.
        def regenerate(_):
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                try:
                    return coaching.generate(self.attempt.pk, {'transcript_revision': 1, 'feedback_revision': 1}).pk
                except coaching.Conflict as e:
                    self.assertEqual(e.code, 'stale_revision')
                    return analysis.pk
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(regenerate, range(2)))
        self.assertEqual(results, [analysis.pk, analysis.pk])
        self.assertEqual(analysis.jobs.count(), 2)

class RecognitionOnlyTests(SyntheticCoaching, TestCase):
    def test_arbitrary_rewrites_are_rejected_without_a_saved_ai_suggestion(self):
        url = f'/api/attempts/{self.attempt.pk}/corrections/'
        for text in ['I speak grammatically.', 'Clearer explanation', 'ChatGPT']:
            result = self.client.patch(url, {'base_transcript_id': coaching.transcript_identity(self.attempt),
                'expected_revision': 0, 'edits': [{'word_start': 0, 'word_end': 1, 'text': text}]}, content_type='application/json')
            self.assertEqual(result.status_code, 400)
        self.assertEqual(self.client.get(url).json()['effective_text'], 'Echo Echo')
        self.assertEqual(self.client.get(url).json()['revision'], 0)

    def test_recognition_accept_restore_and_negative_speech_cases(self):
        text = 'I is um very very Earth is flat ChatGPTN'
        words = [{'text': w, 'start_ms': i * 180, 'end_ms': (i + 1) * 180} for i, w in enumerate(text.split())]
        self.attempt.transcript = {'text': text, 'words': words}
        from .services.alignment import align_words
        self.attempt.visits = align_words(words, self.attempt.slide_events, self.attempt.duration_ms)
        self.attempt.save(update_fields=['transcript', 'visits'])
        original = deepcopy(self.attempt.transcript)
        seed_ai_offer(self, [{'word_start': 8, 'word_end': 8, 'text': 'ChatGPT'}])
        url = f'/api/attempts/{self.attempt.pk}/corrections/'
        def save(edits, revision=0):
            return self.client.patch(url, {'base_transcript_id': coaching.transcript_identity(self.attempt),
                'expected_revision': revision, 'edits': edits}, content_type='application/json')
        # Merely generating/offering suggestions never changes spoken content.
        self.assertEqual(self.client.get(url).json()['effective_text'], text)
        for a, b, replacement in [(0, 1, 'I am'), (2, 2, 'really'), (3, 4, 'very'), (5, 7, 'Earth is round')]:
            self.assertEqual(save([{'word_start': a, 'word_end': b, 'text': replacement}]).status_code, 400)
        accepted = {'word_start': 8, 'word_end': 8, 'text': 'ChatGPT'}
        state = save([accepted]).json()
        self.assertEqual(state['effective_text'], 'I is um very very Earth is flat ChatGPT')
        self.assertEqual(state['revision'], 1)
        self.assertEqual(self.client.get(url).json(), state)
        self.assertEqual(save([], 1).json()['effective_text'], text)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.transcript, original)

    def test_stale_offer_and_unsupported_legacy_overlays_cannot_rewrite_speech(self):
        from .models import TranscriptCorrection
        from .services import corrections
        edit = {'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}
        job = seed_ai_offer(self, [edit])
        job.source_snapshot['correction_analysis_version'] = 'corrections-v1'
        job.save(update_fields=['source_snapshot'])
        url = f'/api/attempts/{self.attempt.pk}/corrections/'
        payload = {'base_transcript_id': coaching.transcript_identity(self.attempt), 'expected_revision': 0, 'edits': [edit]}
        self.assertEqual(self.client.patch(url, payload, content_type='application/json').status_code, 400)
        row = TranscriptCorrection.objects.create(attempt=self.attempt, base_transcript_id=payload['base_transcript_id'], revision=2,
            edits=[{'word_start': 0, 'word_end': 1, 'text': 'A polished presentation'}])
        state = corrections.read(self.attempt.pk)
        self.assertEqual(state['effective_text'], 'Echo Echo')
        self.assertEqual(state['edits'], [])
        row.refresh_from_db()
        self.assertEqual(row.edits[0]['text'], 'A polished presentation', 'Archive is retained, not applied')

    def test_grammar_category_is_not_a_recognition_suggestion(self):
        from .services.transcript_suggestions import normalize_suggestions, RULES
        from .services.feedback import FeedbackError
        self.complete()
        owner = coaching.generate(self.attempt.pk, {}, 'transcription_suggestions')
        value, job, prepared, _ = self.submit_only(owner)
        receipt = self.coaching_receipt(prepared, output={'suggestions': [{'word_start': 0, 'word_end': 1,
            'original': 'Echo Echo', 'error_type': 'grammar', 'replacements': ['Better speech'], 'reason': 'Improve phrasing.'}]})
        with self.assertRaises(FeedbackError):
            normalize_suggestions(prepared, receipt, job.source_snapshot)
        for phrase in ['Never correct grammar', 'remove fillers', 'eliminate repetitions', 'not evidence of a recognition error', 'audio is not supplied']:
            self.assertIn(phrase, RULES)

    def test_matching_future_offer_does_not_accept_an_archived_manual_edit(self):
        from .models import TranscriptCorrection
        from .services import corrections
        edit = {'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}
        row = TranscriptCorrection.objects.create(attempt=self.attempt,
            base_transcript_id=coaching.transcript_identity(self.attempt), revision=2, edits=[edit])
        before = corrections.read(self.attempt.pk)
        seed_ai_offer(self, [edit])
        self.assertEqual(corrections.read(self.attempt.pk), before)
        row.refresh_from_db()
        self.assertEqual(row.edits, [edit])

    def test_multiple_acceptances_require_current_offers_and_restore_without_jobs(self):
        from .services import corrections
        first = {'word_start': 0, 'word_end': 0, 'text': 'ChatGPT'}
        second = {'word_start': 1, 'word_end': 1, 'text': 'ECHO'}
        base = coaching.transcript_identity(self.attempt)
        seed_ai_offer(self, [first, second])
        a = corrections.save(self.attempt.pk, {'base_transcript_id': base, 'expected_revision': 0, 'edits': [first]})
        self.assertEqual(a['revision'], 1)
        with self.assertRaises(provider.FeedbackError) as caught:
            corrections.save(self.attempt.pk, {'base_transcript_id': base, 'expected_revision': 1, 'edits': [first, second]})
        self.assertEqual(caught.exception.code, 'invalid_corrections')
        seed_ai_offer(self, [second])
        before = FeedbackJob.objects.count()
        b = corrections.save(self.attempt.pk, {'base_transcript_id': base, 'expected_revision': 1, 'edits': [first, second]})
        self.assertEqual(b['effective_text'], 'ChatGPT ECHO')
        self.assertEqual(b['revision'], 2)
        self.assertEqual(corrections.read(self.attempt.pk), b)
        with patch.object(corrections, 'ANALYSIS_VERSION', 'recognition-future'):
            self.assertEqual(corrections.read(self.attempt.pk), b, 'Analysis-version changes must retain accepted recognition corrections')
        restored = corrections.save(self.attempt.pk, {'base_transcript_id': base, 'expected_revision': 2, 'edits': []})
        self.assertEqual(restored['effective_text'], 'Echo Echo')
        self.assertEqual(restored['revision'], 3)
        self.assertEqual(FeedbackJob.objects.count(), before)
