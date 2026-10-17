"""Iteration 2 profiles: synthetic images, mocked provider, durable real jobs."""
from datetime import timedelta
import hashlib
from unittest.mock import patch
from unittest import skipUnless
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.test import TestCase, TransactionTestCase
from django.db import connection, connections
from django.utils import timezone

from .models import DescriptionSet, DescriptionJob, FeedbackRequest
from .services import slide_profiles as profiles, descriptions, feedback_provider as provider
from .services.feedback import FeedbackError, json_bytes
from .services.feedback_config import Selection, prompt_digest
from .test_descriptions import SyntheticDecks, description_value
from .test_feedback_provider import envelope


def profile_value(prepared):
    value = description_value(prepared)
    for slide in value['slides']:
        slide.update(slide_kind='content', cues=[{'text': 'Explain the slide', 'evidence_refs': ['summary']}])
    return value


class SlideProfileTests(SyntheticDecks, TestCase):
    def setUp(self):
        super().setUp()
        from dataclasses import replace
        current = Selection.profiles()
        legacy = replace(current, prompt_version='slide-profile-v1',
            schema_version='slide-profile-v1' if current.provider == 'openai' else 'slide-profile-gemini-v1')
        scope = patch.object(Selection, 'profiles', return_value=legacy)
        scope.start()
        self.addCleanup(scope.stop)

    def receipt(self, prepared):
        return provider.RawReceipt(prepared.config.provider, prepared.config.model, 'descriptions', prepared.input_hash,
            200, json_bytes(envelope(prepared.config.provider, profile_value(prepared.analysis))), True, None, None, ())

    def test_profile_schema_is_separate_and_validates_graph_cues(self):
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        selection = Selection.profiles()
        request = selection.adapter().prepare_descriptions(prepared)
        self.assertIn(b'inlineData', request.payload)
        self.assertIn(b'axes', request.payload)
        result = provider.normalize(request, self.receipt(request))
        self.assertEqual(result.descriptions.slides[0].cues[0].evidence_refs, ('summary',))
        for mutate in [lambda s: s.update(cues=s['cues'] * 5),
                       lambda s: s['cues'][0].update(evidence_refs=['visual_facts/4']),
                       lambda s: s['summary'].update(uncertain=True, uncertainty='Unreadable graph'),
                       lambda s: s.update(slide_kind='invented'), lambda s: s.pop('cues'),
                       lambda s: s['cues'][0].update(text='\ud800')]:
            value = profile_value(prepared)
            mutate(value['slides'][0])
            receipt = self.receipt(request)
            # json_bytes rejects invalid Unicode before constructing a provider receipt.
            with self.assertRaises(FeedbackError):
                receipt = type(receipt)(receipt.provider, receipt.model, receipt.stage, receipt.input_hash,
                    200, json_bytes(envelope(receipt.provider, value)), True, None, None, ())
                provider.normalize(request, receipt)
        value = profile_value(prepared)
        value['slides'][0].update(slide_kind='title', cues=[])
        self.assertEqual(profiles.validate_profiles(value, prepared, selection.schema_version).slides[0].cues, ())

    def test_admission_deduplicates_and_reads_do_not_admit(self):
        url = f'/api/decks/{self.deck.pk}/profiles/'
        self.assertEqual(self.client.get(url).data['state'], 'absent')
        self.assertEqual(DescriptionSet.objects.count(), 0)
        with self.captureOnCommitCallbacks(execute=True):
            first = profiles.ensure(self.deck.pk)
            again = profiles.ensure(self.deck.pk)
        self.assertEqual(first.pk, again.pk)
        self.assertEqual(DescriptionJob.objects.count(), 1)
        self.assertEqual(self.broker.call_count, 1)
        with patch.object(provider, 'request_raw', side_effect=self.receipt) as calls:
            descriptions.run_description(str(first.pk), 1)
            descriptions.run_description(str(first.pk), 1)
        self.assertEqual(calls.call_count, 1)
        self.assertEqual(profiles.ensure(self.deck.pk).pk, first.pk)
        state = self.client.get(url).data
        self.assertFalse(state['stale'])
        self.assertEqual(state['descriptions']['slides'][0]['cues'][0]['text'], 'Explain the slide')
        # Existing JJ description scope is still independently absent.
        self.assertEqual(self.client.get(self.url).data['state'], 'absent')
        edit = self.client.patch(self.url, {'description_set_id': str(first.pk), 'description_revision': 1,
            'descriptions': state['descriptions']}, format='json')
        self.assertEqual(edit.status_code, 409)

    def test_failed_or_uncertain_profiles_never_automatically_resubmit(self):
        value = profiles.ensure(self.deck.pk)
        with patch.object(provider, 'request_raw', side_effect=FeedbackError('transport_error', uncertain=True)) as calls:
            descriptions.run_description(str(value.pk), 1)
        self.assertEqual(calls.call_count, 1)
        self.assertEqual(profiles.ensure(self.deck.pk).processing_revision, 1)
        url = f'/api/decks/{self.deck.pk}/profiles/generate/'
        payload = {'description_set_id': str(value.pk), 'processing_revision': 1}
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 409)
        payload['acknowledge_uncertain'] = True
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 202)
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 409)

    def test_saved_profile_receipt_recovers_without_key_or_second_call(self):
        value = profiles.ensure(self.deck.pk)
        with patch.object(provider, 'request_raw', side_effect=self.receipt) as calls, \
                patch.object(descriptions, 'finish', side_effect=RuntimeError('Synthetic crash')):
            descriptions.run_description(str(value.pk), 1)
        self.assertEqual(calls.call_count, 1)
        self.assertIsNotNone(FeedbackRequest.objects.get(job__description_set=value).received_at)
        DescriptionJob.objects.filter(description_set=value).update(claimed_at=timezone.now() - timedelta(minutes=10))
        with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}), \
                patch.object(provider, 'request_raw', side_effect=AssertionError('No resubmission')):
            descriptions.recover_descriptions()
            descriptions.run_description(str(value.pk), 1)
        value.refresh_from_db()
        self.assertEqual(value.description_revision, 1)
        self.assertEqual(len(value.descriptions['slides'][0]['cues']), 1)

    def test_existing_schema_and_prompt_bytes_remain_unchanged(self):
        golden = {
            ('openai', 'description-v1'): ('297116d8e2741e47fa5dadf35193d7bfcbc758a74d2d3b4f565108a0a9b0e150', '4346a9c6ac7444f5b9ad7ef9c49abf6b2ba0235debe3b76ad9448d849eea252d'),
            ('openai', 'description-v2'): ('6396e562d75b25595de233c25399a71d9457757ba4d03a2ba7ba4891f6a59a3f', '65f7f96554056822d27ea4146d88235ce0611e3b239e004ea50058a060b4a655'),
            ('gemini', 'description-gemini-v4'): ('b05d465e0abaf13d2e10de213f40b51e6f0a6398c4ceddd336ca37a9ce9ef46a', 'd95ca7da3d60e2571d4002bf8f8d5ff303b14d42e89ef6558f8ac31b6e4f2e79'),
            ('gemini', 'description-v1'): ('297116d8e2741e47fa5dadf35193d7bfcbc758a74d2d3b4f565108a0a9b0e150', '4346a9c6ac7444f5b9ad7ef9c49abf6b2ba0235debe3b76ad9448d849eea252d'),
            ('gemini', 'description-gemini-v2'): ('6eadc505af51844df434ebff0bb0c7fa8e8a2eb66f203fe0f14a9bb2229f6fc9', '1f9cd280a34a3a6953d287e58604eb70dbcdf9a165c75f7ff73237bf5f6a8097'),
            ('gemini', 'description-gemini-v3'): ('907ed9e56b0999adaf9f4425b40962338ce35ca53f683a6271bccaa3e0a7a026', 'c6d92b88830155bec98f43b73b792bcc440435866a0e308bd160f7068e1ff8d2'),
        }
        for (name, version), (schema, prompt) in golden.items():
            self.assertEqual(hashlib.sha256(json_bytes(provider.response_schema(name, 'descriptions', version))).hexdigest(), schema)
            self.assertEqual(prompt_digest(name, version), prompt)

    def test_upload_admits_once_and_ai_failure_does_not_break_import(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        url = '/api/decks/'
        with patch('rehearsals.views.store_deck', return_value=self.deck), self.captureOnCommitCallbacks(execute=True):
            for _ in range(2):
                response = self.client.post(url, {'file': SimpleUploadedFile('synthetic.pdf', b'%PDF synthetic'), 'title': 'Synthetic'})
                self.assertEqual(response.status_code, 201)
        self.assertEqual(DescriptionSet.objects.count(), 1)
        self.assertEqual(DescriptionJob.objects.count(), 1)
        with patch('rehearsals.views.store_deck', return_value=self.deck), patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false'}):
            self.assertEqual(self.client.post(url, {'title': 'Synthetic'}).status_code, 201)

    def test_new_source_invalidates_old_profile_without_modifying_it(self):
        value = profiles.ensure(self.deck.pk)
        with patch.object(provider, 'request_raw', side_effect=self.receipt):
            descriptions.run_description(str(value.pk), 1)
        before = DescriptionSet.objects.get(pk=value.pk).descriptions
        self.deck.slides.update(extracted_text='Synthetic changed source')
        self.assertTrue(profiles.read(self.deck.pk, value.pk)['stale'])
        new = profiles.ensure(self.deck.pk)
        self.assertNotEqual(value.pk, new.pk)
        self.assertEqual(DescriptionSet.objects.get(pk=value.pk).descriptions, before)

    def test_profiles_reject_description_scope_and_strict_bad_requests(self):
        old = self.admit()
        url = f'/api/decks/{self.deck.pk}/profiles/'
        self.assertEqual(self.client.get(url, {'description_set_id': str(old.pk)}).status_code, 400)
        for payload in [{'description_set_id': str(old.pk)}, {'processing_revision': True}, {'audience': 'Synthetic'}]:
            self.assertEqual(self.client.post(url + 'generate/', payload, format='json').status_code, 400)


@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL row-lock verification')
class ProfileConcurrencyTests(SyntheticDecks, TransactionTestCase):
    def test_two_admissions_create_one_profile_job(self):
        barrier = Barrier(2)
        def admit():
            connections.close_all()
            try:
                barrier.wait(timeout=10)
                return profiles.ensure(self.deck.pk).pk
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            values = list(pool.map(lambda _: admit(), range(2)))
        self.assertEqual(values[0], values[1])
        self.assertEqual(DescriptionSet.objects.count(), 1)
        self.assertEqual(DescriptionJob.objects.count(), 1)
