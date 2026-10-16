"""Explicit unified scoring on the existing durable feedback transport.

Only worker preparation reads audio. Frozen original evidence, measurement output,
protocol and generations bind the request; GET only projects stored results.
"""
from copy import deepcopy
from dataclasses import dataclass
import hashlib
import uuid

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Attempt, Deck, DescriptionSet, FeedbackAnalysis, FeedbackJob, FeedbackRequest, PresentationContext
from . import coaching, corrections, descriptions, feedback_provider as provider, presentation_score as v1
from .feedback import FeedbackError, json_bytes, restore_analysis
from .feedback_config import Selection, QuotaPolicy, assert_selection, selection_descriptor

VERSION = 'presentation-score-v2'
PROMPT_VERSION = 'presentation-score-prompt-v2.1'
SCHEMA_VERSION = VERSION

# Exact original v2 protocol, including rubric, evidence, measurements and schema.
# This only authorizes fresh generation; old receipts remain bound to their own
# immutable protocol and are never normalized using the replacement prompt.
_PREVIOUS_V2_PROTOCOL_DIGEST = '3c4c634861209d739d76e31068e6caaad00b4c7e905ed68c52fabcb9ce9a83f0'
# Canonical fingerprint is separate from the historical request digest because
# JSONB reorders object fields while preserving their exact values.
_PREVIOUS_V2_PROTOCOL_FINGERPRINT = '1205c060a5691f8a220fd7ab6bfd19c791114deb3334883a457904d581bf8b5b'


def context_for(attempt, context_id):
    if context_id is None:
        return None
    if type(context_id) is not str:
        raise FeedbackError('invalid_request')
    try:
        return str(PresentationContext.objects.get(pk=uuid.UUID(context_id), deck_id=attempt.deck_id).pk)
    except (ValueError, ValidationError, PresentationContext.DoesNotExist):
        raise FeedbackError('invalid_request') from None


def analysis_type(context_id):
    return 'score_' + hashlib.sha256(json_bytes({'context_id': context_id})).hexdigest()[:24]


def requirements(attempt, context_id):
    from .slide_review import requirements as current_requirements
    return current_requirements(attempt, {'context_id': context_id})


def protocol():
    from . import presentation_score_v2 as core
    from .presentation_measurements import VERSION as measurement_version
    return {'rubric_version': VERSION, 'prompt_version': PROMPT_VERSION, 'schema_version': SCHEMA_VERSION,
            'definition': core.protocol_descriptor(), 'measurement_version': measurement_version}


def prompt_digest():
    return coaching._digest(protocol())


def check_versions(job):
    if (job.prompt_version != PROMPT_VERSION or job.schema_version != SCHEMA_VERSION or
            job.prompt_digest != prompt_digest() or job.source_snapshot.get('presentation_score', {}).get('protocol') != protocol()):
        raise FeedbackError('snapshot_unavailable')


def _replacement_supported(job):
    try:
        check_versions(job)
        return True
    except FeedbackError:
        captured = job.source_snapshot.get('presentation_score', {}).get('protocol')
        return (job.prompt_version == VERSION and job.schema_version == SCHEMA_VERSION and
                job.prompt_digest == _PREVIOUS_V2_PROTOCOL_DIGEST and
                v1._digest(captured) == _PREVIOUS_V2_PROTOCOL_FINGERPRINT)


def _rejected_completion(job):
    return (job.state == 'completed' and job.result is not None and
            job.result.get('presentation_score', {}).get('assessment_status') == 'invalid_evidence')


def descriptor(selection=None, *, value=None, job=None):
    result = selection_descriptor(selection, value=value, job=job, coaching=True)
    if result is None:
        return None
    result.update(coaching_prompt_version=job.prompt_version if job else PROMPT_VERSION,
                  coaching_schema_version=job.schema_version if job else SCHEMA_VERSION,
                  coaching_prompt_digest=job.prompt_digest if job else prompt_digest())
    result.pop('token', None)
    return {**result, 'token': coaching._digest(result)}


def current(attempt, job):
    """Database-only fence; never decode/read media under admission/job locks."""
    captured = job.source_snapshot.get('presentation_score')
    try:
        if (not captured or captured['protocol'] != protocol() or
                requirements(attempt, captured['context_id']) != captured['requirements'] or
                job.description_set.processing_revision != job.description_generation):
            return False
        selection = Selection.current()
        saved = job.description_set
        return (selection.provider, selection.project_id, selection.model) == (saved.provider, saved.project_id, saved.model)
    except (KeyError, FeedbackError, PresentationContext.DoesNotExist):
        return False


