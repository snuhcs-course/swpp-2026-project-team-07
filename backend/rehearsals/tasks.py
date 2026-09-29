from celery import shared_task


@shared_task
def process_attempt(attempt_id: str):
    """Integration owner: load saved audio → transcribe → align → feedback → persist.

    Use the same attempt ID to retry processing, with duplicate-request protection.
    Keep audio on errors; distinguish provider failures from completed results.
    """
    raise NotImplementedError(
        "Connect transcription, alignment, feedback, and status persistence before queueing attempts."
    )
