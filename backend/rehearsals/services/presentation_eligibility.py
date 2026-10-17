"""AI-assisted single-attempt acoustic/STT coverage; never a presentation grade."""
import hashlib
import json
import re

from .alignment import align_words
from .feedback import Transcript, validated, FeedbackError

VERSION = 'presentation-eligibility-v1'
MIN_SPEECH_MS = 1000
MAX_EPISODE_GAP_MS = 500


def _union(intervals):
    merged=[]
    for start,end in sorted(intervals):
        if merged and start <= merged[-1][1]: merged[-1][1]=max(end,merged[-1][1])
        else: merged.append([start,end])
    return merged


def evaluate(*, attempt_id, page_count, duration_ms, slide_events, transcript, aligned_visits, measurements):
    """All inputs are original server evidence, not LLM/caller completeness flags.

    Intersection clipping is used only for coverage. Source word timing/order is
    never rewritten, and short episodes never accumulate across visits.
    """
    required = (list(range(page_count)) if page_count <= 2 else list(range(1,page_count-1))) if type(page_count) is int and page_count>0 else None
    result={'eligibility_version':VERSION,'attempt_id':attempt_id,'source_identity':None,
            'eligible':False,'status':'unavailable','required_slides':required,
            'covered_slides':None,'missing_slides':None,'slides_lacking_meaningful_speech':None,
            'reasons':[],'supporting_intervals':[]}
    try:
        result['source_identity']=hashlib.sha256(json.dumps([VERSION,MIN_SPEECH_MS,MAX_EPISODE_GAP_MS,
            attempt_id,page_count,duration_ms,slide_events,transcript,aligned_visits,measurements],
            sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()
        if required is None: raise ValueError('invalid_deck')
        source=validated(Transcript,transcript).model_dump(mode='json')
        if source['words'] and not source['text'].strip(): raise ValueError('inconsistent_transcript')
        visits=align_words(source['words'],slide_events,duration_ms)
        if visits != aligned_visits or any(v['slide_index']>=page_count for v in visits):
            raise ValueError('invalid_alignment')
        # Validate the measurements generated locally, never a client claim of speech.
        if (measurements.get('version')!='presentation-measurements-v1'
                or measurements.get('attempt_id')!=attempt_id or measurements.get('duration_ms')!=duration_ms
                or not re.fullmatch('[0-9a-f]{64}',measurements.get('audio_hash') or '')
                or measurements.get('status') not in ('available','insufficient_evidence')):
            raise ValueError('audio_unavailable')
        items=measurements['items']
        if not isinstance(items,list) or (measurements['status']=='insufficient_evidence' and items):
            raise ValueError('invalid_measurements')
        vad=[]
        for item in items:
            start,end=item['start_ms'],item['end_ms']
            if type(start) is not int or type(end) is not int or not 0<=start<end<=duration_ms:
                raise ValueError('invalid_measurements')
            if item['kind']=='speech': vad.append((start,end))
        vad=_union(vad)
        if measurements['status']=='available' and not vad: raise ValueError('invalid_measurements')
        starts=[v['start_ms'] for v in visits]
        from bisect import bisect_right
        indexes=[[] for _ in visits]
        for index,word in enumerate(source['words']): indexes[bisect_right(starts,word['start_ms'])-1].append(index)
        covered=set()
        visited={v['slide_index'] for v in visits if v['end_ms']>v['start_ms']}
        for visit_id,visit in enumerate(visits):
            pieces=[]
            for index in indexes[visit_id]:
                word=source['words'][index]
                if not any(c.isalnum() for c in word['text']): continue
                for start,end in vad:
                    left=max(start,word['start_ms'],visit['start_ms'])
                    right=min(end,word['end_ms'],visit['end_ms'])
                    if right>left: pieces.append((left,right,index))
            episodes=[]
            for piece in sorted(pieces):
                if not episodes or piece[0]-max(p[1] for p in episodes[-1])>MAX_EPISODE_GAP_MS:
                    episodes.append([])
                episodes[-1].append(piece)
            for episode in episodes:
                intervals=_union([(s,e) for s,e,_ in episode])
                speech_ms=sum(e-s for s,e in intervals)
                word_indexes=sorted({i for _,_,i in episode})
                text=' '.join(source['words'][i]['text'] for i in word_indexes)
                lexical=re.findall(r'[^\W_]+',text,flags=re.UNICODE)
                if speech_ms>=MIN_SPEECH_MS and (len(lexical)>=2 or sum(c.isalnum() for c in text)>=4):
                    covered.add(visit['slide_index'])
                    result['supporting_intervals'].append({'slide_index':visit['slide_index'],'visit_id':visit_id,
                        'start_ms':intervals[0][0],'end_ms':intervals[-1][1], 'supported_speech_ms':speech_ms,
                        'intervals':[{'start_ms':s,'end_ms':e} for s,e in intervals],'word_indexes':word_indexes})
        missing=sorted(set(required)-visited)
        lacking=sorted(set(required)&visited-covered)
        result.update(eligible=not missing and not lacking,status='incomplete' if missing or lacking else 'eligible',
            covered_slides=sorted(covered & set(required)),missing_slides=missing,slides_lacking_meaningful_speech=lacking)
        if missing: result['reasons'].append('required_slides_not_visited')
        if lacking: result['reasons'].append('required_slides_lack_meaningful_speech')
    except (FeedbackError,ValueError,TypeError,KeyError,AttributeError,IndexError):
        result['reasons']=['source_evidence_unavailable_or_unreliable']
    return result


def for_attempt(attempt, measurements):
    return evaluate(attempt_id=str(attempt.pk),page_count=attempt.deck.page_count,duration_ms=attempt.duration_ms,
        slide_events=attempt.slide_events,transcript=attempt.transcript,aligned_visits=attempt.visits,measurements=measurements)