def _capture(attempt, context_id, source, analysis):
    correction = coaching.correction_input(attempt)
    return {'source': source, 'attempt_identity': coaching.attempt_identity(attempt),
            'analysis_id': analysis.input_id, 'transcript_id': analysis.transcript_id,
            'chronology_id': coaching._digest([attempt.duration_ms, attempt.slide_events]), **correction,
            'presentation_score': {'protocol': protocol(), 'context_id': context_id,
                'requirements': requirements(attempt, context_id), 'slide_events': deepcopy(attempt.slide_events)}}


def _queue(analysis, value, snapshot):
    analysis.feedback_revision += 1
    analysis.save(update_fields=['feedback_revision', 'updated_at'])
    job = FeedbackJob.objects.create(analysis=analysis, generation=analysis.feedback_revision,
        description_set=value, description_generation=value.processing_revision, source_snapshot=snapshot,
        prompt_version=PROMPT_VERSION, schema_version=SCHEMA_VERSION, prompt_digest=prompt_digest(), queued_at=timezone.now())
    coaching._attach(value, job)
    transaction.on_commit(lambda: coaching.publish(analysis.pk, job.generation))
    return analysis


@descriptions._private_database_logging()
def generate(attempt_id, payload, context_id=None):
    attempt = Attempt.objects.select_related('deck').get(pk=attempt_id)
    context_id = context_for(attempt, context_id)
    kind = analysis_type(context_id)
    if 'transcript_revision' in payload and payload['transcript_revision'] != corrections.snapshot(attempt)['revision']:
        raise coaching.Conflict('correction_conflict')
    existing = FeedbackAnalysis.objects.filter(attempt=attempt, analysis_type=kind).first()
    if existing:
        with transaction.atomic():
            Deck.objects.select_for_update().get(pk=attempt.deck_id)
            attempt = Attempt.objects.select_for_update().select_related('deck').get(pk=attempt_id)
            value, owner, old = coaching._locked(existing.pk, existing.feedback_revision)
            if old.generation != owner.feedback_revision:
                raise coaching.Conflict('stale_revision')
            assert_selection(payload, descriptor(value=value, job=old))
            if payload.get('feedback_revision', owner.feedback_revision) != owner.feedback_revision:
                raise coaching.Conflict('stale_revision')
            if 'transcript_revision' in payload and payload['transcript_revision'] != corrections.snapshot(attempt)['revision']:
                raise coaching.Conflict('correction_conflict')
            stale = coaching._stale(value, old) or not coaching._source_current(old)
            explicit_rejected_retry = _rejected_completion(old) and 'feedback_revision' in payload
            if not stale and old.state in coaching.ACTIVE | {'completed'} and not explicit_rejected_retry:
                return owner
            if 'feedback_revision' not in payload:
                raise coaching.Conflict('revision_required')
            request = FeedbackRequest.objects.filter(coaching_job=old).first()
            if coaching._uncertain(request) and not payload.get('acknowledge_uncertain'):
                raise coaching.Conflict('confirmation_required')
            retry_at = descriptions.effective_retry_at(value, old)
            if retry_at and retry_at > timezone.now():
                raise coaching.Conflict('retry_not_available')
            if coaching.attempt_identity(attempt) != old.source_snapshot['attempt_identity']:
                raise coaching.Conflict('source_changed')
            selection = Selection.saved(value)
            selection.check_versions(value.prompt_digest)
            if not _replacement_supported(old):
                raise FeedbackError('snapshot_unavailable')
            selection.credentials(); QuotaPolicy.current(selection)
            source = old.source_snapshot['source']
            # Rebuild immutable admission revisions, but measure only in the worker.
            snapshot = _capture(attempt, context_id, source, type('Identity', (), {
                'input_id': old.source_snapshot['analysis_id'], 'transcript_id': old.source_snapshot['transcript_id']})())
            if (Selection.current().provider, Selection.current().project_id, Selection.current().model) != (value.provider, value.project_id, value.model):
                raise coaching.Conflict('selection_mismatch')
            return _queue(owner, value, snapshot)
    if set(payload) - {'expected_selection', 'transcript_revision'}:
        raise coaching.Conflict('stale_revision')
    source = coaching.prepare_attempt(attempt)
    deck, storage = descriptions.prepare_saved(attempt.deck_id)
    selection = coaching.profile_selection(attempt.deck_id, source=deck.input_id)
    assert_selection(payload, descriptor(selection))
    selection.credentials(); QuotaPolicy.current(selection)
    analysis = restore_analysis(source, deck)
    snapshot = _capture(attempt, context_id, source, analysis)
    candidate = selection.adapter().prepare_descriptions(deck)
    with transaction.atomic():
        locked_deck = Deck.objects.select_for_update().get(pk=attempt.deck_id)
        attempt = Attempt.objects.select_for_update().select_related('deck').get(pk=attempt_id)
        if coaching.attempt_identity(attempt) != snapshot['attempt_identity']:
            raise coaching.Conflict('source_changed')
        if coaching.correction_input(attempt)['transcript_revision'] != snapshot['transcript_revision']:
            raise coaching.Conflict('correction_conflict')
        if requirements(attempt, context_id) != snapshot['presentation_score']['requirements']:
            raise coaching.Conflict('requirements_changed')
        descriptions.check_storage(locked_deck, storage)
        owner = FeedbackAnalysis.objects.filter(attempt=attempt, analysis_type=kind).first()
        if owner:
            return generate(attempt_id, payload, context_id)
        assert_selection(payload, descriptor(coaching.profile_selection(attempt.deck_id, source=deck.input_id)))
        value = descriptions.admit_prepared(selection, deck, storage, dependency=True, candidate=candidate)
        owner = FeedbackAnalysis.objects.create(attempt=attempt, analysis_type=kind)
        return _queue(owner, value, snapshot)


