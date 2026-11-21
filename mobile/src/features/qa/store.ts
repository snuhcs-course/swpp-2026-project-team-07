// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: saved Audience Q&A per presentation (questions, answers, reviews).
import { listStored, readStored, writeStored } from '../../services/storage';
import { API_URL } from '../../services/api';
import { normalizeApi } from '../transcription/analysisStorage';
import type { QaQuestion, QaResult } from './client';
import {parseQaState,qaUsable,sameScope,type QaScope,type QaState,type SavedQuestionBatch} from './state';

export type StoredAnswer = { id?: string; questionId?: string; questionJobId?: number; audioUri: string; durationMs: number; status: 'judging' | 'done' | 'error'; result?: QaResult; error?: string; at: string };
export type QaSet = { jobId?:number; runId: string; scope?:QaScope; audience: string; questions: QaQuestion[]; answers: Record<string, StoredAnswer>; createdAt: string };

const KEY = (deckId: string) => `qa:v1:${deckId}`;
export function readQa(deckId: string): QaSet | null {
  const v = readStored<QaSet>(KEY(deckId));
  return v && Array.isArray(v.questions) && v.answers && typeof v.answers === 'object' ? v : null;
}
export function saveQa(deckId: string, set: QaSet) { writeStored(KEY(deckId), set); }
export const answerKey = (i: number, part: 0 | 1) => i + '-' + part;

const CONSENT = () => `qa-consent:v1:${normalizeApi(API_URL)}`;
export const hasQaConsent = () => readStored<boolean>(CONSENT()) === true;
export const saveQaConsent = () => writeStored(CONSENT(), true);

// Versioned, API/presentation/question-generation namespace. Legacy qa:v1 is preserved.
const v2key=(api:string,presentation:string,job:number)=>`qa:v2:${normalizeApi(api)}:${encodeURIComponent(presentation)}:${job}`;
export function readQaV2(api:string,presentation:string,job:number):QaSet|null{return readStored(v2key(api,presentation,job));}
export function saveQaV2(api:string,presentation:string,job:number,value:QaSet){
 writeStored(v2key(api,presentation,job),{...value,jobId:job});
 const index=`qa-index:v2:${normalizeApi(api)}:${encodeURIComponent(presentation)}`;
 const jobs=readStored<number[]>(index)??[];
 if(!jobs.includes(job))writeStored(index,[job,...jobs]);
}
/** A status GET may recover an assessment whose original audience context is no longer selected. */
export function saveHistoricalQuestions(api:string,presentation:string,runId:string,batches:SavedQuestionBatch[]){
 for(const batch of [...batches].reverse()){
  const saved=readQaV2(api,presentation,batch.job_id);
  if(saved){
   if(!saved.scope && saved.questions.length===batch.questions.length&&saved.questions.every((q,i)=>q.id===batch.questions[i].id)){
    saveQaV2(api,presentation,batch.job_id,{...saved,scope:batch.scope});
   }
   continue;
  }
  saveQaV2(api,presentation,batch.job_id,{runId,scope:batch.scope,audience:batch.requirements.audience,
    questions:batch.questions,answers:{},createdAt:batch.completed_at??''});
 }
}
/** Older installs wrote background results under their original context before the screen was ever opened. */
export function recoverLocalQuestions(api:string,presentation:string,runId:string,anchor:string,scope:QaScope){
 const prefix='qa-state:v2:'+JSON.stringify([normalizeApi(api),anchor]).slice(0,-1)+',';
 const found:SavedQuestionBatch[]=[];
 for(const row of listStored<Partial<QaState>|null>(prefix)){
  if(!row?.scope||!row.result||!qaUsable(row as QaState))continue;
  try{
   const saved=parseQaState(row,anchor,{...scope,context_id:row.scope.context_id});
   found.push({...saved.result!,scope:saved.scope,requirements:saved.requirements,feedback_revision:saved.feedback_revision,completed_at:saved.updated_at??null});
  }catch{ /* A different set of visits or an unreadable row cannot identify this rehearsal. */ }
 }
 saveHistoricalQuestions(api,presentation,runId,found.sort((a,b)=>b.job_id-a.job_id).slice(0,12));
 return found.length>0;
}
export function readQaHistory(api:string,presentation:string):QaSet[]{
 const index=`qa-index:v2:${normalizeApi(api)}:${encodeURIComponent(presentation)}`;
 const sets=(readStored<number[]>(index)??[]).sort((a,b)=>b-a).flatMap(job=>{const s=readQaV2(api,presentation,job);return s?[s]:[];});
 const legacy=readQa(presentation);if(legacy)sets.push(legacy);
 return sets;
}
export function savedForSelectedRun(history: QaSet[], runId: string, scope: QaScope, audience: string) {
 return history.find(saved => saved.questions.length && (saved.scope
   ? sameScope(saved.scope,{ ...scope,context_id:saved.scope.context_id }) : saved.runId === runId) &&
   (!scope.context_id || ((!saved.scope || saved.scope.context_id === scope.context_id) && saved.audience === audience)));
}
export function saveAnswerAttempt(api:string,presentation:string,answer:StoredAnswer){
 if(!answer.id)throw new Error('Missing answer identity.');
 writeStored(`qa-answer:v2:${normalizeApi(api)}:${encodeURIComponent(presentation)}:${answer.id}`,answer);
}
