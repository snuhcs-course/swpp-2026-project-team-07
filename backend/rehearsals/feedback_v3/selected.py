"""Selected rehearsal speech in playback order, with original audio citations.

OpenAI Codex, 2026-11-23. See the Iteration 5 prompt log.
"""
from bisect import bisect_left
from dataclasses import replace
from uuid import UUID

from ..models import Attempt, QaAnswer
from ..services import audience_qa, corrections
from ..services.coaching import attempt_identity
from ..services.feedback import FeedbackError, validated
from . import transcript


def scope_sources(anchor, raw, *, lock=False):
    requested = validated(audience_qa.Scope, raw, 'invalid_request').model_dump(mode='json')
    try:
        for slide in requested['slides']:
            slide['attempt_id'] = str(UUID(slide['attempt_id']))
    except ValueError:
        raise FeedbackError('invalid_request') from None
    ids = {slide['attempt_id'] for slide in requested['slides']}
    if str(anchor.pk) != min(ids):
        raise FeedbackError('invalid_request')
    query = Attempt.objects.filter(pk__in=ids, deck_id=anchor.deck_id).order_by('pk')
    if lock:
        query = query.select_for_update()
    sources = {str(source.pk): source for source in query}
    if sources.keys() != ids:
        raise FeedbackError('invalid_request')
    if QaAnswer.objects.filter(attempt_id__in=ids).exists():
        raise FeedbackError('invalid_request')
    if any(source.status != Attempt.Status.COMPLETED or not isinstance(source.transcript, dict)
           for source in sources.values()):
        raise FeedbackError('transcript_not_ready')
    return audience_qa.scope_for(anchor, requested, sources=sources), sources


def compose(scope, sources):
    """Measurement timestamps follow the composed playback clock; citation times do not."""
    words_by_attempt, starts_by_attempt, identities = {}, {}, {}
    for source_id, source in sources.items():
        try:
            correction = corrections.snapshot(source)
        except FeedbackError:
            raise FeedbackError('invalid_transcript') from None
        if correction['source_changed']:
            raise FeedbackError('transcript_source_changed')
        words = source.transcript['words']
        starts = [word['start_ms'] for word in words]
        if starts != sorted(starts) or any(word['end_ms'] < word['start_ms'] for word in words):
            raise FeedbackError('invalid_transcript')
        starts_by_attempt[source_id] = starts
        # A recognition overlay that spans removed words cannot supply selected speech.
        included = set()
        for slide in scope['slides']:
            if slide['attempt_id'] == source_id:
                for segment in slide['segments']:
                    included.update(range(bisect_left(starts, segment['start_ms']),
                                          bisect_left(starts, segment['end_ms'])))
        edits = [edit for edit in correction['edits']
                 if all(i in included for i in range(edit['word_start'], edit['word_end'] + 1))]
        words_by_attempt[source_id] = transcript.effective_words(words, edits)
        identities[source_id] = [attempt_identity(source), correction['revision'], edits]

    words, events, origins = [], [], []
    duration_ms = 0
    # The canonical scope orders slides like Listen Back. Within each slide,
    # replay all visits in the order in which the source captured them.
    for slide in scope['slides']:
        source_id = slide['attempt_id']
        starts = starts_by_attempt[source_id]
        for segment in slide['segments']:
            start, end = segment['start_ms'], segment['end_ms']
            events.append({'slide_index': slide['slide_index'], 'at_ms': duration_ms})
            offset = duration_ms - start
            origins.append((source_id, offset))
            words.extend({'text': word.text, 'start_ms': word.start_ms + offset,
                          'end_ms': min(word.end_ms, end) + offset}
                         for word in words_by_attempt[source_id][bisect_left(starts, start):bisect_left(starts, end)])
            duration_ms += end - start
    speech = transcript.build(words, events, duration_ms, [])
    sentences = []
    for sentence in speech.sentences:
        source_id, offset = origins[sentence.visit]
        sentences.append(replace(sentence, start_ms=sentence.start_ms - offset,
                                 end_ms=sentence.end_ms - offset, attempt_id=source_id))
    speech.sentences = sentences
    by_id = speech.by_id()
    for slide in speech.slides.values():
        slide.sentences = [by_id[sentence.id] for sentence in slide.sentences]
    return speech, duration_ms, identities
