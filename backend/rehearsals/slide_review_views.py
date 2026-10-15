"""Read-only inspection and explicit generation for selected slide visits."""
from django.core.exceptions import RequestDataTooBig
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from .models import Attempt, FeedbackAnalysis
from .services import coaching, slide_review, slide_profiles
from .services.feedback import strict_json, FeedbackError
from .services.feedback_config import selection_descriptor
from .feedback_views import _error

@api_view(['GET', 'POST'])
@parser_classes([])
def review(request, attempt_id):
    try:
        attempt = Attempt.objects.select_related('deck').get(pk=attempt_id)
        if request.method == 'GET':
            if set(request.query_params) != {'scope'}:
                raise FeedbackError('invalid_request')
            scope = slide_review.scope_for(attempt, strict_json(request.query_params['scope'].encode(), 65536))
        else:
            if request.query_params or request.content_type != 'application/json':
                raise FeedbackError('invalid_request')
            try:
                body = strict_json(request._request.read(65537), 65536)
            except (RequestDataTooBig, OSError):
                raise FeedbackError('invalid_request') from None
            if type(body) is not dict or 'scope' not in body or set(body) - {'scope', 'feedback_revision', 'transcript_revision', 'acknowledge_uncertain', 'expected_selection'}:
                raise FeedbackError('invalid_request')
            scope = slide_review.scope_for(attempt, body.pop('scope'))
            for name in ('feedback_revision', 'transcript_revision'):
                if name in body and (type(body[name]) is not int or not 0 <= body[name] < 2**31):
                    raise FeedbackError('invalid_request')
            if 'acknowledge_uncertain' in body and type(body['acknowledge_uncertain']) is not bool:
                raise FeedbackError('invalid_request')
            from .services.feedback_config import validate_assertion
            validate_assertion(body)
            coaching.generate(attempt_id, body, slide_review.analysis_type(scope), scope)
        kind = slide_review.analysis_type(scope)
        state = coaching.read(attempt_id, kind)
        if state['feedback_revision'] == 0:
            try: state['selection'] = selection_descriptor(slide_profiles.preferred_selection(attempt.deck_id), coaching=True)
            except FeedbackError: state['selection'] = None
        state['scope'] = scope
        state['review_version'] = slide_review.VERSION
        owner = FeedbackAnalysis.objects.filter(attempt_id=attempt_id, analysis_type=kind).first()
        job = owner.jobs.get(generation=state['feedback_revision']) if owner else None
        state['requirements'] = job.source_snapshot['slide_review']['requirements'] if job else slide_review.requirements(attempt, scope)
        return Response(state, status=202 if request.method == 'POST' and state['state'] != 'completed' else 200)
    except Exception as error:
        return _error(error)
