"""Additive schema proof with synthetic legacy records; no media is opened."""
import uuid
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class DescriptionMigrationTests(TransactionTestCase):
    before = [('rehearsals', '0004_preserve_existing_attempts')]

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def test_preserves_deck_slide_attempt_whisper_and_media_without_enqueue(self):
        latest = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(lambda: self.migrate(latest))
        old = self.migrate(self.before)
        deck = old.get_model('rehearsals', 'Deck').objects.create(title='Synthetic legacy',
            pdf='synthetic/preserved.pdf', page_count=1, content_hash='a' * 64, preparation_version='pdfium-v1')
        old.get_model('rehearsals', 'Slide').objects.create(deck=deck, slide_index=0,
            image='synthetic/preserved.png', extracted_text='Synthetic retained source')
        now = timezone.now()
        attempt = old.get_model('rehearsals', 'Attempt').objects.create(deck=deck,
            audio='synthetic/preserved.wav', duration_ms=1000, status='completed', processing_revision=2,
            processing_state='completed', feedback_state='disabled', claim_token=uuid.uuid4(),
            slide_events=[{'slide_index': 0, 'at_ms': 0}], transcript={'text': 'retained', 'words': []},
            feedback=[], visits=[], metrics={'duration_ms': 1000}, analysis_outcome='speech')
        old.get_model('rehearsals', 'ProviderRequest').objects.create(attempt=attempt, generation=2,
            claim_token=attempt.claim_token, input_hash='b' * 64, submitted_at=now, raw_received_at=now,
            finished_at=now, raw_response={'text': 'Synthetic retained receipt'}, usage={'tokens': 1}, outcome='received')
        names = ['Deck', 'Slide', 'Attempt', 'ProviderRequest']
        expected = {name: list(old.get_model('rehearsals', name).objects.values()) for name in names}
        current = self.migrate(latest)
        for name in names:
            self.assertEqual(list(current.get_model('rehearsals', name).objects.values()), expected[name])
        for name in ['DescriptionSet', 'DescriptionJob', 'FeedbackRequest', 'FeedbackQuotaBucket', 'FeedbackReservation']:
            self.assertFalse(current.get_model('rehearsals', name).objects.exists())
        constraints = connection.introspection.get_constraints(connection.cursor(), 'rehearsals_providerrequest')
        self.assertTrue(constraints['one_provider_request_per_generation']['unique'])
