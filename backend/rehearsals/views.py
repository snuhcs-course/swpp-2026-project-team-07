# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
from django.conf import settings
from django.db import connection
from redis import Redis
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health(request):
    # Liveness only; this never claims that PostgreSQL, Redis, or a worker is ready.
    return Response(
        {
            "service": "outloud-api",
            "status": "ok",
            "api_version": "v1",
            "scaffold": True,
        }
    )


@api_view(["GET"])
def ready(request):
    dependencies = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        dependencies["database"] = "reachable"
    except Exception:
        dependencies["database"] = "unavailable"
    try:
        with Redis.from_url(
            settings.CELERY_BROKER_URL, socket_connect_timeout=2, socket_timeout=2
        ) as client:
            client.ping()
        dependencies["broker"] = "reachable"
    except Exception:
        dependencies["broker"] = "unavailable"
    ok = all(value == "reachable" for value in dependencies.values())
    return Response(
        {"dependencies": dependencies, "worker": "not_checked"},
        status=200 if ok else 503,
    )


@api_view(["GET", "POST"])
def feature_pending(request, feature, attempt_id=None):
    return Response(
        {
            "error": {
                "code": "not_implemented",
                "message": f"{feature} is a teammate implementation task.",
            }
        },
        status=501,
    )
