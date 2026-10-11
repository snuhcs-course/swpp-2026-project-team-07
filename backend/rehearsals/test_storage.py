import json
import tempfile
import uuid
import wave
from io import BytesIO
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from pypdf import PdfWriter
from .models import Attempt, Deck


def pdf_file(pages=2):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=320, height=240)
    out = BytesIO()
    writer.write(out)
    return SimpleUploadedFile("slides.pdf", out.getvalue(), "application/pdf")


def audio_file(seconds=2, sample=b"\x00\x00"):
    out = BytesIO()
    with wave.open(out, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(sample * 16000 * seconds)
    return SimpleUploadedFile("speech.wav", out.getvalue(), "audio/wav")


class UploadTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        settings = override_settings(MEDIA_ROOT=self.media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.client = APIClient()

    def deck(self):
        response = self.client.post("/api/decks/", {"file": pdf_file(), "title": "Demo"})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_pdf_is_prepared_locally_and_reused(self):
        first, second = self.deck(), self.deck()
        self.assertEqual(first["deck"]["id"], second["deck"]["id"])
        self.assertEqual(len(first["slides"]), 2)
        self.assertEqual(first["slides"][0]["extracted_text"], "")
        deck = Deck.objects.get()
        self.assertTrue(deck.pdf.storage.exists(deck.pdf.name))
        self.assertTrue(deck.slides.first().image.storage.exists(deck.slides.first().image.name))

    def test_invalid_and_oversized_decks(self):
        for upload in [pdf_file(11), SimpleUploadedFile("bad.pdf", b"not a pdf"), SimpleUploadedFile("big.pdf", b"0" * (20 * 1024 * 1024 + 1))]:
            self.assertEqual(self.client.post("/api/decks/", {"file": upload}).status_code, 400)
        self.assertEqual(Deck.objects.count(), 0)

    def test_audio_retry_conflict_and_reopening(self):
        deck = self.deck()["deck"]
        metadata = {"id": str(uuid.uuid4()), "deck_id": deck["id"], "duration_ms": 2000, "audience": "students", "slide_events": [{"slide_index": 1, "at_ms": 0}, {"slide_index": 0, "at_ms": 1000}]}
        def upload(audio=None):
            return self.client.post("/api/attempts/", {"audio": audio or audio_file(), "metadata": json.dumps(metadata)})
        self.assertEqual(upload().status_code, 201)
        self.assertEqual(upload().status_code, 201)
        self.assertEqual(Attempt.objects.count(), 1)
        metadata["audience"] = "different"
        self.assertEqual(upload().status_code, 409)
        listed = self.client.get(f'/api/decks/{deck["id"]}/attempts/').data
        self.assertEqual(listed[0]["slide_events"], metadata["slide_events"])
        self.assertIsNone(listed[0]["transcript"])
        self.assertEqual(self.client.get(f'/api/attempts/{metadata["id"]}/').status_code, 200)
        metadata["id"] = str(uuid.uuid4())
        metadata["slide_events"][0]["slide_index"] = 2
        self.assertEqual(upload().status_code, 400)
        metadata["slide_events"][0]["slide_index"] = 0
        self.assertEqual(upload(SimpleUploadedFile("bad.wav", b"broken")).status_code, 400)
        metadata["duration_ms"] = 600001
        self.assertEqual(upload().status_code, 400)

    def test_exact_decimal_audio_limit_and_awaiting_analysis(self):
        from .services.storage import read_upload
        from .limits import MAX_AUDIO_BYTES
        from rest_framework.exceptions import ValidationError
        self.assertEqual(MAX_AUDIO_BYTES, 25_000_000)
        self.assertEqual(len(read_upload(SimpleUploadedFile('limit.wav', b'x' * MAX_AUDIO_BYTES), MAX_AUDIO_BYTES)), MAX_AUDIO_BYTES)
        with self.assertRaises(ValidationError):
            read_upload(SimpleUploadedFile('legacy.wav', b'x' * (MAX_AUDIO_BYTES + 1)), MAX_AUDIO_BYTES)
        deck = self.deck()['deck']
        metadata = {'id': str(uuid.uuid4()), 'deck_id': deck['id'], 'duration_ms': 2000, 'slide_events': [{'slide_index': 1, 'at_ms': 0}]}
        self.client.post('/api/attempts/', {'audio': audio_file(), 'metadata': json.dumps(metadata)})
        result = self.client.get(f"/api/attempts/{metadata['id']}/").data
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(result['processing_state'], 'awaiting_analysis')
        self.assertIsNone(result['transcript'])
        self.assertEqual(result['feedback'], [])
        self.assertEqual(self.client.post(f"/api/attempts/{metadata['id']}/process/").status_code, 501)
        self.assertEqual(Attempt.objects.get().status, 'pending')

    def test_uuid_and_default_audience_normalization_deduplicate_exact_retries(self):
        deck = self.deck()['deck']
        attempt_id = uuid.uuid4()
        metadata = {'id': attempt_id.hex.upper(), 'deck_id': uuid.UUID(deck['id']).hex.upper(),
                    'duration_ms': 2000, 'slide_events': [{'slide_index': 1, 'at_ms': 0}]}
        def submit():
            return self.client.post('/api/attempts/', {'audio': audio_file(), 'metadata': json.dumps(metadata)})
        self.assertEqual(submit().data['attempt_id'], str(attempt_id))
        first = Attempt.objects.get()
        metadata.update(id=str(attempt_id), deck_id=deck['id'], audience='')
        self.assertEqual(submit().status_code, 201)
        self.assertEqual(Attempt.objects.count(), 1)
        self.assertEqual(Attempt.objects.get().audio.name, first.audio.name)
        self.assertEqual(Attempt.objects.get().upload_hash, first.upload_hash)

    def test_valid_audio_deck_or_timeline_conflicts_never_change_winner(self):
        deck = self.deck()['deck']
        metadata = {'id': str(uuid.uuid4()), 'deck_id': deck['id'], 'duration_ms': 2000,
                    'slide_events': [{'slide_index': 1, 'at_ms': 0}, {'slide_index': 0, 'at_ms': 1000}]}
        def submit(meta, audio=None):
            return self.client.post('/api/attempts/', {'audio': audio or audio_file(), 'metadata': json.dumps(meta)})
        self.assertEqual(submit(metadata).status_code, 201)
        first = Attempt.objects.get()
        other_deck = self.client.post('/api/decks/', {'file': pdf_file(3)}).data['deck']['id']
        for meta, audio in [(metadata, audio_file(sample=b'\x01\x00')),
                            ({**metadata, 'deck_id': other_deck}, audio_file()),
                            ({**metadata, 'slide_events': [{'slide_index': 0, 'at_ms': 0}]}, audio_file())]:
            self.assertEqual(submit(meta, audio).status_code, 409)
        winner = Attempt.objects.get()
        self.assertEqual(winner.upload_hash, first.upload_hash)
        self.assertEqual(winner.audio.name, first.audio.name)
        self.assertEqual(winner.slide_events, metadata['slide_events'])
        with winner.audio.open('rb') as audio:
            self.assertEqual(audio.read(), audio_file().read())

    def test_truncated_wav_payload_and_unsupported_container_leave_no_attempt(self):
        metadata = {'id': str(uuid.uuid4()), 'deck_id': self.deck()['deck']['id'], 'duration_ms': 2000,
                    'slide_events': [{'slide_index': 1, 'at_ms': 0}]}
        for file in [SimpleUploadedFile('broken.wav', audio_file().read()[:47]),
                     SimpleUploadedFile('unsupported.txt', audio_file().read())]:
            self.assertEqual(self.client.post('/api/attempts/', {'audio': file, 'metadata': json.dumps(metadata)}).status_code, 400)
        self.assertEqual(Attempt.objects.count(), 0)


from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local
from unittest import skipUnless
from django.db import connection, connections
from django.test import TransactionTestCase
from django.db.models.query import QuerySet
from .services.storage import store_attempt, store_deck


@skipUnless(connection.vendor == 'postgresql', 'Requires real PostgreSQL concurrent uniqueness')
class ConcurrentUploadTests(TransactionTestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name)
        setting.enable()
        self.addCleanup(setting.disable)

    def race(self, model, fn):
        barrier = Barrier(2)
        seen = local()
        first = QuerySet.first
        def overlapping(queryset):
            result = first(queryset)
            if queryset.model is model and not getattr(seen, 'checked', False):
                seen.checked = True
                self.assertIsNone(result)
                # Both requests have observed no row before either can insert.
                barrier.wait(timeout=10)
            return result
        def submit(index):
            try:
                return fn(index)
            finally:
                connections.close_all()
        with patch.object(QuerySet, 'first', overlapping), ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(submit, [0, 1]))

    def test_concurrent_duplicate_decks_and_attempts_keep_one_copy(self):
        from pathlib import Path
        decks = self.race(Deck, lambda _: store_deck(pdf_file(), 'Pilot').id)
        self.assertEqual(decks[0], decks[1])
        self.assertEqual(Deck.objects.count(), 1)
        metadata = {'id': uuid.uuid4(), 'deck_id': decks[0], 'duration_ms': 2000, 'audience': '', 'slide_events': [{'slide_index': 1, 'at_ms': 0}]}
        results = self.race(Attempt, lambda _: store_attempt(audio_file(), metadata).id)
        self.assertEqual(results, [metadata['id'], metadata['id']])
        self.assertEqual(Attempt.objects.count(), 1)
        self.assertEqual(len(list(Path(self.media.name).rglob('*.wav'))), 1)
        self.assertEqual(len(list(Path(self.media.name).rglob('*.pdf'))), 1)
        self.assertEqual(len(list(Path(self.media.name).rglob('*.png'))), 2)
        with Attempt.objects.get().audio.open('rb') as audio:
            self.assertEqual(audio.read(), audio_file().read())

    def test_concurrent_conflicting_id_cannot_overwrite_winner(self):
        deck = store_deck(pdf_file(), 'Pilot')
        metadata = {'id': uuid.uuid4(), 'deck_id': deck.id, 'duration_ms': 2000, 'slide_events': [{'slide_index': 1, 'at_ms': 0}]}
        samples = [b'\x00\x00', b'\x01\x00']
        results = self.race(Attempt, lambda i: store_attempt(audio_file(sample=samples[i]), {**metadata, 'audience': str(i)}))
        self.assertEqual(sum(item is None for item in results), 1)
        winner = next(item for item in results if item is not None)
        self.assertEqual(Attempt.objects.get().audience, winner.audience)
        self.assertTrue(winner.audio.storage.exists(winner.audio.name))
        import hashlib
        winning_metadata = {**metadata, 'audience': winner.audience}
        expected_audio = audio_file(sample=samples[int(winner.audience)]).read()
        self.assertEqual(winner.upload_hash, hashlib.sha256(expected_audio + json.dumps(winning_metadata, sort_keys=True, default=str).encode()).hexdigest())
        with winner.audio.open('rb') as audio:
            self.assertEqual(audio.read(), expected_audio)
        self.assertEqual(len(list(Path(self.media.name).rglob('*.wav'))), 1)

# Failure injection uses synthetic PDFs/WAVs and the actual database/file storage.
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
from django.core.files.base import ContentFile
from django.db import OperationalError, transaction
from rest_framework.exceptions import ValidationError


class StorageFailureTests(TransactionTestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name)
        setting.enable()
        self.addCleanup(setting.disable)
        self.deck = store_deck(pdf_file(), 'Synthetic')
        self.metadata = {'id': uuid.uuid4(), 'deck_id': self.deck.id, 'duration_ms': 2000,
                         'audience': '', 'slide_events': [{'slide_index': 1, 'at_ms': 0}]}

    def all_files(self):
        return {p for p in Path(self.media.name).rglob('*') if p.is_file()}

    def test_lost_commit_acknowledgement_preserves_committed_attempt_audio(self):
        original = transaction.Atomic.__exit__
        def lost_ack(ctx, kind, value, tb):
            result = original(ctx, kind, value, tb)
            if kind is None:
                raise OperationalError('synthetic lost commit acknowledgement')
            return result
        with patch.object(transaction.Atomic, '__exit__', lost_ack):
            with self.assertRaises(OperationalError):
                store_attempt(audio_file(), self.metadata)
        row = Attempt.objects.get()
        with row.audio.open('rb') as audio:
            self.assertEqual(audio.read(), audio_file().read())
        self.assertEqual(store_attempt(audio_file(), self.metadata).id, row.id)

    def test_lost_commit_acknowledgement_preserves_deck_pdf_and_slides(self):
        original = transaction.Atomic.__exit__
        def lost_ack(ctx, kind, value, tb):
            result = original(ctx, kind, value, tb)
            if kind is None:
                raise OperationalError('synthetic lost commit acknowledgement')
            return result
        with patch.object(transaction.Atomic, '__exit__', lost_ack):
            with self.assertRaises(OperationalError):
                store_deck(pdf_file(3), 'New synthetic deck')
        deck = Deck.objects.get(page_count=3)
        with deck.pdf.open('rb') as pdf:
            self.assertEqual(pdf.read(), pdf_file(3).read())
        for slide in deck.slides.all():
            self.assertTrue(slide.image.storage.exists(slide.image.name))
        self.assertEqual(store_deck(pdf_file(3), 'Retry').id, deck.id)

    def test_unknown_commit_outcome_and_unavailable_database_retains_media(self):
        original_exit = transaction.Atomic.__exit__
        original_filter = Attempt.objects.filter
        unknown = False
        def lost_ack(ctx, kind, value, tb):
            nonlocal unknown
            result = original_exit(ctx, kind, value, tb)
            if kind is None:
                unknown = True
                raise OperationalError('synthetic lost commit acknowledgement')
            return result
        def unavailable(*args, **kwargs):
            if unknown:
                raise OperationalError('synthetic database offline')
            return original_filter(*args, **kwargs)
        with patch.object(transaction.Atomic, '__exit__', lost_ack), patch.object(Attempt.objects, 'filter', unavailable):
            with self.assertRaisesRegex(OperationalError, 'lost commit'):
                store_attempt(audio_file(), self.metadata)
        row = Attempt.objects.get()
        self.assertTrue(row.audio.storage.exists(row.audio.name))

    def test_partial_audio_write_is_removed_without_modifying_existing_media(self):
        before = self.all_files()
        storage = Attempt._meta.get_field('audio').storage
        original = storage._save
        def partial(name, content):
            original(name, ContentFile(b'partial synthetic file'))
            raise OSError('synthetic write failure')
        with patch.object(storage, '_save', partial):
            with self.assertRaisesRegex(OSError, 'write failure'):
                store_attempt(audio_file(), self.metadata)
        self.assertEqual(Attempt.objects.count(), 0)
        self.assertEqual(self.all_files(), before)

    def test_partial_deck_or_slide_write_removes_every_new_file(self):
        storage = Deck._meta.get_field('pdf').storage
        original = storage._save
        for fail_at in [1, 2, 3]:
            before = self.all_files()
            writes = 0
            def partial(name, content):
                nonlocal writes
                writes += 1
                result = original(name, content)
                if writes == fail_at:
                    raise OSError('synthetic partial deck write')
                return result
            with patch.object(storage, '_save', partial):
                with self.assertRaises(OSError):
                    store_deck(pdf_file(3), 'Synthetic failure')
            self.assertEqual(self.all_files(), before)
            self.assertEqual(Deck.objects.count(), 1)

    def test_database_insert_failure_removes_only_new_media(self):
        winner = store_attempt(audio_file(), self.metadata)
        before = self.all_files()
        with patch.object(Attempt, 'save', side_effect=OperationalError('synthetic insert failed')):
            with self.assertRaises(OperationalError):
                store_attempt(audio_file(), {**self.metadata, 'id': uuid.uuid4()})
        self.assertEqual(self.all_files(), before)
        self.assertTrue(winner.audio.storage.exists(winner.audio.name))
        with patch.object(Deck, 'save', side_effect=OperationalError('synthetic insert failed')):
            with self.assertRaises(OperationalError):
                store_deck(pdf_file(3), 'Synthetic')
        self.assertEqual(self.all_files(), before)

    def test_cleanup_failure_does_not_mask_database_failure_or_report_success(self):
        storage = Attempt._meta.get_field('audio').storage
        with patch.object(Attempt, 'save', side_effect=OperationalError('synthetic insert failed')), patch.object(storage, 'delete', side_effect=OSError('synthetic cleanup failed')):
            with self.assertRaisesRegex(OperationalError, 'insert failed'):
                store_attempt(audio_file(), self.metadata)
        self.assertEqual(Attempt.objects.count(), 0)

    def test_audio_with_valid_headers_but_undecodable_payload_is_rejected(self):
        # Native decoder boundary: header inspection succeeds, payload decode fails.
        import av
        original = av.open
        @contextmanager
        def corrupt(*args, **kwargs):
            with original(*args, **kwargs) as container:
                class Corrupt:
                    streams = container.streams
                    duration = container.duration
                    def decode(self, *args, **kwargs):
                        raise ValueError('synthetic corrupted audio packets')
                yield Corrupt()
        with patch('rehearsals.services.storage.av.open', corrupt):
            with self.assertRaises(ValidationError):
                store_attempt(audio_file(), self.metadata)
        self.assertEqual(Attempt.objects.count(), 0)

    def test_container_duration_cannot_hide_a_short_audio_track(self):
        import av
        original = av.open
        @contextmanager
        def misleading(*args, **kwargs):
            with original(*args, **kwargs) as container:
                class Misleading:
                    streams = container.streams
                    duration = 5_000_000  # A longer video track, with two seconds of audio.
                    def decode(self, *args, **kwargs):
                        return container.decode(*args, **kwargs)
                yield Misleading()
        with patch('rehearsals.services.storage.av.open', misleading):
            with self.assertRaises(ValidationError):
                store_attempt(audio_file(), {**self.metadata, 'duration_ms': 5000})
        self.assertEqual(Attempt.objects.count(), 0)


class MediaRetrievalTests(TransactionTestCase):
    def setUp(self):
        import importlib
        from django.urls import clear_url_caches
        from config import urls
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name, DEBUG=True)
        setting.enable()
        # Rebuild the actual development routes against the temporary media root.
        importlib.reload(urls)
        clear_url_caches()
        def restore():
            setting.disable()
            importlib.reload(urls)
            clear_url_caches()
        self.addCleanup(restore)
        self.client = APIClient()

    def test_stored_pdf_slide_and_audio_are_retrievable_after_reloading_rows(self):
        from urllib.parse import urlsplit
        deck_response = self.client.post('/api/decks/', {'file': pdf_file(), 'title': 'Synthetic'})
        self.assertEqual(deck_response.status_code, 201)
        deck_id = deck_response.data['deck']['id']
        attempt_id = str(uuid.uuid4())
        metadata = {'id': attempt_id, 'deck_id': deck_id, 'duration_ms': 2000,
                    'slide_events': [{'slide_index': 1, 'at_ms': 0}]}
        self.assertEqual(self.client.post('/api/attempts/', {'audio': audio_file(), 'metadata': json.dumps(metadata)}).status_code, 201)
        # Separate GETs resolve new model instances; no upload object's file handle is reused.
        deck = self.client.get(f'/api/decks/{deck_id}/').data
        attempt = self.client.get(f'/api/attempts/{attempt_id}/').data
        def retrieve(url):
            response = self.client.get(urlsplit(url).path)
            self.assertEqual(response.status_code, 200)
            try:
                return b''.join(response.streaming_content)
            finally:
                response.close()
        self.assertEqual(retrieve(deck['pdf_url']), pdf_file().read())
        self.assertEqual(retrieve(attempt['audio_url']), audio_file().read())
        self.assertTrue(retrieve(deck['slides'][0]['image_url']).startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertEqual(attempt['processing_state'], 'awaiting_analysis')
