# AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
# Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
"""Audience Q&A endpoints with synthetic slides, transcripts and provider responses.

Provider traffic goes through HTTPX MockTransport and the installed OpenAI SDK; Whisper is
replaced by a fake. These tests do not establish live model quality or account compatibility.
"""
import json
import os
from datetime import timedelta
from unittest.mock import patch

import httpx
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Deck, FeedbackQuotaBucket, Slide
from .services import feedback_provider
from .services.transcription import TranscriptionError
from .test_feedback_provider import FAKE_KEY, envelope

ENV = {'FEEDBACK_ENABLED': 'true', 'FEEDBACK_PROVIDER': 'openai', 'OPENAI_API_KEY': FAKE_KEY, 'GEMINI_API_KEY': FAKE_KEY,
       'FEEDBACK_OPENAI_PROJECT_ID': 'proj-synthetic', 'FEEDBACK_GEMINI_PROJECT_ID': 'gproj-synthetic',
       'FEEDBACK_OPENAI_RPM': '10', 'FEEDBACK_OPENAI_TPM': '100000', 'FEEDBACK_GEMINI_RPM': '10', 'FEEDBACK_GEMINI_TPM': '100000'}
QUESTIONS = {'questions': [
    {'panelist': 'P1', 'role': 'Methods reviewer', 'slide_index': 1, 'topic': 'Survey size', 'question': 'How many people answered?', 'follow_up': 'Was it random?'},
    {'panelist': 'P2', 'role': 'Industry panelist', 'slide_index': 7, 'topic': 'Cost', 'question': 'Out of range slide?', 'follow_up': 'Why?'},
]}
REVIEW = {'verdict': 'partly', 'did': 'Explained the reason.', 'evidence': 'No numbers were given.', 'clarify': 'Add the survey size.'}
WORDS = [{'text': w, 'start_ms': i * 300, 'end_ms': i * 300 + 250} for i, w in enumerate(
    'we asked forty students in two classes and most said feedback came too late to change the talk'.split())]


