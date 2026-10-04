from celery import shared_task
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from django.db import connection, transaction
from django.utils import timezone
from .models import Attempt
from .services.local_transcription import transcribe_local
from .services.alignment import align_words
from .services.metrics import timing_metrics


@contextmanager
def single_transcription():
    # Session lock protects against accidentally starting a second worker.
    locked = True
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(700701)")
            locked = cursor.fetchone()[0]
    try:
        yield locked
    finally:
        if locked and connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(700701)")


def finish_feedback(attempt):
    # Local results are durable before milestone 3's optional feedback stage.
    attempt.feedback_state = "disabled"
    attempt.status = Attempt.Status.COMPLETED
    attempt.save(update_fields=["feedback_state", "status"])


@shared_task
def process_attempt(attempt_id: str):
    with single_transcription() as locked:
        if not locked:
            return  # The durable queue/beat will pick up this attempt.
        with transaction.atomic():
            attempt = Attempt.objects.select_for_update().get(id=attempt_id)
            if attempt.status in [Attempt.Status.COMPLETED, Attempt.Status.FAILED]:
                return
            if attempt.transcription_state == "running" and attempt.processing_started_at and attempt.processing_started_at > timezone.now() - timedelta(seconds=1900):
                return
            attempt.status = Attempt.Status.PROCESSING
            attempt.processing_started_at = timezone.now()
            attempt.transcription_state = "complete" if attempt.transcript is not None else "running"
            attempt.error = None
            attempt.save()
        try:
            if attempt.transcript is None:
                output = transcribe_local(Path(attempt.audio.path))
                attempt.transcript = {"text": output["text"], "words": output["words"]}
                attempt.transcription_meta = {**output["metadata"], "raw_response": output["raw_response"]}
                # Successful recognition survives even a later alignment failure.
                attempt.save(update_fields=["transcript", "transcription_meta"])
            words = attempt.transcript["words"]
            timeline_end = max([attempt.duration_ms] + [w["end_ms"] for w in words])
            if timeline_end > attempt.duration_ms + 1000:
                raise ValueError("Word timestamps exceed the accepted codec tail.")
            visits = align_words(words, attempt.slide_events, timeline_end)
            attempt.visits = visits
            attempt.metrics = timing_metrics(visits, timeline_end, attempt.transcript["text"], attempt.transcription_meta["language"])
            attempt.transcription_state = "complete"
            attempt.save(update_fields=["visits", "metrics", "transcription_state"])
        except Exception:
            attempt.transcription_state = "failed"
            attempt.status = Attempt.Status.FAILED
            code = "alignment_failed" if attempt.transcript is not None else "transcription_failed"
            attempt.error = {"code": code, "message": "Local analysis failed. Audio and any transcript are retained; retry after checking the model and worker."}
            attempt.save(update_fields=["transcription_state", "status", "error"])
            return
        finish_feedback(attempt)


@shared_task
def recover_work():
    stale = timezone.now() - timedelta(seconds=1900)
    attempts = Attempt.objects.filter(queued_at__isnull=False, status__in=["pending", "processing"])
    for attempt in attempts:
        if attempt.transcription_state != "running" or not attempt.processing_started_at or attempt.processing_started_at < stale:
            process_attempt.delay(str(attempt.id))
