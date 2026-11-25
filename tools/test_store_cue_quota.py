"""The public release template must admit supported slide-image requests."""
from pathlib import Path
from unittest import TestCase

from rehearsals.services.feedback_provider import MAX_REQUEST_BYTES, OUTPUT_TOKENS


class StoreCueQuotaTests(TestCase):
    def test_largest_valid_slide_profile_fits_per_minute_allowance(self):
        template = Path(__file__).resolve().parents[1] / 'deploy' / 'store.env.example'
        limits = [int(line.split('=', 1)[1]) for line in template.read_text().splitlines()
                  if line.startswith('FEEDBACK_OPENROUTER_TPM=')]
        self.assertEqual(len(limits), 1)
        # The existing worker reserves serialized bytes plus the allowed output.
        self.assertGreaterEqual(limits[0], MAX_REQUEST_BYTES + OUTPUT_TOKENS['descriptions'])
