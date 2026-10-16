"""Explicit local saved-receipt repair; dry-run by default, never calls AI."""
import json
from django.core.management.base import BaseCommand,CommandError
from rehearsals.services.slide_review import revalidate_saved
from rehearsals.services.feedback import FeedbackError
from rehearsals.models import FeedbackJob,FeedbackRequest

class Command(BaseCommand):
    help='Revalidate one current saved review receipt without a provider request.'
    def add_arguments(self,parser):
        parser.add_argument('--job',type=int,required=True)
        parser.add_argument('--apply',action='store_true')
    def handle(self,*args,**options):
        try:result=revalidate_saved(options['job'],apply=options['apply'])
        except FeedbackError as e:raise CommandError(e.code) from None
        except (FeedbackJob.DoesNotExist,FeedbackRequest.DoesNotExist):raise CommandError('review_receipt_not_found') from None
        self.stdout.write(json.dumps(result))
