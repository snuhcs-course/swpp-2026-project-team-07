"""Application reservations: UTF-8 payload bytes + maximum output tokens.

Deliberately loose units, not provider token accounting or a money cap. All
callers lock set -> analysis (coaching only) -> job -> bucket -> request/reservation; no network under locks.
"""
from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone

from ..models import FeedbackQuotaBucket, FeedbackReservation
from .feedback import FeedbackError


def daily_window(provider, now):
    zone = ZoneInfo('America/Los_Angeles') if provider == 'gemini' else dt_timezone.utc
    local = now.astimezone(zone)
    start = datetime.combine(local.date(), datetime.min.time(), tzinfo=zone)
    end = datetime.combine(local.date() + timedelta(days=1), datetime.min.time(), tzinfo=zone)
    return start, end


def locked_bucket(selection):
    bucket, _ = FeedbackQuotaBucket.objects.get_or_create(provider=selection.provider,
        project_id=selection.project_id, model=selection.model)
    return FeedbackQuotaBucket.objects.select_for_update().get(pk=bucket.pk)


def reserve(bucket, request, units, policy):
    # Called inside the submission transaction after acquiring bucket lock.
    now = timezone.now()
    if units > policy.tpm:
        raise FeedbackError('request_exceeds_quota')
    waits = []
    if bucket.blocked_until and bucket.blocked_until > now:
        waits.append(bucket.blocked_until)
    rows = bucket.reservations.filter(released_at__isnull=True)
    recent = list(rows.filter(reserved_at__gt=now - timedelta(seconds=60)).order_by('reserved_at'))
    # Earliest expiry at which BOTH rolling constraints fit this request.
    count, used = len(recent), sum(row.units for row in recent)
    for row in recent:
        if count < policy.rpm and used + units <= policy.tpm:
            break
        count -= 1
        used -= row.units
        waits.append(row.reserved_at + timedelta(seconds=60))
    if policy.daily:
        start, end = daily_window(bucket.provider, now)
        if rows.filter(reserved_at__gte=start).count() >= policy.daily:
            waits.append(end)
    if waits:
        raise FeedbackError('quota_stopped' if bucket.provider == 'gemini' else 'waiting_quota', retry_at=max(waits))
    return FeedbackReservation.objects.create(request=request, bucket=bucket, units=units,
                                             reserved_at=now, submitted_at=now)


def cooldown(bucket, retry_at):
    if retry_at and (bucket.blocked_until is None or retry_at > bucket.blocked_until):
        bucket.blocked_until = retry_at
        bucket.save(update_fields=['blocked_until'])


QUOTA_STOPPED_MESSAGE = ('Generation stopped because the Gemini quota is unavailable. '
                         'After the retry time, refresh and choose Retry to try again.')


def stop_legacy_gemini_wait(provider, job, request):
    """Caller holds current scope/job locks and has fenced live/superseded claims.

    Saved receipts and submitted or completed outcomes always take precedence.
    A queued marker can survive a Beat publication from before the policy change.
    """
    if (provider != 'gemini' or
            not (job.state == 'waiting_quota' or (job.state == 'queued' and job.error_code == 'waiting_quota')) or
            (request and (request.submitted_at or request.received_at or request.completed_at))):
        return False
    now = timezone.now()
    if request:
        request.outcome, request.error_code, request.completed_at = 'local', 'quota_stopped', now
        request.save(update_fields=['outcome', 'error_code', 'completed_at'])
        FeedbackReservation.objects.filter(request=request, submitted_at__isnull=True,
            released_at__isnull=True).update(released_at=now)
    job.state, job.error_code, job.completed_at, job.claim_token = 'failed', 'quota_stopped', now, None
    # Both job types share these fields; full save also advances coaching.updated_at.
    job.save()
    return True
