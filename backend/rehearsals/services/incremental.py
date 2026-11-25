"""Durable continuous-capture manifests, segment receipts and per-input assessments.

One audio clock; uploaded segments are never overwritten. Network calls happen
outside transactions, with a durable submitted marker and conditional claim.
"""
from copy import copy, deepcopy
from dataclasses import asdict
from datetime import timedelta
from io import BytesIO
import hashlib
import logging
import os
import time
import uuid
import wave

import httpx
from django.core.exceptions import ValidationError as ModelValidationError
from django.db import transaction
from django.utils import timezone
from public_billing.budget import MESSAGES as PUBLIC_BUDGET_MESSAGES
from rest_framework.exceptions import ValidationError

from ..models import Attempt, CaptureSession, CaptureSegment, CaptureAssessment, Deck, PresentationContext
from ..feedback_v3 import pipeline, llm, transcript as speech, measurements
from . import transcription
from .alignment import align_words
from .metrics import timing_metrics
from .speech_gate import has_speech
from .storage import read_upload, save_media, cleanup_media

MAX_DURATION_MS = 1_800_000
MAX_SEGMENT_MS = 60_000
MAX_AUDIO_BYTES = 60_000_044
STALE_SECONDS = 330
logger = logging.getLogger(__name__)


class CaptureError(Exception):
    def __init__(self, code, message, status=409):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def enabled():
    return (os.getenv('INCREMENTAL_CAPTURE_ENABLED', 'false') == 'true'
            and bool(os.getenv('ELEVENLABS_API_KEY', '').strip()) and pipeline.enabled())


def _integer(value, low, high):
    return type(value) is int and low <= value <= high


def validate_manifest(data, deck):
    fields = {'deck_id', 'context_id', 'audience', 'duration_ms', 'slide_events', 'segments', 'stopped'}
    if not isinstance(data, dict) or set(data) - fields:
        raise ValidationError('Provide a capture manifest object.')
    duration, events, segments = data.get('duration_ms'), data.get('slide_events'), data.get('segments')
    if not _integer(duration, 0, MAX_DURATION_MS) or type(data.get('stopped')) is not bool:
        raise ValidationError('Invalid capture duration or stopped flag.')
    if not isinstance(data.get('audience', ''), str) or len(data.get('audience', '')) > 500:
        raise ValidationError('Invalid audience.')
    if not isinstance(events, list) or not 1 <= len(events) <= 10000:
        raise ValidationError('Provide the complete slide-event prefix.')
    last = -1
    for i, event in enumerate(events):
        if (not isinstance(event, dict) or set(event) != {'slide_index', 'at_ms'}
                or not _integer(event['slide_index'], 0, deck.page_count - 1)
                or not _integer(event['at_ms'], 0, duration) or event['at_ms'] < last
                or (i == 0 and event['at_ms'] != 0)):
            raise ValidationError('Invalid slide timeline.')
        last = event['at_ms']
    if not isinstance(segments, list) or len(segments) > 10000:
        raise ValidationError('Invalid segment manifest.')
    end = 0
    for i, part in enumerate(segments):
        if (not isinstance(part, dict) or set(part) != {'sequence', 'slide_index', 'start_ms', 'end_ms'}
                or type(part['sequence']) is not int or part['sequence'] != i
                or not _integer(part['slide_index'], 0, deck.page_count - 1)
                or type(part['start_ms']) is not int or part['start_ms'] != end
                or not _integer(part['end_ms'], end + 1, min(duration, end + MAX_SEGMENT_MS))):
            raise ValidationError('Segments must be a contiguous, ordered, bounded prefix.')
        visit = next(e for e in reversed(events) if e['at_ms'] <= part['start_ms'])
        if (visit['slide_index'] != part['slide_index'] or
                any(part['start_ms'] < e['at_ms'] < part['end_ms'] for e in events)):
            raise ValidationError('A segment crosses a slide transition or names another slide.')
        end = part['end_ms']
    # Every completed visit must be sealed, including if the file is still offline.
    if end < events[-1]['at_ms'] or (data['stopped'] and (duration == 0 or end != duration)):
        raise ValidationError('The manifest omits audio before a transition or Stop.')
    return {'duration_ms': duration, 'slide_events': deepcopy(events), 'segments': deepcopy(segments), 'stopped': data['stopped']}


