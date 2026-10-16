/** Selected-run initial feedback workflow; independent of which screen is open. */
import { useSyncExternalStore } from 'react';
import { API_URL } from '../../services/api';
import { getDeckState, useStore, visibleDecks } from '../presentations/store';
import { getRequirementsVersion, readRequirements, subscribeRequirements } from '../presentations/requirementsStore';
import { requirementsPending } from '../presentations/requirementsDraft';
import { defaultRequirementsPending } from '../presentations/defaultRequirements';
import { readReview } from '../transcription/reviewStorage';
import { reviewScope } from './slideReview';
import { initialFeedbackEnabled } from './automaticFeedback';
import { useSlideReview } from './useSlideReview';
import type { ReviewAttempt } from '../../contracts';
import type { ReviewScope } from './slideReview';

type InitialReviewTask={id:string;scope:ReviewScope;review:ReviewAttempt;revision:number|null;localDeckId:string};

export function InitialFeedbackHost() {
 useStore(s=>s.version);
 useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 const tasks:InitialReviewTask[]=[];
 for(const deck of visibleDecks()) {
  const saved=getDeckState(deck.id);
  // Pending comparisons have not yet authorized a new selected take.
  if(saved.compare||defaultRequirementsPending(deck.id,API_URL)||requirementsPending(deck.id,API_URL))continue;
  saved.run?.parts.forEach((part,index)=>{
   if(!part||!initialFeedbackEnabled(API_URL,part.attemptId))return;
   try{
    const review=readReview(API_URL,part.attemptId);
    if(!review?.transcript?.words.length||!review.deck_id)return;
    const r=readRequirements(deck.id,API_URL);
    const context=r.deckId===review.deck_id?r.contextId:null;
    tasks.push({id:part.attemptId,scope:reviewScope(index,part,context),review,revision:context?r.revision:null,localDeckId:deck.id});
   }catch{/* Local recording and playback remain usable without feedback data. */}
  });
 }
 return <>{tasks.map(task=><InitialWorker key={JSON.stringify([task.id,task.scope])} {...task}/>)}</>;
}
function InitialWorker({id,scope,review,revision,localDeckId}:InitialReviewTask) {
 useSlideReview(id,scope,review,revision,true,localDeckId);
 return null;
}
