# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
from celery import shared_task
from .models import Attempt, CaptureAssessment, CaptureSegment, DescriptionSet, DisplayTranslation, FeedbackAnalysis, FeedbackRun
from .ownership import run_owned
from .services.processing import run_attempt, recover_work as recover_processing
from .services.descriptions import run_description, recover_descriptions
from .services.coaching import run_coaching, recover_coaching


@shared_task(ignore_result=True)
def purge_store_installations():
    from .services.public_retention import purge_expired_installations
    return purge_expired_installations()


@shared_task(time_limit=300, ignore_result=True)
def process_attempt(attempt_id: str, revision: int):
    run_owned(Attempt, attempt_id, _process_attempt, revision)


def _process_attempt(attempt_id, revision):
    run_attempt(attempt_id, revision)
    from .services.audience_qa import advance_answer
    try:
        advance_answer(attempt_id)
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Q&A evaluation admission deferred; recording retained.")


@shared_task(ignore_result=True)
def recover_work():
    recover_processing()
    recover_descriptions()
    recover_coaching()
    from .services.audience_qa import recover_answers
    recover_answers()
    from .feedback_v3.pipeline import recover as recover_feedback_v3
    recover_feedback_v3()
    from .services.incremental import recover as recover_capture
    recover_capture()
    from .services.localization import recover as recover_translations
    recover_translations()
    from .services.prepared_display import recover as recover_prepared
    recover_prepared()


@shared_task(time_limit=150, rate_limit='12/m', ignore_result=True)
def translate_display(translation_id: str):
    from .services.localization import run
    run_owned(DisplayTranslation, translation_id, run)


@shared_task(time_limit=300, ignore_result=True)
def transcribe_capture_segment(segment_id):
    from .services.incremental import transcribe_segment
    run_owned(CaptureSegment, segment_id, transcribe_segment)


@shared_task(time_limit=300, ignore_result=True)
def assess_capture_part(assessment_id):
    from .services.incremental import assess_part
    run_owned(CaptureAssessment, assessment_id, assess_part)


# Claude Code, prompted by Seoyeon (2026-11-14): v3 feedback run; see docs/ai-feedback-reimplementation.md.
@shared_task(time_limit=300, ignore_result=True)
def run_feedback_v3(run_id: str):
    from .feedback_v3.pipeline import run
    run_owned(FeedbackRun, run_id, run)


@shared_task(time_limit=300, ignore_result=True)
def describe_deck(set_id: str, revision: int):
    run_owned(DescriptionSet, set_id, run_description, revision)


@shared_task(time_limit=300, ignore_result=True)
def coach_attempt(analysis_id: int, revision: int):
    run_owned(FeedbackAnalysis, analysis_id, run_coaching, revision)