def _bundle(value, job, measurements):
    source = job.source_snapshot
    captured = source['presentation_score']
    deck = descriptions.snapshot_deck(value)
    analysis = restore_analysis(source['source'], deck)
    if (analysis.input_id, analysis.transcript_id) != (source['analysis_id'], source['transcript_id']):
        raise FeedbackError('snapshot_unavailable')
    description_result = Selection.saved(value).adapter().edited_descriptions(analysis, job.descriptions_snapshot)
    correction = {'revision': source['transcript_revision'], 'edits': source['corrections'],
                  'effective_text': source['effective_text'], 'source_changed': False}
    revisions = {'audio_hash': measurements['audio_hash'], 'transcript_revision': source['transcript_revision'],
                'profile_revision': job.description_revision, 'requirements_revision': captured['requirements']['revision'],
                'attempt_identity': source['attempt_identity'], 'profile_set_id': str(value.pk),
                'profile_generation': job.description_generation}
    return v1.capture(analysis, description_result.descriptions, requirements=captured['requirements'],
        correction=correction, measurements=measurements, revisions=revisions, slide_events=captured['slide_events'])


def prepared(value, job):
    from . import presentation_score_v2 as core, presentation_measurements
    check_versions(job)
    Selection.saved(value).check_versions(value.prompt_digest)
    captured = job.source_snapshot['presentation_score']
    measurements = captured.get('measurements')
    if measurements is None:
        # No transaction here: local hashing/decoding/VAD can be expensive.
        attempt = Attempt.objects.get(pk=job.analysis.attempt_id)
        measurements = presentation_measurements.measure_audio(attempt.audio.path,
            attempt_id=str(attempt.pk), duration_ms=job.source_snapshot['source']['duration_ms'],
            text=job.source_snapshot['effective_text'], language=job.source_snapshot['source']['speaker_language'])
        bundle = _bundle(value, job, measurements)
        identity = core.source_identity(bundle)
        with transaction.atomic():
            locked_value, owner, locked_job = coaching._locked(job.analysis_id, job.generation)
            coaching._fresh(locked_value, owner, locked_job, job.claim_token)
            frozen = locked_job.source_snapshot['presentation_score'].get('measurements')
            if frozen is not None:
                measurements = frozen
            else:
                locked_job.source_snapshot = {**locked_job.source_snapshot, 'presentation_score': {
                    **locked_job.source_snapshot['presentation_score'], 'measurements': measurements, 'source_identity': identity}}
                locked_job.save(update_fields=['source_snapshot', 'updated_at'])
            job.source_snapshot = locked_job.source_snapshot
    bundle = _bundle(value, job, measurements)
    if core.source_identity(bundle) != job.source_snapshot['presentation_score']['source_identity']:
        raise FeedbackError('snapshot_unavailable')
    config = provider.ProviderConfig(value.provider, value.model, '')
    request = core.prepare(bundle, config)
    if job.input_hash and request.input_hash != job.input_hash:
        raise FeedbackError('snapshot_unavailable')
    return request


