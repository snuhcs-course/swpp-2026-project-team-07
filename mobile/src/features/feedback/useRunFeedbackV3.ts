import { displayTranslations, useDisplayTranslation } from '../localization/useDisplayTranslation';
import { firstFeedback } from '../localization/firstFeedback';
import { getAppLanguage } from '../../design/language';
import { translatedV3, translatedV3Cards } from '../localization/generatedProse';
import { captureFeedback, readCapture, captureVersion, subscribeCaptures } from '../recording/incrementalState';
// Feedback v3 for the selected run, for screens: reads saved results and polls while a run is on its way.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
// Single-take feedback starts in FeedbackV3Host (or on the server) right after transcription.
// The selected-takes controller requests its own whole-assessment once the selected sources are ready.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { API_URL } from '../../services/api';
import { onlineAllowed, subscribePrivacy } from '../../services/storePrivacy';
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
import { feedbackV3Capability, feedbackV3CapabilityChecked, fetchFeedbackRun, readSavedRun, readStartState, startFeedbackRun } from './feedbackRunClient';
import { useRunPresentationScores } from './useRunPresentationScores';
import { useSelectedFeedback } from './useSelectedFeedback';

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
    const incremental = readCapture(id);
    const streaming = incremental?.api === api;
    const ready = streaming || (!!review?.transcript_id && !!review.transcript?.words.length);
    const contextId = streaming ? incremental.contextId ?? null : review?.deck_id ? contextFor(review.deck_id) : null;
    const auto = streaming || automaticFeedbackV3Enabled(api, id) && readStartState(api, id)?.state !== 'failed';
    // Expected: FeedbackV3Host will start (or has started) it; it cannot while settings are unsynchronized.
    return { id, contextId, ready, blocked, expected: auto && !blocked, waitingForSettings: auto && blocked };
  });
}

