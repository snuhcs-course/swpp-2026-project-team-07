"""Generated silence only. Model-backed quiet/short speech needs approved fixtures."""
import importlib.util
import tempfile
from pathlib import Path
from unittest import TestCase, skipUnless
from unittest.mock import patch
from .test_storage import audio_file
from .services.speech_gate import has_speech, decode_waveform, load_gate
from .services.transcription import TranscriptionError


class SpeechGateTests(TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.path = Path(tmp.name) / 'synthetic.wav'
        self.path.write_bytes(audio_file().read())

    def test_pyav_decoding_and_presence_policy_preserve_original_bytes(self):
        original = self.path.read_bytes()
        waveform = decode_waveform(self.path)
        self.assertEqual(len(waveform), 32000)
        self.assertEqual(max(abs(value) for value in waveform), 0)
        for detected in [[], [{'start': 160, 'end': 1920}]]:
            def detect(audio, model, **options):
                self.assertEqual(len(audio), 32000)
                self.assertEqual(options['sampling_rate'], 16000)
                self.assertEqual(options['min_speech_duration_ms'], 100)
                return detected
            with patch('rehearsals.services.speech_gate.load_gate', return_value=(object(), detect)):
                self.assertEqual(has_speech(self.path), bool(detected))
        self.assertEqual(self.path.read_bytes(), original)

    def test_decode_or_packaged_model_failure_fails_closed(self):
        with patch('rehearsals.services.speech_gate.load_gate', side_effect=ImportError('missing model')):
            with self.assertRaises(TranscriptionError) as caught:
                has_speech(self.path)
        self.assertEqual(caught.exception.code, 'audio_check_failed')
        self.path.write_bytes(b'not audio')
        with self.assertRaises(TranscriptionError):
            has_speech(self.path)

    @skipUnless(all(importlib.util.find_spec(name) for name in ('silero_vad', 'torch', 'onnxruntime')), 'Packaged VAD dependencies require coordinator setup')
    def test_packaged_model_detects_generated_silence_without_network(self):
        # Exercise a fresh packaged-model load, not a cached model from another test.
        load_gate.cache_clear()
        self.addCleanup(load_gate.cache_clear)
        with patch('socket.socket.connect', side_effect=AssertionError('Runtime network forbidden')), \
             patch('torch.jit.script', side_effect=AssertionError('JIT compilation forbidden')), \
             patch('torch.jit.load', side_effect=AssertionError('JIT model loading forbidden')), \
             patch('torch.export.load', side_effect=AssertionError('PT2 loading forbidden')), \
             patch('torch.load', side_effect=AssertionError('Pickle loading forbidden')):
            self.assertFalse(has_speech(self.path))
            model, _ = load_gate()
            self.assertEqual(model.session.get_providers(), ['CPUExecutionProvider'])
