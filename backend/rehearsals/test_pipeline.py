from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Attempt, Deck
from .tasks import process_attempt, recover_work
from .services.local_transcription import transcribe_local
from .services.metrics import timing_metrics

OUTPUT = {"text": "Hello 안녕하세요", "words": [{"text": "Hello", "start_ms": 100, "end_ms": 600}, {"text": " 안녕하세요", "start_ms": 1100, "end_ms": 1700}], "metadata": {"engine": "faster-whisper", "model": "small", "language": "ko"}, "raw_response": {"private": True}}


class LocalAdapterTests(SimpleTestCase):
    @patch("rehearsals.services.local_transcription.load_model")
    def test_word_times_and_silence_are_preserved(self, load):
        model = Mock()
        model.transcribe.return_value = (iter([SimpleNamespace(text=" Hello", words=[SimpleNamespace(word=" Hello", start=2.1, end=2.8)])]), SimpleNamespace(language="en", language_probability=.9))
        load.return_value = (model, {"model": "small"})
        result = transcribe_local(Path("local.wav"))
        self.assertEqual(result["words"][0]["start_ms"], 2100)
        self.assertFalse(model.transcribe.call_args.kwargs["vad_filter"])
        self.assertTrue(model.transcribe.call_args.kwargs["word_timestamps"])
        self.assertTrue(model.transcribe.call_args.kwargs["multilingual"])
        self.assertEqual(model.transcribe.call_args.kwargs["chunk_length"], 10)

    def test_rates_are_labelled_and_visits_sum_without_llm(self):
        metrics = timing_metrics([{"slide_index": 1, "start_ms": 0, "end_ms": 1000}, {"slide_index": 0, "start_ms": 1000, "end_ms": 3000}, {"slide_index": 1, "start_ms": 3000, "end_ms": 4000}], 4000, "Hello 안녕하세요", "ko")
        self.assertEqual(metrics["time_per_slide"], [{"slide_index": 0, "duration_ms": 2000}, {"slide_index": 1, "duration_ms": 2000}])
        self.assertEqual([r["language"] for r in metrics["speaking_rates"]], ["en", "ko"])


class PipelineTests(TestCase):
    def setUp(self):
        deck = Deck.objects.create(title="Demo", pdf="x.pdf", page_count=2)
        self.attempt = Attempt.objects.create(deck=deck, audio="a.wav", duration_ms=2000, slide_events=[{"slide_index": 1, "at_ms": 0}, {"slide_index": 0, "at_ms": 1000}], queued_at=timezone.now())

    @patch("rehearsals.tasks.transcribe_local", return_value=OUTPUT)
    @patch("rehearsals.services.transcription.OpenAI")
    def test_persisted_result_is_reused_on_redelivery_and_reads(self, hosted, transcribe):
        process_attempt(str(self.attempt.id))
        process_attempt(str(self.attempt.id))
        client = APIClient()
        for _ in range(3):
            result = client.get(f"/api/attempts/{self.attempt.id}/").data
            self.assertEqual(result["stages"], {"transcription": "complete", "feedback": "disabled"})
            self.assertEqual(result["visits"][1]["words"][0]["start_ms"], 1100)
            self.assertNotIn("raw_response", result["transcription_model"])
        self.assertEqual(transcribe.call_count, 1)
        hosted.assert_not_called()

    @patch("rehearsals.tasks.transcribe_local", side_effect=RuntimeError("private"))
    def test_failure_keeps_audio_and_retry_queues_same_id(self, transcribe):
        process_attempt(str(self.attempt.id))
        process_attempt(str(self.attempt.id))
        self.assertEqual(transcribe.call_count, 1)
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, "failed")
        self.assertEqual(self.attempt.audio.name, "a.wav")
        self.assertNotIn("private", self.attempt.error["message"])
        with patch("rehearsals.tasks.process_attempt.delay") as queued, self.captureOnCommitCallbacks(execute=True):
            response = APIClient().post(f"/api/attempts/{self.attempt.id}/process/")
            self.assertEqual(response.status_code, 202)
        queued.assert_called_once_with(str(self.attempt.id))

    @patch("rehearsals.tasks.process_attempt.delay")
    def test_worker_recovery_queues_expired_work_but_not_live_work(self, queue):
        self.attempt.status = "processing"
        self.attempt.transcription_state = "running"
        self.attempt.processing_started_at = timezone.now()
        self.attempt.save()
        recover_work()
        queue.assert_not_called()
        self.attempt.processing_started_at -= timedelta(seconds=2000)
        self.attempt.save()
        recover_work()
        queue.assert_called_once_with(str(self.attempt.id))

    @patch("rehearsals.tasks.transcribe_local", return_value=OUTPUT)
    @patch("rehearsals.tasks.finish_feedback", side_effect=RuntimeError("feedback unavailable"))
    def test_transcript_commits_before_feedback(self, feedback, transcribe):
        with self.assertRaises(RuntimeError):
            process_attempt(str(self.attempt.id))
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.transcript["text"], OUTPUT["text"])
        self.assertEqual(self.attempt.transcription_state, "complete")

    @patch("rehearsals.tasks.transcribe_local")
    def test_codec_tail_keeps_original_word_time(self, transcribe):
        from copy import deepcopy
        output = deepcopy(OUTPUT)
        output["words"][-1]["end_ms"] = 2020
        transcribe.return_value = output
        process_attempt(str(self.attempt.id))
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, "completed")
        self.assertEqual(self.attempt.transcript["words"][-1]["end_ms"], 2020)
        self.assertEqual(self.attempt.visits[-1]["end_ms"], 2020)

    @patch("rehearsals.tasks.transcribe_local")
    def test_alignment_failure_preserves_transcript_for_retry(self, transcribe):
        from copy import deepcopy
        output = deepcopy(OUTPUT)
        output["words"][-1]["end_ms"] = 5000
        transcribe.return_value = output
        process_attempt(str(self.attempt.id))
        self.attempt.refresh_from_db()
        self.assertIsNotNone(self.attempt.transcript)
        self.assertEqual(self.attempt.error["code"], "alignment_failed")
        self.attempt.status = "pending"
        self.attempt.save()
        process_attempt(str(self.attempt.id))
        self.assertEqual(transcribe.call_count, 1)
