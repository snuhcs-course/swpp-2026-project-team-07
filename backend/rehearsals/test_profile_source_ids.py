"""Generated v5 source identity and candidate-level evidence validation."""
from copy import deepcopy
from dataclasses import replace

from django.test import SimpleTestCase, override_settings

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

    @override_settings(OUTLOUD_PUBLIC_SERVICE=False)
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

    @override_settings(OUTLOUD_PUBLIC_SERVICE=True)
    def test_public_unverified_quote_drops_whole_candidate_only(self):
        expected = provider.normalize(self.request, self.receipt()).descriptions.model_dump(mode='json')
        self.value = deepcopy(expected)  # Canonical source IDs isolate the quote failure.
        first = self.value['slides'][0]
        ungrounded = deepcopy(first['go_deeper'][0])
        ungrounded['text'] = 'Compare opening hours with the unverified closing time.'
        ungrounded['evidence_refs'].append(dict(reference(first), quote='There is a midnight curfew.'))
        first['go_deeper'].insert(0, ungrounded)
        saved = self.receipt()
        original_body = saved.body
        result = provider.normalize(self.request, saved).descriptions.model_dump(mode='json')
        self.assertEqual(result, expected)
        self.assertEqual(saved.body, original_body)
        self.assertEqual(provider.output_json(saved), self.value)

        with override_settings(OUTLOUD_PUBLIC_SERVICE=False), self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
            provider.normalize(self.request, saved)
        with self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
            validate_profiles(self.value, self.deck, 'slide-profile-v5')
        with self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
            provider.normalize(replace(self.request, description_schema_version='slide-profile-v4'), saved)

    @override_settings(OUTLOUD_PUBLIC_SERVICE=True)
    def test_only_retained_candidates_reserve_their_text_across_both_categories(self):
        first = self.value['slides'][0]
        verified = first['must_cover'][0]
        enrichment = first['go_deeper'][0]
        first['must_cover'] = [
            dict(verified, text=enrichment['text'], evidence_refs=['visual_facts/4']),
            dict(verified, evidence_refs=['key_ideas/4']),
            verified,
        ]
        first['go_deeper'] = [
            dict(enrichment, evidence_refs=[dict(reference(self.last), quote='Unsupported market hours.')]),
            enrichment, dict(enrichment, text=verified['text']),
        ]
        result = provider.normalize(self.request, self.receipt()).descriptions.slides[0]
        self.assertEqual([c.text for c in result.must_cover], [verified['text']])
        self.assertEqual([c.text for c in result.go_deeper], [enrichment['text']])
        self.assertEqual(result.go_deeper[0].evidence_refs[0].source_id, self.correct)

    @override_settings(OUTLOUD_PUBLIC_SERVICE=True)
    def test_evidence_without_words_cannot_support_public_cues(self):
        self.value = provider.normalize(self.request, self.receipt()).descriptions.model_dump(mode='json')
        first = self.value['slides'][0]
        first['visual_facts'] = [{'text': '\ufeff', 'uncertain': False, 'uncertainty': ''}]
        expected = deepcopy(self.value)
        first['must_cover'].insert(0, {'text': 'Explain the trend in the displayed figure.',
                                       'evidence_refs': ['summary', 'visual_facts/0']})
        strict = validate_profiles(self.value, self.deck, 'slide-profile-v5')
        self.assertEqual(len(strict.slides[0].must_cover), 2)
        enrichment = first['go_deeper'][0]
        empty_ref = dict(reference(first, 'visual_facts/0'), quote='\ufeff')
        first['go_deeper'].insert(0, dict(enrichment, evidence_refs=[empty_ref, *enrichment['evidence_refs']]))
        saved = self.receipt()
        self.assertEqual(provider.normalize(self.request, saved).descriptions.model_dump(mode='json'), expected)
        self.assertEqual(provider.output_json(saved), self.value)

    @override_settings(OUTLOUD_PUBLIC_SERVICE=True)
    def test_public_bad_slide_identity_fact_or_candidate_protocol_rejects_whole_receipt(self):
        original = deepcopy(self.value)
        for mutate in (
            lambda s: s.update(deck_id='22222222-2222-4222-8222-222222222222'),
            lambda s: s.update(source_id=self.deck.source_ids[2]), lambda s: s.update(slide_index=2),
            lambda s: s['summary'].update(uncertain=True, uncertainty=''),
            lambda s: s.update(must_cover=s['must_cover'] * 4),
            lambda s: s['go_deeper'][0].update(unexpected='extra field'),
        ):
            with self.subTest(mutate=mutate), self.assertRaisesMessage(FeedbackError, 'invalid_descriptions'):
                self.value = deepcopy(original)
                mutate(self.value['slides'][-1])
                provider.normalize(self.request, self.receipt())
