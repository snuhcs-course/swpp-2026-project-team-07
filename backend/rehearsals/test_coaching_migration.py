"""Populated checkpoint-2 preservation; no media reads and no auto-admission."""
import uuid
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class CoachingMigrationTests(TransactionTestCase):
    before = [('rehearsals', '0005_descriptionset_descriptionjob_feedbackquotabucket_and_more')]

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def test_preserves_populated_attempts_descriptions_requests_reservations_and_whisper(self):
        latest = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(lambda: self.migrate(latest))
        old = self.migrate(self.before)
        model = lambda name: old.get_model('rehearsals', name)
        deck = model('Deck').objects.create(title='Synthetic retained', pdf='synthetic/unopened.pdf', page_count=1)
        model('Slide').objects.create(deck=deck, slide_index=0, image='synthetic/unopened.png', extracted_text='Retained')
        attempt = model('Attempt').objects.create(deck=deck, audio='synthetic/unopened.wav', duration_ms=1000,
            transcript={'text': 'retained', 'words': []}, feedback=[{'observation': 'Legacy retained'}],
            feedback_state='legacy', visits=[], processing_revision=4)
        now, token = timezone.now(), uuid.uuid4()
        model('ProviderRequest').objects.create(attempt=attempt, generation=4, claim_token=token,
            input_hash='a'*64, submitted_at=now, raw_response={'text': 'retained'}, usage={'tokens': 5})
        value = model('DescriptionSet').objects.create(deck=deck, source_fingerprint='b'*64, provider='gemini',
            project_id='synthetic', model='gemini-3.1-flash-lite', prompt_version='description-v2', schema_version='description-v1',
            source_snapshot={'synthetic': True}, prompt_digest='c'*64, input_hash='d'*64,
            descriptions={'slides': []}, processing_revision=2, description_revision=1, edited=True)
        job = model('DescriptionJob').objects.create(description_set=value, generation=1, description_revision=0,
            state='needs_confirmation', queued_at=now, claimed_at=now, claim_token=token)
        request = model('FeedbackRequest').objects.create(job=job, generation=1, claim_token=token, provider='gemini',
            project_id='synthetic', model=value.model, input_hash='d'*64, queued_at=now, claimed_at=now,
            submitted_at=now, received_at=now, raw_body=b'{"synthetic":"retained"}', usage={'totalTokenCount': 10}, outcome='received')
        bucket = model('FeedbackQuotaBucket').objects.create(provider='gemini', project_id='synthetic', model=value.model)
        model('FeedbackReservation').objects.create(request=request, bucket=bucket, units=12345, reserved_at=now, submitted_at=now)
        names = ['Deck', 'Slide', 'Attempt', 'ProviderRequest', 'DescriptionSet', 'DescriptionJob',
                 'FeedbackRequest', 'FeedbackQuotaBucket', 'FeedbackReservation']
        before = {name: list(model(name).objects.values()) for name in names}
        current = self.migrate(latest)
        for name in names:
            actual = list(current.get_model('rehearsals', name).objects.values())
            if name == 'FeedbackRequest':
                self.assertIsNone(actual[0].pop('coaching_job_id'))
            self.assertEqual(actual, before[name])
        self.assertFalse(current.get_model('rehearsals', 'FeedbackAnalysis').objects.exists())
        self.assertFalse(current.get_model('rehearsals', 'FeedbackJob').objects.exists())
        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(cursor, 'rehearsals_providerrequest')
            self.assertTrue(constraints['one_provider_request_per_generation']['unique'])
            constraints = connection.introspection.get_constraints(cursor, 'rehearsals_feedbackrequest')
            self.assertTrue(constraints['feedback_request_exact_stage_owner']['check'])
