from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
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
        views.feature_pending,
        {"feature": "Background processing and retry"},
    ),
    path("decks/<uuid:deck_id>/", views.deck_detail),
    path("decks/<uuid:deck_id>/attempts/", views.deck_attempts),
]