def _publish(kind, pk):
    from ..tasks import transcribe_capture_segment, assess_capture_part
    task = transcribe_capture_segment if kind == 'segment' else assess_capture_part
    try:
        task.delay(pk)
    except Exception:
        logger.warning('Incremental queue publication deferred; durable work retained.')


def declare(attempt_id, data):
    if not isinstance(data, dict):
        raise ValidationError('Provide a capture manifest object.')
    try:
        deck = Deck.objects.get(pk=data.get('deck_id'))
        context_id = data.get('context_id')
        context = PresentationContext.objects.get(pk=context_id, deck=deck) if context_id else None
    except (Deck.DoesNotExist, PresentationContext.DoesNotExist, ModelValidationError, ValueError, TypeError) as exc:
        raise ValidationError('Upload the deck and synchronize its settings first.') from exc
    manifest = validate_manifest(data, deck)
    with transaction.atomic():
        # Lock the deck for first-creation races, then the attempt for every writer.
        Deck.objects.select_for_update().get(pk=deck.pk)
        attempt = Attempt.objects.select_for_update().filter(pk=attempt_id).first()
        if attempt is None:
            if not enabled():
                raise CaptureError('incremental_disabled', 'Incremental capture is unavailable. Use after-Stop recording.')
            attempt = Attempt.objects.create(id=attempt_id, deck=deck, audio='', duration_ms=0,
                                             audience=data.get('audience', ''), status='processing',
                                             processing_state='capturing', processing_revision=1)
            session = CaptureSession.objects.create(attempt=attempt, context=context, desired={
                '_context': {k: getattr(context, k) for k in ('audience', 'required_duration_seconds', 'revision')} if context else None})
        else:
            session = CaptureSession.objects.select_for_update().filter(pk=attempt_id).first()
            if (session is None or attempt.deck_id != deck.pk or session.context_id != getattr(context, 'pk', None)
                    or attempt.audience != data.get('audience', '')):
                raise CaptureError('capture_conflict', 'This recording ID belongs to another capture.')
        previous = session.manifest
        if previous:
            # Both delayed and duplicate snapshots are harmless. Conflicting histories are not.
            for field in ('segments', 'slide_events'):
                a, b = previous[field], manifest[field]
                if a[:min(len(a), len(b))] != b[:min(len(a), len(b))]:
                    raise CaptureError('manifest_conflict', 'Earlier capture history cannot be replaced.')
            older = (manifest['duration_ms'] < previous['duration_ms'] or
                     len(manifest['segments']) < len(previous['segments']) or
                     len(manifest['slide_events']) < len(previous['slide_events']))
            if older:
                return session
            if session.stopped and manifest != previous:
                raise CaptureError('capture_stopped', 'A finalized recording cannot gain more audio.')
            if manifest == previous:
                return session
        session.manifest, session.stopped = manifest, manifest['stopped']
        session.revision += 1
        session.save(update_fields=['manifest', 'stopped', 'revision', 'updated_at'])
        attempt.duration_ms = manifest['duration_ms']
        attempt.slide_events = [e for e in manifest['slide_events'] if e['at_ms'] < manifest['duration_ms']]
        attempt.processing_state = 'awaiting_segments' if session.stopped else 'capturing'
        attempt.save(update_fields=['duration_ms', 'slide_events', 'processing_state'])
        for part in manifest['segments']:
            CaptureSegment.objects.get_or_create(capture=session, sequence=part['sequence'], defaults={k: v for k, v in part.items() if k != 'sequence'})
    refresh(attempt_id)
    return CaptureSession.objects.get(pk=attempt_id)


def _wav(upload, duration_ms, limit):
    data = read_upload(upload, limit)
    try:
        with wave.open(BytesIO(data), 'rb') as wav:
            if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getcomptype()) != (1, 2, 16000, 'NONE'):
                raise ValueError()
            frames = wav.getnframes()
            raw = wav.readframes(frames)
            if len(raw) != frames * 2 or abs(frames / 16 - duration_ms) >= 1:
                raise ValueError()
    except (wave.Error, EOFError, ValueError):
        raise ValidationError('Expected a complete 16 kHz mono PCM WAV matching the capture clock.') from None
    return data, hashlib.sha256(data).hexdigest()


