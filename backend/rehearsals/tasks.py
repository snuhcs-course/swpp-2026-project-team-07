from celery import shared_task
from .services.processing import run_attempt, recover_work as recover_processing
from .services.descriptions import run_description, recover_descriptions


@shared_task(time_limit=300, ignore_result=True)
def process_attempt(attempt_id: str, revision: int):
    run_attempt(attempt_id, revision)


@shared_task(ignore_result=True)
def recover_work():
    recover_processing()
    recover_descriptions()


@shared_task(time_limit=300, ignore_result=True)
def describe_deck(set_id: str, revision: int):
    run_description(set_id, revision)
