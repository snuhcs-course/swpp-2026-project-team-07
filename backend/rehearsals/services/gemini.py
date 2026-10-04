"""Bounded, cached Gemini calls with a project-wide durable quota ledger."""
import json
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import httpx
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rehearsals.models import Generation, ProviderProject, ProviderRequest


class AIStageError(Exception):
    def __init__(self, code, message, retry_at=None):
        self.code, self.message, self.retry_at = code, message, retry_at
        super().__init__(message)


def configured():
    return (settings.GEMINI_ENABLED and settings.GEMINI_FREE_TIER_CONFIRMED and
            settings.GEMINI_PROJECT_ID and settings.GEMINI_API_KEY and
            min(settings.GEMINI_RPM, settings.GEMINI_TPM, settings.GEMINI_RPD) > 0)


def next_day(now):
    pacific = now.astimezone(ZoneInfo("America/Los_Angeles"))
    day = pacific.date() + timedelta(days=1)
    return datetime.combine(day, datetime.min.time(), tzinfo=pacific.tzinfo)


def reserve(generation, operation, tokens):
    project, _ = ProviderProject.objects.get_or_create(id=settings.GEMINI_PROJECT_ID)
    now = timezone.now()
    with transaction.atomic():
        project = ProviderProject.objects.select_for_update().get(pk=project.pk)
        if project.not_before and project.not_before > now:
            raise AIStageError("waiting_quota", "Waiting for shared AI project quota.", project.not_before)
        recent = project.requests.filter(created_at__gt=now - timedelta(seconds=60))
        midnight = now.astimezone(ZoneInfo("America/Los_Angeles")).replace(hour=0, minute=0, second=0, microsecond=0)
        daily = project.requests.filter(created_at__gte=midnight)
        if daily.count() >= settings.GEMINI_RPD:
            raise AIStageError("waiting_quota", "Waiting for AI daily quota.", next_day(now))
        if tokens > settings.GEMINI_TPM:
            raise AIStageError("input_limit", "This input exceeds the project's tokens-per-minute limit. Use a smaller deck or shorter rehearsal.")
        used = recent.aggregate(total=Sum("reserved_tokens"))["total"] or 0
        if recent.count() >= settings.GEMINI_RPM or used + tokens > settings.GEMINI_TPM:
            oldest = recent.order_by("created_at").first()
            raise AIStageError("waiting_quota", "Waiting for AI quota.", (oldest.created_at if oldest else now) + timedelta(seconds=61))
        return ProviderRequest.objects.create(generation=generation, project=project, operation=operation, reserved_tokens=tokens)


def call_provider(generation, operation, payload, tokens=0):
    request = reserve(generation, operation, tokens)
    started = time.monotonic()
    try:
        # No SDK retries, redirects, fallback provider, search or agent loop.
        response = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:{operation}",
                              headers={"x-goog-api-key": settings.GEMINI_API_KEY}, json=payload, timeout=90)
        if response.status_code == 429:
            request.state = "quota"
            try:
                delay = max(60, int(response.headers.get("Retry-After", "60")))
            except ValueError:
                delay = 60
            # A daily quota failure without a reset hint waits for the next Pacific day.
            raw = response.json()
            request.raw_response = raw
            daily = "perday" in json.dumps(raw).lower() or "per_day" in json.dumps(raw).lower()
            retry_at = next_day(timezone.now()) if daily else timezone.now() + timedelta(seconds=delay)
            with transaction.atomic():
                project = ProviderProject.objects.select_for_update().get(pk=request.project_id)
                project.not_before = max(project.not_before or retry_at, retry_at)
                project.save(update_fields=["not_before"])
            raise AIStageError("waiting_quota", "Waiting for AI quota.", retry_at)
        if response.status_code >= 500:
            request.state = "unknown"
            raise AIStageError("unknown_outcome", "The AI request outcome is uncertain. An operator must inspect it before another generation.")
        if response.status_code != 200:
            request.state = "failed"
            raise AIStageError("provider_rejected", "AI rejected the request. Check backend project configuration before retrying.")
        raw = response.json()
        request.raw_response = raw
        request.usage = raw.get("usageMetadata", {})
        request.state = "complete"
        return raw
    except (httpx.HTTPError, ValueError):
        request.state = "unknown" if operation == "generateContent" else "failed"
        raise AIStageError("unknown_outcome" if operation == "generateContent" else "provider_rejected",
                           "AI connection failed. The transcript is retained; uncertain generations require operator review.") from None
    except AIStageError as exc:
        request.error_code = exc.code
        raise
    finally:
        request.latency_ms = round((time.monotonic() - started) * 1000)
        request.save()


