"""Incremental recording API; GET is display-only and never submits provider work."""
from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import Attempt, CaptureSession, CaptureSegment
from .ownership import foreign_pk_exists
from .services import incremental


def respond(work):
    try:
        session = work()
        return Response(incremental.public(session))
    except incremental.CaptureError as error:
        return Response({'error': {'code': error.code, 'message': error.message}}, status=error.status)


def session_for(attempt_id):
    return get_object_or_404(CaptureSession.objects.select_related('attempt__deck', 'context'), pk=attempt_id)


@api_view(['GET'])
def capabilities(request):
    return Response({'enabled': incremental.enabled(), 'max_segment_ms': incremental.MAX_SEGMENT_MS,
                     'max_audio_bytes': incremental.MAX_AUDIO_BYTES})


@api_view(['GET', 'POST'])
def capture(request, attempt_id):
    if request.method != 'POST':
        return respond(lambda: session_for(attempt_id))
    try:
        return respond(lambda: incremental.declare(attempt_id, request.data))
    except IntegrityError:
        if foreign_pk_exists(Attempt, attempt_id):
            return Response({'error': {'code': 'capture_conflict'}}, status=409)
        raise


@api_view(['POST'])
def segment(request, attempt_id, sequence):
    def work():
        session_for(attempt_id)
        incremental.upload_segment(attempt_id, sequence, request.FILES.get('file'))
        return session_for(attempt_id)
    return respond(work)


@api_view(['POST'])
def audio(request, attempt_id):
    def work():
        session_for(attempt_id)
        incremental.upload_audio(attempt_id, request.FILES.get('file'))
        return session_for(attempt_id)
    return respond(work)


@api_view(['POST'])
def retry(request, attempt_id, sequence):
    data = request.data
    if not isinstance(data, dict) or set(data) - {'acknowledge_uncertain'} or type(data.get('acknowledge_uncertain', False)) is not bool:
        raise ValidationError('Provide only an optional acknowledge_uncertain boolean.')
    def work():
        get_object_or_404(CaptureSegment, capture_id=attempt_id, sequence=sequence)
        incremental.retry_segment(attempt_id, sequence, data.get('acknowledge_uncertain', False))
        return session_for(attempt_id)
    return respond(work)
