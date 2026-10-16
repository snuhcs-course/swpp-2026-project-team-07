"""Scribe-only identity and migration graph; synthetic, no inference."""
from django.test import SimpleTestCase
from django.db.migrations.loader import MigrationLoader
from .models import ProviderRequest


class ScribeContractTests(SimpleTestCase):
    def test_new_request_defaults_cannot_claim_whisper(self):
        request = ProviderRequest()
        self.assertEqual((request.provider, request.model), ('elevenlabs', 'scribe_v2'))

    def test_both_histories_have_one_joined_migration_leaf(self):
        graph = MigrationLoader(None).graph
        self.assertEqual(graph.leaf_nodes('rehearsals'), [('rehearsals', '0011_merge_scribe_scoring')])
        ancestors = set(graph.forwards_plan(('rehearsals', '0011_merge_scribe_scoring')))
        self.assertIn(('rehearsals', '0007_provider_request_options'), ancestors)
        self.assertIn(('rehearsals', '0010_slide_review_membership'), ancestors)
