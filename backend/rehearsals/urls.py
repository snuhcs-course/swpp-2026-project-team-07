# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
from django.urls import path
from . import views, description_views, feedback_views, qa_views

urlpatterns = [
    path("attempts/<uuid:attempt_id>/feedback/", feedback_views.feedback),
    path("attempts/<uuid:attempt_id>/feedback/generate/", feedback_views.generate),
    path("health/", views.health),
    path("decks/<uuid:deck_id>/descriptions/", description_views.descriptions),
    path("decks/<uuid:deck_id>/descriptions/generate/", description_views.generate),
    path("ready/", views.ready),
    path(
        "decks/", views.decks
    ),
    path(
        "attempts/",
        views.attempts,
    ),
    path(
        "attempts/<uuid:attempt_id>/",
        views.attempt_detail,
    ),
    path(
        "attempts/<uuid:attempt_id>/process/",
        views.process_attempt,
    ),
    path("decks/<uuid:deck_id>/", views.deck_detail),
    path("decks/<uuid:deck_id>/attempts/", views.deck_attempts),
    # Audience Q&A (Claude, Iteration 2, 2026-10-14; see docs/api-contract.md).
    path("decks/<uuid:deck_id>/qa/questions/", qa_views.questions),
    path("decks/<uuid:deck_id>/qa/answers/", qa_views.answers),
]
