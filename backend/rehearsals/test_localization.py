"""Bilingual display contracts. All saved content and provider responses here are fixtures."""
from copy import deepcopy
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
import uuid

from django.test import TestCase
from django.utils import timezone

from .feedback_v3 import llm
from .models import (Attempt, CaptureAssessment, CaptureSession, Deck, DescriptionSet, DisplayTranslation,
                     FeedbackAnalysis, FeedbackJob, FeedbackRun, ProviderRequest)
from .services import display_translator, localization
from .services.feedback import FeedbackError


class TranslationTests(TestCase):
    def setUp(self):
        self.config = patch.object(localization, '_configuration', return_value=(llm.Config('test', 'test'), None))
        self.config.start()
        self.addCleanup(self.config.stop)
        publish = patch.object(localization, '_publish')
        self.published = publish.start()
        self.addCleanup(publish.stop)
        self.deck = Deck.objects.create(title='Synthetic comparison', page_count=1)
        self.attempt = Attempt.objects.create(deck=self.deck, duration_ms=1000)
        self.profiles = DescriptionSet.objects.create(deck=self.deck, source_snapshot={},
            descriptions={'slides': [{'must_cover': [{'text': 'Explain the change.', 'supporting_detail': 'Give a reason.'}]}]})
        self.source = {'slides': {'0': {'score': 72, 'strength': {'text': 'Tie the 2 groups together.',
            'evidence': [{'kind': 'speech', 'text': 'We saw two groups.'}]}, 'improvements': [{
            'action': 'Try saying: We compared the groups.', 'example': 'Our groups differ.'}]}}}
        self.run = FeedbackRun.objects.create(attempt=self.attempt, fingerprint='x', queued_at=timezone.now(), result=deepcopy(self.source))
        self.fields = {'slide.strength.text': 'Tie the 2 groups together.', 'slide.improvement.action': 'Try saying: We compared the groups.'}
        self.payload = {'kind': 'feedback', 'resource_id': str(self.run.pk), 'language': 'ko', 'fields': self.fields}

    def post(self, payload):
        return self.client.post('/api/localization/', payload, content_type='application/json')

    def job(self, analysis_type, result):
        analysis = FeedbackAnalysis.objects.create(attempt=self.attempt, analysis_type=analysis_type)
        return FeedbackJob.objects.create(analysis=analysis, generation=1, description_set=self.profiles,
            description_generation=1, source_snapshot={}, state='completed', queued_at=timezone.now(), result=result)

    def test_both_languages_cache_exact_source_and_only_translate(self):
        with self.captureOnCommitCallbacks(execute=True):
            pending = self.post(self.payload)
            duplicate = self.post({**self.payload, 'fields': dict(reversed(list(self.fields.items())))})
        self.assertEqual(pending.status_code, 202)
        key = pending.json()['id']
        self.assertEqual(key, duplicate.json()['id'])
        self.published.assert_called_once_with(key)
        url = f'/api/localization/{key}/'
        self.assertEqual(self.client.get(url).json()['state'], 'pending')
        def output(*args, **kwargs):
            self.assertEqual(kwargs['user']['fields']['slide.improvement.action'], 'Try saying: ⟦OL0⟧')
            self.assertEqual(kwargs['user']['fields']['slide.strength.text'], 'Tie the ⟦N0:2⟧ groups together.')
            self.assertNotIn('We saw two groups.', str(kwargs['user']))
            return SimpleNamespace(data={'translations': [
                {'key': 'slide.strength.text', 'source_language': 'en', 'text': '⟦N0:2⟧개 집단의 관계를 설명해 주세요.'},
                {'key': 'slide.improvement.action', 'source_language': 'en', 'text': '이렇게 말해 보세요. ⟦OL0⟧'}]})
        with patch.object(llm, 'complete_json', side_effect=output) as provider:
            localization.run(key)
            localization.run(key)
            with patch.object(localization, '_configuration', side_effect=AssertionError('cached reads need no provider')):
                completed = self.post(self.payload).json()
                self.assertEqual(self.client.get(url).json(), completed)
        provider.assert_called_once()
        self.assertEqual(completed['source_languages'], dict.fromkeys(self.fields, 'en'))
        self.assertEqual(completed['translations']['slide.improvement.action'], '이렇게 말해 보세요. We compared the groups.')
        self.assertEqual(completed['translations']['slide.strength.text'], '2개 집단의 관계를 설명해 주세요.')
        with self.captureOnCommitCallbacks(execute=True):
            english = self.post({**self.payload, 'language': 'en'}).json()
        self.assertNotEqual(english['id'], key)
        unchanged = {'translations': [{'key': k, 'source_language': 'en', 'text': None} for k in self.fields]}
        with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data=unchanged)):
            localization.run(english['id'])
        self.assertEqual(self.post({**self.payload, 'language': 'en'}).json()['translations'], self.fields)
        self.run.refresh_from_db()
        self.assertEqual(self.run.result, self.source)
        self.assertEqual(FeedbackRun.objects.count(), 1)
        self.assertFalse(FeedbackJob.objects.exists())
        self.assertFalse(ProviderRequest.objects.exists())

    def test_structured_coaching_admits_individual_saved_bullets_and_protects_speech(self):
        from .feedback_v3 import limits
        card = limits.coaching({'headline': 'Compare the counts', 'explanation': ['The first count is missing', 'The comparison is unclear'],
            'steps': ['Name both counts', 'Explain the change'], 'example': 'We counted seats twice.'}, 'en', explanation_items=2)
        card['evidence'] = [{'kind': 'speech', 'text': 'Original practice recording.'}]
        self.run.result = {'whole': {'top_priorities': [card]}}
        self.run.save(update_fields=['result'])
        capture = CaptureSession.objects.create(attempt=self.attempt)
        saved = CaptureAssessment.objects.create(capture=capture, slide_index=0, input_hash='s', payload={},
            queued_at=timezone.now(), result={'improvements': [card]})
        for resource, path in [(self.run.pk, 'whole.top_priorities.0'), (capture.pk, 'slides.0.improvements.0')]:
            with self.subTest(path=path):
                fields = {path+'.headline': card['headline'], path+'.problem': card['problem'], path+'.action': card['action']}
                for key in ('explanation', 'steps'):
                    fields.update({f'{path}.{key}.{i}': text for i, text in enumerate(card[key])})
                request = {**self.payload, 'resource_id': str(resource), 'fields': fields}
                self.assertEqual(self.post(request).status_code, 202)
                for protected in (card['example'], card['evidence'][0]['text'], card['headline'] + '!'):
                    self.assertEqual(self.post({**request, 'fields': {path+'.headline': protected}}).status_code, 409)
        saved.refresh_from_db()
        self.assertEqual(saved.result['improvements'], [card])
        self.assertFalse(ProviderRequest.objects.exists())

    def test_reads_status_version_and_admission_failures(self):
        self.assertEqual(self.client.get('/api/localization/' + '0' * 64 + '/').status_code, 404)
        self.assertEqual(DisplayTranslation.objects.count(), 0)
        for text in ('arbitrary text', 'Our groups differ.', 'We saw two groups.'):
            r = self.post({**self.payload, 'fields': {'text': text}})
            self.assertEqual(r.status_code, 409)
        for changes in ({'language': 'fr'}, {'fields': {}}, {'fields': {'x': 'a' * 4001}}, {'resource_id': 'bad'},
                        {'retry': 'true'}, {'raw_transcript': 'ignored?'}, {'fields': {'x': '\x00bad'}}):
            self.assertEqual(self.post({**self.payload, **changes}).status_code, 400)
        self.assertFalse(DisplayTranslation.objects.exists())
        before = self.post(self.payload).json()['id']
        after = self.post({**self.payload, 'revision': '2'}).json()['id']
        self.assertNotEqual(before, after)

    def test_saved_result_authority_for_all_formats_and_local_archive(self):
        question = self.job('qa_hash', {'questions': [{'question': 'Why now?', 'follow_up': 'How soon?', 'role': 'Student',
                                                        'panelist': 'City resident'}]})
        self.job('qa_answer', {'answer': {'evidence': 'You gave a reason.'}})
        self.job('review_hash', {'slides': [{'findings': [{'suggestion': 'Give a reason.'}]}]})
        self.job('score_hash', {'presentation_score': {'criteria': [{'limitations': ['More context is needed.']}],
            'private_audit': {'text': 'Private detail.'}}})
        self.job('coaching', {'suggestions': [{'observation': 'The comparison was clear.'}]})
        cap = CaptureSession.objects.create(attempt=self.attempt)
        CaptureAssessment.objects.create(capture=cap, slide_index=0, input_hash='x', payload={}, queued_at=timezone.now(),
                                         result={'improvements': [{'problem': 'Spoke quickly.'}]})
        for kind, ref, fields in [
            ('questions', question.pk, {'q.0.question': 'Why now?', 'q.0.follow_up': 'How soon?', 'q.0.panelist': 'City resident'}),
            ('answer', self.attempt.pk, {'evidence': 'You gave a reason.'}),
            ('profiles', self.profiles.pk, {'slide.0.detail': 'Give a reason.'}),
            ('feedback', cap.pk, {'slide.0.problem': 'Spoke quickly.'}),
            ('slide_review', self.attempt.pk, {'slide.0.suggestion': 'Give a reason.'}),
            ('score', self.attempt.pk, {'criteria.0.limitations.0': 'More context is needed.'}),
            ('coaching', self.attempt.pk, {'observation': 'The comparison was clear.'}),
            ('legacy_qa', 'local-run:archive-1', {'q.0.follow_up': 'How soon?', 'answer.0.clarify': 'Add a date.',
                                                   'q.0.panelist': 'Robin'}),
        ]:
            with self.subTest(kind=kind):
                response = self.post({'kind': kind, 'resource_id': str(ref), 'fields': fields, 'language': 'en'})
                self.assertEqual(response.status_code, 202)
        self.assertEqual(self.post({**self.payload, 'kind': 'legacy_qa', 'fields': {'q.0.audio': 'private'}}).status_code, 400)
        self.assertEqual(self.post({**self.payload, 'kind': 'score', 'resource_id': str(self.attempt.pk),
                                    'fields': {'criteria.0.text': 'Private detail.'}}).status_code, 409)

    def test_failure_requires_explicit_retry_and_late_workers_are_fenced(self):
        with self.captureOnCommitCallbacks(execute=True):
            key = self.post(self.payload).json()['id']
        with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data={'translations': []})) as provider:
            localization.run(key)
            self.assertEqual(self.post(self.payload).json()['state'], 'failed')
            localization.run(key)
            provider.assert_called_once()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post({**self.payload, 'retry': True}).json()['state'], 'pending')
        self.assertEqual(self.published.call_count, 2)
        def stale_worker(*args):
            DisplayTranslation.objects.filter(pk=key).update(updated_at=timezone.now() - timedelta(minutes=8))
            localization.recover()
            return {'unsafe': 'late'}, {'unsafe': 'en'}
        with patch.object(display_translator, 'translate', side_effect=stale_worker):
            localization.run(key)
        self.assertEqual(DisplayTranslation.objects.get().state, 'failed')
        self.assertEqual(DisplayTranslation.objects.get().translations, {})

    def conflicting_review_request(self):
        path = 'slides.0.findings.0.suggestion'
        originals = ('Explain the group selection.', 'Explain the comparison.')
        for i, text in enumerate(originals):
            self.job(f'review_context_{i}', {'slides': [{'slide_index': 0, 'findings': [{'suggestion': text}]}]})
        scope = {'kind': 'slide_review', 'resource_id': str(self.attempt.pk), 'revision': '1'}
        prepared = self.client.post('/api/localization/prepared/', scope, content_type='application/json').json()
        self.assertEqual((prepared['state'], prepared['fields']), ('completed', {}))
        return {**scope, 'language': 'ko', 'fields': {path: originals[0]}, 'retry': True}

    def test_enrolled_exact_requests_do_not_replay_uncertain_work_without_its_failed_id(self):
        request = self.conflicting_review_request()
        key = self.post(request).json()['id']
        start = timezone.now()
        with patch.object(llm, 'complete_json', side_effect=FeedbackError('lost_response', uncertain=True)) as provider:
            localization.run(key)
            states = []
            for seconds in (0, 2, 6, 60):
                with patch('django.utils.timezone.now', return_value=start + timedelta(seconds=seconds)):
                    states.append(self.post(request).json()['state'])
                    localization.run(key)
            self.assertEqual(provider.call_count, 1)
            self.assertEqual(states, ['failed'] * 4)
        for confirmation in (False, None, '0' * 64):
            self.assertEqual(self.post({**request, 'confirmed_retry_id': confirmation}).status_code, 400)
        self.assertEqual(self.post({**request, 'confirmed_retry_id': key, 'retry': False}).status_code, 400)
        self.assertEqual(DisplayTranslation.objects.get(pk=key).state, 'failed')
        confirmed = {**request, 'confirmed_retry_id': key}
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post(confirmed).json()['state'], 'pending')
            self.assertEqual(self.post(confirmed).json()['state'], 'pending')
        self.published.assert_called_once_with(key)
        field = next(iter(request['fields']))
        output = SimpleNamespace(data={'translations': [{'key': field, 'source_language': 'en', 'text': '집단 선정 기준을 설명하세요.'}]})
        with patch.object(llm, 'complete_json', return_value=output) as provider:
            localization.run(key)
            localization.run(key)
        provider.assert_called_once()
        self.assertEqual(self.post(request).json()['translations'], {field: '집단 선정 기준을 설명하세요.'})

    def test_enrolled_exact_retry_preserves_backoff_and_the_one_correction_limit(self):
        request = self.conflicting_review_request()
        key = self.post(request).json()['id']
        start = timezone.now()
        errors = [FeedbackError('provider_rate_limit'), FeedbackError('invalid_translation_numbers'),
                  FeedbackError('invalid_translation_numbers')]
        with patch.object(display_translator, 'translate', side_effect=errors) as provider:
            with patch('django.utils.timezone.now', return_value=start):
                localization.run(key)
            for seconds, expected in ((2, 'failed'), (14, 'failed'), (15, 'pending'), (20, 'failed'),
                                      (30, 'pending'), (60, 'failed'), (90, 'failed')):
                with patch('django.utils.timezone.now', return_value=start + timedelta(seconds=seconds)):
                    self.assertEqual(self.post(request).json()['state'], expected)
                    localization.run(key)
        self.assertEqual(provider.call_count, 3)
        row = DisplayTranslation.objects.get(pk=key)
        self.assertEqual((row.state, row.prepared_retries, row.prepared_retry_at), ('failed', 1, None))

    def test_provider_cannot_drop_quotes_or_change_numbers_or_misbind_fields(self):
        fields = {'did': 'On slide 3 you said “Why now?”', 'clarify': 'Explain the comparison.'}
        for output in (
            [{'key': 'did', 'text': '3번 슬라이드에서 말했어요.'}, {'key': 'clarify', 'text': None}],
            [{'key': 'did', 'text': '2번 슬라이드에서 ⟦OL0⟧'}, {'key': 'clarify', 'text': None}],
            [{'key': 'did', 'text': None}, {'key': 'did', 'text': None}],
        ):
            for item in output:
                item['source_language'] = 'en'
            with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data={'translations': output})):
                with self.assertRaisesRegex(FeedbackError, 'invalid_translation'):
                    display_translator.translate('answer', 'ko', fields, llm.Config('fixture', 'fixture'), None)

    def test_number_words_can_be_written_as_the_same_quantity_when_translated(self):
        check = display_translator._numbers_preserved
        self.assertTrue(check('Compare the two groups over a one-year period.', '두 집단을 1년간 비교하세요.'))
        self.assertTrue(check('Compare twenty-five streets.', '25개 거리를 비교하세요.'))
        self.assertTrue(check('두 집단을 한 해 동안 관찰하세요.', 'Observe 2 groups for 1 year.'))
        self.assertFalse(check('Compare the two groups for 3 years.', '2개 집단을 5년간 비교하세요.'))
        self.assertFalse(check('Compare the groups.', '12개 집단을 비교하세요.'))

    def test_singular_duration_may_be_a_digit_only_in_its_matching_unit(self):
        check = display_translator._numbers_preserved
        self.assertTrue(check('The library has a year-long membership.', '이 도서관은 1년 회원권을 제공합니다.'))
        self.assertTrue(check('The sculpture can stay on loan for a year.', '조각품은 1년 동안 대여할 수 있습니다.'))
        self.assertTrue(check('Counts were collected throughout the year.', '1년 동안 집계했습니다.'))
        self.assertTrue(check('We ordered a month-long pass and one ticket.', '1개월권과 표 1장을 주문했습니다.'))
        self.assertFalse(check('The library has a year-long membership.', '이 도서관은 2년 회원권을 제공합니다.'))
        self.assertFalse(check('A year-long loan.', '1개월간 대여.'))
        self.assertFalse(check('A year-long loan.', '연간 대출 1건.'))
        self.assertFalse(check('A year-long loan.', '1년과 추가 1년.'))

    def test_exact_numeric_markers_allow_reordering_and_refuse_replacement_or_loss(self):
        source = 'The lamp drew 13.7 watts against a 42-watt limit.'

        def check(output):
            response = {'translations': [{'key': 'text', 'text': output, 'source_language': 'en'}]}
            with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data=response)):
                return display_translator.translate('feedback', 'ko', {'text': source}, llm.Config('fixture', 'fixture'), None)

        masked, protected = display_translator._mask('At 0:32.5, the difference was -1.2%.', True)
        self.assertEqual(masked, 'At ⟦N0:0:32.5⟧, the difference was ⟦N1:-1.2%⟧.')
        self.assertEqual(protected, {'⟦N0:0:32.5⟧': '0:32.5', '⟦N1:-1.2%⟧': '-1.2%'})
        self.assertEqual(check('전력 상한은 ⟦N1:42⟧와트이고 측정값은 ⟦N0:13.7⟧와트였습니다.')[0]['text'],
                         '전력 상한은 42와트이고 측정값은 13.7와트였습니다.')
        for changed in ('전력 상한은 40와트이고 측정값은 ⟦N0:13.7⟧와트였습니다.', '전력 상한은 ⟦N1:42⟧와트입니다.',
                        '전력은 ⟦N0:13.7⟧, ⟦N0:13.7⟧, ⟦N1:42⟧와트였습니다.', '값은 ⟦N0:13.7⟧, ⟦N1:42⟧, 86와트였습니다.',
                        '값은 ⟦N0:13.7⟧, ⟦N1:42⟧, ⟦N2⟧와트였습니다.'):
            with self.assertRaisesRegex(FeedbackError, 'invalid_translation'):
                check(changed)

    def test_panelist_roles_are_translated_and_names_are_preserved(self):
        fields = {'q.0.panelist': 'City resident', 'q.1.panelist': 'Robin'}
        output = [{'key': 'q.0.panelist', 'source_language': 'en', 'text': '도시 주민'},
                  {'key': 'q.1.panelist', 'source_language': 'zxx', 'text': '로빈'}]
        with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data={'translations': output})):
            rendered, _ = display_translator.translate('questions', 'ko', fields, llm.Config('test', 'test'), None)
        self.assertEqual(rendered, {'q.0.panelist': '도시 주민', 'q.1.panelist': 'Robin'})

    def test_selected_locale_applies_to_mixed_prose_and_quoted_question_wrappers(self):
        fields = {'question': '“Why not 시장 B?”', 'follow_up': '¿Por qué ahora?'}
        def output(*args, **kwargs):
            self.assertIn('English', kwargs['system'])
            self.assertEqual(kwargs['user']['fields'], fields)
            return SimpleNamespace(data={'translations': [
                {'key': 'question', 'source_language': 'und', 'text': '“Why not market B?”'},
                {'key': 'follow_up', 'source_language': 'other', 'text': 'Why now?'}]})
        with patch.object(llm, 'complete_json', side_effect=output):
            actual, languages = display_translator.translate('questions', 'en', fields, llm.Config('fixture', 'fixture'), None)
        self.assertEqual(actual['question'], '“Why not market B?”')
        self.assertEqual(languages, {'question': 'und', 'follow_up': 'other'})

    def test_embedded_practice_lines_keep_contractions_and_only_the_spoken_sentence(self):
        for text, line in (
                ("Try saying 'Let's compare the two groups.' Give listeners time.", "'Let's compare the two groups.'"),
                ("Try saying ‘Let’s compare the two groups.’ Give listeners time.", "‘Let’s compare the two groups.’"),
                ("You could say We followed 2 groups. Give listeners time.", "We followed 2 groups.")):
            with self.subTest(text=text):
                masked, protected = display_translator._mask(text, True)
                self.assertIn('Give listeners time.', masked)
                self.assertNotIn(line, masked)
                self.assertEqual(list(protected.values()), [line])

    def test_per_field_source_languages_survive_cache_for_short_and_other_language_topics(self):
        fields = {'q.0.topic': 'Carbon cycle', 'q.1.topic': 'Cycle du carbone', 'q.2.topic': 'NASA'}
        payload = {'kind': 'legacy_qa', 'resource_id': 'short-topics', 'language': 'ko', 'fields': fields}
        key = self.post(payload).json()['id']
        output = [{'key': 'q.2.topic', 'source_language': 'und', 'text': None},
                  {'key': 'q.1.topic', 'source_language': 'other', 'text': '탄소 순환'},
                  {'key': 'q.0.topic', 'source_language': 'en', 'text': '탄소 순환'}]
        with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data={'translations': output})):
            localization.run(key)
        cached = self.post(payload).json()
        self.assertEqual(cached['state'], 'completed')
        self.assertEqual(cached['translations'], {'q.0.topic': '탄소 순환', 'q.1.topic': '탄소 순환', 'q.2.topic': 'NASA'})
        self.assertEqual(cached['source_languages'], {'q.0.topic': 'en', 'q.1.topic': 'other', 'q.2.topic': 'und'})
        # Databases upgraded from the first schema keep existing translations byte-for-byte.
        DisplayTranslation.objects.filter(pk=key).update(source_languages={})
        with patch.object(localization, '_configuration', side_effect=AssertionError('old cache must not regenerate')):
            old = self.post(payload).json()
        self.assertEqual((old['id'], old['translations'], old['source_languages']), (key, cached['translations'], {}))

    def test_obviously_wrong_language_fails_whole_batch_even_for_null_or_unreliable_source_label(self):
        for target, source, claim, text in (
                ('ko', 'Why did you compare the two groups?', 'en', None),
                ('ko', 'Why did you compare the two groups?', 'ko', None),
                ('ko', 'Can a bike lane lower street temperatures?', 'en', None),
                ('en', '결과를 어떻게 해석하나요?', 'ko', None),
                ('en', '두 집단의 결과는 비슷한가요?', 'und', '두 집단의 결과는 비슷한가요?'),
                ('ko', 'Cycle du carbone', 'other', 'Why is the carbon cycle important?')):
            with self.subTest(target=target, source=source, claim=claim):
                body = {'translations': [{'key': 'topic', 'source_language': 'und', 'text': None},
                                         {'key': 'question', 'source_language': claim, 'text': text}]}
                def repeat_invalid(*args, **kwargs):
                    return SimpleNamespace(data={'translations': [item for item in body['translations']
                        if item['key'] in kwargs['user']['fields']]})
                with patch.object(llm, 'complete_json', side_effect=repeat_invalid) as provider:
                    with self.assertRaisesRegex(FeedbackError, 'wrong_display_language'):
                        display_translator.translate('questions', target, {'topic': 'CO₂', 'question': source},
                                                     llm.Config('fixture', 'fixture'), None)
                self.assertEqual(provider.call_count, 2)
                self.assertEqual(set(provider.call_args.kwargs['user']['fields']), {'question'})

    def test_valid_reply_in_wrong_third_language_gets_one_targeted_repair(self):
        fields = {'point': 'Explain the example.', 'problem': 'You say that the late count is lower.'}
        def item(key, text):
            return {'key': key, 'source_language': 'en', 'text': text}
        wrong = 'Sie sagen, dass der späte Zählwert niedriger ist.'
        right = '늦은 시간의 집계 수치가 더 낮다고 말씀하셨어요.'
        responses = [SimpleNamespace(data={'translations': [item('point', '예시를 설명하세요.'), item('problem', wrong)]}),
                     SimpleNamespace(data={'translations': [item('problem', right)]})]
        with patch.object(llm, 'complete_json', side_effect=responses) as provider:
            output, _ = display_translator.translate('feedback', 'ko', fields, llm.Config('fixture', 'fixture'), None)
        self.assertEqual(output, {'point': '예시를 설명하세요.', 'problem': right})
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(provider.call_args.kwargs['user']['fields'], {'problem': fields['problem']})
        self.assertIn('Korean', provider.call_args.kwargs['system'])
        with patch.object(llm, 'complete_json', side_effect=llm.LLMError('provider_timeout')) as lost:
            with self.assertRaises(llm.LLMError):
                display_translator.translate('feedback', 'ko', fields, llm.Config('fixture', 'fixture'), None)
        lost.assert_called_once()

    def test_foreign_prose_is_rejected_but_original_names_and_speech_remain_valid(self):
        wrong = display_translator.display_issue
        for language in ('ko', 'en'):
            with self.subTest(language=language):
                self.assertTrue(wrong('feedback', 'action', '집계가 어떻게 변했는지 설명하세요.',
                                      'Sagen Sie, dass der Vergleich den Rückgang zeigt.', language))
                self.assertFalse(wrong('feedback', 'action', '“Sie sagen, dass der Wert steigt.”',
                                       '“Sie sagen, dass der Wert steigt.”', language))
                self.assertFalse(wrong('questions', 'q.0.panelist', 'Robin van Dijk', 'Robin van Dijk', language, 'zxx'))
                self.assertFalse(wrong('questions', 'topic', 'NASA / CO₂', 'NASA / CO₂', language))
        self.assertFalse(wrong('feedback', 'action', 'Use the label “Sie sagen, dass der Wert steigt.”',
                               '“Sie sagen, dass der Wert steigt.”라는 표현을 사용하세요.', 'ko'))
        self.assertTrue(wrong('feedback', 'action', 'Compare the result with the previous count.',
                              '수치를 비교하세요. Sie sagen, dass der Wert steigt.', 'ko'))
        self.assertTrue(wrong('feedback', 'action', 'Compare the results in Seoul.',
                              'Sie sagen, dass der Wert in 서울 steigt.', 'ko'))
        self.assertFalse(wrong('answer', 'did', '측정치를 비교했어요.', 'You compared the measurements.', 'en'))

    def test_clock_qualifiers_follow_the_correct_hour_in_both_directions(self):
        check = display_translator._preserves_daypart
        for source, rendered in [
            ('Compare occupancy at 7 and 8 p.m. over four weeks.', '4주 동안 오후 7시와 8시의 이용률을 비교하세요.'),
            ('Compare the 7 p.m. and 8 p.m. counts.', '저녁 7시와 8시의 집계치를 비교하세요.'),
            ('Compare the 7 p.m. and 8 p.m. counts.', '19:00 및 20:00 집계치를 비교하세요.'),
            ('오전 7시 15분과 오후 8시를 비교하세요.', 'Compare 7:15 a.m. with 8 p.m.'),
            ('오전 7시 15분과 오후 8시를 비교하세요.', 'Compare 07:15 and 20:00.'),
            ('오전 12시와 오후 12시', 'midnight and noon'),
            ('at 7 a.m.', '아침 7시'), ('at 8 p.m.', '밤 8시'), ('12 a.m.', '밤 12시'),
        ]:
            with self.subTest(source=source, rendered=rendered): self.assertTrue(check(source, rendered))
        for source, rendered in [
            ('At 7 and 8 p.m.', '7시와 8시'), ('At 7 and 8 p.m.', '오전 7시와 오후 8시'),
            ('At 7 and 8 p.m.', '19:00 및 19:30'), ('오전 7시와 오후 8시', '7 p.m. and 8 a.m.'),
            ('오후 8시', '8:00'), ('8 a.m.', '08:00 p.m.'), ('At 7:15 p.m.', '19:45'),
        ]:
            with self.subTest(source=source, rendered=rendered): self.assertFalse(check(source, rendered))
        # An exact quoted clock cannot satisfy a separate missing evening qualifier in the coaching.
        self.assertEqual(display_translator.display_issue('feedback', 'action', 'At 8 p.m. say “8 p.m.”',
                          '8시에 “8 p.m.”라고 말하세요.', 'ko'), 'invalid_translation_clock')

    def test_missing_evening_in_an_old_completed_field_repairs_through_the_same_cache_key(self):
        fields = {'q.0.question': 'Compare attendance at 7 and 8 p.m.'}
        body = {'kind': 'legacy_qa', 'resource_id': 'synthetic-clocks', 'fields': fields, 'language': 'ko'}
        key = self.post(body).json()['id']
        DisplayTranslation.objects.filter(pk=key).update(state='completed', source_languages={'q.0.question':'en'},
            translations={'q.0.question':'7시와 8시의 참석 인원을 비교하세요.'})
        url = '/api/localization/' + key + '/'
        self.assertEqual(self.client.get(url).json()['state'], 'failed')
        self.assertEqual(self.post(body).json()['id'], key)
        def reply(text):
            return SimpleNamespace(data={'translations':[{'key':'q.0.question','source_language':'en','text':text}]})
        replies = [reply('⟦N0:7⟧시와 ⟦N1:8⟧시의 참석 인원을 비교하세요.'),
                   reply('오후 ⟦N0:7⟧시와 ⟦N1:8⟧시의 참석 인원을 비교하세요.')]
        with patch.object(llm, 'complete_json', side_effect=replies) as provider:
            localization.run(key)
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(self.client.get(url).json()['translations']['q.0.question'], '오후 7시와 8시의 참석 인원을 비교하세요.')

    def test_wrong_completed_cache_is_hidden_and_only_invalid_fields_are_replaced(self):
        fields = {'q.0.question': 'How does the late count compare?', 'q.0.follow_up': 'Which day?'}
        payload = {'kind': 'legacy_qa', 'resource_id': 'synthetic-old-third-language', 'fields': fields, 'language': 'ko'}
        key = self.post(payload).json()['id']
        clean = '어느 날인가요?'
        DisplayTranslation.objects.filter(pk=key).update(state='completed', translations={
            'q.0.question': 'Wie hat sich der spätere Zählwert verändert?', 'q.0.follow_up': clean},
            source_languages={k: 'en' for k in fields})
        url = '/api/localization/' + key + '/'
        self.published.reset_mock()
        response = self.client.get(url).json()
        self.assertEqual((response['state'], response['translations']), ('failed', {}))
        self.published.assert_not_called()
        self.assertEqual(DisplayTranslation.objects.get(pk=key).state, 'completed')
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post(payload).json()['state'], 'pending')
            self.assertEqual(self.post(payload).json()['state'], 'pending')
        self.published.assert_called_once_with(key)
        fixed = '늦은 시간의 집계 결과는 어떻게 다른가요?'
        with patch.object(display_translator, 'translate', return_value=({'q.0.question': fixed}, {'q.0.question': 'en'})) as provider:
            localization.run(key)
        self.assertEqual(provider.call_args.args[2], {'q.0.question': fields['q.0.question']})
        final = self.client.get(url).json()
        self.assertEqual((final['state'], final['id'], final['translations']),
                         ('completed', key, {'q.0.question': fixed, 'q.0.follow_up': clean}))

    def test_source_locale_returns_exact_words_and_technical_names_can_pass_through(self):
        fields = {'topic': 'Carbon cycle', 'title': 'The Lord of the Rings', 'did': 'You said “어떤 결과인가요?”'}
        body = {'translations': [{'key': 'topic', 'source_language': 'en', 'text': 'The carbon cycle'},
                                 {'key': 'title', 'source_language': 'und', 'text': None},
                                 {'key': 'did', 'source_language': 'en', 'text': None}]}
        with patch.object(llm, 'complete_json', return_value=SimpleNamespace(data=body)):
            actual, languages = display_translator.translate('answer', 'en', fields, llm.Config('fixture', 'fixture'), None)
        self.assertEqual(actual, fields)
        self.assertEqual(languages, {'topic': 'en', 'title': 'und', 'did': 'en'})
