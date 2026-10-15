"""Phase 5 contracts; all media/provider evidence is synthetic."""
import json
from django.test import TestCase
from unittest.mock import patch
from .test_coaching import SyntheticCoaching
from .models import FeedbackJob, PresentationContext
from .services import feedback_provider as provider

class SlideReviewTests(SyntheticCoaching, TestCase):
    def setUp(self):
        super().setUp()
        self.url = f'/api/attempts/{self.attempt.pk}/slide-review/'
        self.scope = {'context_id': None, 'slides': [{'slide_index': 0, 'segments': [
            {'start_ms': 0, 'end_ms': 1000}, {'start_ms': 1000, 'end_ms': 2000}]}]}
    def coaching_receipt(self, prepared, **kw):
        value = kw.get('output')
        if value and 'slides' in value and prepared.stage != 'descriptions':
            value.setdefault('evaluation_mode', 'informative_descriptive')
            for slide in value['slides']: slide.setdefault('enrichments', [])
        return super().coaching_receipt(prepared, **kw)
    def complete(self):
        from .services import slide_profiles, descriptions
        from .test_descriptions import description_value
        value = slide_profiles.ensure(self.deck.pk)
        def receipt(p):
            output = description_value(p.analysis)
            for slide in output['slides']:
                slide.update(slide_kind='content', must_cover=[], go_deeper=[])
            return self.coaching_receipt(p, output=output)
        with patch.object(provider, 'request_raw', side_effect=receipt):
            descriptions.run_description(value.pk, value.processing_revision)
        value.refresh_from_db()
        self.assertEqual(value.description_revision, 1)
        return value
    def submit_review(self, **payload):
        return self.client.post(self.url, {'scope': self.scope, **payload}, content_type='application/json')
    def test_scope_validation_and_read_never_admits(self):
        r = self.client.get(self.url, {'scope': json.dumps(self.scope)})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['state'], 'absent')
        self.assertFalse(FeedbackJob.objects.exists())
        self.scope['slides'][0]['segments'][0]['end_ms'] = 999
        self.assertEqual(self.submit_review().status_code, 400)
    def test_dedup_empty_success_and_missing_requirements(self):
        self.complete()
        a = self.submit_review(); self.assertEqual(a.status_code, 202)
        rev = a.json()['feedback_revision']
        self.assertEqual(self.submit_review().json()['feedback_revision'], rev)
        owner = FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            return self.coaching_receipt(p, output={'slides': [{'slide_index': 0, 'status': 'successful', 'findings': []}]})
        with patch.object(provider, 'request_raw', side_effect=receipt) as call:
            self.execute_feedback(owner); self.execute_feedback(owner)
        self.assertEqual(call.call_count, 1)
        state = self.submit_review().json()
        self.assertEqual(state['state'], 'completed')
        self.assertEqual(state['result']['slides'][0]['status'], 'successful')
        self.assertEqual(state['requirements']['audience'], '')
        self.assertIsNone(state['requirements']['required_duration_seconds'])
    def test_context_change_invalidates_without_new_jobs(self):
        context = PresentationContext.objects.create(deck=self.deck, audience='Researchers', required_duration_seconds=120)
        self.scope['context_id'] = str(context.pk)
        self.complete(); self.assertEqual(self.submit_review().status_code, 202)
        context.audience = 'Schoolchildren'; context.revision += 1; context.save()
        state = self.client.get(self.url, {'scope': json.dumps(self.scope)}).json()
        self.assertTrue(state['stale'])
        self.assertEqual(FeedbackJob.objects.filter(analysis__analysis_type__startswith='review_').count(), 1)
        r = self.submit_review(feedback_revision=state['feedback_revision'])
        self.assertEqual(r.status_code, 202)
        self.assertEqual(r.json()['requirements']['audience'], 'Schoolchildren')
    def test_unsupported_output_cannot_be_success(self):
        self.complete(); self.submit_review()
        owner = FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            card = self.card(p); card.update(category='content', priority=1, speech_quote='invented')
            return self.coaching_receipt(p, output={'slides': [{'slide_index': 0, 'status': 'successful', 'findings': [card]}]})
        with patch.object(provider, 'request_raw', side_effect=receipt): self.execute_feedback(owner)
        state = self.submit_review().json()
        self.assertEqual(state['result']['slides'][0]['status'], 'insufficient_evidence')
        self.assertEqual(state['result']['slides'][0]['findings'], [])
    def test_valid_graph_evidence_and_prioritization(self):
        self.complete(); self.submit_review()
        owner = FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            cards = [self.card(p, 0, category='graph', priority=3), self.card(p, 1, category='repetition', priority=1, description_ref='', slide_quote='')]
            return self.coaching_receipt(p, output={'slides':[{'slide_index':0,'status':'successful','findings':cards}]})
        with patch.object(provider, 'request_raw', side_effect=receipt):self.execute_feedback(owner)
        result=self.submit_review().json()['result']['slides'][0]
        self.assertEqual([x['priority'] for x in result['findings']], [1,3])
        self.assertEqual(result['findings'][1]['end_ms'],1200) # Original boundary-crossing word.
        self.assertEqual(result['status'],'successful')

    def test_no_audience_cannot_create_audience_finding(self):
        self.complete(); self.submit_review()
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            return self.coaching_receipt(p,output={'slides':[{'slide_index':0,'status':'successful',
                'findings':[self.card(p,category='audience',priority=1)]}]})
        with patch.object(provider,'request_raw',side_effect=receipt):self.execute_feedback(owner)
        self.assertEqual(self.submit_review().json()['result']['slides'][0]['status'],'insufficient_evidence')

    def test_context_change_during_provider_call_fences_late_receipt(self):
        context=PresentationContext.objects.create(deck=self.deck,audience='Researchers')
        self.scope['context_id']=str(context.pk)
        self.complete();self.submit_review()
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        value,job,prepared,request=self.submit_only(owner)
        context.revision+=1;context.audience='Children';context.save()
        receipt=self.coaching_receipt(prepared,output={'slides':[{'slide_index':0,'status':'successful','findings':[]}]})
        from .services import coaching,slide_review
        coaching.save_receipt(value,job,request,receipt)
        coaching.finish(value,job,result=slide_review.normalize(prepared,receipt,job.source_snapshot))
        job.refresh_from_db();request.refresh_from_db()
        self.assertIsNone(job.result);self.assertIsNotNone(request.completed_at)
        self.assertTrue(self.client.get(self.url,{'scope':json.dumps(self.scope)}).json()['stale'])

    def test_timing_uses_only_explicit_duration_and_exact_sum(self):
        from .services.review_timing import targets,finding
        slides=[{'extracted_text':'Title\n1'},{'extracted_text':'Graph\nGrowth increased by 20%\n2'}]
        self.assertIsNone(targets(slides,None))
        allocation=targets(slides,61)
        self.assertEqual(sum(allocation),61)
        selection={'segments':[{'start_ms':0,'end_ms':50000},{'start_ms':60000,'end_ms':80000}]}
        self.assertIsNone(finding(0,selection,{},None))
        f=finding(0,selection,{},allocation)
        self.assertEqual(f['category'],'timing');self.assertIn('70s',f['observation'])

    def test_confirmed_correction_invalidates_review_without_new_jobs(self):
        from .test_corrections import seed_ai_offer
        self.complete();self.submit_review()
        seed_ai_offer(self,[{'word_start':0,'word_end':0,'text':'ChatGPT'}])
        before=FeedbackJob.objects.filter(analysis__analysis_type__startswith='review_').count()
        response=self.client.patch(f'/api/attempts/{self.attempt.pk}/corrections/',{
            'base_transcript_id':__import__('rehearsals.services.coaching',fromlist=['transcript_identity']).transcript_identity(self.attempt),
            'expected_revision':0,'edits':[{'word_start':0,'word_end':0,'text':'ChatGPT'}]},content_type='application/json')
        self.assertEqual(response.status_code,200)
        state=self.client.get(self.url,{'scope':json.dumps(self.scope)}).json()
        self.assertTrue(state['stale'])
        self.assertEqual(FeedbackJob.objects.filter(analysis__analysis_type__startswith='review_').count(),before)

    def test_timing_matches_mobile_floating_tie_policy(self):
        from .services.review_timing import targets
        self.assertEqual(targets([{'extracted_text':''},{'extracted_text':' '.join(['keywords']*16)}],738),[307,431])
    def test_zero_duration_speech_evidence_is_insufficient(self):
        from .services.alignment import align_words
        self.attempt.transcript['words'][0]['end_ms']=100
        self.attempt.visits=align_words(self.attempt.transcript['words'],self.attempt.slide_events,self.attempt.duration_ms)
        self.attempt.save()
        self.complete();self.submit_review()
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            return self.coaching_receipt(p,output={'slides':[{'slide_index':0,'status':'successful',
                'findings':[self.card(p,category='fillers',priority=1,description_ref='',slide_quote='')]}]})
        with patch.object(provider,'request_raw',side_effect=receipt):self.execute_feedback(owner)
        summary=self.submit_review().json()['result']['slides'][0]
        self.assertEqual(summary['status'],'insufficient_evidence');self.assertEqual(summary['findings'],[])

    def test_four_findings_are_retained_and_five_rejected(self):
        from .services.alignment import align_words
        self.attempt.slide_events=[{'slide_index':0,'at_ms':0}]
        self.attempt.transcript={'text':'Echo Echo Echo Echo','words':[{'text':'Echo','start_ms':i*400,'end_ms':i*400+300} for i in range(4)]}
        self.attempt.visits=align_words(self.attempt.transcript['words'],self.attempt.slide_events,self.attempt.duration_ms)
        self.attempt.save()
        self.scope['slides'][0]['segments']=[{'start_ms':0,'end_ms':2000}]
        self.complete();self.submit_review()
        owner=FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            return self.coaching_receipt(p,output={'slides':[{'slide_index':0,'status':'successful',
                'findings':[self.card(p,i,category='content',priority=4-i) for i in range(4)]}]})
        with patch.object(provider,'request_raw',side_effect=receipt):self.execute_feedback(owner)
        summary=self.submit_review().json()['result']['slides'][0]
        self.assertEqual(len(summary['findings']),4)
        self.assertEqual([f['priority'] for f in summary['findings']],[1,2,3,4])
        from .services.slide_review import Output
        from .services.feedback import validated, FeedbackError
        with self.assertRaises(FeedbackError):
            validated(Output,{'evaluation_mode':'informative_descriptive','slides':[{'slide_index':0,'status':'successful','enrichments':[],'findings':[{k:v for k,v in f.items() if k not in {'start_ms','end_ms'}} for f in summary['findings']+[summary['findings'][0]]]}]})

    def test_shared_mobile_allocation_golden_cases(self):
        from pathlib import Path
        from .services.review_timing import targets
        cases=json.loads((Path(__file__).resolve().parent/'testdata/slide_review_timing.json').read_text())
        for case in cases:
            texts=case.get('texts') or [' '.join(['keywords']*n) for n in case['counts']]
            self.assertEqual(targets([{'extracted_text':t} for t in texts],case['total']),case['expected'])

    def test_optional_illustrative_enrichment_is_separate_from_problem_verdict(self):
        self.complete(); self.submit_review()
        owner = FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
        def receipt(p):
            return self.coaching_receipt(p, output={'slides': [{'slide_index': 0, 'status': 'successful', 'findings': [],
                'enrichments': [{'kind': 'illustrative', 'idea': 'Imagine a classroom choosing between two approaches.'}]}]})
        with patch.object(provider, 'request_raw', side_effect=receipt): self.execute_feedback(owner)
        state = self.client.get(self.url, {'scope': json.dumps(self.scope)}).json()
        self.assertEqual(state['state'], 'completed')
        summary = state['result']['slides'][0]
        self.assertEqual(summary['status'], 'successful')
        self.assertEqual(summary['findings'], [])
        self.assertEqual(summary['enrichments'][0]['kind'], 'illustrative')

    def test_purpose_modes_preserve_the_shared_evaluator_and_optional_scope(self):
        from .services.slide_review import RULES, Output
        from .services.feedback import validated, FeedbackError
        self.assertIn('A chart alone does not make a deck analytical', RULES)
        self.assertIn('do not recommend something already', RULES)
        self.assertIn('Do not\nrequire hypotheses', RULES)
        self.assertIn('supporting evidence, logical consistency', RULES)
        self.assertIn('OPTIONAL enrichments', RULES)
        for mode in ['informative_descriptive', 'analytical_persuasive', 'mixed_or_uncertain']:
            value = validated(Output, {'evaluation_mode': mode, 'slides': []})
            self.assertEqual(value.evaluation_mode, mode)
        with self.assertRaises(FeedbackError):
            validated(Output, {'evaluation_mode': 'force_research_hypothesis', 'slides': []})

    def test_review_version_change_retains_output_and_requires_explicit_update(self):
        from .services import slide_review
        self.complete()
        with patch.object(slide_review, 'VERSION', 'slide-review-v1'):
            self.submit_review()
            owner = FeedbackJob.objects.get(analysis__analysis_type__startswith='review_').analysis
            def receipt(p):
                return self.coaching_receipt(p, output={'slides':[{'slide_index':0,'status':'successful','findings':[]}]})
            with patch.object(provider, 'request_raw', side_effect=receipt): self.execute_feedback(owner)
            self.assertEqual(self.client.get(self.url, {'scope':json.dumps(self.scope)}).json()['state'], 'completed')
        response = self.client.get(self.url, {'scope':json.dumps(self.scope)}).json()
        self.assertTrue(response['stale'])
        self.assertTrue(response['result']['stale'])
        self.assertEqual(response['result']['review_version'], 'slide-review-v1')
        self.assertEqual(response['review_version'], 'slide-review-v2')
        self.assertEqual(FeedbackJob.objects.filter(analysis=owner).count(), 1)
        pending = self.submit_review(feedback_revision=response['feedback_revision']).json()
        self.assertFalse(pending['stale'])
        self.assertEqual(pending['state'], 'queued')
        self.assertEqual(pending['result']['review_version'], 'slide-review-v1')
        self.assertTrue(pending['result']['stale'])

from unittest import skipUnless
from django.db import connection, connections
from django.test import TransactionTestCase
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

@skipUnless(connection.vendor=='postgresql','PostgreSQL row locks required')
class SlideReviewConcurrencyTests(SyntheticCoaching,TransactionTestCase):
    def test_concurrent_selected_scope_admission_reuses_one_job(self):
        SlideReviewTests.complete(self)
        from .services import coaching,slide_review
        scope=slide_review.scope_for(self.attempt,{'context_id':None,'slides':[{'slide_index':0,'segments':[
            {'start_ms':0,'end_ms':1000},{'start_ms':1000,'end_ms':2000}]}]})
        barrier=Barrier(2)
        def admit():
            try:
                barrier.wait()
                return coaching.generate(self.attempt.pk,{},slide_review.analysis_type(scope),scope).pk
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as executor:
            ids=list(executor.map(lambda _:admit(),range(2)))
        self.assertEqual(ids[0],ids[1])
        self.assertEqual(FeedbackJob.objects.filter(analysis_id=ids[0]).count(),1)
