import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AttemptResult, ReviewAttempt } from '../../contracts';
import { transcriptionClientFor } from './service';
import { readDeck, readReview, saveReview } from './reviewStorage';
import { parseReview, preferResult } from './reviewValidation';
import { hasAnalysisConsent, normalizeApi, readAnalysis, saveAnalysis, saveAnalysisConsent } from './analysisStorage';

type ActionIntent = { kind: 'initial' | 'retry'; revision?: number };
type Prompt = { kind: 'disclosure' | 'uncertain'; action: ActionIntent } | null;
const activeResult = (r: AttemptResult) => r.status === 'processing';

export function useAttemptAnalysis(id: string, address: string, uploaded: boolean, expectedDeck?: string, expectedDuration?: number, autoStart = false) {
  const api = normalizeApi(address);
  const client = useMemo(() => transcriptionClientFor(api), [api]);
  const identity = `${api}:${id}:${uploaded}:${expectedDeck || ""}:${expectedDuration || ""}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity; // Reject callbacks from old props even before effect cleanup.
  const [state, setState] = useState<{ identity: string; result: AttemptResult | null }>({ identity, result: null });
  const latestState = useRef(state);
  latestState.current = state;
  const [reviewState, setReviewState] = useState<{ identity: string; value: ReviewAttempt | null }>({ identity, value: null });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const promptRef = useRef<Prompt>(null);
  const session = useRef(0);
  const enabled = useRef(false);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRequested = useRef(false);
  const result = state.identity === identity ? state.result : null;

  const cancel = useCallback(() => {
    session.current++;
    controller.current?.abort(); controller.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    inFlight.current = false;
    promptRef.current = null;
  }, []);
  const current = useCallback((op: number) => enabled.current && session.current === op && currentIdentity.current === identity, [identity]);
  const begin = useCallback(() => {
    cancel();
    controller.current = new AbortController();
    return { op: session.current, signal: controller.current.signal };
  }, [cancel]);
  const accept = useCallback((value: AttemptResult, op: number) => {
    if (!current(op)) return;
    if (expectedDeck && value.deck_id && value.deck_id !== expectedDeck) throw new Error('Rehearsal presentation mismatch.');
    if (expectedDuration && value.duration_ms && value.duration_ms !== expectedDuration) throw new Error('Rehearsal duration mismatch.');
    // Reconcile before publishing or persisting. A failed write must not let an
    // older response erase completion held in either cache or this session.
    let accepted = preferResult(latestState.current.identity === identity ? latestState.current.result : null, value);
    try { accepted = preferResult(readAnalysis(api, id), accepted); }
    catch { /* Keep the in-memory revision if the cache cannot be read. */ }
    latestState.current = { identity, result: accepted };
    setState(latestState.current);
    setReviewState({ identity, value: parseReview(accepted, id, api) });
    try {
      const saved = saveAnalysis(api, accepted);
      const review = saveReview(api, parseReview(saved, id, api));
      latestState.current = { identity, result: saved };
      setState(latestState.current); setReviewState({ identity, value: review });
    }
    catch { setNotice('Result received, but its offline cache could not be saved. Your audio is retained.'); }
  }, [api, id, expectedDeck, expectedDuration, identity, current]);
  const watch = useCallback(function poll(value: AttemptResult, op: number, signal: AbortSignal) {
    if (!current(op) || !activeResult(value)) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void client.getResult(id, { signal }).then(next => {
        if (!current(op)) return;
        accept(next, op); poll(next, op, signal);
      }).catch(() => {
        if (current(op)) setNotice('Could not refresh analysis. Cached results and local audio are retained. Tap Refresh when connected.');
      });
    }, 2000);
  }, [accept, client, current, id]);
  const refresh = useCallback(async () => {
    if (!enabled.current || inFlight.current) return;
    const { op, signal } = begin();
    setNotice(''); setPrompt(null);
    try {
      // Upload metadata tracks only the latest destination; this API's cache
      // still permits read-only refresh after uploading to another server.
      if (!uploaded && !readAnalysis(api, id)) return;
      const value = await client.getReview(id, { signal });
      if (!current(op)) return;
      if (expectedDeck && value.deck_id && value.deck_id !== expectedDeck) throw new Error('Rehearsal presentation mismatch.');
      if (expectedDuration && value.duration_ms && value.duration_ms !== expectedDuration) throw new Error('Rehearsal duration mismatch.');
      if (value.processing_result) { accept(value.processing_result, op); watch(value.processing_result, op, signal); }
      else {
        try { setReviewState({ identity, value: saveReview(api, value) }); }
        catch {
          // Persistence may fail after a validated result was received in this
          // session. Incomplete snapshots must not erase that in-memory review.
          setReviewState(previous => previous.identity === identity && previous.value?.processing_result
            ? previous : { identity, value });
          setNotice('Result received, but its offline cache could not be saved.');
        }
      }
    } catch {
      if (current(op)) setNotice('Could not refresh analysis. Cached results and local audio are retained. Tap Refresh when connected.');
    }
  }, [accept, api, begin, client, current, id, uploaded, watch, expectedDeck, expectedDuration, identity]);

  useFocusEffect(useCallback(() => {
    enabled.current = AppState.currentState === 'active';
    setBusy(false); setPrompt(null); setNotice('');
    try { setState({ identity, result: readAnalysis(api, id) }); setReviewState({ identity, value: readReview(api, id) }); }
    catch { setState({ identity, result: null }); setNotice('Could not read the analysis cache. Local audio is retained.'); }
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      enabled.current = state === 'active';
      if (enabled.current) { setBusy(false); setPrompt(null); void refresh(); }
      else { cancel(); setBusy(false); setPrompt(null); }
    });
    return () => { enabled.current = false; cancel(); listener.remove(); };
  }, [api, cancel, id, identity, refresh]));

  async function perform(action: ActionIntent, acknowledged = false) {
    if (!enabled.current || !uploaded || inFlight.current) return;
    const { op, signal } = begin();
    inFlight.current = true; setBusy(true); setNotice(''); setPrompt(null);
    try {
      // A timeout/409 is not a server failure. Always GET before any new POST.
      const fresh = await client.getResult(id, { signal });
      if (!current(op)) return;
      const deck = expectedDeck ? readDeck(api, expectedDeck) : null;
      if (deck && !parseReview(fresh, id, api, deck).processing_result) throw new Error('Invalid processing timeline.');
      accept(fresh, op);
      if (fresh.status === 'completed' || activeResult(fresh)) { watch(fresh, op, signal); return; }
      if (action.kind === 'initial' && fresh.processing_state !== 'awaiting_analysis') {
        setNotice('Status changed. Review the latest result before choosing Retry.'); return;
      }
      if (action.kind === 'retry') {
        if (fresh.status !== 'failed' || fresh.processing_revision !== action.revision) {
          setNotice('Status changed. Review the latest result before choosing Retry.'); return;
        }
        if (!fresh.retry_available) { setNotice('Retry is not available yet. Refresh after the displayed retry time.'); return; }
        if (fresh.requires_confirmation && !acknowledged) {
          const next: Prompt = { kind: 'uncertain', action };
          promptRef.current = next; setPrompt(next); return;
        }
      }
      const payload = action.kind === 'retry' ? { processing_revision: fresh.processing_revision,
        ...(fresh.requires_confirmation ? { acknowledge_uncertain: acknowledged } : {}) } : {};
      const next = await client.process(id, payload, { signal });
      if (current(op)) { accept(next, op); watch(next, op, signal); }
    } catch {
      if (current(op)) {
        setNotice('Request outcome is unconfirmed. Refresh before trying again. Local audio is retained.');
        // Reconcile once; no automatic POST after a timeout or conflict.
        try {
          const next = await client.getResult(id, { signal });
          if (current(op)) { accept(next, op); watch(next, op, signal); }
        } catch { /* Preserve the prior result and uncertainty notice. */ }
      }
    } finally {
      if (current(op)) { inFlight.current = false; setBusy(false); }
    }
  }
  function request(action: ActionIntent) {
    if (!enabled.current || !uploaded || inFlight.current || promptRef.current) return;
    try {
      if (!hasAnalysisConsent()) {
        const next: Prompt = { kind: 'disclosure', action }; promptRef.current = next; setPrompt(next); return;
      }
      void perform(action);
    } catch { setNotice('Could not read analysis consent. No audio was sent. Try again.'); }
  }
  function continuePrompt() {
    const pending = promptRef.current;
    if (!pending || !enabled.current || inFlight.current) return;
    promptRef.current = null; setPrompt(null);
    if (pending.kind === 'disclosure') {
      try { saveAnalysisConsent(); }
      catch { setNotice('Could not save consent. No audio was sent. Try again.'); return; }
    }
    void perform(pending.action, pending.kind === 'uncertain');
  }
  useEffect(() => {
    if (!autoStart || autoRequested.current || !enabled.current || !uploaded || !result) return;
    autoRequested.current = true;
    // Only initial pending work is automatic. Failed/uncertain work keeps the
    // existing explicit, revision-aware retry and acknowledgement flow.
    if (result.processing_state === 'awaiting_analysis') request({ kind: 'initial' });
  });
  return { result, review: reviewState.identity === identity ? reviewState.value : null, notice, busy, prompt, refresh,
    analyze: () => request({ kind: 'initial' }),
    retry: () => result && request({ kind: 'retry', revision: result.processing_revision }),
    continuePrompt,
    cancelPrompt: () => { autoRequested.current = true; promptRef.current = null; setPrompt(null); },
  };
}
