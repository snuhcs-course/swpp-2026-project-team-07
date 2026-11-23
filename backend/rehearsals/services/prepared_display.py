"""Opt-in preparation of exact display fields for a single saved bilingual result."""
from datetime import timedelta
import logging
import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..feedback_v3.rubric import CURRENT
from ..models import (Attempt, CaptureAssessment, CaptureSession, DescriptionJob, DescriptionSet, DisplayTranslation,
                      FeedbackJob, FeedbackRun, PreparedDisplayField, PreparedDisplayResource, QaAnswer)
from . import display_translator as translator, localization

logger = logging.getLogger(__name__)
PAGE_FIELDS = 32
ARCHIVE_FIELDS = 512
ARCHIVE_CHARACTERS = 250000
LANGUAGES = ('en', 'ko')
PROTECTED = {'evidence', 'evidence_refs', 'measurements', 'example', 'over_limit', 'transcript',
             'validation', 'private_audit', 'source_snapshot', 'source_identity'}
LIST_FIELDS = {'explanation', 'steps', 'limitations'}
RUBRIC_LABELS = {criterion.label for criterion in (*CURRENT.slide, *CURRENT.whole)}
RUBRIC_ANCHORS = {anchor for criterion in (*CURRENT.slide, *CURRENT.whole) for anchor in criterion.anchors}


def _walk(node, path, names):
    """Walk only public generated prose; exact evidence/practice text is never a candidate."""
    if isinstance(node, list):
        for i, item in enumerate(node):
            yield from _walk(item, f'{path}.{i}', names)
    elif isinstance(node, dict):
        for name, item in node.items():
            key = f'{path}.{name}'
            if name in names and isinstance(item, str) and localization._valid_text(item, 4000):
                yield key, item
            elif name in names and name in LIST_FIELDS and isinstance(item, list):
                for i, bullet in enumerate(item):
                    if localization._valid_text(bullet, 4000):
                        yield f'{key}.{i}', bullet
            elif name not in PROTECTED and isinstance(item, (list, dict)):
                yield from _walk(item, key, names)


def _part(part, path):
    if not isinstance(part, dict):
        return {}
    # Root reason is a status code. The nested criterion reason is generated prose.
    fields = dict(_walk(part, path, localization.FIELD_NAMES['feedback']))
    fields.pop(path+'.reason', None)
    for i, criterion in enumerate(part.get('criteria', [])):
        for name, fixed in [('label', RUBRIC_LABELS), ('anchor', RUBRIC_ANCHORS)]:
            if criterion.get(name) in fixed:
                fields.pop(f'{path}.criteria.{i}.{name}', None)
    return fields


def _feedback(resource):
    run = FeedbackRun.objects.filter(pk=resource).values('result', 'status').first()
    if run:
        result = run['result'] or {}
        fields = {}
        for index, part in (result.get('slides') or {}).items():
            fields.update(_part(part, 'slides.'+index))
        fields.update(_part(result.get('whole'), 'whole'))
        return _state(run['status']), fields
    session = CaptureSession.objects.filter(pk=resource).values('desired', 'finalized').first()
    if not session:
        raise localization.SourceUnavailable()
    references = {int(item['assessment']): key for key, item in session['desired'].items()
                  if (key == 'whole' or key.isdigit()) and isinstance(item, dict) and item.get('assessment')}
    fields = {}
    state = 'completed' if session['finalized'] else 'pending'
    for pk, status, part in CaptureAssessment.objects.filter(capture_id=resource, pk__in=references).values_list('pk', 'status', 'result'):
        key = references[pk]
        fields.update(_part(part, 'whole' if key == 'whole' else 'slides.'+key))
        if _state(status) != 'completed':
            state = _state(status) if state != 'pending' else state
    return state, fields


def _state(value):
    if value == 'completed':
        return value
    if value in ('failed', 'uncertain', 'needs_confirmation', 'superseded', 'stale'):
        return 'failed'
    return 'pending'


def _questions(result):
    names = localization.FIELD_NAMES['questions']
    return {key: text for key, text in _walk(result.get('questions') or [], 'questions', names)
            if not (key.endswith('.panelist') and re.fullmatch(r'P[0-9]+', text, re.I))}


