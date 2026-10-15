// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Audience Q&A API client (backend: rehearsals/qa_views.py).
// Questions are written from the slide text and the merged transcript; answers are
// transcribed with the existing hosted Whisper adapter and judged by the configured
// feedback provider. Provider keys stay on the server.
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import type { Transcript } from '../../contracts';
import { API_URL } from '../../services/api';
import { readStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { serverSlides } from '../presentations/serverDeck';
import type { Presentation } from '../presentations/store';

export type QaQuestion = { id?:string; panelist: string; role: string; slide_index: number; topic: string; question: string; follow_up: string };
export type QaVerdict = 'answered' | 'partly' | 'too_short';
export type QaResult = { transcript: Transcript; verdict: QaVerdict; did: string; evidence: string; clarify: string; duration_ms: number };
export class QaError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'QaError'; this.code = code; }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const api = () => normalizeApi(API_URL);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

async function deckIdFor(deck: Presentation, signal?: AbortSignal): Promise<string> {
  const cached = readStored<string>(`server-deck:${api()}:${deck.id}`);
  if (typeof cached === 'string' && uuid.test(cached)) return cached.toLowerCase();
  return (await serverSlides({ id: deck.id, title: deck.title, uri: deck.uri, pageCount: deck.pageCount }, API_URL, signal)).deckId;
}

async function failure(response: Response): Promise<QaError> {
  let code = '', message = `The server returned HTTP ${response.status}.`;
  try {
    const body = await response.json() as { error?: { code?: unknown; message?: unknown } };
    if (typeof body?.error?.code === 'string') code = body.error.code;
    if (typeof body?.error?.message === 'string') message = body.error.message;
  } catch { /* not a JSON error body */ }
  // A 404 without the API's error body means the route itself is missing (an older backend).
  if (response.status === 404 && !code) return new QaError('not_found', 'This server does not have Audience Q&A yet. Update the backend.');
  return new QaError(code || 'http_error', message);
}

/** POST for the presentation's server copy; if the server lost that copy, upload it again once and retry. */
async function postForDeck(deck: Presentation, send: (deckId: string) => Promise<Response>, signal?: AbortSignal): Promise<Response> {
  const response = await send(await deckIdFor(deck, signal));
  if (response.status !== 404) return response;
  const error = await failure(response);
  if (error.code !== 'deck_not_found') throw error;
  const fresh = await serverSlides({ id: deck.id, title: deck.title, uri: deck.uri, pageCount: deck.pageCount }, API_URL, signal);
  return send(fresh.deckId);
}

