import uuid
from django.db import models


class Deck(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    pdf = models.FileField(upload_to="decks/%Y/%m/")
    page_count = models.PositiveIntegerField()
    content_hash = models.CharField(max_length=64, null=True, blank=True)
    preparation_version = models.CharField(max_length=40, default="pdfium-v1")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["content_hash", "preparation_version"], name="unique_prepared_pdf")]


class Slide(models.Model):
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="slides")
    slide_index = models.PositiveIntegerField()
    image = models.FileField(upload_to="slides/%Y/%m/")
    extracted_text = models.TextField(blank=True)

    class Meta:
        ordering = ["slide_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["deck", "slide_index"], name="unique_deck_slide"
            )
        ]


class Attempt(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        PROCESSING = "processing"
        COMPLETED = "completed"
        FAILED = "failed"

    # A new UUID per recording preserves earlier attempts on the same deck.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deck = models.ForeignKey(Deck, on_delete=models.PROTECT, related_name="attempts")
    audio = models.FileField(upload_to="recordings/%Y/%m/")
    duration_ms = models.PositiveIntegerField()
    slide_events = models.JSONField(default=list)
    audience = models.CharField(max_length=500, blank=True)
    upload_hash = models.CharField(max_length=64, blank=True)
    transcription_state = models.CharField(max_length=24, default="pending")
    feedback_state = models.CharField(max_length=24, default="disabled")
    visits = models.JSONField(default=list)
    metrics = models.JSONField(default=dict)
    transcription_meta = models.JSONField(default=dict)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    queued_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    transcript = models.JSONField(null=True, blank=True)
    feedback = models.JSONField(default=list)
    error = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
