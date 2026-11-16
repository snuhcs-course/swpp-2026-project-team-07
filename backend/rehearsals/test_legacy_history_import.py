"""Synthetic legacy migration fixtures; no provider calls or real user media.

AI-assisted by OpenAI Codex, October 31, 2026; see the active collaboration log.
"""
import copy
import hashlib
import json
from io import StringIO
from pathlib import Path
import tempfile
from unittest.mock import patch
import uuid

from django.apps import apps
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils.dateparse import parse_datetime

from .management.commands.import_legacy_history import FORMAT, SOURCE_MIGRATIONS, UNSUPPORTED_COUNTS
from .models import Attempt, Deck, FeedbackQuotaBucket, Slide


class LegacyHistoryImportTests(TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / "media"
        self.root.mkdir()
        override = override_settings(MEDIA_ROOT=self.root)
        override.enable()
        self.addCleanup(override.disable)
        self.export = Path(self.directory.name) / "history.json"
        self.deck_id = str(uuid.uuid4())
        self.completed_id, self.pending_id = str(uuid.uuid4()), str(uuid.uuid4())
        timestamp = "2026-09-30T03:04:05.678901+00:00"
        complete = {
            "id": self.completed_id, "deck_id": self.deck_id, "audio": "recordings/complete.wav",
            "duration_ms": 1000, "slide_events": [{"slide_index": 0, "at_ms": 0}],
            "audience": "Synthetic audience", "status": "completed",
            "transcript": {"text": "Synthetic", "words": [{"text": "Synthetic", "start_ms": 0, "end_ms": 900}]},
            "feedback": [], "error": None, "created_at": timestamp, "upload_hash": "a" * 64,
            "metrics": {"duration_ms": 1000}, "visits": [{"slide_index": 0, "start_ms": 0, "end_ms": 1000}],
            "queued_at": timestamp,
        }
        pending = {**complete, "id": self.pending_id, "audio": "recordings/pending.wav", "status": "pending",
                   "transcript": None, "metrics": {}, "visits": [], "queued_at": None, "upload_hash": "b" * 64}
        self.document = {
            "format": FORMAT, "source_migrations": list(SOURCE_MIGRATIONS),
            "unsupported_counts": dict(UNSUPPORTED_COUNTS),
            "decks": [{"id": self.deck_id, "title": "Synthetic history", "pdf": "decks/source.pdf",
                       "page_count": 1, "created_at": timestamp, "content_hash": "c" * 64,
                       "preparation_version": "pdfium-v1"}],
            "slides": [{"id": 7, "deck_id": self.deck_id, "slide_index": 0,
                        "image": "slides/source.png", "extracted_text": "Synthetic slide"}],
            "attempts": [complete, pending], "media": [],
        }
        for name in ("decks/source.pdf", "slides/source.png", "recordings/complete.wav", "recordings/pending.wav"):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            content = ("synthetic original bytes: " + name).encode()
            path.write_bytes(content)
            self.document["media"].append({"path": name, "size_bytes": len(content),
                                           "sha256": hashlib.sha256(content).hexdigest()})

    def run_import(self, document=None):
        self.export.write_text(json.dumps(document or self.document))
        call_command("import_legacy_history", self.export, stdout=StringIO())

    def assert_empty_history(self):
        self.assertFalse(any(model.objects.exists() for model in apps.get_app_config("rehearsals").get_models()))

    def test_preserves_original_history_and_never_queues_or_invents_provider_work(self):
        original_hashes = {item["path"]: item["sha256"] for item in self.document["media"]}
        with patch("rehearsals.tasks.process_attempt.delay") as enqueue:
            self.run_import()
        enqueue.assert_not_called()
        self.assertEqual((Deck.objects.count(), Slide.objects.count(), Attempt.objects.count()), (1, 1, 2))
        deck = Deck.objects.get()
        self.assertEqual(str(deck.id), self.deck_id)
        self.assertEqual(deck.created_at, parse_datetime(self.document["decks"][0]["created_at"]))
        self.assertEqual(deck.pdf.name, "decks/source.pdf")
        self.assertEqual(Slide.objects.get().id, 7)
        for original in self.document["attempts"]:
            attempt = Attempt.objects.get(pk=original["id"])
            for name in ("duration_ms", "slide_events", "audience", "status", "transcript", "feedback", "error",
                         "upload_hash", "metrics", "visits"):
                expected = original[name]
                if original["status"] == "pending" and name in {"metrics", "visits"} and not expected:
                    expected = None
                self.assertEqual(getattr(attempt, name), expected)
            self.assertEqual(attempt.audio.name, original["audio"])
            self.assertEqual(attempt.created_at, parse_datetime(original["created_at"]))
            self.assertEqual(attempt.processing_revision, 0)
            self.assertIsNone(attempt.claim_token)
        complete = Attempt.objects.get(pk=self.completed_id)
        self.assertEqual((complete.processing_state, complete.analysis_outcome, complete.feedback_state),
                         ("completed", "legacy", "legacy"))
        pending = Attempt.objects.get(pk=self.pending_id)
        self.assertEqual((pending.processing_state, pending.analysis_outcome, pending.feedback_state),
                         ("awaiting_analysis", "", "disabled"))
        self.assertIsNone(pending.queued_at)
        for model in apps.get_app_config("rehearsals").get_models():
            if model not in (Deck, Slide, Attempt):
                self.assertEqual(model.objects.count(), 0)
        for name, digest in original_hashes.items():
            self.assertEqual(hashlib.sha256((self.root / name).read_bytes()).hexdigest(), digest)
        later = Slide.objects.create(deck=deck, slide_index=1, image="slides/later.png", extracted_text="")
        self.assertGreater(later.id, 7)

    def test_pending_empty_legacy_analysis_serializes_as_missing_for_current_client(self):
        self.run_import()
        response = self.client.get(f"/api/attempts/{self.pending_id}/", secure=True)
        self.assertEqual(response.status_code, 200)
        wire = response.json()
        self.assertEqual(wire["processing_state"], "awaiting_analysis")
        self.assertEqual(wire["partial_available"], {"transcript": False, "alignment": False})
        self.assertIsNone(wire["metrics"])
        self.assertIsNone(wire["visits"])
        self.assertIsNone(wire["provenance"]["provider"])

    def test_identical_rerun_refused_without_changes(self):
        self.run_import()
        with self.assertRaisesMessage(CommandError, "must be empty"):
            self.run_import()
        self.assertEqual((Deck.objects.count(), Slide.objects.count(), Attempt.objects.count()), (1, 1, 2))

    def test_nonempty_auxiliary_history_also_refuses_import(self):
        FeedbackQuotaBucket.objects.create(provider="openai", project_id="synthetic", model="synthetic")
        with self.assertRaisesMessage(CommandError, "must be empty"):
            self.run_import()
        self.assertEqual(Deck.objects.count(), 0)
        self.assertEqual(FeedbackQuotaBucket.objects.count(), 1)

    def test_wrong_source_stamp_and_active_source_refused_before_writes(self):
        for kind in ("migration", "active"):
            document = copy.deepcopy(self.document)
            if kind == "migration":
                document["source_migrations"].append("unsupported")
            else:
                document["unsupported_counts"]["active_attempts"] = 1
            with self.subTest(kind=kind), self.assertRaises(CommandError):
                self.run_import(document)
            self.assert_empty_history()

    def test_wrong_file_hash_and_incomplete_manifest_refused_before_writes(self):
        for kind in ("hash", "missing"):
            document = copy.deepcopy(self.document)
            if kind == "hash":
                document["media"][0]["sha256"] = "0" * 64
            else:
                document["media"].pop()
            with self.subTest(kind=kind), self.assertRaises(CommandError):
                self.run_import(document)
            self.assert_empty_history()

    def test_traversal_and_escaping_symlink_refused(self):
        outside = Path(self.directory.name) / "outside.wav"
        outside.write_bytes(b"synthetic outside file")
        (self.root / "recordings" / "escape.wav").symlink_to(outside)
        for name in ("../outside.wav", "recordings/escape.wav"):
            document = copy.deepcopy(self.document)
            document["attempts"][0]["audio"] = name
            with self.subTest(kind=name), self.assertRaises(CommandError):
                self.run_import(document)
            self.assert_empty_history()

    def test_write_failure_rolls_back_earlier_rows(self):
        with patch.object(Slide, "save_base", side_effect=IntegrityError("synthetic write failure")):
            with self.assertRaisesMessage(CommandError, "rolled back"):
                self.run_import()
        self.assert_empty_history()
