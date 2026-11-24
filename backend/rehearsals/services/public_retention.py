"""Remove an inactive store installation's own cloud data and files."""
import shutil
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .. import models
from ..ownership import INSTALLATION_RETENTION


def purge_expired_installations():
    if not settings.OUTLOUD_PUBLIC_SERVICE:
        return 0
    cutoff = timezone.now() - INSTALLATION_RETENTION
    expired = list(models.Installation.objects.filter(last_seen__lte=cutoff)
                   .order_by('last_seen', 'pk').values_list('pk', flat=True)[:100])
    removed = 0
    for installation_id in expired:
        with transaction.atomic():
            installation = models.Installation.objects.select_for_update().filter(
                pk=installation_id, last_seen__lte=cutoff).first()
            if installation is None:
                continue
            # These relations use PROTECT to preserve active recordings and provider receipts.
            # Delete children first, with every query tied to this installation.
            decks = models.Deck.objects.filter(installation=installation)
            attempts = models.Attempt.objects.filter(deck__in=decks)
            requests = models.FeedbackRequest.objects.filter(
                Q(job__description_set__deck__in=decks) | Q(coaching_job__analysis__attempt__in=attempts))
            models.PreparedDisplayResource.objects.filter(installation=installation).delete()
            models.DisplayTranslation.objects.filter(installation=installation).delete()
            models.FeedbackReservation.objects.filter(request__in=requests).delete()
            requests.delete()
            models.SlideReviewMembership.objects.filter(attempt__in=attempts).delete()
            models.QaAnswer.objects.filter(attempt__in=attempts).delete()
            models.TranscriptCorrection.objects.filter(attempt__in=attempts).delete()
            models.FeedbackJob.objects.filter(analysis__attempt__in=attempts).delete()
            models.FeedbackAnalysis.objects.filter(attempt__in=attempts).delete()
            models.DescriptionJob.objects.filter(description_set__deck__in=decks).delete()
            models.DescriptionSet.objects.filter(deck__in=decks).delete()
            attempts.delete()
            models.PresentationContext.objects.filter(deck__in=decks).delete()
            decks.delete()
        # Keep the expired credential row until files are gone so an interrupted cleanup retries.
        directory = Path(settings.MEDIA_ROOT) / 'i' / str(installation_id)
        try:
            shutil.rmtree(directory)
        except FileNotFoundError:
            if directory.exists():
                raise
        models.Installation.objects.filter(pk=installation_id, last_seen__lte=cutoff).delete()
        removed += 1
    return removed
