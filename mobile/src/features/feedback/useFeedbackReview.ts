import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DescriptionState, Descriptions, FeedbackAnalysis, FeedbackSelection, ReviewAttempt, SlideSource } from '../../contracts';
import { normalizeApi } from '../transcription/analysisStorage';
import { transcriptionClientFor } from '../transcription/service';
import { TranscriptionClientError } from '../transcription/client';
import { preferFeedback } from '../transcription/reviewValidation';
import { optionalFeedback, parseDescriptions, validateDescriptionRequest, type FeedbackContext } from './validation';
import { hasFeedbackConsent, saveFeedbackConsent, readFeedback, saveFeedback, readDescriptions, saveDescriptions,
  preferDescriptions, readPending, savePending, type PendingGeneration } from './storage';

type Draft = { set: string; revision: number; slide: number; sources: SlideSource[]; descriptions: Descriptions };
type Intent = { kind: 'feedback' | 'descriptions'; revision: number; set?: string; selection: FeedbackSelection };
type Prompt = { kind: 'disclosure' | 'uncertain'; intent: Intent; operation: number };
const active = (f: FeedbackAnalysis | null) => !!f && !f.stale && (f.stage === 'descriptions'
  ? !!f.dependency && ['queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota', 'completed'].includes(f.dependency.state)
  : ['queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota'].includes(f.state));
const offline = 'Could not refresh feedback. Cached feedback and descriptions may be stale; audio, PDF and transcript remain available. Refresh when connected.';

export function withDescriptionStaleness(f: FeedbackAnalysis | null, d: DescriptionState | null): FeedbackAnalysis | null {
  if (!f || !d || f.description_set_id !== d.description_set_id) return f;
  const changed = f.description_revision !== null ? d.description_revision > f.description_revision :
    !!f.dependency && d.processing_revision > f.dependency.processing_revision && d.edited;
  if (!changed) {
    if (!f.dependency) return f;
    // A POST may return the newer description generation before the feedback GET
    // reflects it. Carry validated dependency revisions forward independently.
    const dependency = { deck_id: d.deck_id, description_set_id: d.description_set_id!, state: d.state,
      processing_revision: d.processing_revision, description_revision: d.description_revision, updated_at: d.updated_at,
      error: d.error, retry_at: d.retry_at, retry_available: d.retry_available, requires_confirmation: d.requires_confirmation,
      retry_action: d.retry_available || ['failed', 'needs_confirmation'].includes(d.state) ? 'generate_descriptions' as const : null };
    const next = preferFeedback(f, { ...f, dependency })!;
    return next.dependency === dependency && !d.error && next.error?.code === 'description_dependency_failed' ? { ...next, error: null } : next;
  }
  return { ...f, state: 'stale', stale: true, retry_available: true,
    updated_at: d.updated_at || f.updated_at, result: f.result ? { ...f.result, stale: true } : null };
}

