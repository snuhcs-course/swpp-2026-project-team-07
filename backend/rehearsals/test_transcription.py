from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import httpx
from openai import OpenAI
from .services.alignment import align_words
from .services.transcription import MAX_AUDIO_BYTES, TranscriptionError, transcribe, _normalize


class TranscriptionTests(TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "sample.wav"
        self.path.write_bytes(b"synthetic mocked audio")
        self.raw = {"text": " Hello, world!", "language": "english", "duration": 2.0,
                    "words": [{"word": "Hello,", "start": 0.0005, "end": 0.9995},
                              {"word": "world!", "start": 1.0, "end": 2.0}]}
        env = patch.dict("os.environ", {"OPENAI_API_KEY": "test-only-key", "ALLOW_HOSTED_TRANSCRIPTION": "1"})
        env.start()
        self.addCleanup(env.stop)

    def request(self, status=200, failure=None):
        self.calls = []
        def handler(request):
            self.calls.append(request)
            if failure:
                raise failure("private provider detail", request=request)
            return httpx.Response(status, json=self.raw)
        def client(**kwargs):
            self.assertEqual(kwargs["max_retries"], 0)
            self.assertEqual(kwargs["timeout"], 120.0)
            return OpenAI(**kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handler)))
        with patch("rehearsals.services.transcription.OpenAI", side_effect=client):
            return transcribe(self.path)

    def test_sdk_request_normalization_and_alignment(self):
        result = self.request()
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(str(self.calls[0].url), "https://api.openai.com/v1/audio/transcriptions")
        for value in [b'whisper-1', b'verbose_json', b'timestamp_granularities[]',
                      b'word', b'filename="sample.wav"', self.path.read_bytes()]:
            self.assertIn(value, self.calls[0].content)
        self.assertEqual(result["text"], self.raw["text"])
        self.assertEqual(result["raw_response"]["words"], self.raw["words"])
        self.assertEqual(result["raw_response"]["language"], "english")
        self.assertEqual(result["words"], [
            {"text": "Hello,", "start_ms": 1, "end_ms": 1000},
            {"text": "world!", "start_ms": 1000, "end_ms": 2000}])
        visits = align_words(result["words"], [
            {"slide_index": 0, "at_ms": 0}, {"slide_index": 1, "at_ms": 1000}], 2000)
        self.assertEqual([v["words"][0]["text"] for v in visits], ["Hello,", "world!"])

    def test_silence(self):
        self.raw = {"text": "", "words": []}
        self.assertEqual(self.request()["words"], [])

    def test_invalid_normalized_responses(self):
        bad = [{"text": "speech"}, {"text": "speech", "words": []}, {"text": 42, "words": []}]
        for field, value in [("start", -1), ("start", 3), ("start", "0"),
                             ("end", None), ("start", True), ("word", None),
                             ("start", float("nan")), ("end", float("inf"))]:
            raw = deepcopy(self.raw)
            raw["words"][0][field] = value
            bad.append(raw)
        for raw in bad:
            with self.subTest(raw=raw), self.assertRaises(TranscriptionError):
                _normalize(raw)

    def test_non_object_provider_response_is_a_safe_error(self):
        original = self.path.read_bytes()
        for payload in [[], None, "bad", 1]:
            self.raw = payload
            with self.subTest(payload=payload), self.assertRaises(TranscriptionError) as caught:
                self.request()
            self.assertEqual(caught.exception.code, "invalid_response")
            self.assertEqual(len(self.calls), 1)
            self.assertEqual(self.path.read_bytes(), original)

    def test_missing_provider_words(self):
        self.raw = {"text": "speech"}
        with self.assertRaises(TranscriptionError) as caught:
            self.request()
        self.assertEqual(caught.exception.code, "invalid_response")

    def test_http_failures_no_retry_and_preserved_audio(self):
        original = self.path.read_bytes()
        self.raw = {"error": {"message": "private provider detail"}}
        for status, code in [(401, "provider_auth"), (403, "provider_auth"),
                             (429, "provider_rate_limit"), (500, "provider_error")]:
            with self.subTest(status=status), self.assertRaises(TranscriptionError) as caught:
                self.request(status=status)
            self.assertEqual(caught.exception.code, code)
            self.assertNotIn("private", str(caught.exception))
            self.assertEqual(len(self.calls), 1)
            self.assertEqual(self.path.read_bytes(), original)

    def test_network_failures(self):
        for failure, code in [(httpx.ReadTimeout, "provider_timeout"),
                              (httpx.ConnectError, "provider_connection")]:
            with self.subTest(code=code), self.assertRaises(TranscriptionError) as caught:
                self.request(failure=failure)
            self.assertEqual(caught.exception.code, code)
            self.assertEqual(len(self.calls), 1)

    def test_missing_key(self):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}), \
             patch("rehearsals.services.transcription.OpenAI") as client:
            with self.assertRaises(TranscriptionError) as caught:
                transcribe(self.path)
            self.assertEqual(caught.exception.code, "missing_api_key")
            client.assert_not_called()

    def test_invalid_files_before_network(self):
        with patch("rehearsals.services.transcription.OpenAI") as client:
            for path, code in [(self.path.with_suffix(".txt"), "unsupported_audio"),
                               (self.path.with_name("missing.wav"), "audio_unavailable")]:
                with self.assertRaises(TranscriptionError) as caught:
                    transcribe(path)
                self.assertEqual(caught.exception.code, code)
            for size in [0, MAX_AUDIO_BYTES + 1]:
                with self.path.open("wb") as audio:
                    audio.truncate(size)
                with self.assertRaises(TranscriptionError) as caught:
                    transcribe(self.path)
                self.assertEqual(caught.exception.code, "invalid_audio_size")
            client.assert_not_called()
