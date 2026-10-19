/** Eligibility and durable attempt guards for the existing scoring transport. */
import type { LocalCorrections } from '../../domain/corrections';
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { bump } from '../presentations/store';
import type { PresentationScore, ScoreTarget } from './presentationScore';
import { presentationScoreKey } from './presentationScoreStore';

const eligibilityKey=(api:string,id:string)=>`score-auto-eligible:v1:${normalizeApi(api)}:${id}`;
export const automaticScoreEnabled=(api:string,id:string)=>readStored<boolean>(eligibilityKey(api,id))===true;
export function enableAutomaticScore(api:string,id:string) {
 if(automaticScoreEnabled(api,id))return;
 writeStored(eligibilityKey(api,id),true);bump();
}
export type AutomaticScoreAttempt={input:string;state:'attempted'|'preflight_failed';retryAt:number;notice:string};
const attemptKey=(api:string,target:ScoreTarget)=>`${presentationScoreKey(api,target)}:automatic`;
export const readAutomaticScoreAttempt=(api:string,target:ScoreTarget)=>readStored<AutomaticScoreAttempt>(attemptKey(api,target));
export function saveAutomaticScoreAttempt(api:string,target:ScoreTarget,record:AutomaticScoreAttempt) {
 writeStored(attemptKey(api,target),record);bump();
}
/** Stable inputs, never mutable job status or feedback revision. No transcript text is stored. */
export function automaticScoreInput(api:string,target:ScoreTarget,revision:number|null,correction:LocalCorrections|null,state:PresentationScore) {
 return JSON.stringify([presentationScoreKey(api,target),target.pageCount,target.review?.deck_id,
  target.review?.duration_ms,target.review?.slide_events,revision,correction?.server.revision??0,
  state.selection?.token,state.source_identity,state.dependency?.description_set_id,state.dependency?.processing_revision]);
}
