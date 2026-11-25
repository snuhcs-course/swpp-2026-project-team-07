# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
from .public_access import enroll, public_path
from . import views, description_views, feedback_views, qa_views
from . import presentation_context_views
from . import slide_profile_views
from . import correction_views, slide_review_views, durable_qa_views, presentation_score_views
from .feedback_v3 import views as feedback_v3_views  # Claude Code, prompted by Seoyeon (2026-11-14)
from . import capture_views
from . import localization_views

urlpatterns = [
    public_path("installations/", enroll),
    public_path('localization/', localization_views.request_translation),
    public_path('localization/prepared/', localization_views.prepare),
    public_path('localization/prepared/<slug:kind>/<path:resource_id>/', localization_views.prepared),
    public_path('localization/<slug:translation_id>/', localization_views.translation_status),
    public_path('incremental/capabilities/', capture_views.capabilities),
    public_path('attempts/<uuid:attempt_id>/capture/', capture_views.capture),
    public_path('attempts/<uuid:attempt_id>/capture/audio/', capture_views.audio),
    public_path('attempts/<uuid:attempt_id>/segments/<int:sequence>/', capture_views.segment),
    public_path('attempts/<uuid:attempt_id>/segments/<int:sequence>/retry/', capture_views.retry),
    public_path('attempts/<uuid:attempt_id>/feedback-run/', feedback_v3_views.feedback_run),
    public_path('attempts/<uuid:attempt_id>/presentation-score/', presentation_score_views.score),
    public_path('attempts/<uuid:attempt_id>/audience-qa/', durable_qa_views.questions),
    public_path('attempts/<uuid:attempt_id>/qa-answer/', durable_qa_views.answer),
    public_path('attempts/<uuid:attempt_id>/slide-review/', slide_review_views.review),
    public_path('attempts/<uuid:attempt_id>/corrections/', correction_views.correction),
    public_path('attempts/<uuid:attempt_id>/correction-suggestions/', correction_views.suggestions),
    public_path('decks/<uuid:deck_id>/profiles/', slide_profile_views.profiles),
    public_path('decks/<uuid:deck_id>/profiles/generate/', slide_profile_views.generate),
    public_path('presentation-contexts/', presentation_context_views.contexts),
    public_path('presentation-contexts/<uuid:context_id>/', presentation_context_views.context),
    public_path("attempts/<uuid:attempt_id>/feedback/", feedback_views.feedback),
    public_path("attempts/<uuid:attempt_id>/feedback/generate/", feedback_views.generate),
    public_path("health/", views.health),
    public_path("decks/<uuid:deck_id>/descriptions/", description_views.descriptions),
    public_path("decks/<uuid:deck_id>/descriptions/generate/", description_views.generate),
    public_path("ready/", views.ready),
    public_path(
        "decks/", views.decks
    ),
    public_path(
        "attempts/",
        views.attempts,
    ),
    public_path(
        "attempts/<uuid:attempt_id>/",
        views.attempt_detail,
    ),
    public_path(
        "attempts/<uuid:attempt_id>/process/",
        views.process_attempt,
    ),
    public_path("decks/<uuid:deck_id>/", views.deck_detail),
    public_path("decks/<uuid:deck_id>/attempts/", views.deck_attempts),
    # Audience Q&A (Claude, Iteration 2, 2026-10-14; see docs/reference/api-contract.md).
    public_path("decks/<uuid:deck_id>/qa/questions/", qa_views.questions),
    public_path("decks/<uuid:deck_id>/qa/answers/", qa_views.answers),
]
