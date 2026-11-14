"""GET/POST /api/attempts/<id>/feedback-run/ for the v3 pipeline.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
GET never starts work. POST starts or reuses the run for the current inputs;
{"retry": true} re-queues only the parts that failed.
"""
import os

from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Attempt
from . import llm, pipeline


def _error(code: str, status: int) -> Response:
    return Response({'error': {'code': code, 'message': pipeline.MESSAGES.get(code, code)}}, status=status)


@api_view(['GET', 'POST'])
def feedback_run(request, attempt_id):
    try:
        attempt = Attempt.objects.select_related('deck').get(pk=attempt_id)
    except Attempt.DoesNotExist:
        return _error('not_found', 404)
    try:
        if request.method == 'GET':
            context = pipeline.resolve_context(attempt, request.query_params.get('context_id'))
            body = pipeline.public(pipeline.latest_run(attempt, context))
            body['enabled'] = os.environ.get('FEEDBACK_V3_ENABLED', 'false') == 'true'
            return Response(body)
        payload = request.data if isinstance(request.data, dict) else None
        if payload is None or set(payload) - {'context_id', 'retry'} or not isinstance(payload.get('retry', False), bool):
            return _error('invalid_request', 400)
        run = pipeline.start(attempt.pk, context_id=payload.get('context_id'), retry=payload.get('retry', False))
        run.refresh_from_db()
        body = pipeline.public(run)
        body['enabled'] = True
        return Response(body, status=202 if run.status in ('queued', 'running') else 200)
    except pipeline.RunError as error:
        return _error(error.code, error.status)
    except llm.LLMError as error:
        return _error(error.code, 409)
