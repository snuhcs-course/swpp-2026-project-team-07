"""Import the verified pre-Scribe history into an empty current database.

AI-assisted by OpenAI Codex, October 31, 2026; see the active collaboration log.
The original database dump remains the archive for legacy-only provenance fields.
"""
import hashlib
import json
from pathlib import Path, PurePosixPath
from uuid import UUID

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from rehearsals.models import Attempt, Deck, Slide


FORMAT = "outloud-legacy-history-v1"
SOURCE_MIGRATIONS = [
    "0001_initial",
    "0002_attempt_upload_hash_deck_content_hash_and_more",
    "0003_attempt_feedback_state_attempt_metrics_and_more",
    "0004_generation_providerproject_attempt_feedback_key_and_more",
    "0005_deck_description_source_key_deck_descriptions_edited_and_more",
]
UNSUPPORTED_COUNTS = {
    "generations": 0, "provider_projects": 0, "provider_requests": 0,
    "cached_descriptions": 0, "edited_descriptions": 0, "active_attempts": 0,
}
FIELDS = {
    "decks": (Deck, {"id", "title", "pdf", "page_count", "created_at", "content_hash", "preparation_version"}),
    "slides": (Slide, {"id", "deck_id", "slide_index", "image", "extracted_text"}),
    "attempts": (Attempt, {"id", "deck_id", "audio", "duration_ms", "slide_events", "audience", "status",
                           "transcript", "feedback", "error", "created_at", "upload_hash", "metrics", "visits", "queued_at"}),
}


def media_path(root, value):
    if not isinstance(value, str) or not value or "\\" in value or "\0" in value:
        raise CommandError("Media paths must be safe relative paths.")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or str(path) != value:
        raise CommandError("Media paths must be safe relative paths.")
    try:
        resolved = (root / value).resolve(strict=True)
        resolved.relative_to(root)
        if not resolved.is_file():
            raise ValueError()
    except (OSError, ValueError):
        raise CommandError("A referenced media file is missing or escapes MEDIA_ROOT.") from None
    return resolved


def reject_constant(_value):
    raise ValueError("Non-finite JSON number")


def validated_history(document, root):
    expected = {"format", "source_migrations", "unsupported_counts", "media", *FIELDS}
    if not isinstance(document, dict) or set(document) != expected or document["format"] != FORMAT:
        raise CommandError("Unsupported legacy history export format.")
    if document["source_migrations"] != SOURCE_MIGRATIONS:
        raise CommandError("The source migration stamp does not match the supported legacy database.")
    counts = document["unsupported_counts"]
    if (not isinstance(counts, dict) or set(counts) != set(UNSUPPORTED_COUNTS)
            or any(type(value) is not int or value != 0 for value in counts.values())):
        raise CommandError("The source contains unsupported legacy or active processing records.")

    rows, identities, referenced = {}, {}, set()
    for group, (model, fields) in FIELDS.items():
        if not isinstance(document[group], list):
            raise CommandError("History rows must be lists.")
        rows[group], identities[group] = [], set()
        for record in document[group]:
            if not isinstance(record, dict) or set(record) != fields:
                raise CommandError("A legacy history row has unexpected fields.")
            values = {}
            try:
                for name, value in record.items():
                    if name == "deck_id":
                        if not isinstance(value, str):
                            raise ValueError()
                        values[name] = UUID(value)
                        continue
                    field = model._meta.get_field(name)
                    if field.get_internal_type() == "JSONField":
                        # Empty lists/dicts are valid stored defaults, even when blank=False.
                        values[name] = value
                        continue
                    if field.get_internal_type() in {"PositiveIntegerField", "PositiveBigIntegerField", "BigAutoField"}:
                        if type(value) is not int:
                            raise ValueError()
                    values[name] = field.clean(value, None)
                    if name in {"created_at", "queued_at"} and values[name] is not None and timezone.is_naive(values[name]):
                        raise ValueError()
            except (ValueError, TypeError, ValidationError):
                raise CommandError("A legacy history row has invalid field values.") from None
            if values["id"] in identities[group]:
                raise CommandError("Duplicate history identities are not allowed.")
            identities[group].add(values["id"])
            for name in {"pdf", "image", "audio"} & fields:
                media_path(root, values[name])
                referenced.add(values[name])
            rows[group].append(values)

    for record in rows["attempts"]:
        if (not all(isinstance(record[name], list) for name in ("slide_events", "feedback", "visits"))
                or not isinstance(record["metrics"], dict)
                or record["transcript"] is not None and not isinstance(record["transcript"], dict)
                or record["error"] is not None and not isinstance(record["error"], dict)):
            raise CommandError("Stored attempt JSON has an unsupported shape.")

    decks = {record["id"]: record for record in rows["decks"]}
    slide_keys = set()
    for record in rows["slides"]:
        key = record["deck_id"], record["slide_index"]
        if (record["deck_id"] not in decks or key in slide_keys
                or record["slide_index"] >= decks[record["deck_id"]]["page_count"]):
            raise CommandError("Slide identities or deck references are invalid.")
        slide_keys.add(key)
    if any(sum(key[0] == deck_id for key in slide_keys) != deck["page_count"] for deck_id, deck in decks.items()):
        raise CommandError("Every deck must retain its complete slide inventory.")
    for record in rows["attempts"]:
        if record["deck_id"] not in decks or record["status"] not in {"completed", "pending", "failed"}:
            raise CommandError("Attempt references or processing state are unsupported.")
        if record["status"] == "pending" and record["transcript"] is not None:
            raise CommandError("Pending legacy attempts must not contain a completed transcript.")

    if not isinstance(document["media"], list):
        raise CommandError("The media manifest must be a list.")
    manifest_paths = set()
    for item in document["media"]:
        if not isinstance(item, dict) or set(item) != {"path", "size_bytes", "sha256"}:
            raise CommandError("Invalid media manifest entry.")
        path = media_path(root, item["path"])
        if (item["path"] in manifest_paths or type(item["size_bytes"]) is not int or item["size_bytes"] < 0
                or not isinstance(item["sha256"], str) or len(item["sha256"]) != 64
                or any(char not in "0123456789abcdef" for char in item["sha256"])):
            raise CommandError("Invalid or duplicate media manifest entry.")
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if path.stat().st_size != item["size_bytes"] or digest.hexdigest() != item["sha256"]:
            raise CommandError("Media size or SHA-256 does not match the source manifest.")
        manifest_paths.add(item["path"])
    if manifest_paths != referenced:
        raise CommandError("The media manifest must exactly cover all history references.")
    return rows


