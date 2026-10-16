"""Synthetic offline contracts for compact selected-review requests."""
# AI-assisted by OpenAI Codex; see docs/ai-collaboration-prompts-iteration-2.md.
from copy import deepcopy
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from .services import corrections, feedback_provider as provider, slide_review
from .services.feedback import FeedbackError, json_bytes, prepare_analysis
from .test_feedback import fixture, description_value, suggestion
from .test_feedback_provider import envelope

CONTEXT_VERSION = 'selected-review-context-v1'


def prepared_fixture(name='openai', *, long=False, version='slide-review-v3'):
    if long:
        words = [{'text': f'word{i}', 'start_ms': i * 100, 'end_ms': i * 100 + 60}
                 for i in range(300)]
        words[49]['end_ms'] = 5100  # Original word crosses a slide transition.
        words[225]['text'] = 'Distant-explanation.'
        source, images = fixture(words=words, duration_ms=30000, events=[
            {'slide_index': index, 'at_ms': n * 5000}
            for n, index in enumerate([0, 1, 0, 1, 1, 1])])
    else:
        source, images = fixture()
    analysis = prepare_analysis(source, images)
    adapter = provider.FeedbackAdapter(provider.ProviderConfig(name, 'synthetic-model', ''), preparation_only=True)
    facts = description_value(analysis)
    prepared = adapter.prepare_coaching(analysis, adapter.edited_descriptions(analysis, facts))
    profile = deepcopy(facts)
    for slide in profile['slides']:
        slide.update(slide_kind='content', must_cover=[], go_deeper=[])
    edits = corrections.normalize([{'word_start': 49, 'word_end': 50, 'text': 'Boundary correction.'}],
                                  source['transcript']) if long else []
    snapshot = {'source': source, 'slide_review': {
        'version': version, 'scope': {'context_id': None, 'slides': [{'slide_index': 0, 'segments': [
            {'start_ms': visit.start_ms, 'end_ms': visit.end_ms}
            for visit in analysis.source.visits if visit.slide_index == 0]}]},
        'requirements': {'context_id': None, 'revision': None, 'audience': '', 'required_duration_seconds': None}},
        'review_profile': profile, 'effective_text': corrections.effective_text(source['transcript'], edits),
        'corrections': edits, 'transcript_revision': 2 if edits else 0}
    return prepared, snapshot


def user_contexts(prepared):
    payload = provider.strict_json(prepared.payload, provider.MAX_REQUEST_BYTES)
    parts = payload['input'][0]['content'] if prepared.config.provider == 'openai' else payload['contents'][0]['parts']
    return [provider.strict_json(part['text'].encode(), provider.MAX_REQUEST_BYTES) for part in parts]