def generate(key, kind, version, parts, schema, instruction, output_limit, validator):
    if not configured():
        raise AIStageError("disabled", "AI feedback is disabled until a dedicated free-tier project and quotas are configured.")
    with transaction.atomic():
        Generation.objects.get_or_create(key=key, defaults={"kind": kind, "model": settings.GEMINI_MODEL, "version": version})
        generation = Generation.objects.select_for_update().get(pk=key)
        if generation.state == "complete":
            return generation.result
        if generation.state in {"unknown", "failed"}:
            error = generation.error or {"code": "unknown_outcome", "message": "An operator must inspect this AI request."}
            raise AIStageError(error["code"], error["message"])
        if generation.not_before and generation.not_before > timezone.now():
            raise AIStageError("waiting_quota", "Waiting for AI quota.", generation.not_before)
        if generation.state in {"counting", "generating"}:
            if generation.updated_at > timezone.now() - timedelta(seconds=180):
                raise AIStageError("waiting", "AI analysis is already running.", timezone.now() + timedelta(seconds=60))
            if generation.state == "generating":
                generation.state = "unknown"
                generation.error = {"code": "unknown_outcome", "message": "The worker stopped during an AI request. Operator review is required."}
                generation.save()
                raise AIStageError(**generation.error)
        generation.state = "counting"
        generation.save()
    payload = {"contents": [{"role": "user", "parts": parts}],
               "systemInstruction": {"parts": [{"text": instruction}]},
               "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema,
                                    "maxOutputTokens": output_limit, "thinkingConfig": {"thinkingLevel": "minimal"}}}
    try:
        if len(json.dumps(payload).encode()) > 19 * 1024 * 1024:
            raise AIStageError("input_limit", "Prepared slide images exceed the inline request limit. Use a smaller deck.")
        if generation.input_tokens is None:
            count = call_provider(generation, "countTokens", {"generateContentRequest": {"model": f"models/{settings.GEMINI_MODEL}", **payload}})
            tokens = count.get("totalTokens")
            if type(tokens) is not int or tokens < 0:
                raise AIStageError("invalid_response", "AI token count was invalid.")
            generation.input_tokens = tokens
            generation.save(update_fields=["input_tokens", "updated_at"])
        if generation.input_tokens > settings.GEMINI_INPUT_LIMIT:
            raise AIStageError("input_limit", "AI input exceeds 20,000 tokens. Speech has not been truncated; use a shorter rehearsal or smaller deck.")
        generation.state = "generating"
        generation.save(update_fields=["state", "updated_at"])
        raw = call_provider(generation, "generateContent", payload, generation.input_tokens)
        try:
            candidate = raw["candidates"][0]
            if candidate.get("finishReason") != "STOP":
                raise ValueError()
            text = "".join(p.get("text", "") for p in candidate["content"]["parts"] if not p.get("thought"))
            result = validator(json.loads(text))
        except (KeyError, IndexError, TypeError, ValueError):
            raise AIStageError("invalid_response", "AI returned incomplete or unsupported evidence. No suggestions are displayed.") from None
        generation.state, generation.result, generation.error, generation.not_before = "complete", result, None, None
        generation.save()
        return result
    except AIStageError as exc:
        generation.state = "quota" if exc.retry_at else ("unknown" if exc.code == "unknown_outcome" else "failed")
        generation.error = {"code": exc.code, "message": exc.message}
        generation.not_before = exc.retry_at
        generation.save()
        raise
