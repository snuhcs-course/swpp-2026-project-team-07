// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: AI coaching for a take, shown as findings on Review.
// Reuses the existing useFeedbackReview hook (provider disclosure, revision-aware
// generation, pending-charge acknowledgement, offline cache). Generation only starts
// when the speaker taps the "AI suggestions" row: it is never automatic.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { API_URL } from '../../services/api';
import { normalizeApi } from '../transcription/analysisStorage';
import { readReview } from '../transcription/reviewStorage';
import { useFeedbackReview } from '../feedback/useFeedbackReview';
import { bump, useStore } from '../presentations/store';

export type CoachState = {
  busy: boolean; label: string; notice: string; done: boolean;
  details: ReturnType<typeof useFeedbackReview>;
  prompt: { kind: 'disclosure' | 'uncertain'; provider: string; model: string } | null;
  continuePrompt?: () => void; cancelPrompt?: () => void;
};
const coaches = new Map<string, CoachState>();
const listeners = new Set<() => void>();
let version = 0;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const viewers = new Map<string, number>();
const retireTimers = new Map<string, ReturnType<typeof setTimeout>>();
function clearRetirement(id: string) { const timer = retireTimers.get(id); if (timer) clearTimeout(timer); retireTimers.delete(id); }
function isSettled(state: CoachState | undefined) {
  return !!state && !state.busy && !state.prompt && (!state.details.feedback ||
    ['absent', 'completed', 'failed', 'disabled', 'unavailable', 'stale', 'needs_confirmation']
      .includes(state.details.feedback.state));
}
function retireWhenIdle(id: string) {
  if (!requested.has(id) || viewers.has(id)) return;
  if (requested.get(id) === 0) { requested.delete(id); consumedGenerations.delete(id); requestTimes.delete(id); reqVersion++; reqListeners.forEach(l => l()); return; }
  if (!isSettled(coaches.get(id)) || retireTimers.has(id)) return;
  retireTimers.set(id, setTimeout(() => {
    retireTimers.delete(id);
    if (!viewers.has(id) && isSettled(coaches.get(id)) && requested.delete(id)) {
      consumedGenerations.delete(id); requestTimes.delete(id); reqVersion++; reqListeners.forEach(l => l());
    }
  }, 15000));
}
function publish(id: string, s: CoachState | null) { if (s) coaches.set(id, s); else coaches.delete(id); version++; listeners.forEach(l => l()); retireWhenIdle(id); }
export function useCoaches() { useSyncExternalStore(subscribe, () => version); return coaches; }

/** Takes the speaker asked AI suggestions for in this session. */
const requested = new Map<string, number>();
const consumedGenerations = new Map<string, number>();
const requestTimes = new Map<string, number>();
const reqListeners = new Set<() => void>();
let reqVersion = 0;
export function requestCoaching(id: string) { clearRetirement(id); requested.set(id, (requested.get(id) ?? 0) + 1); requestTimes.set(id, Date.now()); reqVersion++; reqListeners.forEach(l => l()); }
export function inspectCoaching(id: string) { if (!requested.has(id)) { requested.set(id, 0); reqVersion++; reqListeners.forEach(l => l()); } }
/** Keep a coach worker only while a screen displays it or generation is unfinished. */
export function retainCoaching(id: string) {
  clearRetirement(id); viewers.set(id, (viewers.get(id) ?? 0) + 1);
  return () => {
    const count = (viewers.get(id) ?? 1) - 1;
    if (count > 0) viewers.set(id, count); else { viewers.delete(id); retireWhenIdle(id); }
  };
}
export function useRequestedCoaching() {
  useSyncExternalStore(l => { reqListeners.add(l); return () => { reqListeners.delete(l); }; }, () => reqVersion);
  return [...requested];
}

const LABELS: Record<string, string> = {
  absent: 'Ready', disabled: 'AI suggestions are turned off on this server', unavailable: 'AI suggestions are unavailable', waiting_descriptions: 'Describing your slides…',
  queued: 'Queued…', preparing: 'Preparing AI suggestions…', submitted: 'Preparing AI suggestions…', normalizing: 'Preparing AI suggestions…',
  waiting_quota: 'Waiting for provider quota…', failed: 'AI suggestions failed', needs_confirmation: 'Needs your confirmation', stale: 'Suggestions are out of date', completed: 'AI suggestions ready',
};

function CoachWorker({ id, generation }: { id: string; generation: number }) {
  const api = normalizeApi(API_URL);
  const version = useStore(s => s.version);
  const review = useMemo(() => { void version; try { return readReview(api, id); } catch { return null; } }, [api, id, version]);
  if (!review?.deck_id || !review.transcript) return null;
  return <CoachInner key={`${id}:${review.transcript_id ?? review.transcript.text}:${review.duration_ms}`} id={id} review={review} generation={generation} />;
}
function CoachInner({ id, review, generation }: { id: string; review: NonNullable<ReturnType<typeof readReview>>; generation: number }) {
  const fb = useFeedbackReview(id, API_URL, review);
  const f = fb.feedback;
  useEffect(() => {
    if (!generation || (consumedGenerations.get(id) ?? 0) >= generation || fb.busy || fb.prompt || !f) return;
    if (Date.now() - (requestTimes.get(id) ?? 0) > 30000) { consumedGenerations.set(id, generation); return; }
    // A tap during a cooldown is consumed now; a later status refresh cannot
    // silently submit a provider request after the user has left the screen.
    if (!f.selection || (f.state === 'completed' && !f.stale) || f.availability.state !== 'available' ||
        !(f.feedback_revision === 0 || f.retry_available)) { consumedGenerations.set(id, generation); return; }
    consumedGenerations.set(id, generation);
    fb.generate();
  }, [f, fb, generation, id]);
  const { continuePrompt, cancelPrompt, prompt, busy, notice } = fb;
  useEffect(() => {
    const sel = prompt?.intent.selection;
    publish(id, {
      busy, notice, done: f?.state === 'completed' && !!f.result, label: LABELS[f?.state ?? 'unavailable'] ?? 'AI suggestions', details: fb,
      prompt: prompt && sel ? { kind: prompt.kind, provider: sel.provider === 'gemini' ? 'Gemini' : 'OpenAI', model: sel.model } : null,
      continuePrompt, cancelPrompt,
    });
  }, [busy, cancelPrompt, continuePrompt, f, fb, id, notice, prompt]);
  useEffect(() => () => publish(id, null), [id]);
  useEffect(() => { bump(); }, [f?.result, f?.state]);
  return null;
}

export function CoachHost() {
  const ids = useRequestedCoaching();
  return <>{ids.map(([id, generation]) => <CoachWorker key={id} id={id} generation={generation} />)}</>;
}
