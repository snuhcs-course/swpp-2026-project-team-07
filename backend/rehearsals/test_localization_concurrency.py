"""The database owns translation admission and claims across API/worker processes."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, get_ident
import os
import time
import uuid
from unittest import skipUnless
from unittest.mock import patch

from celery.contrib.testing.worker import start_worker
from django.db import connection, connections
from django.test import TransactionTestCase

from config.celery import app
from .models import DisplayTranslation
from .services import display_translator, localization
from .tasks import translate_display


@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL row locks required')
class TranslationConcurrencyTests(TransactionTestCase):
    def test_simultaneous_admission_worker_and_retry_share_one_snapshot(self):
        payload = {'kind': 'legacy_qa', 'resource_id': 'local-archive', 'language': 'ko',
                   'fields': {'questions.0.question': 'Why did you choose this example?'}}

        def race(operation):
            gate = Barrier(2)
            def on_connection():
                try:
                    gate.wait(timeout=10)
                    return operation()
                finally:
                    connections.close_all()
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(on_connection) for _ in range(2)]
                return [f.result(timeout=15) for f in futures]

        with patch.object(localization, '_configuration', return_value=(None, None)), \
                patch.object(localization, '_publish') as publish:
            first, second = race(lambda: localization.admit(payload))
            self.assertEqual(first.pk, second.pk)
            self.assertEqual(DisplayTranslation.objects.count(), 1)
            publish.assert_called_once_with(first.pk)
            with patch.object(display_translator, 'translate', side_effect=OSError('simulated lost response')) as failure:
                race(lambda: localization.run(first.pk))
                failure.assert_called_once()
            first, second = race(lambda: localization.admit({**payload, 'retry': True}))
            self.assertEqual(first.state, 'queued')
            self.assertEqual(second.state, 'queued')
            self.assertEqual(publish.call_count, 2)
            translated = {'questions.0.question': '이 예시를 선택한 이유가 무엇인가요?'}
            with patch.object(display_translator, 'translate', return_value=(translated, {'questions.0.question': 'en'})) as provider:
                race(lambda: localization.run(first.pk))
                provider.assert_called_once()
            self.assertEqual(localization.admit(payload).translations, translated)

    @skipUnless(os.environ.get('OUTLOUD_REDIS_INTEGRATION') == '1', 'requires the development Redis broker')
    def test_real_worker_and_broker_translate_on_first_read_only(self):
        queue = 'display-translation-test-' + uuid.uuid4().hex
        previous = {key: app.conf[key] for key in ('CELERY_TASK_ALWAYS_EAGER', 'CELERY_BROKER_URL')}
        app.conf.update(CELERY_TASK_ALWAYS_EAGER=False, CELERY_BROKER_URL=os.environ['CELERY_BROKER_URL'])
        payload = {'kind': 'legacy_qa', 'resource_id': 'local-worker-fixture', 'language': 'en',
                   'fields': {'q.0.follow_up': '이 방법에는 어떤 한계가 있나요?'}}
        rendered = {'q.0.follow_up': 'What limits does this method have?'}
        caller_thread = get_ident()
        def mock_provider(*args):
            self.assertNotEqual(get_ident(), caller_thread, 'provider must run on the broker worker')
            return rendered, {'q.0.follow_up': 'ko'}
        try:
            self.assertFalse(translate_display.app.conf.task_always_eager)
            with patch.object(localization, '_configuration', return_value=(None, None)), \
                    patch.object(display_translator, 'translate', side_effect=mock_provider) as provider, \
                    patch.object(translate_display, 'queue', queue, create=True), patch.object(translate_display, '_exec_options', None), \
                    start_worker(app, queues=[queue], pool='solo', perform_ping_check=False, shutdown_timeout=15):
                admitted = self.client.post('/api/localization/', payload, content_type='application/json')
                self.assertEqual(admitted.status_code, 202)
                status_url = '/api/localization/' + admitted.json()['id'] + '/'
                until = time.monotonic() + 15
                while self.client.get(status_url).status_code == 202 and time.monotonic() < until:
                    time.sleep(0.05)
                self.assertEqual(self.client.get(status_url).json()['translations'], rendered)
                cached = self.client.post('/api/localization/', payload, content_type='application/json')
                self.assertEqual((cached.status_code, cached.json()['translations']), (200, rendered))
                provider.assert_called_once()
        finally:
            app.conf.update(**previous)
