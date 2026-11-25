from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from .models import Attempt, Deck, Installation, PresentationContext, Slide
from .services.public_retention import purge_expired_installations


class StoreRetentionTests(TestCase):
    def setUp(self):
        folder = TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.media = Path(folder.name)
        self.settings = override_settings(MEDIA_ROOT=self.media, OUTLOUD_PUBLIC_SERVICE=True)
        self.settings.enable()
        self.addCleanup(self.settings.disable)
        self.stale = Installation.objects.create(token_hash='stale', last_seen=timezone.now() - timedelta(days=31))
        self.active = Installation.objects.create(token_hash='active')
        for installation in (self.stale, self.active):
            directory = self.media / 'i' / str(installation.pk)
            directory.mkdir(parents=True)
            (directory / 'file.pdf').write_bytes(b'synthetic retention fixture')
            deck = Deck.objects.create(installation=installation, title='fixture', pdf='file.pdf', page_count=1)
            Slide.objects.create(deck=deck, slide_index=0, image='test.png')
            PresentationContext.objects.create(deck=deck)
            Attempt.objects.create(deck=deck, audio='test.wav', duration_ms=5, slide_events=[])

    def test_purge_removes_only_stale_public_data_and_is_repeatable(self):
        self.assertEqual(purge_expired_installations(), 1)
        self.assertEqual(purge_expired_installations(), 0)
        self.assertEqual(list(Deck.objects.values_list('installation_id', flat=True)), [self.active.pk])
        self.assertEqual(Attempt.objects.count(), 1)
        self.assertTrue((self.media / 'i' / str(self.active.pk) / 'file.pdf').exists())
        self.assertFalse((self.media / 'i' / str(self.stale.pk)).exists())

    def test_storage_interruption_keeps_retry_record(self):
        with patch('rehearsals.services.public_retention.shutil.rmtree', side_effect=OSError):
            with self.assertRaises(OSError):
                purge_expired_installations()
        self.assertTrue(Installation.objects.filter(pk=self.stale.pk).exists())
        self.assertEqual(purge_expired_installations(), 1)

    def test_private_demo_is_outside_retention(self):
        with override_settings(OUTLOUD_PUBLIC_SERVICE=False):
            self.assertEqual(purge_expired_installations(), 0)
        self.assertEqual(Attempt.objects.count(), 2)
