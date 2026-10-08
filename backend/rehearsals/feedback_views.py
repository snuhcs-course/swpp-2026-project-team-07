"""Explicit coaching actions; reading or refreshing never submits work."""
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response

from .models import Attempt
from .services import coaching as service
from .services.feedback import FeedbackError, strict_json
from django.core.exceptions import RequestDataTooBig


def _body(request):
    if request.content_type != 'application/json':
        raise FeedbackError('invalid_request')
    length = request.META.get('CONTENT_LENGTH', '')
    if length and (not length.isdigit() or int(length) > 1024):
        raise FeedbackError('invalid_request')
    try:
        value = strict_json(request._request.read(1025), 1024)
    except (FeedbackError, RequestDataTooBig, OSError):
        raise FeedbackError('invalid_request') from None
    if type(value) is not dict or set(value) - {'feedback_revision', 'acknowledge_uncertain'}:
        raise FeedbackError('invalid_request')
    if 'feedback_revision' in value and (type(value['feedback_revision']) is not int or not 0 <= value['feedback_revision'] <= 2**31 - 1):
        raise FeedbackError('invalid_request')
    if 'acknowledge_uncertain' in value and type(value['acknowledge_uncertain']) is not bool:
        raise FeedbackError('invalid_request')
    return value


def _error(error):
    if isinstance(error, Attempt.DoesNotExist):
        return Response({'error': service.safe_error('not_found')}, status=404)
    if isinstance(error, service.Conflict):
        return Response({'error': service.safe_error(error.code)}, status=409)
    if isinstance(error, FeedbackError):
        configuration = {'disabled', 'invalid_configuration', 'missing_api_key', 'quota_configuration', 'project_changed', 'snapshot_unavailable'}
        return Response({'error': service.safe_error(error.code)}, status=503 if error.code in configuration else 400)
    return Response({'error': service.safe_error('temporarily_unavailable')}, status=503)


@api_view(['GET'])
@parser_classes([])
def feedback(request, attempt_id):
    try:
        if request.query_params:
            raise FeedbackError('invalid_request')
        return Response(service.read(attempt_id))
    except Exception as error:
        return _error(error)


@api_view(['POST'])
@parser_classes([])
def generate(request, attempt_id):
    try:
        if request.query_params:
            raise FeedbackError('invalid_request')
        service.generate(attempt_id, _body(request))
        state = service.read(attempt_id)
        return Response(state, status=200 if state['state'] == 'completed' else 202)
    except Exception as error:
        return _error(error)
