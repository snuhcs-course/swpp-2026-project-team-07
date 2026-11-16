"""Deployment boundary regressions; no database or provider requests.

AI-assisted tests, OpenAI Codex, Iteration 2 (2026-10-31).
"""
import os
from pathlib import Path
import subprocess
import sys
from unittest import TestCase


class ProductionSettingsTests(TestCase):
    def probe(self, code, changes=None, module="config.production_settings"):
        # Isolate private .env loading and Django's cached settings from other tests.
        env = {key: os.environ[key] for key in ("PATH", "TMPDIR", "LANG") if key in os.environ}
        env.update({
            "DJANGO_SETTINGS_MODULE": module,
            "DJANGO_DEBUG": "1",
            "DJANGO_SECRET_KEY": "test-fixture-only-secret-with-enough-characters-2026-10-31",
            "DJANGO_ALLOWED_HOSTS": "outloud.team-example.ts.net",
            "POSTGRES_PASSWORD": "test-fixture-only-database-password",
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        for key, value in (changes or {}).items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        setup = "from unittest.mock import patch\nimport django\nwith patch('dotenv.load_dotenv'):\n    django.setup()\n"
        return subprocess.run(
            [sys.executable, "-c", setup + code],
            cwd=Path(__file__).resolve().parents[1], env=env,
            capture_output=True, text=True, timeout=30,
        )

    def test_missing_or_development_secret_fails_closed(self):
        for secret in (None, "", "outloud-local-development-only", "x" * 60):
            with self.subTest(secret=secret):
                result = self.probe("", {"DJANGO_SECRET_KEY": secret})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("private DJANGO_SECRET_KEY", result.stderr)

    def test_database_default_cannot_be_used_in_production(self):
        for password in (None, "", "outloud-local-only"):
            with self.subTest(password=password):
                result = self.probe("", {"POSTGRES_PASSWORD": password})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("private POSTGRES_PASSWORD", result.stderr)

    def test_server_host_must_be_explicit_and_not_a_wildcard(self):
        for host in (None, "", "*", ".ts.net", "*.ts.net", "localhost", "outloud.team.ts.net,evil.example"):
            with self.subTest(host=host):
                result = self.probe("", {"DJANGO_ALLOWED_HOSTS": host})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("exact Azure or Tailscale DNS names", result.stderr)

    def test_public_azure_host_and_private_transition_host_are_explicit(self):
        hosts = "outloud-team07.koreacentral.cloudapp.azure.com,outloud.team-example.ts.net"
        result = self.probe('''
from django.conf import settings
from django.test import Client
assert settings.ALLOWED_HOSTS == [
    "outloud-team07.koreacentral.cloudapp.azure.com", "outloud.team-example.ts.net"]
client = Client()
for host in settings.ALLOWED_HOSTS:
    assert client.get("/api/health/", HTTP_HOST=host, HTTP_X_FORWARDED_PROTO="https").status_code == 200
assert client.get("/api/health/", HTTP_HOST="other.koreacentral.cloudapp.azure.com",
    HTTP_X_FORWARDED_PROTO="https").status_code == 400
''', {"DJANGO_ALLOWED_HOSTS": hosts})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_public_host_cannot_include_ports_wildcards_or_malformed_labels(self):
        for host in ("*.koreacentral.cloudapp.azure.com", "outloud.koreacentral.cloudapp.azure.com:443",
                     "-outloud.koreacentral.cloudapp.azure.com", "outloud..cloudapp.azure.com",
                     "outloud.koreacentral.cloudapp.azure.com,", "outloud.cloudapp.azure.com.evil.example",
                     "outloud.koreacentral.cloudapp.azure.com\n"):
            with self.subTest(host=host):
                result = self.probe("", {"DJANGO_ALLOWED_HOSTS": host})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("exact Azure or Tailscale DNS names", result.stderr)

    def test_tls_proxy_produces_https_media_and_rejects_foreign_hosts(self):
        result = self.probe('''
from types import SimpleNamespace
from uuid import UUID
from django.conf import settings
from django.core.files.storage import default_storage
from django.test import Client, RequestFactory
from rehearsals.views import deck_data
assert settings.DEBUG is False
host = "outloud.team-example.ts.net"
request = RequestFactory().get("/api/decks/", HTTP_HOST=host,
    HTTP_X_FORWARDED_PROTO="https", HTTP_X_FORWARDED_HOST="attacker.example")
slide = SimpleNamespace(slide_index=0, extracted_text="Fixture",
    image=SimpleNamespace(url=default_storage.url("slides/fixture.png")))
deck = SimpleNamespace(id=UUID("11111111-1111-4111-8111-111111111111"), title="Fixture",
    page_count=1, pdf=SimpleNamespace(url=default_storage.url("decks/fixture.pdf")),
    slides=SimpleNamespace(all=lambda: [slide]))
result = deck_data(deck, request)
assert result["pdf_url"] == "https://" + host + "/media/decks/fixture.pdf"
assert result["slides"][0]["image_url"] == "https://" + host + "/media/slides/fixture.png"
assert request.build_absolute_uri(default_storage.url("recordings/fixture.m4a")) == "https://" + host + "/media/recordings/fixture.m4a"
client = Client()
assert client.get("/api/health/", HTTP_HOST=host, HTTP_X_FORWARDED_PROTO="https").status_code == 200
assert client.get("/api/health/", HTTP_HOST=host).status_code == 301
assert client.get("/api/health/", HTTP_HOST="attacker.example", HTTP_X_FORWARDED_PROTO="https").status_code == 400
# Gunicorn must never fall back to Django's debug-only media serving.
assert client.get("/media/decks/fixture.pdf", HTTP_HOST=host, HTTP_X_FORWARDED_PROTO="https").status_code == 404
''')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_local_development_settings_are_unchanged(self):
        result = self.probe('''
from django.conf import settings
assert settings.DEBUG is True
assert "10.0.2.2" in settings.ALLOWED_HOSTS
assert settings.SECURE_SSL_REDIRECT is False
assert settings.MEDIA_URL == "/"
''', {"DJANGO_ALLOWED_HOSTS": None}, module="config.settings")
        self.assertEqual(result.returncode, 0, result.stderr)
