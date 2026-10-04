import json
import tempfile
from datetime import timedelta
from unittest.mock import patch
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Attempt, Deck, Slide, Generation, ProviderRequest
from .tasks import process_attempt
from .services.feedback import analyze_attempt, validate_feedback, speech_segments
from .services.gemini import AIStageError, generate, next_day

DESCRIPTIONS = [{"slide_index": 0, "summary": "Local speech recognition", "key_ideas": ["Save before analysis"], "visual_facts": ["A chart shows a local worker"], "uncertainty": "Chart numbers are unreadable"}]
SUGGESTION = {"slide_index": 0, "segment_id": "v0s0", "speech_evidence": "Hello", "slide_evidence": "Save before analysis", "observation": "The local save step is unclear.", "suggestion": "Explain that audio is saved before processing."}


@override_settings(GEMINI_ENABLED=True, GEMINI_FREE_TIER_CONFIRMED=True, GEMINI_PROJECT_ID="test-project", GEMINI_API_KEY="test-not-a-key", GEMINI_RPM=1000, GEMINI_TPM=1000000, GEMINI_RPD=1000)
class FeedbackTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name)
        setting.enable(); self.addCleanup(setting.disable)
        self.deck = Deck.objects.create(title="Demo", pdf="a.pdf", page_count=1, content_hash="abc")
        slide = Slide(deck=self.deck, slide_index=0)
        slide.image.save("a.png", ContentFile(b"synthetic image, transport mocked"))
        self.attempt = self.new_attempt("one")
        self.post = patch("rehearsals.services.gemini.httpx.post").start()
        self.addCleanup(patch.stopall)
        self.post.side_effect = self.provider

    def new_attempt(self, audience):
        words = [{"text": "Hello", "start_ms": 0, "end_ms": 600}]
        return Attempt.objects.create(deck=self.deck, audio="local.wav", duration_ms=1000,
            slide_events=[{"slide_index": 0, "at_ms": 0}], audience=audience,
            transcript={"text": "Hello", "words": words}, transcription_meta={"language": "en"},
            transcription_state="complete", visits=[{"slide_index": 0, "start_ms": 0, "end_ms": 1000, "words": words}], metrics={"duration_ms": 1000})

    def provider(self, url, **kwargs):
        import httpx
        if url.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 250})
        prompt = kwargs["json"]["systemInstruction"]["parts"][0]["text"]
        result = {"slides": DESCRIPTIONS} if "Analyze slides" in prompt else {"suggestions": [SUGGESTION]}
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(result)}]}}], "usageMetadata": {"promptTokenCount": 250, "candidatesTokenCount": 60, "totalTokenCount": 310}})

    def test_ten_rehearsals_use_eleven_generations_and_reads_use_none(self):
        for i in range(10):
            attempt = self.new_attempt(str(i))
            feedback = analyze_attempt(attempt)
            self.assertEqual(feedback[0]["start_ms"], 0)
            self.assertEqual(feedback[0]["end_ms"], 600)
        self.assertEqual(ProviderRequest.objects.filter(operation="generateContent").count(), 11)
        analyze_attempt(attempt)
        count = self.post.call_count
        for _ in range(3): APIClient().get(f"/api/attempts/{attempt.id}/")
        self.assertEqual(self.post.call_count, count)
        self.assertEqual(Generation.objects.filter(kind="deck").count(), 1)
        for call in self.post.call_args_list:
            if call.args[0].endswith(":generateContent") and "Give at most" in call.kwargs["json"]["systemInstruction"]["parts"][0]["text"]:
                body = call.kwargs["json"]
                self.assertEqual(body["generationConfig"]["maxOutputTokens"], 1500)
                self.assertNotIn("start_ms", json.dumps(body["contents"]))
                self.assertNotIn("inlineData", json.dumps(body["contents"]))

    def test_invalid_evidence_is_not_displayed(self):
        segments = speech_segments(self.attempt.visits)
        for invalid in [{**SUGGESTION, "slide_index": 1}, {**SUGGESTION, "segment_id": "made-up"}, {**SUGGESTION, "speech_evidence": "not spoken"}, {**SUGGESTION, "slide_evidence": "invented chart value"}]:
            self.assertEqual(validate_feedback({"suggestions": [invalid]}, segments, DESCRIPTIONS, 1000), [])

    def test_edit_uses_revision_and_invalidates_old_feedback(self):
        process_attempt(str(self.attempt.id))
        self.deck.refresh_from_db()
        client = APIClient()
        url = f"/api/decks/{self.deck.id}/descriptions/"
        self.assertEqual(client.patch(url, {"revision": 0, "slides": DESCRIPTIONS}, format="json").status_code, 409)
        self.assertEqual(client.patch(url, {"revision": 1, "slides": DESCRIPTIONS}, format="json").status_code, 200)
        result = client.get(f"/api/attempts/{self.attempt.id}/").data
        self.assertTrue(result["feedback_stale"])
        self.assertEqual(result["feedback"], [])
        count = self.post.call_count
        client.get(url)
        self.assertEqual(self.post.call_count, count)

    def test_oversize_never_generates_or_truncates(self):
        import httpx
        self.post.side_effect = lambda *a, **k: httpx.Response(200, json={"totalTokens": 20001})
        with self.assertRaises(AIStageError) as error: analyze_attempt(self.attempt)
        self.assertEqual(error.exception.code, "input_limit")
        self.assertEqual(ProviderRequest.objects.filter(operation="generateContent").count(), 0)

    def test_timeout_is_unknown_and_not_automatically_retried(self):
        import httpx
        original = self.provider
        def timeout(url, **kwargs):
            if url.endswith(":generateContent"): raise httpx.ReadTimeout("private")
            return original(url, **kwargs)
        self.post.side_effect = timeout
        for _ in range(2):
            with self.assertRaises(AIStageError) as error: analyze_attempt(self.attempt)
            self.assertEqual(error.exception.code, "unknown_outcome")
        self.assertEqual(ProviderRequest.objects.filter(operation="generateContent").count(), 1)

    def test_quota_keeps_transcript_and_waits_without_new_requests(self):
        import httpx
        self.post.side_effect = lambda *a, **k: httpx.Response(429, json={"error": "quota per_day"})
        process_attempt(str(self.attempt.id))
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.feedback_state, "waiting_quota")
        self.assertIsNotNone(self.attempt.transcript)
        count = self.post.call_count
        process_attempt(str(self.attempt.id))
        self.assertEqual(self.post.call_count, count)
        self.assertGreater(self.attempt.next_retry_at, timezone.now())

    @override_settings(GEMINI_RPM=1)
    def test_shared_limiter_defers_generation_after_count_request(self):
        with self.assertRaises(AIStageError) as error: analyze_attempt(self.attempt)
        self.assertEqual(error.exception.code, "waiting_quota")
        self.assertEqual(self.post.call_count, 1)
        self.assertEqual(ProviderRequest.objects.count(), 1)

    def test_disabled_never_calls_provider(self):
        with override_settings(GEMINI_FREE_TIER_CONFIRMED=False):
            process_attempt(str(self.attempt.id))
        self.post.assert_not_called()
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.feedback_state, "disabled")

    def test_failed_regeneration_never_relabels_old_evidence(self):
        import httpx
        process_attempt(str(self.attempt.id))
        self.deck.refresh_from_db()
        self.deck.description_revision += 1
        self.deck.save()
        self.attempt.refresh_from_db()
        self.attempt.status = "pending"
        self.attempt.save()
        self.post.side_effect = lambda *a, **k: httpx.Response(429, json={"error": "quota"})
        process_attempt(str(self.attempt.id))
        result = APIClient().get(f"/api/attempts/{self.attempt.id}/").data
        self.assertTrue(result["feedback_stale"])
        self.assertEqual(result["feedback"], [])
        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.feedback_revision, 1)

    def test_project_429_stops_other_decks_too(self):
        import httpx
        self.post.side_effect = lambda *a, **k: httpx.Response(429, json={"error": "per_day quota"})
        with self.assertRaises(AIStageError): analyze_attempt(self.attempt)
        self.deck.content_hash = "other-deck"
        self.deck.save()
        with self.assertRaises(AIStageError): analyze_attempt(self.new_attempt("other"))
        self.assertEqual(self.post.call_count, 1)

    def test_prompt_version_regenerates_generated_but_preserves_edited_descriptions(self):
        analyze_attempt(self.attempt)
        with patch("rehearsals.services.feedback.DECK_PROMPT_VERSION", "deck-v2"):
            analyze_attempt(self.new_attempt("two"))
        self.deck.refresh_from_db()
        self.assertEqual(self.deck.description_revision, 2)
        self.assertEqual(Generation.objects.filter(kind="deck").count(), 2)
        self.deck.descriptions_edited = True
        self.deck.save()
        with patch("rehearsals.services.feedback.DECK_PROMPT_VERSION", "deck-v3"):
            analyze_attempt(self.new_attempt("three"))
        self.assertEqual(Generation.objects.filter(kind="deck").count(), 2)
