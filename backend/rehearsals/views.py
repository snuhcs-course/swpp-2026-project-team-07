from django.conf import settings
from django.db import connection
from django.shortcuts import get_object_or_404
import json
from redis import Redis
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import Deck, Attempt
from .serializers import AttemptMetadataSerializer
from .services.storage import store_deck, store_attempt


def deck_data(deck, request):
    return {"id": str(deck.id), "title": deck.title, "page_count": deck.page_count,
            "pdf_url": request.build_absolute_uri(deck.pdf.url),
            "slides": [{"deck_id": str(deck.id), "slide_index": slide.slide_index,
                        "image_url": request.build_absolute_uri(slide.image.url),
                        "extracted_text": slide.extracted_text} for slide in deck.slides.all()]}


def attempt_data(attempt, request):
    return {"attempt_id": str(attempt.id), "deck_id": str(attempt.deck_id),
            "status": attempt.status, "transcript": attempt.transcript,
            "feedback": attempt.feedback, "error": attempt.error,
            "duration_ms": attempt.duration_ms, "slide_events": attempt.slide_events,
            "audience": attempt.audience, "created_at": attempt.created_at,
            "audio_url": request.build_absolute_uri(attempt.audio.url),
            "processing_state": "awaiting_analysis" if attempt.status == "pending" else attempt.status}


@api_view(["POST"])
def decks(request):
    title = request.data.get("title", "Presentation")
    if not isinstance(title, str) or not 1 <= len(title.strip()) <= 255:
        raise ValidationError("Title must contain 1 to 255 characters.")
    deck = store_deck(request.FILES.get("file"), title.strip())
    data = deck_data(deck, request)
    slides = data.pop("slides")
    return Response({"deck": data, "slides": slides}, status=201)


@api_view(["GET"])
def deck_detail(request, deck_id):
    return Response(deck_data(get_object_or_404(Deck, id=deck_id), request))


@api_view(["GET"])
def deck_attempts(request, deck_id):
    deck = get_object_or_404(Deck, id=deck_id)
    return Response([attempt_data(a, request) for a in deck.attempts.order_by("-created_at")])


@api_view(["POST"])
def attempts(request):
    try:
        metadata = json.loads(request.data.get("metadata", ""))
    except (TypeError, ValueError) as exc:
        raise ValidationError("Provide JSON recording metadata.") from exc
    serializer = AttemptMetadataSerializer(data=metadata)
    serializer.is_valid(raise_exception=True)
    attempt = store_attempt(request.FILES.get("audio"), serializer.validated_data)
    if attempt is None:
        return Response({"error": {"code": "attempt_conflict", "message": "This attempt ID already belongs to different content."}}, status=409)
    return Response({"attempt_id": str(attempt.id), "status": attempt.status}, status=201)


@api_view(["GET"])
def attempt_detail(request, attempt_id):
    return Response(attempt_data(get_object_or_404(Attempt, id=attempt_id), request))


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
