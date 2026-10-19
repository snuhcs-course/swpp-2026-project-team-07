"""Phase 3 boundaries: real decoding, synthetic silence, no provider calls."""
import json
import uuid
import tempfile
import wave
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from . import test_storage
from .serializers import AttemptMetadataSerializer
from .services.speech_gate import decode_waveform, SAMPLE_RATE


def synthetic_silence(seconds):
    # 8 kHz PCM stays below the unchanged byte cap without faking the decoder.
    out = BytesIO()
    with wave.open(out, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(1)
        audio.setframerate(8000)
        audio.writeframes(b'\x80' * 8000 * seconds)
    return out.getvalue()


class LongRecordingTests(TestCase):
    setUp = test_storage.UploadTests.setUp
    deck = test_storage.UploadTests.deck
    def test_thirty_minute_metadata_and_decoding_preserve_identity_and_visits(self):
        deck = self.deck()['deck']
        metadata = {'id': str(uuid.uuid4()), 'deck_id': deck['id'], 'duration_ms': 1800000,
                    'slide_events': [{'slide_index': 0, 'at_ms': 0}, {'slide_index': 1, 'at_ms': 600001},
                                     {'slide_index': 0, 'at_ms': 1799999}]}
        data = synthetic_silence(1800)
        def upload():
            return self.client.post('/api/attempts/', {'metadata': json.dumps(metadata),
                'audio': SimpleUploadedFile('synthetic-30-minute-silence.wav', data, 'audio/wav')})
        with patch('rehearsals.tasks.process_attempt.delay') as provider_work:
            first, retry = upload(), upload()
            self.assertEqual(first.status_code, 201, first.data)
            self.assertEqual(retry.status_code, 201, retry.data)
            self.assertEqual(first.data['attempt_id'], retry.data['attempt_id'])
            provider_work.assert_not_called()
        result = self.client.get(f"/api/attempts/{metadata['id']}/").data
        self.assertEqual(result['duration_ms'], 1800000)
        self.assertEqual(result['slide_events'], metadata['slide_events'])

    def test_metadata_rejects_over_thirty_minutes_and_events_at_end(self):
        base = {'id': str(uuid.uuid4()), 'deck_id': str(uuid.uuid4()), 'duration_ms': 1800000,
                'slide_events': [{'slide_index': 0, 'at_ms': 0}]}
        self.assertTrue(AttemptMetadataSerializer(data=base).is_valid())
        self.assertFalse(AttemptMetadataSerializer(data={**base, 'duration_ms': 1800001}).is_valid())
        self.assertFalse(AttemptMetadataSerializer(data={**base, 'slide_events': [
            *base['slide_events'], {'slide_index': 0, 'at_ms': 1800000}]}).is_valid())

    def test_speech_gate_accepts_thirty_minutes_and_codec_tail_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic-silence.wav'
            path.write_bytes(synthetic_silence(1801))
            self.assertEqual(len(decode_waveform(path)), 1801 * SAMPLE_RATE)
            path.write_bytes(synthetic_silence(1802))
            with self.assertRaisesRegex(ValueError, 'exceeds limit'):
                decode_waveform(path)
