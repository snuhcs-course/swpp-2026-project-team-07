"""Explicit saved-rehearsal coaching. PostgreSQL is the queue authority.

Lock order: deck/attempt (admission only), description set, analysis, feedback job,
bucket, request/reservation. Description PATCH takes the set lock; revision-aware
freshness under that same lock fences both submission and completion. No media,
provider I/O or output normalization under locks. Whisper is never invoked.
"""
from dataclasses import replace
from datetime import timedelta
import hashlib
import logging
import uuid

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import (Attempt, Deck, DescriptionSet, FeedbackAnalysis, FeedbackJob,
                      FeedbackRequest, FeedbackReservation)
from . import descriptions as descriptions_service, feedback_provider as provider
from .alignment import align_words
from .descriptions import (Conflict, StaleClaim, LEASE_SECONDS, _private_database_logging,
                           effective_retry_at, saved_receipt)
from .feedback import (FeedbackError, Transcript, validated, analysis_source, restore_analysis, json_bytes)
from .feedback_config import Selection, QuotaPolicy, coaching_digest, check_coaching_versions, enabled
from .feedback_quota import locked_bucket, reserve, cooldown

logger = logging.getLogger(__name__)
ACTIVE = {'waiting_descriptions', 'queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota'}


def safe_error(code):
    return {'code': code, 'message': f'Rehearsal feedback unavailable ({code}).'} if code else None


def _digest(value):
    return hashlib.sha256(json_bytes(value)).hexdigest()


def transcript_identity(attempt):
    if attempt.transcript is None:
        return None
    try:
        # JSONB reorders object keys. Use the same typed field order as the
        # evidence adapter, never raw database dict serialization.
        transcript = validated(Transcript, attempt.transcript).model_dump(mode='json')
        return _digest([str(attempt.pk), transcript])
    except FeedbackError:
        return None


def attempt_identity(attempt):
    return _digest([str(attempt.pk), str(attempt.deck_id), attempt.duration_ms, attempt.slide_events,
        attempt.audience, attempt.transcript, attempt.visits, attempt.processing_revision,
        (attempt.metrics or {}).get('detected_language') or 'und', attempt.audio.name, attempt.upload_hash])


def prepare_attempt(attempt):
    """Enumerate BEFORE align_words; copied indexes never come from text matching."""
    if attempt.analysis_outcome == 'no_speech':
        raise FeedbackError('no_speech')
    transcript = attempt.transcript
    if transcript is None:
        raise FeedbackError('missing_transcript')
    try:
        indexed = [{**w, 'original_index': i} for i, w in enumerate(transcript['words'])]
        visits = align_words(indexed, attempt.slide_events, attempt.duration_ms)
        plain = [{**v, 'words': [{k: x for k, x in w.items() if k != 'original_index'} for w in v['words']]} for v in visits]
        if plain != attempt.visits:
            raise FeedbackError('invalid_alignment')
        source = {'attempt_id': str(attempt.pk), 'deck_id': str(attempt.deck_id),
            'duration_ms': attempt.duration_ms, 'speaker_language': (attempt.metrics or {}).get('detected_language') or 'und',
            'audience': attempt.audience, 'transcript': transcript,
            'slides': [{'deck_id': str(attempt.deck_id), 'slide_index': s.slide_index,
                        'extracted_text': s.extracted_text, 'source_language': 'und'} for s in attempt.deck.slides.all()],
            'visits': [{k: v[k] for k in ('slide_index', 'start_ms', 'end_ms')} |
                       {'word_indexes': [w['original_index'] for w in v['words']]} for v in visits]}
        validated = analysis_source(source)  # Missing/invalid/no speech BEFORE deck preparation/admission.
        if len(validated.slides) != attempt.deck.page_count:
            raise FeedbackError('invalid_slides')
        return source
    except (KeyError, TypeError, ValueError, AttributeError):
        raise FeedbackError('invalid_transcript') from None


def publish(analysis_id, revision):
    from ..tasks import coach_attempt
    try:
        coach_attempt.delay(analysis_id, revision)
    except Exception:
        logger.warning('Coaching publish unavailable; durable queue retained.')


