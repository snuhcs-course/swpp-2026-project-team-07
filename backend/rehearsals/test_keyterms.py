"""Synthetic PDF text only; no provider calls. Codex, Iteration 2, 2026-10-16."""
from django.test import SimpleTestCase
from .services.keyterms import extract_keyterms


class KeytermTests(SimpleTestCase):
    def test_names_acronyms_short_phrases_and_korean_survive(self):
        terms = extract_keyterms(['SNU Buddy\nOutLoud\n신경망 학습\nSNU Buddy'])
        self.assertIn('SNU Buddy', terms)
        self.assertIn('OutLoud', terms)
        self.assertIn('신경망 학습', terms)
        self.assertEqual(sum(t.casefold() == 'snu buddy' for t in terms), 1)
        self.assertEqual(terms, extract_keyterms(['SNU Buddy\nOutLoud\n신경망 학습\nSNU Buddy']))

    def test_limits_numbers_stopwords_and_forbidden_characters(self):
        self.assertEqual(extract_keyterms(['', 'the and of we um uh\n2026 10 16']), [])
        text = ' '.join(['a' * 50, 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'])
        terms = extract_keyterms([text, '<OutLoud> [Scribe] {SNU} back\\slash'])
        self.assertNotIn('a' * 50, terms)
        for term in terms:
            self.assertLess(len(term), 50)
            self.assertLessEqual(len(term.split()), 5)
            self.assertFalse(any(c in term for c in '<>{}[]\\'))
        self.assertLessEqual(len(extract_keyterms([' '.join(f'Topic{i}' for i in range(150))])), 100)

    def test_extraction_is_bounded_for_large_documents(self):
        terms = extract_keyterms(['Alpha ' * 20_000, 'UnvisitedTail'])
        self.assertNotIn('UnvisitedTail', terms)
