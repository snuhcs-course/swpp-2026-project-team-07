"""Start, run, recover and present v3 feedback runs.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.

Flow: transcript ready -> start() creates or reuses a run -> worker run():
inputs and measurements in code -> one LLM call per gradable slide plus one
whole-presentation call, in parallel -> each part is saved as it finishes ->
scores are calculated in code. A failed part never discards the others.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import timedelta
import hashlib
import json
import logging
import os
import time

import httpx
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from ..models import Attempt, DescriptionSet, FeedbackRun, PresentationContext, Slide
from . import llm, measurements, prompts, rubric, transcript

logger = logging.getLogger(__name__)
PIPELINE_VERSION = 'feedback-v3.0'
RUBRIC = rubric.CURRENT
MIN_WORDS = 5
SLIDE_OUTPUT_TOKENS = 4000
WHOLE_OUTPUT_TOKENS = 6000
REPUBLISH_SECONDS = 120
STALE_SECONDS = 330            # Longer than the 300-second task time limit.
MAX_WORKER_ATTEMPTS = 3
TEXT_LIMIT = 600
FINISHED_PARTS = {'scored', 'insufficient_evidence', 'not_applicable', 'not_recorded', 'insufficient_speech'}
MESSAGES = {
    'feedback_disabled': 'AI feedback is turned off on this server.',
    'missing_api_key': 'AI feedback is not configured on this server.',
    'transcript_not_ready': 'The recording has not finished transcribing yet.',
    'invalid_context': 'This presentation setting does not belong to the recording.',
    'invalid_request': 'The request could not be read.',
    'not_found': 'Recording not found.',
    'worker_lost': 'Feedback stopped before finishing. Tap Retry.',
    'all_parts_failed': 'The AI service did not respond. Tap Retry.',
}


class RunError(Exception):
    def __init__(self, code: str, status: int = 409):
        super().__init__(code)
        self.code, self.status = code, status


@dataclass
class Inputs:
    context: PresentationContext | None
    audience: str
    required_seconds: int | None
    slides: list[dict]
    speech: transcript.Speech
    measurements: dict
    fingerprint: str


# ---------------------------------------------------------------- inputs

def _profile_slides(deck) -> tuple[dict, list]:
    """Latest generated slide profile for the deck, if any; never waits for one."""
    profile = (DescriptionSet.objects.filter(deck=deck, descriptions__isnull=False)
               .order_by('-updated_at').first())
    if not profile or not isinstance(profile.descriptions, dict):
        return {}, [None]
    slides = {}
    for item in profile.descriptions.get('slides', []):
        def facts(key):
            return [f['text'] for f in item.get(key, []) if isinstance(f, dict) and not f.get('uncertain')]
        slides[item.get('slide_index')] = {
            'kind': item.get('slide_kind', 'unknown'),
            'summary': (item.get('summary') or {}).get('text', ''),
            'key_ideas': facts('key_ideas'),
            'visual_facts': facts('visual_facts'),
            'must_cover': [c['text'] for c in item.get('must_cover', []) if isinstance(c, dict)],
        }
    return slides, [str(profile.pk), profile.processing_revision, profile.description_revision]


def _accepted_edits(attempt) -> tuple[list, int]:
    from ..services import corrections
    try:
        snapshot = corrections.snapshot(attempt)
    except Exception:
        return [], 0
    return snapshot['edits'], snapshot['revision']


def _digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def resolve_context(attempt, context_id) -> PresentationContext | None:
    """Explicit context, else the deck's only context, else none."""
    if context_id is not None:
        try:
            return PresentationContext.objects.get(pk=context_id, deck_id=attempt.deck_id)
        except (PresentationContext.DoesNotExist, ValidationError, ValueError, TypeError):
            raise RunError('invalid_context', 400) from None
    contexts = list(PresentationContext.objects.filter(deck_id=attempt.deck_id)[:2])
    return contexts[0] if len(contexts) == 1 else None