def _stale(value, job):
    if job.descriptions_snapshot is not None:
        return value.description_revision != job.description_revision
    # Natural completion keeps the dependency generation. PATCH advances it.
    return value.processing_revision != job.description_generation


def _source_current(job):
    attempt = Attempt.objects.get(pk=job.analysis.attempt_id)
    value = job.description_set
    deck = Deck.objects.get(pk=value.deck_id)
    return (attempt_identity(attempt) == job.source_snapshot['attempt_identity'] and
            descriptions_service.storage_identity(deck, list(deck.slides.all())) == value.source_snapshot['storage'])


def _locked(analysis_id, revision):
    owner = FeedbackJob.objects.only('description_set_id').get(analysis_id=analysis_id, generation=revision)
    value = DescriptionSet.objects.select_for_update().get(pk=owner.description_set_id)
    analysis = FeedbackAnalysis.objects.select_for_update().get(pk=analysis_id)
    job = FeedbackJob.objects.select_for_update().get(analysis=analysis, generation=revision)
    return value, analysis, job


def _superseded(value, analysis, job):
    return analysis.feedback_revision != job.generation or _stale(value, job) or not _source_current(job)


def _fresh(value, analysis, job, token):
    if (_superseded(value, analysis, job) or job.claim_token != token or job.state not in ACTIVE
            or not job.claimed_at or job.claimed_at <= timezone.now() - timedelta(seconds=LEASE_SECONDS)):
        raise StaleClaim()


def _uncertain(request):
    return bool(request and (request.outcome == 'uncertain' or
        # A description edit can make work retryable between save and normalize.
        # A durable receipt alone does not establish a certain provider outcome.
        (request.received_at and not request.completed_at and
         provider.receipt_is_uncertain(request.status_code, request.body_complete)) or
        (request.submitted_at and not request.received_at and not request.completed_at)))


def _attach(value, job):
    # Called only with set and job locks. Copy exact revision, including edits.
    if value.descriptions is not None and job.descriptions_snapshot is None:
        job.descriptions_snapshot = value.descriptions
        job.description_revision = value.description_revision
        job.state = 'queued'
        job.save(update_fields=['descriptions_snapshot', 'description_revision', 'state', 'updated_at'])


@_private_database_logging()
def generate(attempt_id, payload):
    attempt = Attempt.objects.select_related('deck').get(pk=attempt_id)
    existing = FeedbackAnalysis.objects.filter(attempt=attempt).first()
    if existing:
        # Existing analysis always retries its captured selection/source. Never
        # prepare media, select the current provider or retry its dependency here.
        with transaction.atomic():
            value, analysis, old = _locked(existing.pk, existing.feedback_revision)
            if old.generation != analysis.feedback_revision:
                raise Conflict('stale_revision')
            revision = payload.get('feedback_revision')
            if revision is not None and revision != analysis.feedback_revision:
                raise Conflict('stale_revision')
            stale = _stale(value, old) or not _source_current(old)
            if not stale and (old.state in ACTIVE or old.state == 'completed'):
                return analysis
            if revision is None:
                raise Conflict('revision_required')
            request = FeedbackRequest.objects.filter(coaching_job=old).first()
            if _uncertain(request) and not payload.get('acknowledge_uncertain'):
                raise Conflict('confirmation_required')
            retry_at = effective_retry_at(value, old)
            if retry_at and retry_at > timezone.now():
                raise Conflict('retry_not_available')
            if not _source_current(old):
                raise Conflict('source_changed')
            selection = Selection.saved(value)
            selection.check_versions(value.prompt_digest)
            check_coaching_versions(old)
            selection.credentials()
            QuotaPolicy.current(selection)
            return _queue(analysis, value, old.source_snapshot, old)
    if payload:  # A retry can never create an initial analysis.
        raise Conflict('stale_revision')
    source = prepare_attempt(attempt)
    selection = Selection.current()
    selection.credentials()
    QuotaPolicy.current(selection)
    deck, snapshot = descriptions_service.prepare_saved(attempt.deck_id)
    prepared = restore_analysis(source, deck)
    description_request = selection.adapter().prepare_descriptions(deck)
    captured = {'source': source, 'attempt_identity': attempt_identity(attempt),
                'analysis_id': prepared.input_id, 'transcript_id': prepared.transcript_id,
                'chronology_id': _digest([attempt.duration_ms, attempt.slide_events])}
    # The description intent and feedback dependency commit together.
    with transaction.atomic():
        locked_deck = Deck.objects.select_for_update().get(pk=attempt.deck_id)
        current_attempt = Attempt.objects.select_for_update().get(pk=attempt_id)
        if attempt_identity(current_attempt) != captured['attempt_identity']:
            raise Conflict('source_changed')
        descriptions_service.check_storage(locked_deck, snapshot)
        # Serializing initial admission on the deck/attempt also deduplicates a
        # second caller that observed no analysis before preparing its input.
        current = FeedbackAnalysis.objects.filter(attempt_id=attempt_id).first()
        if current:
            # Recheck active/completed vs failed/stale and retry requirements if
            # another caller admitted while this caller prepared its snapshots.
            return generate(attempt_id, payload)
        value = descriptions_service.admit_prepared(selection, deck, snapshot, dependency=True, candidate=description_request)
        analysis = FeedbackAnalysis.objects.create(attempt=current_attempt)
        return _queue(analysis, value, captured)


