"""Synthetic text/images only; pure evidence tests, no providers or private media."""
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from dataclasses import FrozenInstanceError
import io
import logging
import struct
from unittest import TestCase
from unittest.mock import patch
import zlib

from PIL import Image, PngImagePlugin

from .services.alignment import align_words
from .services.feedback import (
    FeedbackError, Descriptions, Suggestions, MAX_IMAGE_BYTES,
    MAX_CONTEXT_BYTES, prepare_analysis, validate_descriptions, validate_suggestions,
    strict_json, canonical_quote,
)

DECK = '11111111-1111-4111-8111-111111111111'
ATTEMPT = '33333333-3333-4333-8333-333333333333'


def image_bytes(size=(12, 8), fmt='PNG'):
    stream = io.BytesIO()
    Image.new('RGB', size, 'white').save(stream, format=fmt)
    return stream.getvalue()


def png_with_private_profile():
    """Synthetic PNG with a profile name that Pillow includes in debug logs."""
    marker = b'SYNTHETIC_PRIVATE_PROFILE'
    chunk = b'iCCP' + marker + b'\x00\x00' + zlib.compress(b'Synthetic ICC profile')
    encoded = struct.pack('>I', len(chunk) - 4) + chunk + struct.pack('>I', zlib.crc32(chunk))
    data = image_bytes()
    return data[:33] + encoded + data[33:], marker.decode('ascii')  # After IHDR.


def fixture(*, words=None, events=None, audience='', slides=2, text=None):
    words = deepcopy(words if words is not None else [
        {'text': 'Hello,', 'start_ms': 100, 'end_ms': 500},
        {'text': '안녕!', 'start_ms': 500, 'end_ms': 1100},
        {'text': 'Hello,', 'start_ms': 1100, 'end_ms': 1500},
        {'text': '안녕!', 'start_ms': 1600, 'end_ms': 1700},
        {'text': 'Return.', 'start_ms': 2200, 'end_ms': 2500},
    ])
    events = events or [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 1000}, {'slide_index': 0, 'at_ms': 2000}]
    visits = align_words([{**w, 'index': i} for i, w in enumerate(words)], events, 3000)
    value = {'attempt_id': ATTEMPT, 'deck_id': DECK, 'duration_ms': 3000, 'speaker_language': 'ko/en', 'audience': audience,
             'slides': [{'deck_id': DECK, 'slide_index': i, 'source_language': 'en', 'extracted_text': f'Synthetic slide {i}'} for i in range(slides)],
             'transcript': {'text': text if text is not None else ' '.join(w['text'] for w in words), 'words': words},
             'visits': [{k: v for k, v in visit.items() if k != 'words'} | {'word_indexes': [w['index'] for w in visit['words']]} for visit in visits]}
    return value, tuple(image_bytes() for _ in range(slides))


def description_value(analysis):
    def fact(text, uncertain=False):
        return {'text': text, 'uncertain': uncertain, 'uncertainty': 'Unreadable value' if uncertain else ''}
    return {'slides': [{'deck_id': DECK, 'slide_index': i, 'source_id': source_id,
                        'summary': fact(f'Synthetic slide {i}'), 'key_ideas': [fact('Save before analysis.')],
                        'visual_facts': [fact('An unreadable chart value.', True)]}
                       for i, source_id in enumerate(analysis.source_ids)]}


def suggestion(analysis, **changes):
    return {'category': 'clarity', 'slide_index': 0, 'source_id': analysis.source_ids[0], 'transcript_id': analysis.transcript_id,
            'visit_id': 0, 'segment_id': 'v0s0', 'word_start': 0, 'word_end': 1,
            'speech_quote': 'Hello, 안녕!', 'description_ref': 'key_ideas/0', 'slide_quote': 'Save before analysis.',
            'observation': '이 문장의 연결이 불분명합니다.', 'suggestion': 'Explain how saving relates to analysis.', **changes}


