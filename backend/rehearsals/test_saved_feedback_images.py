"""Saved upload to feedback regression: synthetic media, no provider calls."""
import hashlib
import io
import random

from django.core.files.base import ContentFile
from django.test import TestCase
from PIL import Image

from .models import Slide, FeedbackAnalysis, FeedbackRequest
from .services import descriptions
from .services.feedback import FeedbackError, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES
from .test_coaching import SyntheticCoaching


def noisy_image(size=(1024, 768), fmt='PNG'):
    image = Image.frombytes('RGB', size, random.Random(21).randbytes(size[0] * size[1] * 3))
    output = io.BytesIO()
    image.save(output, format=fmt, quality=90)
    return output.getvalue()


class SavedFeedbackImageTests(SyntheticCoaching, TestCase):
    def replace_image(self, data):
        slide = self.deck.slides.get()
        slide.image.save('synthetic-large.png', ContentFile(data), save=True)
        return slide

    def test_large_uploaded_png_admits_feedback_without_changing_saved_sources(self):
        original = noisy_image()
        self.assertGreater(len(original), MAX_IMAGE_BYTES)
        slide = self.replace_image(original)
        transcript = self.attempt.transcript
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        self.assertLessEqual(len(prepared.images[0].data), MAX_IMAGE_BYTES)
        with Image.open(io.BytesIO(prepared.images[0].data)) as decoded:
            self.assertEqual(decoded.size, (1024, 768))
        repeated, _ = descriptions.prepare_saved(self.deck.pk)
        self.assertEqual(prepared.input_id, repeated.input_id)
        response = self.client.post(self.feedback_url + 'generate/', {}, format='json')
        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(FeedbackAnalysis.objects.filter(attempt=self.attempt).count(), 1)
        self.assertEqual(FeedbackRequest.objects.count(), 0)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.transcript, transcript)
        self.assertEqual(hashlib.sha256(slide.image.read()).digest(), hashlib.sha256(original).digest())

    def test_compatible_stored_image_keeps_exact_bytes_and_source_identity(self):
        original = self.deck.slides.get().image.read()
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        self.assertEqual(prepared.images[0].data, original)
        repeated, _ = descriptions.prepare_saved(self.deck.pk)
        self.assertEqual(prepared.source_ids, repeated.source_ids)

    def test_individually_valid_images_fit_the_aggregate_feedback_budget(self):
        data = noisy_image((1100, 900), 'JPEG')
        self.assertLessEqual(len(data), MAX_IMAGE_BYTES)
        self.assertGreater(10 * len(data), MAX_TOTAL_IMAGE_BYTES)
        self.replace_image(data)
        for index in range(1, 10):
            slide = Slide(deck=self.deck, slide_index=index, extracted_text='Synthetic slide')
            slide.image.save(f'synthetic-{index}.jpg', ContentFile(data), save=True)
        self.deck.page_count = 10
        self.deck.save(update_fields=['page_count'])
        prepared, _ = descriptions.prepare_saved(self.deck.pk)
        self.assertEqual(len(prepared.images), 10)
        self.assertLessEqual(sum(len(image.data) for image in prepared.images), MAX_TOTAL_IMAGE_BYTES)

    def test_oversized_invalid_image_cannot_enter_feedback_queue(self):
        self.replace_image(b'not an image' * 100000)
        response = self.client.post(self.feedback_url + 'generate/', {}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(FeedbackAnalysis.objects.count(), 0)
        self.assertEqual(FeedbackRequest.objects.count(), 0)

    def test_stored_image_read_is_bounded(self):
        self.replace_image(b'x' * (8 * 1024 * 1024 + 1))
        with self.assertRaises(FeedbackError):
            descriptions.prepare_saved(self.deck.pk)
        self.assertEqual(FeedbackAnalysis.objects.count(), 0)