def _selection_sources(kind, jobs, result_key):
    states, sources = set(), {}
    for status, saved in jobs.values_list('state', 'result').iterator():
        states.add(_state(status))
        result = saved.get(result_key) if isinstance(saved, dict) else None
        if kind == 'score':
            parts = [('score', result)]
        elif isinstance(result, list):
            parts = [(f"slides.{slide['slide_index']}.findings", slide.get('findings', [])) for slide in result
                     if isinstance(slide, dict) and type(slide.get('slide_index')) is int and slide['slide_index'] >= 0]
        else:
            continue
        for path, part in parts:
            for key, text in _walk(part, path, localization.FIELD_NAMES[kind]):
                sources.setdefault(key, set()).add(text)
    # A completed selection can use exact on-demand wording while its peers are still running.
    if 'completed' in states:
        return 'completed', sources
    return ('failed' if states == {'failed'} else 'pending'), sources


def _snapshot(kind, resource, revision):
    if kind == 'feedback':
        return _feedback(resource)
    if kind == 'profiles':
        item = DescriptionSet.objects.filter(pk=resource, edited=False).values('description_revision','descriptions','prompt_version').first()
        if not item:
            raise localization.SourceUnavailable()
        if revision and revision not in (str(item['description_revision']), str(item['description_revision'] + 1)):
            raise localization.SourceUnavailable()
        if not item['descriptions'] or revision and revision != str(item['description_revision']):
            latest = DescriptionJob.objects.filter(description_set_id=resource).order_by('-generation').values_list('state',flat=True).first()
            return ('failed' if _state(latest) == 'failed' else 'pending'), {}
        # The mobile app offers fresh guidance for the retired profile formats.
        if item['prompt_version'] in ('slide-profile-v1','slide-profile-v2','slide-profile-v3'):
            return 'completed', {}
        fields = {}
        for slide in item['descriptions'].get('slides', []):
            for group in ('must_cover', 'go_deeper'):
                values = slide.get(group, [])
                fields.update(_walk(values, f"slides.{slide['slide_index']}.{group}", {'text','supporting_detail','information_needed'}))
        return 'completed', fields
    if kind == 'questions':
        job = FeedbackJob.objects.filter(pk=int(resource), analysis__analysis_type__startswith='qa_').exclude(
            analysis__analysis_type='qa_answer').values('state','result').first()
        if not job:
            raise localization.SourceUnavailable()
        return _state(job['state']), _questions(job['result'] or {})
    if kind == 'legacy_qa':
        return 'completed', {}
    prefix, result_key = localization.RESULT_TYPES[kind]
    jobs = FeedbackJob.objects.filter(analysis__attempt_id=resource, analysis__analysis_type__startswith=prefix)
    if kind == 'answer':
        binding = QaAnswer.objects.filter(pk=resource).select_related('question_job', 'attempt').first()
        if not binding:
            raise localization.SourceUnavailable()
        if binding.attempt.status == 'completed' and (binding.attempt.duration_ms < 8000 or len((binding.attempt.transcript or {}).get('words', [])) < 15):
            return 'completed', {}
    elif not Attempt.objects.filter(pk=resource).exists():
        raise localization.SourceUnavailable()
    if revision:
        if not revision.isdigit() or len(revision) > 10:
            raise ValueError('invalid_revision')
        jobs = jobs.filter(generation=int(revision))
    else:
        from django.db.models import F
        jobs = jobs.filter(generation=F('analysis__feedback_revision'))
    if kind in ('slide_review', 'score'):
        return _selection_sources(kind, jobs, result_key)
    matches = list(jobs.values('state', 'result')[:2])
    if len(matches) != 1:
        return 'pending', {}
    state, result = _state(matches[0]['state']), (matches[0]['result'] or {}).get(result_key)
    if not result:
        return state, {}
    names = localization.FIELD_NAMES[kind]
    if kind == 'answer':
        qs = (binding.question_job.result or {}).get('questions', [])
        index = next((i for i,q in enumerate(qs) if q.get('id') == binding.question_id), None)
        if index is None:
            raise localization.SourceUnavailable()
        return state, dict(_walk(result, f'answers.{index}.{binding.part}', names))
    return state, dict(_walk(result, 'suggestions', names))


