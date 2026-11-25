"""First-use display translations of saved AI results. Source analyses are read-only."""
from datetime import timedelta
from hashlib import sha256
import json
import logging
import os
import re
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..models import CaptureAssessment, DescriptionSet, DisplayTranslation, FeedbackJob, FeedbackRun, PreparedDisplayResource
from ..ownership import current_installation_id
from ..feedback_v3.llm import LLMError
from .feedback import FeedbackError

logger = logging.getLogger(__name__)


# Only public generated prose may join a translation. Source recordings, slide text,
# transcript evidence, speaking examples and private scoring audits are excluded.
FIELD_NAMES = {
    'feedback': {'label', 'anchor', 'reason', 'next_level', 'point', 'text', 'problem', 'action', 'summary', 'title', 'why',
                 'headline', 'explanation', 'steps'},
    'profiles': {'text', 'why', 'relevance', 'information_needed', 'supporting_detail'},
    'questions': {'panelist', 'role', 'topic', 'question', 'follow_up'},
    'answer': {'did', 'evidence', 'clarify'},
    'slide_review': {'observation', 'suggestion', 'idea'},
    'score': {'justification', 'limitations', 'consequence', 'text', 'improvement_shortage'},
    'coaching': {'observation', 'suggestion'},
}
LEGACY_LIMITS = {'panelist': 64, 'role': 60, 'topic': 80, 'question': 600, 'follow_up': 600,
                 'did': 400, 'evidence': 400, 'clarify': 400}
FIELD_KEY = re.compile(r'[A-Za-z0-9_][A-Za-z0-9_.:-]{0,159}\Z')
UNSAFE_TEXT = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff]')
RESULT_TYPES = {
    'answer': ('qa_answer', 'answer'),
    'slide_review': ('review_', 'slides'),
    'score': ('score_', 'presentation_score'),
    'coaching': ('coaching', 'suggestions'),
}


class SourceUnavailable(Exception):
    """The provided words do not come from this saved result."""


def _prose(node, names):
    if isinstance(node, list):
        for child in node:
            yield from _prose(child, names)
    elif isinstance(node, dict):
        for key, value in node.items():
            if key in names and isinstance(value, str):
                yield value
            elif key in ('limitations', 'explanation', 'steps') and key in names and isinstance(value, list):
                yield from (item for item in value if isinstance(item, str))
            elif key not in ('evidence', 'evidence_refs', 'private_audit', 'example', 'over_limit', 'measurements', 'transcript', 'validation'):
                yield from _prose(value, names)


def _saved_parts(kind, resource):
    if kind == 'feedback':
        run = FeedbackRun.objects.filter(pk=resource).values_list('result', flat=True).first()
        if run is not None:
            yield run
        else:
            # A live run's public run_id is the recording UUID. Historical
            # parts are retained when a later slide visit changes the current one.
            yield from CaptureAssessment.objects.filter(capture_id=resource, result__isnull=False).values_list('result', flat=True).iterator()
    elif kind == 'profiles':
        yield from DescriptionSet.objects.filter(pk=resource, edited=False).values_list('descriptions', flat=True)
    elif kind == 'questions':
        jobs = FeedbackJob.objects.filter(pk=int(resource), analysis__analysis_type__startswith='qa_')
        for result in jobs.values_list('result', flat=True):
            yield (result or {}).get('questions')
    else:
        analysis_type, section = RESULT_TYPES[kind]
        scope = ({'analysis__analysis_type__startswith': analysis_type} if analysis_type.endswith('_')
                 else {'analysis__analysis_type': analysis_type})
        jobs = FeedbackJob.objects.filter(analysis__attempt_id=resource, result__isnull=False, **scope)
        for result in jobs.order_by('-pk').values_list('result', flat=True).iterator():
            yield result.get(section)


def _validate_source(kind, resource, fields):
    if kind == 'legacy_qa':
        # The original deck Q&A endpoints only persisted these fields on the phone.
        for key, text in fields.items():
            if len(text) > LEGACY_LIMITS.get(key.rsplit('.', 1)[-1], 0):
                raise ValueError('invalid_archive_field')
        return
    missing = set(fields.values())
    for part in _saved_parts(kind, resource):
        missing.difference_update(_prose(part, FIELD_NAMES[kind]))
        if not missing:
            return
    raise SourceUnavailable()


def _valid_text(text, limit):
    return type(text) is str and 0 < len(text) <= limit and bool(text.strip()) and not UNSAFE_TEXT.search(text)


