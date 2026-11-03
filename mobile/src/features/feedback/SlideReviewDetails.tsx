// OpenAI Codex, issue #49: docs/ai-collaboration-prompts-iteration-2.md.
import { useMemo, type ReactNode } from 'react';
import { Txt } from '../../design/frame';
import { createThemedStyles, useTheme } from '../../design/theme';
import { C, F } from '../../design/tokens';
import type { ReviewAttempt } from '../../contracts';
import type { SlidePart } from '../../domain/run';
import { API_URL } from '../../services/api';
import { useStore } from '../presentations/store';
import { readRequirements } from '../presentations/requirementsStore';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { readReview } from '../transcription/reviewStorage';
import { reviewScope, reviewStatus } from './slideReview';
import { useSlideReview } from './useSlideReview';
import { SlideReviewAction, SlideReviewRecoveryControls } from './SlideReviewRecoveryControls';

type Props={slide:number;part:SlidePart;localDeckId:string;status:string;children:ReactNode};

/** Mounted only inside the visible selected-slide dialog; opening it never generates feedback. */
export function SlideReviewDetails(props:Props) {
 useTheme();
 const {part,status,children}=props;
 const version=useStore(s=>s.version);
 const review=useMemo(()=>{void version;try{return readReview(API_URL,part.attemptId);}catch{return null;}},[part.attemptId,version]);
 if(!review?.transcript?.words.length)return <>
  <Txt accessibilityLiveRegion="polite" style={styles.status}>{status}</Txt>
  {children}
  <Txt style={styles.note}>AI feedback needs a transcript with usable word timing.</Txt>
 </>;
 return <ReadySlideReviewDetails {...props} review={review}/>;
}
function ReadySlideReviewDetails({slide,part,localDeckId,status,children,review}:Props&{review:ReviewAttempt}) {
 useTheme();
 let context:string|null=null,revision:number|null=null;
 try{const r=readRequirements(localDeckId,API_URL);if(r.deckId===review?.deck_id){context=r.contextId;revision=context?r.revision:null;}}catch{/* Missing settings cannot authorize another context. */}
 const scope=reviewScope(slide,part,context);
 const fb=useSlideReview(part.attemptId,scope,review,revision,false,localDeckId);
 const dirty=requirementsDirty(localDeckId,API_URL);
 const state=fb.state,summary=state?.state==='completed'&&!state.stale&&!state.result?.stale?state.result?.slides.find(value=>value.slide_index===slide):null;
 return <>
  <Txt accessibilityLiveRegion="polite" style={styles.status}>{state?reviewStatus(state,slide):status}</Txt>
  {dirty&&<Txt style={styles.note}>Presentation settings saved on phone · synchronize before updating AI feedback.</Txt>}
  {summary?.status==='partial'&&<Txt style={styles.note}>Verified findings are shown below. Some other feedback could not be verified.</Txt>}
  {summary?.status==='insufficient_evidence'&&<Txt style={styles.note}>Your recording is preserved. This is insufficient evidence, not a completed assessment without issues.</Txt>}
  {children}
  <SlideReviewAction label="Refresh slide feedback status" text="Refresh status" disabled={fb.busy} onPress={()=>void fb.refresh()}/>
  <SlideReviewRecoveryControls feedback={fb} slide={slide} ready dirty={dirty}/>
 </>;
}
const styles=createThemedStyles({
 status:{fontFamily:F.semibold,fontSize:14,color:C.text},
 note:{fontFamily:F.medium,fontSize:12,lineHeight:18,color:C.secondary},
});