class AudienceQaTests(TestCase):
    def setUp(self):
        env = patch.dict(os.environ, ENV, clear=True)
        env.start()
        self.addCleanup(env.stop)
        network = patch('rehearsals.services.feedback_provider.httpx.HTTPTransport.handle_request',
                        side_effect=AssertionError('real network forbidden'))
        network.start()
        self.addCleanup(network.stop)
        self.client = APIClient()
        self.deck = Deck.objects.create(title='Synthetic talk', pdf='synthetic.pdf', page_count=2)
        Slide.objects.create(deck=self.deck, slide_index=0, image='s0.png', extracted_text='Problem: feedback arrives late')
        Slide.objects.create(deck=self.deck, slide_index=1, image='s1.png', extracted_text='Survey of 40 students')
        self.calls = []

    def provider(self, value=None, status=200, headers=None):
        real = feedback_provider.request_raw

        def handle(request):
            self.calls.append(request)
            if value is None:
                return httpx.Response(status, json={'error': {'message': 'synthetic'}}, headers=headers)
            return httpx.Response(status, json=envelope(os.environ['FEEDBACK_PROVIDER'], value), headers=headers)
        return patch.object(feedback_provider, 'request_raw', lambda prepared, _transport=None: real(prepared, _transport=httpx.MockTransport(handle)))

    def ask(self, body=None, deck=None):
        body = body or {'audience': 'Faculty panel', 'slides': [{'slide_index': 0, 'title': 'Problem', 'transcript': 'Feedback comes too late.'},
                                                                {'slide_index': 1, 'title': 'Survey', 'transcript': 'We asked students.'}]}
        return self.client.post(f'/api/decks/{deck or self.deck.id}/qa/questions/', data=json.dumps(body), content_type='application/json')

    def answer(self, metadata=None, name='answer.m4a', audio=True):
        metadata = metadata or {'question': 'How many?', 'main_question': 'How many?', 'part': 0, 'slide_index': 1, 'duration_ms': 42000}
        data = {'metadata': json.dumps(metadata)}
        if audio:
            data['audio'] = SimpleUploadedFile(name, b'synthetic audio', content_type='audio/mp4')
        return self.client.post(f'/api/decks/{self.deck.id}/qa/answers/', data=data, format='multipart')

    def test_questions_use_server_slide_text_and_keep_only_supplied_slides(self):
        with self.provider(QUESTIONS):
            response = self.ask()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual([q['slide_index'] for q in data['questions']], [1])
        self.assertEqual((data['provider'], data['model']), ('openai', 'gpt-6-luna'))
        self.assertEqual(len(self.calls), 1)
        sent = self.calls[0].content.decode()
        self.assertIn('Survey of 40 students', sent)
        self.assertIn('We asked students.', sent)
        self.assertNotIn(FAKE_KEY, response.content.decode())

    def test_gemini_selection_uses_the_same_endpoint(self):
        os.environ['FEEDBACK_PROVIDER'] = 'gemini'
        with self.provider(QUESTIONS):
            response = self.ask()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn('generativelanguage.googleapis.com', str(self.calls[0].url))

    def test_disabled_feedback_and_missing_quota_settings_are_configuration_errors(self):
        os.environ['FEEDBACK_ENABLED'] = 'false'
        with self.provider(QUESTIONS):
            response = self.ask()
        self.assertEqual((response.status_code, response.json()['error']['code']), (503, 'disabled'))
        os.environ['FEEDBACK_ENABLED'] = 'true'
        del os.environ['FEEDBACK_OPENAI_RPM']
        with self.provider(QUESTIONS):
            response = self.ask()
        self.assertEqual((response.status_code, response.json()['error']['code']), (503, 'quota_configuration'))
        self.assertEqual(self.calls, [])

    def test_unknown_deck_and_invalid_bodies(self):
        response = self.ask(deck='99999999-9999-4999-8999-999999999999')
        self.assertEqual((response.status_code, response.json()['error']['code']), (404, 'deck_not_found'))
        bad = [{'audience': '', 'slides': []}, {'audience': '', 'slides': [{'slide_index': 5, 'title': '', 'transcript': ''}]},
               {'audience': '', 'slides': [{'slide_index': 0, 'title': '', 'transcript': ''}], 'extra': 1}]
        with self.provider(QUESTIONS):
            for body in bad:
                response = self.ask(body)
                self.assertEqual((response.status_code, response.json()['error']['code']), (400, 'invalid_request'), body)
            response = self.client.post(f'/api/decks/{self.deck.id}/qa/questions/', data='audience=x', content_type='text/plain')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.calls, [])

    def test_invalid_model_output_is_rejected(self):
        with self.provider({'questions': [{'panelist': 'P1', 'question': 'Missing fields'}]}):
            response = self.ask()
        self.assertEqual((response.status_code, response.json()['error']['code']), (502, 'invalid_response'))

    def test_rate_limit_sets_a_cooldown_that_blocks_the_next_call(self):
        with self.provider(None, status=429, headers={'retry-after': '120'}):
            first = self.ask()
            second = self.ask()
        self.assertEqual((first.status_code, first.json()['error']['code']), (429, 'provider_rate_limit'))
        self.assertEqual((second.status_code, second.json()['error']['code']), (429, 'waiting_quota'))
        self.assertIn('retry_at', second.json()['error'])
        self.assertEqual(len(self.calls), 1)
        bucket = FeedbackQuotaBucket.objects.get(provider='openai', project_id='proj-synthetic', model='gpt-6-luna')
        self.assertGreater(bucket.blocked_until, timezone.now() + timedelta(seconds=60))

    def test_answer_is_transcribed_reviewed_and_not_kept(self):
        seen = []

        def fake(path):
            seen.append(path)
            self.assertTrue(path.exists())
            self.assertEqual(path.suffix, '.m4a')
            return {'text': ' '.join(w['text'] for w in WORDS), 'words': WORDS, 'raw_response': {'private': True}}
        with self.provider(REVIEW), patch('rehearsals.services.qa.transcription.transcribe', side_effect=fake):
            response = self.answer()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual(data['verdict'], 'partly')
        self.assertEqual(data['duration_ms'], 42000)
        self.assertEqual(len(data['transcript']['words']), len(WORDS))
        self.assertNotIn('raw_response', response.content.decode())
        self.assertFalse(seen[0].exists())
        self.assertIn('Survey of 40 students', self.calls[0].content.decode())

    def test_short_answer_skips_the_feedback_provider(self):
        short = {'text': 'yes it was', 'words': WORDS[:3], 'raw_response': {}}
        with self.provider(REVIEW), patch('rehearsals.services.qa.transcription.transcribe', return_value=short):
            response = self.answer()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['verdict'], 'too_short')
        self.assertEqual(self.calls, [])

    def test_answer_input_and_whisper_errors(self):
        with self.provider(REVIEW), patch('rehearsals.services.qa.transcription.transcribe', side_effect=AssertionError('not called')):
            self.assertEqual(self.answer(audio=False).status_code, 400)
            self.assertEqual(self.answer(name='answer.txt').json()['error']['code'], 'unsupported_audio')
            bad = {'question': 'Q', 'main_question': 'Q', 'part': 2, 'slide_index': 0, 'duration_ms': 1000}
            self.assertEqual(self.answer(bad).json()['error']['code'], 'invalid_request')
        missing = TranscriptionError('missing_api_key', 'OPENAI_API_KEY is not configured on the backend.')
        with self.provider(REVIEW), patch('rehearsals.services.qa.transcription.transcribe', side_effect=missing):
            response = self.answer()
        self.assertEqual((response.status_code, response.json()['error']['code']), (503, 'missing_api_key'))
        self.assertEqual(self.calls, [])
