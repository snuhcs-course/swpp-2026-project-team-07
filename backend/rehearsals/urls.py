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
