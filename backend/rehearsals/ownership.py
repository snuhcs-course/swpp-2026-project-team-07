"""Request and worker ownership for the public installation service."""
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


_installation = ContextVar("outloud_installation", default=None)
INSTALLATION_RETENTION = timedelta(days=30)


def current_installation_id():
    return _installation.get()


@contextmanager
def installation_scope(installation_id):
    token = _installation.set(installation_id)
    try:
        yield
    finally:
        _installation.reset(token)


class InstallationManager(models.Manager):
    def get_queryset(self):
        rows = super().get_queryset()
        installation_id = current_installation_id()
        if installation_id is None:
            return rows
        lookup = self.model.installation_lookup
        if lookup == "installation_id":
            return rows.filter(installation_id=installation_id)
        # Keep joins inside a subquery: SELECT FOR UPDATE keeps its existing lock order.
        owner = models.Q(**{lookup: installation_id})
        alternative = getattr(self.model, "alternate_installation_lookup", None)
        if alternative:
            owner |= models.Q(**{alternative: installation_id})
        owned = self.model._base_manager.filter(owner).values("pk")
        return rows.filter(pk__in=owned)


class InstallationOwned(models.Model):
    objects = InstallationManager()

    class Meta:
        abstract = True


def foreign_pk_exists(model, pk):
    owner = current_installation_id()
    return owner is not None and model._base_manager.filter(pk=pk).exclude(
        **{model.installation_lookup: owner}
    ).exists()


def run_owned(model, pk, operation, *args):
    """Resolve queue IDs from durable rows belonging to an active installation."""
    if not settings.OUTLOUD_PUBLIC_SERVICE:
        return operation(pk, *args)
    installation = model.installation_lookup.removesuffix("_id")
    active = {installation + "__last_seen__gt": timezone.now() - INSTALLATION_RETENTION}
    owner = model.objects.filter(pk=pk, **active).values_list(model.installation_lookup, flat=True).first()
    if owner is not None:
        with installation_scope(owner):
            return operation(pk, *args)
