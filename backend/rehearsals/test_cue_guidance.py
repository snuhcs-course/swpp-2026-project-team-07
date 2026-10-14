"""Category guidance: synthetic evidence and mocked transports, no live quality claim."""
from copy import deepcopy
from dataclasses import replace
import hashlib
from unittest.mock import patch
from django.test import SimpleTestCase, TestCase
from .services import descriptions, feedback_provider as provider, slide_profiles
from .services.feedback import FeedbackError, prepare_deck, json_bytes
from .services.feedback_config import Selection, prompt_digest
from .services.slide_profile_schema import validate_profiles
from .test_feedback import image_bytes, DECK
from .test_descriptions import SyntheticDecks, description_value
from .test_feedback_provider import envelope


def guidance_value(prepared):
    value = description_value(prepared)
    for s in value['slides']:
        s.update(slide_kind='content', must_cover=[{'text': 'Clarify what this comparison establishes.', 'evidence_refs': ['summary']}], go_deeper=[])
    return value


def reference(s, ref='summary'):
    return {'slide_index': s['slide_index'], 'source_id': s['source_id'], 'fact_ref': ref, 'quote': s['summary']['text']}


class GuidanceValidationTests(SimpleTestCase):
    def setUp(self):
        self.prepared = prepare_deck({'deck_id':DECK,'content_hash':'a'*64,'preparation_version':'synthetic-v1',
            'slides':[{'deck_id':DECK,'slide_index':i,'source_language':'en','extracted_text':t} for i,t in enumerate([
                'Accuracy increased from 80% to 92%.\n'+'\n'.join('Bullet '+str(j) for j in range(20)),
                '', 'Baseline limitations'])]}, tuple(image_bytes() for _ in range(3)))
        self.value = guidance_value(self.prepared)
        self.value['slides'][0]['summary'] = {'text':'Accuracy increased from 80% to 92%.','uncertain':False,'uncertainty':''}
        self.value['slides'][0]['must_cover'][0]['text'] = 'Clarify the 12-percentage-point gain, distinct from a 12% relative gain.'

    def test_two_categories_preserve_full_deck_grounding(self):
        s = self.value['slides'][0]
        s['go_deeper'] = [{'text':'Connect the improvement to the baseline limitation on the closing slide.',
            'kind':'connection','evidence_refs':[reference(self.value['slides'][2])], 'information_needed':''}]
        result = validate_profiles(self.value, self.prepared)
        self.assertEqual(len(result.slides[0].must_cover),1)
        self.assertEqual(result.slides[0].go_deeper[0].evidence_refs[0].slide_index,2)

    def test_unknown_causes_are_questions_not_supported_explanations(self):
        s = self.value['slides'][0]
        s['go_deeper'] = [{'text':'Investigate which model changes contributed, if your experiments support an answer.',
            'kind':'question','evidence_refs':[reference(s)],'information_needed':'Controlled experiments isolating model changes.'}]
        validate_profiles(self.value,self.prepared)
        for change in [lambda d:d.update(information_needed=''),
                       lambda d:d.update(kind='connection'),
                       lambda d:d['evidence_refs'][0].update(quote='A new architecture caused the gain.'),
                       lambda d:d.update(causal_explanation='A new architecture caused the gain.')]:
            bad=deepcopy(self.value);change(bad['slides'][0]['go_deeper'][0])
            with self.assertRaises(FeedbackError):validate_profiles(bad,self.prepared)

    def test_zero_to_three_limits_sparse_unreadable_and_no_enrichment(self):
        for kind in ['title','closing','unknown']:
            value=deepcopy(self.value);s=value['slides'][1]
            s.update(slide_kind=kind,must_cover=[],go_deeper=[])
            s['summary'].update(uncertain=True,uncertainty='Graph labels are unreadable.')
            self.assertEqual(validate_profiles(value,self.prepared).slides[1].must_cover,())
        for category in ['must_cover','go_deeper']:
            bad=deepcopy(self.value)
            item=bad['slides'][0]['must_cover'][0] if category=='must_cover' else {
                'text':'Investigate a practical consequence.','kind':'question','evidence_refs':[reference(bad['slides'][0])], 'information_needed':'Application context.'}
            bad['slides'][0][category]=[dict(item,text='Objective '+str(i)) for i in range(4)]
            with self.assertRaises(FeedbackError):validate_profiles(bad,self.prepared)

    def test_references_duplicates_and_verbatim_repetition_fail(self):
        mutations=[lambda v:v['slides'][0]['must_cover'][0].update(evidence_refs=['visual_facts/4']),
            lambda v:v['slides'][0]['summary'].update(uncertain=True,uncertainty='Ambiguous value'),
            lambda v:v['slides'][0]['must_cover'][0].update(text=v['slides'][0]['summary']['text']),
            lambda v:v['slides'][0]['must_cover'].append(dict(v['slides'][0]['must_cover'][0],text=v['slides'][0]['must_cover'][0]['text'].upper())),
            lambda v:v['slides'][0].update(go_deeper=[{'text':v['slides'][0]['must_cover'][0]['text'],'kind':'connection','evidence_refs':[reference(v['slides'][0])],'information_needed':''}]),
            lambda v:v['slides'][0].update(go_deeper=[{'text':'Connect to a nonexistent slide.','kind':'connection','evidence_refs':[dict(reference(v['slides'][0]),slide_index=3)],'information_needed':''}]),
            lambda v:v['slides'][0].update(go_deeper=[{'text':'Connect to a replaced source.','kind':'connection','evidence_refs':[dict(reference(v['slides'][0]),source_id='f'*64)],'information_needed':''}])]
        for mutate in mutations:
            bad=deepcopy(self.value);mutate(bad)
            with self.assertRaises(FeedbackError):validate_profiles(bad,self.prepared)

    def test_v1_identity_is_reconstructed_exactly(self):
        for name,version,schema,prompt in [
            ('openai','slide-profile-v1','c89b7d48d7f5705aaaf7fac01f87eb8f0e32f0cad5c4ebf2039589780f5081c5','8f85bd8263b51a62813162bbd64eb770c96f852659a4b4495f44ef1ab0b07901'),
            ('gemini','slide-profile-gemini-v1','665783e0829470ba9a066c7e42ac470c5d7557ce49d209bca9ca6f3c74b2ae2c','aadef118d5742b7c77106de99357b3fc79c7661e8cef4f2bb2164fd55018f136')]:
            self.assertEqual(hashlib.sha256(json_bytes(provider.response_schema(name,'descriptions',version))).hexdigest(),schema)
            self.assertEqual(prompt_digest(name,version),prompt)
            selection=replace(Selection(name,'synthetic-project','synthetic-model','slide-profile-v1',version))
            selection.check_versions(prompt)

    def test_current_cues_are_at_most_fifteen_words_historical_cues_remain_readable(self):
        for category in ['must_cover','go_deeper']:
            value=deepcopy(self.value)
            item={'text':' '.join(['word']*15),'evidence_refs':['summary']} if category=='must_cover' else {
                'text':' '.join(['word']*15),'kind':'question','information_needed':'Research needed.', 'evidence_refs':[reference(value['slides'][0])]}
            value['slides'][0][category]=[item]
            validate_profiles(value,self.prepared)
            item['text']+=' extra'
            with self.assertRaises(FeedbackError):validate_profiles(value,self.prepared)
            validate_profiles(value,self.prepared,'slide-profile-v3')


    def test_unicode_word_separators_match_mobile_policy(self):
        for sep in ['\ufeff','\u0085','\u001c','\u2003','\u00a0']:
            value=deepcopy(self.value)
            value['slides'][0]['must_cover'][0]['text']=sep.join(['word']*15)
            validate_profiles(value,self.prepared)
            value['slides'][0]['must_cover'][0]['text']+=sep+'extra'
            with self.assertRaises(FeedbackError):validate_profiles(value,self.prepared)