def _parse(payload):
    if type(payload) is not dict or set(payload) - {'kind', 'resource_id', 'language', 'fields', 'revision', 'retry', 'confirmed_retry_id'}:
        raise ValueError('invalid_request')
    kind, resource, language, fields = (payload.get(k) for k in ('kind', 'resource_id', 'language', 'fields'))
    revision, retry = payload.get('revision', ''), payload.get('retry', False)
    if (not isinstance(kind, str) or kind not in (*FIELD_NAMES, 'legacy_qa') or language not in ('en', 'ko')
            or not _valid_text(resource, 240) or type(retry) is not bool or type(revision) is not str
            or len(revision) > 128 or UNSAFE_TEXT.search(revision)):
        raise ValueError('invalid_request')
    if 'confirmed_retry_id' in payload and (not retry or type(payload['confirmed_retry_id']) is not str):
        raise ValueError('invalid_retry_confirmation')
    if kind == 'questions':
        if not re.fullmatch(r'[1-9][0-9]{0,18}', resource) or int(resource) > 2**63 - 1:
            raise ValueError('invalid_job')
    elif kind != 'legacy_qa':
        resource = str(uuid.UUID(resource))
    if (type(fields) is not dict or not 1 <= len(fields) <= 32
            or any(not isinstance(k, str) or not FIELD_KEY.fullmatch(k) or not _valid_text(v, 4000) for k, v in fields.items())
            or sum(map(len, fields.values())) > 12000):
        raise ValueError('invalid_fields')
    return kind, resource, language, revision, fields, retry


def _publish(key):
    from ..tasks import translate_display
    try:
        translate_display.delay(key)
    except Exception:
        # Beat republishes queued work from the durable row after a broker failure.
        pass


def _needs_translation(row):
    from .display_translator import display_issue
    missing = {}
    for key, source in row.fields.items():
        wording = row.translations.get(key)
        if (not isinstance(wording, str) or not wording.strip()
                or display_issue(row.kind, key, source, wording, row.language, row.source_languages.get(key, 'und'))):
            missing[key] = source
    return missing


def _needs_restart(row, retry):
    return (row.state == 'failed' and retry) or (row.state == 'completed' and bool(_needs_translation(row)))


def admit(payload):
    kind, resource, language, revision, fields, retry = _parse(payload)
    return admit_fields(kind, resource, language, revision, fields, retry, check_source=True,
                        confirmed_retry_id=payload.get('confirmed_retry_id'))


def _allow_exact_retry(row, confirmed_retry_id):
    # An enrolled phone automatically sends retry=true even for unbound, conflicting wording.
    if not PreparedDisplayResource.objects.filter(kind=row.kind, resource_id=row.resource_id, revision=row.revision).exists():
        return True
    if row.prepared_retry_at is None:
        return confirmed_retry_id == row.pk
    if row.prepared_retry_at > timezone.now():
        return False
    if row.prepared_retry_kind == 'correction' and not row.prepared_retries:
        row.prepared_retries += 1
    elif row.prepared_retry_kind != 'transient':
        return False
    row.prepared_retry_at, row.prepared_retry_kind = None, ''
    return True


def admit_fields(kind, resource, language, revision, fields, retry, *, check_source, confirmed_retry_id=None):
    # Prepared callers derive fields from the saved result or validate an explicitly supplied snapshot.
    owner = current_installation_id()
    identity = ['display-v1', kind, resource, revision, language, fields]
    if settings.OUTLOUD_PUBLIC_SERVICE:
        if owner is None:
            raise SourceUnavailable()
        identity.extend(['installation', owner])
    snapshot = json.dumps(identity, ensure_ascii=False,
                          separators=(',', ':'), sort_keys=True).encode('utf-8')
    key = sha256(snapshot).hexdigest()
    if confirmed_retry_id is not None and confirmed_retry_id != key:
        raise ValueError('invalid_retry_confirmation')
    row = DisplayTranslation.objects.filter(pk=key).first()
    if row and not _needs_restart(row, retry):
        return row
    if row is None and confirmed_retry_id is not None:
        raise ValueError('invalid_retry_confirmation')
    if row is None and check_source:
        _validate_source(kind, resource, fields)
    with transaction.atomic():
        row, created = DisplayTranslation.objects.select_for_update().get_or_create(pk=key, defaults={
            'installation_id': owner, 'kind': kind, 'resource_id': resource, 'revision': revision,
            'language': language, 'fields': fields})
        if confirmed_retry_id is not None and row.state != 'failed':
            if created:
                raise ValueError('invalid_retry_confirmation')
            return row
        restarted = not created and _needs_restart(row, retry)
        if restarted and check_source and row.state == 'failed':
            restarted = _allow_exact_retry(row, confirmed_retry_id)
        if check_source and (created or restarted):
            _configuration()
        if restarted:
            row.state, row.claim = 'queued', None
            row.save(update_fields=['state', 'claim', 'prepared_retries', 'prepared_retry_kind', 'prepared_retry_at', 'updated_at'])
        if created or restarted:
            transaction.on_commit(lambda: _publish(key))
    return row


