import type {Run} from '../../domain/run';
import type {QaQuestion} from './client';
export const QA_VERSION='audience-qa-v2';
export type QaScope={context_id:string|null;slides:{slide_index:number;attempt_id:string;segments:{start_ms:number;end_ms:number}[]}[]};
export type QaState={attempt_id:string;scope:QaScope;qa_version:string;state:string;feedback_revision:number;stale:boolean;
 source_revisions:Record<string,number>;requirements:{context_id:string|null;revision:number|null;audience:string};
 selection:{token:string}|null;availability:{state:string};retry_available:boolean;requires_confirmation:boolean;
 dependency?:{retry_action:string|null;retry_available:boolean;requires_confirmation:boolean;description_set_id:string;processing_revision:number}|null;
 updated_at?:string|null;error?:{message:string}|null;
 result:{stale:boolean;qa_version:string;job_id:number;questions:(QaQuestion&{id:string})[]}|null};
export function qaScope(run:Pick<Run,'parts'>,context:string|null):QaScope {
 return {context_id:context,slides:run.parts.flatMap((p,i)=>p?[{slide_index:i,attempt_id:p.attemptId,segments:p.segments.map(s=>({start_ms:s.startMs,end_ms:s.endMs}))}]:[])};
}
export function qaAnchor(scope:QaScope):string|null{return scope.slides.map(s=>s.attempt_id).sort()[0]??null;}
export function qaOutdated(state:QaState,revision:number|null,sources:Record<string,{revision:number;pending?:boolean;conflict?:boolean;sourceChanged?:boolean}>){
 return state.stale||state.requirements.revision!==revision||Object.entries(state.source_revisions).some(([id,rev])=>{
  const c=sources[id];return !c||c.revision!==rev||c.pending||c.conflict||c.sourceChanged;
 });
}
function sameScope(raw:QaScope|undefined,expected:QaScope):boolean {
 return !!raw&&raw.context_id===expected.context_id&&Array.isArray(raw.slides)&&raw.slides.length===expected.slides.length&&
  raw.slides.every((slide,i)=>{
   const wanted=expected.slides[i];
   return !!slide&&slide.slide_index===wanted.slide_index&&slide.attempt_id===wanted.attempt_id&&Array.isArray(slide.segments)&&
    slide.segments.length===wanted.segments.length&&slide.segments.every((segment,j)=>!!segment&&
     segment.start_ms===wanted.segments[j].start_ms&&segment.end_ms===wanted.segments[j].end_ms);
  });
}
export function parseQaState(raw:unknown,id:string,scope:QaScope):QaState {
 const s=raw as QaState;const bad=()=>{throw new Error('Invalid Q&A response. Saved questions and recordings are preserved.');};
 if(!s||s.attempt_id!==id||s.qa_version!==QA_VERSION||!sameScope(s.scope,scope)||
 !Number.isSafeInteger(s.feedback_revision)||s.feedback_revision<0||typeof s.stale!=='boolean'||
 !['absent','disabled','unavailable','completed','failed','stale','needs_confirmation','queued','waiting_descriptions','preparing','submitted','normalizing','waiting_quota'].includes(s.state)||
 typeof s.retry_available!=='boolean'||typeof s.requires_confirmation!=='boolean'||
 !s.requirements||s.requirements.context_id!==scope.context_id||typeof s.requirements.audience!=='string'||
 !(s.requirements.revision===null||Number.isSafeInteger(s.requirements.revision)&&s.requirements.revision>=0)||
 !s.availability||!['available','disabled','unavailable'].includes(s.availability.state)||
 (s.selection!=null&&!/^[a-f0-9]{64}$/.test(s.selection.token))||!s.source_revisions||Object.values(s.source_revisions).some(v=>!Number.isSafeInteger(v)||v<0))bad();
 if(s.result){
  const result=s.result,seen=new Set<string>();
  if(result.qa_version!==QA_VERSION||typeof result.stale!=='boolean'||!Number.isSafeInteger(result.job_id)||result.job_id<1||!Array.isArray(result.questions)||!result.questions.length||result.questions.length>3)bad();
  for(const q of result.questions){
   if(!q||!(/^[a-f0-9]{32}$/.test(q.id))||seen.has(q.id)||!scope.slides.some(x=>x.slide_index===q.slide_index)||
   ![q.question,q.follow_up,q.role,q.panelist].every(x=>typeof x==='string'&&!!x.trim())||q.question.length>600||q.follow_up.length>600)bad();
   seen.add(q.id);
  }
 }
 return s;
}
export const qaActive=(s:QaState|null)=>!!s&&!s.stale&&!s.dependency?.retry_action&&['waiting_descriptions','queued','preparing','submitted','normalizing','waiting_quota'].includes(s.state);

export function qaUsable(state:QaState|null):boolean{return !!state&&state.state==='completed'&&!state.stale&&!!state.result&&!state.result.stale;}
export function qaHistoryJobs<T extends {jobId?:number}>(sets:T[],state:QaState|null):T[]{return sets.filter(s=>!qaUsable(state)||s.jobId!==state!.result!.job_id);}
export function qaScreenKey(state:QaState|null){return `${state?.result?.job_id??0}:${qaUsable(state)?'ready':'unavailable'}`;}
