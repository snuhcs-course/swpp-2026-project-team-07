"""Generated v5 profile receipts may recover an unambiguous copied digest."""
from dataclasses import replace

from django.test import SimpleTestCase

from .services import feedback_provider as provider
from .services.feedback import FeedbackError, json_bytes, prepare_analysis
from .services.slide_profile_schema import validate_profiles
from .test_cue_guidance import guidance_value, reference
from .test_feedback import fixture
from .test_feedback_provider import envelope


def change_digit(digest, position):
    new = '0' if digest[position] != '0' else '1'
    return digest[:position] + new + digest[position + 1:]


class GeneratedProfileSourceTests(SimpleTestCase):
    def setUp(self):
        self.deck = prepare_analysis(*fixture(slides=7)).deck
        config = provider.ProviderConfig('openrouter', 'synthetic', '')
        adapter = provider.FeedbackAdapter(config, preparation_only=True, description_schema_version='slide-profile-v5')
        self.request = adapter.prepare_descriptions(self.deck)
        self.value = guidance_value(self.deck)
        self.last = self.value['slides'][-1]
        self.correct = self.last['source_id']
        self.typo = change_digit(self.correct, 38)
        self.last['source_id'] = self.typo
        self.last['summary']['text'] = 'Evening markets open at sunset.'
        for slide in (self.value['slides'][0], self.last):
            slide['go_deeper'] = [dict(text='Connect the visit time to the evening market hours.',
                kind='connection', evidence_refs=[reference(self.last)], information_needed='')]

    def receipt(self):
        body = json_bytes(envelope('openai', self.value))  # OpenRouter uses the same Responses envelope.
        return provider.RawReceipt('openrouter', 'synthetic', 'descriptions', self.request.input_hash,
                                   200, body, True, None, None, ())

    def test_v5_normalizes_slide_and_two_refs_without_changing_receipt_or_strict_validation(self):
        receipt = self.receipt()
        result = provider.normalize(self.request, receipt).descriptions
        self.assertEqual(result.slides[-1].source_id, self.correct)
        for slide in (result.slides[0], result.slides[-1]):
            ref = slide.go_deeper[0].evidence_refs[0]
            self.assertEqual((ref.slide_index, ref.source_id, ref.quote),
                             (6, self.correct, self.last['summary']['text']))
        self.assertEqual(provider.output_json(receipt), self.value)
        with self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
            validate_profiles(self.value, self.deck, 'slide-profile-v5')
        with self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
            provider.normalize(replace(self.request, description_schema_version='slide-profile-v4'), receipt)

    def test_wrong_foreign_unrelated_and_malformed_ids_remain_invalid(self):
        for wrong in (self.deck.source_ids[1], 'f' * 64, change_digit(self.typo, 5),
                      self.correct[:-1], self.correct[:-1] + 'x'):
            with self.subTest(wrong=wrong), self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
                self.last['source_id'] = wrong
                provider.normalize(self.request, self.receipt())

    def test_ambiguous_or_exact_foreign_digest_even_one_digit_away_remains_invalid(self):
        for other in (change_digit(self.typo, 5), self.typo):
            with self.subTest(other=other), self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
                ids = (other, *self.deck.source_ids[1:])
                self.value['slides'][0]['source_id'] = other
                prepared = replace(self.request, analysis=replace(self.deck, source_ids=ids))
                provider.normalize(prepared, self.receipt())

    def test_wrong_reference_index_source_or_quote_and_wrong_deck_are_rejected(self):
        ref = self.value['slides'][0]['go_deeper'][0]['evidence_refs'][0]
        for obj, field, wrong in ((ref, 'slide_index', 2), (ref, 'slide_index', -1),
                                  (ref, 'source_id', self.deck.source_ids[2]),
                                  (ref, 'quote', 'The market is closed at sunset.'),
                                  (self.last, 'deck_id', '22222222-2222-4222-8222-222222222222')):
            with self.subTest(field=field, wrong=wrong), self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
                original = obj[field]
                obj[field] = wrong
                try:
                    provider.normalize(self.request, self.receipt())
                finally:
                    obj[field] = original
