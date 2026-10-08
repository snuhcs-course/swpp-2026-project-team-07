"""Strict bounded JSON and safe allowlisted responses for description-only routes."""
import uuid

from django.core.exceptions import RequestDataTooBig
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response

from .models import Deck, DescriptionSet
from .services import descriptions as service
from .services.feedback import FeedbackError, strict_json

BODY_LIMIT = 70 * 1024


def _uuid(value):
    try:
        if type(value) is not str or str(uuid.UUID(value)) != value:
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise FeedbackError('invalid_request') from None
    return value


def _body(request, edit=False):
    if request.content_type != 'application/json':
        raise FeedbackError('invalid_request')
    length = request.META.get('CONTENT_LENGTH', '')
    if length and (not length.isdigit() or int(length) > BODY_LIMIT):
        raise FeedbackError('invalid_request')
    try:
        # Bounded stream read precedes JSON parsing; DRF request.data is never used.
        raw = request._request.read(BODY_LIMIT + 1)
        value = strict_json(raw, BODY_LIMIT)
    except (FeedbackError, RequestDataTooBig, OSError):
        raise FeedbackError('invalid_request') from None
    allowed = {'description_set_id', 'description_revision', 'descriptions'} if edit else {
        'description_set_id', 'processing_revision', 'acknowledge_uncertain'}
    if type(value) is not dict or set(value) - allowed or (edit and set(value) != allowed):
        raise FeedbackError('invalid_request')
    if 'description_set_id' in value:
        _uuid(value['description_set_id'])
    revision = 'description_revision' if edit else 'processing_revision'
    if revision in value and (type(value[revision]) is not int or not 0 <= value[revision] <= 2**31 - 1):
        raise FeedbackError('invalid_request')
    if 'acknowledge_uncertain' in value and type(value['acknowledge_uncertain']) is not bool:
        raise FeedbackError('invalid_request')
    if not edit and set(value) - {'description_set_id'} and 'description_set_id' not in value:
        raise FeedbackError('invalid_request')
    return value


def _error(error):
    if isinstance(error, (Deck.DoesNotExist, DescriptionSet.DoesNotExist)):
        return Response({'error': service.safe_error('not_found')}, status=404)
    if isinstance(error, service.Conflict):
        return Response({'error': service.safe_error(error.code)}, status=409)
    if isinstance(error, FeedbackError):
        configuration = {'disabled', 'invalid_configuration', 'missing_api_key', 'quota_configuration', 'project_changed', 'snapshot_unavailable'}
        return Response({'error': service.safe_error(error.code)}, status=503 if error.code in configuration else 400)
    # Database/preparation exceptions are not echoed, including in application logs.
    return Response({'error': service.safe_error('temporarily_unavailable')}, status=503)


@api_view(['GET', 'PATCH'])
@parser_classes([])
def descriptions(request, deck_id):
    try:
        if request.method == 'GET':
            if set(request.query_params) - {'description_set_id'} or len(request.query_params.getlist('description_set_id')) > 1:
                raise FeedbackError('invalid_request')
            set_id = request.query_params.get('description_set_id')
            if set_id is not None:
                _uuid(set_id)
            return Response(service.read(deck_id, set_id))
        value = service.edit(deck_id, _body(request, edit=True))
        return Response(service.public_state(deck_id, value, source=value.source_fingerprint))
    except Exception as error:
        return _error(error)


@api_view(['POST'])
@parser_classes([])
def generate(request, deck_id):
    try:
        payload = _body(request)
        value = service.generate(deck_id, payload)
        state = service.read(deck_id, value.pk)
        return Response(state, status=200 if state['state'] == 'completed' else 202)
    except Exception as error:
        return _error(error)
