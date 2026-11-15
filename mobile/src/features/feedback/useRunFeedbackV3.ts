// Feedback v3 for the selected run: reads, starts when missing or outdated, polls while running.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
// The server's FEEDBACK_V3_AUTO_START may stay off: the app starts a run when it first needs one,
// and the server deduplicates by input fingerprint, so repeated starts never repeat paid calls.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { API_URL } from '../../services/api';
import { runAttemptIds } from '../../domain/run';
import type { DeckModel } from '../presentations/useDeckModel';
import { useStore } from '../presentations/store';
import { getRequirementsVersion, readRequirements, subscribeRequirements } from '../presentations/requirementsStore';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { defaultRequirementsPending } from '../presentations/defaultRequirements';
import { readReview } from '../transcription/reviewStorage';
import { normalizeApi } from '../transcription/analysisStorage';
import { feedbackRunActive, feedbackRunHasFailures, feedbackRunNeedsStart, selectRunFeedbackV3, type FeedbackRun } from './feedbackRun';
import { feedbackV3Capability, fetchFeedbackRun, readSavedRun, startFeedbackRun } from './feedbackRunClient';
import { useRunPresentationScores } from './useRunPresentationScores';

type Target = { id: string; contextId: string | null; ready: boolean; blocked: boolean };
// One automatic start per run identity per app session, so a server that keeps answering
// "outdated" (or an error) can never cause a request loop.
const startedOnce = new Set<string>();
const startKey = (api: string, t: Target, run: FeedbackRun | null) =>
  JSON.stringify([api, t.id, t.contextId, run?.runId, run?.status, run?.outdated]);
const shouldStart = (api: string, t: Target, run: FeedbackRun | null) =>
  t.ready && !t.blocked && feedbackRunNeedsStart(run) && !startedOnce.has(startKey(api, t, run));

function targetsFor(model: DeckModel | null, api: string): Target[] {
  if (!model?.state.run) return [];
  let contextFor: (deckId: string) => string | null = () => null, blocked = false;
  try {
    const r = readRequirements(model.deck.id, api);
    contextFor = deckId => r.deckId === deckId ? r.contextId ?? null : null;
    blocked = requirementsDirty(model.deck.id, api) || defaultRequirementsPending(model.deck.id, api);
  } catch { blocked = true; }
  return runAttemptIds(model.state.run).map(id => {
    let review: ReturnType<typeof readReview> = null;
    try { review = readReview(api, id); } catch { /* Unreadable review: treated as not ready. */ }
    const ready = !!review?.transcript_id && !!review.transcript?.words.length;
    return { id, contextId: review?.deck_id ? contextFor(review.deck_id) : null, ready, blocked };
  });
}

export function useRunFeedbackV3(model: DeckModel | null, active = true) {
  const api = normalizeApi(API_URL);
  useStore(s => s.version);
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [offline, setOffline] = useState(false), [busy, setBusy] = useState(false);
  const targets = targetsFor(model, api);
  const runs = new Map<string, FeedbackRun | null>(targets.map(t => [t.id, readSavedRun(api, t.id, t.contextId)]));
  const selection = selectRunFeedbackV3({ n: model?.n ?? 0, parts: model?.state.run?.parts ?? [], stages: model?.stages ?? new Map(),
    runs, ready: new Set(targets.filter(t => t.ready).map(t => t.id)) });
  const capability = feedbackV3Capability(api);
  const identity = JSON.stringify(targets);
  const live = useRef({ targets, visible: active && foreground });
  useLayoutEffect(() => { live.current = { targets, visible: active && foreground }; });

  const sync = useCallback(async () => {
    const { targets: list, visible } = live.current;
    if (!visible) return;
    let failed = false;
    await Promise.all(list.filter(t => t.ready).map(async t => {
      try {
        const run = await fetchFeedbackRun(api, t.id, t.contextId);
        if (shouldStart(api, t, run)) {
          startedOnce.add(startKey(api, t, run));
          await startFeedbackRun(api, t.id, t.contextId);
        }
      } catch { failed = true; }
    }));
    setOffline(failed);
  }, [api]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => { if (active && foreground) void sync(); }, [active, foreground, identity, sync]);
  // Poll while a run is in progress, or until the one automatic start for a missing run is sent.
  const polling = targets.some(t => t.ready && (feedbackRunActive(runs.get(t.id) ?? null) || shouldStart(api, t, runs.get(t.id) ?? null)));
  useEffect(() => {
    if (!active || !foreground || (!polling && !offline)) return;
    const timer = setInterval(() => void sync(), offline ? 5000 : 2000);
    return () => clearInterval(timer);
  }, [active, foreground, polling, offline, sync]);

  const retry = useCallback(async () => {
    setBusy(true);
    try {
      for (const t of live.current.targets) {
        if (t.ready && !t.blocked && feedbackRunHasFailures(readSavedRun(api, t.id, t.contextId)))
          await startFeedbackRun(api, t.id, t.contextId, true);
      }
      setOffline(false);
    } catch { setOffline(true); } finally { setBusy(false); }
  }, [api]);

  const failures = targets.some(t => feedbackRunHasFailures(runs.get(t.id) ?? null));
  const blocked = targets.some(t => t.blocked);
  return {
    enabled: capability === true, capability, ...selection, retry, refresh: sync, busy, failures, blocked,
    notice: offline ? 'Connection interrupted. Saved feedback is shown. Reconnecting…'
      : blocked ? 'Presentation settings are saved on this phone. Feedback updates after they synchronize.' : '',
  };
}
export type RunFeedbackV3 = ReturnType<typeof useRunFeedbackV3>;

/**
 * Scores for every screen: feedback v3 when the server offers it, otherwise the v2 scores.
 * The v2 hook stays mounted but inactive under v3, so it makes no requests.
 */
export function useRunScores(model: DeckModel | null, active = true, selectedSlide?: number) {
  const v3 = useRunFeedbackV3(model, active);
  const v2 = useRunPresentationScores(model, active && !v3.enabled, selectedSlide);
  return v3.enabled
    ? { kind: 'v3' as const, scores: { items: v3.items, overall: v3.overall }, v3, v2 }
    : { kind: 'v2' as const, scores: v2, v3: null, v2 };
}
