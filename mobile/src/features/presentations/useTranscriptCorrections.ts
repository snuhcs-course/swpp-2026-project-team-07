import { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../../services/api';
import { readReview } from '../transcription/reviewStorage';
import { normalizeApi } from '../transcription/analysisStorage';
import { readStored, writeStored } from '../../services/storage';
import { readCorrections, initializeCorrections, createCorrectionClient, acceptServerCorrections, retryLocalCorrections } from './correctionStore';
import { createSTTClient, readSTTState, suggestionActive } from './transcriptSuggestions';
import type { DeckModel } from './useDeckModel';
import { transcriptionClientFor } from '../transcription/service';

type RetryPrompt = { kind: 'suggestions' | 'context'; id: string; revision: number; token: string; set?: string };

export function useTranscriptCorrections(id: string | null, model: DeckModel) {
  const api = normalizeApi(API_URL), transcript = id ? model.transcripts.get(id) : undefined;
  const base = id ? readReview(api, id)?.transcript_id : null;
  const correctionClient = useMemo(() => createCorrectionClient(api), [api]);
  const suggestionClient = useMemo(() => createSTTClient(api), [api]);
  const [syncFailure, setSyncFailure] = useState<{ id: string; message: string } | null>(null);
  const syncError = syncFailure?.id === id ? syncFailure.message : '';
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [ask, setAsk] = useState<RetryPrompt | null>(null);
  const currentId = useRef(id);
  useEffect(() => { currentId.current = id; return () => { currentId.current = null; }; }, [id]);
  const locked = useRef(false);
  const state = id ? readCorrections(api, id) : null;
  const suggestions = id ? readSTTState(api, id) : null;
  const pendingKey = `transcription-suggestions-pending:v1:${api}:${id}`;
  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout> | null = null;
    if (!id || !base || !transcript) return;
    initializeCorrections(api, id, base, transcript);
    void correctionClient.refresh(id).then(() => correctionClient.synchronize(id)).then(() => {
      if (alive) setSyncFailure(null);
    }).catch(() => {
      if (alive) setSyncFailure({ id, message: 'Could not synchronize corrections. Retry when connected.' });
    });
    async function poll() {
      try {
        const next = await suggestionClient.refresh(id!);
        if (alive && suggestionActive(next)) timer = setTimeout(() => { void poll(); }, 2000);
      } catch { /* Cached suggestions remain read-only; no automatic POST. */ }
    }
    void poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // Source identity and take changes restart read/sync only, never generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, base, correctionClient, suggestionClient]);

  function clearSyncError(attempt: string) { setSyncFailure(previous => previous?.id === attempt ? null : previous); }
  async function synchronize() {
    if (!id || locked.current) return;
    locked.current = true; setBusy(true);
    try { await correctionClient.refresh(id); await correctionClient.synchronize(id); if (currentId.current === id) setSyncFailure(null); }
    catch (e) { if (currentId.current === id) setSyncFailure({ id, message: e instanceof Error ? e.message : 'Synchronization failed.' }); }
    finally { locked.current = false; setBusy(false); }
  }
  async function generate(acknowledged = false, expected?: RetryPrompt) {
    if (!id || locked.current) return;
    const captured = id;
    locked.current = true; setBusy(true); setNotice('');
    try {
      await correctionClient.refresh(id);
      const synchronized = await correctionClient.synchronize(id);
      clearSyncError(id);
      const fresh = await suggestionClient.refresh(id);
      if (currentId.current !== captured) return;
      if (expected && (expected.id !== id || expected.revision !== fresh.feedback_revision || expected.token !== fresh.selection?.token)) {
        throw new Error('Suggestion status changed. Review the current take before retrying.');
      }
      if (fresh.dependency?.retry_action) throw new Error('Retry slide context first using the control below.');
      if (suggestionActive(fresh) || (fresh.state === 'completed' && !fresh.stale)) return;
      if (!fresh.selection) throw new Error('Transcription suggestions are unavailable on the server.');
      if ((fresh.requires_confirmation || readStored(pendingKey)) && !acknowledged) {
        setAsk({ kind: 'suggestions', id, revision: fresh.feedback_revision, token: fresh.selection.token }); return;
      }
      if (fresh.feedback_revision && !fresh.retry_available) throw new Error('Retry is not available yet. Refresh later.');
      const local = readCorrections(api, id);
      if (local?.pending || local?.conflict || local?.server.revision !== synchronized.server.revision) throw new Error('Synchronize the latest corrections first.');
      writeStored(pendingKey, true);
      let next = await suggestionClient.generate(id, { transcript_revision: synchronized.server.revision, expected_selection: fresh.selection.token,
        ...(fresh.feedback_revision ? { feedback_revision: fresh.feedback_revision, ...(acknowledged ? { acknowledge_uncertain: true } : {}) } : {}) });
      writeStored(pendingKey, false);
      // Poll only the explicitly requested job; switching away never submits another.
      while (currentId.current === captured && suggestionActive(next)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (currentId.current !== captured) break;
        next = await suggestionClient.refresh(id);
      }
    } catch (e) { if (currentId.current === captured) setNotice(e instanceof Error ? e.message : 'Suggestion check failed.'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function retryContext(expected?: RetryPrompt) {
    if (!id || locked.current) return;
    const captured = id;
    locked.current = true; setBusy(true);
    try {
      const fresh = await suggestionClient.refresh(id), dependency = fresh.dependency;
      const review = readReview(api, id), client = transcriptionClientFor(api);
      if (!review?.deck_id || !dependency?.retry_action) throw new Error('Refresh transcription suggestions before retrying context.');
      const context = await client.getDescriptions(review.deck_id, dependency.description_set_id);
      if (currentId.current !== captured) return;
      if (!context.selection || !context.retry_available) throw new Error('Slide context retry is not available yet.');
      if (expected && (expected.id !== id || expected.set !== context.description_set_id || expected.revision !== context.processing_revision || expected.token !== context.selection.token)) {
        throw new Error('Slide context changed. Review it before retrying.');
      }
      if (context.requires_confirmation && !expected) {
        setAsk({ kind: 'context', id, set: context.description_set_id!, revision: context.processing_revision, token: context.selection.token }); return;
      }
      await client.generateDescriptions(review.deck_id, { description_set_id: context.description_set_id!, processing_revision: context.processing_revision,
        expected_selection: context.selection.token, ...(expected ? { acknowledge_uncertain: true } : {}) });
      if (currentId.current === captured) setNotice('');
    } catch (e) { if (currentId.current === captured) setNotice(e instanceof Error ? e.message : 'Slide context retry failed.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return { state, suggestions, notice, syncError, clearSyncError, busy, ask: ask?.id === id, synchronize, generate, retryContext,
    cancel: () => setAsk(null), confirm: () => {
      const prompt = ask; setAsk(null);
      if (!prompt || prompt.id !== id || currentId.current !== id) return;
      if (prompt.kind === 'context') void retryContext(prompt); else void generate(true, prompt);
    },
    keepServer: () => { if (id) acceptServerCorrections(api, id); },
    keepLocal: () => { if (id) { try { retryLocalCorrections(api, id); void synchronize(); } catch (e) { setNotice((e as Error).message); } } } };
}