def load_inputs(attempt, context, model: str) -> Inputs:
    if attempt.status != 'completed' or not isinstance(attempt.transcript, dict):
        raise RunError('transcript_not_ready')
    words = attempt.transcript.get('words') or []
    edits, correction_revision = _accepted_edits(attempt)
    texts = dict(Slide.objects.filter(deck_id=attempt.deck_id).values_list('slide_index', 'extracted_text'))
    profiles, profile_identity = _profile_slides(attempt.deck)
    slides = []
    for index in range(attempt.deck.page_count):
        profile = profiles.get(index) or {}
        slides.append({'index': index, 'text': (texts.get(index) or '').strip(), **{
            'kind': profile.get('kind', 'unknown'), 'summary': profile.get('summary', ''),
            'key_ideas': profile.get('key_ideas', []), 'visual_facts': profile.get('visual_facts', []),
            'must_cover': profile.get('must_cover', [])}})
    audience = (context.audience if context else '').strip()
    required = context.required_duration_seconds if context else None
    speech = transcript.build(words, attempt.slide_events, attempt.duration_ms, edits)
    measured = measurements.measure(speech, [s['text'] for s in slides], attempt.duration_ms, required)
    fingerprint = _digest({
        'attempt': str(attempt.pk), 'words': _digest(words), 'events': attempt.slide_events,
        'duration_ms': attempt.duration_ms, 'corrections': [correction_revision, edits],
        'context': [str(context.pk), context.revision, audience, required] if context else None,
        'profile': profile_identity, 'model': model, 'pipeline': PIPELINE_VERSION,
        'prompt': prompts.PROMPT_VERSION, 'rubric': RUBRIC.version,
    })
    return Inputs(context, audience, required, slides, speech, measured, fingerprint)


# ---------------------------------------------------------------- planning and payloads

def plan_slide(inputs: Inputs, index: int) -> str | None:
    """Status decided in code, or None when the slide needs an LLM call."""
    slide, last = inputs.slides[index], len(inputs.slides) - 1
    title_like = slide['kind'] in ('title', 'closing') or (
        slide['kind'] == 'unknown' and len(slide['text'].split()) <= 8)
    if index in (0, last) and last > 0 and title_like:
        return 'not_applicable'
    spoken = inputs.speech.slides.get(index)
    if not spoken or not spoken.visit_ms:
        return 'not_recorded'
    if sum(1 for w in spoken.words if w.text) < MIN_WORDS:
        return 'insufficient_speech'
    return None


def _presentation(inputs: Inputs) -> dict:
    return {'language': inputs.speech.language,
            'audience': inputs.audience or 'General audience (not specified by the speaker)',
            'target_minutes': round(inputs.required_seconds / 60, 1) if inputs.required_seconds else None,
            'slide_count': len(inputs.slides)}


def _slide_brief(slide: dict) -> str:
    return slide['summary'] or slide['text'][:300]


def slide_payload(inputs: Inputs, index: int) -> dict:
    slide = inputs.slides[index]
    neighbor = lambda i: _slide_brief(inputs.slides[i]) if 0 <= i < len(inputs.slides) else None
    return {
        'rubric': {'slide_criteria': rubric.describe(RUBRIC)['slide_criteria']},
        'presentation': _presentation(inputs),
        'slide': {'index': index, 'number': index + 1, 'kind': slide['kind'], 'slide_text': slide['text'][:4000],
                  'summary': slide['summary'], 'key_ideas': slide['key_ideas'],
                  'visual_facts': slide['visual_facts'], 'must_cover': slide['must_cover']},
        'neighbors': {'previous_slide': neighbor(index - 1), 'next_slide': neighbor(index + 1)},
        'speech': {'sentences': [{'id': s.id, 'text': s.text} for s in inputs.speech.slides[index].sentences]},
        'measurements': inputs.measurements['slides'][index],
    }


