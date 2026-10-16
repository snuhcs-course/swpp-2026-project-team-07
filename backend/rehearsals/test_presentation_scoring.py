"""Unified scoring transport: synthetic sources and mocked providers only."""
from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from .models import FeedbackAnalysis, FeedbackJob, FeedbackRequest, PresentationContext
from .services import coaching, descriptions, feedback_provider as provider, slide_profiles
from .test_coaching import SyntheticCoaching
from .test_descriptions import description_value


class PresentationScoringTests(SyntheticCoaching, TestCase):
    def setUp(self):
        super().setUp()
        self.url = f'/api/attempts/{self.attempt.pk}/presentation-score/'

    def complete(self):
        value = slide_profiles.ensure(self.deck.pk)
        def receipt(prepared):
            output = description_value(prepared.analysis)
            for slide in output['slides']:
                slide.update(slide_kind='content', must_cover=[], go_deeper=[])
            return self.coaching_receipt(prepared, output=output)
        with patch.object(provider, 'request_raw', side_effect=receipt):
            descriptions.run_description(value.pk, value.processing_revision)
        value.refresh_from_db()
        self.assertEqual(value.description_revision, 1)
        return value

    def post_score(self, **payload):
        return self.client.post(self.url, {'context_id': None, **payload}, content_type='application/json')

    def test_get_is_read_only_and_never_measures_or_admits(self):
        with patch.object(provider, 'request_raw') as call, patch('rehearsals.services.presentation_measurements.measure_audio') as measure:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['schema_version'], 'presentation-score-v2')
        self.assertEqual(response.json()['assessment_status'], 'not_graded')
        self.assertIsNone(response.json()['result'])
        self.assertFalse(FeedbackJob.objects.exists())
        call.assert_not_called(); measure.assert_not_called()

    def test_route_rejects_client_sources_and_bad_controls(self):
        for payload in ({'slides': []}, {'transcript': {}}, {'feedback_revision': True},
                        {'transcript_revision': 0.0}, {'acknowledge_uncertain': 1},
                        {'context_id': 'not-a-uuid'}, {'expected_selection': 'wrong'}):
            self.assertEqual(self.post_score(**payload).status_code, 400, payload)
        self.assertEqual(self.client.get(self.url, {'context_id': 'bad'}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {'scope': '{}'}).status_code, 400)
        self.assertFalse(FeedbackJob.objects.exists())

    def test_admission_deduplicates_and_does_not_measure(self):
        self.complete()
        with patch.object(provider, 'request_raw') as call, patch('rehearsals.services.presentation_measurements.measure_audio') as measure:
            first = self.post_score()
            self.assertEqual(first.status_code, 202)
            second = self.post_score()
            state = self.client.get(self.url).json()
        self.assertEqual(second.json()['feedback_revision'], first.json()['feedback_revision'])
        self.assertEqual(state['assessment_status'], 'pending')
        owner = FeedbackAnalysis.objects.get(analysis_type__startswith='score_')
        self.assertEqual(len(owner.analysis_type), 30)
        self.assertEqual(owner.jobs.count(), 1)
        call.assert_not_called(); measure.assert_not_called()

    def test_context_is_deck_bound_and_changes_stale_without_read_generation(self):
        self.complete()
        other = self.new_deck('other')
        foreign = PresentationContext.objects.create(deck=other)
        self.assertEqual(self.post_score(context_id=str(foreign.pk)).status_code, 400)
        context = PresentationContext.objects.create(deck=self.deck, audience='Researchers')
        response = self.post_score(context_id=str(context.pk))
        self.assertEqual(response.status_code, 202)
        context.revision += 1; context.save()
        state = self.client.get(self.url, {'context_id': str(context.pk)}).json()
        self.assertTrue(state['stale'])
        self.assertEqual(FeedbackJob.objects.count(), 1)
        self.assertEqual(self.post_score(context_id=str(context.pk)).status_code, 409)
        response = self.post_score(context_id=str(context.pk), feedback_revision=state['feedback_revision'])
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['feedback_revision'], 2)

    def test_profile_generation_change_stales_even_unchanged_text(self):
        profile = self.complete()
        self.assertEqual(self.post_score().status_code, 202)
        profile.processing_revision += 1; profile.save()
        self.assertTrue(self.client.get(self.url).json()['stale'])

    def test_bad_alignment_never_admits_work(self):
        self.attempt.visits = []; self.attempt.save()
        self.assertEqual(self.post_score().status_code, 400)
        self.assertFalse(FeedbackJob.objects.exists())
