import uuid

from django.db import DatabaseError, connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class ProcessingMigrationTests(TransactionTestCase):
    before = [('rehearsals', '0002_attempt_upload_hash_deck_content_hash_and_more')]
    schema = [('rehearsals', '0003_attempt_analysis_outcome_attempt_claim_token_and_more')]

    def setUp(self):
        super().setUp()
        # Register restoration before downgrading, including setup failures.
        self.assertTrue(connection.get_autocommit())
        self.latest = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_schema)

    def migrate_to(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def restore_latest_schema(self):
        # A deferred-SQL failure in Django's schema-editor __exit__ can leave its
        # atomic block open. Roll it back before restoring, so the original test
        # fails without poisoning all later tests with an aborted transaction.
        error = RuntimeError('Rollback failed test migration')
        while connection.atomic_blocks:
            connection.atomic_blocks[-1].__exit__(type(error), error, None)
        self.migrate_to(self.latest)

    def test_additive_migration_preserves_media_results_and_does_not_queue_old_work(self):
        old = self.migrate_to(self.before)
        deck = old.get_model('rehearsals', 'Deck').objects.create(
            title='Synthetic migration fixture', pdf='synthetic/old.pdf', page_count=1,
        )
        model = old.get_model('rehearsals', 'Attempt')
        transcript = {'text': 'synthetic existing result', 'words': []}
        feedback = [{'synthetic': True}]
        error = {'code': 'synthetic_failure', 'message': 'Synthetic legacy error'}
        fixtures = [
            ('completed', transcript, feedback, None, 'completed', 'completed', 'legacy'),
            ('failed', transcript, feedback, error, 'failed', 'failed', 'legacy'),
            ('pending', None, [], None, 'pending', 'awaiting_analysis', ''),
            ('processing', transcript, feedback, None, 'pending', 'awaiting_analysis', 'legacy'),
            ('pending', transcript, [], None, 'pending', 'awaiting_analysis', 'legacy'),
            ('pending', None, feedback, None, 'pending', 'awaiting_analysis', 'legacy'),
        ]
        expected = []
        for index, (status, text, notes, failure, new_status, stage, outcome) in enumerate(fixtures):
            attempt = model.objects.create(
                deck=deck, audio=f'synthetic/{index}.wav', duration_ms=1000,
                slide_events=[{'slide_index': 0, 'at_ms': 0}],
                audience='Synthetic audience', upload_hash=str(index) * 64,
                status=status, transcript=text, feedback=notes, error=failure,
            )
            snapshot = model.objects.values().get(pk=attempt.pk)
            snapshot['status'] = new_status
            expected.append((snapshot, stage, outcome))

        current = self.migrate_to(self.latest)
        attempts = current.get_model('rehearsals', 'Attempt')
        self.assertEqual(attempts.objects.count(), len(fixtures))
        for snapshot, stage, outcome in expected:
            with self.subTest(attempt=snapshot['id']):
                # All old fields, including file references/identity/timeline and
                # partial results, survive. Only legacy 'processing' is reset.
                self.assertEqual(attempts.objects.values(*snapshot).get(pk=snapshot['id']), snapshot)
                attempt = attempts.objects.get(pk=snapshot['id'])
                self.assertEqual(attempt.processing_state, stage)
                self.assertEqual(attempt.analysis_outcome, outcome)
                self.assertEqual(attempt.feedback_state, 'legacy' if outcome else 'disabled')
                self.assertEqual(attempt.processing_revision, 0)
                self.assertEqual(attempt.failed_stage, '')
                for field in ('queued_at', 'claimed_at', 'claim_token', 'retry_at', 'visits', 'metrics'):
                    self.assertIsNone(getattr(attempt, field), field)
        self.assertEqual(current.get_model('rehearsals', 'Deck').objects.get(pk=deck.pk).pdf.name, 'synthetic/old.pdf')
        self.assertFalse(current.get_model('rehearsals', 'ProviderRequest').objects.exists())

    def test_backfill_preserves_current_generations_after_interrupted_upgrade_and_replay(self):
        schema = self.migrate_to(self.schema)
        deck = schema.get_model('rehearsals', 'Deck').objects.create(
            title='Synthetic migration fixture', pdf='synthetic/current.pdf', page_count=1,
        )
        model = schema.get_model('rehearsals', 'Attempt')
        requests = schema.get_model('rehearsals', 'ProviderRequest')
        legacy = model.objects.create(deck=deck, audio='synthetic/legacy.wav', duration_ms=1000, status='processing')
        now = timezone.now()
        word = {'text': 'synthetic', 'start_ms': 0, 'end_ms': 1000}
        for stage in ('queued', 'checking_audio', 'transcribing', 'aligning', 'completed', 'failed', 'needs_confirmation'):
            status = 'completed' if stage == 'completed' else 'failed' if stage in ('failed', 'needs_confirmation') else 'processing'
            attempt = model.objects.create(
                deck=deck, audio=f'synthetic/{stage}.wav', duration_ms=1000,
                slide_events=[{'slide_index': 0, 'at_ms': 0}],
                status=status, processing_state=stage, processing_revision=2,
                analysis_outcome='speech', feedback_state='disabled',
                transcript={'text': 'synthetic', 'words': [word]},
                visits=[{'slide_index': 0, 'start_ms': 0, 'end_ms': 1000, 'words': [word]}],
                metrics={'duration_ms': 1000, 'time_per_slide': [{'slide_index': 0, 'duration_ms': 1000}]},
                queued_at=now, claimed_at=now, claim_token=uuid.uuid4(),
                retry_at=now if status == 'failed' else None,
                failed_stage='aligning' if status == 'failed' else '',
                error={'code': 'synthetic_failure', 'message': 'Synthetic partial failure'} if status == 'failed' else None,
            )
            requests.objects.create(
                attempt=attempt, generation=2, claim_token=attempt.claim_token,
                input_hash='a' * 64, submitted_at=now, finished_at=now,
                raw_received_at=now, outcome='received',
                raw_response={'text': 'synthetic', 'words': [{'word': 'synthetic', 'start': 0, 'end': 1}]},
                usage={'synthetic': True},
            )
        expected_attempts = list(model.objects.exclude(pk=legacy.pk).order_by('id').values())
        expected_requests = list(requests.objects.order_by('id').values())
        for replay in (False, True):
            with self.subTest(replay=replay):
                current = self.migrate_to(self.latest)
                attempts = current.get_model('rehearsals', 'Attempt')
                self.assertEqual(list(attempts.objects.exclude(pk=legacy.pk).order_by('id').values()), expected_attempts)
                self.assertEqual(list(current.get_model('rehearsals', 'ProviderRequest').objects.order_by('id').values()), expected_requests)
                preserved = attempts.objects.get(pk=legacy.pk)
                self.assertEqual(preserved.status, 'pending')
                self.assertEqual(preserved.processing_state, 'awaiting_analysis')
                self.assertEqual(preserved.processing_revision, 0)
                self.assertEqual(preserved.analysis_outcome, 'legacy')
                self.assertIsNone(preserved.queued_at)
                self.assertIsNone(preserved.claim_token)
            if not replay:
                # Data reversal is intentionally a no-op; replay must be safe.
                self.migrate_to(self.schema)

    def test_cleanup_rolls_back_failed_deferred_sql_before_restoring_schema(self):
        schema = self.migrate_to(self.schema)
        deck_model = schema.get_model('rehearsals', 'Deck')
        with self.assertRaises(DatabaseError):
            with connection.schema_editor() as editor:
                deck = deck_model.objects.create(title='Synthetic rollback fixture', pdf='synthetic/rollback.pdf', page_count=1)
                editor.deferred_sql.append('SELECT * FROM missing_migration_cleanup_fixture')
        self.restore_latest_schema()
        self.assertTrue(connection.get_autocommit())
        self.assertFalse(connection.needs_rollback)
        self.assertFalse(deck_model.objects.filter(pk=deck.pk).exists())
