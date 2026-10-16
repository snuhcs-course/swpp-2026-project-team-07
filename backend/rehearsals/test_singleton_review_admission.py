"""AI-assisted offline regressions for cancelled grouping and retained singleton work."""
from copy import deepcopy
from datetime import timedelta
import json
import os
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from .models import FeedbackAnalysis, FeedbackJob, FeedbackRequest, Slide, SlideReviewMembership
from .services import coaching, descriptions, feedback_provider as provider, slide_profiles, slide_review
from .services.alignment import align_words
from .services.feedback import FeedbackError
from .test_coaching import SyntheticCoaching
from .test_descriptions import description_value


class SingletonReviewAdmissionTests(SyntheticCoaching, TestCase):
    def setUp(self):
        super().setUp()
        image = self.deck.slides.get().image.name
        self.deck.page_count = 2
        self.deck.save(update_fields=['page_count'])
        Slide.objects.create(deck=self.deck, slide_index=1, image=image, extracted_text='Synthetic second slide')
        self.attempt.slide_events = [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 1000}]
        self.attempt.transcript = {'text': 'Echo Echo', 'words': [
            {'text': 'Echo', 'start_ms': index * 1000 + 100, 'end_ms': index * 1000 + 800}
            for index in range(2)]}
        self.attempt.visits = align_words(self.attempt.transcript['words'], self.attempt.slide_events, 2000)
        self.attempt.save()
        self.url = f'/api/attempts/{self.attempt.pk}/slide-review/'

    def scope(self, *indexes):
        return {'context_id': None, 'slides': [{'slide_index': index, 'segments': [
            {'start_ms': index * 1000, 'end_ms': (index + 1) * 1000}]} for index in indexes]}

    def ready_profiles(self):
        value = slide_profiles.ensure(self.deck.pk)
        def receipt(prepared):
            output = description_value(prepared.analysis)
            for slide in output['slides']:
                slide.update(slide_kind='content', must_cover=[], go_deeper=[])
            return self.coaching_receipt(prepared, output=output)
        with patch.object(provider, 'request_raw', side_effect=receipt):
            descriptions.run_description(value.pk, value.processing_revision)

    def singleton(self, index, **extra):
        return self.client.post(self.url, {'scope': self.scope(index), **extra}, content_type='application/json')

    def queued_review(self):
        self.ready_profiles()
        self.assertEqual(self.singleton(0).status_code, 202)
        return FeedbackJob.objects.get(analysis__analysis_type__startswith='review_')

    def make_obsolete_group(self, job):
        snapshot = deepcopy(job.source_snapshot)
        snapshot['slide_review'].update(scope=self.scope(0, 1),
            request_context_version='selected-review-group-context-v1', max_output_tokens=5000)
        job.source_snapshot = snapshot
        job.save(update_fields=['source_snapshot'])
        job.analysis.analysis_type = slide_review.analysis_type(self.scope(0, 1))
        job.analysis.save(update_fields=['analysis_type'])
        return snapshot

    def test_initial_route_removed_even_with_old_rollout_configuration(self):
        with patch.dict(os.environ, {'FEEDBACK_REVIEW_GROUPS_ENABLED': 'true'}):
            response = self.client.post(self.url + 'initial/', {'scope': self.scope(0, 1)},
                content_type='application/json')
        self.assertEqual(response.status_code, 404)
        self.assertFalse(FeedbackAnalysis.objects.exists())

    def test_multi_slide_generation_refused_without_preparation_for_any_old_flag(self):
        for setting in ('false', 'true'):
            with self.subTest(setting=setting), patch.dict(os.environ, {'FEEDBACK_REVIEW_GROUPS_ENABLED': setting}):
                with patch.object(coaching, 'prepare_attempt') as prepare:
                    response = self.client.post(self.url, {'scope': self.scope(0, 1)},
                        content_type='application/json', HTTP_X_OUTLOUD_REVIEW_PROTOCOL='selected-review-group-context-v1')
                self.assertEqual(response.status_code, 409, response.content)
                self.assertEqual(response.json()['error']['code'], 'review_grouping_removed')
                prepare.assert_not_called()
                self.assertFalse(FeedbackAnalysis.objects.exists())
                self.assertFalse(SlideReviewMembership.objects.exists())
        with self.assertRaises(coaching.Conflict) as error:
            coaching.generate(self.attempt.pk, {}, slide_review.analysis_type(self.scope(0, 1)), self.scope(0, 1))
        self.assertEqual(error.exception.code, 'review_grouping_removed')

    def test_multi_slide_read_is_refused_without_reinterpreting_saved_records(self):
        response = self.client.get(self.url, {'scope': json.dumps(self.scope(0, 1))})
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()['error']['code'], 'review_grouping_removed')
        self.assertFalse(FeedbackAnalysis.objects.exists())

    def test_singletons_admit_independent_jobs_and_duplicates_reuse_their_owner(self):
        self.ready_profiles()
        for index in (0, 1):
            response = self.singleton(index)
            self.assertEqual(response.status_code, 202, response.content)
            self.assertNotIn('review_grouping', response.json())
            self.assertNotIn('group_owner', response.json())
            self.assertEqual(self.singleton(index).json()['feedback_revision'], response.json()['feedback_revision'])
        self.assertEqual(FeedbackJob.objects.count(), 2)
        self.assertFalse(SlideReviewMembership.objects.exists())
        for job in FeedbackJob.objects.all():
            self.assertEqual(job.source_snapshot['slide_review']['request_context_version'], slide_review.REQUEST_CONTEXT_VERSION)
            self.assertEqual(len(job.source_snapshot['slide_review']['scope']['slides']), 1)
            self.assertNotIn('max_output_tokens', job.source_snapshot['slide_review'])

    def test_confirmed_lost_reply_with_absent_singleton_admits_once_and_late_replay_deduplicates(self):
        self.ready_profiles()
        fresh = self.client.get(self.url, {'scope': json.dumps(self.scope(0))}).json()
        self.assertEqual(fresh['feedback_revision'], 0)
        payload = {'acknowledge_uncertain': True, 'expected_selection': fresh['selection']['token'],
                   'transcript_revision': 0}
        response = self.singleton(0, **payload)
        self.assertEqual(response.status_code, 202, response.content)
        self.assertEqual(response.json()['feedback_revision'], 1)
        self.assertEqual(self.singleton(0, **payload).json()['feedback_revision'], 1)
        job = FeedbackJob.objects.get(analysis__analysis_type__startswith='review_')
        output = {'evaluation_mode': 'informative_descriptive', 'slides': [
            {'slide_index': 0, 'status': 'successful', 'findings': [], 'enrichments': []}]}
        with patch.object(provider, 'request_raw', side_effect=lambda prepared:
                self.coaching_receipt(prepared, output=output)) as call:
            self.execute_feedback(job.analysis)
            late = self.singleton(0, **payload)
        self.assertEqual(late.status_code, 200, late.content)
        self.assertEqual(late.json()['feedback_revision'], 1)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(FeedbackJob.objects.count(), 1)
        self.assertEqual(FeedbackRequest.objects.filter(coaching_job=job).count(), 1)

    def test_confirmed_initial_recovery_still_requires_current_selection_and_correction_assertions(self):
        self.ready_profiles()
        fresh = self.client.get(self.url, {'scope': json.dumps(self.scope(0))}).json()
        payload = {'acknowledge_uncertain': True, 'expected_selection': fresh['selection']['token'],
                   'transcript_revision': 0}
        for change, expected in [({'expected_selection': '0' * 64}, 'selection_mismatch'),
                                 ({'transcript_revision': 1}, 'correction_conflict')]:
            with self.subTest(change=change):
                response = self.singleton(0, **(payload | change))
                self.assertEqual(response.status_code, 409, response.content)
                self.assertEqual(response.json()['error']['code'], expected)
                self.assertFalse(FeedbackAnalysis.objects.exists())

    def test_initial_acknowledgement_does_not_authorize_revision_controls_or_false_confirmation(self):
        self.ready_profiles()
        for payload in ({'acknowledge_uncertain': False},
                        {'acknowledge_uncertain': True, 'feedback_revision': 1}):
            with self.subTest(payload=payload):
                response = self.singleton(0, **payload)
                self.assertEqual(response.status_code, 409, response.content)
                self.assertEqual(response.json()['error']['code'], 'stale_revision')
                self.assertFalse(FeedbackAnalysis.objects.exists())

    def test_confirmed_recovery_cannot_bypass_existing_revision_uncertainty_or_cooldown(self):
        job = self.queued_review()
        self.submit_only(job.analysis)
        self.expire(job.analysis)
        coaching.recover_coaching()
        job.refresh_from_db()
        self.assertEqual(job.state, 'needs_confirmation')
        job.retry_at = timezone.now() + timedelta(minutes=1)
        job.save(update_fields=['retry_at'])
        for payload, expected in [({'acknowledge_uncertain': True}, 'revision_required'),
                                  ({'acknowledge_uncertain': True, 'feedback_revision': 0}, 'stale_revision'),
                                  ({'feedback_revision': 1}, 'confirmation_required'),
                                  ({'acknowledge_uncertain': True, 'feedback_revision': 1}, 'retry_not_available')]:
            with self.subTest(payload=payload):
                response = self.singleton(0, **payload)
                self.assertEqual(response.status_code, 409, response.content)
                self.assertEqual(response.json()['error']['code'], expected)
                self.assertEqual(FeedbackJob.objects.count(), 1)
        job.retry_at = None
        job.save(update_fields=['retry_at'])
        response = self.singleton(0, acknowledge_uncertain=True, feedback_revision=1)
        self.assertEqual(response.status_code, 202, response.content)
        self.assertEqual(response.json()['feedback_revision'], 2)

    def test_legacy_coaching_cannot_use_acknowledgement_to_create_an_initial_analysis(self):
        response = self.client.post(self.feedback_url + 'generate/', {'acknowledge_uncertain': True},
            content_type='application/json')
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()['error']['code'], 'stale_revision')
        self.assertFalse(FeedbackAnalysis.objects.exists())

    def test_new_capture_cannot_create_a_group_snapshot(self):
        with self.assertRaises(FeedbackError) as error:
            slide_review.capture(self.attempt, self.scope(0, 1))
        self.assertEqual(error.exception.code, 'review_grouping_removed')

    def test_hypothetical_queued_group_never_submits_a_provider_request(self):
        job = self.queued_review()
        snapshot = self.make_obsolete_group(job)
        with patch.object(provider, 'request_raw') as call:
            self.execute_feedback(job.analysis)
        call.assert_not_called()
        job.refresh_from_db()
        self.assertEqual((job.state, job.error_code), ('failed', 'review_grouping_removed'))
        self.assertEqual(job.source_snapshot, snapshot)
        self.assertFalse(FeedbackRequest.objects.filter(coaching_job=job).exists())

    def test_submission_boundary_rejects_obsolete_snapshot_even_with_a_prepared_request(self):
        job = self.queued_review()
        value, claimed, _ = coaching.claim(job.analysis_id, job.generation)
        prepared = coaching._prepared(value, claimed)
        self.make_obsolete_group(job)
        with self.assertRaises(FeedbackError) as error:
            coaching.submit(value, claimed, prepared)
        self.assertEqual(error.exception.code, 'review_grouping_removed')
        self.assertFalse(FeedbackRequest.objects.filter(coaching_job=job).exists())

    def test_unknown_or_obsolete_singleton_protocol_never_reaches_provider(self):
        for protocol in ('selected-review-group-context-v1', 'unknown-context-v99'):
            with self.subTest(protocol=protocol):
                job = self.queued_review()
                job.source_snapshot['slide_review']['request_context_version'] = protocol
                job.save(update_fields=['source_snapshot'])
                with patch.object(provider, 'request_raw') as call:
                    self.execute_feedback(job.analysis)
                call.assert_not_called()
                job.refresh_from_db()
                self.assertEqual((job.state, job.error_code), ('failed', 'snapshot_unavailable'))
                owner = job.analysis
                job.delete()
                owner.delete()

    def test_obsolete_saved_receipt_stays_private_and_uninterpreted(self):
        job = self.queued_review()
        value, submitted, prepared, request = self.submit_only(job.analysis)
        receipt = self.coaching_receipt(prepared, output={
            'evaluation_mode': 'informative_descriptive', 'slides': []})
        coaching.save_receipt(value, submitted, request, receipt)
        snapshot = self.make_obsolete_group(job)
        self.expire(job.analysis)
        coaching.recover_coaching()
        with patch.object(provider, 'request_raw') as call, patch.object(provider, 'output_json') as normalize:
            self.execute_feedback(job.analysis)
        call.assert_not_called()
        normalize.assert_not_called()
        job.refresh_from_db()
        request.refresh_from_db()
        self.assertEqual(job.source_snapshot, snapshot)
        self.assertEqual(bytes(request.raw_body), receipt.body)
        self.assertIsNone(job.result)
        self.assertEqual(job.error_code, 'review_grouping_removed')
