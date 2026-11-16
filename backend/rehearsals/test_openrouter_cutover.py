"""Synthetic OpenRouter cutover regressions; network is mocked.

AI-assisted by OpenAI Codex, October 29, 2026; see active collaboration log.
"""
from copy import deepcopy
from unittest.mock import patch
from django.test import TestCase
from .models import FeedbackRequest, DescriptionSet, FeedbackAnalysis
from .services import coaching, descriptions, feedback_provider as provider, presentation_scoring, slide_profiles
from .services.feedback import FeedbackError
from .services.feedback_config import Selection, selection_descriptor
from .test_coaching import SyntheticCoaching
from .test_descriptions import description_value

OPENROUTER = {'FEEDBACK_PROVIDER': 'openrouter', 'OPENROUTER_API_KEY': 'synthetic-router-key',
              'FEEDBACK_OPENROUTER_MODEL': 'openai/gpt-6-luna',
              'FEEDBACK_OPENROUTER_PROJECT_ID': 'synthetic-router',
              'FEEDBACK_OPENROUTER_RPM': '100', 'FEEDBACK_OPENROUTER_TPM': '10000000'}

class OpenRouterCutoverTests(SyntheticCoaching, TestCase):
    def setUp(self):
        super().setUp()
        old = patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'})
        old.start(); self.addCleanup(old.stop)

    def replacement_payload(self, analysis, **extra):
        state = coaching.read(self.attempt.pk)
        return {'expected_selection': state['selection']['token'],
                'feedback_revision': analysis.feedback_revision, **extra}

    def submitted_description(self, *, profile=False):
        value = slide_profiles.ensure(self.deck.pk) if profile else descriptions.generate(self.deck.pk, {})
        value, job, _ = descriptions.claim(value.pk, value.processing_revision)
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        descriptions.submit(value, job, Selection.saved(value).adapter().prepare_descriptions(prepared))
        return value

    def test_initial_profile_admission_exposes_and_fences_uncertain_legacy_scope(self):
        old = self.submitted_description(profile=True)
        old_request = FeedbackRequest.objects.get(job__description_set=old)
        with patch.dict('os.environ', OPENROUTER):
            state = slide_profiles.read(self.deck.pk)
            self.assertEqual(state['description_set_id'], str(old.pk))
            self.assertEqual(state['provenance']['provider'], 'openai')
            self.assertEqual(state['selection']['provider'], 'openrouter')
            self.assertEqual(state['state'], 'needs_confirmation')
            self.assertTrue(state['stale']); self.assertTrue(state['requires_confirmation'])
            self.assertTrue(state['retry_available'])
            for payload in ({'expected_selection': state['selection']['token']},
                            {'expected_selection': state['selection']['token'], 'acknowledge_uncertain': True}):
                with self.assertRaises(FeedbackError) as rejected: slide_profiles.ensure(self.deck.pk, payload)
                self.assertEqual(rejected.exception.code, 'confirmation_required')
            prepared, snapshot = descriptions.prepare_saved(self.deck.pk)
            with self.assertRaises(FeedbackError):
                descriptions.admit_prepared(Selection.profiles(), prepared, snapshot, dependency=True)
            slide_profiles.after_upload(self.deck.pk)
            self.assertFalse(DescriptionSet.objects.filter(provider='openrouter').exists())
            payload = {'description_set_id': str(old.pk), 'processing_revision': old.processing_revision,
                       'expected_selection': state['selection']['token'], 'acknowledge_uncertain': True}
            current = slide_profiles.ensure(self.deck.pk, payload)
            self.assertEqual(current.provider, 'openrouter')
            self.assertEqual(slide_profiles.ensure(self.deck.pk).pk, current.pk)
            self.assertEqual(slide_profiles.read(self.deck.pk)['description_set_id'], str(current.pk))
        old_request.refresh_from_db()
        self.assertEqual(old_request.provider, 'openai'); self.assertIsNone(old_request.received_at)

    def test_initial_description_and_feedback_admission_cannot_skip_legacy_uncertainty(self):
        old = self.submitted_description()
        with patch.dict('os.environ', OPENROUTER):
            state = descriptions.read(self.deck.pk)
            self.assertEqual(state['description_set_id'], str(old.pk))
            self.assertTrue(state['requires_confirmation'])
            with self.assertRaises(FeedbackError) as rejected: descriptions.generate(self.deck.pk, {})
            self.assertEqual(rejected.exception.code, 'confirmation_required')
            with self.assertRaises(FeedbackError) as rejected: coaching.generate(self.attempt.pk, {})
            self.assertEqual(rejected.exception.code, 'confirmation_required')
            self.assertFalse(FeedbackAnalysis.objects.exists())
            current = descriptions.generate(self.deck.pk, {'description_set_id': str(old.pk),
                'processing_revision': old.processing_revision, 'expected_selection': state['selection']['token'],
                'acknowledge_uncertain': True})
            owner = coaching.generate(self.attempt.pk, {})
            self.assertEqual(self.job(owner).description_set_id, current.pk)

    def test_initial_scoring_cannot_bypass_uncertain_legacy_profile(self):
        self.submitted_description(profile=True)
        with patch.dict('os.environ', OPENROUTER):
            state = presentation_scoring.read(self.attempt.pk)
            with self.assertRaises(FeedbackError) as rejected:
                presentation_scoring.generate(self.attempt.pk, {'expected_selection': state['selection']['token']})
            self.assertEqual(rejected.exception.code, 'confirmation_required')
            self.assertFalse(FeedbackAnalysis.objects.exists())
            self.assertFalse(DescriptionSet.objects.filter(provider='openrouter').exists())

    def test_old_uncertainty_does_not_block_changed_source_or_acknowledged_retry(self):
        old = self.submitted_description()
        old.jobs.update(state='needs_confirmation')
        FeedbackRequest.objects.filter(job__description_set=old).update(outcome='uncertain')
        descriptions.generate(self.deck.pk, {'description_set_id': str(old.pk),
            'processing_revision': old.processing_revision, 'acknowledge_uncertain': True})
        with patch.dict('os.environ', OPENROUTER):
            # The real retry's queued job has already acknowledged generation one.
            current = descriptions.generate(self.deck.pk, {})
            self.assertEqual(current.provider, 'openrouter')
        profile = self.submitted_description(profile=True)
        self.deck.slides.update(extracted_text='Synthetic changed source')
        with patch.dict('os.environ', OPENROUTER):
            self.assertEqual(slide_profiles.read(self.deck.pk)['state'], 'absent')
            changed = slide_profiles.ensure(self.deck.pk)
            self.assertEqual(changed.provider, 'openrouter')
            self.assertNotEqual(changed.source_fingerprint, profile.source_fingerprint)

    def test_completed_coaching_replacement_preserves_history_and_old_result_provenance(self):
        analysis = self.ready()
        with patch.object(provider, 'request_raw', side_effect=self.coaching_receipt):
            self.execute_feedback(analysis)
        old = self.job(analysis); frozen = deepcopy(old.source_snapshot); old_result = deepcopy(old.result)
        with patch.dict('os.environ', OPENROUTER):
            state = coaching.read(self.attempt.pk)
            self.assertEqual(state['selection']['provider'], 'openrouter')
            self.assertEqual(state['provenance']['provider'], 'openai')
            self.assertTrue(state['stale'])
            self.assertTrue(state['result']['stale'])
            replacement = coaching.generate(self.attempt.pk, self.replacement_payload(analysis))
            current = self.job(replacement)
            self.assertEqual(current.generation, 2)
            self.assertEqual(current.description_set.provider, 'openrouter')
            self.assertNotEqual(current.description_set_id, old.description_set_id)
            self.assertIsNone(coaching.read(self.attempt.pk)['result'])
        old.refresh_from_db()
        self.assertEqual(old.source_snapshot, frozen); self.assertEqual(old.result, old_result)
        self.assertEqual(old.description_set.provider, 'openai')

    def test_read_restarts_if_replacement_advances_scope_before_analysis_lock(self):
        analysis = self.ready()
        old = self.job(analysis)
        old_value = old.description_set
        with patch.dict('os.environ', OPENROUTER):
            coaching.generate(self.attempt.pk, self.replacement_payload(analysis))
            current = self.job(analysis)
            lock = coaching._locked
            advanced = False
            def raced_lock(analysis_id, revision):
                nonlocal advanced
                if not advanced:
                    advanced = True
                    return old_value, analysis, old
                return lock(analysis_id, revision)
            with patch.object(coaching, '_locked', side_effect=raced_lock):
                state = coaching.read(self.attempt.pk)
            self.assertEqual(state['description_set_id'], str(current.description_set_id))
            self.assertEqual(state['provenance']['provider'], 'openrouter')

    def test_old_unsent_description_and_coaching_jobs_make_no_request_after_cutover(self):
        analysis = self.ready(); value = descriptions.generate(self.new_deck('pending').pk, {})
        with patch.dict('os.environ', OPENROUTER), patch.object(provider, 'request_raw') as call:
            descriptions.run_description(value.pk, value.processing_revision)
            coaching.run_coaching(analysis.pk, analysis.feedback_revision)
        call.assert_not_called()
        self.assertEqual(value.jobs.get(generation=value.processing_revision).error_code, 'provider_changed')
        self.assertEqual(self.job(analysis).error_code, 'provider_changed')

    def test_uncertain_coaching_requires_acknowledgement_before_new_provider_generation(self):
        analysis = self.ready(); _, _, _, request = self.submit_only(analysis); submitted = request.submitted_at
        with patch.dict('os.environ', OPENROUTER):
            payload = self.replacement_payload(analysis)
            with self.assertRaises(FeedbackError) as rejected: coaching.generate(self.attempt.pk, payload)
            self.assertEqual(rejected.exception.code, 'confirmation_required')
            replacement = coaching.generate(self.attempt.pk, {**payload, 'acknowledge_uncertain': True})
            self.assertEqual(self.job(replacement).description_set.provider, 'openrouter')
        request.refresh_from_db()
        self.assertEqual(request.submitted_at, submitted); self.assertEqual(request.provider, 'openai')
        self.assertIsNone(request.received_at)

    def test_uncertain_description_dependency_also_requires_acknowledgement(self):
        analysis = self.admit_feedback(); value = self.job(analysis).description_set
        value, job, _ = descriptions.claim(value.pk, value.processing_revision)
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        descriptions.submit(value, job, Selection.saved(value).adapter().prepare_descriptions(prepared))
        with patch.dict('os.environ', OPENROUTER):
            state = coaching.read(self.attempt.pk)
            self.assertTrue(state['requires_confirmation'])
            self.assertEqual(state['dependency']['state'], 'needs_confirmation')
            payload = self.replacement_payload(analysis)
            with self.assertRaises(FeedbackError) as rejected: coaching.generate(self.attempt.pk, payload)
            self.assertEqual(rejected.exception.code, 'confirmation_required')
            replacement = coaching.generate(self.attempt.pk, {**payload, 'acknowledge_uncertain': True})
            self.assertEqual(self.job(replacement).description_set.provider, 'openrouter')

    def test_description_replacement_requires_revision_and_current_selection(self):
        old = self.complete(); old_token = descriptions.read(self.deck.pk, old.pk)['selection']['token']
        with patch.dict('os.environ', OPENROUTER):
            state = descriptions.read(self.deck.pk, old.pk)
            self.assertEqual(state['selection']['provider'], 'openrouter')
            self.assertEqual(state['provenance']['provider'], 'openai')
            with self.assertRaises(FeedbackError) as rejected:
                descriptions.generate(self.deck.pk, {'description_set_id': str(old.pk)})
            self.assertEqual(rejected.exception.code, 'revision_required')
            payload = {'description_set_id': str(old.pk), 'processing_revision': old.processing_revision,
                       'expected_selection': old_token}
            with self.assertRaises(FeedbackError) as rejected: descriptions.generate(self.deck.pk, payload)
            self.assertEqual(rejected.exception.code, 'selection_mismatch')
            value = descriptions.generate(self.deck.pk, {**payload, 'expected_selection': state['selection']['token']})
            self.assertNotEqual(value.pk, old.pk); self.assertEqual(value.provider, 'openrouter')
        old.refresh_from_db(); self.assertIsNotNone(old.descriptions); self.assertEqual(old.processing_revision, 1)

    def test_saved_openai_receipt_recovers_without_old_key_or_second_submission(self):
        analysis = self.ready(); value, job, prepared, request = self.submit_only(analysis)
        coaching.save_receipt(value, job, request, self.coaching_receipt(prepared)); self.expire(analysis)
        with patch.dict('os.environ', {**OPENROUTER, 'FEEDBACK_ENABLED': 'false', 'OPENAI_API_KEY': ''}), \
                patch.object(provider, 'request_raw') as call:
            coaching.recover_coaching(); coaching.run_coaching(analysis.pk, analysis.feedback_revision)
        call.assert_not_called(); old = self.job(analysis)
        self.assertEqual(old.state, 'completed'); self.assertEqual(old.description_set.provider, 'openai')
        self.assertEqual(FeedbackRequest.objects.get(coaching_job=old).outcome, 'completed')

    def test_edit_after_unknown_description_submission_still_requires_cutover_acknowledgement(self):
        value = self.admit()
        value, job, request = descriptions.claim(value.pk, value.processing_revision)
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        descriptions.submit(value, job, Selection.saved(value).adapter().prepare_descriptions(prepared))
        descriptions.edit(self.deck.pk, self.edited(value))
        value.refresh_from_db()
        self.assertEqual(value.processing_revision, 2)
        self.assertFalse(value.jobs.filter(generation=2).exists())
        with patch.dict('os.environ', OPENROUTER):
            state = descriptions.read(self.deck.pk, value.pk)
            self.assertTrue(state['requires_confirmation'])
            payload = {'description_set_id': str(value.pk), 'processing_revision': 2,
                       'expected_selection': state['selection']['token']}
            with self.assertRaises(FeedbackError) as rejected:
                descriptions.generate(self.deck.pk, payload)
            self.assertEqual(rejected.exception.code, 'confirmation_required')
            replacement = descriptions.generate(self.deck.pk, {**payload, 'acknowledge_uncertain': True})
            self.assertEqual(replacement.provider, 'openrouter')

    def test_scoring_update_uses_fresh_openrouter_profile_and_keeps_old_job(self):
        profile = slide_profiles.ensure(self.deck.pk)
        profile.descriptions = description_value(descriptions.snapshot_deck(profile))
        for slide in profile.descriptions['slides']: slide.update(slide_kind='content', must_cover=[], go_deeper=[])
        profile.description_revision = 1; profile.save(); profile.jobs.update(state='completed')
        owner = presentation_scoring.generate(self.attempt.pk, {}); old = self.job(owner); frozen = deepcopy(old.source_snapshot)
        old.prompt_version = 'retired-score'; old.save(update_fields=['prompt_version'])
        with patch.dict('os.environ', OPENROUTER):
            state = presentation_scoring.read(self.attempt.pk)
            self.assertEqual(state['selection']['provider'], 'openrouter')
            self.assertTrue(state['retry_available'])
            updated = presentation_scoring.generate(self.attempt.pk, {
                'expected_selection': state['selection']['token'], 'feedback_revision': owner.feedback_revision})
            current = self.job(updated)
            self.assertEqual(current.generation, 2); self.assertEqual(current.description_set.provider, 'openrouter')
            self.assertNotEqual(current.description_set_id, profile.pk)
        old.refresh_from_db(); self.assertEqual(old.source_snapshot, frozen); self.assertEqual(old.description_set.provider, 'openai')
        self.assertEqual(DescriptionSet.objects.filter(provider='openrouter').count(), 1)