def measurement_items(inputs: Inputs) -> list[dict]:
    whole = inputs.measurements['whole']
    timing = [{'slide': i + 1, 'seconds': m['seconds'], 'target_seconds': m['target_seconds']}
              for i, m in inputs.measurements['slides'].items()]
    return [
        {'id': 'm:time', 'what': 'Total time vs required time (seconds)',
         'value': {'actual': whole['total_seconds'], 'required': whole['target_seconds']}},
        {'id': 'm:pace', 'what': 'Speaking rate over speaking time', 'value': whole['rate']},
        {'id': 'm:pauses', 'what': 'Silences of 2 s or more inside a slide',
         'value': {'count': whole['long_pauses'], 'longest_seconds': whole['longest_pause_seconds']}},
        {'id': 'm:fillers', 'what': 'Filler words such as um/uh/음/어',
         'value': {'count': whole['filler_count'], 'per_minute': whole['fillers_per_minute']}},
        {'id': 'm:repetition', 'what': 'Immediately repeated words', 'value': whole['repeated_words']},
        {'id': 'm:slide_timing', 'what': 'Seconds spent per slide vs suggested allocation', 'value': timing},
    ]


def whole_payload(inputs: Inputs) -> dict:
    return {
        'rubric': {'whole_criteria': rubric.describe(RUBRIC)['whole_criteria']},
        'presentation': _presentation(inputs),
        'outline': [{'index': s['index'], 'number': s['index'] + 1, 'kind': s['kind'], 'about': _slide_brief(s)}
                    for s in inputs.slides],
        'speech': [{'id': s.id, 'slide_number': s.slide_index + 1, 'text': s.text} for s in inputs.speech.sentences],
        'measurements': measurement_items(inputs),
    }


def call_llm(http, config, kind: str, payload: dict) -> llm.Result:
    if kind == 'slide':
        return llm.complete_json(http, config, name='slide_feedback', system=prompts.SLIDE_SYSTEM, user=payload,
                                 schema=prompts.slide_schema(RUBRIC), max_output_tokens=SLIDE_OUTPUT_TOKENS)
    return llm.complete_json(http, config, name='presentation_feedback', system=prompts.WHOLE_SYSTEM, user=payload,
                             schema=prompts.whole_schema(RUBRIC), max_output_tokens=WHOLE_OUTPUT_TOKENS)


# ---------------------------------------------------------------- normalization (lenient)

def _text(value) -> str:
    return value.strip()[:TEXT_LIMIT] if isinstance(value, str) else ''


def _evidence(ids, sentences: dict) -> list[dict]:
    seen, found = set(), []
    for sentence_id in ids if isinstance(ids, list) else []:
        sentence = sentences.get(sentence_id) if isinstance(sentence_id, str) else None
        if sentence and sentence_id not in seen:
            seen.add(sentence_id)
            found.append({'id': sentence.id, 'slide_index': sentence.slide_index,
                          'start_ms': sentence.start_ms, 'end_ms': sentence.end_ms, 'text': sentence.text})
    return found[:6]


def _criteria(raw: dict, criteria, sentences: dict) -> list[dict]:
    rows = []
    for criterion in criteria:
        item = raw.get(criterion.id) if isinstance(raw, dict) else None
        item = item if isinstance(item, dict) else {}
        level = item.get('level') if item.get('level') in rubric.LEVELS else None
        rows.append({'id': criterion.id, 'label': criterion.label, 'maximum_points': criterion.maximum,
                     'level': level, 'anchor': criterion.anchors[rubric.LEVELS.index(level)] if level else None,
                     'points': round(float(rubric.criterion_points(criterion, level)), 2) if level else None,
                     'reason': _text(item.get('reason')),
                     'next_level': '' if level == 'advanced' else _text(item.get('next_level')),
                     'evidence': _evidence(item.get('evidence'), sentences)})
    return rows


def normalize_slide(raw: dict, sentences: dict) -> dict:
    criteria = _criteria(raw.get('criteria'), RUBRIC.slide, sentences)
    ids = {c.id for c in RUBRIC.slide}
    must_cover = [{'point': _text(m.get('point')), 'status': m['status'], 'evidence': _evidence(m.get('evidence'), sentences)}
                  for m in raw.get('must_cover') or [] if isinstance(m, dict) and m.get('status') in ('covered', 'partial', 'missing')]
    strength = raw.get('strength') if isinstance(raw.get('strength'), dict) else None
    improvements = []
    for item in raw.get('improvements') or []:
        if isinstance(item, dict) and item.get('criterion') in ids and _text(item.get('action')):
            improvements.append({'criterion': item['criterion'], 'problem': _text(item.get('problem')),
                                 'action': _text(item.get('action')), 'example': _text(item.get('example')),
                                 'evidence': _evidence(item.get('evidence'), sentences)})
    return {'status': 'scored' if all(c['level'] for c in criteria) else 'insufficient_evidence',
            'criteria': criteria, 'must_cover': must_cover[:5],
            'strength': {'text': _text(strength.get('text')), 'evidence': _evidence(strength.get('evidence'), sentences)}
            if strength and _text(strength.get('text')) else None,
            'improvements': improvements[:3]}


