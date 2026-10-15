/** Selected-run initial feedback workflow; independent of which screen is open. */
import { useSyncExternalStore } from 'react';
import { API_URL } from '../../services/api';
import { getDeckState, useStore, visibleDecks } from '../presentations/store';
import { getRequirementsVersion, readRequirements, subscribeRequirements } from '../presentations/requirementsStore';
import { readReview } from '../transcription/reviewStorage';
import { reviewScope, type ReviewScope } from './slideReview';
import { initialFeedbackEnabled } from './automaticFeedback';
import { useSlideReview } from './useSlideReview';
import type { ReviewAttempt } from '../../contracts';

export function InitialFeedbackHost() {
 useStore(s=>s.version);
 useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 const tasks:{id:string;scope:ReviewScope;review:ReviewAttempt;revision:number|null}[]=[];
 for(const deck of visibleDecks()) {
  const saved=getDeckState(deck.id);
  // Pending comparisons have not yet authorized a new selected take.
  if(saved.compare)continue;
  saved.run?.parts.forEach((part,index)=>{
   if(!part||!initialFeedbackEnabled(API_URL,part.attemptId))return;
   try{
    const review=readReview(API_URL,part.attemptId);
    if(!review?.transcript?.words.length||!review.deck_id)return;
    const r=readRequirements(deck.id,API_URL);
    const context=r.deckId===review.deck_id?r.contextId:null;
    tasks.push({id:part.attemptId,scope:reviewScope(index,part,context),review,revision:context?r.revision:null});
   }catch{/* Local recording and playback remain usable without feedback data. */}
  });
 }
 return <>{tasks.map(task=><InitialWorker key={JSON.stringify([task.id,task.scope])} {...task}/>)}</>;
}
function InitialWorker({id,scope,review,revision}:{id:string;scope:ReviewScope;review:ReviewAttempt;revision:number|null}) {
 useSlideReview(id,scope,review,revision,true);
 return null;
}