def upload_segment(attempt_id, sequence, upload):
    part = CaptureSegment.objects.filter(capture_id=attempt_id, sequence=sequence).first()
    if part is None:
        raise CaptureError('manifest_required', 'Declare this segment before uploading it.', 404)
    data, digest = _wav(upload, part.end_ms - part.start_ms, MAX_SEGMENT_MS * 32 + 44)
    files = []
    try:
        with transaction.atomic():
            Attempt.objects.select_for_update().get(pk=attempt_id)
            part = CaptureSegment.objects.select_for_update().get(pk=part.pk)
            if part.upload_hash:
                if part.upload_hash != digest:
                    raise CaptureError('segment_conflict', 'This segment already contains different audio.')
                return part
            save_media(part.audio, f'{attempt_id}-{sequence}.wav', data, files)
            part.upload_hash, part.status, part.queued_at = digest, 'queued', timezone.now()
            part.save(update_fields=['audio', 'upload_hash', 'status', 'queued_at'])
            transaction.on_commit(lambda: _publish('segment', part.pk))
        return part
    except Exception:
        existing = CaptureSegment.objects.filter(pk=part.pk).first()
        cleanup_media(files, {existing.audio.name} if existing else set())
        raise


def upload_audio(attempt_id, upload):
    session = CaptureSession.objects.get(pk=attempt_id)
    if not session.stopped:
        raise CaptureError('capture_active', 'The full playback audio is uploaded after Stop.')
    data, digest = _wav(upload, session.manifest['duration_ms'], MAX_AUDIO_BYTES)
    files = []
    try:
        with transaction.atomic():
            attempt = Attempt.objects.select_for_update().get(pk=attempt_id)
            session = CaptureSession.objects.select_for_update().get(pk=attempt_id)
            if session.audio_hash and (attempt.error or {}).get('code') != 'audio_mismatch':
                if session.audio_hash != digest:
                    raise CaptureError('audio_conflict', 'The full recording already contains different audio.')
                return session
            save_media(attempt.audio, f'{attempt_id}.wav', data, files)
            attempt.upload_hash = digest
            attempt.save(update_fields=['audio', 'upload_hash'])
            session.audio_hash = digest
            session.save(update_fields=['audio_hash', 'updated_at'])
        refresh(attempt_id)
        return CaptureSession.objects.get(pk=attempt_id)
    except Exception:
        existing = Attempt.objects.filter(pk=attempt_id).first()
        cleanup_media(files, {existing.audio.name} if existing else set())
        raise


def retry_segment(attempt_id, sequence, acknowledged=False):
    with transaction.atomic():
        part = CaptureSegment.objects.select_for_update().get(capture_id=attempt_id, sequence=sequence)
        if part.status not in ('failed', 'uncertain'):
            return part
        if (part.status == 'uncertain' or (part.error or {}).get('code') in ('invalid_response', 'invalid_timing')) and not acknowledged:
            raise CaptureError('confirmation_required', 'Retrying requires another Scribe call, which may be charged. Confirm before retrying.')
        if part.retry_at and part.retry_at > timezone.now():
            raise CaptureError('retry_not_available', 'Wait until the provider retry time.')
        part.status, part.error, part.claim_token = 'queued', None, None
        part.queued_at = timezone.now()
        part.save(update_fields=['status', 'error', 'claim_token', 'queued_at'])
        transaction.on_commit(lambda: _publish('segment', part.pk))
    return part


def _part_write(pk, token, **values):
    if CaptureSegment.objects.filter(pk=pk, claim_token=token, status='transcribing').update(**values) != 1:
        raise CaptureError('stale_claim', 'The segment worker claim expired.')


