// Feedback v3 for the selected run, for screens: reads saved results and polls while a run is on its way.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
// Screens never start generation on their own. New recordings start in FeedbackV3Host (or on the server)
// right after transcription; Update and Retry here are explicit user actions.
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
import { automaticFeedbackV3Enabled } from './automaticFeedback';
import { feedbackRunActive, feedbackRunHasFailures, feedbackRunNeedsStart, feedbackRunOutdated, selectRunFeedbackV3,
  type FeedbackRun } from './feedbackRun';
import { feedbackV3Capability, fetchFeedbackRun, readSavedRun, readStartState, startFeedbackRun } from './feedbackRunClient';
import { useRunPresentationScores } from './useRunPresentationScores';

type Target = { id: string; contextId: string | null; ready: boolean; blocked: boolean; expected: boolean; waitingForSettings: boolean };

export function feedbackTargets(model: DeckModel | null, api: string): Target[] {
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
    const contextId = review?.deck_id ? contextFor(review.deck_id) : null;
    const auto = automaticFeedbackV3Enabled(api, id) && readStartState(api, id)?.state !== 'failed';
    // Expected: FeedbackV3Host will start (or has started) it; it cannot while settings are unsynchronized.
    return { id, contextId, ready, blocked, expected: auto && !blocked, waitingForSettings: auto && blocked };
  });
}

export function useRunFeedbackV3(model: DeckModel | null, active = true) {
  const api = normalizeApi(API_URL);
  useStore(s => s.version);
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [offline, setOffline] = useState(false), [busy, setBusy] = useState(false);
  const targets = feedbackTargets(model, api);
  const runs = new Map<string, FeedbackRun | null>(targets.map(t => [t.id, readSavedRun(api, t.id, t.contextId)]));
  const selection = selectRunFeedbackV3({ n: model?.n ?? 0, parts: model?.state.run?.parts ?? [], stages: model?.stages ?? new Map(),
    runs, ready: new Set(targets.filter(t => t.ready).map(t => t.id)), expected: new Set(targets.filter(t => t.expected).map(t => t.id)),
    waitingForSettings: new Set(targets.filter(t => t.waitingForSettings).map(t => t.id)) });
  const capability = feedbackV3Capability(api);
  const identity = JSON.stringify(targets);
  const live = useRef({ targets, visible: active && foreground });
  useLayoutEffect(() => { live.current = { targets, visible: active && foreground }; });

  const sync = useCallback(async () => {
    const { targets: list, visible } = live.current;
    if (!visible || feedbackV3Capability(api) !== true) return;  // FeedbackV3Host learns the capability.
    const results = await Promise.allSettled(list.filter(t => t.ready).map(t => fetchFeedbackRun(api, t.id, t.contextId)));
    setOffline(results.some(r => r.status === 'rejected'));
  }, [api]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => { if (active && foreground) void sync(); }, [active, foreground, identity, sync]);
  // Poll while a run is in progress, or while an automatically started run has not appeared yet.
  const waiting = targets.some(t => t.ready && t.expected && (!runs.get(t.id) || feedbackRunNeedsStart(runs.get(t.id) ?? null)));
  const running = targets.some(t => t.ready && feedbackRunActive(runs.get(t.id) ?? null));
  useEffect(() => {
    if (!active || !foreground || (!running && !waiting && !offline)) return;
    const timer = setInterval(() => void sync(), offline ? 5000 : running ? 2000 : 3000);
    return () => clearInterval(timer);
  }, [active, foreground, running, waiting, offline, sync]);

  const act = useCallback(async (pick: (run: FeedbackRun | null) => boolean, retry: boolean) => {
    setBusy(true);
    try {
      for (const t of live.current.targets) {
        if (t.ready && !t.blocked && pick(readSavedRun(api, t.id, t.contextId))) await startFeedbackRun(api, t.id, t.contextId, retry);
      }
      setOffline(false);
    } catch { setOffline(true); } finally { setBusy(false); }
  }, [api]);
  /** Explicit: request feedback for current inputs (missing or outdated). Unchanged parts are reused, not regenerated. */
  const update = useCallback(() => act(run => !run || feedbackRunNeedsStart(run) || feedbackRunOutdated(run), false), [act]);
  /** Explicit: re-run only the parts that failed. */
  const retry = useCallback(() => act(feedbackRunHasFailures, true), [act]);

  const failures = targets.some(t => feedbackRunHasFailures(runs.get(t.id) ?? null));
  const outdated = targets.some(t => t.ready && feedbackRunOutdated(runs.get(t.id) ?? null));
  const missing = targets.some(t => t.ready && !t.expected && !t.waitingForSettings &&
    (!runs.get(t.id) || feedbackRunNeedsStart(runs.get(t.id) ?? null)));
  const blocked = targets.some(t => t.blocked);
  return {
    enabled: capability === true, capability, ...selection, retry, update, refresh: sync, busy, failures, outdated, missing, blocked,
    notice: offline ? 'Connection interrupted. Saved feedback is shown. Reconnecting…'
      : blocked ? 'Presentation settings are saved on this phone. Feedback starts after they synchronize.'
      : outdated ? 'Feedback is from before your latest changes. Update it when you are ready.' : '',
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
