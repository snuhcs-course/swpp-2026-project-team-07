// Scribe migration: OpenAI Codex, Iteration 2 (2026-10-16); see active collaboration log.
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Audience Q&A API client (backend: rehearsals/qa_views.py).
// Questions are written from the slide text and the merged transcript; answers are
// transcribed with the existing hosted Scribe v2 adapter and judged by the configured
// feedback provider. Provider keys stay on the server.
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import type { Transcript } from '../../contracts';
import { API_URL } from '../../services/api';
import { readStored } from '../../services/storage';
import { hasAnalysisConsent, normalizeApi } from '../transcription/analysisStorage';
import { serverSlides } from '../presentations/serverDeck';
import type { Presentation } from '../presentations/store';

export type QaQuestion = { panelist: string; role: string; slide_index: number; topic: string; question: string; follow_up: string };
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
    panelist: str(q.panelist, 8) || 'P' + (i + 1), role: str(q.role, 60) || ['First', 'Second', 'Third'][i] + ' panelist',
    slide_index: Number.isInteger(q.slide_index) && (q.slide_index as number) >= 0 && (q.slide_index as number) < deck.pageCount ? q.slide_index as number : 0,
    topic: str(q.topic, 80), question: str(q.question, 600), follow_up: str(q.follow_up, 600),
  })).filter(q => q.question);
}

function requireTranscriptionConsent() {
  if (!hasAnalysisConsent()) throw new QaError('transcription_consent_required', 'Allow ElevenLabs transcription to review this saved answer.');
}

export async function judgeAnswer(deck: Presentation, input: { audioUri: string; question: string; mainQuestion: string; part: 0 | 1; slideIndex: number; durationMs: number },
  signal?: AbortSignal): Promise<QaResult> {
  requireTranscriptionConsent();
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
