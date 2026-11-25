"""Bearer enrollment and private media for the dedicated ONE Store service."""
import hashlib
import ipaddress
import mimetypes
import re
import secrets
import time
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, JsonResponse
from django.urls import path
from django.utils import timezone
from django.utils.cache import patch_vary_headers
from django.utils.crypto import salted_hmac

from .models import Attempt, Deck, Installation, PresentationContext, Slide
from .ownership import INSTALLATION_RETENTION, current_installation_id, foreign_pk_exists, installation_scope


_public_views = set()
TOKEN = re.compile(r"Bearer ([A-Za-z0-9_-]{43})", re.IGNORECASE | re.ASCII)
ENROLLMENTS_PER_HOUR = 12
WRITES_PER_INSTALLATION_HOUR = 240


def public_path(route, view):
    """Only explicitly registered handlers can run on the public service."""
    _public_views.add(view)
    return path(route, view)


def _error(code, status):
    return JsonResponse({"error": {"code": code}}, status=status)


def _private(response):
    response["Cache-Control"] = "private, no-store"
    patch_vary_headers(response, ["Authorization"])
    return response


def _digest(token):
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _hourly_limit(scope, identity, limit):
    window, elapsed = divmod(int(time.time()), 3600)
    remaining = 3600 - elapsed
    digest = salted_hmac("outloud-" + scope, f"{identity}/{window}").hexdigest()
    key = f"store:{scope}:{digest}"
    try:
        cache.add(key, 0, timeout=remaining + 1)
        count = cache.incr(key)
    except Exception:
        response = _error(scope + "_unavailable", 503)
        response["Retry-After"] = "60"
        return response
    if count > limit:
        response = _error(scope + "_rate_limited", 429)
        response["Retry-After"] = str(remaining)
        return response
    return None


def _authenticate(request):
    bearer = TOKEN.fullmatch(request.META.get("HTTP_AUTHORIZATION", ""))
    if not bearer:
        return None
    now = timezone.now()
    valid = Installation.objects.filter(token_hash=_digest(bearer[1]), last_seen__gt=now - INSTALLATION_RETENTION)
    install = valid.first()
    cutoff = now - timedelta(hours=1)
    if install is not None and install.last_seen < cutoff:
        # A concurrent request may already have touched it. A purged row cannot return.
        if not valid.filter(last_seen__lt=cutoff).update(last_seen=now) and not valid.exists():
            return None
    return install


def enroll(request):
    if not settings.OUTLOUD_PUBLIC_SERVICE:
        return _error("not_found", 404)
    if request.method != "POST":
        response = _error("method_not_allowed", 405)
        response["Allow"] = "POST"
        return response
    # The dedicated edge overwrites X-Real-IP. Retain only an expiring, keyed digest.
    address = request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")
    try:
        address = ipaddress.ip_address(address)
    except ValueError:
        return _error("enrollment_unavailable", 503)
    network = ipaddress.ip_network((address, 64 if address.version == 6 else 32), strict=False)
    limited = _hourly_limit("enrollment", network, ENROLLMENTS_PER_HOUR)
    if limited is not None:
        return limited
    token = secrets.token_urlsafe(32)
    Installation.objects.create(token_hash=_digest(token))
    return JsonResponse({"token": token}, status=201)


def _media(request, name):
    if request.method not in ("HEAD", "GET"):
        response = _error("method_not_allowed", 405)
        response["Allow"] = "GET, HEAD"
        return response
    parts = name.split("/")
    if (len(parts) < 4 or parts[:2] != ["i", str(current_installation_id())]
            or not re.fullmatch(r"[A-Za-z0-9_./-]{1,200}", name) or any(p in ("", ".", "..") for p in parts)):
        return _error("not_found", 404)
    public_files = {"decks": (Deck, "pdf"), "slides": (Slide, "image"), "recordings": (Attempt, "audio")}
    source = public_files.get(parts[2])
    if source is None or not source[0].objects.filter(**{source[1]: name}).exists():
        return _error("not_found", 404)
    # nginx's internal alias serves only this authorized generated file, including ranges.
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    response = HttpResponse(content_type=content_type)
    response["X-Accel-Redirect"] = "/__store_media/" + name
    return response


class InstallationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not settings.OUTLOUD_PUBLIC_SERVICE:
            return self.get_response(request)
        if request.path_info in ("/api/installations/", "/api/health/"):
            return _private(self.get_response(request))
        install = _authenticate(request)
        if install is None:
            response = _error("installation_required", 401)
            response["WWW-Authenticate"] = "Bearer"
            return _private(response)
        with installation_scope(install.pk):
            if request.path_info.startswith("/media/"):
                return _private(_media(request, request.path_info[len("/media/"):]))
            return _private(self.get_response(request))

    def process_view(self, request, view, args, kwargs):
        if not settings.OUTLOUD_PUBLIC_SERVICE:
            return None
        if view not in _public_views:
            return _error("not_found", 404)
        owner = current_installation_id()
        if owner is not None and request.method in ("POST", "PUT", "PATCH", "DELETE"):
            limited = _hourly_limit("installation_write", owner, WRITES_PER_INSTALLATION_HOUR)
            if limited is not None:
                return limited
        for parameter, model in (("deck_id", Deck), ("attempt_id", Attempt), ("context_id", PresentationContext)):
            if parameter not in kwargs:
                continue
            pk = kwargs[parameter]
            from .capture_views import capture
            if view is capture and request.method == "POST":
                # Initial incremental capture creates this client-chosen recording ID.
                if foreign_pk_exists(Attempt, pk):
                    return _error("not_found", 404)
            elif not model.objects.filter(pk=pk).exists():
                return _error("not_found", 404)
        return None
