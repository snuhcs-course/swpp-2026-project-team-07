# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
app = Celery("outloud")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
