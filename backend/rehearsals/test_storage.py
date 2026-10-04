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


def audio_file(seconds=2):
    out = BytesIO()
    with wave.open(out, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b"\x00\x00" * 16000 * seconds)
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
