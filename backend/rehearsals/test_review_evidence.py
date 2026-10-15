"""Grounding invariants for the current review normalizer; providers are mocked."""
from copy import deepcopy
from unittest.mock import patch
from django.test import TestCase
from .test_coaching import SyntheticCoaching
from .test_descriptions import description_value
from .models import FeedbackJob
from .services import slide_profiles,descriptions,coaching,slide_review,feedback_provider as provider
from .services.alignment import align_words

class ReviewEvidenceTests(SyntheticCoaching,TestCase):
    def setUp(self):
        super().setUp()
        self.attempt.duration_ms=7000
        self.attempt.slide_events=[{'slide_index':0,'at_ms':0},{'slide_index':0,'at_ms':6000}]
        words=[{'text':f'word{i}','start_ms':i*100,'end_ms':i*100+80} for i in range(70)]
        self.attempt.transcript={'text':' '.join(w['text'] for w in words),'words':words}
        self.attempt.visits=align_words(words,self.attempt.slide_events,7000);self.attempt.save()
        value=slide_profiles.ensure(self.deck.pk)
        def profile(p):
            output=description_value(p.analysis)
            for s in output['slides']:
                s.update(slide_kind='content',must_cover=[],go_deeper=[])
                s['summary']={'text':'The evidence does not show safety at 1.5 km.','uncertain':False,'uncertainty':''}
            return self.coaching_receipt(p,output=output)
        with patch.object(provider,'request_raw',side_effect=profile):descriptions.run_description(value.pk,1)
        scope={'context_id':None,'slides':[{'slide_index':0,'segments':[{'start_ms':0,'end_ms':6000},{'start_ms':6000,'end_ms':7000}]}]}
        owner=coaching.generate(self.attempt.pk,{},slide_review.analysis_type(scope),scope)
        self.job=FeedbackJob.objects.get(analysis=owner)
        self.prepared=coaching._prepared(self.job.description_set,self.job)

    def make_card(self,**changes):
        return self.card(self.prepared,38,category='content',priority=1,word_end=43,
            speech_quote=' '.join(f'word{i}' for i in range(38,44)),**changes)

    def normalize(self,cards,status='successful'):
        output={'evaluation_mode':'informative_descriptive','slides':[{'slide_index':0,'status':status,'findings':cards,'enrichments':[]}]}
        return slide_review.normalize(self.prepared,self.coaching_receipt(self.prepared,output=output),self.job.source_snapshot)

    def test_contiguous_range_crosses_chunk_but_never_slide_visit(self):
        result=self.normalize([self.make_card()])
        finding=result.slides[0]['findings'][0]
        self.assertEqual((finding['start_ms'],finding['end_ms']),(3800,4380))
        for changes in [{'word_end':62,'speech_quote':' '.join(f'word{i}' for i in range(38,63))},
                        {'visit_id':1},{'segment_id':'v0s1'},{'slide_index':1},
                        {'transcript_id':'f'*64},{'source_id':'f'*64}]:
            card=self.make_card();card.update(changes)
            result=self.normalize([card])
            self.assertEqual(result.slides[0]['status'],'invalid_evidence')
            self.assertFalse(result.slides[0]['findings'])

    def test_excerpt_retains_full_fact_and_its_negation(self):
        card=self.make_card(slide_quote='Safety at 1.5 km')
        result=self.normalize([card]);finding=result.slides[0]['findings'][0]
        self.assertEqual(finding['slide_quote'],'The evidence does not show safety at 1.5 km.')
        for quote in ['safety at 15 km','does show safety','safety is proven']:
            card=self.make_card(slide_quote=quote)
            self.assertEqual(self.normalize([card]).slides[0]['status'],'invalid_evidence')

    def test_independent_schema_invalid_and_distinct_shared_span_findings_survive(self):
        first=self.make_card()
        second={**first,'category':'delivery','observation':'The ordering is hard to follow.','suggestion':'Lead with the main point.'}
        for bad in [None,{**first,'priority':'1'},{**first,'extra':'unexpected'},{**first,'suggestion':'x'*701}]:
            result=self.normalize([first,bad,second]);summary=result.slides[0]
            self.assertEqual(summary['status'],'partial')
            self.assertEqual(len(summary['findings']),2)
            self.assertEqual(summary['validation']['rejected_count'],1)
            self.assertEqual(summary['validation']['reasons'],['invalid_finding_metadata'])

    def test_redundancy_uses_advice_not_shared_words_or_word_bags(self):
        first=self.make_card();duplicate={**first,'priority':2}
        result=self.normalize([first,duplicate])
        self.assertEqual(len(result.slides[0]['findings']),1)
        self.assertEqual(result.slides[0]['validation']['duplicates_removed'],1)
        self.assertEqual(result.slides[0]['status'],'successful')
        a={**first,'observation':'A causes B','suggestion':'Explain why A causes B.'}
        b={**first,'observation':'B causes A','suggestion':'Explain why B causes A.'}
        self.assertEqual(len(self.normalize([a,b]).slides[0]['findings']),2)

    def test_model_errors_and_invalid_evidence_are_not_insufficient_speech(self):
        self.assertEqual(self.normalize([{'priority':'bad'}]).slides[0]['status'],'model_error')
        card=self.make_card();card['speech_quote']='invented'
        self.assertEqual(self.normalize([card]).slides[0]['status'],'invalid_evidence')
        summary=self.normalize([],status='insufficient_evidence').slides[0]
        self.assertEqual(summary['status'],'insufficient_evidence')
        self.assertEqual(summary['validation']['speech_word_count'],70)
        self.assertTrue(summary['validation']['model_insufficient'])

    def completed_legacy_result(self):
        original=deepcopy(self.attempt.transcript)
        def receipt(p):
            card=self.card(p,38,category='content',priority=1,speech_quote='word38')
            return self.coaching_receipt(p,output={'evaluation_mode':'informative_descriptive',
                'slides':[{'slide_index':0,'status':'successful','findings':[card],'enrichments':[]}]})
        with patch.object(provider,'request_raw',side_effect=receipt) as calls:
            coaching.run_coaching(self.job.analysis_id,1)
        self.assertEqual(calls.call_count,1)
        self.job.refresh_from_db()
        self.job.result.pop('validation_revision')
        summary=self.job.result['slides'][0];summary.pop('validation',None)
        summary['status']='insufficient_evidence';summary['findings']=[]
        self.job.result.update(status='partial',accepted_count=0,discarded_count=1)
        self.job.save(update_fields=['result'])
        return original

    def test_explicit_receipt_repair_is_dry_run_idempotent_and_never_calls_provider(self):
        from .models import FeedbackRequest
        original=self.completed_legacy_result()
        raw=bytes(FeedbackRequest.objects.get(coaching_job=self.job).raw_body)
        with patch.object(provider,'request_raw',side_effect=AssertionError('No new AI request')):
            preview=slide_review.revalidate_saved(self.job.pk)
            self.assertFalse(preview['applied']);self.assertEqual(preview['accepted_count'],1)
            self.job.refresh_from_db();self.assertEqual(self.job.result['accepted_count'],0)
            applied=slide_review.revalidate_saved(self.job.pk,apply=True)
            self.assertTrue(applied['applied']);self.assertEqual(applied['discarded_count'],0)
            self.assertTrue(slide_review.revalidate_saved(self.job.pk,apply=True)['already_current'])
        self.job.refresh_from_db();self.attempt.refresh_from_db()
        self.assertEqual(self.job.generation,1);self.assertEqual(self.attempt.transcript,original)
        self.assertEqual(bytes(FeedbackRequest.objects.get(coaching_job=self.job).raw_body),raw)

    def test_receipt_repair_refuses_changed_source_without_overwriting_saved_result(self):
        from .services.feedback import FeedbackError
        self.completed_legacy_result();before=deepcopy(self.job.result)
        self.attempt.audience='Changed source';self.attempt.save(update_fields=['audience'])
        with self.assertRaises(FeedbackError):slide_review.revalidate_saved(self.job.pk,apply=True)
        self.job.refresh_from_db();self.assertEqual(self.job.result,before)

    def test_optional_metadata_does_not_discard_grounded_findings(self):
        output={'evaluation_mode':'informative_descriptive','slides':[{'slide_index':0,'status':'unknown-status',
            'findings':[self.make_card()],'enrichments':{'malformed':'metadata'}}]}
        result=slide_review.normalize(self.prepared,self.coaching_receipt(self.prepared,output=output),self.job.source_snapshot)
        self.assertEqual(len(result.slides[0]['findings']),1)
        self.assertEqual(result.slides[0]['status'],'partial')
