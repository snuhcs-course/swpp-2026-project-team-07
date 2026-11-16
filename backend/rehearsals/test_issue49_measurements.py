"""Issue #49 regression evidence; synthetic audio and mocked local inference only."""
# OpenAI Codex: docs/ai-collaboration-prompts-iteration-2.md, issue #49.
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import SimpleTestCase
import numpy as np

from .services import presentation_measurements as measurements
from .services import presentation_score_v2 as core
from .services.feedback import FeedbackError
from .services.feedback_provider import ProviderConfig
from .test_presentation_score_v2 import make_bundle


class Issue49MeasurementsTests(SimpleTestCase):
    def measure(self, count=32000, spans=None, **overrides):
        args = dict(attempt_id='33333333-3333-4333-8333-333333333333', audio_hash='a'*64,
                    duration_ms=2000, text='Hello world', language='en')
        args.update(overrides)
        return measurements.measure_waveform(np.full(count, .1, dtype=np.float32),
            spans if spans is not None else [{'start': 0, 'end': count}], **args)

    def test_actual_issue49_sample_count_retains_original_capture_and_hash(self):
        result = self.measure(4335259, duration_ms=271073)
        self.assertEqual(result['status'], 'available')
        self.assertEqual(result['version'], 'presentation-measurements-v2')
        self.assertIsNone(result['reason'])
        self.assertEqual((result['duration_ms'], result['audio_hash']), (271073, 'a'*64))
        self.assertTrue(all(i['end_ms'] <= 270953 for i in result['items']))

    def test_shared_tolerance_is_inclusive_in_both_directions(self):
        for count in (16000, 48000):
            with self.subTest(count=count):
                self.assertEqual(self.measure(count)['status'], 'available')
        for count in (15999, 48001):
            with self.subTest(count=count):
                result = self.measure(count)
                self.assertEqual((result['status'], result['reason']), ('unavailable', 'audio_duration_mismatch'))
                self.assertEqual(result['items'], [])

    def test_codec_tail_is_clipped_from_all_intervals_and_signal_statistics(self):
        wave = np.concatenate((np.full(32000, .1), np.full(16000, .9)))
        result = measurements.measure_waveform(wave, [{'start': 0, 'end': 48000}],
            attempt_id='a', audio_hash='a'*64, duration_ms=2000, text='Hello world', language='en')
        self.assertEqual(result['status'], 'available')
        self.assertTrue(all(0 <= i['start_ms'] < i['end_ms'] <= 2000 for i in result['items']))
        self.assertEqual(next(i['value'] for i in result['items'] if i['kind']=='speech'), 2000)
        self.assertEqual(next(i['value'] for i in result['items'] if i['kind']=='signal_rms'), -20)
        self.assertEqual(next(i['value'] for i in result['items'] if i['kind']=='signal_variation'), 0)
        self.assertEqual(next(i['value'] for i in result['items'] if i['kind']=='rate'), 60)

    def test_short_audio_uses_common_window_but_original_rate_denominator(self):
        result = self.measure(16000)
        self.assertEqual(result['status'], 'available')
        self.assertTrue(all(i['end_ms'] <= 1000 for i in result['items']))
        self.assertEqual(next(i['value'] for i in result['items'] if i['kind']=='rate'), 60)
        self.assertEqual(result['duration_ms'], 2000)

    def test_clipped_speech_and_pause_values_use_the_common_window(self):
        result = self.measure(48000, [{'start': 0, 'end': 16000}, {'start': 24000, 'end': 40000},
                                      {'start': 40001, 'end': 48000}])
        self.assertEqual([(i['start_ms'], i['end_ms'], i['value']) for i in result['items'] if i['kind']=='speech'],
                         [(0, 1000, 1000), (1500, 2000, 500)])
        self.assertEqual([(i['start_ms'], i['end_ms'], i['value']) for i in result['items'] if i['kind']=='pause'],
                         [(1000, 1500, 500)])

    def test_tail_only_or_submillisecond_speech_does_not_create_empty_intervals(self):
        for spans in ([{'start': 32000, 'end': 48000}], [{'start': 1, 'end': 15}]):
            result = self.measure(48000, spans)
            self.assertEqual((result['status'], result['reason']), ('insufficient_evidence', 'insufficient_audio_evidence'))
            self.assertEqual(result['items'], [])

    def test_invalid_waveform_vad_and_silence_are_separate_from_duration_mismatch(self):
        cases = [(np.array([float('nan')]), [], 'audio_invalid'),
                 (np.ones((160, 2)), [], 'audio_invalid'),
                 (np.ones(32000), [{'start': 0, 'end': 32001}], 'audio_invalid'),
                 (np.ones(32000), [{'start': 100, 'end': 200}, {'start': 50, 'end': 90}], 'audio_invalid'),
                 (np.zeros(32000), [], 'insufficient_audio_evidence')]
        for wave, spans, reason in cases:
            result = measurements.measure_waveform(wave, spans, attempt_id='a', audio_hash='a'*64,
                duration_ms=2000, text='Hello', language='en')
            self.assertEqual(result['reason'], reason)
            self.assertEqual(result['items'], [])
        self.assertEqual(self.measure(duration_ms=True)['reason'], 'audio_invalid')
        from .services.speech_gate import MAX_SAMPLES
        oversized = np.ones(MAX_SAMPLES + 1, dtype=np.float32)
        result = measurements.measure_waveform(oversized, [], attempt_id='a', audio_hash='a'*64,
            duration_ms=1800000, text='Hello', language='en')
        self.assertEqual(result['reason'], 'audio_invalid')

    def test_read_decode_and_vad_failures_preserve_hash_when_readable(self):
        args = dict(attempt_id='a', duration_ms=2000, text='Hello', language='en')
        self.assertEqual(measurements.measure_audio('/missing/issue49.wav', **args)['reason'], 'audio_missing')
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.wav'; path.write_bytes(b'synthetic source')
            expected = hashlib.sha256(path.read_bytes()).hexdigest()
            with patch('rehearsals.services.speech_gate.decode_waveform', side_effect=ValueError('decode')):
                result = measurements.measure_audio(path, **args)
            self.assertEqual((result['reason'], result['audio_hash']), ('audio_decode_failed', expected))
            with patch('rehearsals.services.speech_gate.decode_waveform', return_value=np.ones(32000)), \
                 patch('rehearsals.services.speech_gate.load_gate', side_effect=RuntimeError('VAD')):
                result = measurements.measure_audio(path, **args)
            self.assertEqual((result['reason'], result['audio_hash']), ('audio_measurement_failed', expected))

    def test_v1_bundle_identity_and_serialization_remain_frozen(self):
        bundle = make_bundle()
        self.assertEqual(bundle.identity, '6a98bd3f7e25e1e520f7422556128ef210bdf69c4c5169db32ed4c5b129674df')
        self.assertEqual(bundle.eligibility['source_identity'], 'f4a67c41441e04358ba23fc444acc78f35f29bd4f62bd6a12930e05210ba8ed8')
        self.assertNotIn('reason', bundle.measurements)

    def test_new_protocol_bumps_only_measurement_identity(self):
        from .services import presentation_scoring as scoring
        self.assertEqual(scoring.prompt_digest(), 'bd44f68efa7b7f308962fb01e6f884ff7f051104fd848d251eb600f793337282')
        self.assertEqual(scoring.v1._digest(scoring.protocol()), '84eb8821468072046279ef18f15dc96865dc51f9be78a923596c9004364d1bed')

    def test_eligibility_supports_v2_without_changing_v1_coverage(self):
        from .test_presentation_eligibility import evidence
        from .services.presentation_eligibility import evaluate
        source = evidence()
        old = evaluate(**source)
        self.assertTrue(old['eligible'])
        source['measurements'].update(version='presentation-measurements-v2', reason=None)
        new = evaluate(**source)
        self.assertTrue(new['eligible'])
        self.assertNotEqual(new['source_identity'], old['source_identity'])
        self.assertEqual({k:v for k,v in new.items() if k!='source_identity'},
                         {k:v for k,v in old.items() if k!='source_identity'})
        for updates in ({'version': 'presentation-measurements-v3'}, {'reason': 'audio_invalid'}):
            source['measurements'].update(updates)
            self.assertFalse(evaluate(**source)['eligible'])

    def test_v2_model_dispatch_reasons_and_unknown_versions_fail_closed(self):
        historical = make_bundle().measurements
        current = {**historical, 'version': 'presentation-measurements-v2', 'reason': None}
        self.assertEqual(make_bundle(measurements=current).measurements, current)
        for reason in ('audio_missing', 'audio_decode_failed', 'audio_measurement_failed', 'audio_invalid',
                       'audio_duration_mismatch', 'insufficient_audio_evidence'):
            status = 'insufficient_evidence' if reason=='insufficient_audio_evidence' else 'unavailable'
            bundle = make_bundle(measurements={**current, 'status': status, 'reason': reason, 'items': []})
            with self.assertRaises(FeedbackError) as error:
                core.prepare(bundle, ProviderConfig('openrouter', 'openai/gpt-6-luna', 'synthetic'))
            self.assertEqual(error.exception.code, reason)
        for invalid in ({**current, 'version': 'presentation-measurements-v3'},
                        {**current, 'version': []},
                        {k:v for k,v in current.items() if k!='reason'},
                        {**current, 'reason': 'audio_invalid'}, {**historical, 'reason': None}):
            with self.assertRaises(FeedbackError):
                make_bundle(measurements=invalid)
