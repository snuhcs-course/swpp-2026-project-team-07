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
from public_billing.budget import MESSAGES as BUDGET_MESSAGES

from ..models import Attempt, DescriptionSet, FeedbackRun, PresentationContext, QaAnswer, Slide
from . import limits, llm, measurements, prompts, rubric, transcript

logger = logging.getLogger(__name__)
PIPELINE_VERSION = 'feedback-v3.1'
RUBRIC = rubric.CURRENT
MIN_WORDS = 5
SLIDE_OUTPUT_TOKENS = 4000
WHOLE_OUTPUT_TOKENS = 6000
REPUBLISH_SECONDS = 120
STALE_SECONDS = 330            # Longer than the 300-second task time limit.
MAX_WORKER_ATTEMPTS = 3
TEXT_LIMIT = 600
CODE_DECIDED = {'not_applicable', 'not_recorded', 'insufficient_speech'}
# insufficient_evidence is final for these inputs: the model judged there was too
# little speech, so re-recording, not retrying, is the fix.
FINISHED_PARTS = {'scored', 'insufficient_evidence'} | CODE_DECIDED
RUN_BUDGET_SECONDS = 240      # Stop starting or retrying calls before the 300-second task limit.
MESSAGES = {
    **BUDGET_MESSAGES,
    'feedback_disabled': 'AI feedback is turned off on this server.',
    'missing_api_key': 'AI feedback is not configured on this server.',
    'transcript_not_ready': 'The recording has not finished transcribing yet.',
    'invalid_context': 'This presentation setting does not belong to the recording.',
    'invalid_request': 'The request could not be read.',
    'not_found': 'Recording not found.',
    'worker_lost': 'Feedback stopped before finishing. Tap Retry.',
    'all_parts_failed': 'The AI service did not respond. Tap Retry.',
    'processing_failed': 'Feedback stopped because of a server error. Tap Retry.',
    'run_deadline': 'Feedback took too long. Tap Retry to finish the remaining slides.',
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

def _profile_set(deck) -> DescriptionSet | None:
    """Generated slide-profile set: newest profile schema, then most recently updated.

    Coaching description sets share the table but are not profiles, so they are
    excluded; otherwise saving one would change the run fingerprint.
    """
    from ..services import slide_profile_schema as schema
    ranked = [*schema.PROFILE_SCHEMAS.values(), *schema.STRICT_PROFILE_SCHEMAS.values(),
              *schema.REFINED_PROFILE_SCHEMAS.values(), *schema.CATEGORY_PROFILE_SCHEMAS.values(),
              *schema.HISTORICAL_PROFILE_SCHEMAS.values()]
    rank = {version: position for position, version in reversed(list(enumerate(ranked)))}
    candidates = DescriptionSet.objects.filter(deck=deck, descriptions__isnull=False, schema_version__in=rank)
    return min(candidates, key=lambda s: (rank[s.schema_version], -s.updated_at.timestamp()), default=None)


def _profile_slides(deck) -> tuple[dict, list]:
    """Slide profile facts and Must Cover points, if generated; never waits for one."""
    profile = _profile_set(deck)
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
    return plan_slide_reason(inputs, index)[0]


def plan_slide_reason(inputs: Inputs, index: int) -> tuple[str | None, str | None]:
    """(status, reason) decided in code; (None, None) when the slide needs an LLM call."""
    slide, last = inputs.slides[index], len(inputs.slides) - 1
    if index in (0, last) and last > 0:
        if slide['kind'] in ('title', 'closing'):
            return 'not_applicable', f"{slide['kind']}_slide_profile"
        if slide['kind'] == 'unknown' and len(slide['text'].split()) <= 8:
            return 'not_applicable', 'short_slide_text'
    spoken = inputs.speech.slides.get(index)
    if not spoken or not spoken.visit_ms:
        return 'not_recorded', 'slide_not_visited'
    if sum(1 for w in spoken.words if w.text) < MIN_WORDS:
        return 'insufficient_speech', f'fewer_than_{MIN_WORDS}_words'
    return None, None


def presentation_complete(inputs: Inputs) -> bool:
    """The take reached every gradable slide (an unvisited title/closing slide does not count)."""
    return all(plan_slide_reason(inputs, i)[0] != 'not_recorded' for i in range(len(inputs.slides)))


def part_hash(kind: str, payload: dict, config: llm.Config) -> str:
    """Everything that shapes one part's result; equal hashes need no new model call."""
    return _digest({'kind': kind, 'payload': payload, 'model': config.model, 'effort': config.reasoning_effort,
                    'temperature': config.temperature, 'prompt': prompts.PROMPT_VERSION,
                    'rubric': RUBRIC.version, 'pipeline': PIPELINE_VERSION})


def _reusable_parts(job: FeedbackRun) -> dict:
    """Finished model-graded parts from this recording's earlier runs, by input hash."""
    found = {}
    for previous in FeedbackRun.objects.filter(attempt_id=job.attempt_id).exclude(pk=job.pk).order_by('created_at'):
        result = previous.result or {}
        for part in [*(result.get('slides') or {}).values(), result.get('whole') or {}]:
            if isinstance(part, dict) and part.get('input_hash') and part.get('status') in ('scored', 'insufficient_evidence'):
                found[part['input_hash']] = {k: v for k, v in part.items() if k not in ('measurements', 'reused')}
    return found


def outdated(attempt, context, job: FeedbackRun | None) -> bool:
    """True when the stored run no longer matches the current inputs (or is stale)."""
    if job is None or job.status in (FeedbackRun.Status.QUEUED, FeedbackRun.Status.RUNNING):
        return False  # Polls during a run skip the input rebuild.
    if job.status == FeedbackRun.Status.STALE:
        return True
    try:
        config = llm.Config.from_env()
        return load_inputs(attempt, context, config.model).fingerprint != job.fingerprint
    except (RunError, llm.LLMError):
        return False
    except Exception:
        # A read must never fail because of this check; the stored run is still shown.
        logger.exception('feedback_v3 outdated check failed')
        return False


def enabled() -> bool:
    """Feedback v3 can actually run: switched on and configured (key, numeric settings)."""
    try:
        llm.Config.from_env()
        return True
    except Exception:
        return False


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


def call_llm(http, config, kind: str, payload: dict, deadline: float | None = None) -> llm.Result:
    if kind == 'slide':
        return llm.complete_json(http, config, name='slide_feedback', system=prompts.SLIDE_SYSTEM, user=payload,
                                 schema=prompts.slide_schema(RUBRIC), max_output_tokens=SLIDE_OUTPUT_TOKENS,
                                 deadline=deadline)
    return llm.complete_json(http, config, name='presentation_feedback', system=prompts.WHOLE_SYSTEM, user=payload,
                             schema=prompts.whole_schema(RUBRIC), max_output_tokens=WHOLE_OUTPUT_TOKENS,
                             deadline=deadline)


# ---------------------------------------------------------------- normalization (lenient)

def _text(value) -> str:
    return value.strip()[:TEXT_LIMIT] if isinstance(value, str) else ''


def _list(value) -> list:
    return value if isinstance(value, list) else []


def _capped(coach: dict) -> dict:
    """Storage bound only (TEXT_LIMIT per string, six bullets); the display limits are in limits.py."""
    return {key: [v[:TEXT_LIMIT] for v in value[:6]] if isinstance(value, list) and key != 'over_limit'
            else value[:TEXT_LIMIT] if isinstance(value, str) else value for key, value in coach.items()}


def _evidence(ids, sentences: dict, measures: dict | None = None) -> list[dict]:
    """Known sentence ids (and measurement ids, for the whole call) only; others dropped."""
    seen, found = set(), []
    for item_id in _list(ids):
        if not isinstance(item_id, str) or item_id in seen:
            continue
        sentence, measure = sentences.get(item_id), (measures or {}).get(item_id)
        if sentence:
            found.append({'kind': 'speech', 'id': sentence.id, 'slide_index': sentence.slide_index,
                          'start_ms': sentence.start_ms, 'end_ms': sentence.end_ms, 'text': sentence.text})
        elif measure:
            found.append({'kind': 'measurement', 'id': item_id, 'text': measure})
        else:
            continue
        seen.add(item_id)
    return found[:6]


def _criteria(raw: dict, criteria, sentences: dict, measures: dict | None = None) -> list[dict]:
    rows = []
    for criterion in criteria:
        item = raw.get(criterion.id) if isinstance(raw, dict) else None
        item = item if isinstance(item, dict) else {}
        evidence = _evidence(item.get('evidence'), sentences, measures)
        kinds = {reference['kind'] for reference in evidence}
        supported = 'speech' in kinds and (criterion.id != 'delivery' or 'measurement' in kinds)
        level = item.get('level') if supported and item.get('level') in rubric.LEVELS else None
        rows.append({'id': criterion.id, 'label': criterion.label, 'maximum_points': criterion.maximum,
                     'level': level, 'anchor': criterion.anchors[rubric.LEVELS.index(level)] if level else None,
                     'points': round(float(rubric.criterion_points(criterion, level)), 2) if level else None,
                     'reason': _text(item.get('reason')) if level else '',
                     'next_level': _text(item.get('next_level')) if level and level != 'advanced' else '',
                     'evidence': evidence})
    return rows


# Supplied Claude patch, OpenAI Codex integration, Iteration 2 (2026-11-20): normalize bounded coaching fields.
def normalize_slide(raw: dict, sentences: dict, language: str = 'en', *, supplied_points=()) -> dict:
    criteria = _criteria(raw.get('criteria'), RUBRIC.slide, sentences)
    ids = {c.id for c in RUBRIC.slide}
    allowed = {point.strip() for point in supplied_points if isinstance(point, str) and point.strip()}
    must_cover = []
    for item in _list(raw.get('must_cover')):
        if not isinstance(item, dict) or not isinstance(item.get('point'), str):
            continue
        point, status = item['point'].strip(), item.get('status')
        if point not in allowed or status not in ('covered', 'partial', 'missing'):
            continue
        evidence = _evidence(item.get('evidence'), sentences)
        if status == 'missing' or evidence:
            must_cover.append({'point': _text(point), 'status': status, 'evidence': evidence})
            allowed.remove(point)
    strength = None
    if isinstance(raw.get('strength'), dict):
        candidate = raw['strength']
        evidence = _evidence(candidate.get('evidence'), sentences)
        if evidence and _text(candidate.get('text')):
            strength = {'text': _text(candidate['text']), 'evidence': evidence}
    improvements = []
    for item in _list(raw.get('improvements')):
        if not (isinstance(item, dict) and isinstance(item.get('criterion'), str) and item['criterion'] in ids):
            continue
        # Over-long text is kept and flagged (limits.coaching); the app truncates and opens the full text.
        coach = limits.coaching(item, language, explanation_items=limits.MAX_ITEMS['explanation'])
        evidence = _evidence(item.get('evidence'), sentences)
        if coach['steps'] and evidence:
            improvements.append({'criterion': item['criterion'], **_capped(coach),
                                 'evidence': evidence})
    return {'status': 'scored' if all(c['level'] for c in criteria) else 'insufficient_evidence',
            'criteria': criteria, 'must_cover': must_cover[:5],
            'strength': strength,
            'improvements': improvements[:3]}


def normalize_whole(raw: dict, sentences: dict, slide_count: int, measures: dict | None = None,
                    language: str = 'en') -> dict:
    criteria = _criteria(raw.get('criteria'), RUBRIC.whole, sentences, measures)
    priorities = []
    for item in _list(raw.get('top_priorities')):
        if not isinstance(item, dict):
            continue
        coach = limits.coaching(item, language, explanation_items=limits.MAX_ITEMS['priority_explanation'])
        if coach['steps']:
            index = item.get('slide_index')
            coach = _capped(coach)
            priorities.append({**coach, 'title': coach['headline'], 'why': coach['problem'],
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
            part['level'] = rubric.overall_level(exact[key])  # Band from exact points, not the rounded score.
    whole = result.get('whole') or {}
    whole_exact = None
    if whole.get('status') == 'scored':
        whole_exact = rubric.component_points(RUBRIC.whole, {c['id']: c['level'] for c in whole['criteria']})
        whole['score'] = rubric.round_half_up(whole_exact)
        whole['level'] = rubric.overall_level(whole_exact)
    missing = sorted(int(k) for k, p in applicable.items() if p.get('status') != 'scored')
    withheld = []
    if not applicable:
        withheld.append({'reason': 'no_applicable_slides'})
    if missing:
        withheld.append({'reason': 'slides_not_scored', 'slides': missing})
    if whole_exact is None:
        incomplete = whole.get('reason') == 'presentation_incomplete'
        withheld.append({'reason': 'presentation_incomplete' if incomplete else 'whole_not_scored'})
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
        if run and run.fingerprint == inputs.fingerprint and run.status != FeedbackRun.Status.STALE:
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
    if QaAnswer.objects.filter(attempt_id=attempt_id).exists():
        return  # Audience Q&A answers are evaluated by the Q&A flow, not as presentations.
    deck_id = Attempt.objects.filter(pk=attempt_id).values_list('deck_id', flat=True).first()
    if PresentationContext.objects.filter(deck_id=deck_id).count() > 1:
        return  # Ambiguous settings: the app starts the run with its own context instead.
    try:
        start(attempt_id)
    except Exception as error:
        logger.warning('feedback_v3 auto-start skipped: %s', getattr(error, 'code', type(error).__name__))


def _save(run: FeedbackRun, **fields) -> None:
    fields['heartbeat_at'] = timezone.now()
    for key, value in fields.items():
        setattr(run, key, value)
    run.save(update_fields=list(fields))
    if 'result' in fields:
        from ..services.prepared_display import changed
        changed('feedback', run.pk)


def run(run_id) -> None:
    now = timezone.now()
    claimed = FeedbackRun.objects.filter(pk=run_id, status=FeedbackRun.Status.QUEUED).update(
        status=FeedbackRun.Status.RUNNING, started_at=now, heartbeat_at=now, worker_attempts=F('worker_attempts') + 1)
    if not claimed:
        return  # Duplicate delivery or already handled.
    job = FeedbackRun.objects.select_related('attempt__deck', 'context').get(pk=run_id)
    try:
        _execute(job)
    except Exception:
        logger.exception('feedback_v3 run stopped unexpectedly')
        try:
            _save(job, status=FeedbackRun.Status.FAILED, finished_at=timezone.now(),
                  error={'code': 'processing_failed', 'message': MESSAGES['processing_failed']})
        except Exception:
            logger.warning('feedback_v3 failure could not be saved; recovery will retry.')


def _replace_stale(job: FeedbackRun) -> None:
    """Inputs changed after the run was queued: queue one for the current inputs."""
    replacements = (job.result or {}).get('stale_replacements', 0)
    newer = FeedbackRun.objects.filter(attempt_id=job.attempt_id, context_id=job.context_id,
                                       created_at__gt=job.created_at).exists()
    if newer or replacements >= 3:
        return
    try:
        fresh = start(job.attempt_id, context_id=job.context_id)
        if fresh.pk != job.pk and fresh.status == FeedbackRun.Status.QUEUED and not fresh.result:
            FeedbackRun.objects.filter(pk=fresh.pk).update(result={'stale_replacements': replacements + 1})
    except Exception as error:
        logger.warning('feedback_v3 stale replacement skipped: %s', getattr(error, 'code', type(error).__name__))


def _execute(job: FeedbackRun) -> None:
    began = time.monotonic()
    deadline = began + RUN_BUDGET_SECONDS
    try:
        config = llm.Config.from_env()
        inputs = load_inputs(job.attempt, job.context, config.model)
    except (RunError, llm.LLMError) as error:
        _save(job, status=FeedbackRun.Status.FAILED, finished_at=timezone.now(),
              error={'code': error.code, 'message': MESSAGES.get(error.code, error.code)})
        return
    if inputs.fingerprint != job.fingerprint:
        newer = FeedbackRun.objects.filter(attempt_id=job.attempt_id, context_id=job.context_id,
                                           created_at__gt=job.created_at).exists()
        if not newer and not (job.result or {}).get('slides'):
            # Nothing graded yet: take the current inputs (e.g. a correction made while queued)
            # and keep this run's place in the queue instead of re-queueing at the back.
            _save(job, fingerprint=inputs.fingerprint)
        else:
            _save(job, status=FeedbackRun.Status.STALE, finished_at=timezone.now())
            if not newer:
                _replace_stale(job)
            return

    result = dict(job.result or {})
    result.pop('stale_replacements', None)
    result['measurements'] = inputs.measurements['whole']
    result['language'] = inputs.speech.language
    slides = result.setdefault('slides', {})
    reusable = _reusable_parts(job)
    work, reused = {}, 0
    # Slides first: per-slide feedback is the priority and appears as each part finishes.
    for index in range(len(inputs.slides)):
        key = str(index)
        if slides.get(key, {}).get('status') in FINISHED_PARTS:
            continue
        status, reason = plan_slide_reason(inputs, index)
        slides[key] = {'status': status or 'pending', 'measurements': inputs.measurements['slides'][index],
                       **({'reason': reason} if reason else {})}
        if not status:
            payload = slide_payload(inputs, index)
            digest = part_hash('slide', payload, config)
            if digest in reusable:
                slides[key] = {**reusable[digest], 'measurements': inputs.measurements['slides'][index], 'reused': True}
                reused += 1
            else:
                work[('slide', index)] = (payload, digest)
    # Whole-presentation feedback only for a take that covers every slide.
    if (result.get('whole') or {}).get('status') not in FINISHED_PARTS:
        if not presentation_complete(inputs):
            result['whole'] = {'status': 'not_recorded', 'reason': 'presentation_incomplete'}
        else:
            payload = whole_payload(inputs)
            digest = part_hash('whole', payload, config)
            if digest in reusable:
                result['whole'] = {**reusable[digest], 'reused': True}
                reused += 1
            else:
                result['whole'] = {'status': 'pending'}
                work[('whole', None)] = (payload, digest)
    result['scores'] = score(result)
    timings, usage = dict(job.timings or {}), dict(job.usage or {'input_tokens': 0, 'output_tokens': 0, 'calls': 0})
    timings['prepare_seconds'] = round(time.monotonic() - began, 2)
    usage['reused_parts'] = usage.get('reused_parts', 0) + reused
    _save(job, result=result, timings=timings, usage=usage)

    everything = inputs.speech.by_id()
    measures = {m['id']: m['what'] for m in measurement_items(inputs) if m['value'] is not None}
    slide_work = [(index, item) for (kind, index), item in work.items() if kind == 'slide']
    whole_work = work.get(('whole', None))
    if work:
        # The whole call has its own thread, so it never takes a slide's place in the pool.
        with httpx.Client() as http, \
                ThreadPoolExecutor(max_workers=max(1, min(config.max_parallel, len(slide_work)))) as pool, \
                ThreadPoolExecutor(max_workers=1) as whole_pool:
            futures = {pool.submit(call_llm, http, config, 'slide', payload, deadline): ('slide', index, digest)
                       for index, (payload, digest) in slide_work}
            if whole_work:
                futures[whole_pool.submit(call_llm, http, config, 'whole', whole_work[0], deadline)] = (
                    'whole', None, whole_work[1])
            for future in as_completed(futures):
                kind, index, digest = futures[future]
                name = 'whole' if kind == 'whole' else f'slide_{index}'
                try:
                    answer = future.result()
                    if kind == 'whole':
                        part = normalize_whole(answer.data, everything, len(inputs.slides), measures,
                                               inputs.speech.language)
                    else:
                        # A slide may cite only its own sentences.
                        own = {s.id: s for s in inputs.speech.slides[index].sentences}
                        part = normalize_slide(answer.data, own, inputs.speech.language,
                                               supplied_points=inputs.slides[index]['must_cover'])
                    part['input_hash'] = digest
                    timings[name] = answer.seconds
                    usage['input_tokens'] += answer.input_tokens
                    usage['output_tokens'] += answer.output_tokens
                    usage['calls'] += answer.tries
                except llm.LLMError as error:
                    part = {'status': 'failed', 'error': error.code}
                except Exception:
                    logger.exception('feedback_v3 part failed: %s', name)
                    part = {'status': 'failed', 'error': 'processing_failed'}
                if kind == 'whole':
                    result['whole'] = part
                else:
                    slides[str(index)] = {**part, 'measurements': inputs.measurements['slides'][index]}
                result['scores'] = score(result)
                _save(job, result=result, timings=timings, usage=usage)

    result['scores'] = score(result)
    timings['total_seconds'] = round(time.monotonic() - began, 2)
    # Failed only when no model-graded part exists at all, counting earlier passes.
    graded = [p for p in [result['whole'], *slides.values()] if p.get('status') not in CODE_DECIDED]
    failed = [p for p in graded if p.get('status') == 'failed']
    all_failed = bool(graded) and len(failed) == len(graded)
    error = None
    if all_failed:
        errors = {part['error'] for part in failed}
        code = failed[0]['error'] if len(errors) == 1 and failed[0]['error'] in BUDGET_MESSAGES else 'all_parts_failed'
        error = {'code': code, 'message': MESSAGES[code], 'detail': failed[0]['error']}
    _save(job, result=result, timings=timings, usage=usage, finished_at=timezone.now(),
          status=FeedbackRun.Status.FAILED if all_failed else FeedbackRun.Status.COMPLETED,
          error=error)


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
        'updated_at': max(t for t in (job.created_at, job.queued_at, job.started_at, job.heartbeat_at, job.finished_at) if t).isoformat(),
        'finished_at': job.finished_at.isoformat() if job.finished_at else None,
    }
