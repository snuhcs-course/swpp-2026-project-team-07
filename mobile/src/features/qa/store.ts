// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: saved Audience Q&A per presentation (questions, answers, reviews).
import { readStored, writeStored } from '../../services/storage';
import { API_URL } from '../../services/api';
import { normalizeApi } from '../transcription/analysisStorage';
import type { QaQuestion, QaResult } from './client';

export type StoredAnswer = { id?: string; questionId?: string; questionJobId?: number; audioUri: string; durationMs: number; status: 'judging' | 'done' | 'error'; result?: QaResult; error?: string; at: string };
export type QaSet = { jobId?:number; runId: string; audience: string; questions: QaQuestion[]; answers: Record<string, StoredAnswer>; createdAt: string };

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
export function readQaHistory(api:string,presentation:string):QaSet[]{
 const index=`qa-index:v2:${normalizeApi(api)}:${encodeURIComponent(presentation)}`;
 const sets=(readStored<number[]>(index)??[]).flatMap(job=>{const s=readQaV2(api,presentation,job);return s?[s]:[];});
 const legacy=readQa(presentation);if(legacy)sets.push(legacy);
 return sets;
}
export function saveAnswerAttempt(api:string,presentation:string,answer:StoredAnswer){
 if(!answer.id)throw new Error('Missing answer identity.');
 writeStored(`qa-answer:v2:${normalizeApi(api)}:${encodeURIComponent(presentation)}:${answer.id}`,answer);
}
