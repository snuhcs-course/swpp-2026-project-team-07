"""Synthetic decks and mocked transports only. PostgreSQL races live below."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone as dt_timezone
import hashlib
import io
import json
import logging
import tempfile
from threading import Barrier, Event
from unittest import skipUnless
from unittest.mock import patch
import uuid

from django.core.files.base import ContentFile
from django.db import connection, connections, DatabaseError
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from .models import (Deck, Slide, Attempt, ProviderRequest, DescriptionSet, DescriptionJob,
                     FeedbackRequest, FeedbackQuotaBucket, FeedbackReservation)
from .services import descriptions as service, feedback_provider as provider
from .services.feedback import FeedbackError, json_bytes, prepare_analysis, prepare_deck
from .services.feedback_config import Selection
from .services.feedback_quota import daily_window
from .test_feedback import description_value as evidence_descriptions, fixture
from .test_feedback_provider import envelope

ENV = {'FEEDBACK_ENABLED': 'true', 'FEEDBACK_PROVIDER': 'gemini',
       'FEEDBACK_GEMINI_PROJECT_ID': 'synthetic-project', 'FEEDBACK_OPENAI_PROJECT_ID': 'synthetic-openai',
       'FEEDBACK_GEMINI_RPM': '100', 'FEEDBACK_GEMINI_TPM': '10000000',
       'FEEDBACK_OPENAI_RPM': '100', 'FEEDBACK_OPENAI_TPM': '10000000',
       'GEMINI_API_KEY': 'synthetic-key', 'OPENAI_API_KEY': 'synthetic-openai-key'}


def description_value(prepared):
    value = evidence_descriptions(prepared)
    for slide in value['slides']:
        slide['deck_id'] = prepared.source.deck_id
    return value


class SyntheticDecks:
    def setUp(self):
        super().setUp()
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        settings = override_settings(MEDIA_ROOT=directory.name)
        settings.enable()
        self.addCleanup(settings.disable)
        env = patch.dict('os.environ', ENV, clear=True)
        env.start()
        self.addCleanup(env.stop)
        network = patch('rehearsals.services.feedback_provider.httpx.HTTPTransport.handle_request',
                        side_effect=AssertionError('Live network forbidden'))
        self.network = network.start()
        self.addCleanup(network.stop)
        broker = patch('rehearsals.tasks.describe_deck.delay')
        self.broker = broker.start()
        self.addCleanup(broker.stop)
        self.deck = self.new_deck('one')
        self.client = APIClient()
        self.url = f'/api/decks/{self.deck.pk}/descriptions/'
        self.post = self.url + 'generate/'

    def new_deck(self, name):
        pdf = b'%PDF-1.4\n% synthetic bounded fixture ' + name.encode() + b'\n%%EOF'
        deck = Deck(title='Synthetic ' + name, page_count=1, content_hash=hashlib.sha256(pdf).hexdigest())
        deck.pdf.save(name + '.pdf', ContentFile(pdf))
        data = io.BytesIO()
        Image.new('RGB', (10, 10), 'white').save(data, format='PNG')
        slide = Slide(deck=deck, slide_index=0, extracted_text='Synthetic slide ' + name)
        slide.image.save(name + '.png', ContentFile(data.getvalue()))
        return deck

    def admit(self, deck=None):
        return service.generate((deck or self.deck).pk, {})

    def execute(self, value):
        service.run_description(str(value.pk), value.processing_revision)
        value.refresh_from_db()
        return value

    def receipt(self, prepared, *, status=200, body=None, complete=True, issue=None, retry_at=None):
        self.assertFalse(connection.in_atomic_block if isinstance(self, TransactionTestCase) and not isinstance(self, TestCase) else False)
        return provider.RawReceipt(prepared.config.provider, prepared.config.model, 'descriptions', prepared.input_hash,
            status, body if body is not None else json_bytes(envelope(prepared.config.provider, description_value(prepared.analysis))),
            complete, issue, retry_at, ((('total_tokens' if prepared.config.provider == 'openai' else 'totalTokenCount'), 23),))

    def complete(self, value=None):
        value = value or self.admit()
        with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
            self.execute(value)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(value.description_revision, 1)
        return value

    def edited(self, value, text='User correction'):
        deck, _ = service.prepare_saved(self.deck.pk)
        descriptions = description_value(deck)
        descriptions['slides'][0]['summary']['text'] = text
        return {'description_set_id': str(value.pk), 'description_revision': value.description_revision,
                'descriptions': descriptions}

    def state(self, value):
        return service.read(value.deck_id, value.pk)


class DescriptionTests(SyntheticDecks, TestCase):
    def test_provider_null_facts_fail_once_with_private_receipt_and_explicit_retry(self):
        # SQLite accepts U+0000 in JSON; PostgreSQL JSONB cannot represent it.
        # Exercise both adapters and every fact location before any result write.
        for selected in ['gemini', 'openai']:
            for location in ['summary', 'key_ideas', 'visual_facts']:
                for field in ['text', 'uncertainty']:
                    with self.subTest(provider=selected, location=location, field=field), \
                            patch.dict('os.environ', {'FEEDBACK_PROVIDER': selected}):
                        value = self.admit(self.new_deck('-'.join([selected, location, field])))

                        def send(prepared):
                            output = description_value(prepared.analysis)
                            fact = output['slides'][0][location]
                            fact = fact if location == 'summary' else fact[0]
                            fact.update(uncertain=field == 'uncertainty', uncertainty='')
                            fact[field] = 'Synthetic\x00unsupported character'
                            return self.receipt(prepared, body=json_bytes(envelope(selected, output)))

                        with patch.object(provider, 'request_raw', side_effect=send) as call, \
                                patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                            self.execute(value)
                            state = self.state(value)
                            self.assertEqual(state['state'], 'failed')
                            self.assertEqual(state['error']['code'], 'invalid_descriptions')
                            self.assertFalse(state['requires_confirmation'])
                            self.assertTrue(state['retry_available'])
                            self.assertIsNone(value.descriptions)
                            self.assertEqual(value.description_revision, 0)
                            request = FeedbackRequest.objects.get(job__description_set=value)
                            self.assertIsNotNone(request.received_at)
                            self.assertIsNotNone(request.completed_at)
                            self.assertEqual(request.outcome, 'invalid')
                            self.assertIn(b'\\u0000', bytes(request.raw_body))
                            self.assertNotIn('unsupported character', json.dumps(state, default=str))
                            self.broker.reset_mock()
                            service.recover_descriptions()
                            self.execute(value)
                            self.broker.assert_not_called()
                            self.assertEqual(normalize.call_count, 1)
                            # No retry permission is inferred from an initial POST.
                            post = f'/api/decks/{value.deck_id}/descriptions/generate/'
                            self.assertEqual(self.client.post(post, {}, format='json').status_code, 409)
                            response = self.client.post(post, {'description_set_id': str(value.pk),
                                'processing_revision': 1}, format='json')
                            self.assertEqual(response.status_code, 202)
                            self.assertEqual(response.data['processing_revision'], 2)
                            self.assertEqual(call.call_count, 1)
                        # The explicitly admitted new generation alone may call.
                        self.complete(DescriptionSet.objects.get(pk=value.pk))
                        request.refresh_from_db()
                        self.assertEqual(request.outcome, 'invalid')
                        self.assertEqual(FeedbackRequest.objects.filter(job__description_set=value).count(), 2)

    def test_null_fact_edit_preserves_prior_unicode_descriptions_and_revisions(self):
        value = self.complete()
        payload = self.edited(value)
        slide = payload['descriptions']['slides'][0]
        # Preserve other Unicode and whitespace verbatim; reject only U+0000.
        unicode_text = '한글 café e\u0301 😀\tline\nnext\u200d'
        for fact in [slide['summary'], *slide['key_ideas'], *slide['visual_facts']]:
            fact.update(text=unicode_text, uncertain=True, uncertainty=unicode_text)
        self.assertEqual(self.client.patch(self.url, payload, format='json').status_code, 200)
        value.refresh_from_db()
        self.assertEqual(value.descriptions, payload['descriptions'])
        before = DescriptionSet.objects.filter(pk=value.pk).values().get()
        before_job = value.jobs.values().get()
        with patch.object(provider, 'request_raw') as call:
            for location in ['summary', 'key_ideas', 'visual_facts']:
                for field in ['text', 'uncertainty']:
                    with self.subTest(location=location, field=field):
                        value.refresh_from_db()
                        payload = self.edited(value)
                        fact = payload['descriptions']['slides'][0][location]
                        fact = fact if location == 'summary' else fact[0]
                        fact.update(uncertain=field == 'uncertainty', uncertainty='')
                        fact[field] = 'Synthetic\x00unsupported character'
                        response = self.client.patch(self.url, payload, format='json')
                        self.assertEqual(response.status_code, 400)
                        self.assertEqual(response.data['error']['code'], 'invalid_descriptions')
                        self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), before)
                        self.assertEqual(value.jobs.values().get(), before_job)
            call.assert_not_called()
        self.assertEqual(FeedbackRequest.objects.count(), 1)

    def test_saved_deck_needs_no_attempt_and_calls_have_no_rehearsal_data(self):
        value = self.admit()
        def send(prepared):
            self.assertEqual(Attempt.objects.count(), 0)
            record = FeedbackRequest.objects.get()
            self.assertIsNotNone(record.submitted_at)
            self.assertEqual(FeedbackReservation.objects.count(), 1)
            payload = json.loads(prepared.payload)
            context = json.loads(payload['contents'][0]['parts'][0]['text'])
            self.assertEqual(set(context), {'slides'})
            self.assertNotIn('audience', context)
            self.assertNotIn('transcript', context)
            self.assertNotIn('audio', context)
            self.assertEqual(context['slides'][0]['source_language'], 'und')
            return self.receipt(prepared)
        with patch.object(provider, 'request_raw', side_effect=send) as call:
            self.execute(value)
            self.execute(value)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(value.description_revision, 1)
        self.assertEqual(ProviderRequest.objects.count(), 0)

    def test_deck_identity_reused_across_recordings_without_weakening_preflight(self):
        raw, images = fixture()
        a = prepare_analysis(raw, images)
        raw['attempt_id'] = str(uuid.uuid4())
        raw['audience'] = 'Other synthetic audience'
        b = prepare_analysis(raw, images)
        self.assertNotEqual(a.input_id, b.input_id)
        self.assertEqual(a.deck.input_id, b.deck.input_id)
        adapter = Selection.current().adapter()
        result = adapter.edited_descriptions(a, description_value(a))
        adapter.prepare_coaching(b, result)
        saved_deck = prepare_deck({'deck_id': a.source.deck_id, 'content_hash': 'f' * 64,
            'preparation_version': 'saved-v1', 'slides': [slide.model_dump(mode='json') for slide in a.source.slides]}, images)
        saved_analysis = prepare_analysis(raw, images, prepared_deck=saved_deck)
        self.assertEqual(saved_analysis.deck.input_id, saved_deck.input_id)
        adapter.prepare_coaching(saved_analysis, adapter.edited_descriptions(saved_deck, description_value(saved_deck)))
        raw['transcript'] = None
        for visit in raw['visits']:
            visit['word_indexes'] = []
        with self.assertRaises(FeedbackError) as error:
            prepare_analysis(raw, images, prepared_deck=saved_deck)
        self.assertEqual(error.exception.code, 'missing_transcript')

    def test_get_never_writes_and_initial_and_completed_posts_are_idempotent(self):
        self.assertEqual(self.client.get(self.url).data['state'], 'absent')
        self.assertEqual(DescriptionSet.objects.count(), 0)
        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(self.post, {}, format='json')
            second = self.client.post(self.post, {}, format='json')
        self.assertEqual((first.status_code, second.status_code), (202, 202))
        self.assertEqual(first.data['description_set_id'], second.data['description_set_id'])
        self.assertEqual(self.broker.call_count, 1)
        value = self.complete(DescriptionSet.objects.get())
        self.broker.reset_mock()
        for _ in range(3):
            self.assertEqual(self.client.get(self.url).data['description_revision'], 1)
            self.assertEqual(self.client.post(self.post, {}, format='json').status_code, 200)
        self.broker.assert_not_called()
        self.assertEqual(DescriptionJob.objects.count(), 1)
        self.assertEqual(FeedbackRequest.objects.count(), 1)
        self.network.assert_not_called()

    def test_public_state_uses_consistent_set_and_job_revisions(self):
        old = self.admit()
        self.complete(DescriptionSet.objects.get(pk=old.pk))
        response = service.public_state(old.deck_id, old, source=old.source_fingerprint)
        self.assertEqual(response['state'], 'completed')
        self.assertEqual(response['description_revision'], 1)
        self.assertTrue(response['available_data'])
        self.assertIsNotNone(response['descriptions'])

    def test_explicit_cached_reads_and_edits_ignore_disabled_and_missing_keys(self):
        value = self.complete()
        with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': '', 'FEEDBACK_GEMINI_PROJECT_ID': ''}):
            read = self.client.get(self.url, {'description_set_id': str(value.pk)})
            self.assertEqual(read.status_code, 200)
            self.assertTrue(read.data['available_data'])
            self.assertTrue(read.data['stale'])
            edit = self.client.patch(self.url, self.edited(value), format='json')
            self.assertEqual(edit.status_code, 200)
            self.assertTrue(edit.data['edited'])
        self.assertEqual(FeedbackRequest.objects.count(), 1)

    def test_openai_description_uses_its_project_policy_and_utc_daily_window(self):
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai', 'FEEDBACK_GEMINI_RPM': '',
                                      'FEEDBACK_OPENAI_DAILY_REQUEST_LIMIT': '1'}):
            value = self.complete()
            request = FeedbackRequest.objects.get()
            self.assertEqual((request.provider, request.project_id, request.model),
                             ('openai', 'synthetic-openai', 'gpt-6-luna'))
            second = self.admit(self.new_deck('openai-second'))
            with patch.object(provider, 'request_raw') as call:
                self.execute(second)
            call.assert_not_called()
            self.assertEqual(self.state(second)['retry_at'], daily_window('openai', timezone.now())[1])

    def test_disabled_missing_key_quota_project_and_bad_config_fail_without_jobs(self):
        for changes in [{'FEEDBACK_ENABLED': 'false'}, {'GEMINI_API_KEY': ''},
                        {'FEEDBACK_GEMINI_RPM': ''}, {'FEEDBACK_GEMINI_TPM': '0'},
                        {'FEEDBACK_GEMINI_PROJECT_ID': ''}, {'FEEDBACK_PROVIDER': 'bad'}]:
            with self.subTest(changes=changes), patch.dict('os.environ', changes):
                self.assertEqual(self.client.post(self.post, {}, format='json').status_code, 503)
                self.assertIn(self.client.get(self.url).data['state'], {'disabled', 'configuration_unavailable'})
        self.assertEqual(DescriptionSet.objects.count(), 0)
        self.assertEqual(FeedbackRequest.objects.count(), 0)
        self.network.assert_not_called()

    def test_scope_isolates_provider_model_project_prompt_schema_source_and_edits(self):
        old = self.complete()
        service.edit(self.deck.pk, self.edited(old))
        scopes = [old.pk]
        for changes in [{'FEEDBACK_PROVIDER': 'openai'}, {'FEEDBACK_GEMINI_MODEL': 'other-model'},
                        {'FEEDBACK_GEMINI_PROJECT_ID': 'other-project'}]:
            with patch.dict('os.environ', changes):
                scopes.append(self.admit().pk)
        for field in ['DESCRIPTION_PROMPT_VERSION', 'DESCRIPTION_SCHEMA_VERSION']:
            with patch.object(provider, field, 'changed-v2'):
                scopes.append(self.admit().pk)
        slide = self.deck.slides.get()
        slide.extracted_text = 'Changed synthetic source'
        slide.save()
        scopes.append(self.admit().pk)
        self.assertEqual(len(set(scopes)), 7)
        old.refresh_from_db()
        self.assertTrue(old.edited)
        self.assertEqual(old.description_revision, 2)
        self.assertTrue(self.state(old)['stale'])

    def test_edit_exact_source_evidence_and_revisions(self):
        value = self.complete()
        good = self.edited(value)
        for mutate in [lambda p: p['descriptions']['slides'][0].update(source_id='0' * 64),
                       lambda p: p['descriptions']['slides'][0].update(deck_id=str(uuid.uuid4())),
                       lambda p: p['descriptions']['slides'].append(p['descriptions']['slides'][0]),
                       lambda p: p['descriptions']['slides'][0]['summary'].update(uncertain=True),
                       lambda p: p['descriptions']['slides'][0]['summary'].update(text=' '),
                       lambda p: p['descriptions']['slides'][0].update(extra='bad')]:
            payload = json.loads(json.dumps(good)); mutate(payload)
            self.assertEqual(self.client.patch(self.url, payload, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self.url, good, format='json').status_code, 200)
        self.assertEqual(self.client.patch(self.url, good, format='json').status_code, 409)
        slide = self.deck.slides.get(); slide.extracted_text = 'Changed'; slide.save()
        value.refresh_from_db()
        self.assertEqual(self.client.patch(self.url, self.edited(value), format='json').status_code, 409)
        self.assertEqual(FeedbackRequest.objects.count(), 1)

    def test_request_validation_before_media_and_ownership(self):
        for payload in [[], {'provider': 'openai'}, {'model': 'other'}, {'key': 'private'}, {'project_id': 'x'},
                        {'url': 'https://invalid.test'}, {'processing_revision': True},
                        {'description_set_id': 'bad'}, {'description_set_id': str(uuid.uuid4()), 'processing_revision': '1'},
                        {'acknowledge_uncertain': True}]:
            with patch.object(service, 'prepare_saved') as prepare:
                self.assertEqual(self.client.post(self.post, payload, format='json').status_code, 400)
            prepare.assert_not_called()
        for body in [b'{}' + b' ' * (71 * 1024), b'{"description_set_id":1,"description_set_id":2}', b'{']:
            self.assertEqual(self.client.generic('POST', self.post, body, content_type='application/json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/decks/{uuid.uuid4()}/descriptions/generate/', {}, format='json').status_code, 404)
        value = self.admit()
        other = self.new_deck('other')
        self.assertEqual(self.client.get(f'/api/decks/{other.pk}/descriptions/', {'description_set_id': str(value.pk)}).status_code, 404)
        self.assertEqual(self.client.post(f'/api/decks/{other.pk}/descriptions/generate/',
            {'description_set_id': str(value.pk), 'processing_revision': 1}, format='json').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/decks/{other.pk}/descriptions/', self.edited(value), format='json').status_code, 404)

    def test_uncertain_retry_requires_fresh_revision_ack_and_replay_wins_once(self):
        value = self.admit()
        with patch.object(provider, 'request_raw', side_effect=FeedbackError('provider_timeout', uncertain=True)) as call:
            self.execute(value)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(self.state(value)['state'], 'needs_confirmation')
        self.assertIsNone(FeedbackRequest.objects.get().usage)
        for payload in [{}, {'description_set_id': str(value.pk)},
                        {'description_set_id': str(value.pk), 'processing_revision': 1}]:
            self.assertEqual(self.client.post(self.post, payload, format='json').status_code, 409)
        payload = {'description_set_id': str(value.pk), 'processing_revision': 1, 'acknowledge_uncertain': True}
        self.assertEqual(self.client.post(self.post, payload, format='json').status_code, 202)
        self.assertEqual(self.client.post(self.post, payload, format='json').status_code, 409)
        self.assertEqual(DescriptionJob.objects.count(), 2)
        self.assertEqual(FeedbackReservation.objects.count(), 1)

    def test_stored_selection_retry_keeps_original_provider_model_project(self):
        value = self.admit()
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, status=401)):
            self.execute(value)
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai', 'FEEDBACK_GEMINI_MODEL': 'new-model', 'GEMINI_API_KEY': 'rotated-same-project'}):
            value = service.generate(self.deck.pk, {'description_set_id': str(value.pk), 'processing_revision': 1})
            def send(prepared):
                self.assertEqual(prepared.config.provider, 'gemini')
                self.assertEqual(prepared.config.model, 'gemini-3.1-flash-lite')
                self.assertEqual(prepared.config.key, 'rotated-same-project')
                return self.receipt(prepared)
            with patch.object(provider, 'request_raw', side_effect=send) as call:
                self.execute(value)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(value.description_revision, 1)
        self.assertEqual(FeedbackRequest.objects.count(), 2)

    def test_disabled_project_changed_prompt_changed_and_source_missing_queued_zero_calls(self):
        for label in ['disabled', 'project', 'prompt', 'source', 'key']:
            with self.subTest(label=label):
                deck = self.new_deck(label)
                value = self.admit(deck)
                context = patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false'}) if label == 'disabled' else \
                    patch.dict('os.environ', {'FEEDBACK_GEMINI_PROJECT_ID': 'changed-project'}) if label == 'project' else \
                    patch.object(provider, 'DESCRIPTION_RULES', 'new unsnapshotted prompt') if label == 'prompt' else \
                    patch.dict('os.environ', {'GEMINI_API_KEY': ''}) if label == 'key' else \
                    patch.object(service, '_read', side_effect=FeedbackError('source_unavailable'))
                with context, patch.object(provider, 'request_raw') as call:
                    self.execute(value)
                call.assert_not_called()
                self.assertEqual(self.state(value)['state'], 'failed')
                self.assertIsNone(FeedbackRequest.objects.get(job__description_set=value).submitted_at)

    def test_tampered_request_hash_snapshot_and_prompt_versions_prevent_submission(self):
        for label in ['hash', 'snapshot', 'version']:
            value = self.admit(self.new_deck(label))
            if label == 'hash':
                value.input_hash = '0' * 64
            elif label == 'version':
                value.prompt_version = 'unavailable-old-prompt'
            else:
                value.source_snapshot['source']['slides'][0]['extracted_text'] = 'Changed snapshot'
            value.save()
            with patch.object(provider, 'request_raw') as call:
                self.execute(value)
            call.assert_not_called()
            self.assertEqual(self.state(value)['state'], 'failed')
        self.assertEqual(FeedbackReservation.objects.count(), 0)

    def test_missing_corrupt_and_oversized_media_fail_locally(self):
        slide = self.deck.slides.get()
        for data in [b'corrupt', b'x' * (1024 * 1024 + 1)]:
            slide.image.save('bad.png', ContentFile(data))
            response = self.client.post(self.post, {}, format='json')
            self.assertEqual(response.status_code, 400)
        slide.image.name = 'missing.png'; slide.save()
        self.assertEqual(self.client.post(self.post, {}, format='json').status_code, 400)
        self.network.assert_not_called()
        self.assertEqual(DescriptionSet.objects.count(), 0)

    def test_no_call_if_marker_commit_or_last_freshness_fails(self):
        value = self.admit()
        original = FeedbackRequest.save
        def fail_marker(record, *args, **kwargs):
            if record.submitted_at:
                raise DatabaseError('synthetic private db error')
            return original(record, *args, **kwargs)
        with patch.object(FeedbackRequest, 'save', fail_marker), patch.object(provider, 'request_raw') as call:
            self.execute(value)
        call.assert_not_called()
        self.assertEqual(FeedbackReservation.objects.count(), 0)
        self.assertIsNone(FeedbackRequest.objects.get().submitted_at)

    def test_private_raw_rejected_malformed_incomplete_receipts_retained_before_normalize(self):
        for label, status, body, complete, issue in [('reject', 401, b'PRIVATE', True, None),
                ('invalid', 200, b'PRIVATE', True, None), ('partial', 200, b'PRIVATE', False, 'response_timeout'),
                ('oversized', 200, b'x' * provider.MAX_RESPONSE_BYTES, False, 'response_too_large')]:
            value = self.admit(self.new_deck(label))
            original = provider.normalize
            def normalize(prepared, receipt):
                record = FeedbackRequest.objects.get(job__description_set=value)
                self.assertEqual(bytes(record.raw_body), receipt.body)
                self.assertIsNotNone(record.received_at)
                return original(prepared, receipt)
            with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, status=status, body=body, complete=complete, issue=issue)), \
                    patch.object(provider, 'normalize', side_effect=normalize):
                self.execute(value)
            state = self.state(value)
            self.assertEqual(state['state'], 'needs_confirmation' if not complete else 'failed')
            encoded = json.dumps(state, default=str)
            for private in ['PRIVATE', 'raw_body', 'input_hash', 'claim_token', 'source_snapshot', 'synthetic-key']:
                self.assertNotIn(private, encoded)
            before = FeedbackRequest.objects.count()
            service.recover_descriptions()
            self.execute(value)
            self.assertEqual(FeedbackRequest.objects.count(), before)

    def test_provider_echoed_key_is_redacted_from_private_receipt_and_never_normalized(self):
        value = self.admit()
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, body=b'private synthetic-key response')):
            self.execute(value)
        request = FeedbackRequest.objects.get()
        self.assertNotIn(b'synthetic-key', bytes(request.raw_body))
        self.assertEqual(request.body_issue, 'credential_redacted')
        self.assertFalse(request.body_complete)
        self.assertEqual(self.state(value)['state'], 'needs_confirmation')
        self.assertIsNone(value.descriptions)

    def test_debug_sql_does_not_log_source_payload_or_raw_receipt_and_resets(self):
        logger = logging.getLogger('django.db.backends')
        with self.assertLogs(logger, level='DEBUG') as logs, override_settings(DEBUG=True):
            value = self.admit()
            with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, body=b'PRIVATE_SQL_RECEIPT')):
                self.execute(value)
            self.client.get(self.url, {'description_set_id': str(value.pk)})
            service.edit(self.deck.pk, self.edited(value, 'PRIVATE_SQL_EDIT'))
            logger.debug('unrelated SQL logging still works')
        output = str(logs.output)
        for secret in ['Synthetic slide one', 'PRIVATE_SQL_RECEIPT', 'PRIVATE_SQL_EDIT', value.input_hash]:
            self.assertNotIn(secret, output)
        self.assertIn('unrelated SQL logging still works', output)

    def test_429_shared_cooldown_is_public_and_wait_prevents_explicit_retry(self):
        value = self.admit()
        until = timezone.now() + timedelta(seconds=90)
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, status=429, retry_at=until)) as call:
            self.execute(value)
            second = self.admit(self.new_deck('two'))
            self.execute(second)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(self.state(second)['state'], 'waiting_quota')
        self.assertEqual(self.state(value)['retry_at'], until)
        self.assertFalse(self.state(value)['retry_available'])
        self.assertEqual(self.client.post(self.post, {'description_set_id': str(value.pk), 'processing_revision': 1}, format='json').status_code, 409)

    def test_quota_wait_resumes_automatically_without_changing_generation(self):
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_RPM': '1'}):
            first = self.complete()
            second = self.admit(self.new_deck('second'))
            with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
                self.execute(second)
                self.assertEqual(call.call_count, 0)
                self.assertEqual(self.state(second)['state'], 'waiting_quota')
                future = timezone.now() + timedelta(seconds=61)
                with patch.object(service.timezone, 'now', return_value=future):
                    service.recover_descriptions()
                    self.execute(second)
                self.assertEqual(call.call_count, 1)
            self.assertEqual(second.processing_revision, 1)
            self.assertEqual(second.description_revision, 1)
            self.assertEqual(FeedbackRequest.objects.count(), 2)

    def test_reservation_units_are_separate_from_usage_and_count_unknown_calls(self):
        value = self.admit()
        with patch.object(provider, 'request_raw', side_effect=FeedbackError('provider_timeout', uncertain=True)) as call:
            self.execute(value)
        prepared = call.call_args.args[0]
        reservation = FeedbackReservation.objects.get()
        self.assertEqual(reservation.units, len(prepared.payload) + 6000)
        self.assertIsNone(reservation.released_at)
        self.assertIsNone(FeedbackRequest.objects.get().usage)
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_RPM': '1'}):
            second = self.admit(self.new_deck('waiting-for-unknown'))
            with patch.object(provider, 'request_raw') as call:
                self.execute(second)
            call.assert_not_called()
            self.assertEqual(self.state(second)['state'], 'waiting_quota')

    def test_rolling_window_exact_expiry_and_tpm_contention(self):
        first = self.complete()
        reservation = FeedbackReservation.objects.get()
        second = self.admit(self.new_deck('tpm'))
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_TPM': str(reservation.units + 100)}):
            with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
                self.execute(second)
                self.assertEqual(call.call_count, 0)
                at_expiry = reservation.reserved_at + timedelta(seconds=60)
                with patch.object(service.timezone, 'now', return_value=at_expiry):
                    service.recover_descriptions()
                    self.execute(second)
                self.assertEqual(call.call_count, 1)
            self.assertEqual(second.description_revision, 1)

    def test_impossible_quota_and_missing_policy_never_wait_forever(self):
        value = self.admit()
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_TPM': '1'}), patch.object(provider, 'request_raw') as call:
            self.execute(value)
        call.assert_not_called()
        self.assertEqual(self.state(value)['error']['code'], 'request_exceeds_quota')
        self.assertEqual(self.state(value)['state'], 'failed')
        self.assertEqual(FeedbackReservation.objects.count(), 0)

    def test_daily_and_rolling_boundaries_are_provider_specific(self):
        # Pacific DST start is a 23-hour day, end a 25-hour day.
        for month, day, hours in [(3, 8, 23), (11, 1, 25)]:
            now = datetime(2026, month, day, 12, tzinfo=dt_timezone.utc)
            start, end = daily_window('gemini', now)
            self.assertEqual((end.astimezone(dt_timezone.utc) - start.astimezone(dt_timezone.utc)).total_seconds(), hours * 3600)
            start, end = daily_window('openai', now)
            self.assertEqual(start.hour, 0)
            self.assertEqual((end - start).total_seconds(), 86400)
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_DAILY_REQUEST_LIMIT': '1'}):
            self.complete()
            second = self.admit(self.new_deck('daily'))
            with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
                self.execute(second)
            call.assert_not_called()
            self.assertEqual(self.state(second)['retry_at'], daily_window('gemini', timezone.now())[1])

    def test_edit_fences_inflight_generation_but_keeps_late_receipt_and_usage(self):
        value = self.admit()
        def send(prepared):
            service.edit(self.deck.pk, self.edited(value))
            return self.receipt(prepared)
        with patch.object(provider, 'request_raw', side_effect=send) as call:
            self.execute(value)
        self.assertEqual(call.call_count, 1)
        self.assertTrue(value.edited)
        self.assertEqual(value.descriptions['slides'][0]['summary']['text'], 'User correction')
        self.assertEqual(value.description_revision, 1)
        request = FeedbackRequest.objects.get()
        self.assertIsNotNone(request.received_at)
        self.assertEqual(request.usage, {'totalTokenCount': 23})
        self.assertEqual(request.outcome, 'completed')
        self.assertEqual(FeedbackReservation.objects.count(), 1)

    def test_failed_new_scope_preserves_prior_valid_edited_descriptions(self):
        old = self.complete()
        service.edit(self.deck.pk, self.edited(old))
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_MODEL': 'new-model'}):
            new = self.admit()
            with patch.object(provider, 'request_raw', side_effect=FeedbackError('provider_timeout', uncertain=True)):
                self.execute(new)
            self.assertEqual(self.client.get(self.url).data['state'], 'needs_confirmation')
        old.refresh_from_db()
        self.assertEqual(old.descriptions['slides'][0]['summary']['text'], 'User correction')
        self.assertEqual(old.description_revision, 2)

    def test_existing_attempt_results_and_whisper_requests_unchanged(self):
        attempt = Attempt.objects.create(deck=self.deck, audio='synthetic-never-read.wav', duration_ms=1000,
            slide_events=[{'slide_index': 0, 'at_ms': 0}], transcript={'text': '', 'words': []},
            feedback_state='disabled', status='completed')
        ProviderRequest.objects.create(attempt=attempt, generation=1, claim_token=uuid.uuid4(), input_hash='1' * 64)
        url = f'/api/attempts/{attempt.pk}/'
        before = self.client.get(url).data
        self.complete()
        self.assertEqual(self.client.get(url).data, before)
        self.assertEqual(ProviderRequest.objects.count(), 1)


class DescriptionRecoveryTests(SyntheticDecks, TransactionTestCase):
    def expire(self, value):
        value.jobs.update(claimed_at=timezone.now() - timedelta(seconds=361))

    def test_receipt_commit_acknowledgement_loss_recovers_only_saved_sanitized_output(self):
        for label, options, outcome, state in [
                ('valid', {}, 'completed', 'completed'),
                ('invalid', {'body': b'invalid synthetic body'}, 'invalid', 'failed'),
                ('rejected', {'status': 401}, 'rejected', 'failed'),
                ('partial', {'body': b'partial', 'complete': False, 'issue': 'response_timeout'}, 'uncertain', 'needs_confirmation'),
                ('redacted', {'body': b'private synthetic-key response'}, 'uncertain', 'needs_confirmation')]:
            with self.subTest(receipt=label):
                value = self.admit(self.new_deck(label))
                original_save = service.save_receipt
                failed = False

                def save_then_lose_ack(*args, **kwargs):
                    nonlocal failed
                    receipt = original_save(*args, **kwargs)  # Actual transaction commits.
                    self.assertFalse(connection.in_atomic_block)
                    if not failed:
                        failed = True
                        raise DatabaseError('PRIVATE synthetic receipt acknowledgement loss')
                    return receipt

                with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, **options)) as call, \
                        patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                    with patch.object(service, 'save_receipt', side_effect=save_then_lose_ack), \
                            self.assertLogs(service.logger, level='WARNING') as logs:
                        self.execute(value)
                    self.assertNotIn('PRIVATE', str(logs.output))
                    self.assertNotIn('synthetic-key', str(logs.output))
                    self.assertTrue(failed)
                    normalize.assert_not_called()
                    request = FeedbackRequest.objects.get(job__description_set=value)
                    self.assertEqual(request.outcome, 'received')
                    self.assertIsNone(request.completed_at)
                    self.assertIsNotNone(request.received_at)
                    self.assertEqual(self.state(value)['state'], 'submitted')
                    self.assertFalse(self.state(value)['retry_available'])
                    original_raw = bytes(request.raw_body)
                    self.assertNotIn(b'synthetic-key', original_raw)
                    if label == 'redacted':
                        self.assertEqual(original_raw, b'private  response')
                        self.assertEqual(request.body_issue, 'credential_redacted')
                        self.assertFalse(request.body_complete)
                    replay = service.generate(value.deck_id, {'description_set_id': str(value.pk), 'processing_revision': 1})
                    self.assertEqual(replay.processing_revision, 1)
                    self.execute(value)
                    normalize.assert_not_called()
                    self.expire(value)
                    service.recover_descriptions()
                    self.execute(value)
                    self.broker.reset_mock()
                    service.recover_descriptions()
                    self.execute(value)
                    self.broker.assert_not_called()
                    self.assertEqual(normalize.call_count, 1)
                    self.assertEqual(normalize.call_args.args[1].body, original_raw)
                    self.assertEqual(call.call_count, 1)
                request.refresh_from_db()
                self.assertEqual(request.outcome, outcome)
                self.assertIsNotNone(request.completed_at)
                self.assertEqual(bytes(request.raw_body), original_raw)
                self.assertEqual(self.state(value)['state'], state)
                self.assertEqual((value.processing_revision, value.description_revision), (1, int(label == 'valid')))
                self.assertEqual(value.jobs.count(), 1)
                self.assertEqual(FeedbackRequest.objects.filter(job__description_set=value).count(), 1)
                self.assertEqual(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).count(), 1)

    def test_receipt_commit_rollback_never_normalizes_memory_and_recovers_as_uncertain(self):
        value = self.admit()
        original_commit = connection.commit
        failed = False

        def fail_receipt_commit():
            nonlocal failed
            if not failed and FeedbackRequest.objects.filter(received_at__isnull=False).exists():
                failed = True
                raise DatabaseError('PRIVATE synthetic receipt commit rollback')
            return original_commit()

        with patch.object(provider, 'request_raw', side_effect=self.receipt) as call, \
                patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
            with patch.object(connection, 'commit', side_effect=fail_receipt_commit), \
                    self.assertLogs(service.logger, level='WARNING') as logs:
                self.execute(value)
            self.assertNotIn('PRIVATE', str(logs.output))
            self.assertTrue(failed)
            request = FeedbackRequest.objects.get()
            self.assertIsNone(request.received_at)
            self.assertFalse(request.raw_body)
            self.assertIsNone(request.completed_at)
            self.assertEqual(request.outcome, 'submitted')
            self.assertEqual(self.state(value)['state'], 'submitted')
            self.execute(value)
            self.expire(value)
            service.recover_descriptions()
            self.execute(value)
            service.recover_descriptions()
            self.assertEqual(call.call_count, 1)
            normalize.assert_not_called()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'uncertain')
        self.assertIsNotNone(request.completed_at)
        self.assertIsNone(request.received_at)
        self.assertIsNone(request.usage)
        self.assertIsNone(value.descriptions)
        self.assertEqual(self.state(value)['state'], 'needs_confirmation')
        self.assertIsNone(FeedbackReservation.objects.get().released_at)
        payload = {'description_set_id': str(value.pk), 'processing_revision': 1}
        self.assertEqual(self.client.post(self.post, payload, format='json').status_code, 409)
        self.assertEqual(value.jobs.count(), 1)

    def test_receipt_acknowledgement_loss_preserves_edits_and_completed_newer_generation(self):
        for replacement in ['edit', 'retry']:
            with self.subTest(replacement=replacement):
                value = self.admit(self.new_deck(replacement))
                original_save = service.save_receipt

                def send(prepared):
                    self.expire(value)
                    service.recover_descriptions()
                    if replacement == 'edit':
                        service.edit(value.deck_id, {'description_set_id': str(value.pk), 'description_revision': 0,
                            'descriptions': description_value(prepared.analysis)})
                    else:
                        service.generate(value.deck_id, {'description_set_id': str(value.pk),
                            'processing_revision': 1, 'acknowledge_uncertain': True})
                    return self.receipt(prepared)

                def save_then_lose_ack(*args, **kwargs):
                    original_save(*args, **kwargs)
                    self.assertFalse(connection.in_atomic_block)
                    raise DatabaseError('PRIVATE synthetic receipt acknowledgement loss')

                with patch.object(provider, 'request_raw', side_effect=send) as call:
                    with patch.object(service, 'save_receipt', side_effect=save_then_lose_ack):
                        self.execute(value)
                    request = FeedbackRequest.objects.get(job__description_set=value, generation=1)
                    self.assertEqual(request.outcome, 'received')
                    self.assertIsNone(request.completed_at)
                    if replacement == 'retry':
                        call.side_effect = self.receipt
                        self.execute(value)
                        self.assertEqual(value.description_revision, 1)
                    before = DescriptionSet.objects.filter(pk=value.pk).values().get()
                    newer_job = value.jobs.filter(generation=2).values().first()
                    service.recover_descriptions()
                    service.run_description(value.pk, 1)
                    service.recover_descriptions()
                    service.run_description(value.pk, 1)
                    self.assertEqual(call.call_count, 2 if replacement == 'retry' else 1)
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'completed')
                self.assertIsNotNone(request.completed_at)
                self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), before)
                self.assertEqual(value.jobs.filter(generation=2).values().first(), newer_job)

    def test_broker_loss_is_safe_and_recovery_republishes_durable_queue(self):
        self.broker.side_effect = RuntimeError('PRIVATE broker exception')
        with self.assertLogs(service.logger, level='WARNING') as logs:
            value = self.admit()
        self.assertNotIn('PRIVATE', str(logs.output))
        self.assertEqual(value.jobs.get().state, 'queued')
        self.broker.side_effect = None
        self.broker.reset_mock()
        service.recover_descriptions()
        self.assertEqual(self.broker.call_count, 1)
        self.complete(value)

    def test_expired_unsubmitted_claim_reclaims_once_and_stale_worker_cannot_submit(self):
        value = self.admit()
        old_value, job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = Selection.current().adapter().prepare_descriptions(deck)
        self.expire(value)
        service.recover_descriptions()
        with self.assertRaises(service.StaleClaim):
            service.submit(old_value, job, prepared)
        with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
            self.execute(value)
            self.execute(value)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(FeedbackRequest.objects.count(), 1)
        self.assertEqual(FeedbackReservation.objects.count(), 1)

    def test_after_submitted_termination_requires_confirmation_no_auto_recall(self):
        value = self.admit()
        saved, job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = Selection.current().adapter().prepare_descriptions(deck)
        service.submit(saved, job, prepared)
        self.expire(value)
        with patch.object(provider, 'request_raw') as call:
            service.recover_descriptions()
            self.execute(value)
            service.recover_descriptions()
        call.assert_not_called()
        self.assertEqual(self.state(value)['state'], 'needs_confirmation')
        self.assertEqual(FeedbackRequest.objects.get().outcome, 'uncertain')
        self.assertIsNone(FeedbackReservation.objects.get().released_at)
        self.assertIsNone(FeedbackRequest.objects.get().usage)

    def test_saved_receipt_recovers_with_missing_media_disabled_configuration_and_no_call(self):
        value = self.admit()
        saved, job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = service.submit(saved, job, Selection.current().adapter().prepare_descriptions(deck))
        service.save_receipt(saved, job, request, self.receipt(prepared))
        self.expire(value)
        with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}), \
                patch.object(service, 'prepare_saved', side_effect=FeedbackError('source_unavailable')), \
                patch.object(provider, 'request_raw') as call:
            service.recover_descriptions()
            self.execute(value)
        call.assert_not_called()
        self.assertEqual(value.description_revision, 1)
        self.assertEqual(FeedbackRequest.objects.count(), 1)
        self.assertEqual(FeedbackRequest.objects.get().outcome, 'completed')

    def test_invalid_saved_receipt_recovers_once_then_explicit_retry_uses_new_call(self):
        value = self.admit()
        saved, job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = service.submit(saved, job, Selection.current().adapter().prepare_descriptions(deck))
        service.save_receipt(saved, job, request, self.receipt(prepared, body=b'invalid synthetic body'))
        self.expire(value)
        with patch.object(provider, 'request_raw') as call, patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
            service.recover_descriptions()
            self.execute(value)
            service.recover_descriptions()
            self.execute(value)
        call.assert_not_called()
        self.assertEqual(normalize.call_count, 1)
        self.assertEqual(self.state(value)['state'], 'failed')
        value = service.generate(self.deck.pk, {'description_set_id': str(value.pk), 'processing_revision': 1})
        self.complete(value)
        self.assertEqual(FeedbackRequest.objects.count(), 2)

    def test_completion_write_or_commit_failure_recovers_same_valid_receipt(self):
        for failure in ['write', 'commit']:
            with self.subTest(failure=failure):
                value = self.admit(self.new_deck(failure))
                failed = False
                original_save, original_commit = DescriptionSet.save, connection.commit

                def fail_write(record, *args, **kwargs):
                    nonlocal failed
                    if record.pk == value.pk and record.descriptions is not None and not failed:
                        failed = True
                        raise DatabaseError('PRIVATE synthetic completion write failure')
                    return original_save(record, *args, **kwargs)

                def fail_commit():
                    nonlocal failed
                    if not failed and DescriptionSet.objects.filter(pk=value.pk, descriptions__isnull=False).exists():
                        failed = True
                        raise DatabaseError('PRIVATE synthetic completion commit failure')
                    return original_commit()

                fault = patch.object(DescriptionSet, 'save', fail_write) if failure == 'write' else \
                    patch.object(connection, 'commit', side_effect=fail_commit)
                with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
                    with fault, self.assertLogs(service.logger, level='WARNING') as logs:
                        self.execute(value)
                    self.assertNotIn('PRIVATE', str(logs.output))
                    self.assertTrue(failed)
                    request = FeedbackRequest.objects.get(job__description_set=value)
                    self.assertEqual(request.outcome, 'received')
                    self.assertIsNone(request.completed_at)
                    self.assertIsNotNone(request.received_at)
                    raw_body = bytes(request.raw_body)
                    self.assertIsNone(value.descriptions)
                    self.assertEqual(value.description_revision, 0)
                    # A transient completion failure must not authorize paid retry.
                    replay = service.generate(value.deck_id, {'description_set_id': str(value.pk), 'processing_revision': 1})
                    self.assertEqual(replay.processing_revision, 1)
                    self.expire(value)
                    service.recover_descriptions()
                    self.execute(value)
                    self.execute(value)
                self.assertEqual(call.call_count, 1)
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'completed')
                self.assertEqual(request.error_code, '')
                self.assertIsNotNone(request.completed_at)
                self.assertEqual(bytes(request.raw_body), raw_body)
                self.assertEqual(value.description_revision, 1)
                self.assertEqual(value.processing_revision, 1)
                self.assertEqual(value.jobs.count(), 1)
                self.assertEqual(FeedbackRequest.objects.filter(job__description_set=value).count(), 1)
                self.assertEqual(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).count(), 1)

    def test_edited_then_received_termination_recovers_only_original_request_evidence(self):
        for label, options, outcome in [
                ('valid', {}, 'completed'),
                ('invalid', {'body': b'invalid synthetic body'}, 'invalid'),
                ('rejected', {'status': 401}, 'rejected'),
                ('partial', {'body': b'partial', 'complete': False, 'issue': 'response_timeout'}, 'uncertain')]:
            with self.subTest(label=label):
                value = self.admit(self.new_deck(label))

                def send(prepared):
                    descriptions = description_value(prepared.analysis)
                    descriptions['slides'][0]['summary']['text'] = 'Keep this user correction'
                    service.edit(value.deck_id, {'description_set_id': str(value.pk), 'description_revision': 0,
                                                 'descriptions': descriptions})
                    return self.receipt(prepared, **options)

                with patch.object(provider, 'request_raw', side_effect=send) as call:
                    with patch.object(provider, 'normalize', side_effect=SystemExit('Synthetic worker termination')):
                        with self.assertRaises(SystemExit):
                            self.execute(value)
                    request = FeedbackRequest.objects.get(job__description_set=value)
                    self.assertEqual(request.outcome, 'received')
                    self.assertIsNone(request.completed_at)
                    original_raw = bytes(request.raw_body)
                    value.refresh_from_db()
                    original_descriptions, original_updated_at = value.descriptions, value.updated_at
                    original_job_completed_at = value.jobs.get().completed_at
                    self.expire(value)
                    # Receipt-only recovery cannot rely on current credentials/media.
                    with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}), \
                            patch.object(service, 'prepare_saved', side_effect=FeedbackError('source_unavailable')), \
                            patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                        service.recover_descriptions()
                        service.run_description(value.pk, 1)
                        service.recover_descriptions()
                        service.run_description(value.pk, 1)
                    request.refresh_from_db()
                    self.assertEqual(request.outcome, outcome)
                    self.assertIsNotNone(request.completed_at)
                    self.assertEqual(normalize.call_count, 1)
                self.assertEqual(call.call_count, 1)
                self.assertEqual(bytes(request.raw_body), original_raw)
                self.assertEqual(request.usage, {'totalTokenCount': 23})
                value.refresh_from_db()
                self.assertTrue(value.edited)
                self.assertEqual(value.descriptions, original_descriptions)
                self.assertEqual(value.updated_at, original_updated_at)
                self.assertEqual((value.processing_revision, value.description_revision), (2, 1))
                job = value.jobs.get()
                self.assertEqual(job.state, 'superseded')
                self.assertEqual(job.completed_at, original_job_completed_at)
                self.assertEqual(FeedbackRequest.objects.filter(job__description_set=value).count(), 1)
                self.assertEqual(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).count(), 1)

    def test_superseded_receipt_recovery_claims_fence_duplicate_and_expired_workers(self):
        value = self.admit()
        saved, original_job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = service.submit(saved, original_job, Selection.current().adapter().prepare_descriptions(deck))
        service.edit(value.deck_id, self.edited(value))
        receipt = service.save_receipt(saved, original_job, request, self.receipt(prepared))
        first_value, first_job, _ = service.claim(value.pk, 1)
        self.assertIsNone(service.claim(value.pk, 1))
        self.expire(value)
        with patch.object(provider, 'request_raw') as call:
            service.recover_descriptions()
            second_value, second_job, _ = service.claim(value.pk, 1)
            self.assertNotEqual(first_job.claim_token, second_job.claim_token)
            # Neither the expired normalizer nor original submitter can finalize
            # evidence owned by the new receipt-only claim.
            for stale_value, stale_job in [(first_value, first_job), (saved, original_job)]:
                service.finish(stale_value, stale_job, error=FeedbackError('invalid_response'))
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'received')
                self.assertIsNone(request.completed_at)
            service.finish(second_value, second_job, result=provider.normalize(prepared, receipt))
            self.assertIsNone(service.claim(value.pk, 1))
            service.recover_descriptions()
            service.run_description(value.pk, 1)
        call.assert_not_called()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'completed')
        self.assertIsNotNone(request.completed_at)
        self.assertIsNone(value.jobs.get().claim_token)
        value.refresh_from_db()
        self.assertTrue(value.edited)
        self.assertEqual(value.descriptions['slides'][0]['summary']['text'], 'User correction')
        self.assertEqual((value.processing_revision, value.description_revision), (2, 1))

    def check_late_receipt_after_confirmation(self, replacement):
        for label, options, outcome in [
                ('valid', {}, 'completed'),
                ('invalid', {'body': b'invalid synthetic body'}, 'invalid'),
                ('rejected', {'status': 401}, 'rejected'),
                ('partial', {'body': b'partial', 'complete': False, 'issue': 'response_timeout'}, 'uncertain')]:
            with self.subTest(replacement=replacement, receipt=label):
                value = self.admit(self.new_deck(label))

                def send(prepared):
                    self.expire(value)
                    service.recover_descriptions()
                    self.assertEqual(self.state(value)['state'], 'needs_confirmation')
                    if replacement == 'retry':
                        response = self.client.post(f'/api/decks/{value.deck_id}/descriptions/generate/',
                            {'description_set_id': str(value.pk), 'processing_revision': 1,
                             'acknowledge_uncertain': True}, format='json')
                        self.assertEqual(response.status_code, 202)
                    else:
                        descriptions = description_value(prepared.analysis)
                        descriptions['slides'][0]['summary']['text'] = 'Keep this user correction'
                        response = self.client.patch(f'/api/decks/{value.deck_id}/descriptions/',
                            {'description_set_id': str(value.pk), 'description_revision': 0,
                             'descriptions': descriptions}, format='json')
                        self.assertEqual(response.status_code, 200)
                    return self.receipt(prepared, **options)

                with patch.object(provider, 'request_raw', side_effect=send) as call:
                    with patch.object(provider, 'normalize', side_effect=SystemExit('Synthetic worker termination')):
                        with self.assertRaises(SystemExit):
                            self.execute(value)
                    request = FeedbackRequest.objects.get(job__description_set=value, generation=1)
                    self.assertEqual(request.outcome, 'received')
                    self.assertIsNone(request.completed_at)
                    raw_body = bytes(request.raw_body)
                    # Neither retry nor PATCH rewrites the old terminal job.
                    old_job = value.jobs.get(generation=1)
                    self.assertEqual(old_job.state, 'needs_confirmation')
                    previous_set = DescriptionSet.objects.filter(pk=value.pk).values().get()
                    newer_job = value.jobs.filter(generation=2).values().first()
                    self.broker.reset_mock()
                    with patch.dict('os.environ', {'FEEDBACK_ENABLED': 'false', 'GEMINI_API_KEY': ''}), \
                            patch.object(service, 'prepare_saved', side_effect=FeedbackError('source_unavailable')), \
                            patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                        service.recover_descriptions()
                        self.assertIn(((str(value.pk), 1), {}), self.broker.call_args_list)
                        service.run_description(value.pk, 1)
                        self.broker.reset_mock()
                        service.recover_descriptions()
                        self.assertNotIn(((str(value.pk), 1), {}), self.broker.call_args_list)
                        service.run_description(value.pk, 1)
                    self.assertEqual(normalize.call_count, 1)
                self.assertEqual(call.call_count, 1)
                request.refresh_from_db()
                self.assertEqual(request.outcome, outcome)
                self.assertIsNotNone(request.completed_at)
                self.assertEqual(bytes(request.raw_body), raw_body)
                self.assertEqual(request.usage, {'totalTokenCount': 23})
                self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), previous_set)
                self.assertEqual(value.jobs.filter(generation=2).values().first(), newer_job)
                old_job.refresh_from_db()
                self.assertEqual(old_job.state, 'needs_confirmation')
                self.assertIsNone(old_job.claim_token)
                self.assertEqual(FeedbackRequest.objects.filter(job__description_set=value).count(), 1)
                self.assertEqual(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).count(), 1)

    def test_late_receipt_after_confirmation_and_retry_recovers_old_request_only(self):
        self.check_late_receipt_after_confirmation('retry')

    def test_late_receipt_after_confirmation_and_patch_recovers_old_request_only(self):
        self.check_late_receipt_after_confirmation('patch')

    def test_terminal_receipt_claim_fences_original_expired_and_duplicate_workers(self):
        value = self.admit()
        saved, original_job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = service.submit(saved, original_job, Selection.current().adapter().prepare_descriptions(deck))
        self.expire(value)
        service.recover_descriptions()
        retry = service.generate(value.deck_id, {'description_set_id': str(value.pk),
            'processing_revision': 1, 'acknowledge_uncertain': True})
        self.complete(retry)
        previous_set = DescriptionSet.objects.filter(pk=value.pk).values().get()
        newer_job = value.jobs.filter(generation=2).values().get()
        receipt = service.save_receipt(saved, original_job, request, self.receipt(prepared))
        first_value, first_job, _ = service.claim(value.pk, 1)
        self.assertIsNone(service.claim(value.pk, 1))
        value.jobs.filter(generation=1).update(claimed_at=timezone.now() - timedelta(seconds=361))
        second_value, second_job, _ = service.claim(value.pk, 1)
        self.assertNotEqual(first_job.claim_token, second_job.claim_token)
        with patch.object(provider, 'request_raw') as call:
            for stale_value, stale_job in [(saved, original_job), (first_value, first_job)]:
                service.finish(stale_value, stale_job, error=FeedbackError('invalid_response'))
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'received')
                self.assertIsNone(request.completed_at)
            service.finish(second_value, second_job, result=provider.normalize(prepared, receipt))
            self.assertIsNone(service.claim(value.pk, 1))
            service.recover_descriptions()
            service.run_description(value.pk, 1)
        call.assert_not_called()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'completed')
        self.assertIsNotNone(request.completed_at)
        self.assertIsNone(value.jobs.get(generation=1).claim_token)
        self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), previous_set)
        self.assertEqual(value.jobs.filter(generation=2).values().get(), newer_job)
        self.assertEqual(FeedbackRequest.objects.count(), 2)
        self.assertEqual(FeedbackReservation.objects.filter(released_at__isnull=True).count(), 2)

    def test_final_check_detects_expiry_disable_and_project_change_after_preparation(self):
        for label, changes in [('disabled', {'FEEDBACK_ENABLED': 'false'}),
                               ('project', {'FEEDBACK_GEMINI_PROJECT_ID': 'different'}), ('expiry', {})]:
            value = self.admit(self.new_deck(label))
            saved, job, request = service.claim(value.pk, 1)
            deck, _ = service.prepare_saved(value.deck_id)
            prepared = Selection.current().adapter().prepare_descriptions(deck)
            if label == 'expiry':
                self.expire(value)
            with patch.dict('os.environ', changes), self.assertRaises((FeedbackError, service.StaleClaim)):
                service.submit(saved, job, prepared)
            request.refresh_from_db()
            self.assertIsNone(request.submitted_at)
        self.assertEqual(FeedbackReservation.objects.count(), 0)

    def test_commit_failure_prevents_outbound_call(self):
        value = self.admit()
        original = connection.commit
        def commit():
            # Reproduce failure committing the transaction containing submitted.
            if FeedbackRequest.objects.filter(submitted_at__isnull=False).exists():
                raise DatabaseError('Synthetic commit failure')
            return original()
        with patch.object(connection, 'commit', side_effect=commit), patch.object(provider, 'request_raw') as call:
            self.execute(value)
        call.assert_not_called()
        self.assertIsNone(FeedbackRequest.objects.get().submitted_at)
        self.assertEqual(FeedbackReservation.objects.count(), 0)

    def test_late_receipt_after_expiry_requeues_normalization_without_second_call(self):
        value = self.admit()
        saved, job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = service.submit(saved, job, Selection.current().adapter().prepare_descriptions(deck))
        self.expire(value)
        service.recover_descriptions()
        self.assertEqual(self.state(value)['state'], 'needs_confirmation')
        receipt = self.receipt(prepared)
        service.save_receipt(saved, job, request, receipt)
        # Old worker's completion cannot consume the new normalization claim.
        service.finish(saved, job, result=provider.normalize(prepared, receipt))
        self.assertIsNone(FeedbackRequest.objects.get().completed_at)
        with patch.object(provider, 'request_raw') as call:
            self.execute(value)
        call.assert_not_called()
        self.assertEqual(value.description_revision, 1)
        self.assertEqual(FeedbackRequest.objects.get().outcome, 'completed')

    def test_edit_before_submission_fences_and_submitted_edit_without_receipt_retains_uncertainty(self):
        value = self.admit()
        saved, job, request = service.claim(value.pk, 1)
        deck, _ = service.prepare_saved(self.deck.pk)
        prepared = Selection.current().adapter().prepare_descriptions(deck)
        service.edit(self.deck.pk, self.edited(value))
        with self.assertRaises(service.StaleClaim):
            service.submit(saved, job, prepared)
        self.assertEqual(FeedbackReservation.objects.count(), 0)
        other = self.admit(self.new_deck('submitted'))
        saved, job, request = service.claim(other.pk, 1)
        deck, _ = service.prepare_saved(other.deck_id)
        prepared = service.submit(saved, job, Selection.current().adapter().prepare_descriptions(deck))
        service.edit(other.deck_id, {'description_set_id': str(other.pk), 'description_revision': 0,
                                    'descriptions': description_value(deck)})
        self.expire(other)
        service.recover_descriptions()
        request.refresh_from_db()
        self.assertEqual(request.outcome, 'uncertain')
        self.assertEqual(FeedbackReservation.objects.count(), 1)


@skipUnless(connection.vendor == 'postgresql', 'Requires real PostgreSQL row locks; SQLite is not concurrency evidence')
class ConcurrentDescriptionTests(SyntheticDecks, TransactionTestCase):
    def race(self, functions):
        barrier = Barrier(len(functions))
        def run(fn):
            try:
                barrier.wait(timeout=10)
                return fn()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(functions)) as pool:
            return list(pool.map(run, functions))

    def test_initial_dedup_duplicate_workers_one_paid_call(self):
        values = self.race([self.admit, self.admit])
        self.assertEqual(values[0].pk, values[1].pk)
        self.assertEqual(self.broker.call_count, 1)
        value = values[0]
        with patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
            self.race([lambda: self.execute(value), lambda: self.execute(value)])
        self.assertEqual(call.call_count, 1)
        self.assertEqual(DescriptionJob.objects.count(), 1)
        self.assertEqual(FeedbackRequest.objects.count(), 1)

    def test_concurrent_retry_consumes_revision_once(self):
        value = self.admit()
        with patch.object(provider, 'request_raw', side_effect=lambda p: self.receipt(p, status=401)):
            self.execute(value)
        self.broker.reset_mock()
        def retry():
            try:
                return service.generate(value.deck_id, {'description_set_id': str(value.pk), 'processing_revision': 1}).processing_revision
            except service.Conflict:
                return 'conflict'
        self.assertCountEqual(self.race([retry, retry]), [2, 'conflict'])
        self.assertEqual(self.broker.call_count, 1)

    def test_competing_decks_quota_reservations_have_one_winner(self):
        for mode in ['rpm', 'tpm', 'daily']:
            with self.subTest(mode=mode), patch.dict('os.environ', {'FEEDBACK_GEMINI_PROJECT_ID': 'race-' + mode}):
                first, second = self.admit(), self.admit(self.new_deck(mode))
                deck, _ = service.prepare_saved(self.deck.pk)
                units = len(Selection.current().adapter().prepare_descriptions(deck).payload) + 6000
                policy = {'FEEDBACK_GEMINI_RPM': '1'} if mode == 'rpm' else \
                    {'FEEDBACK_GEMINI_TPM': str(units + 100)} if mode == 'tpm' else \
                    {'FEEDBACK_GEMINI_DAILY_REQUEST_LIMIT': '1'}
                with patch.dict('os.environ', policy), patch.object(provider, 'request_raw', side_effect=self.receipt) as call:
                    self.race([lambda: self.execute(first), lambda: self.execute(second)])
                self.assertEqual(call.call_count, 1)
                self.assertEqual(FeedbackReservation.objects.filter(bucket__project_id='race-' + mode).count(), 1)
                self.assertCountEqual([self.state(first)['state'], self.state(second)['state']], ['completed', 'waiting_quota'])

    def test_concurrent_description_edits_one_winner(self):
        value = self.complete()
        payload = self.edited(value)
        def edit():
            try:
                return service.edit(value.deck_id, payload).description_revision
            except service.Conflict:
                return 'conflict'
        self.assertCountEqual(self.race([edit, edit]), [2, 'conflict'])

    def test_edit_while_generation_returns_preserves_edit_and_request_evidence(self):
        value = self.admit()
        submitted, edited = Event(), Event()
        payload = self.edited(value)
        def send(prepared):
            submitted.set()
            if not edited.wait(timeout=10):
                raise AssertionError('Edit never completed')
            return self.receipt(prepared)
        def edit():
            if not submitted.wait(timeout=10):
                raise AssertionError('Submit never completed')
            try:
                service.edit(value.deck_id, payload)
            finally:
                edited.set()
        with patch.object(provider, 'request_raw', side_effect=send) as call:
            self.race([lambda: self.execute(value), edit])
        value.refresh_from_db()
        self.assertEqual(call.call_count, 1)
        self.assertTrue(value.edited)
        self.assertEqual(value.description_revision, 1)
        self.assertIsNotNone(FeedbackRequest.objects.get().received_at)
        self.assertEqual(FeedbackRequest.objects.get().outcome, 'completed')
        self.assertEqual(FeedbackReservation.objects.count(), 1)

    def test_concurrent_superseded_receipt_recovery_normalizes_once_without_paid_work(self):
        value = self.admit()
        def send(prepared):
            service.edit(value.deck_id, self.edited(value))
            return self.receipt(prepared)
        with patch.object(provider, 'request_raw', side_effect=send) as call:
            with patch.object(provider, 'normalize', side_effect=SystemExit('Synthetic worker termination')):
                with self.assertRaises(SystemExit):
                    self.execute(value)
            value.jobs.update(claimed_at=timezone.now() - timedelta(seconds=361))
            service.recover_descriptions()
            original_normalize = provider.normalize
            def normalize(prepared, receipt):
                self.assertFalse(connection.in_atomic_block)
                return original_normalize(prepared, receipt)
            with patch.object(provider, 'normalize', side_effect=normalize) as normalizer:
                self.race([lambda: service.run_description(value.pk, 1),
                           lambda: service.run_description(value.pk, 1)])
            self.assertEqual(normalizer.call_count, 1)
        self.assertEqual(call.call_count, 1)
        value.refresh_from_db()
        self.assertTrue(value.edited)
        self.assertEqual(value.descriptions['slides'][0]['summary']['text'], 'User correction')
        self.assertEqual((value.processing_revision, value.description_revision), (2, 1))
        request = FeedbackRequest.objects.get()
        self.assertEqual(request.outcome, 'completed')
        self.assertIsNotNone(request.completed_at)
        self.assertEqual(FeedbackReservation.objects.count(), 1)

    def test_concurrent_terminal_receipt_recovery_after_retry_or_edit(self):
        for replacement in ['retry', 'edit']:
            with self.subTest(replacement=replacement):
                value = self.admit(self.new_deck(replacement))
                saved, job, request = service.claim(value.pk, 1)
                deck, _ = service.prepare_saved(value.deck_id)
                prepared = service.submit(saved, job, Selection.current().adapter().prepare_descriptions(deck))
                value.jobs.update(claimed_at=timezone.now() - timedelta(seconds=361))
                service.recover_descriptions()
                self.assertEqual(self.state(value)['state'], 'needs_confirmation')
                if replacement == 'retry':
                    service.generate(value.deck_id, {'description_set_id': str(value.pk),
                        'processing_revision': 1, 'acknowledge_uncertain': True})
                else:
                    service.edit(value.deck_id, {'description_set_id': str(value.pk),
                        'description_revision': 0, 'descriptions': description_value(deck)})
                service.save_receipt(saved, job, request, self.receipt(prepared))
                previous_set = DescriptionSet.objects.filter(pk=value.pk).values().get()
                newer_job = value.jobs.filter(generation=2).values().first()
                with patch.object(provider, 'request_raw') as call, \
                        patch.object(provider, 'normalize', wraps=provider.normalize) as normalize:
                    service.recover_descriptions()
                    self.race([lambda: service.run_description(value.pk, 1),
                               lambda: service.run_description(value.pk, 1)])
                call.assert_not_called()
                self.assertEqual(normalize.call_count, 1)
                request.refresh_from_db()
                self.assertEqual(request.outcome, 'completed')
                self.assertIsNotNone(request.completed_at)
                self.assertEqual(DescriptionSet.objects.filter(pk=value.pk).values().get(), previous_set)
                self.assertEqual(value.jobs.filter(generation=2).values().first(), newer_job)
                self.assertIsNone(value.jobs.get(generation=1).claim_token)
                self.assertEqual(FeedbackRequest.objects.filter(job__description_set=value).count(), 1)
                self.assertEqual(FeedbackReservation.objects.filter(request=request, released_at__isnull=True).count(), 1)


class DescriptionSelectionTests(SyntheticDecks, TestCase):
    def test_changed_selection_rejects_without_queue_and_matching_initial_is_allowed(self):
        selected = self.client.get(self.url).json().get('selection')
        self.assertIsNotNone(selected)
        with patch.dict('os.environ', {'FEEDBACK_GEMINI_MODEL': 'synthetic-other'}), self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.post, {'expected_selection': selected['token']}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'selection_mismatch')
        for model in (DescriptionSet, DescriptionJob, FeedbackRequest, FeedbackReservation):
            self.assertEqual(model.objects.count(), 0)
        self.broker.assert_not_called()
        self.network.assert_not_called()
        response = self.client.post(self.post, {'expected_selection': selected['token']}, format='json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['selection'], selected)

    def test_saved_set_assertion_and_malformed_assertions(self):
        value = self.admit()
        selected = self.client.get(self.url, {'description_set_id': str(value.pk)}).json().get('selection')
        self.assertIsNotNone(selected)
        for token in (None, True, '', 'x' * 64):
            self.assertEqual(self.client.post(self.post, {'expected_selection': token}, format='json').status_code, 400)
        with patch.dict('os.environ', {'FEEDBACK_PROVIDER': 'openai'}):
            response = self.client.post(self.post, {'description_set_id': str(value.pk), 'processing_revision': 1,
                'expected_selection': selected['token']}, format='json')
            self.assertEqual(response.status_code, 202)
            self.assertEqual(response.json()['selection'], selected)
        self.assertEqual(DescriptionJob.objects.count(), 1)

    def test_selection_change_during_preparation_admits_nothing(self):
        selected = self.client.get(self.url).json()['selection']
        prepare = service.prepare_saved
        def changed(deck_id):
            result = prepare(deck_id)
            import os
            os.environ['FEEDBACK_GEMINI_PROJECT_ID'] = 'changed-before-admission'
            return result
        with patch.object(service, 'prepare_saved', side_effect=changed), patch.dict('os.environ', {}):
            response = self.client.post(self.post, {'expected_selection': selected['token']}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(DescriptionSet.objects.count(), 0)
        self.assertEqual(DescriptionJob.objects.count(), 0)
        self.assertEqual(FeedbackRequest.objects.count(), 0)
        self.assertEqual(FeedbackReservation.objects.count(), 0)
