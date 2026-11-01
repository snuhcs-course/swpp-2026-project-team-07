"""Team deployment behind an authenticated HTTPS edge and loopback media proxy.

AI-assisted configuration, OpenAI Codex, Iteration 2 (2026-10-31).
"""
import os
import re

from .settings import *  # noqa: F403

DEBUG = False
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5:
    raise RuntimeError("Set a private DJANGO_SECRET_KEY of at least 50 characters.")

hosts = os.environ.get("DJANGO_ALLOWED_HOSTS", "").lower().split(",")
host_pattern = r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:ts\.net|cloudapp\.azure\.com)"
if any(len(host) > 253 or re.fullmatch(host_pattern, host) is None for host in hosts):
    raise RuntimeError("Set DJANGO_ALLOWED_HOSTS to exact Azure or Tailscale DNS names, separated by commas.")
ALLOWED_HOSTS = hosts

if not os.environ.get("POSTGRES_PASSWORD") or os.environ["POSTGRES_PASSWORD"] == "outloud-local-only":
    raise RuntimeError("Set a private POSTGRES_PASSWORD before deploying.")

MEDIA_URL = "/media/"
# Only nginx can reach Gunicorn. The authenticated public edge or private Serve
# supplies its trusted TLS scheme to nginx, which overwrites this header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = False
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 86400
# This node does not own the surrounding Azure or tailnet certificate namespace.
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
