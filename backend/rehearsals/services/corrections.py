"""Saving overlays never schedules analysis. Original word indexes remain evidence."""
import re
from django.db import transaction
from ..models import Attempt, TranscriptCorrection
from .feedback import FeedbackError
from .descriptions import Conflict

ANALYSIS_VERSION = 'recognition-v2'
RECOGNITION_POLICY = 'recognition-only-v1'


def normalize(edits, transcript):
    words = transcript['words']
    if type(edits) is not list or len(edits) > 2000:
        raise FeedbackError('invalid_corrections')
    result = []
    for edit in edits:
        if type(edit) is not dict or set(edit) != {'word_start', 'word_end', 'text'}:
            raise FeedbackError('invalid_corrections')
        a, b, text = edit['word_start'], edit['word_end'], edit['text']
        if (type(a) is not int or type(b) is not int or not 0 <= a <= b < len(words)
                or type(text) is not str or not text.strip() or len(text) > 4000 or '\x00' in text):
            raise FeedbackError('invalid_corrections')
        # Punctuation/case are meaningful; normalize whitespace only.
        text = ' '.join(text.split())
        result.append({'word_start': a, 'word_end': b, 'text': text})
    result.sort(key=lambda e: e['word_start'])
    if any(a['word_end'] >= b['word_start'] for a, b in zip(result, result[1:])):
        raise FeedbackError('invalid_corrections')
    return [e for e in result if e['text'] != ' '.join(w['text'] for w in words[e['word_start']:e['word_end'] + 1])]


def effective_text(transcript, edits):
    # With no overlays preserve original punctuation and text exactly.
    if not edits:
        return transcript['text']
    words, parts, cursor = transcript['words'], [], 0
    spans = []
    for word in words:
        at = transcript['text'].find(word['text'].strip(), cursor)
        if at < 0:
            spans = []
            break
        cursor = at + len(word['text'].strip())
        spans.append((at, cursor))
    if spans:
        cursor = 0
        for edit in edits:
            start, end = spans[edit['word_start']][0], spans[edit['word_end']][1]
            parts.extend([transcript['text'][cursor:start], edit['text']])
            cursor = end
            # An accepted replacement can include closing punctuation; do not duplicate it.
            if edit['text'][-1:] in '.!?。！？' and transcript['text'][cursor:cursor + 1] == edit['text'][-1:]:
                cursor += 1
        parts.append(transcript['text'][cursor:])
        return ''.join(parts)
    cursor = 0
    for edit in edits:
        parts.extend(w['text'] for w in words[cursor:edit['word_start']])
        parts.append(edit['text'])
        cursor = edit['word_end'] + 1
    parts.extend(w['text'] for w in words[cursor:])
    return ' '.join(parts)


def _suggestion_jobs(attempt, base):
    from ..models import FeedbackJob
    return FeedbackJob.objects.filter(analysis__attempt=attempt,
        analysis__analysis_type='transcription_suggestions', state='completed',
        source_snapshot__transcript_id=base, result__isnull=False)


def _offered(job, edit):
    return any(s['word_start'] == edit['word_start'] and s['word_end'] == edit['word_end']
        and edit['text'] in [' '.join(r.split()) for r in s['replacements']]
        for s in job.result.get('suggestions', []))


def snapshot(attempt):
    from .coaching import transcript_identity
    base = transcript_identity(attempt)
    if not base:
        raise FeedbackError('missing_transcript')
    row = TranscriptCorrection.objects.filter(attempt=attempt).first()
    stale = bool(row and row.base_transcript_id != base)
    # Unreleased free-text overlays stay stored, but are not evidence of speech.
    jobs = {str(j.pk): j for j in _suggestion_jobs(attempt, base)} if row and not stale else {}
    edits = []
    for stored in row.edits if row and not stale else []:
        job = jobs.get(stored.get('suggestion_job_id'))
        if stored.get('recognition_policy') == RECOGNITION_POLICY and job and _offered(job, stored):
            edits.append({k: stored[k] for k in ('word_start', 'word_end', 'text')})
    return {'attempt_id': str(attempt.pk), 'base_transcript_id': base,
            'revision': row.revision if row else 0, 'edits': edits, 'source_changed': stale,
            'effective_text': effective_text(attempt.transcript, edits)}


def read(attempt_id):
    return snapshot(Attempt.objects.get(pk=attempt_id))


def save(attempt_id, payload):
    if (type(payload) is not dict or set(payload) != {'base_transcript_id', 'expected_revision', 'edits'}
            or type(payload['expected_revision']) is not int or not 0 <= payload['expected_revision'] < 2**31 - 1
            or type(payload['base_transcript_id']) is not str or not re.fullmatch('[a-f0-9]{64}', payload['base_transcript_id'])):
        raise FeedbackError('invalid_corrections')
    with transaction.atomic():
        attempt = Attempt.objects.select_for_update().get(pk=attempt_id)
        current = snapshot(attempt)
        if payload['base_transcript_id'] != current['base_transcript_id'] or current['source_changed']:
            raise Conflict('transcript_source_changed')
        if payload['expected_revision'] != current['revision']:
            raise Conflict('correction_conflict')
        edits = normalize(payload['edits'], attempt.transcript)
        if effective_text(attempt.transcript, edits) == current['effective_text']:
            return current
        added = [e for e in edits if e not in current['edits']]
        job = None
        if added:
            from django.db.models import F
            from . import coaching
            # Read-only validation under the attempt lock: no AI work on save.
            job = _suggestion_jobs(attempt, current['base_transcript_id']).filter(
                generation=F('analysis__feedback_revision'),
                source_snapshot__correction_analysis_version=ANALYSIS_VERSION).select_related('analysis', 'description_set').first()
            if (job is None or job.source_snapshot.get('transcript_revision') != current['revision']
                    or coaching._stale(job.description_set, job) or not coaching._source_current(job)
                    or any(not _offered(job, e) for e in added)):
                raise FeedbackError('invalid_corrections')
        row, _ = TranscriptCorrection.objects.get_or_create(attempt=attempt, defaults={
            'base_transcript_id': current['base_transcript_id']})
        saved = row.edits
        row.edits = [{**e, 'recognition_policy': RECOGNITION_POLICY, 'suggestion_job_id': str(job.pk) if e in added else next(
            old['suggestion_job_id'] for old in saved if all(old.get(k) == v for k, v in e.items()))} for e in edits]
        row.revision = row.revision + 1
        row.save(update_fields=['edits', 'revision', 'updated_at'])
        return snapshot(attempt)