def transcribe_segment(pk):
    token = uuid.uuid4()
    if not CaptureSegment.objects.filter(pk=pk, status='queued').update(status='transcribing', claim_token=token, claimed_at=timezone.now()):
        return
    part = CaptureSegment.objects.select_related('capture__attempt__deck').get(pk=pk)
    try:
        received = next((r for r in reversed(part.receipts) if r.get('outcome') == 'received'), None)
        if received:
            normalized = transcription._normalize(received['raw'])
        elif not has_speech(part.audio.path):
            normalized = {'text': '', 'words': []}
        else:
            # shortcut: no boundary overlap; add it only if phone tests show meaningful speech loss.
            with transcription.prepare_request(part.audio.path) as prepared:
                receipt = {'token': str(token), 'submitted_at': timezone.now().isoformat(), 'outcome': 'submitted', 'options': prepared.options}
                part.receipts = [*part.receipts, receipt]
                _part_write(pk, token, receipts=part.receipts)
                raw = transcription.request_raw(prepared)
                receipt.update(outcome='received', raw=raw)
                _part_write(pk, token, receipts=part.receipts)
            normalized = transcription._normalize(raw)
        duration = part.end_ms - part.start_ms
        previous = -1
        for word in normalized['words']:
            if not 0 <= word['start_ms'] <= word['end_ms'] <= duration or word['start_ms'] >= duration or word['start_ms'] < previous:
                raise transcription.TranscriptionError('invalid_timing', 'Segment timestamps do not fit its audio. The receipt is retained.')
            previous = word['start_ms']
        _part_write(pk, token, transcript={'text': normalized['text'], 'words': normalized['words']}, status='completed', error=None)
    except Exception as error:
        safe = error if isinstance(error, transcription.TranscriptionError) else transcription.TranscriptionError('processing_failed', 'Segment processing stopped. Audio and any receipt are retained.')
        part.refresh_from_db()
        submitted = bool(part.receipts and part.receipts[-1].get('outcome') == 'submitted')
        rejected = safe.code in transcription.CERTAIN_REJECTIONS and not safe.uncertain
        uncertain = safe.uncertain or submitted and not rejected
        if submitted:
            part.receipts[-1]['outcome'] = 'uncertain' if uncertain else 'rejected'
        elif safe.code in ('invalid_response', 'invalid_timing') and part.receipts:
            # A permanently invalid receipt is evidence, not a reusable transcript.
            part.receipts[-1]['outcome'] = 'invalid'
        CaptureSegment.objects.filter(pk=pk, claim_token=token, status='transcribing').update(
            status='uncertain' if uncertain else 'failed', error={'code': safe.code, 'message': str(safe)},
            retry_at=safe.retry_at, receipts=part.receipts)
    refresh(part.capture_id)


def _assembled(parts):
    words, texts = [], []
    for part in parts:
        if part.status != 'completed':
            continue
        texts.append(part.transcript['text'])
        words.extend({**w, 'start_ms': w['start_ms'] + part.start_ms, 'end_ms': w['end_ms'] + part.start_ms}
                     for w in part.transcript['words'])
    return {'text': ' '.join(t for t in texts if t).strip(), 'words': words}


def _inputs(session, parts, config):
    attempt = copy(session.attempt)
    attempt.status = 'completed'
    attempt.transcript = _assembled(parts)
    attempt.duration_ms = max(1, session.manifest['duration_ms'])
    attempt.slide_events = [e for e in session.manifest['slide_events'] if e['at_ms'] < attempt.duration_ms]
    context = copy(session.context)
    for key, value in (session.desired.get('_context') or {}).items():
        setattr(context, key, value)
    inputs = pipeline.load_inputs(attempt, context, config.model)
    return attempt, inputs


def _slide_payload(inputs, index):
    # A later slide's language or duration must not invalidate an earlier slide.
    payload = pipeline.slide_payload(inputs, index)
    own = inputs.speech.slides[index]
    language = speech.detect_language(own.text)
    payload['presentation']['language'] = language
    payload['measurements'] = measurements.slide_measurements(own, language, payload['measurements']['target_seconds'])
    return payload



