"""Incremental capture boundary, retry, ordering and provider-reuse checks."""
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO
import os
from pathlib import Path
import tempfile
import uuid
import wave
from threading import Barrier
from unittest import mock, skipUnless

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection, close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Attempt, CaptureSession, CaptureSegment, CaptureAssessment, Deck, Slide
from .services import incremental as inc, transcription
from .feedback_v3 import llm, pipeline, rubric

ENV = {'INCREMENTAL_CAPTURE_ENABLED': 'true', 'ELEVENLABS_API_KEY': 'test-key',
       'FEEDBACK_V3_ENABLED': 'true', 'OPENROUTER_API_KEY': 'test-key'}


def wav(duration, sample=b'\0\0'):
    file = BytesIO()
    with wave.open(file, 'wb') as out:
        out.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        out.writeframes(sample * (duration * 16))
    return SimpleUploadedFile('capture.wav', file.getvalue(), content_type='audio/wav')


def answer(kind, payload):
    criteria = rubric.CURRENT.whole if kind == 'whole' else rubric.CURRENT.slide
    data = {'criteria': {c.id: {'level': 'competent', 'reason': 'Clear enough', 'next_level': 'Add detail', 'evidence': []} for c in criteria},
            'improvements': [{'criterion': rubric.CURRENT.slide[0].id, 'problem': 'More detail', 'action': 'Explain the example', 'example': 'For example...', 'evidence': []}],
            'must_cover': [], 'top_priorities': [], 'summary': 'Complete talk'}
    return llm.Result(data, 10, 20, 0.1, 1)


