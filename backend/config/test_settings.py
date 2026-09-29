from .settings import *  # noqa: F403

# Unit/contract tests require no running infrastructure; production stays PostgreSQL.
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CELERY_TASK_ALWAYS_EAGER = True
