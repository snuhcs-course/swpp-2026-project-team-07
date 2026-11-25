"""Execute one bounded slide-profile part per worker turn, retaining its receipt."""
from dataclasses import replace
from datetime import timedelta
import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from ..models import Deck, DescriptionJob, DescriptionSet, FeedbackRequest, ProfilePart
from . import descriptions, feedback_provider as provider, profile_parts as parts
from .feedback import FeedbackError
from .feedback_config import QuotaPolicy, Selection
from .feedback_quota import cooldown, locked_bucket, reserve


def _locked(set_id, rev):
    value = DescriptionSet.objects.select_for_update().get(pk=set_id)
    job = DescriptionJob.objects.select_for_update().get(description_set=value, generation=rev)
    return value, job


def _publish(value, job):
    transaction.on_commit(lambda: descriptions.publish(value.pk, job.generation))


def _progress(value, job, state, *, error='', retry_at=None, close=False):
    job.state, job.error_code, job.retry_at = state, error, retry_at
    job.claim_token = None
    job.completed_at = timezone.now() if close else None
    job.save(update_fields=['state', 'error_code', 'retry_at', 'claim_token', 'completed_at'])
    value.save(update_fields=['updated_at'])


def _unfinished_receipts():
    return FeedbackRequest.objects.filter(profile_part__isnull=False, submitted_at__isnull=False,
        received_at__isnull=False, completed_at__isnull=True, outcome='received')


def _claim(set_id, rev):
    with transaction.atomic():
        value, job = _locked(set_id, rev)
        if value.processing_revision != rev or value.descriptions is not None:
            # A historical delivery may finalize only bytes already stored for this exact
            # job. Never give it a claim, a new part, or permission to submit.
            request = _unfinished_receipts().filter(profile_part__job=job).select_related('profile_part').first()
            return (value, job, request.profile_part, request) if request else None
        if job.state not in descriptions.ACTIVE:
            return
        now = timezone.now()
        if job.claim_token and job.claimed_at and job.claimed_at > now - timedelta(seconds=descriptions.LEASE_SECONDS):
            return
        if job.state == 'waiting_quota' and job.retry_at and job.retry_at > now:
            return
        if not job.profile_parts.exists():
            count = len(value.source_snapshot['source_ids'])
            ProfilePart.objects.bulk_create([
                ProfilePart(job=job, phase=phase, offset=offset)
                for phase in (parts.FACTS, parts.ENRICHMENT) for offset in range(0, count, parts.PART_SLIDES)
            ])
        pending = job.profile_parts.filter(result__isnull=True)
        part = pending.filter(phase=parts.FACTS).order_by('offset').first()
        if part is None:
            part = pending.filter(phase=parts.ENRICHMENT).order_by('offset').first()
        req = FeedbackRequest.objects.filter(profile_part=part).first() if part else None
        if req and req.submitted_at and not req.received_at:
            req.outcome, req.completed_at = 'uncertain', now
            req.save(update_fields=['outcome', 'completed_at'])
            _progress(value, job, 'needs_confirmation', error='uncertain_submission', close=True)
            return
        job.claim_token, job.claimed_at = uuid.uuid4(), now
        job.state = 'normalizing' if part is None or (req and req.received_at) else 'preparing'
        job.error_code, job.retry_at = '', None
        job.save(update_fields=['claim_token', 'claimed_at', 'state', 'error_code', 'retry_at'])
        value.save(update_fields=['updated_at'])
        return value, job, part, req


def _results(job, phase):
    return list(job.profile_parts.filter(phase=phase, result__isnull=False)
                .order_by('offset').values_list('result', flat=True))


def _store_part(value, job, part, result):
    part.result = result
    part.save(update_fields=['result'])
    _progress(value, job, 'queued')
    _publish(value, job)


def _reuse_previous(value, job, part, payload, facts):
    # The set lock also guards receipt arrival from a superseded generation.
    # Only an identical provider input can reuse that generation's evidence.
    previous = ProfilePart.objects.filter(
        job__description_set=value, job__generation__lt=job.generation,
        phase=part.phase, offset=part.offset, request__input_hash=payload.input_hash,
        request__status_code=200, request__received_at__isnull=False,
        request__body_complete=True, request__outcome__in=('completed', 'received'),
    ).select_related('request').order_by('-job__generation')
    for prior in previous:
        record = prior.request
        result = prior.result
        if result is None:
            try:
                result = parts.normalize_part(payload, descriptions.saved_receipt(record), part.phase,
                                              part.offset, fact_parts=facts)
            except FeedbackError as error:
                record.outcome, record.error_code, record.completed_at = 'invalid', error.code, timezone.now()
                record.save(update_fields=['outcome', 'error_code', 'completed_at'])
                continue
            prior.result = result
            prior.save(update_fields=['result'])
            record.outcome, record.error_code, record.completed_at = 'completed', '', timezone.now()
            record.save(update_fields=['outcome', 'error_code', 'completed_at'])
        _store_part(value, job, part, result)
        return True
    return False


