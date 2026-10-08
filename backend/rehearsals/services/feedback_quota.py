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
        raise FeedbackError('waiting_quota', retry_at=max(waits))
    return FeedbackReservation.objects.create(request=request, bucket=bucket, units=units,
                                             reserved_at=now, submitted_at=now)


def cooldown(bucket, retry_at):
    if retry_at and (bucket.blocked_until is None or retry_at > bucket.blocked_until):
        bucket.blocked_until = retry_at
        bucket.save(update_fields=['blocked_until'])