def _queue(analysis, value, snapshot, previous=None):
    analysis.feedback_revision += 1
    analysis.save(update_fields=['feedback_revision', 'updated_at'])
    job = FeedbackJob.objects.create(analysis=analysis, generation=analysis.feedback_revision,
        description_set=value, description_generation=value.processing_revision, source_snapshot=snapshot,
        prompt_version=previous.prompt_version if previous else provider.COACHING_PROMPT_VERSION,
        schema_version=previous.schema_version if previous else provider.COACHING_SCHEMA_VERSION,
        prompt_digest=previous.prompt_digest if previous else coaching_digest(), queued_at=timezone.now())
    _attach(value, job)
    transaction.on_commit(lambda: publish(analysis.pk, job.generation))
    return analysis


def _prepared(value, job):
    selection = Selection.saved(value)
    selection.check_versions(value.prompt_digest)
    check_coaching_versions(job)
    deck = descriptions_service.snapshot_deck(value)
    analysis = restore_analysis(job.source_snapshot['source'], deck)
    if (analysis.input_id != job.source_snapshot['analysis_id'] or
            analysis.transcript_id != job.source_snapshot['transcript_id']):
        raise FeedbackError('snapshot_unavailable')
    descriptions = selection.adapter().edited_descriptions(analysis, job.descriptions_snapshot)
    prepared = selection.adapter().prepare_coaching(analysis, descriptions)
    if job.input_hash and prepared.input_hash != job.input_hash:
        raise FeedbackError('snapshot_unavailable')
    return prepared


@_private_database_logging()
def claim(analysis_id, revision):
    with transaction.atomic():
        value, analysis, job = _locked(analysis_id, revision)
        request = FeedbackRequest.objects.filter(coaching_job=job).first()
        if _superseded(value, analysis, job):
            if (not request or not request.received_at or request.completed_at or
                    (job.claim_token and job.claimed_at and job.claimed_at > timezone.now() - timedelta(seconds=LEASE_SECONDS))):
                return None
            job.claim_token, job.claimed_at = uuid.uuid4(), timezone.now()
            job.save(update_fields=['claim_token', 'claimed_at', 'updated_at'])
            return value, job, request
        if job.state == 'waiting_descriptions':
            _attach(value, job)
        if job.state != 'queued' or job.claim_token:
            return None
        if request and (request.completed_at or (request.submitted_at and not request.received_at)):
            return None
        job.claim_token, job.claimed_at = uuid.uuid4(), timezone.now()
        job.state = 'normalizing' if request and request.received_at else 'preparing'
        job.save(update_fields=['claim_token', 'claimed_at', 'state', 'updated_at'])
        if request and not request.submitted_at:
            request.claim_token, request.claimed_at = job.claim_token, job.claimed_at
            request.save(update_fields=['claim_token', 'claimed_at'])
        return value, job, request


