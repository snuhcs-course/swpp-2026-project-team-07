"""All inputs are invented; the provider is mocked. GET never admits any work."""
from copy import deepcopy
from unittest.mock import patch
import uuid

from django.test import TestCase
from django.utils import timezone

from .feedback_v3 import pipeline
from .models import (Attempt, CaptureAssessment, CaptureSession, Deck, DescriptionSet, DisplayTranslation,
                     FeedbackAnalysis, FeedbackJob, FeedbackRequest, FeedbackRun, PreparedDisplayResource, ProviderRequest, QaAnswer)
from .services import localization, prepared_display


class PreparedDisplayTests(TestCase):
    def setUp(self):
        self.deck = Deck.objects.create(title='Synthetic study seats', page_count=2)
        self.attempt = Attempt.objects.create(deck=self.deck, duration_ms=10000)
        self.profile = DescriptionSet.objects.create(deck=self.deck, source_snapshot={}, description_revision=1,
            descriptions={'slides':[{'slide_index':1,'must_cover':[{'text':'Compare both groups.'}]}]})
        self.run = FeedbackRun.objects.create(attempt=self.attempt, fingerprint='fixture', queued_at=timezone.now(),status='running')
        self.publish = patch.object(localization, '_publish').start()
        self.addCleanup(patch.stopall)
        self.card = {'headline':'Compare the two groups','explanation':['The comparison needs more context.'],
            'steps':['Name both groups.'],'example':'We observed both groups.', 'evidence':[{'text':'We observed one group.'}]}

    def enroll(self, kind, resource, **other):
        return self.client.post('/api/localization/prepared/', {'kind':kind,'resource_id':str(resource),**other},content_type='application/json')

    def read(self, kind, resource, **query):
        return self.client.get(f'/api/localization/prepared/{kind}/{resource}/',query).json()

    def finish(self, prefix='합성 번역'):
        def translator(kind, language, fields, config, selection):
            text={key:(prefix+'입니다.' if language=='ko' else source) for key,source in fields.items()}
            return text,dict.fromkeys(fields, 'en')
        with patch.object(localization, '_configuration',return_value=(None,None)), patch('rehearsals.services.display_translator.translate', side_effect=translator):
            for key in list(DisplayTranslation.objects.filter(state='queued').values_list('pk',flat=True)):
                localization.run(key)

    def job(self, kind, result, attempt=None, state='completed'):
        analysis = FeedbackAnalysis.objects.create(attempt=attempt or self.attempt,analysis_type=kind,feedback_revision=1)
        return FeedbackJob.objects.create(analysis=analysis,generation=1,description_set=self.profile,description_generation=1,
            source_snapshot={},state=state,queued_at=timezone.now(),result=result)

    def test_only_enrolled_new_normal_feedback_is_prepared_at_completion_and_reads_are_free(self):
        self.assertEqual(self.read('feedback',self.run.pk)['state'],'absent')
        raw = {'slides':{'1':{'status':'scored','score':72,'improvements':[self.card]}},
               'whole':{'status':'scored','top_priorities':[{'title':'Name the baseline.','why':'It matters for the comparison.','action':'Give the baseline.'}]}}
        with self.captureOnCommitCallbacks(execute=True):
            pipeline._save(self.run, result=deepcopy(raw))
        self.assertFalse(DisplayTranslation.objects.exists())
        self.run.result={}; self.run.save(update_fields=['result'])
        result = self.enroll('feedback',self.run.pk).json()
        self.assertEqual((result['state'],result['fields']),('pending',{}))
        with self.captureOnCommitCallbacks(execute=True):
            pipeline._save(self.run,status='completed',result=raw)
        self.assertTrue(self.publish.called)
        fields=self.read('feedback',self.run.pk)['fields']
        self.assertIn('slides.1.improvements.0.explanation.0',fields)
        self.assertNotIn(self.card['example'],[v['source'] for v in fields.values()])
        self.finish()
        before = (DisplayTranslation.objects.count(), self.publish.call_count)
        ready = self.read('feedback',self.run.pk)
        self.assertEqual(ready['state'],'completed')
        key='slides.1.improvements.0.steps.0'
        self.assertEqual(ready['fields'][key],{'source':'Name both groups.','en':'Name both groups.','ko':'합성 번역입니다.'})
        self.assertEqual(self.enroll('feedback',self.run.pk).json(),ready)
        self.assertEqual((DisplayTranslation.objects.count(),self.publish.call_count),before)
        self.run.refresh_from_db()
        self.assertEqual(self.run.result,raw)
        self.assertFalse(ProviderRequest.objects.exists())
        self.assertFalse(FeedbackJob.objects.exists())

    def test_capture_current_assessment_unique_question_job_and_immutable_answer_binding(self):
        cap=CaptureSession.objects.create(attempt=self.attempt,finalized=True)
        old=CaptureAssessment.objects.create(capture=cap,slide_index=1,input_hash='old',queued_at=timezone.now(),payload={},status='completed',result={'strength':{'text':'Former view only.'}})
        current=CaptureAssessment.objects.create(capture=cap,slide_index=1,input_hash='new',queued_at=timezone.now(),payload={},status='completed',result={'improvements':[self.card]})
        cap.desired={'1':{'assessment':current.pk,'input_hash':'new'}}
        cap.save(update_fields=['desired'])
        self.assertNotIn('Former view only.',[v['source'] for v in self.enroll('feedback',cap.pk).json()['fields'].values()])
        self.assertEqual(old.result['strength']['text'],'Former view only.')
        qs=self.job('qa_selected',{'questions':[{'id':'q0','question':'What is the baseline?','panelist':'P1'},
            {'id':'q1','question':'Why did the times differ?','follow_up':'What would you measure next?'}]})
        answer=Attempt.objects.create(deck=self.deck,duration_ms=10000)
        QaAnswer.objects.create(attempt=answer,question_job=qs,question_id='q1',part=1)
        self.job('qa_answer',{'answer':{'did':'You named the groups.','evidence':'Your timing was clear.','clarify':'Explain the timing.',
            'transcript':{'text':'My original answer.'},'verdict':'answered'}},answer)
        result=self.enroll('questions',qs.pk).json()
        self.assertIn('questions.1.follow_up',result['fields'])
        self.assertNotIn('questions.0.panelist',result['fields'])
        evaluated=self.enroll('answer',answer.pk).json()
        self.assertEqual(set(evaluated['fields']),{f'answers.1.1.{k}' for k in ('did','evidence','clarify')})

    def test_archived_slide_reviews_prepare_independently_as_each_selection_completes(self):
        path = 'slides.{}.findings.0.observation'
        source = ['The introduction names the comparison.', 'The conclusion explains the difference.']
        results = [{'slides': [{'slide_index': i, 'findings': [{'observation': text, 'speech_quote': 'Our exact words.'}]}]}
                   for i, text in enumerate(source)]
        first = self.job('review_first', results[0])
        second = self.job('review_second', None, state='queued')
        response = self.enroll('slide_review', self.attempt.pk).json()
        self.assertEqual(set(response['fields']), {path.format(0)})
        self.finish()
        ready = self.read('slide_review', self.attempt.pk)
        self.assertEqual(ready['state'], 'completed')
        self.assertEqual(ready['fields'][path.format(0)]['ko'], '합성 번역입니다.')

        second.result, second.state = results[1], 'completed'
        second.save(update_fields=['result', 'state'])
        with self.captureOnCommitCallbacks(execute=True):
            prepared_display.changed('slide_review', self.attempt.pk)
        self.finish()
        ready = self.read('slide_review', self.attempt.pk)
        self.assertEqual(ready['state'], 'completed')
        self.assertEqual({k: v['source'] for k, v in ready['fields'].items()},
                         {path.format(i): text for i, text in enumerate(source)})
        self.assertEqual(list(FeedbackJob.objects.order_by('pk').values_list('pk', 'result')),
                         [(first.pk, results[0]), (second.pk, results[1])])
        self.assertFalse(FeedbackRequest.objects.exists())
        self.assertFalse(ProviderRequest.objects.exists())

    def test_conflicting_review_and_score_contexts_leave_the_exact_wording_to_on_demand(self):
        texts = ['Explain how the groups were chosen.', 'Describe why the groups differ.']
        reviews = [{'slides': [{'slide_index': 0, 'findings': [{'suggestion': text}]}]} for text in texts]
        shared = 'Describe the sample size.'
        scores = [{'presentation_score': {'overall': {'score': grade}, 'slides': [{'justification': text, 'limitations': [shared],
                   'evidence': [{'text': 'My exact words.'}]}]}} for grade, text in zip((70, 83), texts)]
        for kind, prefix, path, results in (
                ('slide_review', 'review_', 'slides.0.findings.0.suggestion', reviews),
                ('score', 'score_', 'score.slides.0.justification', scores)):
            with self.subTest(kind=kind):
                self.job(prefix + 'first', results[0])
                self.enroll(kind, self.attempt.pk, revision='1')
                self.finish()
                self.assertIn(path, self.read(kind, self.attempt.pk, revision='1')['fields'])
                self.job(prefix + 'second', results[1])
                self.job(prefix + 'third', results[0])
                ready = self.enroll(kind, self.attempt.pk, revision='1').json()
                expected = {'score.slides.0.limitations.0': shared} if kind == 'score' else {}
                self.assertEqual(ready['state'], 'completed')
                self.assertEqual({k: v['source'] for k, v in ready['fields'].items()}, expected)
                explicit = self.enroll(kind, self.attempt.pk, revision='1', fields={path: texts[1]}).json()
                self.assertEqual(explicit, ready)
                self.assertEqual(self.enroll(kind, self.attempt.pk, revision='1', fields={path: 'Unrelated wording.'}).status_code, 409)

                ids = []
                with patch.object(localization, '_configuration', return_value=(None, None)):
                    for text in texts:
                        exact = self.client.post('/api/localization/', {'kind': kind, 'resource_id': str(self.attempt.pk),
                            'language': 'ko', 'revision': '1', 'fields': {path: text}}, content_type='application/json')
                        self.assertIn(exact.status_code, (200, 202))
                        ids.append(exact.json()['id'])
                        self.assertEqual(DisplayTranslation.objects.get(pk=ids[-1]).fields, {path: text})
                self.assertNotEqual(ids[0], ids[1])
                originals = FeedbackJob.objects.filter(analysis__analysis_type__startswith=prefix).order_by('pk')
                self.assertEqual(list(originals.values_list('result', flat=True)), [*results, results[0]])
        self.assertFalse(FeedbackRequest.objects.exists())
        self.assertFalse(ProviderRequest.objects.exists())

    def test_profiles_preserve_original_quotes_scope_revision_and_presaved_server_wording(self):
        source='Compare both groups.'
        saved=DisplayTranslation.objects.create(pk='d'*64,kind='profiles',resource_id=str(self.profile.pk),revision='1',language='ko',
            state='failed',fields={'slides.1.must_cover.0.text':source,'extra':'Extra phrase'},translations={'slides.1.must_cover.0.text':'두 집단을 비교하세요.'},source_languages={'slides.1.must_cover.0.text':'en'})
        result=self.enroll('profiles',self.profile.pk,revision='1').json()
        field=result['fields']['slides.1.must_cover.0.text']
        self.assertEqual(field['ko'],'두 집단을 비교하세요.')
        self.finish()
        self.assertEqual(self.read('profiles',self.profile.pk,revision='1')['state'],'completed')
        self.assertTrue(PreparedDisplayResource.objects.get().wording.filter(ko=saved).exists())
        self.assertEqual(self.enroll('profiles',self.profile.pk,revision='9').status_code,409)
        self.assertEqual(self.enroll('profiles',self.profile.pk,revision='1',fields={'slides.1.must_cover.0.text':'Unrelated prose.'}).status_code,409)
        self.assertEqual(self.enroll('feedback',uuid.uuid4()).status_code,409)
        self.assertEqual(self.enroll('feedback',self.run.pk,revision='fake').status_code,400)

    def test_phone_archive_additive_idempotent_bounded_pages_and_partially_valid_fields(self):
        scope='local/comparison'
        for i in range(2):
            fields={f'questions.{n}.question':f'What did group {n} measure?' for n in range(i*20,(i+1)*20)}
            self.assertIn(self.enroll('legacy_qa',scope,fields=fields).status_code,(200,202))
        before=DisplayTranslation.objects.count()
        self.enroll('legacy_qa',scope,fields=fields)
        self.assertEqual(DisplayTranslation.objects.count(),before)
        one=self.read('legacy_qa',scope)
        two=self.read('legacy_qa',scope,cursor=one['next_cursor'])
        self.assertEqual((len(one['fields']),len(two['fields']),two['next_cursor']),(32,8,None))
        self.assertFalse(one['fields'].keys() & two['fields'].keys())
        self.assertEqual(self.enroll('legacy_qa',scope,fields={'questions.0.transcript':'Private answer.'}).status_code,400)
        row=DisplayTranslation.objects.filter(language='ko').first()
        first,second=list(row.fields)[:2]
        # A known-invalid sibling never hides a validated field in the same batch.
        from .services.display_translator import PartialTranslationError
        source=row.fields[first]
        import re
        number=re.search(r'\d+',source).group()
        text='집단 '+number+'에서는 무엇을 측정했나요?'
        failure=PartialTranslationError('invalid_translation_numbers',{first:text},{first:'en'},[second])
        with patch.object(localization,'_configuration',return_value=(None,None)),patch('rehearsals.services.display_translator.translate',side_effect=failure):
            localization.run(row.pk)
        page={**self.read('legacy_qa',scope)['fields'], **self.read('legacy_qa',scope,cursor=one['next_cursor'])['fields']}
        self.assertEqual(page[first]['ko'],text)
        self.assertNotIn('ko',page[second])


    def test_known_rubric_is_offline_copy_and_custom_reasons_and_anchors_remain_translatable(self):
        from .feedback_v3.rubric import CURRENT
        fixed = CURRENT.slide[0]
        self.run.result = {'slides':{'0':{'status':'scored','criteria':[
            {'id':fixed.id,'level':'competent','label':fixed.label,'anchor':fixed.anchors[2],'reason':'The speaker gave one reason.'},
            {'id':'custom','label':'A custom criterion','anchor':'A custom level'}]}}}
        self.run.save(update_fields=['result'])
        fields = self.enroll('feedback',self.run.pk).json()['fields']
        self.assertEqual(set(fields),{'slides.0.criteria.0.reason','slides.0.criteria.1.label','slides.0.criteria.1.anchor'})

    def test_only_enrolled_known_failures_retry_in_background_once(self):
        from datetime import timedelta
        from .feedback_v3.llm import LLMError
        from .services.feedback import FeedbackError
        def fail(question, error):
            response = self.enroll('legacy_qa',question,fields={'questions.0.question':'What does the comparison show?'})
            self.assertIn(response.status_code,(200,202))
            row = DisplayTranslation.objects.get(resource_id=question,language='ko')
            with patch.object(localization,'_configuration',return_value=(None,None)), patch('rehearsals.services.display_translator.translate',side_effect=error):
                localization.run(row.pk)
            if error.code != 'timeout':
                DisplayTranslation.objects.filter(pk=row.pk).update(prepared_retry_at=timezone.now()-timedelta(minutes=1))
            return row
        safe = fail('safe',FeedbackError('invalid_translation_numbers'))
        uncertain = fail('lost',LLMError('timeout'))
        with self.captureOnCommitCallbacks(execute=True):
            prepared_display.recover()
        safe.refresh_from_db(); uncertain.refresh_from_db()
        self.assertEqual((safe.state,safe.prepared_retries),('queued',1))
        self.assertEqual((uncertain.state,uncertain.prepared_retries),('failed',0))
        DisplayTranslation.objects.filter(pk=safe.pk).update(state='failed',prepared_retry_kind='correction',prepared_retry_at=timezone.now()-timedelta(minutes=1))
        self.enroll('legacy_qa','safe',retry=True)
        safe.refresh_from_db()
        self.assertEqual((safe.state,safe.prepared_retries),('failed',1))

    def test_safe_rate_limit_outlasting_a_minute_recovers_without_manual_retry_or_a_second_grade(self):
        from datetime import timedelta
        from .feedback_v3.llm import LLMError
        field='questions.0.question'
        self.enroll('legacy_qa','rate-test',fields={field:'What does the comparison show?'})
        job=DisplayTranslation.objects.get(resource_id='rate-test',language='ko')
        start=timezone.now()
        for elapsed, delay in ((0,15),(15,30),(45,60)):
            with patch('django.utils.timezone.now',return_value=start+timedelta(seconds=elapsed)), \
                 patch.object(localization,'_configuration',return_value=(None,None)), \
                 patch('rehearsals.services.display_translator.translate',side_effect=LLMError('provider_rate_limit')):
                localization.run(job.pk)
                job.refresh_from_db()
                self.assertEqual((job.state,job.prepared_retry_kind,job.prepared_retries),('failed','transient',0))
                self.assertEqual(job.prepared_retry_at,start+timedelta(seconds=elapsed+delay))
                state=self.read('legacy_qa','rate-test')
                self.assertEqual(state['state'],'pending')
                self.assertFalse(state['terminal_fields']['ko'])
            with patch('django.utils.timezone.now',return_value=start+timedelta(seconds=elapsed+delay-1)):
                prepared_display.recover()
                job.refresh_from_db()
                self.assertEqual(job.state,'failed')
            with patch('django.utils.timezone.now',return_value=start+timedelta(seconds=elapsed+delay)):
                prepared_display.recover()
                job.refresh_from_db()
                self.assertEqual(job.state,'queued')
        self.finish()
        ready=self.read('legacy_qa','rate-test')
        self.assertEqual(ready['state'],'completed')
        self.assertEqual(ready['fields'][field]['ko'],'합성 번역입니다.')
        self.assertFalse(FeedbackJob.objects.exists())
        self.assertFalse(ProviderRequest.objects.exists())

    def test_lost_read_and_proven_connect_failure_have_different_automatic_recovery(self):
        import httpx
        from .feedback_v3 import llm
        for name, error, safe in [('lost-read',httpx.ReadTimeout('fixture'),False),('not-connected',httpx.ConnectError('fixture'),True)]:
            field='questions.0.question'
            self.enroll('legacy_qa',name,fields={field:'What does the comparison show?'})
            job=DisplayTranslation.objects.get(resource_id=name,language='ko')
            config=llm.Config('fixture','fixture', retries=0)
            with patch.object(localization,'_configuration',return_value=(config,None)), patch.object(httpx.Client,'post',side_effect=error):
                localization.run(job.pk)
            job.refresh_from_db()
            self.assertEqual(job.prepared_retry_kind,'transient' if safe else '')
            page=self.read('legacy_qa',name)
            self.assertEqual(field in page['terminal_fields']['ko'],not safe)
            self.assertEqual(page['state'],'pending' if safe else 'failed')
            self.assertEqual(page['terminal'],not safe)


    def test_preferred_language_is_enqueued_first_and_a_prepared_switch_is_free(self):
        raw={'slides':{'0':{'strength':{'text':'La ocupación cambió entre los turnos.'}}}}
        self.enroll('feedback',self.run.pk,preferred_language='ko')
        with self.captureOnCommitCallbacks(execute=True):
            pipeline._save(self.run,result=raw,status='completed')
        rows=[DisplayTranslation.objects.get(pk=call.args[0]).language for call in self.publish.call_args_list]
        self.assertEqual(rows,['ko','en'])
        self.publish.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            self.enroll('feedback',self.run.pk,preferred_language='en')
        self.publish.assert_not_called()
        self.assertEqual(self.enroll('feedback',self.run.pk,preferred_language='ja').status_code,400)

    def test_only_explicitly_confirmed_legacy_failure_field_and_language_is_requeued(self):
        fields={f'questions.{i}.question':v for i,v in enumerate(('What does the line mean?','What does the curve show?'))}
        self.enroll('legacy_qa','old',fields=fields,preferred_language='ko')
        old=DisplayTranslation.objects.get(resource_id='old',language='ko')
        DisplayTranslation.objects.filter(pk=old.pk).update(state='failed')
        self.enroll('legacy_qa','old',retry=True)
        old.refresh_from_db()
        self.assertEqual(old.state,'failed')
        key=next(iter(fields))
        response=self.enroll('legacy_qa','old',preferred_language='ko',confirmed_retry_fields=[key])
        self.assertEqual(response.status_code,202)
        new=DisplayTranslation.objects.get(resource_id='old',language='ko',state='queued')
        self.assertEqual(new.fields,{key:fields[key]})
        old.refresh_from_db()
        self.assertEqual(old.state,'failed')
        self.enroll('legacy_qa','old',preferred_language='ko',confirmed_retry_fields=[key])
        self.assertEqual(DisplayTranslation.objects.filter(language='ko',state='queued').count(),1)


    def test_retired_cue_format_has_no_displayable_fields_and_starts_no_work(self):
        self.profile.prompt_version='slide-profile-v1'
        self.profile.descriptions={'slides':[{'slide_index':1,'cues':[{'text':'A retired cue.'}]}]}
        self.profile.save(update_fields=['prompt_version','descriptions'])
        body=self.enroll('profiles',self.profile.pk,revision='1').json()
        self.assertEqual((body['state'],body['fields']),('completed',{}))
        self.assertFalse(DisplayTranslation.objects.exists())
