"""Store isolation checks with invented recordings and the app's bundled Seoul example."""
import hashlib
import json
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import JsonResponse
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (Attempt, Deck, DescriptionJob, DescriptionSet, DisplayTranslation, FeedbackAnalysis,
                     FeedbackJob, FeedbackRequest, FeedbackRun, Installation, PreparedDisplayResource,
                     PresentationContext, QaAnswer)
from .ownership import current_installation_id, installation_scope
from .services import localization, prepared_display
from .test_storage import audio_file, pdf_file


def unregistered(request):
    return JsonResponse({"unexpected": True})


urlpatterns = [path("api/", include("rehearsals.urls")), path("unregistered/", unregistered)]


@override_settings(OUTLOUD_PUBLIC_SERVICE=True, MEDIA_URL="/store/media/", ROOT_URLCONF=__name__,
                   CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                                       "LOCATION": "public-installation-tests"}})
class PublicInstallationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        self.enterContext(override_settings(MEDIA_ROOT=self.media.name))
        self.a, self.a_owner = self.enroll()
        self.b, self.b_owner = self.enroll()
        self.a_deck = Deck.objects.create(installation=self.a_owner, title="First private deck", page_count=1)
        self.b_deck = Deck.objects.create(installation=self.b_owner, title="Second private deck", page_count=1)
        self.a_attempt = Attempt.objects.create(deck=self.a_deck, duration_ms=1000)
        self.b_attempt = Attempt.objects.create(deck=self.b_deck, duration_ms=1000)

    def enroll(self):
        client = APIClient()
        response = client.post("/api/installations/")
        self.assertEqual(response.status_code, 201, response.content)
        token = response.json()["token"]
        self.assertIn("no-store", response["Cache-Control"])
        client.credentials(HTTP_AUTHORIZATION="Bearer " + token)
        install = Installation.objects.get(token_hash=hashlib.sha256(token.encode()).hexdigest())
        self.assertNotEqual(install.token_hash, token)
        return client, install

    def test_missing_invalid_and_unknown_routes_and_inactivity(self):
        anonymous = APIClient()
        for auth in ("", "Basic fixture", "Bearer " + "x" * 43, "Bearer bad"):
            anonymous.credentials(HTTP_AUTHORIZATION=auth)
            for path in ("/api/ready/", "/api/decks/", "/api/incremental/capabilities/", "/media/guess", "/unregistered/"):
                with self.subTest(auth=bool(auth), path=path):
                    response = anonymous.get(path)
                    self.assertEqual(response.status_code, 401)
                    self.assertEqual(response["WWW-Authenticate"], "Bearer")
        self.assertEqual(anonymous.get("/api/health/").status_code, 200)
        self.assertEqual(anonymous.get("/api/installations/").status_code, 405)
        self.assertEqual(self.a.get("/unregistered/").status_code, 404)
        self.assertEqual(self.a.get("/api/missing/").status_code, 404)
        self.assertEqual(self.a.get("/__store_media/guess").status_code, 404)
        before = timezone.now() - timedelta(days=2)
        Installation.objects.update(last_seen=before)
        self.assertEqual(self.a.get("/api/incremental/capabilities/").status_code, 200)
        self.a_owner.refresh_from_db()
        self.b_owner.refresh_from_db()
        self.assertGreater(self.a_owner.last_seen, before)
        self.assertEqual(self.b_owner.last_seen, before)
        expired = timezone.now() - timedelta(days=30, seconds=1)
        Installation.objects.filter(pk=self.a_owner.pk).update(last_seen=expired)
        self.assertEqual(self.a.get("/api/incremental/capabilities/").status_code, 401)
        self.a_owner.refresh_from_db()
        self.assertEqual(self.a_owner.last_seen, expired)
        self.assertIsNone(current_installation_id())

    def test_enrollment_limits_mints_and_fails_closed_when_limiter_is_down(self):
        with patch("rehearsals.public_access.ENROLLMENTS_PER_HOUR", 2):
            response = APIClient().post("/api/installations/")
            self.assertEqual(response.status_code, 429)
            self.assertGreater(int(response["Retry-After"]), 0)
            self.assertEqual(Installation.objects.count(), 2)
        with patch("rehearsals.public_access.cache.add", side_effect=ConnectionError):
            self.assertEqual(APIClient().post("/api/installations/").status_code, 503)
        self.assertEqual(Installation.objects.count(), 2)

    def test_public_pdf_limits_and_shared_disk_headroom(self):
        url = '/api/decks/'
        before = Deck.objects.count()
        with patch('pypdfium2.PdfPage.render', side_effect=AssertionError('oversized deck rendered')):
            too_long = self.a.post(url, {'file': pdf_file(101), 'title': 'Lecture'})
        self.assertEqual(too_long.status_code, 400)
        self.assertIn('100 PDF pages', str(too_long.data))
        with patch('rehearsals.services.pdf.PUBLIC_MAX_PREPARED_BYTES', 1):
            too_large = self.a.post(url, {'file': pdf_file(2), 'title': 'Lecture'})
        self.assertEqual(too_large.status_code, 400)
        self.assertIn('prepared slides', str(too_large.data))
        with patch('rehearsals.services.storage.disk_usage') as usage:
            usage.return_value.free = 5 * 1024**3
            full = self.a.post(url, {'file': pdf_file(1), 'title': 'Lecture'})
        self.assertEqual(full.status_code, 507)
        self.assertEqual(Deck.objects.count(), before)
        self.assertFalse(any(Path(self.media.name).rglob('*.pdf')))

    def test_write_allowance_is_per_installation_and_resets_at_the_next_utc_hour(self):
        collection = "/api/presentation-contexts/"
        context = uuid.uuid4()
        payload = {"id": str(context), "deck_id": str(self.a_deck.pk)}
        other = {"id": str(uuid.uuid4()), "deck_id": str(self.b_deck.pk)}
        url = f"{collection}{context}/"
        # 17 seconds into an exact UTC-hour window.
        with patch("rehearsals.public_access.time.time", return_value=1_800_000_017) as clock:
            self.assertEqual(self.a.post(collection, payload, format="json").status_code, 201)
            for _ in range(239):
                self.assertEqual(self.a.post(collection, payload, format="json").status_code, 200)
            work = self.a.post(f"/api/attempts/{self.a_attempt.pk}/process/", {}, format="json")
            self.assertEqual(work.status_code, 429)
            self.assertEqual(work.json()["error"]["code"], "installation_write_rate_limited")
            self.assertEqual(work["Retry-After"], "3583")
            self.a_attempt.refresh_from_db()
            self.assertEqual(self.a_attempt.processing_revision, 0)
            self.assertEqual(self.a.patch(url, {}, format="json").status_code, 429)
            self.assertEqual(self.a.get(url).status_code, 200)
            self.assertEqual(self.b.post(collection, other, format="json").status_code, 201)
            clock.return_value += 3582
            self.assertEqual(self.a.post(collection, payload, format="json")["Retry-After"], "1")
            clock.return_value += 1
            self.assertEqual(self.a.post(collection, payload, format="json").status_code, 200)

    def test_write_limiter_failure_prevents_work_and_preserves_status_reads(self):
        context = PresentationContext.objects.create(deck=self.a_deck, audience="Original")
        url = f"/api/presentation-contexts/{context.pk}/"
        payload = {"expected_revision": 0, "required_duration_seconds": 300, "audience": "Updated"}
        with patch("rehearsals.public_access.cache.incr", side_effect=ConnectionError):
            response = self.a.patch(url, payload, format="json")
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()["error"]["code"], "installation_write_unavailable")
            self.assertEqual(response["Retry-After"], "60")
            self.assertEqual(self.a.get(url).json()["audience"], "Original")
        self.assertEqual(self.a.patch(url, payload, format="json").json()["audience"], "Updated")

    def test_same_bundled_pdf_and_authorized_media(self):
        pdf = (Path(__file__).resolve().parents[2] / "mobile/assets/demo/Seoul.pdf").read_bytes()

        def upload(client, title):
            file = SimpleUploadedFile("Seoul.pdf", pdf, "application/pdf")
            response = client.post("/api/decks/", {"file": file, "title": title}, format="multipart")
            self.assertEqual(response.status_code, 201, response.content)
            return response.json()

        with patch("rehearsals.services.slide_profiles.after_upload"):
            first = upload(self.a, "First Seoul")
            self.assertEqual(upload(self.a, "First duplicate")["deck"]["id"], first["deck"]["id"])
            second = upload(self.b, "Second Seoul")
        self.assertNotEqual(first["deck"]["id"], second["deck"]["id"])
        self.assertEqual(second["deck"]["title"], "Second Seoul")
        self.assertEqual(len(first["slides"]), len(second["slides"]))
        self.assertGreater(len(first["slides"]), 0)
        for url in (first["deck"]["pdf_url"], first["slides"][0]["image_url"]):
            external = urlsplit(url).path
            self.assertTrue(external.startswith(f"/store/media/i/{self.a_owner.pk}/"))
            inward = external.removeprefix("/store")
            for method, headers in (("get", {}), ("head", {}), ("get", {"HTTP_RANGE": "bytes=0-15"})):
                permitted = getattr(self.a, method)(inward, **headers)
                self.assertEqual(permitted.status_code, 200)
                self.assertEqual(permitted["X-Accel-Redirect"], inward.replace("/media/", "/__store_media/", 1))
                self.assertTrue(Path(self.media.name, inward.removeprefix("/media/")).is_file())
                denied = getattr(self.b, method)(inward, **headers)
                self.assertEqual(denied.status_code, 404)
                self.assertNotIn("X-Accel-Redirect", denied)
                self.assertEqual(getattr(APIClient(), method)(inward, **headers).status_code, 401)
            self.assertEqual(self.a.post(inward).status_code, 405)
        self.assertEqual(self.a.get(f"/media/i/{self.a_owner.pk}/segments/orphan.wav").status_code, 404)
        self.assertEqual(self.a.get(f"/media/i/{self.a_owner.pk}/decks/orphan.pdf").status_code, 404)

    def test_recording_upload_body_history_and_cross_install_uuid_collisions(self):
        def upload(client, deck_id, attempt_id):
            metadata = {"id": str(attempt_id), "deck_id": str(deck_id), "duration_ms": 1000,
                        "slide_events": [{"slide_index": 0, "at_ms": 0}]}
            return client.post("/api/attempts/", {"audio": audio_file(seconds=1), "metadata": json.dumps(metadata)})

        recording = uuid.uuid4()
        self.assertEqual(upload(self.a, self.a_deck.pk, recording).status_code, 201)
        own = self.a.get(f"/api/attempts/{recording}/").json()
        media = urlsplit(own["audio_url"]).path.removeprefix("/store")
        self.assertEqual(self.a.get(media, HTTP_RANGE="bytes=4-9").status_code, 200)
        self.assertEqual(self.b.get(media, HTTP_RANGE="bytes=4-9").status_code, 404)
        self.assertEqual(upload(self.b, self.a_deck.pk, uuid.uuid4()).status_code, 400)
        self.assertEqual(upload(self.b, self.b_deck.pk, recording).status_code, 409)
        self.assertEqual(self.b.get(f"/api/attempts/{recording}/").status_code, 404)
        self.assertEqual(self.b.get(f"/api/decks/{self.a_deck.pk}/attempts/").status_code, 404)
        own_history = self.b.get(f"/api/decks/{self.b_deck.pk}/attempts/").json()
        self.assertNotIn(str(recording), [row["attempt_id"] for row in own_history])
        self.assertEqual(Attempt.objects.get(pk=recording).deck_id, self.a_deck.pk)

    def test_path_and_body_ids_cannot_read_or_modify_another_installation(self):
        context = PresentationContext.objects.create(deck=self.a_deck, audience="First private audience")
        for endpoint in ("presentation-contexts/" + str(context.pk), f"decks/{self.a_deck.pk}/profiles",
                         f"decks/{self.a_deck.pk}/descriptions", f"attempts/{self.a_attempt.pk}/presentation-score",
                         f"attempts/{self.a_attempt.pk}/corrections", f"attempts/{self.a_attempt.pk}/feedback-run",
                         f"attempts/{self.a_attempt.pk}/audience-qa", f"attempts/{self.a_attempt.pk}/capture"):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.b.get(f"/api/{endpoint}/").status_code, 404)
                self.assertEqual(self.b.post(f"/api/{endpoint}/", {}, format="json").status_code, 404)
        def create(deck, ident):
            return self.b.post("/api/presentation-contexts/", {"id": str(ident), "deck_id": str(deck)}, format="json")
        self.assertEqual(create(self.a_deck.pk, uuid.uuid4()).status_code, 404)
        self.assertEqual(create(self.b_deck.pk, context.pk).status_code, 409)
        self.assertEqual(create(self.b_deck.pk, uuid.uuid4()).status_code, 201)
        context.refresh_from_db()
        self.assertEqual(context.audience, "First private audience")
        self.assertEqual(self.b.post(f"/api/attempts/{uuid.uuid4()}/capture/",
            {"deck_id": str(self.a_deck.pk)}, format="json").status_code, 400)
        hidden = self.b.post(f"/api/attempts/{uuid.uuid4()}/capture/",
            {"deck_id": str(self.b_deck.pk), "context_id": str(context.pk)}, format="json")
        self.assertEqual(hidden.status_code, 400)
        score = self.b.post(f"/api/attempts/{self.b_attempt.pk}/presentation-score/",
                            {"context_id": str(context.pk)}, format="json")
        self.assertEqual(score.status_code, 400)
        nested = {"scope": {"context_id": None, "slides": [{"slide_index": 0, "attempt_id": str(self.a_attempt.pk),
                   "segments": [{"start_ms": 0, "end_ms": 1000}]}]}}
        self.assertEqual(self.b.post(f"/api/attempts/{self.b_attempt.pk}/audience-qa/", nested, format="json").status_code, 400)
        manifest = {"deck_id": str(self.b_deck.pk), "duration_ms": 0, "stopped": False,
                    "slide_events": [{"slide_index": 0, "at_ms": 0}], "segments": []}
        capture = f"/api/attempts/{uuid.uuid4()}/capture/"
        with patch("rehearsals.services.incremental.enabled", return_value=True):
            self.assertEqual(self.b.post(capture, manifest, format="json").status_code, 200)
        self.assertEqual(self.b.get(capture).status_code, 200)
        self.assertEqual(self.a.get(capture).status_code, 404)

    def test_question_jobs_and_saved_source_prose_are_private(self):
        profiles = DescriptionSet.objects.create(deck=self.a_deck, source_snapshot={})
        job = FeedbackJob.objects.create(analysis=FeedbackAnalysis.objects.create(attempt=self.a_attempt,
            analysis_type="qa_fixture"), generation=1, description_set=profiles, description_generation=1,
            source_snapshot={}, state="completed", queued_at=timezone.now(),
            result={"questions": [{"id": "fixture", "question": "Why our first example?", "slide_index": 0}]})
        data = {"question_job_id": job.pk, "question_id": "fixture", "part": 0}
        self.assertEqual(self.b.post(f"/api/attempts/{self.b_attempt.pk}/qa-answer/", data, format="json").status_code, 404)
        self.assertFalse(QaAnswer.objects.exists())
        snapshot = {"kind": "questions", "resource_id": str(job.pk), "language": "ko",
                    "fields": {"q.0.question": "Why our first example?"}}
        with patch.object(localization, "_configuration"):
            own = self.a.post("/api/localization/", snapshot, format="json")
            self.assertEqual(own.status_code, 202)
            self.assertEqual(self.b.post("/api/localization/", snapshot, format="json").status_code, 409)
        self.assertEqual(self.b.get("/api/localization/" + own.json()["id"] + "/").status_code, 404)
        self.assertEqual(self.b.post("/api/localization/prepared/", {"kind": "questions", "resource_id": str(job.pk)},
                                     format="json").status_code, 409)
        self.assertFalse(PreparedDisplayResource.objects.exists())
        description_job = DescriptionJob.objects.create(description_set=profiles, generation=1,
                                                        description_revision=0, queued_at=timezone.now())
        receipt = {"generation": 1, "claim_token": uuid.uuid4(), "queued_at": timezone.now(),
                   "claimed_at": timezone.now(), "input_hash": "fixture"}
        FeedbackRequest.objects.create(job=description_job, stage="descriptions", **receipt)
        FeedbackRequest.objects.create(coaching_job=job, stage="coaching", **receipt)
        with installation_scope(self.a_owner.pk):
            self.assertEqual(FeedbackRequest.objects.count(), 2)
        with installation_scope(self.b_owner.pk):
            self.assertFalse(FeedbackRequest.objects.exists())

    def test_same_phone_archive_key_is_private_across_enrollments_and_worker_refresh(self):
        archive = {"kind": "legacy_qa", "resource_id": "phone-archive", "fields": {"q.0.question": "Why Seoul?"}}
        with patch.object(localization, "_configuration"):
            keys = []
            for client in (self.a, self.b):
                response = client.post("/api/localization/", {**archive, "language": "ko"}, format="json")
                self.assertEqual(response.status_code, 202)
                keys.append(response.json()["id"])
            self.assertNotEqual(*keys)
            self.assertEqual(self.b.get(f"/api/localization/{keys[0]}/").status_code, 404)
            self.assertEqual(self.a.post("/api/localization/prepared/", archive, format="json").status_code, 202)
            url = "/api/localization/prepared/legacy_qa/phone-archive/"
            self.assertEqual(self.b.get(url).json()["state"], "absent")
            other = {**archive, "fields": {"q.0.question": "Why a different city?"}}
            self.assertEqual(self.b.post("/api/localization/prepared/", other, format="json").status_code, 202)
            for bundle in PreparedDisplayResource.objects.all():
                prepared_display.refresh(bundle.pk)
            self.assertEqual(self.a.get(url).json()["fields"]["q.0.question"]["source"], "Why Seoul?")
            self.assertEqual(self.b.get(url).json()["fields"]["q.0.question"]["source"], "Why a different city?")
            self.assertFalse(DisplayTranslation.objects.filter(installation=None).exists())
        from .tasks import run_feedback_v3
        run = FeedbackRun.objects.create(attempt=self.a_attempt, fingerprint="fixture", queued_at=timezone.now())
        with patch("rehearsals.feedback_v3.pipeline.run", side_effect=lambda _: self.assertEqual(
                list(Deck.objects.values_list("pk", flat=True)), [self.a_deck.pk])) as work:
            run_feedback_v3(str(run.pk))
            work.assert_called_once()
            Installation.objects.filter(pk=self.a_owner.pk).update(last_seen=timezone.now() - timedelta(days=31))
            run_feedback_v3(str(run.pk))
            self.assertEqual(work.call_count, 1)
        self.assertIsNone(current_installation_id())

    def test_demo_enrollment_disabled(self):
        with override_settings(OUTLOUD_PUBLIC_SERVICE=False):
            self.assertEqual(APIClient().post("/api/installations/").status_code, 404)
            self.assertEqual(APIClient().get("/api/incremental/capabilities/").status_code, 200)
