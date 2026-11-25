"""GET/POST /api/attempts/<id>/feedback-run/ for the v3 pipeline.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
GET never starts work. POST starts or reuses the run for the current inputs;
{"retry": true} re-queues only the parts that failed.
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Attempt, CaptureSession, FeedbackRun
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
        capture = CaptureSession.objects.filter(pk=attempt_id).select_related('attempt__deck', 'context').first()
        if capture:
            from ..services import incremental
            if request.method == 'POST' and not isinstance(request.data, dict):
                return _error('invalid_request', 400)
            context_id = request.query_params.get('context_id') if request.method == 'GET' else request.data.get('context_id')
            if context_id is not None and str(capture.context_id) != context_id:
                return _error('invalid_context', 400)
            if request.method == 'POST':
                payload = request.data
                if not isinstance(payload, dict) or set(payload) - {'context_id', 'retry'} or type(payload.get('retry', False)) is not bool:
                    return _error('invalid_request', 400)
                incremental.refresh(attempt_id, retry=payload.get('retry', False), update_inputs=True)
                capture.refresh_from_db()
            return Response(incremental.feedback(capture))
        if request.method == 'GET':
            context = pipeline.resolve_context(attempt, request.query_params.get('context_id'))
            run = pipeline.latest_run(attempt, context)
            body = pipeline.public(run)
            body['enabled'] = pipeline.enabled()  # False when switched off or missing its key.
            # Lets the app re-request feedback after corrections or settings change.
            body['outdated'] = body['enabled'] and pipeline.outdated(attempt, context, run)
            return Response(body)
        payload = request.data if isinstance(request.data, dict) else None
        if payload is None or set(payload) - {'context_id', 'retry'} or not isinstance(payload.get('retry', False), bool):
            return _error('invalid_request', 400)
        run = pipeline.start(attempt.pk, context_id=payload.get('context_id'), retry=payload.get('retry', False))
        run.refresh_from_db()
        body = pipeline.public(run)
        body['enabled'], body['outdated'] = True, False
        return Response(body, status=202 if run.status in ('queued', 'running') else 200)
    except pipeline.RunError as error:
        return _error(error.code, error.status)
    except llm.LLMError as error:
        return _error(error.code, 409)


def _selected_body(run, *, enabled, outdated):
    return {**pipeline.public(run), 'scope': run.selected_scope, 'context_id': run.selected_scope['context_id'],
            'enabled': enabled, 'outdated': outdated}


# OpenAI Codex, 2026-11-23: use a separate scope for the currently selected rehearsal.
@api_view(['POST'])
def start_selected_feedback(request, attempt_id):
    payload = request.data
    if (request.query_params or not isinstance(payload, dict) or set(payload) - {'scope', 'retry'}
            or not isinstance(payload.get('scope'), dict) or type(payload.get('retry', False)) is not bool):
        return _error('invalid_request', 400)
    try:
        run = pipeline.start(attempt_id, selected_scope=payload['scope'], retry=payload.get('retry', False))
    except Attempt.DoesNotExist:
        return _error('not_found', 404)
    except pipeline.RunError as error:
        return _error(error.code, error.status)
    except llm.LLMError as error:
        return _error(error.code, 409)
    run.refresh_from_db()
    return Response(_selected_body(run, enabled=True, outdated=False),
                    status=202 if run.status in ('queued', 'running') else 200)


@api_view(['GET'])
def selected_feedback(request, attempt_id, run_id):
    if request.query_params:
        return _error('invalid_request', 400)
    try:
        run = FeedbackRun.objects.filter(selected_scope__isnull=False).select_related('attempt__deck', 'context').get(
            pk=run_id, attempt_id=attempt_id,
        )
    except FeedbackRun.DoesNotExist:
        return _error('not_found', 404)
    enabled = pipeline.enabled()
    return Response(_selected_body(run, enabled=enabled, outdated=enabled and pipeline.outdated(run.attempt, run.context, run)))