def normalize_whole(raw: dict, sentences: dict, slide_count: int) -> dict:
    criteria = _criteria(raw.get('criteria'), RUBRIC.whole, sentences)
    priorities = []
    for item in raw.get('top_priorities') or []:
        if isinstance(item, dict) and _text(item.get('action')):
            index = item.get('slide_index')
            priorities.append({'title': _text(item.get('title')), 'action': _text(item.get('action')),
                               'why': _text(item.get('why')),
                               'slide_index': index if type(index) is int and 0 <= index < slide_count else None})
    return {'status': 'scored' if all(c['level'] for c in criteria) else 'insufficient_evidence',
            'criteria': criteria, 'top_priorities': priorities[:3], 'summary': _text(raw.get('summary'))}


# ---------------------------------------------------------------- scoring (code only)

def score(result: dict) -> dict:
    """Rubric V2 arithmetic over stored levels; adds point gains to improvements."""
    slides = result.get('slides', {})
    applicable = {k: p for k, p in slides.items() if p.get('status') != 'not_applicable'}
    exact = {}
    for key, part in slides.items():
        if part.get('status') == 'scored':
            levels = {c['id']: c['level'] for c in part['criteria']}
            exact[key] = rubric.component_points(RUBRIC.slide, levels)
            part['score'] = rubric.round_half_up(exact[key])
    whole = result.get('whole') or {}
    whole_exact = None
    if whole.get('status') == 'scored':
        whole_exact = rubric.component_points(RUBRIC.whole, {c['id']: c['level'] for c in whole['criteria']})
        whole['score'] = rubric.round_half_up(whole_exact)
    missing = sorted(int(k) for k, p in applicable.items() if p.get('status') != 'scored')
    withheld = []
    if not applicable:
        withheld.append({'reason': 'no_applicable_slides'})
    if missing:
        withheld.append({'reason': 'slides_not_scored', 'slides': missing})
    if whole_exact is None:
        withheld.append({'reason': 'whole_not_scored'})
    count = max(1, len(applicable))
    criteria = {c.id: c for c in RUBRIC.slide}
    for key, part in slides.items():
        levels = {c['id']: c['level'] for c in part.get('criteria', [])}
        for item in part.get('improvements', []):
            level = levels.get(item['criterion'])
            gain = rubric.next_level_gain(criteria[item['criterion']], level) if level else None
            item['gain_slide_points'] = round(float(gain), 1) if gain is not None else None
            item['gain_overall_points'] = round(float(gain * RUBRIC.slide_weight / count), 1) if gain is not None else None
    summary = {'overall': None, 'overall_level': None, 'slide_average': None, 'whole': whole.get('score'),
               'withheld': withheld}
    if exact:
        summary['slide_average'] = round(float(sum(exact.values()) / len(exact)), 1)
    if not withheld:
        overall = rubric.overall_points(RUBRIC, [exact[k] for k in applicable], whole_exact)
        summary.update(overall=rubric.round_half_up(overall), overall_level=rubric.overall_level(overall))
    return summary


# ---------------------------------------------------------------- lifecycle

def publish(run_id) -> None:
    from ..tasks import run_feedback_v3
    try:
        run_feedback_v3.delay(str(run_id))
    except Exception:
        logger.warning('feedback_v3 publish unavailable; recovery will republish.')


def latest_run(attempt, context) -> FeedbackRun | None:
    return FeedbackRun.objects.filter(attempt=attempt, context=context).order_by('-created_at').first()


def _has_failed_parts(run: FeedbackRun) -> bool:
    parts = list((run.result or {}).get('slides', {}).values()) + [(run.result or {}).get('whole') or {}]
    return any(p.get('status') in ('failed', 'pending') for p in parts)