class CompactReviewContextTests(TestCase):
    def compact(self, prepared, snapshot):
        snapshot = deepcopy(snapshot)
        snapshot['slide_review']['request_context_version'] = CONTEXT_VERSION
        return slide_review.augment(prepared, snapshot), snapshot

    def test_new_capture_freezes_context_identity_without_changing_public_version(self):
        attempt = SimpleNamespace()
        scope = {'context_id': None, 'slides': [{'slide_index': 0, 'segments': [{'start_ms': 0, 'end_ms': 1000}]}]}
        with patch.object(slide_review, 'requirements', return_value={'audience': ''}):
            captured = slide_review.capture(attempt, scope)
        self.assertEqual(captured['version'], 'slide-review-v3')
        self.assertEqual(captured['request_context_version'], CONTEXT_VERSION)

    def test_saved_v2_and_v3_wire_hashes_remain_exact(self):
        # Frozen before compact implementation; protects persisted request identities.
        expected = LEGACY_HASHES
        for name in ('openai', 'gemini'):
            for version in ('slide-review-v2', 'slide-review-v3'):
                with self.subTest(provider=name, version=version):
                    prepared, snapshot = prepared_fixture(name, version=version)
                    original = slide_review.augment(prepared, snapshot)
                    self.assertEqual(original.input_hash, expected[(name, version)])
                    self.assertEqual(len(user_contexts(original)), 2)

    def test_unknown_context_version_fails_closed(self):
        prepared, snapshot = prepared_fixture()
        for version in (None, 'future-context-v99', 'selected-review-group-context-v1', 1):
            with self.subTest(version=version):
                snapshot['slide_review']['request_context_version'] = version
                with self.assertRaises(FeedbackError) as error:
                    slide_review.augment(prepared, snapshot)
                self.assertEqual(error.exception.code, 'snapshot_unavailable')

    def test_context_preserves_cross_slide_interpretation_and_original_selected_evidence(self):
        for name in ('openai', 'gemini'):
            with self.subTest(provider=name):
                prepared, snapshot = prepared_fixture(name, long=True)
                original_snapshot = deepcopy(snapshot)
                compact, saved = self.compact(prepared, snapshot)
                self.assertEqual(snapshot, original_snapshot)
                contexts = user_contexts(compact)
                self.assertEqual(len(contexts), 1)
                context = contexts[0]
                self.assertEqual(context['whole_attempt_effective_text'], snapshot['effective_text'])
                self.assertIn('Distant-explanation.', context['whole_attempt_effective_text'])
                self.assertIn('Boundary correction.', context['whole_attempt_effective_text'])
                self.assertEqual(context['confirmed_corrections'], snapshot['corrections'])
                self.assertEqual(context['review_scope'], saved['slide_review'])
                self.assertEqual(context['transcript_id'], prepared.analysis.transcript_id)
                self.assertEqual(context['slide_profiles'], snapshot['review_profile'])
                self.assertNotIn('slides', context)  # No duplicate full-deck facts.
                self.assertEqual(context['original_evidence']['word_columns'],
                                 ['word_index', 'start_ms', 'end_ms', 'text'])
                rows, selected, nearby = {}, set(), set()
                original_segments = {s.segment_id: s for s in prepared.analysis.segments}
                for segment in context['original_evidence']['segments']:
                    original = original_segments[segment['segment_id']]
                    self.assertEqual((segment['visit_id'], segment['slide_index']),
                                     (original.visit_id, original.slide_index))
                    for index, start, end, text in segment['words']:
                        word = prepared.analysis.source.transcript.words[index]
                        self.assertIn(index, original.word_indexes)
                        self.assertEqual((start, end, text), (word.start_ms, word.end_ms, word.text))
                        self.assertNotIn(index, rows)
                        rows[index] = (start, end, text)
                        (selected if segment['role'] == 'selected_evidence' else nearby).add(index)
                self.assertEqual(selected, set(range(50)) | set(range(100, 150)))
                self.assertEqual(nearby, set(range(50, 70)) | set(range(80, 100)) | set(range(150, 170)))
                self.assertEqual(rows[49][1], 5100)
                self.assertNotIn(225, rows)  # Still available in full corrected background.
                self.assertIs(compact.analysis, prepared.analysis)
                self.assertIs(compact.descriptions, prepared.descriptions)
                self.assertEqual(compact.payload, slide_review.augment(prepared, saved).payload)
                legacy = slide_review.augment(prepared, snapshot)
                self.assertLess(len(compact.payload), len(legacy.payload))
                self.assertNotEqual(compact.input_hash, legacy.input_hash)
                old, new = provider.strict_json(legacy.payload), provider.strict_json(compact.payload)
                if name == 'openai':
                    self.assertEqual(old['text'], new['text'])
                    self.assertEqual(old['max_output_tokens'], new['max_output_tokens'])
                    self.assertTrue(new['instructions'].startswith(old['instructions']))
                else:
                    self.assertEqual(old['generationConfig'], new['generationConfig'])
                    self.assertTrue(new['systemInstruction']['parts'][0]['text'].startswith(old['systemInstruction']['parts'][0]['text']))

    def test_each_singleton_keeps_all_its_original_visit_words(self):
        prepared, snapshot = prepared_fixture(long=True)
        for index in (0, 1):
            with self.subTest(slide_index=index):
                selected = [{'slide_index': index, 'segments': [
                    {'start_ms': visit.start_ms, 'end_ms': visit.end_ms}
                    for visit in prepared.analysis.source.visits if visit.slide_index == index]}]
                snapshot['slide_review']['scope']['slides'] = selected
                compact, _ = self.compact(prepared, snapshot)
                segments = user_contexts(compact)[0]['original_evidence']['segments']
                evidence = [segment for segment in segments if segment['role'] == 'selected_evidence']
                self.assertTrue(all(segment['slide_index'] == index for segment in evidence))
                self.assertEqual([row[0] for segment in evidence for row in segment['words']],
                    [word_index for visit in prepared.analysis.source.visits if visit.slide_index == index
                     for word_index in visit.word_indexes])

    def test_compact_output_still_enforces_request_limit(self):
        prepared, snapshot = prepared_fixture()
        compact, saved = self.compact(prepared, snapshot)
        self.assertLess(len(prepared.payload), len(compact.payload) - 1)
        with patch.object(provider, 'MAX_REQUEST_BYTES', len(compact.payload) - 1):
            with self.assertRaises(FeedbackError) as error:
                slide_review.augment(prepared, saved)
        self.assertEqual(error.exception.code, 'request_too_large')

    def test_valid_large_request_uses_request_bound_not_response_bound(self):
        words = [{'text': 'synthetic' * 8 + str(i), 'start_ms': i * 100, 'end_ms': i * 100 + 60}
                 for i in range(600)]
        source, images = fixture(words=words, duration_ms=60000)
        analysis = prepare_analysis(source, images)
        adapter = provider.FeedbackAdapter(provider.ProviderConfig('openai', 'synthetic-model', ''), preparation_only=True)
        prepared = adapter.prepare_coaching(analysis, adapter.edited_descriptions(analysis, description_value(analysis)))
        _, snapshot = prepared_fixture()
        snapshot.update(source=source, effective_text=source['transcript']['text'])
        snapshot['slide_review']['scope']['slides'][0]['segments'][-1]['end_ms'] = 60000
        self.assertGreater(len(prepared.payload), 65536)
        compact, _ = self.compact(prepared, snapshot)
        self.assertLess(len(compact.payload), provider.MAX_REQUEST_BYTES)
        self.assertEqual(len(user_contexts(compact)), 1)

    def test_missing_profile_still_supplies_authoritative_slide_facts(self):
        prepared, snapshot = prepared_fixture()
        snapshot.pop('review_profile')
        compact, _ = self.compact(prepared, snapshot)
        self.assertEqual(user_contexts(compact)[0]['slide_profiles'],
                         prepared.descriptions.model_dump(mode='json'))

    def test_profile_guidance_cannot_override_validated_evidence_facts(self):
        prepared, snapshot = prepared_fixture()
        snapshot['review_profile']['slides'][0]['summary']['text'] = 'Stale profile fact'
        compact, _ = self.compact(prepared, snapshot)
        self.assertEqual(user_contexts(compact)[0]['slide_profiles']['slides'][0]['summary']['text'],
                         prepared.descriptions.slides[0].summary.text)

    def test_synthetic_receipts_use_new_identity_and_same_evidence_validation(self):
        for name in ('openai', 'gemini'):
            with self.subTest(provider=name):
                prepared, snapshot = prepared_fixture(name)
                compact, saved = self.compact(prepared, snapshot)
                card = suggestion(prepared.analysis, category='content', priority=1)
                output = {'evaluation_mode': 'informative_descriptive', 'slides': [
                    {'slide_index': 0, 'status': 'successful', 'findings': [card], 'enrichments': []}]}
                def receipt(request):
                    return provider.RawReceipt(name, request.config.model, 'coaching', request.input_hash,
                                               200, json_bytes(envelope(name, output)), True, None, None, ())
                result = slide_review.normalize(compact, receipt(compact), saved)
                self.assertEqual((result.accepted_count, result.discarded_count), (1, 0))
                self.assertEqual((result.slides[0]['findings'][0]['start_ms'], result.slides[0]['findings'][0]['end_ms']), (100, 1100))
                with self.assertRaises(FeedbackError):
                    slide_review.normalize(compact, receipt(prepared), saved)
                card['speech_quote'] = 'Invented speech'
                self.assertEqual(slide_review.normalize(compact, receipt(compact), saved).accepted_count, 0)


LEGACY_HASHES = {
    ('openai', 'slide-review-v2'): '8ef458d025db228e993b94c5a0aa67d77f6499adddab1c5667c679803cc9048a',
    ('openai', 'slide-review-v3'): 'f3639f6e7a6317dd5e2c813d8deb7e9ac1a9525066760114df3aa6f9e53b06d5',
    ('gemini', 'slide-review-v2'): 'c257f9c69fa8fe4e1627921f6dee64f288d61b12f601e4f381354bf1ec00d751',
    ('gemini', 'slide-review-v3'): '57790587a849b5233c4b92d4b49c8b189299049bec62f4a3b610fb8a93627cf6',
}
