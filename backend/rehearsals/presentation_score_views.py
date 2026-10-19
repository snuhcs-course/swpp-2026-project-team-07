"""Read-only scoring inspection; only explicit POST admits provider work."""
from django.core.exceptions import RequestDataTooBig
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response

from .feedback_views import _error
from .models import Attempt
from .services import presentation_scoring
from .services.feedback import FeedbackError, strict_json
from .durable_qa_views import controls


@api_view(['GET', 'POST'])
@parser_classes([])
def score(request, attempt_id):
    try:
        attempt = Attempt.objects.select_related('deck').get(pk=attempt_id)
        if request.method == 'GET':
            if set(request.query_params) - {'context_id'} or len(request.query_params.getlist('context_id')) > 1:
                raise FeedbackError('invalid_request')
            context_id = presentation_scoring.context_for(attempt, request.query_params.get('context_id'))
        else:
            if request.query_params or request.content_type != 'application/json':
                raise FeedbackError('invalid_request')
            try:
                payload = strict_json(request._request.read(4097), 4096)
            except (RequestDataTooBig, OSError):
                raise FeedbackError('invalid_request') from None
            if type(payload) is not dict:
                raise FeedbackError('invalid_request')
            context_id = presentation_scoring.context_for(attempt, payload.pop('context_id', None))
            controls(payload)
            presentation_scoring.generate(attempt_id, payload, context_id)
        state = presentation_scoring.read(attempt_id, context_id)
        return Response(state, status=202 if request.method == 'POST' and state['state'] != 'completed' else 200)
    except Exception as error:
        return _error(error)
