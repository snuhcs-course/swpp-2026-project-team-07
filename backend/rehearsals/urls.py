from django.urls import path
from . import views, description_views, feedback_views

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
]