@_private_database_logging()
def submit(value, job, prepared):
    """Persistence failure propagates to lease recovery, NEVER to another call."""
    with transaction.atomic():
        current, analysis, locked_job = _locked(job.analysis_id, job.generation)
        _fresh(current, analysis, locked_job, job.claim_token)
        selection = Selection.saved(current)
        bucket = locked_bucket(selection)
        selection.check_versions(current.prompt_digest)
        check_coaching_versions(locked_job)
        if (prepared.analysis.input_id != locked_job.source_snapshot['analysis_id'] or
                prepared.descriptions.model_dump(mode='json') != locked_job.descriptions_snapshot or
                (locked_job.input_hash and prepared.input_hash != locked_job.input_hash)):
            raise FeedbackError('snapshot_unavailable')
        descriptions_service.check_storage(Deck.objects.get(pk=current.deck_id), current.source_snapshot)
        config, policy = selection.credentials(), QuotaPolicy.current(selection)
        request, _ = FeedbackRequest.objects.get_or_create(coaching_job=locked_job, defaults={
            'generation': locked_job.generation, 'claim_token': locked_job.claim_token,
            'provider': current.provider, 'project_id': current.project_id, 'model': current.model, 'stage': 'coaching',
            'input_hash': prepared.input_hash, 'queued_at': locked_job.queued_at, 'claimed_at': locked_job.claimed_at})
        if request.submitted_at or request.claim_token != job.claim_token or request.input_hash != prepared.input_hash:
            raise StaleClaim()
        _fresh(current, analysis, locked_job, job.claim_token)
        reserve(bucket, request, len(prepared.payload) + provider.OUTPUT_TOKENS['coaching'], policy)
        request.submitted_at, request.outcome = timezone.now(), 'submitted'
        request.save(update_fields=['submitted_at', 'outcome'])
        locked_job.input_hash, locked_job.state = prepared.input_hash, 'submitted'
        locked_job.save(update_fields=['input_hash', 'state', 'updated_at'])
    # Return a committed request identity; no I/O occurs before this boundary.
    return replace(prepared, config=config), request


@_private_database_logging()
def save_receipt(value, job, request, receipt, *, credential=None):
    if credential and credential.encode('ascii') in receipt.body:
        receipt = replace(receipt, body=receipt.body.replace(credential.encode('ascii'), b''),
                          body_complete=False, body_issue='credential_redacted')
    with transaction.atomic():
        current, analysis, old_job = _locked(job.analysis_id, job.generation)
        bucket = locked_bucket(Selection.saved(current))
        record = FeedbackRequest.objects.select_for_update().get(pk=request.pk)
        if (not record.submitted_at or record.claim_token != request.claim_token or
                (receipt.provider, receipt.model, receipt.stage, receipt.input_hash) !=
                (record.provider, record.model, record.stage, record.input_hash) or len(receipt.body) > provider.MAX_RESPONSE_BYTES):
            raise FeedbackError('receipt_mismatch', uncertain=True)
        if record.received_at:
            return saved_receipt(record)
        record.raw_body, record.status_code = receipt.body, receipt.status_code
        record.body_complete, record.body_issue = receipt.body_complete, receipt.body_issue
        record.retry_at, record.usage = receipt.retry_at, dict(receipt.usage) or None
        record.received_at, record.outcome, record.completed_at = timezone.now(), 'received', None
        record.save(update_fields=['raw_body', 'status_code', 'body_complete', 'body_issue', 'retry_at', 'usage',
                                   'received_at', 'outcome', 'completed_at'])
        if receipt.status_code == 429:
            cooldown(bucket, receipt.retry_at)
        if (not _superseded(current, analysis, old_job) and
                (old_job.state == 'needs_confirmation' or (old_job.claimed_at and
                 old_job.claimed_at <= timezone.now() - timedelta(seconds=LEASE_SECONDS)))):
            old_job.state, old_job.claim_token, old_job.completed_at = 'queued', None, None
            old_job.save(update_fields=['state', 'claim_token', 'completed_at', 'updated_at'])
            transaction.on_commit(lambda: publish(analysis.pk, old_job.generation))
    return receipt


