import hashlib
import json
import logging
import uuid
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile

import av
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from rehearsals.limits import MAX_AUDIO_BYTES, MAX_PDF_BYTES, MAX_DURATION_MS, PREPARATION_VERSION
from rehearsals.models import Attempt, Deck, Slide
from .pdf import prepare_slides

logger = logging.getLogger(__name__)


def save_media(field, basename, data, files):
    # A submission owns a unique directory, including when two requests use the
    # same attempt UUID. Track its path before writing, to clean partial writes.
    name = field.field.generate_filename(field.instance, f"{uuid.uuid4().hex}/{basename}")
    files.append((field.storage, name))
    saved_name = field.storage.save(name, ContentFile(data), max_length=field.field.max_length)
    if saved_name != name:
        files.append((field.storage, saved_name))
    field.name = saved_name
    field._committed = True


def cleanup_media(files, retained):
    for storage, name in files:
        if name not in retained:
            try:
                storage.delete(name)
            except Exception:
                # Orphans can be reconciled later; never mask the upload failure.
                logger.warning("Could not remove an unreferenced upload file.")


def read_upload(upload, limit):
    if upload is None or not 0 < upload.size <= limit:
        raise ValidationError(f"Provide a nonempty file of at most {limit:,} bytes.")
    data = upload.read(limit + 1)
    if not 0 < len(data) <= limit:
        raise ValidationError(f"File must contain 1 to {limit:,} bytes.")
    return data


def store_deck(upload, title):
    data = read_upload(upload, MAX_PDF_BYTES)
    digest = hashlib.sha256(data).hexdigest()
    lookup = {"content_hash": digest, "preparation_version": PREPARATION_VERSION}
    existing = Deck.objects.filter(**lookup).first()
    if existing:
        return existing
    with NamedTemporaryFile(suffix=".pdf") as temp:
        temp.write(data)
        temp.flush()
        try:
            pages = prepare_slides(Path(temp.name))
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
    files = []
    try:
        with transaction.atomic():
            deck = Deck(title=title, page_count=len(pages), **lookup)
            save_media(deck.pdf, f"{deck.id}.pdf", data, files)
            deck.save(force_insert=True)
            for page in pages:
                slide = Slide(deck=deck, slide_index=page["slide_index"], extracted_text=page["extracted_text"])
                save_media(slide.image, f"{deck.id}-{slide.slide_index}.png", page["image"], files)
                slide.save()
        return deck
    except Exception as exc:
        try:
            existing = Deck.objects.filter(**lookup).first()
            retained = {existing.pdf.name, *existing.slides.values_list("image", flat=True)} if existing else set()
        except Exception:
            # COMMIT may have succeeded before its acknowledgement was lost.
            # When the DB cannot resolve the outcome, retain all candidate media.
            logger.warning("Deck upload outcome uncertain; retaining media for reconciliation.")
        else:
            cleanup_media(files, retained)
            if isinstance(exc, IntegrityError) and existing:
                return existing
        raise


def store_attempt(upload, metadata):
    deck = Deck.objects.filter(id=metadata["deck_id"]).first()
    if not deck:
        raise ValidationError("Upload the deck before its recording.")
    if any(event["slide_index"] >= deck.page_count for event in metadata["slide_events"]):
        raise ValidationError("A slide event refers to a slide outside this deck.")
    data = read_upload(upload, MAX_AUDIO_BYTES)
    suffix = Path(upload.name).suffix.lower()
    if suffix not in {".m4a", ".mp4", ".mp3", ".wav", ".webm", ".mpeg", ".mpga"}:
        raise ValidationError("Unsupported audio format.")
    try:
        with av.open(BytesIO(data)) as container:
            if not container.streams.audio or container.duration is None:
                raise ValueError()
            # Decode the audio stream, not just container headers (which may
            # describe a longer video track or corrupt/truncated audio).
            duration = 0
            for frame in container.decode(audio=0):
                if frame.is_corrupt or not frame.sample_rate:
                    raise ValueError()
                duration += frame.samples * 1000 / frame.sample_rate
                if duration > MAX_DURATION_MS + 1000:
                    raise ValueError()
            # A small codec tail is allowed; the capture timeline remains capped at 10 minutes.
            if not 0 < duration <= MAX_DURATION_MS + 1000 or abs(duration - metadata["duration_ms"]) > 1000:
                raise ValueError()
    except Exception as exc:
        raise ValidationError("Audio must be playable, at most 10 minutes, and match its recording duration.") from exc
    digest = hashlib.sha256(data + json.dumps(metadata, sort_keys=True, default=str).encode()).hexdigest()
    existing = Attempt.objects.filter(id=metadata["id"]).first()
    if existing:
        return existing if existing.upload_hash == digest else None
    attempt = Attempt(**metadata, upload_hash=digest)
    files = []
    try:
        save_media(attempt.audio, f"{attempt.id}{suffix}", data, files)
        with transaction.atomic():
            attempt.save(force_insert=True)
    except Exception as exc:
        try:
            existing = Attempt.objects.filter(id=metadata["id"]).first()
        except Exception:
            logger.warning("Attempt upload outcome uncertain; retaining media for reconciliation.")
        else:
            cleanup_media(files, {existing.audio.name} if existing else set())
            if isinstance(exc, IntegrityError) and existing:
                return existing if existing.upload_hash == digest else None
        raise
    return attempt