class CaptureFixtures:
    def setUp(self):
        self.files = tempfile.TemporaryDirectory()
        self.addCleanup(self.files.cleanup)
        self.settings = override_settings(MEDIA_ROOT=self.files.name)
        self.settings.enable()
        self.addCleanup(self.settings.disable)
        self.deck = Deck.objects.create(title='Segments', pdf='synthetic.pdf', page_count=3)
        for i in range(3):
            Slide.objects.create(deck=self.deck, slide_index=i, image='synthetic.png',
                extracted_text='Each slide contains enough detail that it is graded including the first and last slides')
        self.id = uuid.uuid4()
        self.client = APIClient()
        self.published = mock.patch.object(inc, '_publish').start()
        self.addCleanup(mock.patch.stopall)
        self.scribe_calls = []
        self.model_calls = []
        mock.patch.object(inc, 'has_speech', return_value=True).start()
        @contextmanager
        def prepare(path):
            self.scribe_calls.append(str(path))
            yield type('Prepared', (), {'options': {}})()
        mock.patch.object(transcription, 'prepare_request', side_effect=prepare).start()
        self.raw = mock.patch.object(transcription, 'request_raw', return_value={
            'text': 'one two three four five six',
            'words': [{'type': 'word', 'text': w, 'start': i * .2, 'end': (i + 1) * .2}
                      for i, w in enumerate('one two three four five six'.split())]}).start()
        def model(http, config, kind, payload, deadline=None):
            self.model_calls.append((kind, payload.get('slide', {}).get('index')))
            return answer(kind, payload)
        mock.patch.object(pipeline, 'call_llm', side_effect=model).start()

    def manifest(self, indices, stopped=False, duration=None):
        # Each complete segment is a two-second visit, with final active slide index.
        segments = [{'sequence': i, 'slide_index': index, 'start_ms': i * 2000, 'end_ms': (i + 1) * 2000}
                    for i, index in enumerate(indices if stopped else indices[:-1])]
        events = [{'slide_index': index, 'at_ms': i * 2000} for i, index in enumerate(indices)]
        return {'deck_id': str(self.deck.pk), 'context_id': None, 'audience': '',
                'duration_ms': duration if duration is not None else len(segments) * 2000,
                'slide_events': events, 'segments': segments, 'stopped': stopped}

    def declare(self, indices, stopped=False, duration=None):
        response = self.client.post(f'/api/attempts/{self.id}/capture/', self.manifest(indices, stopped, duration), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def upload(self, index, duration=2000):
        response = self.client.post(f'/api/attempts/{self.id}/segments/{index}/', {'file': wav(duration)}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def process(self):
        for part in list(CaptureSegment.objects.filter(status='queued')):
            inc.transcribe_segment(part.pk)
        for job in list(CaptureAssessment.objects.filter(status='queued')):
            inc.assess_part(job.pk)

    def state(self):
        response = self.client.get(f'/api/attempts/{self.id}/capture/')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def full(self, duration):
        response = self.client.post(f'/api/attempts/{self.id}/capture/audio/', {'file': wav(duration)}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data


@mock.patch.dict(os.environ, ENV)
class IncrementalTests(CaptureFixtures, TestCase):
    def test_zero_clock_start_and_closed_slide_feedback_arrive_before_stop(self):
        started = self.declare([0])
        self.assertFalse(started['stopped'])
        self.assertEqual(started['segments'], [])
        self.declare([0, 1])
        self.upload(0)
        self.process()
        state = self.state()
        self.assertFalse(state['stopped'])
        self.assertFalse(state['finalized'])
        self.assertEqual(state['feedback']['slides'][0]['status'], 'scored')
        self.assertEqual(state['feedback']['slides'][1]['status'], 'pending')
        self.assertEqual(self.model_calls, [('slide', 0)])
        self.assertEqual(len(self.scribe_calls), 1)
        self.assertEqual(state['feedback']['whole']['status'], 'pending')

    def test_stop_assembles_speaking_order_and_reuses_slide_models(self):
        self.declare([0, 1]); self.upload(0); self.process()
        self.declare([0, 1, 2]); self.upload(1); self.process()
        self.declare([0, 1, 2], stopped=True); self.upload(2); self.process()
        self.assertFalse(self.state()['finalized'])  # Playback file still pending.
        self.full(6000); self.process()
        state = self.state()
        self.assertTrue(state['finalized'])
        self.assertEqual(self.model_calls, [('slide', 0), ('slide', 1), ('slide', 2), ('whole', None)])
        self.assertEqual(len(self.scribe_calls), 3)

        attempt = Attempt.objects.get(pk=self.id)
        self.assertEqual(attempt.status, 'completed')
        self.assertEqual([w['start_ms'] for w in attempt.transcript['words']][::6], [0, 2000, 4000])
        self.assertEqual([v['slide_index'] for v in attempt.visits], [0, 1, 2])
        self.assertTrue(Path(attempt.audio.path).is_file())
        self.full(6000); self.declare([0, 1, 2], stopped=True); self.process()
        self.assertEqual(len(self.scribe_calls), 3)
        self.assertEqual(len(self.model_calls), 4)
        detail = self.client.get(f'/api/attempts/{self.id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertIsNotNone(detail.data['transcript_id'])

    def test_revisit_preserves_prior_speech_and_invalidates_only_that_slide(self):
        self.declare([0, 1]); self.upload(0); self.process()
        self.declare([0, 1, 0]); self.upload(1); self.process()
        old = self.state()['feedback']['slides'][0]
        self.assertEqual(old['status'], 'pending')
        self.assertTrue(old['provisional'])
        self.assertTrue(old['criteria'])
        self.declare([0, 1, 0, 2]); self.upload(2)
        inc.transcribe_segment(CaptureSegment.objects.get(sequence=2).pk)
        pending = self.state()['feedback']['slides'][0]
        self.assertEqual(pending['status'], 'pending')
        self.assertTrue(pending['provisional'])
        self.assertEqual(pending['criteria'], old['criteria'])
        self.process()
        latest = self.state()['feedback']['slides'][0]
        self.assertEqual(latest['status'], 'scored')
        self.assertEqual(latest['measurements']['visits'], 2)
        self.assertEqual(latest['measurements']['words'], 12)
        self.assertEqual(self.model_calls.count(('slide', 0)), 2)
        self.assertEqual(self.model_calls.count(('slide', 1)), 1)
        self.assertEqual(CaptureSegment.objects.count(), 3)

    def test_missing_earlier_upload_prevents_premature_final_and_slide_assessment(self):
        self.declare([0, 1, 0, 2], stopped=True)
        for i in (2, 3, 1):
            self.upload(i)
        self.process(); self.full(8000); self.process()
        self.assertFalse(self.state()['finalized'])
        self.assertNotIn(('slide', 0), self.model_calls)
        self.assertNotIn(('whole', None), self.model_calls)
        self.upload(0); self.process()
        self.assertTrue(self.state()['finalized'])
        self.assertEqual(self.model_calls.count(('slide', 0)), 1)
        self.assertEqual(self.model_calls.count(('whole', None)), 1)
        self.assertEqual(Attempt.objects.get(pk=self.id).transcript['words'][12]['start_ms'], 4000)

    def test_idempotent_upload_and_conflicting_audio(self):
        self.declare([0, 1]); self.upload(0); self.process(); self.upload(0); self.process()
        self.assertEqual(len(self.scribe_calls), 1)
        changed = self.client.post(f'/api/attempts/{self.id}/segments/0/', {'file': wav(2000, b'\1\0')}, format='multipart')
        self.assertEqual(changed.status_code, 409)
        self.assertEqual(CaptureSegment.objects.get().status, 'completed')

    def test_old_manifest_never_rolls_back_later_visits_and_conflicts_fail(self):
        self.declare([0, 1, 0]); old = self.declare([0, 1])
        self.assertEqual(len(old['segments']), 2)
        conflict = self.client.post(f'/api/attempts/{self.id}/capture/', self.manifest([0, 2, 0]), format='json')
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(CaptureSession.objects.get().manifest['slide_events'][1]['slide_index'], 1)

    def test_active_chunk_is_not_final_until_slide_is_left_and_all_chunks_arrive(self):
        manifest = self.manifest([0, 1])
        manifest['segments'] = [{'sequence': 0, 'slide_index': 0, 'start_ms': 0, 'end_ms': 1000},
                                {'sequence': 1, 'slide_index': 0, 'start_ms': 1000, 'end_ms': 2000}]
        manifest['slide_events'] = [{'slide_index': 0, 'at_ms': 0}]
        self.client.post(f'/api/attempts/{self.id}/capture/', manifest, format='json')
        # Short chunk provider results fit this boundary.
        self.raw.return_value = {'text': 'one two three four five six', 'words': [
            {'type': 'word', 'text': w, 'start': i * .1, 'end': (i + 1) * .1} for i, w in enumerate('one two three four five six'.split())]}
        self.upload(0, 1000); self.process()
        self.assertEqual(self.model_calls, [])
        manifest['slide_events'].append({'slide_index': 1, 'at_ms': 2000})
        self.client.post(f'/api/attempts/{self.id}/capture/', manifest, format='json')
        self.assertEqual(self.model_calls, [])
        self.upload(1, 1000); self.process()
        self.assertEqual(self.model_calls, [('slide', 0)])

    def test_provider_timeout_requires_ack_and_never_retries_on_upload(self):
        self.declare([0, 1]); self.upload(0)
        self.raw.side_effect = transcription.TranscriptionError('provider_timeout', 'Unknown', uncertain=True)
        self.process(); self.upload(0); self.process()
        self.assertEqual(len(self.scribe_calls), 1)
        self.assertEqual(self.state()['segments'][0]['status'], 'uncertain')
        url = f'/api/attempts/{self.id}/segments/0/retry/'
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 409)
        self.raw.side_effect = None
        self.assertEqual(self.client.post(url, {'acknowledge_uncertain': True}, format='json').status_code, 200)
        self.process()
        self.assertEqual(len(self.scribe_calls), 2)
        self.assertEqual(CaptureSegment.objects.get().status, 'completed')
        self.assertEqual(len(CaptureSegment.objects.get().receipts), 2)

    def test_received_raw_survives_normalization_failure_without_second_call(self):
        self.declare([0, 1]); self.upload(0)
        with mock.patch.object(transcription, '_normalize', side_effect=RuntimeError('Transient local failure')):
            self.process()
        self.assertEqual(CaptureSegment.objects.get().status, 'failed')
        inc.retry_segment(self.id, 0); self.process()
        self.assertEqual(len(self.scribe_calls), 1)
        self.assertEqual(CaptureSegment.objects.get().status, 'completed')

    def test_invalid_received_timestamps_require_acknowledged_new_call(self):
        self.declare([0, 1]); self.upload(0)
        good = self.raw.return_value
        self.raw.return_value = {'text': 'bad', 'words': [{'type': 'word', 'text': 'bad', 'start': 0, 'end': 5}]}
        self.process()
        self.assertEqual(self.state()['segments'][0]['error']['code'], 'invalid_timing')
        self.assertTrue(self.state()['segments'][0]['requires_confirmation'])
        url = f'/api/attempts/{self.id}/segments/0/retry/'
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 409)
        self.raw.return_value = good
        self.assertEqual(self.client.post(url, {'acknowledge_uncertain': True}, format='json').status_code, 200)
        self.process()
        part = CaptureSegment.objects.get()
        self.assertEqual(part.status, 'completed')
        self.assertEqual([r['outcome'] for r in part.receipts], ['invalid', 'received'])
        self.assertEqual(len(self.scribe_calls), 2)

    def test_lost_worker_after_submission_requires_confirmation(self):
        self.declare([0, 1]); self.upload(0)
        part = CaptureSegment.objects.get()
        part.status = 'transcribing'; part.claim_token = uuid.uuid4()
        part.claimed_at = timezone.now() - timedelta(seconds=400)
        part.receipts = [{'outcome': 'submitted'}]
        part.save()
        inc.recover(); part.refresh_from_db()
        self.assertEqual(part.status, 'uncertain')
        self.process()
        self.assertEqual(self.scribe_calls, [])

    def test_full_transcription_endpoint_refuses_incremental_capture(self):
        self.declare([0, 1])
        response = self.client.post(f'/api/attempts/{self.id}/process/', {}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['error']['code'], 'incremental_capture')

    def test_validation_rejects_clock_gaps_cross_slide_wrong_duration_and_boolean_numbers(self):
        good = self.manifest([0, 1])
        for change in ['gap', 'cross', 'bool']:
            from copy import deepcopy
            data = deepcopy(good)
            if change == 'gap': data['segments'][0]['start_ms'] = 1
            if change == 'cross': data['slide_events'].insert(1, {'slide_index': 2, 'at_ms': 1000})
            if change == 'bool': data['duration_ms'] = True
            self.assertEqual(self.client.post(f'/api/attempts/{self.id}/capture/', data, format='json').status_code, 400)
        self.declare([0, 1])
        response = self.client.post(f'/api/attempts/{self.id}/segments/0/', {'file': wav(1900)}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(CaptureSegment.objects.get().status, 'awaiting_upload')

    def test_feedback_get_is_read_only_and_snapshot_timestamp_advances(self):
        self.declare([0, 1]); before = self.state()['feedback']['updated_at']
        self.upload(0); self.process()
        count = CaptureAssessment.objects.count()
        response = self.client.get(f'/api/attempts/{self.id}/feedback-run/')
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.data['updated_at'], before)
        self.assertEqual(CaptureAssessment.objects.count(), count)
        self.assertEqual(self.model_calls, [('slide', 0)])
        self.assertEqual(self.client.post(f'/api/attempts/{self.id}/feedback-run/', [], format='json').status_code, 400)

    def test_mismatched_full_audio_is_not_finalized_and_can_be_repaired(self):
        self.declare([0], stopped=True, duration=2000)
        # Build a valid single final visit; helper normally uses index count.
        self.upload(0); self.process()
        response = self.client.post(f'/api/attempts/{self.id}/capture/audio/', {'file': wav(2000, b'\1\0')}, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['finalized'])
        self.assertFalse(response.data['audio_uploaded'])
        self.assertEqual(response.data['error']['code'], 'audio_mismatch')
        self.assertNotIn(('whole', None), self.model_calls)
        self.full(2000); self.process()
        self.assertTrue(self.state()['finalized'])
        self.assertIsNone(self.state()['error'])
        self.assertEqual(len(self.scribe_calls), 1)

    def test_finished_settings_change_marks_feedback_outdated_without_auto_generation(self):
        from .models import PresentationContext
        context = PresentationContext.objects.create(deck=self.deck, audience='Students', required_duration_seconds=60)
        data = self.manifest([0, 1, 2], stopped=True)
        data['context_id'] = str(context.pk)
        self.assertEqual(self.client.post(f'/api/attempts/{self.id}/capture/', data, format='json').status_code, 200)
        for index in range(3): self.upload(index)
        self.process(); self.full(6000); self.process()
        self.assertFalse(self.state()['feedback']['outdated'])
        previous = len(self.model_calls)
        context.audience = 'Engineers'; context.revision += 1; context.save()
        self.assertTrue(self.state()['feedback']['outdated'])
        inc.recover(); self.process()
        self.assertEqual(len(self.model_calls), previous)
        response = self.client.post(f'/api/attempts/{self.id}/feedback-run/', {'context_id': str(context.pk)}, format='json')
        self.assertEqual(response.status_code, 200)
        self.process()
        self.assertFalse(self.state()['feedback']['outdated'])
        self.assertEqual(len(self.model_calls), previous + 4)
        self.assertEqual(len(self.scribe_calls), 3)

    def test_unvisited_final_zero_length_event_keeps_manifest_monotonic(self):
        self.declare([0, 1])
        data = self.manifest([0, 1]); data['stopped'] = True
        response = self.client.post(f'/api/attempts/{self.id}/capture/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['stopped'])
        self.upload(0); self.process(); self.full(2000); self.process()
        self.assertEqual(Attempt.objects.get(pk=self.id).slide_events, [{'slide_index': 0, 'at_ms': 0}])
        self.assertTrue(self.state()['finalized'])

    def test_recording_pins_settings_until_explicit_post_stop_update(self):
        from .models import PresentationContext
        context = PresentationContext.objects.create(deck=self.deck, audience='Students', required_duration_seconds=60)
        first = self.manifest([0, 1]); first['context_id'] = str(context.pk)
        inc.declare(self.id, first); self.upload(0); self.process()
        context.audience = 'Engineers'; context.revision += 1; context.save()
        final = self.manifest([0, 1, 2], stopped=True); final['context_id'] = str(context.pk)
        inc.declare(self.id, final); self.upload(1); self.upload(2); self.process(); self.full(6000); self.process()
        self.assertEqual(len(self.model_calls), 4)
        self.assertTrue(self.state()['feedback']['outdated'])
        self.assertEqual({p.payload['presentation']['audience'] for p in CaptureAssessment.objects.all()}, {'Students'})
        self.client.post(f'/api/attempts/{self.id}/feedback-run/', {}, format='json'); self.process()
        self.assertFalse(self.state()['feedback']['outdated'])
        self.assertEqual(len(self.model_calls), 8)
        self.assertEqual(len(self.scribe_calls), 3)

    def test_accepted_correction_only_regenerates_changed_slide_and_whole(self):
        self.declare([0, 1, 2], stopped=True)
        for index in range(3): self.upload(index)
        self.process(); self.full(6000); self.process()
        self.assertFalse(self.state()['feedback']['outdated'])
        edits = [{'word_start': 0, 'word_end': 0, 'text': 'corrected'}]
        with mock.patch.object(pipeline, '_accepted_edits', return_value=(edits, 1)):
            self.assertTrue(self.state()['feedback']['outdated'])
            inc.recover(); self.process()
            self.assertEqual(len(self.model_calls), 4)
            self.client.post(f'/api/attempts/{self.id}/feedback-run/', {}, format='json')
            self.process()
            self.assertFalse(self.state()['feedback']['outdated'])
            changed = CaptureAssessment.objects.filter(slide_index=0).order_by('-pk').first()
            self.assertIn('corrected', changed.payload['speech']['sentences'][0]['text'])
        self.assertEqual(self.model_calls.count(('slide', 0)), 2)
        self.assertEqual(self.model_calls.count(('slide', 1)), 1)
        self.assertEqual(self.model_calls.count(('slide', 2)), 1)
        self.assertEqual(self.model_calls.count(('whole', None)), 2)
        self.assertEqual(len(self.scribe_calls), 3)


@skipUnless(connection.vendor == 'postgresql', 'Requires real PostgreSQL row locks')
@mock.patch.dict(os.environ, ENV)
class IncrementalConcurrencyTests(CaptureFixtures, TransactionTestCase):
    def race(self, actions):
        barrier = Barrier(len(actions))
        def run(action):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                return action()
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=len(actions)) as pool:
            return list(pool.map(run, actions))

    def test_concurrent_first_manifests_preserve_latest_prefix(self):
        older, newer = self.manifest([0, 1]), self.manifest([0, 1, 2])
        self.race([lambda: inc.declare(self.id, older), lambda: inc.declare(self.id, newer)])
        self.assertEqual(CaptureSession.objects.count(), 1)
        self.assertEqual(CaptureSession.objects.get().manifest, {k: v for k, v in newer.items() if k in ('duration_ms', 'slide_events', 'segments', 'stopped')})
        self.assertEqual(CaptureSegment.objects.count(), 2)

    def test_duplicate_uploads_and_workers_make_one_provider_call(self):
        self.declare([0, 1])
        self.race([lambda: inc.upload_segment(self.id, 0, wav(2000)) for _ in range(2)])
        part = CaptureSegment.objects.get()
        self.race([lambda: inc.transcribe_segment(part.pk) for _ in range(2)])
        self.assertEqual(len(self.scribe_calls), 1)
        self.assertEqual(CaptureSegment.objects.get().status, 'completed')
        self.assertEqual(CaptureAssessment.objects.count(), 1)
        job = CaptureAssessment.objects.get()
        self.race([lambda: inc.assess_part(job.pk) for _ in range(2)])
        self.assertEqual(self.model_calls, [('slide', 0)])
