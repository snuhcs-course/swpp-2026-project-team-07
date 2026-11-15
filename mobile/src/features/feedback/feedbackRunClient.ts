// Feedback v3 network client and saved copy per recording (offline display).
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
import { backendFetch } from '../../services/backendFetch';
import { readStored, writeStored } from '../../services/storage';
import { bump } from '../presentations/store';
import { normalizeApi } from '../transcription/analysisStorage';
import { parseFeedbackRun, type FeedbackRun } from './feedbackRun';

type Transport = typeof globalThis.fetch;
const enc = (api: string) => encodeURIComponent(normalizeApi(api));
const runKey = (api: string, attemptId: string, contextId: string | null) => `feedback-run:v1:${enc(api)}:${attemptId}:${contextId ?? 'none'}`;
const capabilityKey = (api: string) => `feedback-v3-enabled:v1:${enc(api)}`;
const url = (api: string, attemptId: string) => `${normalizeApi(api)}/attempts/${encodeURIComponent(attemptId)}/feedback-run/`;
const inflight = new Map<string, Promise<FeedbackRun | null>>();
// Responses are saved in request order: a slow older GET never replaces a newer answer.
const requested = new Map<string, number>(), saved = new Map<string, number>();
const startKey = (api: string, attemptId: string, contextId: string | null) => `feedback-v3-start:v1:${enc(api)}:${attemptId}:${contextId ?? 'none'}`;
export type StartState = { state: 'started' | 'failed'; at: number };
/** Whether the automatic start after transcription was sent (or failed) for this recording. */
export function readStartState(api: string, attemptId: string, contextId: string | null): StartState | null {
  try { return readStored<StartState>(startKey(api, attemptId, contextId)); } catch { return null; }
}
export function writeStartState(api: string, attemptId: string, contextId: string | null, state: StartState['state'], now = Date.now()) {
  writeStored(startKey(api, attemptId, contextId), { state, at: now }); bump();
}

/** true/false once the server has answered; null before the first answer. */
export function feedbackV3Capability(api: string): boolean | null {
  try { return readStored<boolean>(capabilityKey(api)); } catch { return null; }
}
function saveCapability(api: string, value: boolean) {
  if (feedbackV3Capability(api) !== value) { writeStored(capabilityKey(api), value); bump(); }
}
export function readSavedRun(api: string, attemptId: string, contextId: string | null): FeedbackRun | null {
  try { return parseFeedbackRun(readStored<unknown>(runKey(api, attemptId, contextId))); } catch { return null; }
}
function save(api: string, attemptId: string, contextId: string | null, body: unknown, order: number): FeedbackRun | null {
  const run = parseFeedbackRun(body);
  if (!run) throw new Error('Feedback response could not be read. Saved feedback is retained.');
  saveCapability(api, run.enabled);
  const key = runKey(api, attemptId, contextId);
  if (order < (saved.get(key) ?? 0)) return readSavedRun(api, attemptId, contextId) ?? run;
  saved.set(key, order);
  // Runs are never deleted, so "absent" can never replace a saved run.
  if (run.status === 'absent' && readSavedRun(api, attemptId, contextId)?.runId) return readSavedRun(api, attemptId, contextId);
  // Rewrite (and re-render) only on change: polling repeats identical answers.
  if (JSON.stringify(readStored<unknown>(key)) !== JSON.stringify(body)) { writeStored(key, body); bump(); }
  return run;
}
function nextOrder(api: string, attemptId: string, contextId: string | null) {
  const key = runKey(api, attemptId, contextId), order = (requested.get(key) ?? 0) + 1;
  requested.set(key, order);
  return order;
}
async function json(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}
function once(key: string, work: () => Promise<FeedbackRun | null>) {
  const running = inflight.get(key);
  if (running) return running;
  const started = work().finally(() => inflight.delete(key));
  inflight.set(key, started);
  return started;
}

/** GET never starts work on the server. Returns null when the server has no v3 endpoint or recording. */
export function fetchFeedbackRun(api: string, attemptId: string, contextId: string | null, transport: Transport = backendFetch) {
  return once(`get:${runKey(api, attemptId, contextId)}`, async () => {
    const order = nextOrder(api, attemptId, contextId);
    const query = contextId ? `?context_id=${encodeURIComponent(contextId)}` : '';
    const response = await transport(url(api, attemptId) + query, { method: 'GET', signal: AbortSignal.timeout(15000) });
    const body = await json(response);
    if (response.status === 404) {
      // A JSON not_found is an unknown recording; any other 404 is a server without feedback v3.
      if ((body as { error?: { code?: string } } | null)?.error?.code !== 'not_found') saveCapability(api, false);
      return null;
    }
    if (!response.ok) throw new Error('Could not refresh feedback. Saved feedback is retained.');
    return save(api, attemptId, contextId, body, order);
  });
}

/** POST starts a run for the current inputs, or returns the existing one; retry re-runs only failed parts. */
export function startFeedbackRun(api: string, attemptId: string, contextId: string | null, retry = false, transport: Transport = backendFetch) {
  return once(`post:${runKey(api, attemptId, contextId)}`, async () => {
    const order = nextOrder(api, attemptId, contextId);
    const response = await transport(url(api, attemptId), { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_id: contextId, retry }) });
    const body = await json(response);
    if (!response.ok) {
      const code = (body as { error?: { code?: string } } | null)?.error?.code;
      if (code === 'feedback_disabled' || code === 'missing_api_key') saveCapability(api, false);
      if (code === 'transcript_not_ready') return null;
      throw new Error((body as { error?: { message?: string } } | null)?.error?.message || 'Could not start feedback.');
    }
    return save(api, attemptId, contextId, body, order);
  });
}
