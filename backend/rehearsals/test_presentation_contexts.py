"""Phase 1 contract tests; synthetic decks only, no providers or workers."""
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from .models import Deck


class PresentationContextTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.deck = Deck.objects.create(title='Synthetic', pdf='unopened.pdf', page_count=2)
        self.context_id = str(uuid.uuid4())
        self.collection = '/api/presentation-contexts/'
        self.detail = f'{self.collection}{self.context_id}/'

    def create(self, **changes):
        data = {'id': self.context_id, 'deck_id': str(self.deck.id)} | changes
        return self.client.post(self.collection, json.dumps(data), content_type='application/json')

    def update(self, **changes):
        data = {'expected_revision': 0, 'required_duration_seconds': 300, 'audience': 'New students'} | changes
        return self.client.patch(self.detail, json.dumps(data), content_type='application/json')

    def test_create_missing_requirements_and_read(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {'id': self.context_id, 'deck_id': str(self.deck.id),
                         'required_duration_seconds': None, 'audience': '', 'revision': 0})
        self.assertEqual(self.client.get(self.detail).json(), response.json())

    def test_contexts_on_same_deck_are_independent(self):
        self.assertEqual(self.create().status_code, 201)
        other = str(uuid.uuid4())
        self.assertEqual(self.create(id=other).status_code, 201)
        self.assertEqual(self.update().status_code, 200)
        self.assertEqual(self.client.get(f'{self.collection}{other}/').json()['revision'], 0)

    def test_revision_changes_only_when_values_change_and_can_clear(self):
        self.create()
        response = self.update()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['revision'], 1)
        self.assertEqual(self.update(expected_revision=1).json()['revision'], 1)
        cleared = self.update(expected_revision=1, required_duration_seconds=None, audience='')
        self.assertEqual((cleared.status_code, cleared.json()['revision']), (200, 2))
        self.assertIsNone(cleared.json()['required_duration_seconds'])

    def test_stale_revision_is_conflict_even_for_identical_values(self):
        self.create()
        self.update()
        response = self.update()
        self.assertEqual((response.status_code, response.json()['error']['code']), (409, 'stale_revision'))
        self.assertEqual(self.client.get(self.detail).json()['revision'], 1)

    def test_duration_and_audience_boundaries(self):
        self.create()
        for value in [True, '60', 60.5, 0, 59, 1801]:
            with self.subTest(value=value):
                self.assertEqual(self.update(required_duration_seconds=value).status_code, 400)
        for value in [None, 60, 1800]:
            current = self.client.get(self.detail).json()['revision']
            response = self.update(expected_revision=current, required_duration_seconds=value, audience='x' * 500)
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.update(expected_revision=response.json()['revision'], audience='x' * 501).status_code, 400)
        self.assertEqual(self.update(audience=None).status_code, 400)

    def test_missing_deck_and_context(self):
        self.assertEqual(self.create(deck_id=str(uuid.uuid4())).status_code, 404)
        self.assertEqual(self.client.get(self.detail).status_code, 404)
        self.assertEqual(self.update().status_code, 404)

    def test_malformed_unicode_rejected_without_changing_requirements(self):
        self.create()
        for audience in ['\ud800', '\udc00']:
            self.assertEqual(self.update(audience=audience).status_code, 400)
            self.assertEqual(self.client.get(self.detail).json()['revision'], 0)
            self.assertEqual(self.client.get(self.detail).json()['audience'], '')
        response = self.update(audience='😀' * 500)
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()['revision'], response.json()['audience']), (1, '😀' * 500))

    def test_create_retry_preserves_current_requirements(self):
        self.create()
        self.update()
        response = self.create()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['revision'], 1)
        other = Deck.objects.create(title='Other', pdf='other.pdf', page_count=1)
        self.assertEqual(self.create(deck_id=str(other.id)).status_code, 409)

    def test_strict_request_rejects_duplicate_extra_fields_and_bad_revisions(self):
        self.create()
        for raw in ['[]', '{"expected_revision":0}',
                    '{"expected_revision":0,"expected_revision":0,"required_duration_seconds":60,"audience":""}',
                    json.dumps({'expected_revision': True, 'required_duration_seconds': 60, 'audience': ''}),
                    json.dumps({'expected_revision': 0, 'required_duration_seconds': 60, 'audience': '', 'extra': 1}),
                    json.dumps({'expected_revision': 0, 'required_duration_seconds': 60, 'audience': '\u0000'})]:
            self.assertEqual(self.client.patch(self.detail, raw, content_type='application/json').status_code, 400)
        self.assertEqual(self.client.patch(self.detail, '{}', content_type='text/plain').status_code, 400)
        self.assertEqual(self.client.patch(self.detail, ' ' * 9000, content_type='application/json').status_code, 400)

    def test_requirements_never_start_provider_or_worker_jobs(self):
        with patch('rehearsals.tasks.describe_deck.delay') as descriptions, \
             patch('rehearsals.tasks.coach_attempt.delay') as coaching, \
             patch('rehearsals.services.feedback_provider.request_raw') as provider:
            self.assertEqual(self.create().status_code, 201)
            self.assertEqual(self.update().status_code, 200)
            descriptions.assert_not_called()
            coaching.assert_not_called()
            provider.assert_not_called()


@skipUnless(connection.vendor == 'postgresql', 'Row-lock proof requires PostgreSQL')
class PresentationContextConcurrencyTests(TransactionTestCase):
    def test_two_updates_consume_one_revision(self):
        deck = Deck.objects.create(title='Synthetic concurrency', pdf='unopened.pdf', page_count=1)
        context_id = str(uuid.uuid4())
        client = APIClient()
        response = client.post('/api/presentation-contexts/', {'id': context_id, 'deck_id': str(deck.id)}, format='json')
        self.assertEqual(response.status_code, 201)
        barrier = Barrier(2)

        def update(audience):
            try:
                barrier.wait(timeout=5)
                response = APIClient().patch(f'/api/presentation-contexts/{context_id}/',
                    {'expected_revision': 0, 'required_duration_seconds': 300, 'audience': audience}, format='json')
                return response.status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(update, ['A', 'B']))
        self.assertEqual(sorted(results), [200, 409])
        state = client.get(f'/api/presentation-contexts/{context_id}/').json()
        self.assertEqual(state['revision'], 1)
        self.assertIn(state['audience'], ['A', 'B'])
