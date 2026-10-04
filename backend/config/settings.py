import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "outloud-local-development-only")
if not DEBUG and SECRET_KEY in {
    "outloud-local-development-only",
    "local-development-only-change-before-deployment",
}:
    raise RuntimeError("Set a private DJANGO_SECRET_KEY before deploying.")
ALLOWED_HOSTS = os.getenv(
    "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,10.0.2.2,testserver"
).split(",")
INSTALLED_APPS = ["django.contrib.contenttypes", "rest_framework", "rehearsals"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "outloud"),
        "USER": os.getenv("POSTGRES_USER", "outloud"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "outloud-local-only"),
        "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "OPTIONS": {"connect_timeout": 3},
    }
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
TIME_ZONE = "UTC"
USE_TZ = True
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"
DATA_UPLOAD_MAX_MEMORY_SIZE = 26 * 1024 * 1024
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
}
# Local team development only. Add authentication/authorization before remote deployment.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 1800
CELERY_WORKER_CONCURRENCY = 1
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_BEAT_SCHEDULE = {"recover-work": {"task": "rehearsals.tasks.recover_work", "schedule": 60.0}}
WHISPER_MODEL = "small"
WHISPER_CACHE_DIR = os.getenv("WHISPER_CACHE_DIR", str(BASE_DIR / ".models"))
WHISPER_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "4"))
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# A dedicated free-tier project must be confirmed by its operator. Never auto-enable.
GEMINI_ENABLED = os.getenv("GEMINI_ENABLED", "0") == "1"
GEMINI_FREE_TIER_CONFIRMED = os.getenv("GEMINI_FREE_TIER_CONFIRMED", "0") == "1"
GEMINI_PROJECT_ID = os.getenv("GEMINI_PROJECT_ID", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_RPM = int(os.getenv("GEMINI_RPM", "0"))
GEMINI_TPM = int(os.getenv("GEMINI_TPM", "0"))
GEMINI_RPD = int(os.getenv("GEMINI_RPD", "0"))
GEMINI_MODEL = "gemini-3.1-flash-lite"
GEMINI_INPUT_LIMIT = 20_000
