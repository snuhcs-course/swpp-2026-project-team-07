import type {Run} from '../../domain/run';
import type {QaQuestion} from './client';
export const QA_VERSION='audience-qa-v2';
export type QaScope={context_id:string|null;slides:{slide_index:number;attempt_id:string;segments:{start_ms:number;end_ms:number}[]}[]};
type QuestionBatch={qa_version:string;job_id:number;questions:(QaQuestion&{id:string})[]};
type Requirements={context_id:string|null;revision:number|null;audience:string};
export type SavedQuestionBatch=QuestionBatch&{feedback_revision:number;completed_at:string|null;scope:QaScope;requirements:Requirements};
export type QaState={attempt_id:string;scope:QaScope;qa_version:string;state:string;feedback_revision:number;stale:boolean;
 source_revisions:Record<string,number>;requirements:Requirements;
 selection:{token:string}|null;availability:{state:string};retry_available:boolean;requires_confirmation:boolean;
 dependency?:{retry_action:string|null;retry_available:boolean;requires_confirmation:boolean;description_set_id:string;processing_revision:number}|null;
 updated_at?:string|null;error?:{message:string}|null;
 result:({stale:boolean}&QuestionBatch)|null;saved_question_sets?:SavedQuestionBatch[]};
export function qaScope(run:Pick<Run,'parts'>,context:string|null):QaScope {
 return {context_id:context,slides:run.parts.flatMap((p,i)=>p?[{slide_index:i,attempt_id:p.attemptId,segments:p.segments.map(s=>({start_ms:s.startMs,end_ms:s.endMs}))}]:[])};
}
export function qaAnchor(scope:QaScope):string|null{return scope.slides.map(s=>s.attempt_id).sort()[0]??null;}
export function qaOutdated(state:QaState,revision:number|null,sources:Record<string,{revision:number;pending?:boolean;conflict?:boolean;sourceChanged?:boolean}>){
 return state.stale||state.requirements.revision!==revision||Object.entries(state.source_revisions).some(([id,rev])=>{
  const c=sources[id];return !c||c.revision!==rev||c.pending||c.conflict||c.sourceChanged;
 });
}
export function sameScope(raw:QaScope|undefined,expected:QaScope):boolean {
 return !!raw&&raw.context_id===expected.context_id&&Array.isArray(raw.slides)&&raw.slides.length===expected.slides.length&&
  raw.slides.every((slide,i)=>{
   const wanted=expected.slides[i];
   return !!slide&&slide.slide_index===wanted.slide_index&&slide.attempt_id===wanted.attempt_id&&Array.isArray(slide.segments)&&
    slide.segments.length===wanted.segments.length&&slide.segments.every((segment,j)=>!!segment&&
     segment.start_ms===wanted.segments[j].start_ms&&segment.end_ms===wanted.segments[j].end_ms);
  });
}
function validQuestions(batch:QuestionBatch,scope:QaScope){
 if(batch.qa_version!==QA_VERSION||!Number.isSafeInteger(batch.job_id)||batch.job_id<1||
  !Array.isArray(batch.questions)||batch.questions.length<1||batch.questions.length>3)return false;
 const seen=new Set<string>();
 return batch.questions.every(q=>{
  if(!q||typeof q.id!=='string'||!(/^[a-f0-9]{32}$/.test(q.id))||seen.has(q.id)||!scope.slides.some(s=>s.slide_index===q.slide_index)||
   ![q.question,q.follow_up,q.role,q.panelist].every(x=>typeof x==='string'&&!!x.trim())||
   Array.from(q.question).length>600||Array.from(q.follow_up).length>600||Array.from(q.panelist).length>64||
   Array.from(q.role).length>60||typeof q.topic!=='string'||Array.from(q.topic).length>80)return false;
  seen.add(q.id);return true;
 });
}
function validRequirements(raw:Requirements|undefined,contextId:string|null){
 return !!raw&&raw.context_id===contextId&&typeof raw.audience==='string'&&
  (raw.revision===null||Number.isSafeInteger(raw.revision)&&raw.revision>=0);
}
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function parseQaState(raw:unknown,id:string,scope:QaScope):QaState {
 const s=raw as QaState;const bad=()=>{throw new QaResponseError();};
 if(!s||s.attempt_id!==id||s.qa_version!==QA_VERSION||!sameScope(s.scope,scope)||
 !Number.isSafeInteger(s.feedback_revision)||s.feedback_revision<0||typeof s.stale!=='boolean'||
 !['absent','disabled','unavailable','completed','failed','stale','needs_confirmation','queued','waiting_descriptions','preparing','submitted','normalizing','waiting_quota'].includes(s.state)||
 typeof s.retry_available!=='boolean'||typeof s.requires_confirmation!=='boolean'||
 !validRequirements(s.requirements,scope.context_id)||
 !s.availability||!['available','disabled','unavailable'].includes(s.availability.state)||
 (s.selection!=null&&!/^[a-f0-9]{64}$/.test(s.selection.token))||!s.source_revisions||Object.values(s.source_revisions).some(v=>!Number.isSafeInteger(v)||v<0))bad();
 if(s.result&&(typeof s.result.stale!=='boolean'||!validQuestions(s.result,scope)))bad();
 if(s.saved_question_sets!==undefined){
  const sets=s.saved_question_sets;
  if(!Array.isArray(sets)||sets.length>12)bad();
  const seen=new Set<number>();
  for(const batch of sets){
   const context=batch?.scope?.context_id;
   if(!batch||!(context===null||typeof context==='string'&&uuid.test(context))||
     !sameScope(batch.scope,{...scope,context_id:context})||!validRequirements(batch.requirements,context)||
     !Number.isSafeInteger(batch.feedback_revision)||batch.feedback_revision<1||
     !(batch.completed_at===null||typeof batch.completed_at==='string'&&Number.isFinite(Date.parse(batch.completed_at)))||
     !validQuestions(batch,scope)||seen.has(batch.job_id))bad();
   seen.add(batch.job_id);
  }
 }
 return s;
}
export class QaResponseError extends Error {
 constructor(){super('Invalid Q&A response. Saved questions and recordings are preserved.');}
}
export const qaActive=(s:QaState|null)=>!!s&&!s.stale&&!s.dependency?.retry_action&&['waiting_descriptions','queued','preparing','submitted','normalizing','waiting_quota'].includes(s.state);

export function qaUsable(state:QaState|null):boolean{return !!state&&state.state==='completed'&&!state.stale&&!!state.result&&!state.result.stale;}
export function qaHistoryJobs<T extends {jobId?:number}>(sets:T[],state:QaState|null):T[]{return sets.filter(s=>!qaUsable(state)||s.jobId!==state!.result!.job_id);}
export function qaScreenKey(state:QaState|null){return `${state?.result?.job_id??0}:${qaUsable(state)?'ready':'unavailable'}`;}
