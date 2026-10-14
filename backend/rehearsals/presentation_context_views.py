"""Phase 1 requirements API. No AI admission, run edits, or transcript mutations."""
import uuid

from django.core.exceptions import RequestDataTooBig
from django.db import transaction
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response

from .models import Deck, PresentationContext
from .services.feedback import FeedbackError, strict_json

BODY_LIMIT = 8192
MAX_REVISION = 2**31 - 1


def _body(request, fields):
    if request.content_type != 'application/json':
        raise FeedbackError('invalid_request')
    try:
        value = strict_json(request._request.read(BODY_LIMIT + 1), BODY_LIMIT)
    except (RequestDataTooBig, OSError):
        raise FeedbackError('invalid_request') from None
    if type(value) is not dict or set(value) != fields:
        raise FeedbackError('invalid_request')
    return value


def _uuid(value):
    try:
        if type(value) is not str or str(uuid.UUID(value)) != value:
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise FeedbackError('invalid_request') from None
    return value


def _public(value):
    return {'id': str(value.pk), 'deck_id': str(value.deck_id),
            'required_duration_seconds': value.required_duration_seconds,
            'audience': value.audience, 'revision': value.revision}


def _error(code, status):
    return Response({'error': {'code': code, 'message': f'Presentation requirements unavailable ({code}).'}}, status=status)


def _failure(error):
    if isinstance(error, (Deck.DoesNotExist, PresentationContext.DoesNotExist)):
        return _error('not_found', 404)
    if isinstance(error, FeedbackError):
        return _error('invalid_request', 400)
    return _error('temporarily_unavailable', 503)


@api_view(['POST'])
@parser_classes([])
def contexts(request):
    try:
        payload = _body(request, {'id', 'deck_id'})
        context_id, deck_id = _uuid(payload['id']), _uuid(payload['deck_id'])
        deck = Deck.objects.get(pk=deck_id)
        value, created = PresentationContext.objects.get_or_create(pk=context_id, defaults={'deck': deck})
        if str(value.deck_id) != deck_id:
            return _error('context_conflict', 409)
        return Response(_public(value), status=201 if created else 200)
    except Exception as error:
        return _failure(error)


@api_view(['GET', 'PATCH'])
@parser_classes([])
def context(request, context_id):
    try:
        if request.query_params:
            raise FeedbackError('invalid_request')
        if request.method == 'GET':
            return Response(_public(PresentationContext.objects.get(pk=context_id)))
        payload = _body(request, {'expected_revision', 'required_duration_seconds', 'audience'})
        revision, duration, audience = (payload['expected_revision'], payload['required_duration_seconds'], payload['audience'])
        if (type(revision) is not int or not 0 <= revision <= MAX_REVISION or
                (duration is not None and (type(duration) is not int or not 60 <= duration <= 1800)) or
                type(audience) is not str or len(audience) > 500 or '\x00' in audience or
                any(0xD800 <= ord(char) <= 0xDFFF for char in audience)):
            raise FeedbackError('invalid_request')
        with transaction.atomic():
            value = PresentationContext.objects.select_for_update().get(pk=context_id)
            if value.revision != revision:
                return _error('stale_revision', 409)
            if (value.required_duration_seconds, value.audience) != (duration, audience):
                if value.revision == MAX_REVISION:
                    return _error('revision_exhausted', 409)
                value.required_duration_seconds, value.audience = duration, audience
                value.revision += 1
                value.save(update_fields=['required_duration_seconds', 'audience', 'revision'])
            return Response(_public(value))
    except Exception as error:
        return _failure(error)