@_private_database_logging()
def finish(value, job, result=None, error=None):
    with transaction.atomic():
        current, analysis, locked_job = _locked(job.analysis_id, job.generation)
        request = FeedbackRequest.objects.select_for_update().filter(coaching_job=locked_job).first()
        try:
            _fresh(current, analysis, locked_job, job.claim_token)
            fresh = True
        except StaleClaim:
            fresh = False
        superseded = _superseded(current, analysis, locked_job)
        if not fresh:
            if not superseded:
                return
            if locked_job.claim_token:
                if (locked_job.claim_token != job.claim_token or not locked_job.claimed_at or
                        locked_job.claimed_at <= timezone.now() - timedelta(seconds=LEASE_SECONDS)):
                    return
            elif not request or request.claim_token != job.claim_token:
                return
        waiting = error and error.code == 'waiting_quota' and (not request or not request.submitted_at)
        uncertain = bool(error and error.uncertain)
        if error and request and request.submitted_at and not request.received_at:
            uncertain = error.uncertain or error.code not in {'invalid_request', 'request_too_large', 'invalid_destination', 'missing_api_key', 'invalid_configuration'}
        if request and not request.completed_at and (request.claim_token == job.claim_token or request.received_at):
            request.outcome = ('local' if not request.submitted_at else 'uncertain' if uncertain else
                'rejected' if error and request.status_code and request.status_code != 200 else
                'invalid' if error or (result and result.state == 'all_invalid') else 'completed')
            request.error_code = error.code if error else 'unsupported_feedback' if result and result.state == 'all_invalid' else ''
            request.completed_at = None if waiting else timezone.now()
            request.save(update_fields=['outcome', 'error_code', 'completed_at'])
        if not fresh:
            if locked_job.claim_token == job.claim_token:
                locked_job.claim_token = None
                locked_job.save(update_fields=['claim_token', 'updated_at'])
            return  # Late receipt/usage is final, newer result/edit is untouched.
        if result is not None:
            locked_job.result = {'status': result.state, 'accepted_count': result.accepted_count,
                'discarded_count': result.discarded_count,
                'suggestions': [s.model_dump(mode='json') for s in result.suggestions]}
            if result.state == 'all_invalid':
                error = FeedbackError('unsupported_feedback')
        locked_job.state = 'waiting_quota' if waiting else 'needs_confirmation' if uncertain else 'failed' if error else 'completed'
        locked_job.error_code = error.code if error else ''
        locked_job.retry_at = error.retry_at if error else None
        locked_job.completed_at = None if waiting else timezone.now()
        locked_job.claim_token = None
        locked_job.save(update_fields=['result', 'state', 'error_code', 'retry_at', 'completed_at', 'claim_token', 'updated_at'])


@_private_database_logging()
def run_coaching(analysis_id, revision):
    try:
        claimed = claim(analysis_id, revision)
    except (FeedbackAnalysis.DoesNotExist, FeedbackJob.DoesNotExist):
        return
    if claimed is None:
        return
    value, job, request = claimed
    result, safe = None, None
    try:
        prepared = _prepared(value, job)
        if request and request.received_at:
            receipt = saved_receipt(request)  # No credentials/media/provider required.
        else:
            try:
                prepared, request = submit(value, job, prepared)
            except (FeedbackError, StaleClaim):
                raise
            except Exception:
                logger.warning('Coaching submission persistence unavailable; recovery required.')
                return
            receipt = provider.request_raw(prepared)
            try:
                receipt = save_receipt(value, job, request, receipt, credential=prepared.config.key)
            except Exception:
                logger.warning('Coaching receipt could not be saved; recovery required.')
                return
        result = provider.normalize(prepared, receipt)
    except StaleClaim:
        return
    except Exception as error:
        safe = error if isinstance(error, FeedbackError) else FeedbackError('processing_failed')
    try:
        finish(value, job, result=result, error=safe)
    except Exception:
        logger.warning('Coaching state could not be saved; recovery required.')


