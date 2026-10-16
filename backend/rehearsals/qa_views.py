# AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
# Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
"""Audience Q&A endpoints (mobile Audience Q&A screen). Each POST is one explicit user action."""
import json

from django.core.exceptions import RequestDataTooBig
from rest_framework.decorators import api_view, parser_classes
from rest_framework.exceptions import APIException
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Deck
from .services import qa
from .services.feedback import FeedbackError, strict_json
from .services.transcription import TranscriptionError

MAX_QUESTION_BODY = 80_000
CONFIGURATION = {'disabled', 'invalid_configuration', 'missing_api_key', 'quota_configuration', 'project_changed'}
MESSAGES = {
    'deck_not_found': 'This presentation is not on the server.',
    'disabled': 'AI feedback is turned off on this server (FEEDBACK_ENABLED).',
    'missing_api_key': 'The AI provider key is not configured on the server.',
    'quota_configuration': 'AI feedback quota settings are missing on the server.',
    'invalid_request': 'The request was not valid.',
    'waiting_quota': 'The AI provider asked us to wait. Try again later.',
    'provider_rate_limit': 'The AI provider is busy. Try again later.',
    'too_short': 'The answer was too short to review.',
}
UNCERTAIN = 'The provider did not confirm the result. The request may have been charged.'


def _error(code, status, message=None, retry_at=None):
    body = {'code': code, 'message': message or MESSAGES.get(code, f'Audience Q&A unavailable ({code}).')}
    if retry_at:
        body['retry_at'] = retry_at.isoformat()
    return Response({'error': body}, status=status)


def _failure(error):
    if isinstance(error, Deck.DoesNotExist):
        return _error('deck_not_found', 404)
    if isinstance(error, APIException) and 400 <= error.status_code < 500:
        return _error('invalid_request', 400)  # Malformed multipart or unsupported media type.
    if isinstance(error, TranscriptionError):
        status = 503 if error.code == 'missing_api_key' else 400 if error.code in {'unsupported_audio', 'invalid_audio_size', 'audio_unavailable'} else 502
        return _error(error.code, status, str(error), error.retry_at)
    if isinstance(error, FeedbackError):
        if error.code in CONFIGURATION:
            return _error(error.code, 503)
        if error.code in {'waiting_quota', 'provider_rate_limit'}:
            return _error(error.code, 429, retry_at=error.retry_at)
        if error.code == 'invalid_request':
            return _error(error.code, 400)
        return _error(error.code, 502, UNCERTAIN if error.uncertain else None, error.retry_at)
    return _error('temporarily_unavailable', 503)


@api_view(['POST'])
@parser_classes([])
def questions(request, deck_id):
    try:
        deck = Deck.objects.get(pk=deck_id)
        if request.content_type != 'application/json':
            raise FeedbackError('invalid_request')
        length = request.META.get('CONTENT_LENGTH', '')
        if length and (not length.isdigit() or int(length) > MAX_QUESTION_BODY):
            raise FeedbackError('invalid_request')
        try:
            payload = strict_json(request._request.read(MAX_QUESTION_BODY + 1), MAX_QUESTION_BODY)
        except (FeedbackError, RequestDataTooBig, OSError):
            raise FeedbackError('invalid_request') from None
        return Response(qa.write_questions(deck, payload))
    except Exception as error:
        return _failure(error)


@api_view(['POST'])
@parser_classes([MultiPartParser])
def answers(request, deck_id):
    try:
        deck = Deck.objects.get(pk=deck_id)
        audio = request.FILES.get('audio')
        try:
            metadata = json.loads(request.data.get('metadata', ''))
        except (TypeError, ValueError):
            raise FeedbackError('invalid_request') from None
        if audio is None or type(metadata) is not dict:
            raise FeedbackError('invalid_request')
        return Response(qa.review_answer(deck, metadata, audio))
    except Exception as error:
        return _failure(error)
