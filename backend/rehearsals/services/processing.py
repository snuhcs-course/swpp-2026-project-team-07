"""Durable queue and fenced processing. Database intent precedes broker publication.

Every writer locks the attempt and checks generation/token. Network and CPU work
run outside transactions. A submitted marker is conservative, not exactly-once.
"""
import logging
import uuid
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from ..models import Attempt, ProviderRequest
from . import transcription
from .alignment import align_words
from .metrics import timing_metrics
from .speech_gate import has_speech

logger = logging.getLogger(__name__)
ACTIVE = {'queued', 'checking_audio', 'transcribing', 'aligning'}
STALE_SECONDS = 360


class ProcessConflict(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


class StaleClaim(Exception):
    pass


def publish(attempt_id, revision):
    from ..tasks import process_attempt
    try:
        process_attempt.delay(str(attempt_id), revision)
    except Exception:
        # The scheduler will recover from the committed row; no content/exception logs.
        logger.warning('Processing publish unavailable; durable queue retained.')


def admit(attempt_id, payload):
    with transaction.atomic():
        attempt = Attempt.objects.select_for_update().get(pk=attempt_id)
        revision = payload.get('processing_revision')
        if revision is not None and revision != attempt.processing_revision:
            raise ProcessConflict('stale_revision', 'Refresh this attempt before retrying.')
        if attempt.processing_state in ACTIVE or attempt.status == 'completed':
            return attempt
        if attempt.status == 'failed':
            if revision is None:
                raise ProcessConflict('revision_required', 'Refresh and supply the current processing revision.')
            if attempt.processing_state == 'needs_confirmation' and not payload.get('acknowledge_uncertain'):
                raise ProcessConflict('confirmation_required', 'The previous request may have been charged. Confirm before retrying.')
            if attempt.retry_at and attempt.retry_at > timezone.now():
                raise ProcessConflict('retry_not_available', 'The provider requested a wait. Refresh after the retry time.')
        elif payload.get('acknowledge_uncertain'):
            raise ProcessConflict('confirmation_not_needed', 'Refresh this attempt before requesting a retry.')
        attempt.processing_revision += 1
        attempt.processing_state, attempt.status = 'queued', 'processing'
        attempt.queued_at = timezone.now()
        attempt.claimed_at = attempt.claim_token = attempt.retry_at = None
        attempt.failed_stage, attempt.error = '', None
        attempt.save(update_fields=['processing_revision', 'processing_state', 'status', 'queued_at',
            'claimed_at', 'claim_token', 'retry_at', 'failed_stage', 'error'])
        transaction.on_commit(lambda: publish(attempt.id, attempt.processing_revision))
        return attempt


def claim_attempt(attempt_id, revision):
    token = uuid.uuid4()
    # Conditional UPDATE also prevents duplicate deliveries from acquiring one row.
    count = Attempt.objects.filter(pk=attempt_id, processing_revision=revision,
        processing_state='queued', claim_token__isnull=True).update(
            processing_state='checking_audio', status='processing', claim_token=token, claimed_at=timezone.now())
    return Attempt.objects.get(pk=attempt_id, claim_token=token) if count else None


def locked_claim(claim):
    attempt = Attempt.objects.select_for_update().get(pk=claim.pk)
    if (attempt.processing_revision != claim.processing_revision or attempt.claim_token != claim.claim_token
            or attempt.processing_state not in ACTIVE or not attempt.claimed_at
            or attempt.claimed_at <= timezone.now() - timedelta(seconds=STALE_SECONDS)):
        raise StaleClaim()
    return attempt


def write_claim(claim, **values):
    with transaction.atomic():
        attempt = locked_claim(claim)
        for key, value in values.items():
            setattr(attempt, key, value)
            setattr(claim, key, value)
        attempt.save(update_fields=list(values))


def mark_submitted(claim, input_hash):
    with transaction.atomic():
        locked_claim(claim)
        return ProviderRequest.objects.create(attempt_id=claim.pk, generation=claim.processing_revision,
            claim_token=claim.claim_token, input_hash=input_hash, submitted_at=timezone.now())


def save_raw(claim, request_id, raw):
    with transaction.atomic():
        locked_claim(claim)
        ProviderRequest.objects.filter(pk=request_id, claim_token=claim.claim_token).update(
            raw_response=raw, raw_received_at=timezone.now(), finished_at=timezone.now(), outcome='received',
            usage=raw.get('usage') if isinstance(raw, dict) else None)


def fail(claim, error):
    with transaction.atomic():
        attempt = locked_claim(claim)
        request = ProviderRequest.objects.filter(attempt=attempt, generation=attempt.processing_revision).first()
        uncertain = error.uncertain or bool(request and not request.raw_received_at and request.outcome == 'submitted')
        if request and not request.raw_received_at:
            # Explicit provider rejections have a durable known outcome.
            if not error.uncertain and error.code in {'provider_auth', 'provider_rate_limit', 'provider_rejected'}:
                uncertain = False
            request.outcome = 'uncertain' if uncertain else 'rejected'
            request.finished_at = timezone.now()
            request.save(update_fields=['outcome', 'finished_at'])
        attempt.failed_stage = attempt.processing_state
        attempt.status = 'failed'
        attempt.processing_state = 'needs_confirmation' if uncertain else 'failed'
        attempt.error = {'code': error.code, 'message': str(error)}
        attempt.retry_at = error.retry_at
        attempt.claim_token = None
        attempt.save(update_fields=['status', 'processing_state', 'failed_stage', 'error', 'retry_at', 'claim_token'])


def run_attempt(attempt_id, revision):
    claim = claim_attempt(attempt_id, revision)
    if claim is None:
        return
    try:
        # Reuse durable partial work even across an explicitly authorized generation.
        saved = claim.provider_requests.filter(raw_received_at__isnull=False).order_by('-generation').first()
        if claim.transcript is None:
            write_claim(claim, processing_state='checking_audio')
            if saved is None:
                # Safety net against accidentally requeueing submitted work in this generation.
                if claim.provider_requests.filter(generation=revision, submitted_at__isnull=False).exists():
                    raise transcription.TranscriptionError('uncertain_submission',
                        'The previous request may have been charged. Confirm a retry.', uncertain=True)
                if not has_speech(claim.audio.path):
                    # Persist the gate outcome before shared alignment, so recovery
                    # reuses this empty transcript without checking/sending audio again.
                    write_claim(claim, transcript={'text': '', 'words': []}, analysis_outcome='no_speech')
                else:
                    write_claim(claim, processing_state='transcribing')
                    # Validated original descriptor and configured SDK exist before submission.
                    with transcription.prepare_request(claim.audio.path) as prepared:
                        request = mark_submitted(claim, prepared.input_hash)
                        raw = transcription.request_raw(prepared)
                        save_raw(claim, request.pk, raw)
            else:
                write_claim(claim, processing_state='transcribing')
                raw = saved.raw_response
            if claim.transcript is None:
                normalized = transcription._normalize(raw)
                write_claim(claim, transcript={'text': normalized['text'], 'words': normalized['words']})
        write_claim(claim, processing_state='aligning')
        try:
            visits = align_words(claim.transcript['words'], claim.slide_events, claim.duration_ms)
        except (ValueError, KeyError, TypeError):
            raise transcription.TranscriptionError('alignment_failed',
                'Word timestamps do not fit this recording timeline. Audio and transcript are retained; '
                'retry reuses this transcript. Check recording timestamps before retrying.') from None
        saved = claim.provider_requests.filter(raw_received_at__isnull=False).order_by('-generation').first()
        raw = saved.raw_response if saved and isinstance(saved.raw_response, dict) else {}
        language = raw.get('language') if isinstance(raw.get('language'), str) else 'und'
        metrics = timing_metrics(visits, claim.duration_ms, claim.transcript['text'], language)
        write_claim(claim, visits=visits, metrics=metrics,
            analysis_outcome='no_speech' if claim.analysis_outcome == 'no_speech' else 'speech',
            status='completed', processing_state='completed', feedback=[], feedback_state='disabled',
            error=None, failed_stage='', retry_at=None, claim_token=None)
    except StaleClaim:
        return
    except Exception as error:
        safe = error if isinstance(error, transcription.TranscriptionError) else transcription.TranscriptionError(
            'processing_failed', 'Analysis stopped. Audio and any saved results are retained. Refresh before retrying.')
        try:
            fail(claim, safe)
        except StaleClaim:
            pass
        except Exception:
            # A failed database write must not cause another outbound call. Recovery reads the marker.
            logger.warning('Processing state could not be saved; recovery required.')


def recover_work():
    stale = timezone.now() - timedelta(seconds=STALE_SECONDS)
    ids = Attempt.objects.filter(processing_state__in=ACTIVE).values_list('pk', flat=True)
    for attempt_id in ids.iterator():
        with transaction.atomic():
            attempt = Attempt.objects.select_for_update().get(pk=attempt_id)
            if attempt.processing_state not in ACTIVE:
                continue
            if attempt.processing_state != 'queued':
                if attempt.claimed_at and attempt.claimed_at > stale:
                    continue
                request = attempt.provider_requests.filter(generation=attempt.processing_revision).first()
                if request and request.submitted_at and not request.raw_received_at:
                    attempt.failed_stage = attempt.processing_state
                    attempt.status = 'failed'
                    attempt.processing_state = 'needs_confirmation'
                    attempt.error = {'code': 'uncertain_submission', 'message':
                        'The worker stopped after submission. The request may have been charged; confirm before retrying.'}
                    request.outcome = 'uncertain'
                    request.finished_at = timezone.now()
                    request.save(update_fields=['outcome', 'finished_at'])
                else:
                    attempt.processing_state = 'queued'
                attempt.claim_token = None
                attempt.claimed_at = None
                attempt.save(update_fields=['processing_state', 'status', 'failed_stage', 'error', 'claim_token', 'claimed_at'])
            if attempt.processing_state == 'queued':
                transaction.on_commit(lambda id=attempt.pk, rev=attempt.processing_revision: publish(id, rev))