def _identity(kind, key, value, language):
    masked, _ = translator._mask(value, translator._preserve_quote(kind, key), protect_numbers=False)
    masked = translator.MARKER.sub(' ', masked)
    letters = [c for c in masked if c.isalpha()]
    if not letters:
        return True
    known = translator._clear_language(masked)
    if not known and all(translator.HANGUL.fullmatch(c) for c in letters):
        known = 'ko'
    return known == language and not translator.display_issue(kind, key, value, value, language, known)


def _batches(fields):
    batch, size = {}, 0
    for key, value in sorted(fields.items()):
        if batch and (len(batch) >= 16 or size + len(value) > 6000):
            yield batch
            batch, size = {}, 0
        batch[key] = value
        size += len(value)
    if batch:
        yield batch


def _bind(bundle, values):
    # The bundle row lock serializes overlapping enrollments and completion hooks.
    old = {v.path: v for v in bundle.wording.filter(path__in=values)} if values else {}
    changed = {key: text for key, text in values.items() if key not in old or text != old[key].source}
    if not changed:
        return
    new = {key: PreparedDisplayField(bundle=bundle, path=key, source=text) for key,text in changed.items()}
    for language in (bundle.preferred_language, 'en' if bundle.preferred_language == 'ko' else 'ko'):
        missing = {key:text for key,text in changed.items() if not _identity(bundle.kind, key, text, language)}
        # Reuse validated historical wording, including earlier on-demand batches with different boundaries.
        prior = DisplayTranslation.objects.filter(kind=bundle.kind, resource_id=bundle.resource_id, revision=bundle.revision,
            language=language).exclude(translations={}).order_by('updated_at')[:256]
        for row in prior if missing else ():
            for key in missing.keys() & row.translations.keys():
                source, text = missing[key], row.translations[key]
                if row.fields.get(key) == source and not translator.display_issue(bundle.kind,key,source,text,language,row.source_languages.get(key,'und')):
                    setattr(new[key],language+'_id',row.pk)
                    del missing[key]
        for fields in _batches(missing):
            job = localization.admit_fields(bundle.kind,bundle.resource_id,language,bundle.revision,fields,False,check_source=False)
            for key in fields:
                setattr(new[key],language+'_id',job.pk)
    PreparedDisplayField.objects.bulk_create(new.values(), batch_size=100, update_conflicts=True,
        update_fields=['source','en','ko'], unique_fields=['bundle','path'])


def _sync(bundle, supplied=None):
    state, values = _snapshot(bundle.kind, bundle.resource_id, bundle.revision)
    if supplied and state == 'pending' and bundle.kind in ('slide_review','score','coaching'):
        state = 'completed'
    if values and bundle.kind in ('slide_review', 'score'):
        if supplied and any(text not in values.get(key, ()) for key, text in supplied.items()):
            raise localization.SourceUnavailable()
        # A bundle has one row per path. Only wording agreed by every occurrence can be bound to it.
        values = {key: next(iter(sources)) for key, sources in values.items() if len(sources) == 1}
        supplied = None
    if supplied:
        if bundle.kind == 'legacy_qa' or bundle.kind in ('slide_review','score','coaching') and not values:
            localization._validate_source(bundle.kind, bundle.resource_id, supplied)
        elif any(values.get(key) != text for key,text in supplied.items()):
            raise localization.SourceUnavailable()
        values.update(supplied)
    if bundle.kind == 'legacy_qa':
        known = dict(bundle.wording.values_list('path','source'))
        known.update(values)
        if len(known) > ARCHIVE_FIELDS or sum(map(len,known.values())) > ARCHIVE_CHARACTERS:
            raise ValueError('archive_too_large')
    elif state == 'completed' and not (supplied and bundle.kind in ('slide_review','score','coaching')):
        bundle.wording.exclude(path__in=values).delete()
    _bind(bundle, values)
    bundle.source_state = state
    bundle.save(update_fields=['source_state','last_checked'])


