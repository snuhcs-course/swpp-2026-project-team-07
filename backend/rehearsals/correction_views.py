"""Strict correction persistence. Neither GET nor PATCH admits provider jobs."""
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from django.core.exceptions import RequestDataTooBig
from .services import corrections
from .services.feedback import FeedbackError, strict_json
from .feedback_views import _error, _body
from .services import coaching


@api_view(['GET', 'PATCH'])
@parser_classes([])
def correction(request, attempt_id):
    try:
        if request.query_params:
            raise FeedbackError('invalid_request')
        if request.method == 'GET':
            return Response(corrections.read(attempt_id))
        if request.content_type != 'application/json':
            raise FeedbackError('invalid_request')
        try:
            payload = strict_json(request._request.read(262145), 262144)
        except (RequestDataTooBig, OSError):
            raise FeedbackError('invalid_request') from None
        return Response(corrections.save(attempt_id, payload))
    except Exception as error:
        return _error(error)


@api_view(['GET', 'POST'])
@parser_classes([])
def suggestions(request, attempt_id):
    try:
        if request.query_params:
            raise FeedbackError('invalid_request')
        if request.method == 'POST':
            coaching.generate(attempt_id, _body(request), 'transcription_suggestions')
        state = coaching.read(attempt_id, 'transcription_suggestions')
        return Response(state, status=202 if request.method == 'POST' and state['state'] != 'completed' else 200)
    except Exception as error:
        return _error(error)
