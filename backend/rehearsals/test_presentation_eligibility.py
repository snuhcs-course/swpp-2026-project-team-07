"""AI-assisted coverage regression tests; synthetic audio alignment only."""
from copy import deepcopy
from unittest import TestCase
from .services.alignment import align_words


def evidence(n=4, order=(1, 2)):
    events = [{'slide_index': slide, 'at_ms': i*2000} for i, slide in enumerate(order)]
    words = [{'text': text, 'start_ms': i*2000+j*600+100, 'end_ms': i*2000+j*600+700}
             for i in range(len(order)) for j, text in enumerate(('Explain', 'meaning'))]
    return dict(attempt_id='a'*36, page_count=n, duration_ms=len(order)*2000,
        slide_events=events, transcript={'text': ' '.join(w['text'] for w in words), 'words': words},
        aligned_visits=align_words(words, events, len(order)*2000), measurements={
            'version': 'presentation-measurements-v1', 'attempt_id':'a'*36, 'audio_hash':'a'*64,
            'status':'available', 'duration_ms':len(order)*2000,
            'items':[{'id':f'speech_{i}', 'kind':'speech', 'start_ms':i*2000+100, 'end_ms':i*2000+1400,
                      'value':1300, 'unit':'ms'} for i in range(len(order))], 'limitations':['Synthetic.']})


class EligibilityTests(TestCase):
    def evaluate(self, **changes):
        from .services.presentation_eligibility import evaluate
        return evaluate(**(evidence() | changes))

    def test_middle_slides_qualify_without_title_or_closing(self):
        r=self.evaluate()
        self.assertEqual(r['status'],'eligible'); self.assertTrue(r['eligible'])
        self.assertEqual(r['required_slides'],[1,2]); self.assertEqual(r['covered_slides'],[1,2])
        self.assertEqual(r['missing_slides'],[]); self.assertEqual(r['slides_lacking_meaningful_speech'],[])

    def test_small_decks_require_every_slide(self):
        from .services.presentation_eligibility import evaluate
        self.assertEqual(evaluate(**evidence(1,(0,)))['status'],'eligible')
        r=evaluate(**evidence(2,(0,)))
        self.assertEqual(r['required_slides'],[0,1]); self.assertEqual(r['missing_slides'],[1])
        self.assertEqual(r['status'],'incomplete')
        self.assertEqual(evaluate(**evidence(0,(0,)))['status'],'unavailable')

    def test_missing_visit_and_silent_visit_are_distinct(self):
        from .services.presentation_eligibility import evaluate
        r=evaluate(**evidence(5,(1,2)))
        self.assertEqual(r['missing_slides'],[3])
        e=evidence(); e['measurements']['items'].pop()
        r=evaluate(**e)
        self.assertEqual(r['missing_slides'],[]); self.assertEqual(r['slides_lacking_meaningful_speech'],[2])

    def test_repeated_backward_visits_keep_original_order_and_can_supply_later_speech(self):
        from .services.presentation_eligibility import evaluate
        e=evidence(4,(2,1,2)); e['measurements']['items'].pop(0)
        r=evaluate(**e)
        self.assertTrue(r['eligible'])
        self.assertEqual([v['slide_index'] for v in e['aligned_visits']],[2,1,2])
        self.assertEqual([v['visit_id'] for v in r['supporting_intervals']],[1,2])

    def test_noise_without_transcript_and_transcript_without_vad_never_cover(self):
        e=evidence(); e['transcript']={'text':'','words':[]}
        e['aligned_visits']=align_words([],e['slide_events'],e['duration_ms'])
        self.assertEqual(self.evaluate(**e)['slides_lacking_meaningful_speech'],[1,2])
        e=evidence(); e['measurements']['status']='insufficient_evidence'; e['measurements']['items']=[]
        self.assertEqual(self.evaluate(**e)['status'],'incomplete')

    def test_short_fragments_do_not_accumulate_across_visits(self):
        e=evidence(3,(1,1))
        for item in e['measurements']['items']: item['end_ms']=item['start_ms']+600
        self.assertEqual(self.evaluate(**e)['slides_lacking_meaningful_speech'],[1])

    def test_boundary_word_cannot_supply_speech_to_next_slide(self):
        e=evidence(); e['transcript']['words'][1]['end_ms']=3500
        e['aligned_visits']=align_words(e['transcript']['words'],e['slide_events'],e['duration_ms'])
        e['measurements']['items'][1]['end_ms']=2500
        r=self.evaluate(**e)
        self.assertEqual(r['slides_lacking_meaningful_speech'],[2])

    def test_missing_or_inconsistent_source_is_unavailable_not_assumed_complete(self):
        for key,bad in [('slide_events',None),('transcript',None),('aligned_visits',[]),('page_count',True)]:
            r=self.evaluate(**{key:bad})
            self.assertEqual(r['status'],'unavailable'); self.assertIsNone(r['covered_slides'])
        e=evidence(); e['measurements']['attempt_id']='another'
        self.assertEqual(self.evaluate(**e)['status'],'unavailable')
        e=evidence();e['transcript']['text']=''
        self.assertEqual(self.evaluate(**e)['status'],'unavailable')

    def test_source_hash_changes_with_audio_timeline_or_transcript(self):
        original=self.evaluate()['source_identity']
        e=evidence(); e['measurements']['audio_hash']='b'*64
        self.assertNotEqual(self.evaluate(**e)['source_identity'],original)

    def test_single_stt_unit_can_supply_multilingual_lexical_material(self):
        e=evidence(1,(0,)); e['transcript']={'text':'안녕하세요','words':[{'text':'안녕하세요','start_ms':100,'end_ms':1300}]}
        e['aligned_visits']=align_words(e['transcript']['words'],e['slide_events'],e['duration_ms'])
        self.assertTrue(self.evaluate(**e)['eligible'])
