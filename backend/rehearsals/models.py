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
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    transcript = models.JSONField(null=True, blank=True)
    feedback = models.JSONField(default=list)
    error = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Revision is the authorized processing generation, consumed once by admission.
    processing_state = models.CharField(max_length=32, default='awaiting_analysis', db_index=True)
    processing_revision = models.PositiveIntegerField(default=0)
    failed_stage = models.CharField(max_length=32, blank=True)
    queued_at = models.DateTimeField(null=True, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    claim_token = models.UUIDField(null=True, blank=True)
    retry_at = models.DateTimeField(null=True, blank=True)
    visits = models.JSONField(null=True, blank=True)
    metrics = models.JSONField(null=True, blank=True)
    analysis_outcome = models.CharField(max_length=32, blank=True)
    feedback_state = models.CharField(max_length=20, default='disabled')


class ProviderRequest(models.Model):
    """Private database evidence. Never serialize this model or serve it as media."""
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='provider_requests')
    generation = models.PositiveIntegerField()
    claim_token = models.UUIDField()
    provider = models.CharField(max_length=32, default='openai')
    model = models.CharField(max_length=32, default='whisper-1')
    input_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)
    raw_received_at = models.DateTimeField(null=True)
    outcome = models.CharField(max_length=32, default='submitted')
    raw_response = models.JSONField(null=True)
    usage = models.JSONField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['attempt', 'generation'], name='one_provider_request_per_generation')]


class DescriptionSet(models.Model):
    """One provider/configuration/source scope; successful edits survive job failure."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deck = models.ForeignKey(Deck, on_delete=models.PROTECT, related_name='description_sets')
    source_fingerprint = models.CharField(max_length=64)
    provider = models.CharField(max_length=16)
    project_id = models.CharField(max_length=160)
    model = models.CharField(max_length=100)
    prompt_version = models.CharField(max_length=40)
    schema_version = models.CharField(max_length=40)
    # Private bounded metadata only, no credentials. Media remains in original files.
    source_snapshot = models.JSONField()
    prompt_digest = models.CharField(max_length=64)
    input_hash = models.CharField(max_length=64)
    processing_revision = models.PositiveIntegerField(default=0)
    description_revision = models.PositiveIntegerField(default=0)
    descriptions = models.JSONField(null=True)
    edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['deck', 'source_fingerprint', 'provider', 'project_id',
            'model', 'prompt_version', 'schema_version'], name='unique_description_scope')]


class DescriptionJob(models.Model):
    description_set = models.ForeignKey(DescriptionSet, on_delete=models.PROTECT, related_name='jobs')
    generation = models.PositiveIntegerField()
    description_revision = models.PositiveIntegerField()
    state = models.CharField(max_length=32, default='queued', db_index=True)
    claim_token = models.UUIDField(null=True)
    queued_at = models.DateTimeField()
    claimed_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    retry_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=40, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['description_set', 'generation'], name='unique_description_generation')]


class FeedbackAnalysis(models.Model):
    """One current coaching analysis per recording; Whisper remains independent."""
    attempt = models.OneToOneField(Attempt, on_delete=models.PROTECT, related_name='coaching')
    feedback_revision = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class FeedbackJob(models.Model):
    analysis = models.ForeignKey(FeedbackAnalysis, on_delete=models.PROTECT, related_name='jobs')
    generation = models.PositiveIntegerField()
    description_set = models.ForeignKey(DescriptionSet, on_delete=models.PROTECT, related_name='feedback_jobs')
    description_generation = models.PositiveIntegerField()
    description_revision = models.PositiveIntegerField(null=True)
    # Frozen source and fulfilled dependency per generation, never credentials.
    source_snapshot = models.JSONField()
    descriptions_snapshot = models.JSONField(null=True)
    prompt_version = models.CharField(max_length=40)
    schema_version = models.CharField(max_length=40)
    prompt_digest = models.CharField(max_length=64)
    input_hash = models.CharField(max_length=64, blank=True)
    result = models.JSONField(null=True)
    state = models.CharField(max_length=32, default='waiting_descriptions', db_index=True)
    claim_token = models.UUIDField(null=True)
    queued_at = models.DateTimeField()
    claimed_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    retry_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=40, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['analysis', 'generation'], name='unique_coaching_generation')]


class FeedbackQuotaBucket(models.Model):
    # Model bucket deliberately excludes stage, to share description and coaching limits.
    provider = models.CharField(max_length=16)
    project_id = models.CharField(max_length=160)
    model = models.CharField(max_length=100)
    blocked_until = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['provider', 'project_id', 'model'], name='unique_feedback_quota_bucket')]


class FeedbackRequest(models.Model):
    """Private durable evidence, entirely separate from Whisper ProviderRequest."""
    job = models.OneToOneField(DescriptionJob, on_delete=models.PROTECT, related_name='request', null=True)
    coaching_job = models.OneToOneField(FeedbackJob, on_delete=models.PROTECT, related_name='request', null=True)
    generation = models.PositiveIntegerField()
    claim_token = models.UUIDField()
    provider = models.CharField(max_length=16)
    project_id = models.CharField(max_length=160)
    model = models.CharField(max_length=100)
    stage = models.CharField(max_length=24, default='descriptions')
    input_hash = models.CharField(max_length=64)
    queued_at = models.DateTimeField()
    claimed_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True)
    received_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    outcome = models.CharField(max_length=32, default='local')
    error_code = models.CharField(max_length=40, blank=True)
    status_code = models.PositiveIntegerField(null=True)
    raw_body = models.BinaryField(null=True)
    body_complete = models.BooleanField(null=True)
    body_issue = models.CharField(max_length=40, null=True)
    retry_at = models.DateTimeField(null=True)
    usage = models.JSONField(null=True)  # null means unknown, never zero consumption


    class Meta:
        constraints = [models.CheckConstraint(
            condition=(models.Q(job__isnull=False, coaching_job__isnull=True, stage='descriptions') |
                       models.Q(job__isnull=True, coaching_job__isnull=False, stage='coaching')),
            name='feedback_request_exact_stage_owner')]


class FeedbackReservation(models.Model):
    request = models.OneToOneField(FeedbackRequest, on_delete=models.PROTECT, related_name='reservation')
    bucket = models.ForeignKey(FeedbackQuotaBucket, on_delete=models.PROTECT, related_name='reservations')
    units = models.PositiveBigIntegerField()
    reserved_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True)
    released_at = models.DateTimeField(null=True)