def _matching_audio(attempt, parts):
    """Playback bytes must be the same continuous samples submitted to Scribe."""
    with wave.open(attempt.audio.path, 'rb') as full:
        for part in parts:
            with wave.open(part.audio.path, 'rb') as segment:
                remaining = segment.getnframes()
                while remaining:
                    count = min(remaining, 16000)
                    if segment.readframes(count) != full.readframes(count):
                        return False
                    remaining -= count
        return full.readframes(1) == b''

def refresh(attempt_id, retry=False, update_inputs=False):
    """Reconcile durable transcripts and queue only new ready assessment inputs."""
    with transaction.atomic():
        attempt = Attempt.objects.select_for_update(of=('self',)).select_related('deck').get(pk=attempt_id)
        session = CaptureSession.objects.select_for_update(of=('self',)).select_related('context').get(pk=attempt_id)
        session.attempt = attempt
        if update_inputs and session.finalized:
            session.desired['_context'] = {k: getattr(session.context, k) for k in ('audience', 'required_duration_seconds', 'revision')} if session.context else None
        parts = list(session.segments.order_by('sequence'))
        complete = session.stopped and bool(session.audio_hash) and bool(parts) and all(p.status == 'completed' for p in parts)
        if complete and not session.finalized and not _matching_audio(attempt, parts):
            attempt.error = {'code': 'audio_mismatch', 'message': 'The playback file does not match the uploaded segments. Upload the original full audio again.'}
            attempt.save(update_fields=['error'])
            session.save(update_fields=['updated_at'])
            return
        if complete and not session.finalized:
            attempt.error = None
            normalized = _assembled(parts)
            events = [e for e in session.manifest['slide_events'] if e['at_ms'] < attempt.duration_ms]
            visits = align_words(normalized['words'], events, attempt.duration_ms)
            attempt.transcript, attempt.slide_events, attempt.visits = normalized, events, visits
            attempt.metrics = timing_metrics(visits, attempt.duration_ms, normalized['text'], speech.detect_language(normalized['text']))
            attempt.status, attempt.processing_state = 'completed', 'completed'
            attempt.analysis_outcome = 'speech' if normalized['words'] else 'no_speech'
            attempt.save(update_fields=['transcript', 'slide_events', 'visits', 'metrics', 'status', 'processing_state', 'analysis_outcome', 'error'])
            session.finalized = True
        try:
            config = llm.Config.from_env()
        except (llm.LLMError, ValueError, TypeError):
            session.save(update_fields=['finalized', 'updated_at'])
            return
        transient, inputs = _inputs(session, parts, config)
        current = session.manifest['slide_events'][-1]['slide_index'] if not session.stopped else None
        desired = {'_context': session.desired.get('_context')}
        for index in range(attempt.deck.page_count):
            own = [p for p in parts if p.slide_index == index]
            if index == current or any(p.status != 'completed' for p in own):
                desired[str(index)] = {'status': 'pending', 'reason': 'recording' if index == current else 'awaiting_segments'}
                continue
            status, reason = pipeline.plan_slide_reason(inputs, index)
            if status:
                desired[str(index)] = {'status': status, 'reason': reason, 'measurements': inputs.measurements['slides'][index]}
                continue
            payload = _slide_payload(inputs, index)
            desired[str(index)] = _assessment(session, index, payload, inputs, config, retry)
        if not complete:
            desired['whole'] = {'status': 'pending', 'reason': 'awaiting_stop' if not session.stopped else 'awaiting_segments'}
        elif not pipeline.presentation_complete(inputs):
            desired['whole'] = {'status': 'not_recorded', 'reason': 'presentation_incomplete'}
        else:
            desired['whole'] = _assessment(session, -1, pipeline.whole_payload(inputs), inputs, config, retry)
        desired['_fingerprint'] = inputs.fingerprint
        desired['_measurements'] = inputs.measurements['whole']
        session.desired = desired
        session.save(update_fields=['desired', 'finalized', 'updated_at'])