@_private_database_logging()
def recover_coaching():
    ids = FeedbackJob.objects.filter(Q(state__in=ACTIVE) |
        Q(request__received_at__isnull=False, request__completed_at__isnull=True)).values_list('analysis_id', 'generation')
    for analysis_id, revision in ids.iterator():
        with transaction.atomic():
            value, analysis, job = _locked(analysis_id, revision)
            now = timezone.now()
            if (job.claim_token and job.claimed_at and job.claimed_at > now - timedelta(seconds=LEASE_SECONDS)):
                continue
            request = FeedbackRequest.objects.select_for_update().filter(coaching_job=job).first()
            unfinished = request and request.received_at and not request.completed_at
            if _superseded(value, analysis, job):
                if unfinished:
                    transaction.on_commit(lambda id=analysis_id, rev=revision: publish(id, rev))
                elif request and request.submitted_at and not request.received_at and request.outcome == 'submitted':
                    request.outcome, request.completed_at = 'uncertain', now
                    request.save(update_fields=['outcome', 'completed_at'])
                if not unfinished and job.state in ACTIVE:
                    job.state, job.claim_token = 'superseded', None
                    job.save(update_fields=['state', 'claim_token', 'updated_at'])
                continue
            if job.state not in ACTIVE and not unfinished:
                continue
            if job.state == 'waiting_descriptions':
                _attach(value, job)
                if job.state == 'waiting_descriptions':
                    continue  # Failed dependencies have their own explicit retry.
            previous = (job.state, job.claim_token, job.error_code, job.completed_at)
            if request and request.submitted_at and not request.received_at:
                request.outcome, request.completed_at = 'uncertain', now
                request.save(update_fields=['outcome', 'completed_at'])
                job.state, job.error_code, job.completed_at = 'needs_confirmation', 'uncertain_submission', now
            elif request and request.completed_at:
                job.state = 'needs_confirmation' if request.outcome == 'uncertain' else 'failed'
                job.error_code, job.completed_at = request.error_code or 'processing_failed', now
            elif job.state == 'waiting_quota' and job.retry_at and job.retry_at > now:
                continue
            else:
                if request and not request.submitted_at:
                    FeedbackReservation.objects.filter(request=request, submitted_at__isnull=True,
                        released_at__isnull=True).update(released_at=now)
                job.state = 'queued'
            job.claim_token = None
            if (job.state, job.claim_token, job.error_code, job.completed_at) != previous:
                job.save(update_fields=['state', 'claim_token', 'error_code', 'completed_at', 'updated_at'])
            if job.state == 'queued':
                transaction.on_commit(lambda id=analysis_id, rev=revision: publish(id, rev))


def _availability(selection=None):
    try:
        enabled()
        selection = selection or Selection.current()
        selection.credentials()
        QuotaPolicy.current(selection)
        return {'state': 'available', 'error': None}
    except FeedbackError as error:
        return {'state': 'disabled' if error.code == 'disabled' else 'unavailable', 'error': safe_error(error.code)}


def _provenance(value, job):
    return {**Selection.saved(value).scope(), 'coaching_prompt_version': job.prompt_version,
            'coaching_schema_version': job.schema_version}


def _result(value, job, current_job):
    if not job or job.result is None:
        return None
    source = job.source_snapshot['source']
    return {**{k: job.result[k] for k in ('status', 'accepted_count', 'discarded_count', 'suggestions')},
        'message': 'No supported suggestions.' if job.result['status'] == 'empty' else None,
        'feedback_revision': job.generation, 'description_set_id': str(value.pk),
        'description_revision': job.description_revision, 'provenance': _provenance(value, job),
        'completed_at': job.completed_at, 'stale': job.pk != current_job.pk or _stale(value, job) or not _source_current(job),
        'evidence': {'attempt_id': source['attempt_id'], 'deck_id': source['deck_id'],
            'transcript_id': job.source_snapshot['transcript_id'], 'chronology_id': job.source_snapshot['chronology_id'],
            'duration_ms': source['duration_ms'], 'page_count': len(source['slides']),
            'audience_supplied': bool(source['audience'].strip()),
            'visits': source['visits'], 'sources': [{'slide_index': i, 'source_id': sid}
                for i, sid in enumerate(value.source_snapshot['source_ids'])],
            'descriptions': job.descriptions_snapshot}}