def enroll(payload):
    if type(payload) is not dict or set(payload) - {'kind','resource_id','revision','fields','retry','preferred_language','confirmed_retry_fields'}:
        raise ValueError('invalid_request')
    fields = payload.get('fields')
    if fields is not None and (not isinstance(fields, dict) or not fields):
        raise ValueError('invalid_fields')
    preferred = payload.get('preferred_language')
    if 'preferred_language' in payload and preferred not in LANGUAGES:
        raise ValueError('invalid_preferred_language')
    confirmed = payload.get('confirmed_retry_fields', [])
    if not isinstance(confirmed, list) or len(confirmed) > 32 or any(
            not isinstance(path, str) or not localization.FIELD_KEY.fullmatch(path) for path in confirmed) or (confirmed and preferred is None):
        raise ValueError('invalid_confirmed_fields')
    kind, resource, _, revision, _, retry = localization._parse({'kind':payload.get('kind'), 'resource_id':payload.get('resource_id'),
        'revision':payload.get('revision',''), 'retry':payload.get('retry',False), 'language':'en', 'fields':fields or {'probe':'probe'}})
    if kind in ('feedback','questions','answer','legacy_qa') and revision:
        raise ValueError('unexpected_revision')
    if kind in ('profiles','score','slide_review','coaching') and revision and (not revision.isascii() or not revision.isdecimal() or str(int(revision)) != revision or len(revision)>10):
        raise ValueError('invalid_revision')
    with transaction.atomic():
        bundle,_ = PreparedDisplayResource.objects.select_for_update().get_or_create(kind=kind,resource_id=resource,revision=revision)
        if kind == 'legacy_qa' and not fields and not bundle.wording.exists():
            raise ValueError('archive_requires_fields')
        bundle.last_requested = timezone.now()
        if preferred:
            bundle.preferred_language = preferred
        bundle.save(update_fields=['last_requested','preferred_language'])
        _sync(bundle, fields)
        if confirmed:
            _confirmed_retry(bundle, confirmed, preferred)
        if retry:
            jobs = set(bundle.wording.values_list('en_id',flat=True)) | set(bundle.wording.values_list('ko_id',flat=True))
            _retry(DisplayTranslation.objects.filter(pk__in=jobs))
    return bundle


def _confirmed_retry(bundle, paths, language):
    # Separate from automatic mobile retry: the caller explicitly confirms just these
    # canonical fields for this resource and language, including ambiguous legacy failures.
    rows = list(bundle.wording.filter(path__in=paths).select_related(language))
    if len(rows) != len(set(paths)):
        raise ValueError('unknown_confirmation_field')
    fields = {}
    for row in rows:
        job = getattr(row, language)
        if job and job.state == 'failed' and row.path in localization._needs_translation(job):
            fields[row.path] = row.source
    for batch in _batches(fields):
        job=localization.admit_fields(bundle.kind,bundle.resource_id,language,bundle.revision,batch,True,check_source=False)
        bundle.wording.filter(path__in=batch).update(**{language+'_id':job.pk})


def changed(kind, resource):
    """Only an opted-in resource is admitted, after its authoritative result commits."""
    def sync():
        try:
            ids = PreparedDisplayResource.objects.filter(kind=kind, resource_id=str(resource)).values_list('pk',flat=True)
            for pk in ids:
                refresh(pk)
        except Exception:
            logger.warning('Bilingual preparation deferred after result completion.')
    transaction.on_commit(sync)


def refresh(pk):
    with transaction.atomic():
        bundle = PreparedDisplayResource.objects.select_for_update().get(pk=pk)
        _sync(bundle)