export async function generateQuestions(deck: Presentation, slides: { slide_index: number; title: string; transcript: string }[], audience: string,
  signal?: AbortSignal): Promise<QaQuestion[]> {
  let response: Response;
  try {
    const body = JSON.stringify({ audience: audience.slice(0, 200), slides: slides.map(s => ({ ...s, title: s.title.slice(0, 200), transcript: s.transcript.slice(0, 6000) })) });
    response = await postForDeck(deck, deckId => fetch(`${api()}/decks/${deckId}/qa/questions/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body,
    }), signal);
  } catch (error) {
    if (error instanceof QaError) throw error;
    throw new QaError('network_error', 'Could not reach the server. Questions need a connection.');
  }
  if (!response.ok) throw await failure(response);
  const data = await response.json() as { questions?: unknown };
  if (!Array.isArray(data.questions) || !data.questions.length) throw new QaError('invalid_response', 'The server returned no questions.');
  return data.questions.slice(0, 3).map((q: Record<string, unknown>, i) => ({
    panelist: str(q.panelist, 64) || 'P' + (i + 1), role: str(q.role, 60) || ['First', 'Second', 'Third'][i] + ' panelist',
    slide_index: Number.isInteger(q.slide_index) && (q.slide_index as number) >= 0 && (q.slide_index as number) < deck.pageCount ? q.slide_index as number : 0,
    topic: str(q.topic, 80), question: str(q.question, 600), follow_up: str(q.follow_up, 600),
  })).filter(q => q.question);
}

export async function judgeAnswer(deck: Presentation, input: { audioUri: string; question: string; mainQuestion: string; part: 0 | 1; slideIndex: number; durationMs: number },
  signal?: AbortSignal): Promise<QaResult> {
  let response: Response;
  try {
    const audio = new File(input.audioUri);
    if (!audio.exists || !audio.size) throw new QaError('audio_missing', 'The recorded answer could not be opened. Record it again.');
    const name = (audio as unknown as { name?: string }).name || 'answer.m4a';
    const metadata = JSON.stringify({ question: input.question.slice(0, 600), main_question: input.mainQuestion.slice(0, 600), part: input.part,
      slide_index: input.slideIndex, duration_ms: Math.round(input.durationMs) });
    response = await postForDeck(deck, deckId => {
      const body = new FormData();
      body.append('audio', audio, name);
      body.append('metadata', metadata);
      return fetch(`${api()}/decks/${deckId}/qa/answers/`, { method: 'POST', body, signal });
    }, signal);
  } catch (error) {
    if (error instanceof QaError) throw error;
    throw new QaError('network_error', 'Could not reach the server. Your answer is kept on this phone.');
  }
  if (!response.ok) throw await failure(response);
  const d = await response.json() as Record<string, unknown>;
  const t = d.transcript as Transcript | undefined;
  const verdict = d.verdict === 'answered' || d.verdict === 'partly' || d.verdict === 'too_short' ? d.verdict : null;
  if (!verdict || !t || typeof t.text !== 'string' || !Array.isArray(t.words)) throw new QaError('invalid_response', 'The answer review was invalid.');
  return { transcript: t, verdict, did: str(d.did, 400), evidence: str(d.evidence, 400), clarify: str(d.clarify, 400),
    duration_ms: Number.isInteger(d.duration_ms) ? d.duration_ms as number : input.durationMs };
}


export type DurableAnswerInput={id:string;deckId:string;audioUri:string;durationMs:number;questionJobId:number;questionId:string;part:0|1;slideIndex:number};
type AnswerState={attempt_id:string;question_job_id:number;question_id:string;part:number;
 processing:{status:string;processing_revision:number;requires_confirmation:boolean;retry_available:boolean};
 feedback:{state:string;feedback_revision:number;requires_confirmation:boolean;selection:{token:string}|null;retry_available:boolean;stale:boolean;
 dependency?:{retry_action:string|null;retry_available:boolean;requires_confirmation:boolean;description_set_id:string;processing_revision:number}|null};result:QaResult|null};
export async function reviewDurableAnswer(input:DurableAnswerInput,confirmed=false,signal?:AbortSignal,retry=false):Promise<QaResult>{
 const endpoint=`${api()}/attempts/${input.id}/qa-answer/`;
 const read=async():Promise<AnswerState|null>=>{
  const response=await fetch(endpoint,{signal});if(response.status===404)return null;
  if(!response.ok)throw await failure(response);
  const d=await response.json() as AnswerState;
  if(d.attempt_id!==input.id||d.question_job_id!==input.questionJobId||d.question_id!==input.questionId||d.part!==input.part||!d.processing||!d.feedback)throw new QaError('invalid_response','Answer identity changed. Your recording is preserved.');
  return d;
 };
 const send=async(extra:object)=>{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal,
   body:JSON.stringify({question_job_id:input.questionJobId,question_id:input.questionId,part:input.part,...extra})});
  if(!response.ok)throw await failure(response);
 };
 let state=await read();
 if(!state){
  const audio=new File(input.audioUri);if(!audio.exists||!audio.size)throw new QaError('audio_missing','Saved answer audio is unavailable.');
  const form=new FormData();form.append('audio',audio,(audio as unknown as {name:string}).name||'answer.m4a');
  form.append('metadata',JSON.stringify({id:input.id,deck_id:input.deckId,duration_ms:Math.round(input.durationMs),audience:'',slide_events:[{slide_index:input.slideIndex,at_ms:0}]}));
  const upload=await fetch(`${api()}/attempts/`,{method:'POST',body:form,signal});if(!upload.ok)throw await failure(upload);
  await send({processing:{}});state=await read();
 }
 if(!state)throw new QaError('not_found','Saved answer binding is unavailable. Retry with the same recording.');
 if(state.processing.status==='failed'){
  if(!retry)throw new QaError('answer_stopped','Transcription stopped. Tap to retry your saved answer.');
  if(state.processing.requires_confirmation&&!confirmed)throw new QaError('confirmation_required','The previous transcription may have been charged. Confirm before retrying.');
  await send({processing:{processing_revision:state.processing.processing_revision,...(confirmed?{acknowledge_uncertain:true}:{})}});
 }else if(state.processing.status==='pending')await send({processing:{}});
 else if(state.processing.status==='completed'&&!state.result&&state.feedback.dependency?.retry_action){
  const dep=state.feedback.dependency;
  if(!retry)throw new QaError('answer_stopped','Slide profile processing stopped. Tap to retry.');
  if(dep.requires_confirmation&&!confirmed)throw new QaError('confirmation_required','The previous profile request may have been charged. Confirm before retrying.');
  if(!dep.retry_available)throw new QaError('retry_not_available','Wait before retrying the slide profile.');
  const response=await fetch(`${api()}/decks/${input.deckId}/descriptions/generate/`,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({description_set_id:dep.description_set_id,processing_revision:dep.processing_revision,...(confirmed?{acknowledge_uncertain:true}:{})})});
  if(!response.ok)throw await failure(response);
 }else if(state.processing.status==='completed'&&!state.result&&['failed','needs_confirmation','stale'].includes(state.feedback.state)){
  if(!retry)throw new QaError('answer_stopped','Evaluation stopped. Tap to retry your saved answer.');
  if(state.feedback.requires_confirmation&&!confirmed)throw new QaError('confirmation_required','The previous answer evaluation may have been charged. Confirm before retrying.');
  if(!state.feedback.retry_available)throw new QaError('retry_not_available','Wait before retrying this evaluation.');
  await send({feedback:{feedback_revision:state.feedback.feedback_revision,expected_selection:state.feedback.selection?.token,...(confirmed?{acknowledge_uncertain:true}:{})}});
 }
 // Polling only reads. The durable worker advances from saved STT to evaluation.
 for(let poll=0;poll<150;poll++){
  state=await read();
  if(state?.result){
   const d=state.result;
   if(!['answered','partly','too_short'].includes(d.verdict)||!d.transcript||typeof d.transcript.text!=='string'||!Array.isArray(d.transcript.words)||d.duration_ms!==Math.round(input.durationMs))throw new QaError('invalid_response','Invalid answer review. Audio is preserved.');
   return d;
  }
  if(state?.processing.status==='failed'||['failed','needs_confirmation','stale','disabled','unavailable'].includes(state?.feedback.state??'')||state?.feedback.dependency?.retry_action)
   throw new QaError('answer_stopped','Answer processing stopped. Refresh and retry; your recording is saved.');
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,2000);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new QaError('cancelled','Answer is saved. Reopen to check its result.'));}signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
 }
 throw new QaError('pending','Your saved answer is still processing. Reopen to check its result.');
}
