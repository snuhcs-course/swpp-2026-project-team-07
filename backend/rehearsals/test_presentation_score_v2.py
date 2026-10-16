"""Synthetic deterministic v2 contracts; no inference or reliability claims."""
from copy import deepcopy
from dataclasses import replace
from fractions import Fraction
import json
from unittest import TestCase
from unittest.mock import patch
from .services import feedback_provider as provider, presentation_score as v1
from .services.feedback import FeedbackError, prepare_analysis, validate_descriptions, json_bytes
from .test_feedback import fixture, description_value
from .test_feedback_provider import envelope

SLIDE_IDS=('essential_coverage','explanation_depth','clarity_relevance')
WHOLE_IDS=('structure','coherence','audience_suitability','delivery')

def make_bundle(*,source=None,images=None,correction=None,revisions=None,measurements=None):
    if source is None:
        source,images=fixture(slides=3,events=[{'slide_index':0,'at_ms':0},{'slide_index':1,'at_ms':1000},{'slide_index':2,'at_ms':2000}])
    analysis=prepare_analysis(source,images)
    measured=measurements or {'version':'presentation-measurements-v1','status':'available','audio_hash':'a'*64,
        'attempt_id':source['attempt_id'],'duration_ms':source['duration_ms'],
        'items':[{'id':'speech_0','kind':'speech','start_ms':100,'end_ms':500,'value':400,'unit':'ms'}],
        'limitations':['Synthetic measurements.']}
    rev=revisions or {'audio_hash':'a'*64,'transcript_revision':0,'profile_revision':1,'requirements_revision':None}
    return v1.capture(analysis,validate_descriptions(description_value(analysis),analysis),measurements=measured,
        requirements={'context_id':None,'revision':None,'audience':'','required_duration_seconds':None},
        correction=correction or {'revision':rev['transcript_revision'],'edits':[],'effective_text':source['transcript']['text']},revisions=rev)

def empty_feedback():
    return {'summary':None,'strengths':[],'weaknesses':[],'improvements':[],'improvement_shortage':None}

def speech(visit='v0',start=0,end=0):
    return {'kind':'speech','visit_id':visit,'visit_word_start':start,'visit_word_end':end}

def output(bundle):
    from .services import presentation_score_v2 as scorer
    def criterion(key,refs):
        return {'id':key,'status':'assessed','level':'advanced','justification':'Synthetic supported communication.',
            'evidence':deepcopy(refs),'limitations':[],'deductions':[]}
    slides=[]
    for index in range(len(bundle.analysis.source.slides)):
        refs=[speech(f'v{i}') for i,v in enumerate(bundle.analysis.source.visits) if v.slide_index==index and v.word_indexes]
        slides.append({'slide_index':index,'status':'assessed','justification':'Synthetic communication.','evidence':deepcopy(refs),
            'criteria':[criterion(key,refs) for key in SLIDE_IDS],'feedback':empty_feedback()})
    whole=[criterion(key,[speech()]) for key in WHOLE_IDS]
    whole[-1]['evidence'].append({'kind':'measurement','measurement_id':'speech_0'})
    return {'rubric_version':'presentation-score-v2','source_id':scorer.source_identity(bundle),'full_attempt_reviewed':True,
        'slides':slides,'whole':whole,'weaknesses':[],'feedback':empty_feedback()}

def set_level(raw,level):
    rows=[(f"slide:{s['slide_index']}:{c['id']}",c) for s in raw['slides'] for c in s['criteria']]
    rows += [('whole:'+c['id'],c) for c in raw['whole']]
    for key,c in rows:
        c['level']=level
        if level!='advanced':
            raw['weaknesses'].append({'id':key,'primary_criterion':key,'observation':'Supported communication consequence.',
                'evidence':deepcopy(c['evidence']),'omission_basis':None})
            c['deductions']=[{'weakness_id':key,'consequence':'Meaning is less clear.','evidence':deepcopy(c['evidence'])}]

