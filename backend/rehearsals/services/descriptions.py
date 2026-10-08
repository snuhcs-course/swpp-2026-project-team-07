"""Saved-deck descriptions: database queue, immutable scopes and fenced writes.

All mutation lock order: deck (admission/edit only) -> set -> job -> quota bucket
-> request/reservation. Never hold transactions while reading/decoding media or
calling a provider. Receipt evidence belongs to its submitted request even after
an edit fences permission to change the set. No attempt processing is invoked.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import replace
from datetime import timedelta
import hashlib
import logging
import uuid

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import Deck, DescriptionSet, DescriptionJob, FeedbackRequest, FeedbackReservation, FeedbackQuotaBucket, FeedbackJob
from . import feedback_provider as provider
from .feedback import (DeckInput, PreparedDeck, FeedbackError, MAX_IMAGE_BYTES, deck_identity,
                       prepare_deck, validated, validate_descriptions)
from .feedback_config import Selection, QuotaPolicy, prompt_digest, enabled
from .feedback_quota import locked_bucket, reserve, cooldown

logger = logging.getLogger(__name__)
LEASE_SECONDS = 360
ACTIVE = {'queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota'}


_private_database_call = ContextVar('private_description_database', default=False)


class _PrivateDatabaseLogFilter(logging.Filter):
    def filter(self, record):
        return not _private_database_call.get()


_database_log_filter = _PrivateDatabaseLogFilter()


@contextmanager
def _private_database_logging():
    # DEBUG SQL contains bound JSON/BinaryField values. Suppress the producing
    # logger for this synchronous call only, never unrelated threads/requests.
    logging.getLogger('django.db.backends').addFilter(_database_log_filter)
    token = _private_database_call.set(True)
    try:
        yield
    finally:
        _private_database_call.reset(token)


class Conflict(FeedbackError):
    pass


class StaleClaim(Exception):
    pass


def safe_error(code):
    return {'code': code, 'message': f'Slide descriptions unavailable ({code}).'} if code else None


def _read(file, limit):
    try:
        with file.open('rb') as source:
            data = source.read(limit + 1)
        if not data or len(data) > limit:
            raise FeedbackError('invalid_source')
        return data
    except (OSError, ValueError):
        raise FeedbackError('source_unavailable') from None


def storage_identity(deck, slides):
    # Detect a source-row replacement after preparation, without file I/O in locks.
    return [str(deck.pk), deck.pdf.name, deck.content_hash, deck.preparation_version, deck.page_count,
            [[s.pk, s.slide_index, s.image.name, s.extracted_text] for s in slides]]


def prepare_saved(deck_id):
    deck = Deck.objects.get(pk=deck_id)
    slides = list(deck.slides.all())
    if not 1 <= deck.page_count <= 10 or len(slides) != deck.page_count:
        raise FeedbackError('invalid_slides')
    pdf = _read(deck.pdf, 20 * 1024 * 1024)
    digest = hashlib.sha256(pdf).hexdigest()
    if not pdf.startswith(b'%PDF-') or (deck.content_hash and deck.content_hash != digest):
        raise FeedbackError('invalid_source')
    value = {'deck_id': str(deck.pk), 'content_hash': digest, 'preparation_version': deck.preparation_version,
             'slides': [{'deck_id': str(deck.pk), 'slide_index': s.slide_index,
                         'extracted_text': s.extracted_text, 'source_language': 'und'} for s in slides]}
    images = tuple(_read(s.image, MAX_IMAGE_BYTES) for s in slides)
    prepared = prepare_deck(value, images)
    snapshot = {'source': prepared.source.model_dump(mode='json'), 'source_ids': list(prepared.source_ids),
                'storage': storage_identity(deck, slides)}
    return prepared, snapshot


def snapshot_deck(value):
    """Normalize a saved receipt even if media or credentials are unavailable."""
    snapshot = value.source_snapshot
    try:
        source = validated(DeckInput, snapshot['source'])
        ids = tuple(snapshot['source_ids'])
        if (len(ids) != len(source.slides) or any(type(v) is not str or len(v) != 64 for v in ids)
                or source.deck_id != str(value.deck_id) or deck_identity(source, ids) != value.source_fingerprint):
            raise FeedbackError('snapshot_unavailable')
        return PreparedDeck(source, (), ids, value.source_fingerprint)
    except (KeyError, TypeError):
        raise FeedbackError('snapshot_unavailable') from None


def check_storage(deck, snapshot):
    if storage_identity(deck, list(deck.slides.all())) != snapshot['storage']:
        raise Conflict('source_changed')


def publish(set_id, revision):
    from ..tasks import describe_deck
    try:
        describe_deck.delay(str(set_id), revision)
    except Exception:
        logger.warning('Description publish unavailable; durable queue retained.')


def _queue(value):
    previous_revision = value.processing_revision
    value.processing_revision += 1
    value.save(update_fields=['processing_revision', 'updated_at'])
    DescriptionJob.objects.create(description_set=value, generation=value.processing_revision,
        description_revision=value.description_revision, queued_at=timezone.now())
    # Only explicit description retry advances an unfulfilled dependency. PATCH
    # does not take this path, so an edit requires explicit coaching reanalysis.
    FeedbackJob.objects.filter(description_set=value, description_generation=previous_revision,
        descriptions_snapshot__isnull=True, state='waiting_descriptions', claim_token__isnull=True).update(
            description_generation=value.processing_revision, updated_at=timezone.now())
    transaction.on_commit(lambda id=value.pk, rev=value.processing_revision: publish(id, rev))
    return value


@_private_database_logging()
def generate(deck_id, payload):
    """Initial cache lookup or explicit, single-consumption failed retry."""
    Deck.objects.only('pk').get(pk=deck_id)
    set_id = payload.get('description_set_id')
    if set_id:
        # Resolve ownership before configuration; no client chooses provider/model.
        existing = DescriptionSet.objects.get(pk=set_id, deck_id=deck_id)
        with transaction.atomic():
            value = DescriptionSet.objects.select_for_update().get(pk=existing.pk)
            revision = payload.get('processing_revision')
            if revision is not None and revision != value.processing_revision:
                raise Conflict('stale_revision')
            if value.descriptions is not None:
                return value
            job = value.jobs.select_for_update().get(generation=value.processing_revision)
            if job.state in ACTIVE:
                return value
            if revision is None:
                raise Conflict('revision_required')
            if job.state == 'needs_confirmation' and not payload.get('acknowledge_uncertain'):
                raise Conflict('confirmation_required')
            retry_at = effective_retry_at(value, job)
            if retry_at and retry_at > timezone.now():
                raise Conflict('retry_not_available')
            selection = Selection.saved(value)
            selection.check_versions(value.prompt_digest)
            selection.credentials()
            QuotaPolicy.current(selection)
            return _queue(value)
    selection = Selection.current()
    prepared, snapshot = prepare_saved(deck_id)
    return admit_prepared(selection, prepared, snapshot)


def admit_prepared(selection, prepared, snapshot, *, dependency=False, candidate=None):
    """Internal captured-selection seam; caller has validated speech first.

    A dependency can reuse failed work but NEVER retries it. Its explicit route
    requires the independent processing revision and uncertainty acknowledgement.
    Preparation happens before locks; the enclosing coaching admission is atomic.
    """
    deck_id = prepared.source.deck_id
    scope = dict(deck_id=deck_id, source_fingerprint=prepared.input_id, **selection.scope())
    candidate = candidate or selection.adapter().prepare_descriptions(prepared)
    with transaction.atomic():
        deck = Deck.objects.select_for_update().get(pk=deck_id)
        check_storage(deck, snapshot)
        existing = DescriptionSet.objects.select_for_update().filter(**scope).first()
        if existing:
            if (dependency or existing.descriptions is not None or
                    existing.jobs.get(generation=existing.processing_revision).state in ACTIVE):
                return existing
            raise Conflict('revision_required')
        selection.credentials()
        QuotaPolicy.current(selection)
        value = DescriptionSet.objects.create(**scope, source_snapshot=snapshot,
            prompt_digest=prompt_digest(), input_hash=candidate.input_hash)
        return _queue(value)


@_private_database_logging()
def edit(deck_id, payload):
    existing = DescriptionSet.objects.get(pk=payload['description_set_id'], deck_id=deck_id)
    prepared, snapshot = prepare_saved(deck_id)
    if prepared.input_id != existing.source_fingerprint:
        raise Conflict('source_changed')
    descriptions = validate_descriptions(payload['descriptions'], prepared).model_dump(mode='json')
    with transaction.atomic():
        deck = Deck.objects.select_for_update().get(pk=deck_id)
        check_storage(deck, snapshot)
        value = DescriptionSet.objects.select_for_update().get(pk=existing.pk)
        if value.source_fingerprint != prepared.input_id or value.description_revision != payload['description_revision']:
            raise Conflict('stale_description_revision')
        # Supersede the job, not its request evidence. A late submitted receipt and
        # usage still persist; no stale worker can overwrite these edits.
        job = value.jobs.select_for_update().filter(generation=value.processing_revision).first()
        if job and job.state in ACTIVE:
            job.state, job.claim_token, job.completed_at = 'superseded', None, timezone.now()
            job.save(update_fields=['state', 'claim_token', 'completed_at'])
            FeedbackRequest.objects.filter(job=job, submitted_at__isnull=True).update(
                outcome='local', error_code='superseded', completed_at=timezone.now())
        value.descriptions, value.edited = descriptions, True
        value.description_revision += 1
        value.processing_revision += 1
        value.save(update_fields=['descriptions', 'edited', 'description_revision', 'processing_revision', 'updated_at'])
        return value


def effective_retry_at(value, job):
    blocked = FeedbackQuotaBucket.objects.filter(provider=value.provider, project_id=value.project_id,
        model=value.model).values_list('blocked_until', flat=True).first()
    dates = [d for d in [job.retry_at if job else None, blocked] if d]
    return max(dates) if dates else None


@_private_database_logging()
@transaction.atomic
def public_state(deck_id, value=None, *, absent='absent', source=None):
    """Explicit allowlist. Never serialize model __dict__, snapshot or request."""
    now = timezone.now()
    if value is None:
        return {'deck_id': str(deck_id), 'description_set_id': None, 'state': absent, 'stage': None,
            'processing_revision': 0, 'description_revision': 0, 'descriptions': None, 'edited': False,
            'provenance': None, 'created_at': None, 'updated_at': None, 'queued_at': None,
            'claimed_at': None, 'submitted_at': None, 'received_at': None, 'completed_at': None,
            'error': safe_error(absent) if absent != 'absent' else None, 'retry_at': None,
            'retry_available': False, 'requires_confirmation': False, 'stale': False, 'available_data': False}
    # A short read lock prevents a completed job being paired with a stale copy
    # of the set's null data/revision. Media preparation happened before this.
    value = DescriptionSet.objects.select_for_update().get(pk=value.pk)
    job = value.jobs.order_by('-generation').first()
    request = FeedbackRequest.objects.filter(job=job).first() if job else None
    state = 'completed' if value.descriptions is not None else job.state if job else 'failed'
    retry_at = effective_retry_at(value, job)
    try:
        selection = Selection.current()
        current_scope = selection.scope() == Selection.saved(value).scope()
    except FeedbackError:
        current_scope = False
    return {'deck_id': str(deck_id), 'description_set_id': str(value.pk), 'state': state,
        'stage': 'descriptions', 'processing_revision': value.processing_revision,
        'description_revision': value.description_revision, 'descriptions': value.descriptions, 'edited': value.edited,
        'provenance': {**Selection.saved(value).scope(), 'origin': 'edited' if value.edited else 'generated' if value.descriptions is not None else None,
                       'sources': [{'slide_index': i, 'source_id': sid} for i, sid in enumerate(value.source_snapshot['source_ids'])]},
        'created_at': value.created_at, 'updated_at': value.updated_at,
        'queued_at': job.queued_at if job else None, 'claimed_at': job.claimed_at if job else None,
        'submitted_at': request.submitted_at if request else None, 'received_at': request.received_at if request else None,
        'completed_at': value.updated_at if value.descriptions is not None else job.completed_at if job else None,
        'error': safe_error(job.error_code) if job and state != 'completed' else None,
        'retry_at': retry_at, 'retry_available': state in {'failed', 'needs_confirmation'} and (not retry_at or retry_at <= now),
        'requires_confirmation': state == 'needs_confirmation', 'stale': not current_scope or source != value.source_fingerprint,
        'available_data': value.descriptions is not None}


@_private_database_logging()
def read(deck_id, set_id=None):
    Deck.objects.get(pk=deck_id)
    value = DescriptionSet.objects.get(pk=set_id, deck_id=deck_id) if set_id else None
    try:
        selection = Selection.current()
    except FeedbackError:
        selection = None
    try:
        prepared, _ = prepare_saved(deck_id)
        source = prepared.input_id
    except FeedbackError:
        source = None
    if not value and selection and source:
        value = DescriptionSet.objects.filter(deck_id=deck_id, source_fingerprint=source, **selection.scope()).first()
    if value:
        return public_state(deck_id, value, source=source)
    try:
        enabled()
        if selection is None:
            raise FeedbackError('invalid_configuration')
        selection.credentials()
        QuotaPolicy.current(selection)
        absent = 'absent' if source else 'source_unavailable'
    except FeedbackError as error:
        absent = 'disabled' if error.code == 'disabled' else 'configuration_unavailable'
    return public_state(deck_id, absent=absent)


def _locked(set_id, revision):
    value = DescriptionSet.objects.select_for_update().get(pk=set_id)
    job = value.jobs.select_for_update().get(generation=revision)
    return value, job


def _fresh(value, job, token):
    if (value.processing_revision != job.generation or value.description_revision != job.description_revision
            or value.descriptions is not None or job.claim_token != token or job.state not in ACTIVE
            or not job.claimed_at or job.claimed_at <= timezone.now() - timedelta(seconds=LEASE_SECONDS)):
        raise StaleClaim()


@_private_database_logging()
def claim(set_id, revision):
    with transaction.atomic():
        value, job = _locked(set_id, revision)
        if value.processing_revision != revision or value.descriptions is not None:
            # Retry/edit can supersede a terminal job without changing its state.
            # Claim ONLY its unfinished saved receipt, never submission or a set
            # write. Preserve the original job outcome and request identity.
            request = FeedbackRequest.objects.filter(job=job).first()
            if (not request or not request.received_at or request.completed_at
                    or (job.claim_token and job.claimed_at and
                        job.claimed_at > timezone.now() - timedelta(seconds=LEASE_SECONDS))):
                return None
            job.claim_token, job.claimed_at = uuid.uuid4(), timezone.now()
            job.save(update_fields=['claim_token', 'claimed_at'])
            return value, job, request
        if value.processing_revision != revision or value.descriptions is not None or job.state != 'queued' or job.claim_token:
            return None
        request = FeedbackRequest.objects.filter(job=job).first()
        if request and request.submitted_at and not request.received_at:
            return None  # Recovery is the only authority for uncertain submission.
        if request and request.completed_at:
            return None
        job.claim_token, job.claimed_at = uuid.uuid4(), timezone.now()
        job.state = 'normalizing' if request and request.received_at else 'preparing'
        job.save(update_fields=['claim_token', 'claimed_at', 'state'])
        if not request:
            request = FeedbackRequest.objects.create(job=job, generation=revision, claim_token=job.claim_token,
                provider=value.provider, project_id=value.project_id, model=value.model, stage='descriptions',
                input_hash=value.input_hash, queued_at=job.queued_at, claimed_at=job.claimed_at)
        elif not request.submitted_at:
            request.claim_token, request.claimed_at = job.claim_token, job.claimed_at
            request.save(update_fields=['claim_token', 'claimed_at'])
        # The set's public freshness also covers its current dependency state,
        # not just generated/edited content. The set lock serializes these writes.
        value.save(update_fields=['updated_at'])
        return value, job, request


@_private_database_logging()
def submit(value, job, prepared):
    """Return credentialed request ONLY after reservation + submitted commit."""
    with transaction.atomic():
        current, locked_job = _locked(value.pk, job.generation)
        _fresh(current, locked_job, job.claim_token)
        selection = Selection.saved(current)
        bucket = locked_bucket(selection)
        request = FeedbackRequest.objects.select_for_update().get(job=locked_job)
        if request.submitted_at or request.claim_token != job.claim_token:
            raise StaleClaim()
        selection.check_versions(current.prompt_digest)
        if prepared.input_hash != current.input_hash or prepared.analysis.input_id != current.source_fingerprint:
            raise FeedbackError('snapshot_unavailable')
        check_storage(Deck.objects.get(pk=current.deck_id), current.source_snapshot)
        # After lock acquisition and immediately before the durable marker: recheck
        # enable/project/key/quota and claim freshness. Failure commits no marker.
        config = selection.credentials()
        policy = QuotaPolicy.current(selection)
        _fresh(current, locked_job, job.claim_token)
        reserve(bucket, request, len(prepared.payload) + provider.OUTPUT_TOKENS['descriptions'], policy)
        request.submitted_at, request.outcome = timezone.now(), 'submitted'
        request.save(update_fields=['submitted_at', 'outcome'])
        locked_job.state = 'submitted'
        locked_job.save(update_fields=['state'])
        current.save(update_fields=['updated_at'])
    return replace(prepared, config=config)


@_private_database_logging()
def save_receipt(value, job, request, receipt, *, credential=None):
    # A provider error can echo the submitted credential. Keep bounded evidence,
    # but never persist that key or normalize a credential-bearing success body.
    if credential and credential.encode('ascii') in receipt.body:
        receipt = replace(receipt, body=receipt.body.replace(credential.encode('ascii'), b''),
                          body_complete=False, body_issue='credential_redacted')
    # Independent of current description/job revision: late evidence is retained.
    with transaction.atomic():
        current, old_job = _locked(value.pk, job.generation)
        bucket = locked_bucket(Selection.saved(current))
        record = FeedbackRequest.objects.select_for_update().get(pk=request.pk)
        if (not record.submitted_at or record.claim_token != request.claim_token
                or (receipt.provider, receipt.model, receipt.stage, receipt.input_hash) !=
                   (record.provider, record.model, record.stage, record.input_hash)
                or len(receipt.body) > provider.MAX_RESPONSE_BYTES):
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
        if (current.processing_revision == old_job.generation and current.descriptions is None
                and (old_job.state == 'needs_confirmation' or (old_job.claimed_at and
                     old_job.claimed_at <= timezone.now() - timedelta(seconds=LEASE_SECONDS)))):
            # A response arriving after expiry resolves the no-receipt uncertainty.
            # Reclaim normalization under a new token; never submit again.
            old_job.state, old_job.claim_token, old_job.completed_at = 'queued', None, None
            old_job.save(update_fields=['state', 'claim_token', 'completed_at'])
            transaction.on_commit(lambda: publish(current.pk, old_job.generation))
        if current.processing_revision == old_job.generation and current.descriptions is None:
            current.save(update_fields=['updated_at'])
    return receipt


def saved_receipt(request):
    return provider.RawReceipt(request.provider, request.model, request.stage, request.input_hash,
        request.status_code, bytes(request.raw_body), request.body_complete, request.body_issue,
        request.retry_at, tuple((request.usage or {}).items()))


@_private_database_logging()
def finish(value, job, result=None, error=None):
    with transaction.atomic():
        current, locked_job = _locked(value.pk, job.generation)
        request = FeedbackRequest.objects.select_for_update().get(job=locked_job)
        # A stale worker cannot finalize evidence that a current recovery worker
        # still needs. Edits/new generations allow finalizing the OLD request only.
        try:
            _fresh(current, locked_job, job.claim_token)
            fresh = True
        except StaleClaim:
            fresh = False
        superseded = current.processing_revision != job.generation or current.descriptions is not None
        if not fresh and not superseded:
            return
        if not fresh and superseded:
            # A receipt-only recovery claim fences both expired normalizers and
            # the original in-flight worker. With no recovery claim, the original
            # submitting worker may still finalize its own late receipt.
            if locked_job.claim_token:
                if (locked_job.claim_token != job.claim_token or not locked_job.claimed_at
                        or locked_job.claimed_at <= timezone.now() - timedelta(seconds=LEASE_SECONDS)):
                    return
            elif request.claim_token != job.claim_token:
                return
        waiting = error and error.code == 'waiting_quota' and not request.submitted_at
        uncertain = bool(error and error.uncertain)
        if error and request.submitted_at and not request.received_at:
            # Only a classified local pre-transport failure has a known outcome.
            uncertain = error.uncertain or error.code not in {'invalid_request', 'request_too_large', 'invalid_destination', 'missing_api_key', 'invalid_configuration'}
        if not request.completed_at and (request.claim_token == job.claim_token or request.received_at):
            request.outcome = ('local' if not request.submitted_at else 'uncertain' if uncertain else
                               'rejected' if error and request.status_code and request.status_code != 200 else
                               'invalid' if error else 'completed')
            request.error_code = error.code if error else ''
            request.completed_at = None if waiting else timezone.now()
            request.save(update_fields=['outcome', 'error_code', 'completed_at'])
        if not fresh:
            if locked_job.claim_token == job.claim_token:
                locked_job.claim_token = None
                locked_job.save(update_fields=['claim_token'])
            return  # Commit evidence, keeping edited data/revisions/job outcome.
        if result is not None:
            current.descriptions, current.edited = result.descriptions.model_dump(mode='json'), False
            current.description_revision += 1
            current.save(update_fields=['descriptions', 'edited', 'description_revision', 'updated_at'])
        locked_job.state = 'waiting_quota' if waiting else 'needs_confirmation' if uncertain else 'failed' if error else 'completed'
        locked_job.error_code = error.code if error else ''
        locked_job.retry_at = error.retry_at if error else None
        locked_job.completed_at = None if waiting else timezone.now()
        locked_job.claim_token = None
        locked_job.save(update_fields=['state', 'error_code', 'retry_at', 'completed_at', 'claim_token'])
        if result is None:
            current.save(update_fields=['updated_at'])


@_private_database_logging()
def run_description(set_id, revision):
    try:
        claimed = claim(set_id, revision)
    except (DescriptionSet.DoesNotExist, DescriptionJob.DoesNotExist):
        return
    if claimed is None:
        return
    value, job, request = claimed
    result, safe = None, None
    try:
        selection = Selection.saved(value)
        selection.check_versions(value.prompt_digest)
        if request.received_at:
            # No media/key/enable requirement for receipt recovery; no provider call.
            prepared = provider.PreparedRequest(provider.ProviderConfig(value.provider, value.model, ''),
                snapshot_deck(value), 'descriptions', b'', value.input_hash)
            receipt = saved_receipt(request)
        else:
            selection.credentials()
            QuotaPolicy.current(selection)
            deck, snapshot = prepare_saved(value.deck_id)
            if deck.input_id != value.source_fingerprint or snapshot != value.source_snapshot:
                raise FeedbackError('source_changed')
            prepared = selection.adapter().prepare_descriptions(deck)
            prepared = submit(value, job, prepared)
            receipt = provider.request_raw(prepared)
            try:
                receipt = save_receipt(value, job, request, receipt, credential=prepared.config.key)
            except Exception:
                # The commit may have succeeded despite acknowledgement loss.
                # Do not normalize in-memory output or finalize a saved receipt
                # as invalid. Lease recovery reads the durable receipt, or requires
                # confirmation if none survived; neither path resubmits here.
                logger.warning('Description receipt could not be saved; recovery required.')
                return
        result = provider.normalize(prepared, receipt)
    except StaleClaim:
        return
    except Exception as error:
        safe = error if isinstance(error, FeedbackError) else FeedbackError('processing_failed', uncertain=False)
    # Completion persistence is not provider validation. A failed write/commit
    # leaves the saved receipt recoverable under the same generation, rather than
    # classifying valid output as invalid and authorizing another paid request.
    try:
        finish(value, job, result=result, error=safe)
    except StaleClaim:
        pass
    except Exception:
        logger.warning('Description state could not be saved; recovery required.')


@_private_database_logging()
def recover_descriptions():
    """Beat wakes durable work; terminal invalid receipts never normalize forever."""
    # Receipt evidence outlives job state/revision: a late response may arrive
    # after needs_confirmation was superseded by an explicit retry or edit.
    ids = DescriptionJob.objects.filter(
        Q(state__in=ACTIVE | {'superseded'}) |
        Q(request__received_at__isnull=False, request__completed_at__isnull=True)
    ).values_list('description_set_id', 'generation')
    for set_id, revision in ids.iterator():
        with transaction.atomic():
            value, job = _locked(set_id, revision)
            now = timezone.now()
            if job.claimed_at and job.claimed_at > now - timedelta(seconds=LEASE_SECONDS) and job.state not in {'queued', 'waiting_quota'}:
                continue
            request = FeedbackRequest.objects.select_for_update().filter(job=job).first()
            unfinished_receipt = request and request.received_at and not request.completed_at
            if value.processing_revision != revision or value.descriptions is not None:
                if unfinished_receipt:
                    # Dispatch the old generation for receipt-only normalization.
                    # claim() keeps the old job state and grants no set write or
                    # submission permission. Duplicate publications are harmless.
                    transaction.on_commit(lambda id=set_id, rev=revision: publish(id, rev))
                elif request and request.submitted_at and not request.received_at and request.outcome == 'submitted':
                    request.outcome, request.completed_at = 'uncertain', now
                    request.save(update_fields=['outcome', 'completed_at'])
                continue
            if job.state not in ACTIVE and not unfinished_receipt:
                continue
            previous_state = (job.state, job.claim_token, job.error_code, job.completed_at)
            if request and request.submitted_at and not request.received_at:
                request.outcome, request.completed_at = 'uncertain', now
                request.save(update_fields=['outcome', 'completed_at'])
                job.state, job.error_code, job.completed_at = 'needs_confirmation', 'uncertain_submission', now
            elif request and request.completed_at:
                # A terminal known/uncertain outcome cannot accidentally be recalled.
                job.state = 'needs_confirmation' if request.outcome == 'uncertain' else 'failed'
                job.error_code, job.completed_at = request.error_code or 'processing_failed', now
            elif job.state == 'waiting_quota' and job.retry_at and job.retry_at > now:
                continue
            else:
                # Reservation and submitted marker normally commit atomically;
                # release only fenced, never-submitted abandoned reservations.
                if request and not request.submitted_at:
                    FeedbackReservation.objects.filter(request=request, submitted_at__isnull=True,
                        released_at__isnull=True).update(released_at=now)
                job.state = 'queued'
            job.claim_token = None
            job.save(update_fields=['state', 'claim_token', 'error_code', 'completed_at'])
            if previous_state != (job.state, job.claim_token, job.error_code, job.completed_at):
                value.save(update_fields=['updated_at'])
            if job.state == 'queued':
                transaction.on_commit(lambda id=set_id, rev=revision: publish(id, rev))
