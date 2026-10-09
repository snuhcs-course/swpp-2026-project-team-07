# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import uuid
from django.db import models


class Deck(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    pdf = models.FileField(upload_to="decks/%Y/%m/")
    page_count = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


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
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    transcript = models.JSONField(null=True, blank=True)
    feedback = models.JSONField(default=list)
    error = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
