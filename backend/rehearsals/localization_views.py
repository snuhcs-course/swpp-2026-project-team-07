"""Display translation admission and read-only status, behind the existing API edge."""
from rest_framework.decorators import api_view, parser_classes, throttle_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .feedback_v3.llm import LLMError
from .models import DisplayTranslation
from .services import localization, prepared_display
from .services.feedback import FeedbackError


class TranslationAdmissions(AnonRateThrottle):
    scope = 'display_translation'
    rate = '120/min'


@api_view(['POST'])
@parser_classes([JSONParser])
@throttle_classes([TranslationAdmissions])
def request_translation(request):
    try:
        row = localization.admit(request.data)
    except localization.SourceUnavailable:
        return Response({'error': {'code': 'translation_source_unavailable'}}, status=409)
    except (ValueError, TypeError):
        return Response({'error': {'code': 'invalid_request'}}, status=400)
    except (FeedbackError, LLMError):
        return Response({'error': {'code': 'translation_unavailable'}}, status=503)
    body = localization.public(row)
    return Response(body, status=202 if body['state'] == 'pending' else 200)


@api_view(['GET'])
def translation_status(request, translation_id):
    row = DisplayTranslation.objects.filter(pk=translation_id).first()
    if not row:
        return Response({'error': {'code': 'translation_not_found'}}, status=404)
    return Response(localization.public(row), status=202 if row.state in ('queued', 'running') else 200)


@api_view(['POST'])
@parser_classes([JSONParser])
@throttle_classes([TranslationAdmissions])
def prepare(request):
    if request.query_params:
        return Response({'error': {'code': 'invalid_request'}}, status=400)
    try:
        bundle = prepared_display.enroll(request.data)
        result = prepared_display.page(bundle.kind, bundle.resource_id, bundle.revision)
    except localization.SourceUnavailable:
        return Response({'error': {'code': 'translation_source_unavailable'}}, status=409)
    except (ValueError, TypeError):
        return Response({'error': {'code': 'invalid_request'}}, status=400)
    return Response(result, status=202 if result['state'] == 'pending' else 200)


@api_view(['GET'])
def prepared(request, kind, resource_id):
    if set(request.query_params) - {'revision', 'cursor'}:
        return Response({'error': {'code': 'invalid_request'}}, status=400)
    try:
        result = prepared_display.page(kind, resource_id, request.query_params.get('revision', ''), request.query_params.get('cursor', ''))
    except (ValueError, TypeError):
        return Response({'error': {'code': 'invalid_request'}}, status=400)
    return Response(result, status=202 if result['state'] == 'pending' else 200)