class Command(BaseCommand):
    help = "Import a verified legacy export and pre-restored media into a fresh current database."

    def add_arguments(self, parser):
        parser.add_argument("export_file", type=Path)

    def handle(self, *args, **options):
        try:
            root = Path(settings.MEDIA_ROOT).resolve(strict=True)
            with options["export_file"].open(encoding="utf-8") as source:
                document = json.load(source, parse_constant=reject_constant)
        except (OSError, ValueError):
            raise CommandError("Could not read the legacy export or restored media directory.") from None
        rows = validated_history(document, root)
        history_models = list(apps.get_app_config("rehearsals").get_models())
        try:
            with transaction.atomic():
                if connection.vendor == "postgresql":
                    # The empty-target check and import must exclude concurrent app writers.
                    tables = ", ".join(connection.ops.quote_name(model._meta.db_table) for model in history_models)
                    with connection.cursor() as cursor:
                        cursor.execute(f"LOCK TABLE {tables} IN EXCLUSIVE MODE")
                if any(model.objects.exists() for model in history_models):
                    raise CommandError("The target history database must be empty; repeated imports are refused.")
                for group, (model, _fields) in FIELDS.items():
                    for values in rows[group]:
                        if model is Attempt:
                            values = dict(values)
                            values["processing_revision"] = 0
                            if values["status"] in {"completed", "failed"}:
                                values.update(processing_state=values["status"], analysis_outcome="legacy", feedback_state="legacy")
                            else:
                                values.update(processing_state="awaiting_analysis", analysis_outcome="", feedback_state="disabled")
                                # Legacy empty defaults mean analysis is missing, not a timed result.
                                if not values["metrics"]:
                                    values["metrics"] = None
                                if not values["visits"]:
                                    values["visits"] = None
                        # Fixture-style saving preserves original auto_now_add timestamps.
                        model(**values).save_base(raw=True, force_insert=True)
                with connection.cursor() as cursor:
                    for statement in connection.ops.sequence_reset_sql(no_style(), [Slide]):
                        cursor.execute(statement)
        except DatabaseError:
            raise CommandError("Import failed; the target transaction was rolled back.") from None
        self.stdout.write(self.style.SUCCESS(
            f"Imported {len(rows['decks'])} decks, {len(rows['slides'])} slides and {len(rows['attempts'])} attempts; no jobs queued."
        ))
