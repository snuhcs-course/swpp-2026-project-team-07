/** Eligible selected recordings share one automatic assessment across all screens. */
import { useEffect } from 'react';
import { API_URL } from '../../services/api';
import { runAttemptIds } from '../../domain/run';
import { getDeckState, useStore, visibleDecks } from '../presentations/store';
import { readRequirements } from '../presentations/requirementsStore';
import { useDeckModel } from '../presentations/useDeckModel';
import { automaticScoreEnabled, enableAutomaticScore } from './automaticPresentationScore';
import { selectedPresentationScores } from './selectedPresentationScores';
import { usePresentationScore } from './usePresentationScore';
import type { ScoreTarget } from './presentationScore';

export function InitialPresentationScoreHost({openedDeckId}:{openedDeckId:string|null}) {
 const version=useStore(s=>s.version);
 useEffect(()=>{
  if(!openedDeckId)return;
  const saved=getDeckState(openedDeckId);
  if(!saved.compare)for(const id of runAttemptIds(saved.run))enableAutomaticScore(API_URL,id);
 },[openedDeckId,version]);
 return <>{visibleDecks().map(deck=><DeckWorker key={deck.id} id={deck.id}/>)}</>;
}
function DeckWorker({id}:{id:string}) {
 const model=useDeckModel(id);
 if(!model||model.state.compare)return null;
 const derived=selectedPresentationScores(model,API_URL);
 return <>{derived.targets.filter(target=>automaticScoreEnabled(API_URL,target.id)&&derived.items.some(item=>item.target?.id===target.id)).map(target=><SourceWorker
  key={JSON.stringify([target.id,target.contextId,target.review?.transcript_id])} target={target}
  revision={target.contextId?readRequirements(id,API_URL).revision:null} localDeckId={id}/>)}</>;
}
function SourceWorker({target,revision,localDeckId}:{target:ScoreTarget;revision:number|null;localDeckId:string}) {
 usePresentationScore(target,revision,localDeckId,true,true);return null;
}
