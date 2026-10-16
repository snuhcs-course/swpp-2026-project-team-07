/** Validated, API/attempt/context/transcript/source-aware cache. Lifecycle reads use GET only. */
import type { LocalCorrections } from '../../domain/corrections';
import { readStored,writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { bump } from '../presentations/store';
import { parsePresentationScore,SCORE_VERSION,type PresentationScore,type ScoreTarget } from './presentationScore';
export const presentationScoreKey=(api:string,t:ScoreTarget)=>`score:${SCORE_VERSION}:${JSON.stringify([normalizeApi(api),t.id,t.contextId,t.review?.transcript_id??null])}`;
const sourceKey=(api:string,t:ScoreTarget,source:string|null)=>`${presentationScoreKey(api,t)}:source:${source??'ungraded'}`;
export function readPresentationScore(api:string,t:ScoreTarget):PresentationScore|null {
 try{const source=readStored<string|null>(`${presentationScoreKey(api,t)}:current`),raw=readStored<unknown>(sourceKey(api,t,source));return raw?parsePresentationScore(raw,t):null;}catch{return null;}
}
const rank:Record<string,number>={absent:0,queued:1,waiting_descriptions:1,waiting_quota:2,preparing:2,submitted:3,normalizing:4,failed:5,needs_confirmation:5,completed:6,stale:7};
export function publishPresentationScore(api:string,raw:PresentationScore,t:ScoreTarget):PresentationScore {
 const next=parsePresentationScore(raw,t),previous=readPresentationScore(api,t);
 if(previous){
  const a=previous,b=next;
  const oldTime=a.updated_at??'',newTime=b.updated_at??'';
  if(a.feedback_revision>b.feedback_revision||a.feedback_revision===b.feedback_revision&&(oldTime>newTime||oldTime===newTime&&(rank[a.state]??0)>(rank[b.state]??0)))return previous;
 }
 if(JSON.stringify(next)!==JSON.stringify(previous)){
  writeStored(sourceKey(api,t,next.source_identity),next);writeStored(`${presentationScoreKey(api,t)}:current`,next.source_identity);bump();
 }
 return next;
}
export function effectivePresentationScore(raw:PresentationScore|null,input:{requirementsRevision:number|null;correction:LocalCorrections|null;transcriptId?:string|null;dirty:boolean}):PresentationScore|null {
 if(!raw)return null;
 const c=input.correction,changed=input.dirty||raw.requirements.revision!==input.requirementsRevision||
 !!raw.result&&raw.result.evidence.transcript_id!==input.transcriptId||!!c&&(c.pending||c.conflict||c.server.source_changed||c.server.base_transcript_id!==input.transcriptId||c.server.revision!==raw.transcript_revision)||!c&&raw.transcript_revision>0;
 return changed?{...raw,stale:true}:raw;
}
const flights=new Map<string,Promise<PresentationScore>>();
let reads=0;const queue:(()=>void)[]=[];
function schedule<T>(fn:()=>Promise<T>):Promise<T>{return new Promise((resolve,reject)=>{const start=()=>{reads++;void fn().then(resolve,reject).finally(()=>{reads--;queue.shift()?.();});};if(reads<3)start();else queue.push(start);});}
export function createPresentationScoreReader(apiUrl:string,transport:typeof globalThis.fetch=globalThis.fetch){
 const api=normalizeApi(apiUrl);
 return {read(t:ScoreTarget):Promise<PresentationScore>{
  const key=presentationScoreKey(api,t),existing=flights.get(key);if(existing)return existing;
  const promise=schedule(async()=>{
   const url=`${api}/attempts/${t.id}/presentation-score/${t.contextId?`?context_id=${encodeURIComponent(t.contextId)}`:''}`;
   const response=await transport(url,{method:'GET',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('Could not refresh score. Saved results are retained.');
   return publishPresentationScore(api,parsePresentationScore(await response.json(),t),t);
  }).finally(()=>{if(flights.get(key)===promise)flights.delete(key);});flights.set(key,promise);return promise;
 }};
}
export const scoreSubmissionLocks=new Set<string>();
