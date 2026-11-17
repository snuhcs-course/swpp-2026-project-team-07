# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
app = Celery("outloud")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