def start(attempt_id, *, context_id=None, retry=False) -> FeedbackRun:
    config = llm.Config.from_env()
    with transaction.atomic():
        attempt = Attempt.objects.select_for_update().select_related('deck').get(pk=attempt_id)
        context = resolve_context(attempt, context_id)
        inputs = load_inputs(attempt, context, config.model)
        run = latest_run(attempt, context)
        now = timezone.now()
        if run and run.fingerprint == inputs.fingerprint:
            busy = run.status in (FeedbackRun.Status.QUEUED, FeedbackRun.Status.RUNNING)
            done = run.status == FeedbackRun.Status.COMPLETED and not _has_failed_parts(run)
            if busy or done or not retry:
                return run
            run.status, run.error, run.queued_at = FeedbackRun.Status.QUEUED, None, now
            run.started_at = run.finished_at = None
            run.worker_attempts = 0
            run.save(update_fields=['status', 'error', 'queued_at', 'started_at', 'finished_at', 'worker_attempts'])
        else:
            run = FeedbackRun.objects.create(attempt=attempt, context=context, fingerprint=inputs.fingerprint,
                                             pipeline_version=PIPELINE_VERSION, rubric_version=RUBRIC.version,
                                             model=config.model, queued_at=now)
        transaction.on_commit(lambda run_id=run.pk: publish(run_id))
        return run


def auto_start(attempt_id) -> None:
    """Called after transcription completes; never raises into the caller."""
    if os.environ.get('FEEDBACK_V3_AUTO_START', 'false') != 'true':
        return
    try:
        start(attempt_id)
    except Exception as error:
        logger.warning('feedback_v3 auto-start skipped: %s', getattr(error, 'code', type(error).__name__))


def _save(run: FeedbackRun, **fields) -> None:
    fields['heartbeat_at'] = timezone.now()
    for key, value in fields.items():
        setattr(run, key, value)
    run.save(update_fields=list(fields))


def run(run_id) -> None:
    now = timezone.now()
    claimed = FeedbackRun.objects.filter(pk=run_id, status=FeedbackRun.Status.QUEUED).update(
        status=FeedbackRun.Status.RUNNING, started_at=now, heartbeat_at=now, worker_attempts=F('worker_attempts') + 1)
    if not claimed:
        return
    job = FeedbackRun.objects.select_related('attempt__deck', 'context').get(pk=run_id)
    began = time.monotonic()
    try:
        config = llm.Config.from_env()
        inputs = load_inputs(job.attempt, job.context, config.model)
    except (RunError, llm.LLMError) as error:
        _save(job, status=FeedbackRun.Status.FAILED, finished_at=timezone.now(),
              error={'code': error.code, 'message': MESSAGES.get(error.code, error.code)})
        return
    if inputs.fingerprint != job.fingerprint:
        _save(job, status=FeedbackRun.Status.STALE, finished_at=timezone.now())
        return

    result = dict(job.result or {})
    result['measurements'] = inputs.measurements['whole']
    result['language'] = inputs.speech.language
    slides = result.setdefault('slides', {})
    work = {}
    for index in range(len(inputs.slides)):
        key = str(index)
        if slides.get(key, {}).get('status') in FINISHED_PARTS:
            continue
        status = plan_slide(inputs, index)
        slides[key] = {'status': status or 'pending', 'measurements': inputs.measurements['slides'][index]}
        if not status:
            work[('slide', index)] = slide_payload(inputs, index)
    if (result.get('whole') or {}).get('status') not in FINISHED_PARTS:
        result['whole'] = {'status': 'pending'}
        work[('whole', None)] = whole_payload(inputs)
    timings, usage = dict(job.timings or {}), dict(job.usage or {'input_tokens': 0, 'output_tokens': 0, 'calls': 0})
    timings['prepare_seconds'] = round(time.monotonic() - began, 2)
    _save(job, result=result, timings=timings)

    sentences = inputs.speech.by_id()
    errors = []
    if work:
        with httpx.Client() as http, ThreadPoolExecutor(max_workers=min(config.max_parallel, len(work))) as pool:
            futures = {pool.submit(call_llm, http, config, kind, payload): (kind, index)
                       for (kind, index), payload in work.items()}
            for future in as_completed(futures):
                kind, index = futures[future]
                name = 'whole' if kind == 'whole' else f'slide_{index}'
                try:
                    answer = future.result()
                    part = (normalize_whole(answer.data, sentences, len(inputs.slides)) if kind == 'whole'
                            else normalize_slide(answer.data, sentences))
                    timings[name] = answer.seconds
                    usage['input_tokens'] += answer.input_tokens
                    usage['output_tokens'] += answer.output_tokens
                    usage['calls'] += answer.tries
                except llm.LLMError as error:
                    part, code = {'status': 'failed', 'error': error.code}, error.code
                    errors.append(code)
                except Exception:
                    logger.exception('feedback_v3 part failed: %s', name)
                    part = {'status': 'failed', 'error': 'processing_failed'}
                    errors.append('processing_failed')
                if kind == 'whole':
                    result['whole'] = part
                else:
                    slides[str(index)] = {**part, 'measurements': inputs.measurements['slides'][index]}
                result['scores'] = score(result)
                _save(job, result=result, timings=timings, usage=usage)

    result['scores'] = score(result)
    timings['total_seconds'] = round(time.monotonic() - began, 2)
    all_failed = bool(work) and len(errors) == len(work)
    _save(job, result=result, timings=timings, usage=usage, finished_at=timezone.now(),
          status=FeedbackRun.Status.FAILED if all_failed else FeedbackRun.Status.COMPLETED,
          error={'code': 'all_parts_failed', 'message': MESSAGES['all_parts_failed'], 'detail': errors[0]}
          if all_failed else None)


