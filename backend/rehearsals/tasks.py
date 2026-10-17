# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
from celery import shared_task
from .services.processing import run_attempt, recover_work as recover_processing
from .services.descriptions import run_description, recover_descriptions
from .services.coaching import run_coaching, recover_coaching


@shared_task(time_limit=300, ignore_result=True)
def process_attempt(attempt_id: str, revision: int):
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


@shared_task(time_limit=300, ignore_result=True)
def describe_deck(set_id: str, revision: int):
    run_description(set_id, revision)


@shared_task(time_limit=300, ignore_result=True)
def coach_attempt(analysis_id: int, revision: int):
    run_coaching(analysis_id, revision)
