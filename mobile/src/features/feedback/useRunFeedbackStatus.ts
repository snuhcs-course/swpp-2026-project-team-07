import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { API_URL } from '../../services/api';
import type { DeckModel } from '../presentations/useDeckModel';
import { useStore } from '../presentations/store';
import { getRequirementsVersion, readRequirements, subscribeRequirements } from '../presentations/requirementsStore';
import { normalizeApi } from '../transcription/analysisStorage';
import { selectedSlideFeedback } from './selectedSlideFeedback';
import { createSlideReviewReader, slideReviewKey, type SlideReviewTarget } from './slideReviewStore';

/** One cache subscription and one active-job timer per visible overview; never admits generation. */
export function useRunFeedbackStatus(model: DeckModel | null, active = true) {
  const api = normalizeApi(API_URL), version = useStore(state => state.version);
  const requirementsVersion = useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const [readVersion, setReadVersion] = useState(0), [offline, setOffline] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  // These subscriptions invalidate synchronous cache reads; no network runs during render.
  void version; void requirementsVersion; void readVersion;
  const derived = selectedSlideFeedback(model, api);
  let revision: number | null = null;
  try { revision = model ? readRequirements(model.deck.id, api).revision : null; } catch { /* No verified context. */ }
  const identity = JSON.stringify([model?.deck.id, revision, derived.targets.map(target => [slideReviewKey(api, target.id, target.scope), target.review?.transcript_id])]);
  const activeIdentity = JSON.stringify(derived.activeTargets.map(target => slideReviewKey(api, target.id, target.scope)));
  const snapshot = useRef(derived), visible = useRef(active && foreground), fence = useRef(identity), sequence = useRef(0);
  useLayoutEffect(() => { snapshot.current = derived; visible.current = active && foreground; fence.current = identity; });
  const read = useCallback(async (targets: SlideReviewTarget[]) => {
    if (!visible.current || !targets.length) return;
    const captured = fence.current, mine = ++sequence.current;
    const reader = createSlideReviewReader(api);
    const results = await Promise.allSettled(targets.map(target => reader.read(target)));
    if (!visible.current || captured !== fence.current || mine !== sequence.current) return;
    setOffline(results.some(result => result.status === 'rejected')); setReadVersion(value => value + 1);
  }, [api, setOffline, setReadVersion]);
  const refresh = useCallback(async () => { await read(snapshot.current.targets); }, [read]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { sub.remove(); visible.current = false; };
  }, []);
  useEffect(() => { if (active && foreground) void refresh(); }, [active, foreground, identity, refresh]);
  useEffect(() => {
    if (!active || !foreground || !activeIdentity || activeIdentity === '[]') return;
    const timer = setInterval(() => { void read(snapshot.current.activeTargets); }, 2500);
    return () => clearInterval(timer);
  }, [active, activeIdentity, foreground, read]);
  return { items: derived.items, aggregate: derived.aggregate, refresh, offline,
    notice: offline ? 'Offline or unavailable. Saved AI feedback is retained.' : '' };
}