@dataclass(frozen=True)
class ScoreResult:
    presentation_score: dict
    private_audit: dict
    state: str = 'accepted'
    accepted_count: int = 1
    discarded_count: int = 0
    suggestions: tuple = ()


def normalize(value, job, prepared_request, receipt):
    from . import presentation_score_v2 as core
    check_versions(job)
    bundle = _bundle(value, job, job.source_snapshot['presentation_score']['measurements'])
    result, audit = core.normalize_with_audit(bundle, prepared_request, receipt)
    audit = {**audit, 'binding': {'input_hash': prepared_request.input_hash, 'protocol': protocol(),
        'attempt_identity': job.source_snapshot['attempt_identity'], 'revisions': bundle.revisions,
        'source_identity': core.source_identity(bundle), 'provider': value.provider, 'model': value.model,
        'profile_generation': job.description_generation, 'feedback_generation': job.generation}}
    return ScoreResult(result, audit)


def public_result(value, job, current_job):
    if not job or not job.result or 'presentation_score' not in job.result:
        return None
    # Generic coaching can retain an older result while its replacement runs.
    # Keep that receipt in storage, but never label it as the current score.
    if (current_job is None or job.pk != current_job.pk or job.generation != current_job.generation
            or coaching._stale(value, current_job) or not coaching._source_current(current_job)):
        return None
    result = deepcopy(job.result['presentation_score'])
    if result.get('source_identity') != current_job.source_snapshot.get('presentation_score', {}).get('source_identity'):
        return None
    source = job.source_snapshot['source']
    result['evidence'] = {'attempt_id': source['attempt_id'], 'deck_id': source['deck_id'],
        'transcript_id': job.source_snapshot['transcript_id'], 'chronology_id': job.source_snapshot['chronology_id'],
        'duration_ms': source['duration_ms'], 'page_count': len(source['slides']),
        'audience_supplied': bool(job.source_snapshot['presentation_score']['requirements']['audience'].strip()),
        'visits': source['visits'], 'sources': [{'slide_index': i, 'source_id': sid}
            for i, sid in enumerate(value.source_snapshot['source_ids'])], 'descriptions': job.descriptions_snapshot}
    return result


@descriptions._private_database_logging()
def read(attempt_id, context_id=None):
    attempt = Attempt.objects.select_related('deck').get(pk=attempt_id)
    context_id = context_for(attempt, context_id)
    state = coaching.read(attempt_id, analysis_type(context_id))
    owner = FeedbackAnalysis.objects.filter(attempt=attempt, analysis_type=analysis_type(context_id)).first()
    # Bind additions to the generation already read under coaching's locks.
    # A concurrent Update can advance owner.feedback_revision after that snapshot.
    revision = state['feedback_revision']
    job = owner.jobs.get(generation=revision) if owner and revision else None
    if revision and job is None:
        raise FeedbackError('snapshot_unavailable')
    if job:
        value = job.description_set
        state['selection'] = descriptor(value=value, job=job)
        identity = job.source_snapshot.get('presentation_score', {}).get('source_identity')
        if not _replacement_supported(job):
            state['retry_available'] = False
        elif _rejected_completion(job):
            retry_at = state['retry_at']
            state['retry_available'] = not retry_at or retry_at <= timezone.now()
    else:
        try:
            selection = coaching.profile_selection(attempt.deck_id)
            state['selection'] = descriptor(selection)
            state['availability'] = coaching._availability(selection)
        except FeedbackError:
            state['selection'] = None
        identity = None
    assessment = state['result']['assessment_status'] if state['result'] else (
        'pending' if state['state'] in coaching.ACTIVE else 'not_graded' if not revision else 'unavailable')
    frozen_requirements = (deepcopy(job.source_snapshot['presentation_score']['requirements'])
                           if job else requirements(attempt, context_id))
    state.update(schema_version=VERSION, rubric_version=VERSION, context_id=context_id,
        requirements=frozen_requirements, source_identity=identity, assessment_status=assessment,
        transcript_revision=state.get('transcript_revision', corrections.snapshot(attempt)['revision']))
    return state