class GuidanceJobTests(SyntheticDecks,TestCase):
    def receipt(self, request):
        body=json_bytes(envelope(request.config.provider,guidance_value(request.analysis)))
        return provider.RawReceipt(request.config.provider,request.config.model,'descriptions',request.input_hash,200,body,True,None,None,())

    def test_new_scope_uses_categories_and_cached_current_scope_never_rescans(self):
        v=slide_profiles.ensure(self.deck.pk)
        def receipt(request):
            body=json_bytes(envelope(request.config.provider,guidance_value(request.analysis)))
            return provider.RawReceipt(request.config.provider,request.config.model,'descriptions',request.input_hash,200,body,True,None,None,())
        with patch.object(provider,'request_raw',side_effect=receipt) as calls:
            descriptions.run_description(str(v.pk),1)
            descriptions.run_description(str(v.pk),1)
        self.assertEqual(calls.call_count,1)
        v.refresh_from_db()
        self.assertEqual(v.prompt_version,'slide-profile-v4')
        self.assertEqual(len(v.descriptions['slides'][0]['must_cover']),1)
        self.assertEqual(slide_profiles.ensure(self.deck.pk).pk,v.pk)

    def test_upgrade_model_and_source_changes_are_new_scopes_without_mutating_history(self):
        from .models import DescriptionSet
        from .test_slide_profiles import profile_value
        selection=Selection.profiles()
        legacy=replace(selection,prompt_version='slide-profile-v1',schema_version='slide-profile-gemini-v1')
        prepared,snapshot=descriptions.prepare_saved(self.deck.pk)
        old=descriptions.admit_prepared(legacy,prepared,snapshot,dependency=True)
        old.descriptions=profile_value(prepared);old.description_revision=1;old.save()
        old.jobs.update(state='completed')
        saved=deepcopy(old.descriptions)
        self.assertEqual(self.client.get(f'/api/decks/{self.deck.pk}/profiles/').data['state'],'absent')
        self.assertEqual(DescriptionSet.objects.count(),1)  # GET does not migrate/admit.
        new=slide_profiles.ensure(self.deck.pk)
        self.assertNotEqual(new.pk,old.pk)
        old.refresh_from_db();self.assertEqual(old.descriptions,saved)
        self.assertTrue(slide_profiles.read(self.deck.pk,old.pk)['stale'])
        with patch.object(Selection,'profiles',return_value=replace(selection,model='changed-model')):
            model_scope=slide_profiles.ensure(self.deck.pk)
        self.assertNotEqual(new.pk,model_scope.pk)
        self.deck.slides.update(extracted_text='Changed chart label')
        source_scope=slide_profiles.ensure(self.deck.pk)
        self.assertNotEqual(source_scope.pk,new.pk)

    def test_v2_receipt_recovery_never_resubmits_after_normalization_crash(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import DescriptionJob,FeedbackRequest
        value=slide_profiles.ensure(self.deck.pk)
        with patch.object(provider,'request_raw',side_effect=self.receipt) as calls, patch.object(descriptions,'finish',side_effect=RuntimeError('Synthetic crash')):
            descriptions.run_description(str(value.pk),1)
        self.assertEqual(calls.call_count,1)
        self.assertIsNotNone(FeedbackRequest.objects.get(job__description_set=value).received_at)
        DescriptionJob.objects.filter(description_set=value).update(claimed_at=timezone.now()-timedelta(minutes=10))
        with patch.dict('os.environ',{'FEEDBACK_ENABLED':'false','GEMINI_API_KEY':''}), patch.object(provider,'request_raw',side_effect=AssertionError('No second submission')):
            descriptions.recover_descriptions()
            descriptions.run_description(str(value.pk),1)
        value.refresh_from_db()
        self.assertEqual(value.jobs.get().state,'completed')
        self.assertEqual(len(value.descriptions['slides'][0]['must_cover']),1)
