/** Current performance scores for exact original selected audio; no network or generation. */
import type { DeckModel } from '../presentations/useDeckModel';
import { readStored } from '../../services/storage';
import { readRequirements } from '../presentations/requirementsStore';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { defaultRequirementsPending } from '../presentations/defaultRequirements';
import { readCorrections } from '../presentations/correctionStore';
import { readReview } from '../transcription/reviewStorage';
import { runAttemptIds } from '../../domain/run';
import { normalizeApi } from '../transcription/analysisStorage';
import { scoreActive,scorePartMatches,scoreRunAttempt,scoreStatus,type PresentationScore,type ScoreTarget,type SlideScore,type ScoreResult,type ScoreLevel } from './presentationScore';
import { effectivePresentationScore,readPresentationScore,presentationScoreKey,scoreSubmissionLocks } from './presentationScoreStore';

export type PresentationSlideDisplay={slide:number;score:number|null;level:ScoreLevel|null;status:string;
 state:PresentationScore|null;result:SlideScore|null;target:ScoreTarget|null};
export type PresentationOverallDisplay={score:number|null;level:ScoreLevel|null;status:string;
 state:PresentationScore|null;result:ScoreResult|null;target:ScoreTarget|null};
export function selectedPresentationScores(model:DeckModel|null,apiUrl:string,selectedSlide?:number){
 const api=normalizeApi(apiUrl),targets:ScoreTarget[]=[],activeTargets:ScoreTarget[]=[];
 const empty:PresentationOverallDisplay={score:null,level:null,status:'Not graded',state:null,result:null,target:null};
 if(!model)return {items:[] as PresentationSlideDisplay[],overall:empty,target:null,requirementsRevision:null,targets,activeTargets};
 let settings:ReturnType<typeof readRequirements>|null=null,settingsValid=true;
 try{settings=readRequirements(model.deck.id,api);}catch{settingsValid=false;}
 const dirty=!settingsValid||requirementsDirty(model.deck.id,api)||defaultRequirementsPending(model.deck.id,api);
 const sourceDeck=readStored<string>(`server-deck:${api}:${model.deck.id}`),run=model.state.run;
 const sources=new Map<string,{target:ScoreTarget;state:PresentationScore|null}>();
 for(const id of run?runAttemptIds(run):[]){
  const review=readReview(api,id);
  if(!settingsValid||!review?.transcript_id||!review.transcript?.words.length||!review.slide_events.length||
   sourceDeck&&sourceDeck!==review.deck_id)continue;
  const contextId=settings?.deckId===review.deck_id?settings?.contextId??null:null;
  const target:ScoreTarget={id,contextId,review,pageCount:model.n};
  let correction:ReturnType<typeof readCorrections>=null,unreadable=false;
  try{correction=readCorrections(api,id);}catch{unreadable=true;}
  const value=effectivePresentationScore(readPresentationScore(api,target),{
   requirementsRevision:contextId?settings!.revision:null,correction,dirty:dirty||unreadable,transcriptId:review.transcript_id});
  sources.set(id,{target,state:value});targets.push(target);if(scoreActive(value))activeTargets.push(target);
 }
 // A shared in-flight controller owns the request before the server returns a job.
 const sourceStatus=(target:ScoreTarget,state:PresentationScore|null)=>scoreSubmissionLocks.has(presentationScoreKey(api,target))&&(!state||state.state!=='completed'||state.stale)?state?.stale?'Score outdated':'Scoring…':scoreStatus(state);
 const items:PresentationSlideDisplay[]=Array.from({length:model.n},(_,slide)=>{
  const part=run?.parts[slide],source=part?sources.get(part.attemptId):undefined;
  const recorded=!!part?.segments.some(s=>s.endMs>s.startMs);
  const matching=!!source&&scorePartMatches(part,source.target.review,slide);
  const state=matching?source!.state:null;
  const current=state?.state==='completed'&&!state.stale;
  const result=current?state.result?.slides.find(row=>row.slide_index===slide)??null:null;
  const score=result?.status==='scored'?result.score:null;
  const status=!recorded?'Not recorded':!settingsValid?'Presentation settings unavailable':!source?(model.stages.get(part!.attemptId)==='no_speech'?'No speech detected':model.stages.get(part!.attemptId)==='done'?'No usable word timing':'Transcript pending'):!matching?'Recording selection changed':
   result&&result.status!=='scored'?({not_applicable:'Not applicable',not_recorded:'Not recorded',insufficient_evidence:'Insufficient evidence',invalid_evidence:'Score evidence could not be verified'}[result.status]??sourceStatus(source!.target,state)):sourceStatus(source!.target,state);
  return {slide,score,level:score!==null?result!.level:null,status,state,result,target:matching?source!.target:null};
 });
 const ids=run?runAttemptIds(run):[],sole=ids.length===1?sources.get(ids[0]):undefined;
 const exact=!!sole&&!!run&&scoreRunAttempt(run,[sole.target.review!],model.n,sole.state?.result)===sole.target.id;
 const wholeTarget=exact?sole!.target:null,state=sole?.state??null;
 const result=exact&&state?.state==='completed'&&!state.stale?state.result:null;
 const overall:PresentationOverallDisplay={score:result?.overall.status==='scored'?result.overall.score:null,
  level:result?.overall.status==='scored'?result.overall.level:null,status:ids.length>1?'Combined recordings':!exact?'Select a complete recording':sourceStatus(wholeTarget!,state),
  state,result,target:wholeTarget};
 const target=selectedSlide===undefined?wholeTarget:items[selectedSlide]?.target??null;
 return {items,overall,target,requirementsRevision:target?.contextId?settings!.revision:null,targets,activeTargets};
}