def _submit(value, job, part, payload, selection, facts):
    with transaction.atomic():
        current, locked = _locked(value.pk, job.generation)
        descriptions._fresh(current, locked, job.claim_token)
        selection.check_versions(current.prompt_digest)
        descriptions.check_storage(Deck.objects.get(pk=current.deck_id), current.source_snapshot)
        if _reuse_previous(current, locked, part, payload, facts):
            return None
        config = selection.credentials()
        policy = QuotaPolicy.current(selection)
        bucket = locked_bucket(selection)
        descriptions._fresh(current, locked, job.claim_token)
        request = FeedbackRequest.objects.create(profile_part=part, generation=job.generation,
            claim_token=job.claim_token, provider=selection.provider, project_id=selection.project_id,
            model=selection.model, stage='descriptions', input_hash=payload.input_hash,
            queued_at=job.queued_at, claimed_at=job.claimed_at)
        reserve(bucket, request, len(payload.payload) + provider.output_token_limit(payload), policy)
        request.submitted_at, request.outcome = timezone.now(), 'submitted'
        request.save(update_fields=['submitted_at', 'outcome'])
        locked.state = 'submitted'
        locked.save(update_fields=['state'])
        current.save(update_fields=['updated_at'])
        return request, replace(payload, config=config)


def _receipt(value, job, request, receipt, key):
    if (receipt.input_hash, receipt.provider, receipt.stage, receipt.model) != (
            request.input_hash, request.provider, request.stage, request.model):
        raise FeedbackError('receipt_mismatch', uncertain=True)
    if len(receipt.body) > provider.MAX_RESPONSE_BYTES:
        raise FeedbackError('response_too_large', uncertain=True)
    if key and key.encode('ascii') in receipt.body:
        receipt = replace(receipt, body=b'', body_complete=False, body_issue='credential_redacted')
    with transaction.atomic():
        current, locked = _locked(value.pk, job.generation)
        record = FeedbackRequest.objects.select_for_update().get(pk=request.pk)
        if record.received_at:
            return descriptions.saved_receipt(record)
        record.raw_body, record.status_code = receipt.body, receipt.status_code
        record.body_complete, record.body_issue = receipt.body_complete, receipt.body_issue
        record.retry_at, record.usage = receipt.retry_at, dict(receipt.usage) or None
        record.received_at, record.outcome, record.completed_at = timezone.now(), 'received', None
        record.save(update_fields=['raw_body','status_code','body_complete','body_issue','retry_at',
                                   'usage','received_at','outcome','completed_at'])
        if receipt.status_code == 429:
            cooldown(locked_bucket(Selection.saved(current)), receipt.retry_at)
        if current.processing_revision == job.generation and current.descriptions is None:
            if locked.state == 'needs_confirmation':
                _progress(current, locked, 'queued')
                _publish(current, locked)
            else:
                current.save(update_fields=['updated_at'])
    return receipt


def _save(value, job, part, request, result=None, error=None):
    with transaction.atomic():
        current, locked = _locked(value.pk, job.generation)
        historical = current.processing_revision != job.generation or current.descriptions is not None
        if historical:
            if part is None or request is None or part.job_id != locked.pk:
                return
            # Serialize with both the next generation's reuse and other receipt-only workers.
            request = _unfinished_receipts().select_for_update().filter(pk=request.pk, profile_part=part,
                generation=locked.generation, claim_token=request.claim_token).first()
            if request is None:
                return
        else:
            try:
                descriptions._fresh(current, locked, job.claim_token)
            except descriptions.StaleClaim:
                return
            if request:
                request = FeedbackRequest.objects.select_for_update().get(pk=request.pk)
        uncertain = error and (error.uncertain or (
            request and request.submitted_at and not request.received_at and error.code not in provider.LOCAL_REFUSALS))
        if request:
            request.outcome = ('completed' if not error else 'uncertain' if uncertain else
                               'rejected' if request.status_code and request.status_code != 200 else
                               'invalid' if request.received_at else 'local')
            request.error_code = error.code if error else ''
            request.completed_at = timezone.now()
            request.save(update_fields=['outcome', 'error_code', 'completed_at'])
        if historical:
            if result is not None:
                ProfilePart.objects.filter(pk=part.pk, job=locked, result__isnull=True).update(result=result)
            return  # Preserve both generations' job states and the current public profile.
        if error:
            waiting = error.code == 'waiting_quota' and request is None
            state = 'waiting_quota' if waiting else 'needs_confirmation' if uncertain else 'failed'
            _progress(current, locked, state, error=error.code, retry_at=error.retry_at, close=not waiting)
        elif part is not None:
            _store_part(current, locked, part, result)
        else:
            current.descriptions = result
            current.description_revision += 1
            current.save(update_fields=['descriptions', 'description_revision'])
            _progress(current, locked, 'completed', close=True)
            from .prepared_display import changed
            changed('profiles', current.pk)


