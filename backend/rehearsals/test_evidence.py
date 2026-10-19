"""Shared harmless-formatting and semantic-corruption regression corpus."""
import json
from pathlib import Path
from django.test import SimpleTestCase
from .services.evidence import quotes_equal,verified_excerpt

class EvidenceTextTests(SimpleTestCase):
    def test_shared_quote_corpus(self):
        cases=json.loads((Path(__file__).parent/'testdata/evidence_quotes.json').read_text())
        for group,expected in [('accept',True),('reject',False)]:
            for original,model in cases[group]:
                with self.subTest(original=original,model=model):
                    self.assertEqual(quotes_equal(model,original),expected)
                    self.assertEqual(quotes_equal(original,model),expected)

    def test_slide_excerpts_are_contiguous_whole_words_and_return_authoritative_text(self):
        source='Overview: Coffee\n grows at 1.5 km above sea level.'
        self.assertEqual(verified_excerpt('Grows at 1.5 km',source),'grows at 1.5 km')
        for fake in ['grows at 15 km','Coffee at 1.5','above sea below level','1','C']:
            self.assertIsNone(verified_excerpt(fake,source))
        self.assertIsNone(verified_excerpt('C','C++'))