def public(row):
    state = row.state if row.state in ('completed', 'failed') else 'pending'
    if state == 'completed' and _needs_translation(row):
        state = 'failed'  # A GET never starts work, including on a pre-upgrade invalid cache entry.
    return {'id': row.pk, 'language': row.language,
            'state': state, 'translations': row.translations if state == 'completed' else {},
            'source_languages': row.source_languages if state == 'completed' else {}}


def _configuration():
    from ..feedback_v3 import llm
    from . import qa
    if os.environ.get('FEEDBACK_V3_ENABLED', 'false') == 'true':
        return llm.Config.from_env(), None
    return qa.configured()


def run(key):
    token = uuid.uuid4()
    if not DisplayTranslation.objects.filter(pk=key, state='queued').update(
            state='running', claim=token, updated_at=timezone.now()):
        return
    row = DisplayTranslation.objects.get(pk=key)
    owned = DisplayTranslation.objects.filter(pk=key, state='running', claim=token)
    try:
        from .display_translator import translate
        missing = _needs_translation(row)
        if not missing:
            owned.update(state='completed', claim=None, prepared_retry_kind='', prepared_retry_at=None, updated_at=timezone.now())
            return
        translations, source_languages = translate(row.kind, row.language, missing, *_configuration())
    except Exception as error:
        # Never log provider content, audio/transcript material or private configuration.
        # After an uncertain submission only an explicit retry can make another call.
        logger.warning('Display translation failed: %s', error.code if isinstance(error, (FeedbackError, LLMError))
                       else 'translation_worker_error')
        # A provider may return useful siblings even if one field still fails its bounded correction.
        code = getattr(error, 'code', '')
        refused = code in ('provider_rate_limit', 'waiting_quota', 'provider_auth', 'provider_credits', 'missing_api_key',
                           'feedback_disabled', 'provider_unavailable_before_submit')
        retry_kind, retry_at, failures = '', None, row.transient_failures
        if getattr(error, 'pre_submission', False) or (refused and not getattr(error, 'uncertain', False)):
            retry_kind, failures = 'transient', min(failures + 1, 10)
            delay = min(15 * 2 ** (failures - 1), 300)
            retry_at = timezone.now() + timedelta(seconds=max(delay, getattr(error, 'retry_after', 0) or 0))
            if getattr(error, 'retry_at', None):
                retry_at = max(retry_at, error.retry_at)
        elif not getattr(error, 'uncertain', False) and not row.prepared_retries and isinstance(code, str) and (
                code.startswith('invalid_translation') or code in ('wrong_display_language', 'empty_output', 'output_cut_off')):
            retry_kind, retry_at = 'correction', timezone.now() + timedelta(seconds=15)
        partial = getattr(error, 'translations', {})
        sources = getattr(error, 'source_languages', {})
        owned.update(state='failed', claim=None, prepared_retry_kind=retry_kind, prepared_retry_at=retry_at, transient_failures=failures,
                     translations={**row.translations, **partial},
                     source_languages={**row.source_languages, **sources}, updated_at=timezone.now())
        return
    # A repaired historical batch keeps the already-valid wording for every other field.
    owned.update(state='completed', claim=None, prepared_retry_kind='', prepared_retry_at=None, transient_failures=0, translations={**row.translations, **translations},
                 source_languages={**row.source_languages, **source_languages},
                 updated_at=timezone.now())


def recover():
    now = timezone.now()
    DisplayTranslation.objects.filter(state='running', updated_at__lt=now - timedelta(minutes=4)).update(
        state='failed', claim=None, prepared_retry_kind='', prepared_retry_at=None, updated_at=now)
    queued = DisplayTranslation.objects.filter(state='queued', updated_at__lt=now - timedelta(seconds=30))
    for key in queued.values_list('pk', flat=True)[:32]:
        if queued.filter(pk=key).update(updated_at=now):
            _publish(key)