def _retry(jobs):
    # A confirmed pre-submission failure backs off independently from a received invalid answer.
    with transaction.atomic():
        due = jobs.select_for_update().filter(state='failed', prepared_retry_at__lte=timezone.now()).order_by('prepared_retry_at')[:8]
        for job in due:
            used_paths = set(PreparedDisplayField.objects.filter(**{job.language:job}).values_list('path',flat=True))
            missing = localization._needs_translation(job)
            if not used_paths.intersection(missing):
                continue
            if job.prepared_retry_kind == 'correction':
                if job.prepared_retries:
                    continue
                job.prepared_retries += 1
            job.prepared_retry_kind, job.prepared_retry_at = '', None
            job.save(update_fields=['prepared_retries','prepared_retry_kind','prepared_retry_at'])
            localization.admit_fields(job.kind,job.resource_id,job.language,job.revision,job.fields,True,check_source=False)


def recover():
    recent = PreparedDisplayField.objects.filter(bundle__last_requested__gte=timezone.now()-timedelta(hours=2))
    enrolled = Q(pk__in=recent.values('en_id')) | Q(pk__in=recent.values('ko_id'))
    _retry(DisplayTranslation.objects.filter(enrolled))
    cutoff = timezone.now() - timedelta(minutes=2)
    for pk in PreparedDisplayResource.objects.filter(source_state='pending',last_checked__lt=cutoff).order_by('last_checked').values_list('pk',flat=True)[:8]:
        try:
            refresh(pk)
        except (localization.SourceUnavailable, ValueError):
            PreparedDisplayResource.objects.filter(pk=pk).update(source_state='failed',last_checked=timezone.now())


def page(kind, resource, revision='', cursor=''):
    kind, resource, _, revision, _, _ = localization._parse({'kind':kind,'resource_id':resource,'revision':revision,'language':'en','fields':{'probe':'probe'}})
    if cursor and not localization.FIELD_KEY.fullmatch(cursor):
        raise ValueError('invalid_cursor')
    bundle = PreparedDisplayResource.objects.filter(kind=kind,resource_id=resource,revision=revision).first()
    reply = {'kind':kind,'resource_id':resource,'revision':revision,'state':'absent','fields':{},'next_cursor':None}
    if bundle is None:
        return reply
    rows = bundle.wording
    selected = list(rows.filter(path__gt=cursor).order_by('path').prefetch_related('en','ko')[:PAGE_FIELDS+1])
    if len(selected) > PAGE_FIELDS:
        selected.pop()
        reply['next_cursor'] = selected[-1].path
    pending = ('queued','running')
    state = bundle.source_state
    retrying = Q(en__state='failed', en__prepared_retry_at__isnull=False) | Q(ko__state='failed', ko__prepared_retry_at__isnull=False)
    needs_renewal = False
    if rows.filter(Q(en__state__in=pending)|Q(ko__state__in=pending)).exists():
        state = 'pending'
    elif rows.filter(retrying).exists():
        needs_renewal = bundle.last_requested < timezone.now()-timedelta(hours=2)
        state = 'failed' if needs_renewal else 'pending'
    else:
        # A historical failed batch can supply only validated siblings to this profile.
        # Do not report a failure for a different field that this resource does not include.
        failed = rows.filter(Q(en__state='failed')|Q(ko__state='failed')).prefetch_related('en','ko')
        for field in failed.iterator(chunk_size=PAGE_FIELDS):
            if any(job and job.state == 'failed' and field.path in localization._needs_translation(job)
                   for job in (field.en,field.ko)):
                state = 'failed'
                break
    reply['state'], reply['terminal'], reply['terminal_fields'] = state, state == 'failed' and not needs_renewal, {'en':[], 'ko':[]}
    for row in selected:
        fields = {'source':row.source}
        for lang in LANGUAGES:
            job = getattr(row,lang)
            text = job.translations.get(row.path) if job else row.source
            if isinstance(text,str) and text.strip() and (job is None or (job.fields.get(row.path) == row.source
                    and not translator.display_issue(kind,row.path,row.source,text,lang,job.source_languages.get(row.path,'und')))):
                fields[lang] = text
            elif job and (job.state == 'completed' or (job.state == 'failed' and not job.prepared_retry_at)):
                reply['terminal_fields'][lang].append(row.path)
                if reply['state'] == 'completed':
                    reply['state'], reply['terminal'] = 'failed', True
        reply['fields'][row.path] = fields
    return reply
