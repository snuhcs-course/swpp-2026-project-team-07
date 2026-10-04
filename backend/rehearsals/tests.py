from copy import deepcopy
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from .models import Attempt, Deck
from .serializers import AttemptMetadataSerializer


class ScaffoldApiTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_is_liveness(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "outloud-api")
        self.assertFalse(response.json()["scaffold"])



class MetadataContractTests(SimpleTestCase):
    def setUp(self):
        self.payload = {
            "id": "33333333-3333-4333-8333-333333333333",
            "deck_id": "11111111-1111-4111-8111-111111111111",
            "duration_ms": 5000,
            "slide_events": [
                {"slide_index": 0, "at_ms": 0},
                {"slide_index": 1, "at_ms": 1500},
                {"slide_index": 0, "at_ms": 3000},
            ],
        }

    def test_backward_visits_and_same_time_transitions_are_preserved(self):
        self.payload["slide_events"].insert(2, {"slide_index": 2, "at_ms": 1500})
        serializer = AttemptMetadataSerializer(data=self.payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(len(serializer.validated_data["slide_events"]), 4)

    def test_invalid_timing_is_rejected(self):
        for events in [
            [],
            [{"slide_index": 0, "at_ms": 1}],
            [{"slide_index": 0, "at_ms": 0}, {"slide_index": 1, "at_ms": 5000}],
            [{"slide_index": -1, "at_ms": 0}],
            [
                {"slide_index": 0, "at_ms": 0},
                {"slide_index": 1, "at_ms": 3000},
                {"slide_index": 0, "at_ms": 2000},
            ],
        ]:
            payload = deepcopy(self.payload)
            payload["slide_events"] = events
            self.assertFalse(AttemptMetadataSerializer(data=payload).is_valid())


class AttemptStorageTests(TestCase):
    def test_new_attempts_keep_separate_ids_and_events(self):
        deck = Deck.objects.create(
            title="Example", pdf="decks/example.pdf", page_count=3
        )
        first = Attempt.objects.create(
            deck=deck,
            audio="recordings/one.m4a",
            duration_ms=5000,
            slide_events=[{"slide_index": 0, "at_ms": 0}],
        )
        second = Attempt.objects.create(
            deck=deck, audio="recordings/two.m4a", duration_ms=3000
        )
        first.refresh_from_db()
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(deck.attempts.count(), 2)
        self.assertEqual(first.slide_events, [{"slide_index": 0, "at_ms": 0}])