class FeedbackEvidenceTests(TestCase):
    def setUp(self):
        self.value, self.images = fixture()
        self.analysis = prepare_analysis(self.value, self.images)
        self.descriptions = validate_descriptions(description_value(self.analysis), self.analysis)

    def validate(self, *cards, analysis=None, descriptions=None):
        return validate_suggestions({'suggestions': list(cards)}, analysis or self.analysis, descriptions or self.descriptions)

    def test_exact_span_and_boundary_crossing_derive_times(self):
        result = self.validate(suggestion(self.analysis))
        self.assertEqual((result.state, result.accepted_count, result.discarded_count), ('accepted', 1, 0))
        card = result.suggestions[0]
        self.assertEqual((card.start_ms, card.end_ms), (100, 1100))  # Visit ends at 1000.
        self.assertEqual(card.slide_quote, 'Save before analysis.')
        self.assertEqual(card.speech_quote, 'Hello, 안녕!')
        self.assertEqual(self.analysis.source.duration_ms, 3000)

    def test_repeated_identical_phrases_are_selected_by_indexes(self):
        later = suggestion(self.analysis, slide_index=1, source_id=self.analysis.source_ids[1], visit_id=1,
                           segment_id='v1s0', word_start=2, word_end=3)
        result = self.validate(later, suggestion(self.analysis))
        self.assertEqual([(c.start_ms, c.end_ms) for c in result.suggestions], [(1100, 1700), (100, 1100)])
        for changes in [{'visit_id': 0}, {'segment_id': 'v0s0'}, {'slide_index': 0}, {'word_start': 0, 'word_end': 1}, {'source_id': '0' * 64}]:
            self.assertEqual(self.validate({**later, **changes}).state, 'all_invalid')

    def test_quotes_preserve_korean_case_punctuation_and_complete_words(self):
        valid = suggestion(self.analysis, speech_quote='\tHello,\n 안녕!  ')
        self.assertEqual(self.validate(valid).accepted_count, 1)
        for quote in ['Hello 안녕!', 'hello, 안녕!', 'Hello, 안녕', 'Hello,', '녕!', 'ello, 안녕!', 'Hello, 안녕! extra']:
            self.assertEqual(self.validate(suggestion(self.analysis, speech_quote=quote)).state, 'all_invalid')
        value, images = fixture(words=[{'text': 'restart', 'start_ms': 0, 'end_ms': 100}], text='restart')
        analysis = prepare_analysis(value, images)
        desc = validate_descriptions(description_value(analysis), analysis)
        self.assertEqual(self.validate(suggestion(analysis, word_end=0, speech_quote='start'), analysis=analysis, descriptions=desc).state, 'all_invalid')
        self.assertEqual(canonical_quote('한글\u00a0English!'), '한글 English!')

    def test_short_speech_is_allowed_no_arbitrary_minimum(self):
        value, images = fixture(words=[{'text': '네.', 'start_ms': 0, 'end_ms': 0}])
        analysis = prepare_analysis(value, images)
        desc = validate_descriptions(description_value(analysis), analysis)
        result = self.validate(suggestion(analysis, word_end=0, speech_quote='네.'), analysis=analysis, descriptions=desc)
        self.assertEqual(result.accepted_count, 1)
        self.assertEqual((result.suggestions[0].start_ms, result.suggestions[0].end_ms), (0, 0))

    def test_simultaneous_repeated_backward_visits_and_last_event_wins(self):
        value, images = fixture(events=[{'slide_index': 1, 'at_ms': 0}, {'slide_index': 0, 'at_ms': 0},
                                       {'slide_index': 1, 'at_ms': 1000}, {'slide_index': 0, 'at_ms': 1000},
                                       {'slide_index': 0, 'at_ms': 2000}])
        analysis = prepare_analysis(value, images)
        self.assertEqual([v.word_indexes for v in analysis.source.visits], [(), (0, 1), (), (2, 3), (4,)])
        self.assertEqual([s.visit_id for s in analysis.segments], [1, 3, 4])
        changed = deepcopy(value)
        changed['visits'][0]['word_indexes'] = [0]
        changed['visits'][1]['word_indexes'] = [1]
        with self.assertRaises(FeedbackError):
            prepare_analysis(changed, images)

    def test_unsorted_overlapping_words_keep_identity_and_cover_full_range(self):
        value, images = fixture(words=[{'text': 'A', 'start_ms': 400, 'end_ms': 900},
                                      {'text': 'B', 'start_ms': 100, 'end_ms': 200},
                                      {'text': 'C', 'start_ms': 1500, 'end_ms': 1600},
                                      {'text': 'D', 'start_ms': 800, 'end_ms': 1200}])
        analysis = prepare_analysis(value, images)
        desc = validate_descriptions(description_value(analysis), analysis)
        self.assertEqual([s.word_indexes for s in analysis.segments], [(0, 1), (3,), (2,)])
        result = self.validate(suggestion(analysis, speech_quote='A B'), analysis=analysis, descriptions=desc)
        self.assertEqual((result.suggestions[0].start_ms, result.suggestions[0].end_ms), (100, 900))
        self.assertEqual(self.validate(suggestion(analysis, word_end=3, speech_quote='A B C D'), analysis=analysis, descriptions=desc).state, 'all_invalid')

    def test_segment_size_and_index_scope_are_stable(self):
        value, images = fixture(words=[{'text': 'Echo', 'start_ms': i, 'end_ms': i + 1} for i in range(41)])
        analysis = prepare_analysis(value, images)
        self.assertEqual([len(s.word_indexes) for s in analysis.segments], [40, 1])
        value['attempt_id'] = DECK
        other = prepare_analysis(value, images)
        self.assertNotEqual(other.transcript_id, analysis.transcript_id)
        value['transcript']['words'][0]['text'] = 'Changed'
        self.assertNotEqual(prepare_analysis(value, images).transcript_id, other.transcript_id)

    def test_prepared_data_and_outputs_are_immutable_and_private_in_repr(self):
        original = deepcopy(self.value)
        prepare_analysis(self.value, self.images)
        self.assertEqual(self.value, original)
        self.value['transcript']['words'][0]['text'] = 'mutated'
        self.assertEqual(self.analysis.source.transcript.words[0].text, 'Hello,')
        with self.assertRaises((FrozenInstanceError, ValueError)):
            self.analysis.source.audience = 'changed'
        for item in [self.analysis, self.analysis.source, self.analysis.source.transcript.words[0], self.descriptions, self.validate(suggestion(self.analysis))]:
            self.assertNotIn('Hello', repr(item))
            self.assertNotIn('Synthetic slide', str(item))

    def test_input_types_unknown_fields_timestamps_and_bounds_fail_closed(self):
        bad = []
        for path, values in [(['duration_ms'], [True, '3000', 0, -1, 600001, float('nan')]),
                             (['slides', 0, 'slide_index'], [True, -1, 10, '0', 1]),
                             (['transcript', 'words', 0, 'end_ms'], [True, '100', 3001, -1, None, float('inf')]),
                             (['transcript', 'words', 0, 'start_ms'], [501, 3000, -1]),
                             (['visits', 0, 'start_ms'], [1, True]),
                             (['visits', 0, 'end_ms'], [999, 1100]),
                             (['visits', 1, 'word_indexes'], [[True, 3], [2, 3, 3], [3, 2], [0, 2, 3]]),
                             (['audience'], ['x' * 501, None]),
                             (['slides', 0, 'extracted_text'], ['x' * 8001]),
                             (['slides', 0, 'deck_id'], [ATTEMPT]),
                             (['speaker_language'], ['', ' '])]:
            for item in values:
                value = deepcopy(self.value)
                target = value
                for part in path[:-1]:
                    target = target[part]
                target[path[-1]] = item
                bad.append(value)
        extra = deepcopy(self.value)
        extra['transcript']['words'][0]['url'] = 'https://invalid.example'
        bad.append(extra)
        for value in bad:
            with self.subTest(value=value), self.assertRaises(FeedbackError) as caught:
                prepare_analysis(value, self.images)
            self.assertNotIn('Hello', str(caught.exception))

    def test_missing_and_empty_transcript_are_explicit_preflight(self):
        for transcript, code in [(None, 'missing_transcript'), ({'text': '', 'words': []}, 'no_speech')]:
            value, images = fixture(words=[])
            value['transcript'] = transcript
            with self.assertRaises(FeedbackError) as caught:
                prepare_analysis(value, images)
            self.assertEqual(caught.exception.code, code)
        for transcript in [{'text': 'claimed speech', 'words': []}, {'text': '', 'words': self.value['transcript']['words']}]:
            value, images = fixture(words=transcript['words'])
            value['transcript'] = transcript
            with self.assertRaises(FeedbackError):
                prepare_analysis(value, images)

    def test_image_decode_format_pixel_byte_and_aggregate_limits(self):
        for data in [b'', b'not a real image', self.images[0][:40], b'x' * (MAX_IMAGE_BYTES + 1),
                     image_bytes((1601, 2)), image_bytes((2, 1601)), image_bytes(fmt='GIF')]:
            with self.subTest(size=len(data)), self.assertRaises(FeedbackError) as caught:
                prepare_analysis(self.value, (data, self.images[1]))
            self.assertEqual(caught.exception.code, 'invalid_image')
        self.assertEqual(prepare_analysis(self.value, (image_bytes(fmt='JPEG'), self.images[1])).images[0].mime, 'image/jpeg')
        with patch('rehearsals.services.feedback.MAX_IMAGE_PIXELS', 80), self.assertRaises(FeedbackError):
            prepare_analysis(self.value, self.images)
        with patch('rehearsals.services.feedback.MAX_TOTAL_IMAGE_BYTES', len(self.images[0])), self.assertRaises(FeedbackError):
            prepare_analysis(self.value, self.images)
        with self.assertRaises(FeedbackError):
            prepare_analysis(self.value, self.images[:1])

    def test_image_metadata_stays_private_on_success_and_rejection(self):
        data, marker = png_with_private_profile()
        for reject in (False, True):
            with self.subTest(reject=reject):
                with self.assertLogs('PIL.PngImagePlugin', level='DEBUG') as captured:
                    if reject:
                        # Missing IEND: image identification succeeds, verification fails.
                        with self.assertRaises(FeedbackError) as caught:
                            prepare_analysis(self.value, (data[:-12], self.images[1]))
                        self.assertEqual(caught.exception.code, 'invalid_image')
                        self.assertNotIn(marker, repr(caught.exception))
                    else:
                        prepared = prepare_analysis(self.value, (data, self.images[1]))
                        self.assertEqual(prepared.images[0].data, data)
                        self.assertEqual(prepared.images[0].mime, 'image/png')
                        self.assertNotIn(marker, repr(prepared))
                    logging.getLogger('PIL.PngImagePlugin').debug('unrelated image logging after preparation')
                output = '\n'.join(captured.output)
                self.assertIn('unrelated image logging after preparation', output)
                self.assertNotIn(marker, output)

    def test_image_logging_guard_preserves_other_calls_during_decode(self):
        data, marker = png_with_private_profile()
        original_load = PngImagePlugin.PngImageFile.load

        def load_with_other_activity(image, *args, **kwargs):
            logging.getLogger('PIL.PngImagePlugin').debug('SYNTHETIC_PRIVATE_DECODE')
            logging.getLogger('rehearsals.synthetic').debug('unrelated application logging during decode')
            # A different request/thread must retain its Pillow logging settings.
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(logging.getLogger('PIL.PngImagePlugin').debug,
                                'unrelated image logging during decode').result(timeout=5)
            return original_load(image, *args, **kwargs)

        with self.assertLogs(level='DEBUG') as captured, patch.object(PngImagePlugin.PngImageFile, 'load', load_with_other_activity):
            prepare_analysis(self.value, (data, self.images[1]))
        output = '\n'.join(captured.output)
        self.assertIn('unrelated application logging during decode', output)
        self.assertIn('unrelated image logging during decode', output)
        self.assertNotIn('SYNTHETIC_PRIVATE_DECODE', output)
        self.assertNotIn(marker, output)

    def test_ten_slide_and_aggregate_context_bound(self):
        value, images = fixture(slides=10)
        self.assertEqual(len(prepare_analysis(value, images).images), 10)
        value['slides'].append({**value['slides'][0], 'slide_index': 10})
        with self.assertRaises(FeedbackError):
            prepare_analysis(value, images + (images[0],))
        with patch('rehearsals.services.feedback.json_bytes', return_value=b' ' * (MAX_CONTEXT_BYTES + 1)), self.assertRaises(FeedbackError):
            prepare_analysis(self.value, self.images)

    def test_every_description_once_source_identity_and_uncertainty_consistency(self):
        values = []
        for change in ['missing', 'duplicate', 'unknown', 'source', 'deck', 'extra', 'uncertainty', 'text', 'blank', 'type']:
            value = description_value(self.analysis)
            if change == 'missing': value['slides'].pop()
            if change == 'duplicate': value['slides'][1] = deepcopy(value['slides'][0])
            if change == 'unknown': value['slides'][0]['slide_index'] = 8
            if change == 'source': value['slides'][0]['source_id'] = '0' * 64
            if change == 'deck': value['slides'][0]['deck_id'] = ATTEMPT
            if change == 'extra': value['slides'][0]['unknown'] = 'untrusted'
            if change == 'uncertainty': value['slides'][0]['summary']['uncertainty'] = 'Unreadable'
            if change == 'text': value['slides'][0]['summary']['text'] = 'x' * 401
            if change == 'blank': value['slides'][0]['summary']['text'] = '   '
            if change == 'type': value['slides'][0]['summary']['uncertain'] = 'false'
            values.append(value)
        for value in values:
            with self.subTest(value=value), self.assertRaises(FeedbackError):
                validate_descriptions(value, self.analysis)

    def test_uncertain_or_inexact_slide_evidence_is_discarded(self):
        for changes in [{'description_ref': 'visual_facts/0', 'slide_quote': 'An unreadable chart value.'},
                        {'description_ref': 'key_ideas/4'}, {'slide_quote': 'Save'}, {'slide_quote': 'Save before analysis. '},
                        {'transcript_id': '0' * 64}, {'word_start': 1, 'word_end': 0}]:
            self.assertEqual(self.validate(suggestion(self.analysis, **changes)).state, 'all_invalid')

    def test_optional_audience_only_and_bounded_actionable_fields(self):
        self.assertEqual(self.validate(suggestion(self.analysis, category='audience')).state, 'all_invalid')
        for audience in ['   ', 'Students new to this topic']:
            value, images = fixture(audience=audience)
            analysis = prepare_analysis(value, images)
            descriptions = validate_descriptions(description_value(analysis), analysis)
            result = self.validate(suggestion(analysis, category='audience'), analysis=analysis, descriptions=descriptions)
            self.assertEqual(result.accepted_count, int(bool(audience.strip())))
        for changes in [{'observation': ' '}, {'suggestion': '\n'}]:
            self.assertEqual(self.validate(suggestion(self.analysis, **changes)).state, 'all_invalid')

    def test_max_three_empty_all_invalid_partial_and_duplicate_states(self):
        card = suggestion(self.analysis)
        self.assertEqual(self.validate().state, 'empty')
        self.assertEqual(self.validate({**card, 'word_start': 4}).state, 'all_invalid')
        result = self.validate(card, card, {**card, 'word_end': 0, 'speech_quote': 'Hello,'})
        self.assertEqual((result.state, result.accepted_count, result.discarded_count), ('partial', 1, 2))
        with self.assertRaises(FeedbackError):
            self.validate(card, card, card, card)
        third = suggestion(self.analysis, visit_id=2, segment_id='v2s0', word_start=4, word_end=4, speech_quote='Return.')
        second = suggestion(self.analysis, slide_index=1, source_id=self.analysis.source_ids[1], visit_id=1, segment_id='v1s0', word_start=2, word_end=3)
        self.assertEqual(self.validate(card, second, third).accepted_count, 3)

    def test_strict_envelopes_types_actions_and_nonfinite_json(self):
        for value in [{'suggestions': [], 'action': 'send'}, [], None, {'suggestions': 'none'}, {'suggestions': [dict(suggestion(self.analysis), word_start=True)]},
                      {'suggestions': [dict(suggestion(self.analysis), category='grade')]}, {'suggestions': [dict(suggestion(self.analysis), start_ms=0)]}]:
            with self.assertRaises(FeedbackError):
                validate_suggestions(value, self.analysis, self.descriptions)
        for raw in [b'{"x":NaN}', b'{"x":1,"x":2}', b'{', b'\xff', b'[' * 1200]:
            with self.assertRaises(FeedbackError):
                strict_json(raw)

    def test_schemas_require_all_fields_and_forbid_extra_properties(self):
        def inspect(schema):
            if isinstance(schema, dict):
                if schema.get('type') == 'object':
                    self.assertIs(schema['additionalProperties'], False)
                    self.assertEqual(set(schema['required']), set(schema['properties']))
                for value in schema.values(): inspect(value)
            elif isinstance(schema, list):
                for value in schema: inspect(value)
        for model in [Descriptions, Suggestions]: inspect(model.model_json_schema())