@_private_database_logging()
def read(attempt_id):
    Attempt.objects.only('id').get(pk=attempt_id)
    analysis = FeedbackAnalysis.objects.filter(attempt_id=attempt_id).first()
    if analysis is None:
        availability = _availability()
        return {'attempt_id': str(attempt_id), 'feedback_revision': 0,
            'state': 'absent' if availability['state'] == 'available' else availability['state'],
            'stage': None, 'availability': availability, 'provenance': None, 'description_set_id': None,
            'description_revision': None, 'dependency': None, 'created_at': None, 'updated_at': None,
            'queued_at': None, 'claimed_at': None, 'submitted_at': None, 'received_at': None, 'completed_at': None,
            'retry_at': None, 'retry_available': False, 'requires_confirmation': False, 'stale': False,
            'error': availability['error'], 'result': None, 'last_output': None}
    with transaction.atomic():
        value, analysis, job = _locked(analysis.pk, analysis.feedback_revision)
        # An admission between the initial read and lock can only advance within
        # this same immutable set. Reload the current job under its analysis lock.
        if job.generation != analysis.feedback_revision:
            job = analysis.jobs.select_for_update().get(generation=analysis.feedback_revision)
        request = FeedbackRequest.objects.filter(coaching_job=job).first()
        stale = _stale(value, job) or not _source_current(job)
        state = 'stale' if stale else job.state
        retry_at = effective_retry_at(value, job)
        dependency = None
        if job.descriptions_snapshot is None:
            dep = descriptions_service.public_state(value.deck_id, value, source=value.source_fingerprint)
            dependency = {k: dep[k] for k in ('deck_id', 'description_set_id', 'state', 'processing_revision',
                'description_revision', 'updated_at', 'error', 'retry_at', 'retry_available', 'requires_confirmation')}
            dependency['retry_action'] = 'generate_descriptions' if dep['retry_available'] or dep['state'] in {'failed', 'needs_confirmation'} else None
        prior = job if job.result and job.result['status'] != 'all_invalid' else analysis.jobs.filter(
            result__isnull=False).exclude(result__status='all_invalid').order_by('-generation').first()
        if prior is None and job.result:
            prior = job
        result = _result(value, prior, job)
        error = job.error_code or ('descriptions_changed' if stale else '')
        if dependency and dependency['error'] and not error:
            error = 'description_dependency_failed'
        # A current-generation receipt can resolve uncertainty after an edit
        # without touching the stale job. Old generations' receipts must not
        # advance this snapshot's freshness or resurrect cached confirmation.
        updates = [job.updated_at, value.updated_at]
        if request:
            updates.extend(t for t in (request.received_at, request.completed_at) if t is not None)
        return {'attempt_id': str(attempt_id), 'feedback_revision': analysis.feedback_revision,
            'state': state, 'stage': 'descriptions' if job.descriptions_snapshot is None else 'coaching',
            'availability': _availability(Selection.saved(value)), 'provenance': _provenance(value, job),
            'description_set_id': str(value.pk), 'description_revision': job.description_revision,
            'dependency': dependency, 'created_at': analysis.created_at,
            'updated_at': max(updates),
            'queued_at': job.queued_at, 'claimed_at': job.claimed_at, 'submitted_at': request.submitted_at if request else None,
            'received_at': request.received_at if request else None, 'completed_at': job.completed_at,
            'retry_at': retry_at, 'retry_available': state in {'failed', 'needs_confirmation', 'stale'} and
                (not retry_at or retry_at <= timezone.now()),
            'requires_confirmation': bool(request and (request.outcome == 'uncertain' or (stale and _uncertain(request)))), 'stale': stale, 'error': safe_error(error),
            'result': result, 'last_output': {k: job.result[k] for k in ('status', 'accepted_count', 'discarded_count')} if job.result else None}