class PresentationScoreV2Tests(TestCase):
    def setUp(self):
        from .services import presentation_score_v2 as scorer
        self.scorer=scorer;self.bundle=make_bundle()

    def test_all_competent_is_67_with_exact_arithmetic(self):
        raw=output(self.bundle);set_level(raw,'competent');result=self.scorer.validate_output(self.bundle,raw)
        self.assertEqual(result['overall']['score'],67)
        self.assertEqual(result['overall']['exact'],{'numerator':200,'denominator':3})
        self.assertEqual(result['assessment_status'],'scored')
        self.assertEqual([r['score'] for r in result['slides']],[67,67,67])
        self.assertEqual(result['overall']['level'],'competent')

    def test_exact_formula_half_up_and_all_descriptor_boundaries(self):
        from .services import presentation_rubric_v2 as rubric
        self.assertEqual(rubric.slide_points(dict(zip(SLIDE_IDS,('beginning','emerging','advanced')))),Fraction(110,3))
        self.assertEqual(rubric.overall_points([Fraction(110,3),Fraction(100)],Fraction(50)),Fraction(377,6))
        self.assertEqual(rubric.round_half_up(Fraction(1,2)),1)
        for value,label in [(Fraction(100,6)-Fraction(1,1000),'beginning'),(Fraction(100,6),'emerging'),
                (Fraction(50)-Fraction(1,1000),'emerging'),(Fraction(50),'competent'),
                (Fraction(250,3)-Fraction(1,1000),'competent'),(Fraction(250,3),'advanced')]:
            self.assertEqual(rubric.overall_level(value),label)

    def test_invalid_one_slide_preserves_other_valid_components(self):
        raw=output(self.bundle);raw['slides'][1]['criteria'][0]['evidence']=[speech('v999')]
        result=self.scorer.validate_output(self.bundle,raw)
        self.assertEqual([r['status'] for r in result['slides']],['scored','invalid_evidence','scored'])
        self.assertEqual([r['score'] for r in result['slides']],[100,None,100])
        self.assertIsNone(result['overall']['score']);self.assertEqual(result['assessment_status'],'invalid_evidence')
        self.assertGreater(result['validation']['score_critical']['rejected_count'],0)

    def test_optional_malformed_items_are_filtered_independently(self):
        raw=output(self.bundle)
        raw['feedback']['strengths']=[{'text':'Valid strength.','evidence':[speech()]},None,
            {'text':'Forged citation.','evidence':[speech('v999')]},{'wrong':'schema'}]
        raw['slides'][0]['feedback']['summary']={'text':'Supported summary.','evidence':[speech()]}
        raw['slides'][1]['feedback']='bad'
        result=self.scorer.validate_output(self.bundle,raw)
        self.assertEqual(result['overall']['score'],100);self.assertEqual(len(result['feedback']['strengths']),1)
        self.assertEqual(result['slides'][0]['feedback']['summary']['text'],'Supported summary.')
        self.assertEqual(result['validation']['optional']['rejected_count'],4)

    def test_missing_duplicate_unknown_slide_and_criteria_fail_closed(self):
        variants=[]
        raw=output(self.bundle);raw['slides'].pop();variants.append(raw)
        raw=output(self.bundle);raw['slides'][1]['slide_index']=0;variants.append(raw)
        raw=output(self.bundle);raw['slides'][0]['slide_index']=True;variants.append(raw)
        raw=output(self.bundle);raw['slides'][0]['criteria'].pop();variants.append(raw)
        raw=output(self.bundle);raw['whole'][0]['id']='invented';variants.append(raw)
        raw=output(self.bundle);raw['whole'][1]=raw['whole'][0];variants.append(raw)
        for raw in variants:
            with self.subTest(raw=raw),self.assertRaises(FeedbackError):self.scorer.validate_output(self.bundle,raw)

    def test_other_slide_evidence_cannot_grade_slide(self):
        raw=output(self.bundle);raw['slides'][1]['criteria'][0]['evidence']=[speech()]
        result=self.scorer.validate_output(self.bundle,raw)
        self.assertEqual(result['slides'][1]['status'],'invalid_evidence');self.assertEqual(result['slides'][0]['score'],100)

    def test_partial_attempt_keeps_recorded_slides_without_overall(self):
        source,images=fixture(slides=3);bundle=make_bundle(source=source,images=images)
        result=self.scorer.validate_output(bundle,output(bundle))
        self.assertEqual(result['slides'][2]['status'],'not_recorded');self.assertIsNone(result['overall']['score'])
        self.assertEqual(result['assessment_status'],'incomplete');self.assertEqual(result['slides'][0]['score'],100)

    def test_concise_speech_bypasses_legacy_1000ms_threshold(self):
        self.assertFalse(self.bundle.eligibility['eligible'])
        self.assertEqual(self.scorer.validate_output(self.bundle,output(self.bundle))['overall']['score'],100)
        self.assertEqual(self.scorer.prepare(self.bundle,provider.ProviderConfig('openai','synthetic','')).stage,'coaching')

    def test_audio_unavailable_suppresses_overall_but_preserves_slides(self):
        bundle=make_bundle(measurements={**self.bundle.measurements,'status':'unavailable','items':[]})
        raw=output(bundle);raw['whole'][-1].update(status='insufficient_evidence',level=None,evidence=[],limitations=['Audio unavailable.'])
        result=self.scorer.validate_output(bundle,raw)
        self.assertIsNone(result['overall']['score']);self.assertEqual(result['slides'][0]['score'],100)
        self.assertEqual(result['assessment_status'],'unavailable')
        with self.assertRaises(FeedbackError):self.scorer.prepare(bundle,provider.ProviderConfig('openai','synthetic',''))

    def test_insufficient_evidence_does_not_become_a_low_grade(self):
        raw=output(self.bundle);raw['slides'][0]['criteria'][0].update(status='insufficient_evidence',level=None,
            evidence=[],limitations=['Cannot establish meaning.'])
        result=self.scorer.validate_output(self.bundle,raw)
        self.assertEqual(result['slides'][0]['status'],'insufficient_evidence');self.assertIsNone(result['overall']['score'])
        raw['slides'][0]['criteria'][0]['level']='beginning'
        self.assertEqual(self.scorer.validate_output(self.bundle,raw)['slides'][0]['status'],'invalid_evidence')

    def test_not_applicable_only_boundary_with_evidence_and_justification(self):
        raw=output(self.bundle);raw['slides'][0].update(status='not_applicable',criteria=[],
            justification='Title only; no essential communication required.',evidence=[{'kind':'slide','fact_id':'s0:summary'}])
        result=self.scorer.validate_output(self.bundle,raw)
        self.assertEqual(result['slides'][0]['status'],'not_applicable');self.assertEqual(result['overall']['score'],100)
        raw['slides'][1].update(status='not_applicable',criteria=[],evidence=[{'kind':'slide','fact_id':'s1:summary'}])
        self.assertEqual(self.scorer.validate_output(self.bundle,raw)['slides'][1]['status'],'invalid_evidence')

    def test_shared_weakness_needs_distinct_secondary_consequence(self):
        raw=output(self.bundle);a,b=raw['slides'][0]['criteria'][:2]
        raw['weaknesses']=[{'id':'gap','primary_criterion':'slide:0:essential_coverage','observation':'Meaning is obscured.',
            'evidence':[speech()],'omission_basis':None}]
        for row in (a,b):row.update(level='emerging',deductions=[{'weakness_id':'gap','consequence':'Same gap.','evidence':[speech()]}])
        self.assertEqual(self.scorer.validate_output(self.bundle,raw)['slides'][0]['status'],'invalid_evidence')
        b['deductions'][0]['consequence']='A separate relationship is unexplained.'
        self.assertEqual(self.scorer.validate_output(self.bundle,raw)['slides'][0]['status'],'scored')

    def test_omission_requires_full_attempt_and_certain_essential_fact(self):
        raw=output(self.bundle);a=raw['slides'][0]['criteria'][0]
        refs=[{'kind':'full_attempt'},{'kind':'slide','fact_id':'s0:key_ideas/0'}]
        a.update(level='beginning',evidence=deepcopy(refs),deductions=[{'weakness_id':'omission','consequence':'Essential meaning absent.','evidence':[]}])
        raw['weaknesses']=[{'id':'omission','primary_criterion':'slide:0:essential_coverage','observation':'Essential explanation absent.',
            'evidence':deepcopy(refs),'omission_basis':{'kind':'essential_explanation','explanation':'Necessary for understanding the stated idea.'}}]
        self.assertEqual(self.scorer.validate_output(self.bundle,raw)['slides'][0]['score'],60)
        raw['weaknesses'][0]['evidence'].pop(0)
        self.assertEqual(self.scorer.validate_output(self.bundle,raw)['slides'][0]['status'],'invalid_evidence')

    def test_delivery_requires_speech_and_nonsignal_measurement(self):
        raw=output(self.bundle);raw['whole'][-1]['evidence']=[speech()]
        result=self.scorer.validate_output(self.bundle,raw)
        self.assertIsNone(result['overall']['score']);self.assertEqual(result['slides'][0]['score'],100)
        self.assertEqual(result['assessment_status'],'invalid_evidence')

    def test_exact_receipt_binding_private_audit_and_public_shape(self):
        raw=output(self.bundle)
        for name in ('openai','gemini'):
            with patch.object(provider,'request_raw',side_effect=AssertionError('No paid calls')):
                request=self.scorer.prepare(self.bundle,provider.ProviderConfig(name,'synthetic',''))
                receipt=provider.RawReceipt(name,'synthetic','coaching',request.input_hash,200,json_bytes(envelope(name,raw)),True,None,None,())
                result,audit=self.scorer.normalize_with_audit(self.bundle,request,receipt)
                self.assertEqual(result['overall']['score'],100)
                self.assertEqual(set(result),{'rubric_version','source_identity','assessment_status','overall','slides','whole','feedback','validation','evidence'})
                self.assertEqual(audit['binding']['input_hash'],request.input_hash);self.assertEqual(audit['model_selection'],raw)
                self.assertNotIn('model_selection',json.dumps(result))
                with self.assertRaises(FeedbackError):self.scorer.normalize(self.bundle,request,replace(receipt,input_hash='f'*64))
                with self.assertRaises(FeedbackError):self.scorer.normalize(self.bundle,replace(request,payload=request.payload+b' '),receipt)

    def test_v1_and_changed_revisions_cannot_be_reinterpreted(self):
        raw=output(self.bundle);raw['source_id']=self.bundle.identity
        with self.assertRaises(FeedbackError):self.scorer.validate_output(self.bundle,raw)
        changed=make_bundle(revisions={**self.bundle.revisions,'profile_revision':2})
        self.assertNotEqual(self.scorer.source_identity(self.bundle),self.scorer.source_identity(changed))
        with self.assertRaises(FeedbackError):self.scorer.validate_output(changed,output(self.bundle))
