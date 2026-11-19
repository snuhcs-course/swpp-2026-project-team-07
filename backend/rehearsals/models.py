# Scribe-only integration: OpenAI Codex, October 17, 2026; docs/testing/evidence/scribe-only-integration-verification-2026-10-17.md.
# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
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


class PresentationContext(models.Model):
    """User requirements are independent of the deduplicated PDF and attempts."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deck = models.ForeignKey(Deck, on_delete=models.PROTECT, related_name='presentation_contexts')
    required_duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    audience = models.CharField(max_length=500, blank=True, default='')
    revision = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=models.Q(required_duration_seconds__isnull=True) |
                      models.Q(required_duration_seconds__gte=60, required_duration_seconds__lte=1800),
            name='presentation_duration_range'),
            models.CheckConstraint(condition=models.Q(revision__lte=2**31 - 1), name='presentation_revision_range')]


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
    provider = models.CharField(max_length=32, default='elevenlabs')
    model = models.CharField(max_length=32, default='scribe_v2')
    input_hash = models.CharField(max_length=64)
    request_options = models.JSONField(default=dict, blank=True)
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


class TranscriptCorrection(models.Model):
    """Confirmed overlays; immutable Whisper source and audio stay on Attempt."""
    attempt = models.OneToOneField(Attempt, on_delete=models.PROTECT, related_name='correction')
    base_transcript_id = models.CharField(max_length=64)
    revision = models.PositiveIntegerField(default=0)
    edits = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)


class FeedbackAnalysis(models.Model):
    """One current coaching analysis per recording; Whisper remains independent."""
    attempt = models.ForeignKey(Attempt, on_delete=models.PROTECT, related_name='analyses')
    analysis_type = models.CharField(max_length=32, default='coaching')
    feedback_revision = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['attempt', 'analysis_type'], name='unique_attempt_analysis_type')]


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


# Historical schema compatibility, AI-assisted by OpenAI Codex; October 16, 2026.
class SlideReviewMembership(models.Model):
    """Historical Step 2 data retained for schema compatibility; no runtime writes."""
    attempt = models.ForeignKey(Attempt, on_delete=models.PROTECT, related_name='review_memberships')
    context_key = models.CharField(max_length=36, blank=True, default='')
    slide_index = models.PositiveIntegerField()
    analysis = models.ForeignKey(FeedbackAnalysis, on_delete=models.PROTECT, related_name='review_memberships')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['attempt', 'context_key', 'slide_index'], name='unique_slide_review_owner')]


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


class QaAnswer(models.Model):
    """An immutable question/part binding; audio/STT lives on the original Attempt."""
    attempt = models.OneToOneField(Attempt, on_delete=models.PROTECT, primary_key=True, related_name='qa_answer')
    question_job = models.ForeignKey(FeedbackJob, on_delete=models.PROTECT, related_name='qa_answers')
    question_id = models.CharField(max_length=32)
    part = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(part__in=[0, 1]), name='qa_answer_part_range')]


class FeedbackRun(models.Model):
    """One v3 feedback run: measurements, per-slide and whole results, scores.

    AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see
    docs/ai-collaboration-prompts.md. A new run is created when its inputs
    (transcript, corrections, presentation context, slide profiles, prompt,
    rubric or model) change. Retry re-queues the same run and keeps finished parts.
    """
    class Status(models.TextChoices):
        QUEUED = 'queued'
        RUNNING = 'running'
        COMPLETED = 'completed'
        FAILED = 'failed'
        STALE = 'stale'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='feedback_runs')
    context = models.ForeignKey(PresentationContext, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='feedback_runs')
    fingerprint = models.CharField(max_length=64)
    pipeline_version = models.CharField(max_length=40)
    rubric_version = models.CharField(max_length=40)
    model = models.CharField(max_length=100)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED, db_index=True)
    result = models.JSONField(default=dict)
    error = models.JSONField(null=True, blank=True)
    timings = models.JSONField(default=dict)
    usage = models.JSONField(default=dict)
    worker_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    queued_at = models.DateTimeField()
    started_at = models.DateTimeField(null=True, blank=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['attempt', '-created_at'], name='feedback_run_latest')]


class CaptureSession(models.Model):
    """Append-only sample-clock manifest for an uninterrupted recording."""
    attempt = models.OneToOneField(Attempt, primary_key=True, on_delete=models.CASCADE, related_name='capture')
    context = models.ForeignKey(PresentationContext, null=True, on_delete=models.PROTECT)
    manifest = models.JSONField(default=dict)
    revision = models.PositiveIntegerField(default=0)
    stopped = models.BooleanField(default=False)
    finalized = models.BooleanField(default=False)
    audio_hash = models.CharField(max_length=64, blank=True)
    desired = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CaptureSegment(models.Model):
    capture = models.ForeignKey(CaptureSession, on_delete=models.CASCADE, related_name='segments')
    sequence = models.PositiveIntegerField()
    slide_index = models.PositiveIntegerField()
    start_ms = models.PositiveIntegerField()
    end_ms = models.PositiveIntegerField()
    audio = models.FileField(upload_to='segments/%Y/%m/', blank=True)
    upload_hash = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=24, default='awaiting_upload', db_index=True)
    transcript = models.JSONField(null=True)
    receipts = models.JSONField(default=list)  # Private durable receipts, never serialized.
    claim_token = models.UUIDField(null=True)
    queued_at = models.DateTimeField(null=True)
    claimed_at = models.DateTimeField(null=True)
    retry_at = models.DateTimeField(null=True)
    error = models.JSONField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['capture', 'sequence'], name='unique_capture_segment')]


class CaptureAssessment(models.Model):
    """A durable per-input model result. -1 is the whole-presentation assessment."""
    capture = models.ForeignKey(CaptureSession, on_delete=models.CASCADE, related_name='assessments')
    slide_index = models.IntegerField()
    input_hash = models.CharField(max_length=64)
    payload = models.JSONField()
    evidence = models.JSONField(default=dict)  # Frozen sentence/measurement evidence.
    status = models.CharField(max_length=24, default='queued', db_index=True)
    result = models.JSONField(null=True)
    usage = models.JSONField(default=dict)
    claim_token = models.UUIDField(null=True)
    queued_at = models.DateTimeField()
    claimed_at = models.DateTimeField(null=True)
    error = models.JSONField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['capture', 'slide_index', 'input_hash'], name='unique_capture_assessment')]