def run_if_needed(set_id, rev):
    if not settings.OUTLOUD_PUBLIC_SERVICE:
        return False
    if not DescriptionSet.objects.filter(pk=set_id, provider='openrouter', schema_version='slide-profile-v5',
                                        deck__page_count__gt=parts.PART_THRESHOLD).exists():
        return False
    # A previously dispatched, single-call generation owns its original receipt.
    if FeedbackRequest.objects.filter(job__description_set_id=set_id, job__generation=rev).exists():
        return False
    try:
        claimed = _claim(set_id, rev)
    except (DescriptionSet.DoesNotExist, DescriptionJob.DoesNotExist):
        return True
    if not claimed:
        return True
    value, job, part, request = claimed
    try:
        selection = Selection.saved(value)
        selection.check_versions(value.prompt_digest)
        snapshot = descriptions.snapshot_deck(value)
        facts = _results(job, parts.FACTS) if part is None or part.phase == parts.ENRICHMENT else []
        if part is None:
            result = parts.assemble_profiles(snapshot, facts, _results(job, parts.ENRICHMENT)).model_dump(mode='json')
        else:
            cfg = provider.ProviderConfig(value.provider, value.model, '')
            if request and request.received_at:
                # The raw receipt was bound to this part's input before dispatch.
                # Recovery can validate it against the frozen deck without reading images.
                payload = provider.PreparedRequest(cfg, snapshot, 'descriptions', b'', request.input_hash,
                                                   description_schema_version=value.schema_version)
                receipt = descriptions.saved_receipt(request)
            else:
                deck = snapshot
                if part.phase == parts.FACTS:
                    deck, current_snapshot = descriptions.prepare_saved(value.deck_id)
                    if current_snapshot != value.source_snapshot or deck.input_id != value.source_fingerprint:
                        raise FeedbackError('source_changed')
                payload = parts.prepare_part(deck, cfg, part.phase, part.offset, fact_parts=facts)
                submitted = _submit(value, job, part, payload, selection, facts)
                if submitted is None:
                    return True
                request, payload = submitted
                receipt = _receipt(value, job, request, provider.request_raw(payload), payload.config.key)
            result = parts.normalize_part(payload, receipt, part.phase, part.offset, fact_parts=facts)
        _save(value, job, part, request, result=result)
    except descriptions.StaleClaim:
        pass
    except FeedbackError as error:
        _save(value, job, part, request, error=error)
    return True


def recover():
    now = timezone.now()
    jobs = DescriptionJob.objects.filter(profile_parts__isnull=False, state__in=descriptions.ACTIVE,
        generation=F('description_set__processing_revision'), description_set__descriptions__isnull=True
        ).filter(Q(claim_token__isnull=True) | Q(claimed_at__lte=now - timedelta(seconds=descriptions.LEASE_SECONDS))
        ).filter(Q(retry_at__isnull=True) | Q(retry_at__lte=now),
                 description_set__updated_at__lte=now - timedelta(seconds=30)
        ).values_list('description_set_id', 'generation').distinct()
    for set_id, rev in jobs:
        descriptions.publish(set_id, rev)
    historical = _unfinished_receipts().filter(
        Q(profile_part__job__generation__lt=F('profile_part__job__description_set__processing_revision')) |
        Q(profile_part__job__description_set__descriptions__isnull=False)
    ).values_list('profile_part__job__description_set_id', 'profile_part__job__generation').distinct()
    for set_id, rev in historical:
        descriptions.publish(set_id, rev)
