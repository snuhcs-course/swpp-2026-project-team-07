# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("ready/", views.ready),
    path(
        "decks/", views.feature_pending, {"feature": "PDF upload and slide preparation"}
    ),
    path(
        "attempts/",
        views.feature_pending,
        {"feature": "Audio upload and attempt creation"},
    ),
    path(
        "attempts/<uuid:attempt_id>/",
        views.feature_pending,
        {"feature": "Attempt results"},
    ),
    path(
        "attempts/<uuid:attempt_id>/process/",
        views.feature_pending,
        {"feature": "Background processing and retry"},
    ),
]
