"""Public slide profiles use durable, separately reserved calls and one final deck."""
import json
from dataclasses import replace
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from .models import FeedbackRequest, FeedbackReservation, Installation, ProfilePart, Slide
from .ownership import installation_scope
from .services import descriptions, feedback_provider as provider, profile_parts, slide_profiles
from .services.feedback import FeedbackError, json_bytes
from .test_descriptions import SyntheticDecks
from .test_feedback_provider import envelope


@override_settings(OUTLOUD_PUBLIC_SERVICE=True)
class LargeProfileWorkTests(SyntheticDecks, TestCase):
    def setUp(self):
        super().setUp()
        self.enterContext(patch.dict('os.environ', {
            'FEEDBACK_PROVIDER':'openrouter', 'OPENROUTER_API_KEY':'fixture-key-never-in-a-model-receipt',
            'FEEDBACK_OPENROUTER_PROJECT_ID':'synthetic', 'FEEDBACK_OPENROUTER_RPM':'20',
            'FEEDBACK_OPENROUTER_TPM':'30000000', 'FEEDBACK_OPENROUTER_MODEL':'openai/example'}))
        self.owner = Installation.objects.create(token_hash='a'*64)
        self.deck.installation = self.owner
        self.deck.page_count = profile_parts.PART_THRESHOLD + 1
        self.deck.save(update_fields=['installation', 'page_count'])
        first = self.deck.slides.get(slide_index=0)
        for i in range(1, self.deck.page_count):
            Slide.objects.create(deck=self.deck, slide_index=i, extracted_text=f'Page {i}', image=first.image.name)
        self.enterContext(installation_scope(self.owner.pk))
        self.value = slide_profiles.ensure(self.deck.pk)

    def receipt(self, prepared):
        wire = json.loads(prepared.payload)
        context = json.loads(wire['input'][0]['content'][0]['text'])
        indexes = context['targets']
        if 'slides' in context:
            rows = [{'slide_index':i, 'slide_kind':'content','summary':{
                'text':f'Fact {i}','uncertain':False,'uncertainty':''},'key_ideas':[], 'visual_facts':[],
                'must_cover':[{'text':f'Explain observation {i}', 'evidence_refs':['summary']}]} for i in indexes]
        else:
            rows = [{'slide_index':i,'go_deeper':[{'text':'Connect the first and final observations',
                'kind':'connection','information_needed':'','evidence_refs':[
                    {'slide_index':self.deck.page_count-1,'fact_ref':'summary'}]}]} for i in indexes]
        return provider.RawReceipt('openrouter', 'openai/example', 'descriptions', prepared.input_hash, 200,
                                   json_bytes(envelope('openai',{'slides':rows})),True,None,None,())

    def run_turn(self, revision=1):
        descriptions.run_description(self.value.pk, revision)

    def test_normal_entry_point_only_publishes_whole_deck_and_records_each_call_once(self):
        groups = (self.deck.page_count + profile_parts.PART_SLIDES - 1)//profile_parts.PART_SLIDES
        def concurrent_delivery(prepared):
            self.run_turn()  # Duplicate queue delivery during an already submitted part.
            return self.receipt(prepared)
        with patch.object(provider,'request_raw',side_effect=concurrent_delivery) as network:
            for _ in range(groups*2):
                self.run_turn()
                self.assertIsNone(slide_profiles.read(self.deck.pk)['descriptions'])
            self.run_turn()
            self.run_turn()
            self.assertEqual(network.call_count, groups*2)
        self.assertEqual(FeedbackReservation.objects.count(), groups*2)
        self.assertEqual(FeedbackRequest.objects.filter(outcome='completed').count(), groups*2)
        state = slide_profiles.read(self.deck.pk)
        self.assertEqual(state['state'],'completed')
        self.assertEqual(len(state['descriptions']['slides']),self.deck.page_count)
        self.assertEqual(state['descriptions']['slides'][0]['go_deeper'][0]['evidence_refs'][0]['slide_index'],self.deck.page_count-1)
        other = Installation.objects.create(token_hash='b'*64)
        with installation_scope(other.pk):
            self.assertFalse(ProfilePart.objects.exists())
            self.assertFalse(FeedbackRequest.objects.exists())

    def test_known_failed_group_reuses_confirmed_groups_and_uncertain_send_requires_confirmation(self):
        with patch.object(provider,'request_raw',side_effect=self.receipt):
            self.run_turn()
        with patch.object(provider,'request_raw',side_effect=FeedbackError('transport_error',uncertain=True)) as blocked:
            self.run_turn()
            self.run_turn()
            self.assertEqual(blocked.call_count,1)
        state = slide_profiles.read(self.deck.pk)
        self.assertEqual(state['state'],'needs_confirmation')
        retry = {'description_set_id':str(self.value.pk),'processing_revision':1}
        with self.assertRaises(descriptions.Conflict):
            slide_profiles.ensure(self.deck.pk,retry)
        slide_profiles.ensure(self.deck.pk,{**retry,'acknowledge_uncertain':True})
        with patch.object(provider,'request_raw',side_effect=self.receipt) as network:
            self.run_turn(2)
            network.assert_not_called()
            self.run_turn(2)
            self.assertEqual(network.call_count,1)

    def test_recovery_normalizes_existing_part_receipt_without_resending(self):
        with patch.object(provider,'request_raw',side_effect=self.receipt) as network:
            with patch.object(profile_parts,'normalize_part',side_effect=RuntimeError('synthetic interruption')):
                with self.assertRaises(RuntimeError):
                    self.run_turn()
            job = self.value.jobs.get()
            job.claimed_at = timezone.now()-timedelta(hours=1)
            job.save(update_fields=['claimed_at'])
            with patch.object(descriptions, 'prepare_saved', side_effect=AssertionError('receipt needs no media')):
                self.run_turn()
            self.assertEqual(network.call_count,1)
        self.assertEqual(ProfilePart.objects.filter(result__isnull=False).count(),1)

    def test_lease_expiring_during_preparation_prevents_submission(self):
        prepare = profile_parts.prepare_part

        def expire_lease(*args, **kwargs):
            payload = prepare(*args, **kwargs)
            self.value.jobs.update(claimed_at=timezone.now() - timedelta(hours=1))
            return payload

        with patch.object(profile_parts, 'prepare_part', side_effect=expire_lease), \
                patch.object(provider, 'request_raw', side_effect=self.receipt) as network:
            self.run_turn()
        network.assert_not_called()
        self.assertFalse(FeedbackReservation.objects.exists())
        self.assertFalse(ProfilePart.objects.filter(result__isnull=False).exists())

    def test_source_changed_after_preparation_prevents_submission(self):
        prepare = profile_parts.prepare_part

        def replace_source(*args, **kwargs):
            payload = prepare(*args, **kwargs)
            self.deck.slides.filter(slide_index=0).update(extracted_text='Revised synthetic slide')
            return payload

        with patch.object(profile_parts, 'prepare_part', side_effect=replace_source), \
                patch.object(provider, 'request_raw', side_effect=self.receipt) as network:
            self.run_turn()
        network.assert_not_called()
        self.assertFalse(FeedbackReservation.objects.exists())
        self.assertEqual(self.value.jobs.get().error_code, 'source_changed')

    def test_late_receipt_before_retry_dispatch_reuses_original_call(self):
        def finish_after_retry_queued(prepared):
            self.value.jobs.update(claimed_at=timezone.now() - timedelta(hours=1))
            self.run_turn()  # Another worker observes the first worker's unanswered submission.
            self.assertEqual(self.value.jobs.get().state, 'needs_confirmation')
            slide_profiles.ensure(self.deck.pk, {
                'description_set_id': str(self.value.pk), 'processing_revision': 1,
                'acknowledge_uncertain': True,
            })
            return self.receipt(prepared)

        with patch.object(provider, 'request_raw', side_effect=finish_after_retry_queued) as network:
            self.run_turn()
        network.assert_called_once()
        request = FeedbackRequest.objects.get()
        self.assertEqual(request.outcome, 'completed')
        original_body = bytes(request.raw_body)
        with patch.object(provider, 'request_raw', side_effect=self.receipt) as repeat:
            self.run_turn(2)
        repeat.assert_not_called()
        request.refresh_from_db()
        self.assertEqual((request.outcome, bytes(request.raw_body)), ('completed', original_body))
        self.assertIsNotNone(request.completed_at)
        self.assertEqual(FeedbackReservation.objects.count(), 1)
        results = list(ProfilePart.objects.filter(phase=profile_parts.FACTS, offset=0)
                       .order_by('job__generation').values_list('result', flat=True))
        self.assertEqual(len(results), 2)
        self.assertIsNotNone(results[0])
        self.assertEqual(results[0], results[1])

    def test_claim_expiring_after_normalization_leaves_the_receipt_for_a_fresh_worker(self):
        normalize = profile_parts.normalize_part
        def expire_before_save(*args, **kwargs):
            result = normalize(*args, **kwargs)
            self.value.jobs.update(claimed_at=timezone.now() - timedelta(hours=1))
            return result

        with patch.object(provider, 'request_raw', side_effect=self.receipt) as network:
            with patch.object(profile_parts, 'normalize_part', side_effect=expire_before_save):
                self.run_turn()
            request = FeedbackRequest.objects.get()
            self.assertEqual(request.outcome, 'received')
            self.assertIsNone(request.completed_at)
            self.assertFalse(ProfilePart.objects.filter(result__isnull=False).exists())
            with patch.object(descriptions, 'prepare_saved', side_effect=AssertionError('media read')):
                self.run_turn()
            network.assert_called_once()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'completed')
        self.assertIsNotNone(request.profile_part.result)

    def check_historical_receipt_recovery(self, receipt_status, expected_outcome):
        from .services import profile_work
        from .services.feedback_config import Selection

        normalize = profile_parts.normalize_part
        crash_after_receipt = False
        def normalize_until_interrupted(*args, **kwargs):
            if crash_after_receipt:
                raise RuntimeError('synthetic interruption after old receipt commit')
            return normalize(*args, **kwargs)
        def finish_old_transport(prepared):
            nonlocal crash_after_receipt
            self.value.jobs.update(claimed_at=timezone.now() - timedelta(hours=1))
            self.run_turn()  # Its missing receipt requires explicit confirmation.
            slide_profiles.ensure(self.deck.pk, {'description_set_id': str(self.value.pk),
                'processing_revision': 1, 'acknowledge_uncertain': True})
            with patch.object(provider, 'request_raw', side_effect=self.receipt) as replacement:
                self.run_turn(2)
            replacement.assert_called_once()
            crash_after_receipt = True
            return replace(self.receipt(prepared), status_code=receipt_status)

        with patch.object(provider, 'request_raw', side_effect=finish_old_transport), \
                patch.object(profile_parts, 'normalize_part', side_effect=normalize_until_interrupted), \
                self.assertRaisesRegex(RuntimeError, 'old receipt'):
            self.run_turn()
        record = FeedbackRequest.objects.get(profile_part__job__generation=1)
        self.assertEqual(record.outcome, 'received')
        self.assertIsNone(record.completed_at)
        raw = bytes(record.raw_body)
        current = self.value.jobs.get(generation=2)
        public_rows = (self.value.jobs.values('generation', 'state', 'claimed_at', 'completed_at').order_by('generation'))
        before = list(public_rows)
        self.value.refresh_from_db()
        updated = self.value.updated_at
        with patch.object(descriptions, 'publish') as wake:
            profile_work.recover()
            wake.assert_called_once_with(self.value.pk, 1)
        with patch.object(provider, 'request_raw', side_effect=AssertionError('old provider dispatch')), \
                patch.object(descriptions, 'prepare_saved', side_effect=AssertionError('old media read')), \
                patch.object(Selection, 'credentials', side_effect=AssertionError('old credentials')):
            self.run_turn(1)
            self.run_turn(1)
        record.refresh_from_db()
        self.value.refresh_from_db()
        self.assertEqual((record.outcome, bytes(record.raw_body)), (expected_outcome, raw))
        self.assertIsNotNone(record.completed_at)
        self.assertEqual(record.profile_part.result is not None, receipt_status == 200)
        self.assertEqual(self.value.updated_at, updated)
        self.assertEqual(list(public_rows.all()), before)
        self.assertIsNotNone(current.profile_parts.get(phase=profile_parts.FACTS, offset=0).result)
        self.assertEqual(FeedbackReservation.objects.count(), 2)
        with patch.object(descriptions, 'publish') as wake:
            profile_work.recover()
            wake.assert_not_called()

    def test_beat_finalizes_old_success_after_replacement_dispatched_without_new_work(self):
        self.check_historical_receipt_recovery(200, 'completed')

    def test_beat_finalizes_old_rejection_after_replacement_dispatched_without_new_work(self):
        self.check_historical_receipt_recovery(401, 'rejected')
