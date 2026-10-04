from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from rehearsals.models import Generation, Attempt


class Command(BaseCommand):
    help = "Explicit operator retry after inspecting an uncertain request; may duplicate provider work."

    def add_arguments(self, parser):
        parser.add_argument("key")
        parser.add_argument("--acknowledge-possible-duplicate", action="store_true")

    def handle(self, key, acknowledge_possible_duplicate, **options):
        if not acknowledge_possible_duplicate:
            raise CommandError("Inspect provider records first; pass --acknowledge-possible-duplicate to authorize one retry.")
        with transaction.atomic():
            generation = Generation.objects.select_for_update().get(key=key)
            if generation.state not in {"unknown", "generating"}:
                raise CommandError("This request is not uncertain.")
            generation.state, generation.error, generation.not_before = "pending", None, None
            generation.save()
            Attempt.objects.filter(Q(feedback_key=key) | Q(deck__analysis_key=key), status="failed").update(feedback_state="failed")
        self.stdout.write("Resolved for one explicit app retry. Existing provider request records are preserved.")
