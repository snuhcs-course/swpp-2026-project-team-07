"""Exercise the actual migration, legacy preservation and refusal of lossy rollback."""
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CorrectionMigrationTests(TransactionTestCase):
    old = [('rehearsals', '0007_presentationcontext')]
    new = [('rehearsals', '0008_transcriptcorrection_feedbackanalysis_analysis_type_and_more')]

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def test_legacy_roundtrip_and_guarded_new_data_rollback(self):
        apps = self.migrate(self.old)
        try:
            deck = apps.get_model('rehearsals', 'Deck').objects.create(title='Synthetic migration', page_count=1, pdf='synthetic.pdf')
            attempt = apps.get_model('rehearsals', 'Attempt').objects.create(deck_id=deck.pk, audio='original.m4a', duration_ms=1000,
                transcript={'text': 'Original', 'words': [{'text': 'Original', 'start_ms': 0, 'end_ms': 500}]}, slide_events=[{'slide_index': 0, 'at_ms': 0}])
            analysis = apps.get_model('rehearsals', 'FeedbackAnalysis').objects.create(attempt_id=attempt.pk, feedback_revision=3)
            before = apps.get_model('rehearsals', 'Attempt').objects.values().get(pk=attempt.pk)
            apps = self.migrate(self.new)
            self.assertEqual(apps.get_model('rehearsals', 'Attempt').objects.values().get(pk=attempt.pk), before)
            self.assertEqual(apps.get_model('rehearsals', 'FeedbackAnalysis').objects.get(pk=analysis.pk).analysis_type, 'coaching')
            apps = self.migrate(self.old)
            self.assertEqual(apps.get_model('rehearsals', 'Attempt').objects.values().get(pk=attempt.pk), before)
            self.assertEqual(apps.get_model('rehearsals', 'FeedbackAnalysis').objects.get(pk=analysis.pk).feedback_revision, 3)
            apps = self.migrate(self.new)
            apps.get_model('rehearsals', 'TranscriptCorrection').objects.create(attempt_id=attempt.pk, base_transcript_id='a' * 64,
                revision=1, edits=[{'word_start': 0, 'word_end': 0, 'text': 'Corrected'}])
            with self.assertRaisesRegex(RuntimeError, 'Phase 4 data exists'):
                self.migrate(self.old)
            self.assertEqual(apps.get_model('rehearsals', 'TranscriptCorrection').objects.get(attempt_id=attempt.pk).revision, 1)
            self.assertEqual(apps.get_model('rehearsals', 'Attempt').objects.values().get(pk=attempt.pk), before)
        finally:
            self.migrate(self.new)