export function useRunFeedbackV3(model: DeckModel | null, active = true, prose?: number | 'all') {
  const api = String(normalizeApi(API_URL));
  useSyncExternalStore(subscribeCaptures, captureVersion);
  useStore(s => s.version);
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const online = useSyncExternalStore(subscribePrivacy, onlineAllowed, onlineAllowed);
  const visible = active && foreground;
  const maySync = visible && online;
  const [offline, setOffline] = useState(false), [busy, setBusy] = useState(false);
  const targets = feedbackTargets(model, api);
  const capability = feedbackV3Capability(api);
  const selected = useSelectedFeedback(model, api, visible && feedbackV3CapabilityChecked(api), capability === true, online);
  const selectedRun = selected?.run;
  const runs = new Map<string, FeedbackRun | null>(targets.map(t => {
    const capture = readCapture(t.id);
    return [t.id, captureFeedback(capture?.api === api ? capture : null, readSavedRun(api, t.id, t.contextId))];
  }));
  const initial = new Map([...runs].map(([id, raw]) => [id, raw && maySync ?
    firstFeedback(api, raw, slide => model?.state.run?.parts[slide]?.attemptId === id, targets.length === 1,
      typeof prose === 'number' ? prose : undefined, getAppLanguage(), displayTranslations) : raw]));
  const preparingDisplay = [...initial].some(([id, value]) => runs.get(id) !== value);
  const { value: display } = useDisplayTranslation(maySync && !!model, scope => {
    if (prose === undefined) return { attempts: initial, selectedRun };
    const attempts = new Map([...initial].map(([id, run]) => {
      if (!run) return [id, run];
      const field = scope('feedback', run.runId || id, undefined, run.language);
      const slides = run.slides.map(slide => {
        const part = model?.state.run?.parts[slide.slide_index];
        if (part?.attemptId !== id) return slide;
        const path = 'slides.' + slide.slide_index;
        if (prose === slide.slide_index) return translatedV3(slide, field, path);
        return prose === 'all' && part.segments.some(s => s.endMs > s.startMs) ? translatedV3Cards(slide, field, path) : slide;
      });
      const whole = prose === 'all' && !selected && run.whole ? translatedV3Cards(run.whole, field, 'whole') : run.whole;
      return [id, { ...run, slides, whole }];
    }));
    if (!selectedRun?.runId || selectedRun.outdated || feedbackRunOutdated(selectedRun)) return { attempts, selectedRun };
    const field = scope('feedback', selectedRun.runId, undefined, selectedRun.language);
    const slides = selectedRun.slides.map(slide => {
      const path = 'slides.' + slide.slide_index;
      if (prose === slide.slide_index) return translatedV3(slide, field, path);
      return prose === 'all' && model?.state.run?.parts[slide.slide_index] ? translatedV3Cards(slide, field, path) : slide;
    });
    const whole = prose === 'all' && selectedRun.whole ? translatedV3Cards(selectedRun.whole, field, 'whole') : selectedRun.whole;
    return { attempts, selectedRun: { ...selectedRun, slides, whole } };
  });
  const selection = selectRunFeedbackV3({ n: model?.n ?? 0, parts: model?.state.run?.parts ?? [], stages: model?.stages ?? new Map(),
    runs: display.attempts, ready: new Set(targets.filter(t => t.ready).map(t => t.id)), expected: new Set(targets.filter(t => t.expected).map(t => t.id)),
    waitingForSettings: new Set(targets.filter(t => t.waitingForSettings).map(t => t.id)),
    selected: selected ? { run: display.selectedRun ?? null, status: selected.status } : null });
  const identity = JSON.stringify(targets);
  const live = useRef({ targets, maySync });
  useLayoutEffect(() => { live.current = { targets, maySync }; });

  const sync = useCallback(async () => {
    const { targets: list, maySync } = live.current;
    if (!maySync || feedbackV3Capability(api) !== true) return;  // FeedbackV3Host learns the capability.
    const results = await Promise.allSettled(list.filter(t => t.ready).map(t => fetchFeedbackRun(api, t.id, t.contextId)));
    setOffline(results.some(r => r.status === 'rejected'));
  }, [api, setOffline]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => { if (maySync) void sync(); }, [maySync, identity, capability, sync]);
  // Poll while a run is in progress, or while an automatically started run has not appeared yet.
  const waiting = targets.some(t => t.ready && t.expected && (!runs.get(t.id) || feedbackRunNeedsStart(runs.get(t.id) ?? null)));
  const running = targets.some(t => t.ready && feedbackRunActive(runs.get(t.id) ?? null));
  useEffect(() => {
    if (!maySync || (!running && !waiting && !offline)) return;
    const timer = setInterval(() => void sync(), offline ? 5000 : running ? 2000 : 3000);
    return () => clearInterval(timer);
  }, [maySync, running, waiting, offline, sync]);

  const checkSelected = selected?.check;
  const act = useCallback(async (pick: (run: FeedbackRun | null) => boolean, retry: boolean, checkOverall: boolean) => {
    if (!live.current.maySync) return;
    setBusy(true);
    try {
      let requestFailed = false;
      // The selected assessment uses a different job. An individual take cannot block its update or retry.
      if (checkOverall) {
        try { await checkSelected?.(retry ? 'retry' : 'update'); } catch { requestFailed = true; }
      }
      for (const t of live.current.targets) {
        if (!t.ready || t.blocked) continue;
        try {
          if (pick(readSavedRun(api, t.id, t.contextId))) await startFeedbackRun(api, t.id, t.contextId, retry);
        } catch { requestFailed = true; }
      }
      setOffline(requestFailed);
    } finally { setBusy(false); }
  }, [api, checkSelected]);
  const budget = selected?.budget;
  const budgetRetry = online && selected?.retryBudget === true;
  const canRequest = online && (!budget || budgetRetry);
  const selectedOutdated = feedbackRunOutdated(selectedRun ?? null);
  const selectedFailures = feedbackRunHasFailures(selectedRun ?? null);
  /** Explicit: request feedback for current inputs (missing or outdated). Unchanged parts are reused, not regenerated. */
  const update = useCallback(async () => {
    if (!budget) await act(run => !run || feedbackRunNeedsStart(run) || feedbackRunOutdated(run), false, selectedOutdated);
  }, [act, budget, selectedOutdated]);
  /** Explicit: re-run only the parts that failed. */
  const retry = useCallback(async () => {
    if (budgetRetry) await act(() => false, true, true);
    else if (!budget) await act(feedbackRunHasFailures, true, selectedFailures);
  }, [act, budget, budgetRetry, selectedFailures]);

  const failures = canRequest && (budgetRetry || selectedFailures || targets.some(t => feedbackRunHasFailures(runs.get(t.id) ?? null)));
  const outdated = online && !budget && (selectedOutdated || targets.some(t => t.ready && feedbackRunOutdated(runs.get(t.id) ?? null)));
  const missing = online && !budget && targets.some(t => t.ready && !t.expected && !t.waitingForSettings &&
    (!runs.get(t.id) || feedbackRunNeedsStart(runs.get(t.id) ?? null)));
  const blocked = !online || targets.some(t => t.blocked);
  return {
    enabled: capability === true, capability, ...selection, retry, update, refresh: sync, busy, failures, outdated, missing, blocked, preparingDisplay,
    canRequest, budgetRetry,
    notice: online && offline ? 'Connection interrupted. Saved feedback is shown. Reconnecting…'
      : online && blocked ? 'Presentation settings are saved on this phone. Feedback starts after they synchronize.'
      : outdated ? 'Feedback is from before your latest changes. Update it when you are ready.' : '',
  };
}
export type RunFeedbackV3 = ReturnType<typeof useRunFeedbackV3>;

/**
 * Scores for every screen: feedback v3 when the server offers it, otherwise the v2 scores.
 * The v2 hook stays mounted but inactive under v3, so it makes no requests.
 */
export function useRunScores(model: DeckModel | null, active = true, selectedSlide?: number, showProse = false) {
  const v3 = useRunFeedbackV3(model, active, showProse ? selectedSlide ?? 'all' : undefined);
  const v2 = useRunPresentationScores(model, active && !v3.enabled, selectedSlide, showProse && !v3.enabled);
  return v3.enabled
    ? { kind: 'v3' as const, scores: { items: v3.items, overall: v3.overall }, v3, v2 }
    : { kind: 'v2' as const, scores: v2, v3: null, v2 };
}