def _assessment(session, index, payload, inputs, config, retry):
    kind = 'whole' if index == -1 else 'slide'
    digest = pipeline.part_hash(kind, payload, config)
    sentences = inputs.speech.sentences if index == -1 else inputs.speech.slides[index].sentences
    evidence = {'sentences': {s.id: asdict(s) for s in sentences},
                'measurements': {m['id']: m['what'] for m in pipeline.measurement_items(inputs)
                                 if m['value'] is not None} if index == -1 else {}}
    job, created = CaptureAssessment.objects.get_or_create(capture=session, slide_index=index, input_hash=digest,
        defaults={'payload': payload, 'evidence': evidence, 'queued_at': timezone.now()})
    if job.status == 'superseded' or retry and job.status == 'failed':
        job.status, job.error, job.claim_token, job.queued_at = 'queued', None, None, timezone.now()
        job.save(update_fields=['status', 'error', 'claim_token', 'queued_at'])
        created = True
    if created:
        transaction.on_commit(lambda: _publish('assessment', job.pk))
    return {'assessment': job.pk, 'input_hash': digest}


def assess_part(pk):
    token = uuid.uuid4()
    if not CaptureAssessment.objects.filter(pk=pk, status='queued').update(status='running', claim_token=token, claimed_at=timezone.now()):
        return
    job = CaptureAssessment.objects.select_related('capture__attempt__deck').get(pk=pk)
    key = 'whole' if job.slide_index == -1 else str(job.slide_index)
    if job.capture.desired.get(key, {}).get('assessment') != pk:
        CaptureAssessment.objects.filter(pk=pk, claim_token=token).update(status='superseded')
        return  # Revisit/input change arrived before this job's first model call.
    try:
        config = llm.Config.from_env()
        kind = 'whole' if job.slide_index == -1 else 'slide'
        if pipeline.part_hash(kind, job.payload, config) != job.input_hash:
            CaptureAssessment.objects.filter(pk=pk, claim_token=token).update(status='superseded')
            refresh(job.capture_id)
            return
        with httpx.Client() as http:
            result = pipeline.call_llm(http, config, kind, job.payload, deadline=time.monotonic() + pipeline.RUN_BUDGET_SECONDS)
        sentences = {k: speech.Sentence(**v) for k, v in job.evidence['sentences'].items()}
        language = (job.payload.get('presentation') or {}).get('language', 'en')
        part = (pipeline.normalize_whole(result.data, sentences, job.capture.attempt.deck.page_count, job.evidence['measurements'], language)
                if job.slide_index == -1 else pipeline.normalize_slide(
                    result.data, sentences, language, supplied_points=job.payload['slide']['must_cover']))
        if job.slide_index != -1:
            part['measurements'] = job.payload['measurements']
        saved = CaptureAssessment.objects.filter(pk=pk, claim_token=token, status='running').update(
            status='completed', result=part, usage={'calls': result.tries, 'input_tokens': result.input_tokens, 'output_tokens': result.output_tokens})
        if saved:
            from .prepared_display import changed
            changed('feedback', job.capture_id)
    except Exception as error:
        code = error.code if isinstance(error, llm.LLMError) else 'processing_failed'
        message = PUBLIC_BUDGET_MESSAGES.get(code, 'Slide feedback stopped. Retry retains the transcript.')
        CaptureAssessment.objects.filter(pk=pk, claim_token=token, status='running').update(status='failed', error={'code': code, 'message': message})
    CaptureSession.objects.filter(pk=job.capture_id).update(updated_at=timezone.now())