def recover() -> None:
    """Beat hook: republish lost queue messages and requeue dead workers."""
    now = timezone.now()
    for run_id in FeedbackRun.objects.filter(status=FeedbackRun.Status.QUEUED,
                                             queued_at__lt=now - timedelta(seconds=REPUBLISH_SECONDS)
                                             ).values_list('pk', flat=True):
        FeedbackRun.objects.filter(pk=run_id, status=FeedbackRun.Status.QUEUED).update(queued_at=now)
        publish(run_id)
    stale = FeedbackRun.objects.filter(status=FeedbackRun.Status.RUNNING,
                                       heartbeat_at__lt=now - timedelta(seconds=STALE_SECONDS))
    for job in stale:
        if job.worker_attempts >= MAX_WORKER_ATTEMPTS:
            FeedbackRun.objects.filter(pk=job.pk, status=FeedbackRun.Status.RUNNING).update(
                status=FeedbackRun.Status.FAILED, finished_at=now,
                error={'code': 'worker_lost', 'message': MESSAGES['worker_lost']})
        elif FeedbackRun.objects.filter(pk=job.pk, status=FeedbackRun.Status.RUNNING,
                                        heartbeat_at=job.heartbeat_at).update(
                status=FeedbackRun.Status.QUEUED, queued_at=now):
            publish(job.pk)


# ---------------------------------------------------------------- API projection

def public(job: FeedbackRun | None) -> dict:
    if job is None:
        return {'status': 'absent'}
    result = job.result or {}
    slides = [{'slide_index': int(k), **v} for k, v in sorted(result.get('slides', {}).items(), key=lambda kv: int(kv[0]))]
    graded = [s for s in slides if s['status'] not in ('not_applicable', 'not_recorded', 'insufficient_speech')]
    return {
        'run_id': str(job.pk), 'attempt_id': str(job.attempt_id),
        'context_id': str(job.context_id) if job.context_id else None,
        'status': job.status, 'pipeline_version': job.pipeline_version, 'rubric_version': job.rubric_version,
        'model': job.model,
        'progress': {'slides_total': len(graded),
                     'slides_done': sum(1 for s in graded if s['status'] not in ('pending',)),
                     'whole_done': (result.get('whole') or {}).get('status') not in (None, 'pending')},
        'scores': result.get('scores'), 'language': result.get('language'),
        'measurements': result.get('measurements'), 'slides': slides, 'whole': result.get('whole'),
        'error': job.error, 'timings': job.timings,
        'created_at': job.created_at.isoformat() if job.created_at else None,
        'finished_at': job.finished_at.isoformat() if job.finished_at else None,
    }
