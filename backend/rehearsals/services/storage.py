import hashlib
import json
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


def read_upload(upload, limit):
    if upload is None or not 0 < upload.size <= limit:
        raise ValidationError(f"Provide a nonempty file of at most {limit // 1024 // 1024} MB.")
    return upload.read()


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
            deck.pdf.save(f"{deck.id}.pdf", ContentFile(data), save=False)
            files.append(deck.pdf)
            deck.save(force_insert=True)
            for page in pages:
                slide = Slide(deck=deck, slide_index=page["slide_index"], extracted_text=page["extracted_text"])
                slide.image.save(f"{deck.id}-{slide.slide_index}.png", ContentFile(page["image"]), save=False)
                files.append(slide.image)
                slide.save()
        return deck
    except Exception as exc:
        for file in files:
            file.storage.delete(file.name)
        if isinstance(exc, IntegrityError):
            existing = Deck.objects.filter(**lookup).first()
            if existing:
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
    if suffix not in {".m4a", ".mp4", ".mp3", ".wav", ".webm", ".ogg", ".flac"}:
        raise ValidationError("Unsupported audio format.")
    try:
        with av.open(BytesIO(data)) as container:
            if not container.streams.audio or container.duration is None:
                raise ValueError()
            duration = container.duration / 1000
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
    attempt.audio.save(f"{attempt.id}{suffix}", ContentFile(data), save=False)
    try:
        with transaction.atomic():
            attempt.save(force_insert=True)
    except Exception as exc:
        attempt.audio.storage.delete(attempt.audio.name)
        if isinstance(exc, IntegrityError):
            existing = Attempt.objects.get(id=metadata["id"])
            return existing if existing.upload_hash == digest else None
        raise
    return attempt
