from django.core.management.base import BaseCommand
from django.db.models import Count, Sum
from rehearsals.models import ProviderRequest


class Command(BaseCommand):
    help = "Report aggregate AI calls/tokens without exposing prompts, responses or credentials."

    def handle(self, **options):
        for group in ProviderRequest.objects.values("project_id", "operation", "state").annotate(requests=Count("id"), reserved_input_tokens=Sum("reserved_tokens"), latency_ms=Sum("latency_ms")):
            self.stdout.write(str(group))
        usage = {"promptTokenCount": 0, "candidatesTokenCount": 0, "totalTokenCount": 0}
        for row in ProviderRequest.objects.values_list("usage", flat=True):
            for key in usage:
                usage[key] += row.get(key, 0)
        self.stdout.write(str(usage))