export function useFeedbackReview(id: string, address: string, review: ReviewAttempt) {
  const api = normalizeApi(address), deck = review.deck_id!;
  const client = useMemo(() => transcriptionClientFor(api), [api]);
  const context: FeedbackContext = { attempt_id: id, deck_id: deck, duration_ms: review.duration_ms,
    transcript: review.transcript, transcript_id: review.transcript_id, slide_events: review.slide_events };
  const identity = `${api}:${id}:${deck}:${review.transcript_id || ''}:${review.duration_ms}:${JSON.stringify(review.slide_events)}`;
  const liveIdentity = useRef(identity); liveIdentity.current = identity;
  const contextRef = useRef(context); contextRef.current = context;
  const [data, setData] = useState(() => {
    let feedback = optionalFeedback(review.feedback_analysis, id, context) ?? null;
    let descriptions: DescriptionState | null = null;
    try { feedback = preferFeedback(feedback ?? undefined, readFeedback(api, id, context) ?? undefined) ?? null;
      descriptions = readDescriptions(api, deck, feedback?.description_set_id); } catch { /* Read-only fallback remains usable. */ }
    return { feedback: withDescriptionStaleness(feedback, descriptions), descriptions };
  });
  const latest = useRef(data);
  const [notice, setNotice] = useState('Cached feedback may be stale. Refreshing…');
  const [busy, setBusy] = useState(false), locked = useRef(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null), promptRef = useRef<Prompt | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null);
  const [conflict, setConflict] = useState(false);
  const enabled = useRef(false), epoch = useRef(0), controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PendingGeneration | null>(null);

  const current = useCallback((op: number) => enabled.current && epoch.current === op && liveIdentity.current === identity, [identity]);
  const cancel = useCallback(() => {
    epoch.current++; controller.current?.abort(); controller.current = null;
    if (timer.current) clearTimeout(timer.current); timer.current = null;
    promptRef.current = null; setPrompt(null); locked.current = false; setBusy(false);
  }, []);
  const begin = useCallback(() => { cancel(); controller.current = new AbortController();
    return { op: epoch.current, signal: controller.current.signal }; }, [cancel]);
  const publish = useCallback((feedback?: FeedbackAnalysis, descriptions?: DescriptionState) => {
    const previous = latest.current;
    const d = descriptions ? preferDescriptions(previous.descriptions, descriptions) : previous.descriptions;
    const f = withDescriptionStaleness(preferFeedback(previous.feedback ?? undefined, feedback) ?? null, d);
    latest.current = { feedback: f, descriptions: d }; setData(latest.current);
    try { if (f) saveFeedback(api, f); if (d) saveDescriptions(api, d); }
    catch { setNotice('Feedback received, but its offline cache could not be saved. Current data remains available.'); }
    return latest.current;
  }, [api]);
  const reconcilePending = useCallback((f: FeedbackAnalysis, d?: DescriptionState) => {
    const p = pending.current;
    if (p && ((p.kind === 'feedback' && f.feedback_revision > p.revision) ||
      (p.kind === 'descriptions' && d && d.description_set_id === p.set && d.processing_revision > p.revision))) {
      savePending(api, id, null); pending.current = null;
    }
  }, [api, id]);
  const read = useCallback(async (op: number, signal: AbortSignal) => {
    const f = await client.getFeedback(id, { signal }, contextRef.current);
    if (!current(op)) return null;
    publish(f); // A failed description read cannot discard usable feedback.
    const d = await client.getDescriptions(deck, f.description_set_id ?? undefined, { signal });
    if (!current(op)) return null;
    const accepted = publish(undefined, d);
    reconcilePending(f, d);
    return { ...accepted, freshFeedback: f, freshDescriptions: d };
  }, [client, current, deck, id, publish, reconcilePending]);
  const watch = useCallback(function poll(op: number, signal: AbortSignal) {
    if (!current(op) || !active(latest.current.feedback) || promptRef.current || locked.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void read(op, signal).then(value => { if (value && current(op)) poll(op, signal); })
        .catch(() => { if (current(op)) setNotice(offline); });
    }, 2000);
  }, [current, read]);
  const refresh = useCallback(async () => {
    if (!enabled.current || locked.current) return;
    const { op, signal } = begin(); setNotice('');
    try { const value = await read(op, signal); if (value && current(op)) watch(op, signal); }
    catch { if (current(op)) setNotice(offline); }
  }, [begin, current, read, watch]);
  useFocusEffect(useCallback(() => {
    enabled.current = AppState.currentState === 'active';
    try { pending.current = readPending(api, id); } catch { /* Preflight will refuse unsafe writes if storage stays unavailable. */ }
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      enabled.current = state === 'active';
      if (enabled.current) void refresh(); else cancel();
    });
    return () => { enabled.current = false; cancel(); listener.remove(); };
  }, [api, id, cancel, refresh]));

  async function perform(intent: Intent, consent = false, acknowledged = false) {
    if (!enabled.current || liveIdentity.current !== identity || locked.current || draftRef.current || promptRef.current) return;
    const { op, signal } = begin(); locked.current = true; setBusy(true); setNotice('');
    let submitted = false;
    try {
      pending.current = readPending(api, id);
      const fresh = await read(op, signal);
      if (!fresh || !current(op)) return;
      const f = fresh.freshFeedback, d = fresh.freshDescriptions;
      const selected = intent.kind === 'feedback' ? f.selection : d.selection;
      const revision = intent.kind === 'feedback' ? f.feedback_revision : d.processing_revision;
      if (!selected || selected.token !== intent.selection.token || revision !== intent.revision ||
        (intent.kind === 'descriptions' && (d.description_set_id !== intent.set || f.dependency?.description_set_id !== intent.set))) {
        setNotice('Selection or status changed. Review the refreshed provider and status, then choose generation again.'); return;
      }
      if (intent.kind === 'feedback' && (active(f) || (f.state === 'completed' && !fresh.feedback?.stale))) return;
      if (intent.kind === 'feedback' && f.stage === 'descriptions' && !f.stale && f.dependency?.retry_action) {
        setNotice('Retry the slide descriptions first using their own revision.'); return;
      }
      if (intent.kind === 'descriptions' && (d.descriptions || !d.retry_available)) return;
      if (intent.kind === 'feedback' && (f.availability.state !== 'available' ||
          (f.feedback_revision > 0 && !f.retry_available))) {
        setNotice('Generation is not available yet. Refresh to check configuration or the retry time.'); return;
      }
      if (consent) saveFeedbackConsent(api, selected);
      if (!hasFeedbackConsent(api, selected)) {
        const next: Prompt = { kind: 'disclosure', intent: { ...intent, selection: selected }, operation: op };
        promptRef.current = next; setPrompt(next); return;
      }
      if ((pending.current || (intent.kind === 'feedback' ? f.requires_confirmation : d.requires_confirmation)) && !acknowledged) {
        const next: Prompt = { kind: 'uncertain', intent: { ...intent, selection: selected }, operation: op };
        promptRef.current = next; setPrompt(next); return;
      }
      const marker: PendingGeneration = { kind: intent.kind, revision, set: intent.set, token: selected.token };
      // Durable before POST: blur/crash/timeout cannot silently authorize a second charge.
      savePending(api, id, marker); pending.current = marker; submitted = true;
      if (intent.kind === 'feedback') {
        const next = await client.generateFeedback(id, { expected_selection: selected.token,
          ...(revision > 0 ? { feedback_revision: revision, ...(f.requires_confirmation ? { acknowledge_uncertain: acknowledged } : {}) } : {}) }, { signal }, contextRef.current);
        if (!current(op)) return; publish(next);
      } else {
        const next = await client.generateDescriptions(deck, { expected_selection: selected.token, description_set_id: intent.set,
          processing_revision: revision, ...(d.requires_confirmation ? { acknowledge_uncertain: acknowledged } : {}) }, { signal });
        if (!current(op)) return; publish(undefined, next);
      }
      savePending(api, id, null); pending.current = null; submitted = false;
      await read(op, signal);
    } catch (error) {
      if (!current(op)) return;
      const definite = error instanceof TranscriptionClientError && !!error.status && error.status >= 400 && error.status < 500 && error.status !== 408;
      if (submitted && definite) { try { savePending(api, id, null); pending.current = null; } catch { /* Conservative acknowledgement retained. */ } }
      const mismatch = error instanceof TranscriptionClientError && error.code === 'selection_mismatch';
      const rejection = error instanceof TranscriptionClientError && error.code === 'no_speech' ? 'No speech is available for suggestions.' :
        error instanceof TranscriptionClientError && error.code === 'missing_transcript' ? 'Analyze the saved recording before generating feedback.' :
          'Generation was not admitted. Refresh and review the current revision and recovery options before trying again.';
      setNotice(mismatch ? 'Provider selection changed. Refreshed disclosure is required; choose generation again. No work was admitted.' :
        definite ? rejection : submitted ? 'Request outcome is unconfirmed. Refresh before another submission; another request may incur another charge.' : offline);
      // Reconcile only. Never automatically resubmit a failed or timed-out mutation.
      try { await read(op, signal); } catch { /* Keep cached state and the recovery notice. */ }
    } finally {
      if (current(op)) { locked.current = false; setBusy(false); watch(op, signal); }
    }
  }
  function request(kind: Intent['kind']) {
    if (!enabled.current || locked.current || promptRef.current || draftRef.current || liveIdentity.current !== identity) return;
    const f = latest.current.feedback, d = latest.current.descriptions;
    const selection = kind === 'feedback' ? f?.selection : d?.selection;
    if (!selection) { setNotice('Refresh feedback to get the current provider disclosure before generating.'); void refresh(); return; }
    void perform({ kind, selection, revision: kind === 'feedback' ? f!.feedback_revision : d!.processing_revision,
      ...(kind === 'descriptions' ? { set: d!.description_set_id! } : {}) });
  }
  // Each render captures this exact prompt, never "whatever prompt is current".
  function continuePrompt() {
    if (!prompt || promptRef.current !== prompt || !current(prompt.operation) || locked.current) return;
    promptRef.current = null; setPrompt(null);
    void perform(prompt.intent, prompt.kind === 'disclosure', prompt.kind === 'uncertain');
  }
  function cancelPrompt() { if (prompt && promptRef.current === prompt) { promptRef.current = null; setPrompt(null); } }
  function updateDraft(value: Draft | null) { draftRef.current = value; setDraft(value); }
  function edit(slide: number) {
    const d = latest.current.descriptions;
    if (locked.current || promptRef.current || !enabled.current || !d?.descriptions || !d.description_set_id || !d.provenance || draftRef.current) return;
    updateDraft({ set: d.description_set_id, revision: d.description_revision, slide, sources: d.provenance.sources,
      descriptions: JSON.parse(JSON.stringify(d.descriptions)) }); setConflict(false); setNotice('');
  }
  function change(descriptions: Descriptions) { if (draftRef.current && !locked.current) updateDraft({ ...draftRef.current, descriptions }); }
  async function save() {
    const captured = draftRef.current;
    if (!captured || locked.current || !enabled.current || liveIdentity.current !== identity) return;
    try {
      parseDescriptions(captured.descriptions, deck, captured.sources);
      validateDescriptionRequest({ description_set_id: captured.set, description_revision: captured.revision, descriptions: captured.descriptions }, deck, true);
    } catch { setNotice('Each fact needs 1–400 characters, no NUL, and an explanation when uncertain (empty when certain). Keep the complete set within 64 KiB.'); return; }
    const { op, signal } = begin(); locked.current = true; setBusy(true); setNotice('');
    let submitted = false;
    try {
      const fresh = await client.getDescriptions(deck, captured.set, { signal });
      if (!current(op)) return; publish(undefined, fresh);
      if (fresh.description_revision !== captured.revision) { setConflict(true); setNotice('Descriptions changed. Your unsaved draft is retained. Reload or Cancel.'); return; }
      submitted = true;
      const next = await client.editDescriptions(deck, { description_set_id: captured.set, description_revision: captured.revision,
        descriptions: captured.descriptions }, { signal });
      if (!current(op)) return;
      publish(undefined, next); updateDraft(null); setConflict(false);
      setNotice('Descriptions saved as edited. Affected feedback is stale; regeneration uses the saved transcript only when you choose it.');
    } catch {
      if (current(op)) { setConflict(true); setNotice(submitted ? 'Save outcome is unconfirmed or conflicted. Your unsaved draft is retained. Reload or Cancel; refresh before saving again.' : offline); }
    } finally { if (current(op)) { locked.current = false; setBusy(false); watch(op, signal); } }
  }
  async function reloadDraft() {
    const captured = draftRef.current;
    if (!captured || locked.current || !enabled.current) return;
    const { op, signal } = begin(); locked.current = true; setBusy(true);
    try {
      const next = await client.getDescriptions(deck, captured.set, { signal });
      if (!current(op)) return; publish(undefined, next);
      if (next.descriptions && next.provenance) {
        updateDraft({ ...captured, revision: next.description_revision, sources: next.provenance.sources,
          descriptions: JSON.parse(JSON.stringify(next.descriptions)) }); setConflict(false); setNotice('Loaded the current descriptions. Edit before choosing Save.');
      }
    } catch { if (current(op)) setNotice(offline); }
    finally { if (current(op)) { locked.current = false; setBusy(false); watch(op, signal); } }
  }
  return { ...data, notice, busy, prompt, draft, conflict, refresh, continuePrompt, cancelPrompt,
    generate: () => request('feedback'), retryDescriptions: () => request('descriptions'), edit, change, save, reloadDraft,
    cancelEdit: () => { if (!locked.current) { updateDraft(null); setConflict(false); setNotice(''); } } };
}