def feedback(session):
    jobs = {p.pk: p for p in session.assessments.order_by('pk')}

    def displayed(job):
        result = deepcopy(job.result)
        language = (job.payload.get('presentation') or {}).get('language')
        if language in ('en', 'ko', 'und'):
            result['language'] = language
        return result

    def part(key):
        spec = session.desired.get(key, {'status': 'pending'})
        job = jobs.get(spec.get('assessment'))
        if job and job.result:
            return displayed(job)
        status = ('failed' if job.status in ('failed', 'uncertain') else 'pending') if job else spec.get('status', 'pending')
        body = {'status': status, 'error': job.error['code'] if job.error else None} if job else deepcopy(spec)
        if status in ('pending', 'failed'):
            previous = next((p for p in reversed(list(jobs.values())) if p.slide_index == (int(key) if key != 'whole' else -1) and p.result), None)
            return {**(displayed(previous) if previous else {}), **body, 'score': None, 'level': None, 'provisional': True}
        return body
    slides = {str(i): part(str(i)) for i in range(session.attempt.deck.page_count)}
    whole = part('whole')
    result = {'slides': slides, 'whole': whole}
    scores = pipeline.score(result)
    pending = any(p['status'] == 'pending' for p in [*slides.values(), whole])
    outdated = False
    if session.finalized and pipeline.enabled():
        try:
            inputs = pipeline.load_inputs(session.attempt, session.context, llm.Config.from_env().model)
            outdated = inputs.fingerprint != session.desired.get('_fingerprint')
        except Exception:
            outdated = True
    return {'run_id': str(session.pk), 'attempt_id': str(session.pk), 'context_id': str(session.context_id) if session.context_id else None,
            'status': 'running' if pending or not session.finalized else 'completed', 'enabled': pipeline.enabled(), 'outdated': outdated,
            'pipeline_version': 'feedback-v3-incremental-1', 'rubric_version': pipeline.RUBRIC.version,
            'scores': scores, 'slides': [{'slide_index': int(i), **p} for i, p in slides.items()], 'whole': whole,
            'progress': {'slides_total': len(slides), 'slides_done': sum(p['status'] not in ('pending',) for p in slides.values()),
                         'whole_done': whole['status'] != 'pending'},
            'created_at': session.created_at.isoformat(), 'updated_at': session.updated_at.isoformat(),
            'measurements': session.desired.get('_measurements'), 'error': session.attempt.error, 'timings': {}}


def public(session):
    parts = list(session.segments.order_by('sequence'))
    return {'attempt_id': str(session.pk), 'revision': session.revision, 'stopped': session.stopped,
            'finalized': session.finalized, 'audio_uploaded': bool(session.audio_hash) and (session.attempt.error or {}).get('code') != 'audio_mismatch',
            'error': session.attempt.error,
            'segments': [{'sequence': p.sequence, 'slide_index': p.slide_index, 'start_ms': p.start_ms, 'end_ms': p.end_ms,
                          'status': p.status, 'error': p.error,
                          'retry_available': p.status in ('failed', 'uncertain') and (not p.retry_at or p.retry_at <= timezone.now()),
                          'requires_confirmation': p.status == 'uncertain' or (p.error or {}).get('code') in ('invalid_response', 'invalid_timing'),
                          'retry_at': p.retry_at} for p in parts],
            'feedback': feedback(session)}


def recover():
    cutoff = timezone.now() - timedelta(seconds=STALE_SECONDS)
    for part in CaptureSegment.objects.filter(status='transcribing', claimed_at__lt=cutoff):
        received = any(r.get('outcome') == 'received' for r in part.receipts)
        submitted = any(r.get('outcome') == 'submitted' for r in part.receipts)
        status = 'queued' if received or not submitted else 'uncertain'
        if CaptureSegment.objects.filter(pk=part.pk, status='transcribing', claim_token=part.claim_token).update(
                status=status, claim_token=None, queued_at=timezone.now(),
                error=None if status == 'queued' else {'code': 'worker_lost', 'message': 'Scribe outcome is unknown. Confirm before retrying.'}):
            if status == 'queued':
                _publish('segment', part.pk)
    for kind, model in [('segment', CaptureSegment), ('assessment', CaptureAssessment)]:
        for pk in model.objects.filter(status='queued', queued_at__lt=timezone.now() - timedelta(seconds=120)).values_list('pk', flat=True):
            model.objects.filter(pk=pk, status='queued').update(queued_at=timezone.now())
            _publish(kind, pk)
    lost = CaptureAssessment.objects.filter(status='running', claimed_at__lt=cutoff)
    captures = list(lost.values_list('capture_id', flat=True))
    lost.update(
        status='failed', error={'code': 'worker_lost', 'message': 'Feedback worker stopped. Retry may repeat this model call.'})
    CaptureSession.objects.filter(pk__in=captures).update(updated_at=timezone.now())
    # Reconcile a worker stopped after saving a transcript but before admission.
    for pk in CaptureSession.objects.filter(finalized=False).values_list('pk', flat=True):
        refresh(pk)
