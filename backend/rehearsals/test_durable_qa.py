"""Phase 6 uses synthetic media/transcripts and mocked provider receipts only."""
import json
from unittest.mock import patch
from django.test import TestCase
from .test_coaching import SyntheticCoaching
from . import test_slide_review
from .models import FeedbackJob, PresentationContext
from .services import feedback_provider as provider

class DurableQaTests(SyntheticCoaching, TestCase):
    complete = test_slide_review.SlideReviewTests.complete
    def setUp(self):
        super().setUp()
        self.context = PresentationContext.objects.create(deck=self.deck, audience='14 year old middle school students')
        self.scope = {'context_id':str(self.context.pk), 'slides':[{'slide_index':0,'attempt_id':str(self.attempt.pk),
            'segments':[{'start_ms':0,'end_ms':1000},{'start_ms':1000,'end_ms':2000}]}]}
        self.url=f'/api/attempts/{self.attempt.pk}/audience-qa/'
    def submit_qa(self, **kw):
        return self.client.post(self.url, {'scope':self.scope, **kw}, content_type='application/json')
    def test_get_is_read_only_and_missing_audience_is_explicit(self):
        r=self.client.get(self.url,{'scope':json.dumps(self.scope)})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['state'],'absent')
        self.assertFalse(FeedbackJob.objects.exists())
        self.context.audience='';self.context.save()
        self.assertEqual(self.submit_qa().json()['error']['code'],'missing_audience')
    def test_duplicate_jobs_use_cached_profile_and_validate_question_identity(self):
        self.complete()
        self.assertEqual(self.submit_qa().status_code,202)
        self.assertEqual(self.submit_qa().json()['feedback_revision'],1)
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='qa_').analysis
        def receipt(p):
            body=json.loads(p.payload)
            self.assertIn('14 year old middle school students',str(body))
            return self.coaching_receipt(p,output={'questions':[{'panelist':'P1','role':'Student','slide_index':0,
                'topic':'Meaning','question':'What does it mean?','follow_up':'Can you give an example?'}]})
        with patch.object(provider,'request_raw',side_effect=receipt) as call:
            self.execute_feedback(owner);self.execute_feedback(owner)
        self.assertEqual(call.call_count,1)
        state=self.client.get(self.url,{'scope':json.dumps(self.scope)}).json()
        self.assertEqual(state['state'],'completed')
        self.assertEqual(len(state['result']['questions']),1)
        self.assertTrue(state['result']['questions'][0]['id'])
    def test_audience_changes_invalidate_without_admitting_jobs(self):
        self.complete();self.submit_qa()
        self.context.audience='Researchers';self.context.revision+=1;self.context.save()
        state=self.client.get(self.url,{'scope':json.dumps(self.scope)}).json()
        self.assertTrue(state['stale'])
        self.assertEqual(FeedbackJob.objects.count(),1)
        self.assertEqual(self.submit_qa(feedback_revision=1).status_code,202)
    def test_rejects_clipped_visit_and_different_deck(self):
        self.scope['slides'][0]['segments'][0]['end_ms']=999
        self.assertEqual(self.submit_qa().status_code,400)

    def test_panelist_name_limit_is_bounded_and_old_payload_schema_is_reconstructible(self):
        with patch.dict('os.environ',{'FEEDBACK_PROVIDER':'openai'}):
            from .services import coaching,qa
            from .services.feedback import validated,FeedbackError
            self.complete();self.submit_qa()
            job=FeedbackJob.objects.get(analysis__analysis_type__startswith='qa_')
            current=coaching._prepared(job.description_set,job)
            body=json.loads(current.payload)
            schema=body['text']['format']['schema'] if current.config.provider=='openai' else body['generationConfig']['responseJsonSchema']
            self.assertEqual(schema['$defs']['Question']['properties']['panelist']['maxLength'],64)
            job.source_snapshot['audience_qa'].pop('question_schema')
            historical=coaching._prepared(job.description_set,job)
            old=json.loads(historical.payload)
            schema=old['text']['format']['schema'] if historical.config.provider=='openai' else old['generationConfig']['responseJsonSchema']
            self.assertEqual(schema['$defs']['Question']['properties']['panelist']['maxLength'],8)
            job.input_hash=historical.input_hash
            self.assertEqual(coaching._prepared(job.description_set,job).input_hash,historical.input_hash)
            question={'panelist':'Professor Kim','role':'Student','slide_index':0,'topic':'Meaning','question':'What does it mean?','follow_up':'For example?'}
            self.assertEqual(validated(qa.Questions,{'questions':[question]}).questions[0].panelist,'Professor Kim')
            question['panelist']='x'*65
            with self.assertRaises(FeedbackError):validated(qa.Questions,{'questions':[question]})

    def completed_questions(self):
        self.complete();self.submit_qa()
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='qa_').analysis
        output={'questions':[{'panelist':'P1','role':'Student','slide_index':0,'topic':'Meaning','question':'What does it mean?','follow_up':'For example?'}]}
        with patch.object(provider,'request_raw',side_effect=lambda p:self.coaching_receipt(p,output=output)):self.execute_feedback(owner)
        return self.job(owner)

    def test_other_selected_source_correction_fences_late_question_result(self):
        from .models import TranscriptCorrection,Slide
        from .services import coaching,audience_qa
        other=self.new_attempt()
        # A second real slide uses a different source. Keep all visits for that source.
        Slide.objects.filter(deck=self.deck,slide_index=1).delete()
        self.deck.slides.create(slide_index=1,extracted_text='Second synthetic slide',image=self.deck.slides.first().image.name)
        self.deck.page_count=max(self.deck.page_count,2);self.deck.save()
        other.slide_events=[{'slide_index':1,'at_ms':0}]
        from .services.alignment import align_words
        other.visits=align_words(other.transcript['words'],other.slide_events,other.duration_ms);other.save()
        self.scope['slides'].append({'slide_index':1,'attempt_id':str(other.pk),'segments':[{'start_ms':0,'end_ms':2000}]})
        anchor=min(str(self.attempt.pk),str(other.pk));self.url=f'/api/attempts/{anchor}/audience-qa/'
        self.complete();self.assertEqual(self.submit_qa().status_code,202)
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='qa_').analysis
        value,job,prepared,request=self.submit_only(owner)
        TranscriptCorrection.objects.create(attempt=other,base_transcript_id=coaching.transcript_identity(other),revision=1,edits=[])
        receipt=self.coaching_receipt(prepared,output={'questions':[{'panelist':'P1','role':'Student','slide_index':0,'topic':'Meaning','question':'What?','follow_up':'Example?'}]})
        coaching.save_receipt(value,job,request,receipt)
        coaching.finish(value,job,result=audience_qa.normalize(prepared,receipt,job.source_snapshot))
        job.refresh_from_db();self.assertIsNone(job.result)
        state=self.client.get(self.url,{'scope':json.dumps(self.scope)}).json();self.assertTrue(state['stale'])
        self.assertEqual(FeedbackJob.objects.count(),1)

    def test_answer_binding_preserves_question_generation_and_duplicate_evaluation(self):
        from .models import QaAnswer
        from .services import audience_qa
        job=self.completed_questions();question=job.result['questions'][0]
        answer=self.new_attempt();answer.duration_ms=20000
        answer.transcript={'text':' '.join(['Echo']*16),'words':[{'text':'Echo','start_ms':i*1000,'end_ms':i*1000+500} for i in range(16)]}
        answer.slide_events=[{'slide_index':0,'at_ms':0}]
        from .services.alignment import align_words
        answer.visits=align_words(answer.transcript['words'],answer.slide_events,answer.duration_ms);answer.save()
        url=f'/api/attempts/{answer.pk}/qa-answer/'
        body={'question_job_id':job.pk,'question_id':question['id'],'part':0}
        self.assertEqual(self.client.get(url).status_code,404)
        self.assertEqual(self.client.post(url,body,content_type='application/json').status_code,200)
        self.client.post(url,body,content_type='application/json');audience_qa.recover_answers()
        self.assertEqual(QaAnswer.objects.count(),1)
        owner=answer.analyses.get(analysis_type='qa_answer')
        self.assertEqual(owner.jobs.count(),1)
        with patch.object(provider,'request_raw',side_effect=lambda p:self.coaching_receipt(p,output={'verdict':'answered','did':'Explained the idea.','evidence':'Gave a relevant example.','clarify':'Add a brief connection.'})) as call:
            self.execute_feedback(owner);self.execute_feedback(owner)
        self.assertEqual(call.call_count,1)
        result=self.client.get(url).json()['result'];self.assertEqual(result['verdict'],'answered')
        self.assertEqual(result['transcript'],answer.transcript)
        changed={**body,'part':1}
        self.assertEqual(self.client.post(url,changed,content_type='application/json').status_code,409)
        self.context.audience='Researchers';self.context.revision+=1;self.context.save()
        self.assertEqual(self.client.get(url).json()['result'],result)

    def test_answer_too_short_keeps_audio_without_feedback_job(self):
        from .models import QaAnswer
        job=self.completed_questions();q=job.result['questions'][0];a=self.new_attempt()
        a.slide_events=[{'slide_index':0,'at_ms':0}];a.save()
        r=self.client.post(f'/api/attempts/{a.pk}/qa-answer/',{'question_job_id':job.pk,'question_id':q['id'],'part':0},content_type='application/json')
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()['result']['verdict'],'too_short')
        self.assertEqual(a.analyses.count(),0);self.assertTrue(QaAnswer.objects.filter(attempt=a).exists())

    def test_client_revision_assertion_rejects_unsynchronized_inputs(self):
        self.complete()
        r=self.submit_qa(source_revisions={str(self.attempt.pk):3})
        self.assertEqual(r.status_code,409);self.assertFalse(FeedbackJob.objects.exists())

    def test_provider_invalid_slide_fails_without_fabricated_question(self):
        self.complete();self.submit_qa();owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='qa_').analysis
        with patch.object(provider,'request_raw',side_effect=lambda p:self.coaching_receipt(p,output={'questions':[{'panelist':'P1','role':'Student','slide_index':599,'topic':'Bad','question':'Invented?','follow_up':'Why?'}]})):
            self.execute_feedback(owner)
        self.assertEqual(self.client.get(self.url,{'scope':json.dumps(self.scope)}).json()['state'],'failed')

    def test_saved_receipt_recovers_without_second_provider_request(self):
        from .services import coaching
        self.complete();self.submit_qa();owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='qa_').analysis
        value,job,prepared,request=self.submit_only(owner)
        output={'questions':[{'panelist':'P1','role':'Student','slide_index':0,'topic':'Meaning','question':'What?','follow_up':'Example?'}]}
        coaching.save_receipt(value,job,request,self.coaching_receipt(prepared,output=output))
        self.expire(owner);coaching.recover_coaching()
        with patch.object(provider,'request_raw',side_effect=AssertionError('Receipt must be reused')):
            self.execute_feedback(owner)
        job.refresh_from_db();self.assertEqual(job.state,'completed');self.assertEqual(len(job.result['questions']),1)

    def test_analysis_version_change_requires_explicit_update(self):
        from .services import audience_qa
        job=self.completed_questions()
        with patch.object(audience_qa,'VERSION','audience-qa-v3-test'):
            state=self.client.get(self.url,{'scope':json.dumps(self.scope)}).json()
            self.assertTrue(state['stale']);self.assertTrue(state['result']['stale'])
            self.assertEqual(FeedbackJob.objects.count(),1)
            self.assertEqual(self.submit_qa(feedback_revision=job.generation).status_code,202)
            self.assertEqual(FeedbackJob.objects.count(),2)

from django.test import TransactionTestCase
from django.db import connection,connections
from unittest import skipUnless
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

@skipUnless(connection.vendor=='postgresql','PostgreSQL row locks required')
class QaConcurrencyTests(SyntheticCoaching,TransactionTestCase):
    complete=test_slide_review.SlideReviewTests.complete
    def test_concurrent_selected_run_admission_creates_one_generation(self):
        from .services import coaching,audience_qa
        self.complete();context=PresentationContext.objects.create(deck=self.deck,audience='Students')
        scope={'context_id':str(context.pk),'slides':[{'slide_index':0,'attempt_id':str(self.attempt.pk),'segments':[{'start_ms':0,'end_ms':1000},{'start_ms':1000,'end_ms':2000}]}]}
        kind=audience_qa.analysis_type(scope);barrier=Barrier(2)
        def admit():
            connections.close_all()
            try:barrier.wait(timeout=10);return coaching.generate(self.attempt.pk,{},kind,scope).pk
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:owners=list(pool.map(lambda _:admit(),range(2)))
        self.assertEqual(owners[0],owners[1]);self.assertEqual(FeedbackJob.objects.filter(analysis_id=owners[0]).count(),1)
