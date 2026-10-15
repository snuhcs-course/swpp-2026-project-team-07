// Phase 4: local confirmation, synchronization and analysis admission are separate.
import type { Transcript } from '../../contracts';
import { correctedText, replaceCorrection, type Correction, type CorrectionSnapshot, type LocalCorrections } from '../../domain/corrections';
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { bump } from './store';

const key = (api: string, id: string) => `transcript-corrections:v2:${encodeURIComponent(normalizeApi(api))}:${id}`;
const locks = new Map<string, Promise<LocalCorrections>>();
const same = (a: readonly Correction[], b: readonly Correction[]) => a.length === b.length &&
  a.every((edit, i) => edit.word_start === b[i].word_start && edit.word_end === b[i].word_end && edit.text === b[i].text);
export function readCorrections(api: string, id: string): LocalCorrections | null { return readStored(key(api, id)); }
function save(api: string, id: string, value: LocalCorrections) {
  writeStored(key(api, id), value); bump(); return value;
}
export function parseCorrectionSnapshot(v: unknown, id: string): CorrectionSnapshot {
  const s = v as CorrectionSnapshot;
  if (!s || s.attempt_id !== id || !/^[a-f0-9]{64}$/.test(s.base_transcript_id) || !Number.isSafeInteger(s.revision) || s.revision < 0 ||
      typeof s.source_changed !== 'boolean' || typeof s.effective_text !== 'string' || !Array.isArray(s.edits) || s.edits.length > 2000) throw new Error('Invalid correction response.');
  let end = -1;
  for (const e of s.edits) {
    if (!e || !Number.isSafeInteger(e.word_start) || !Number.isSafeInteger(e.word_end) || e.word_start <= end || e.word_end < e.word_start ||
        e.word_end >= 6000 || typeof e.text !== 'string' || !e.text.trim() || e.text.length > 4000 || e.text.includes('\u0000')) throw new Error('Invalid correction range.');
    end = e.word_end;
  }
  return s;
}
export function initializeCorrections(api: string, id: string, base: string, transcript: Transcript) {
  const current = readCorrections(api, id);
  if (current) return current;
  return save(api, id, { server: { attempt_id: id, base_transcript_id: base, revision: 0, edits: [], effective_text: transcript.text, source_changed: false },
    edits: [], localVersion: 0, pending: false, conflict: false, error: '' });
}
export function confirmCorrection(api: string, id: string, first: number, last: number, text: string, transcript: Transcript) {
  const current = readCorrections(api, id);
  if (!current) throw new Error('Transcript identity is not ready. Refresh transcription first.');
  if (current.server.source_changed) throw new Error('The source transcript changed. Resolve its source before editing these ranges.');
  const edits = replaceCorrection(current.edits, first, last, text, transcript);
  if (correctedText(transcript, edits) === correctedText(transcript, current.edits)) return current;
  return save(api, id, { ...current, edits, pending: !same(edits, current.server.edits), localVersion: current.localVersion + 1, error: '' });
}
export function acceptServerCorrections(api: string, id: string) {
  const current = readCorrections(api, id);
  if (!current) return;
  return save(api, id, { ...current, edits: current.server.edits, pending: false, conflict: false, error: '', localVersion: current.localVersion + 1 });
}
export function restoreCorrections(api: string, id: string, first: number, last: number, transcript: Transcript) {
  const current = readCorrections(api, id);
  if (!current || current.server.source_changed) throw new Error('The original source must be available before restoring corrections.');
  const edits = current.edits.filter(e => e.word_end < first || e.word_start > last);
  if (correctedText(transcript, edits) === correctedText(transcript, current.edits)) return current;
  return save(api, id, { ...current, edits, pending: !same(edits, current.server.edits), localVersion: current.localVersion + 1, error: '' });
}
export function retryLocalCorrections(api: string, id: string) {
  const current = readCorrections(api, id);
  if (!current || current.server.source_changed) throw new Error('The original transcript changed. Keep the saved source and resolve it before synchronizing.');
  save(api, id, { ...current, conflict: false, pending: !same(current.edits, current.server.edits), error: '' });
}

export function createCorrectionClient(apiUrl: string, fetcher: typeof fetch = fetch) {
  const api = normalizeApi(apiUrl);
  async function request(id: string, body?: object) {
    const response = await fetcher(`${api}/attempts/${id}/corrections/`, {
      method: body ? 'PATCH' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(response.status === 409 ? 'Correction conflict' : response.status === 400 ? 'This suggestion is no longer valid. Restore the original and check transcription again.' : 'Corrections are saved on this phone. Synchronize when connected.');
    return parseCorrectionSnapshot(await response.json(), id);
  }
  async function refresh(id: string) {
    const server = await request(id), current = readCorrections(api, id);
    if (current && server.revision < current.server.revision) return current;
    const conflict = !!current && ((current.conflict && current.pending && !same(current.edits, server.edits)) || server.base_transcript_id !== current.server.base_transcript_id ||
      (current.pending && server.revision !== current.server.revision && !same(current.edits, server.edits)));
    return save(api, id, { server, edits: current?.pending ? current.edits : server.edits,
      localVersion: current?.localVersion ?? 0, pending: !!current?.pending && !same(current.edits, server.edits),
      conflict: !!server.source_changed || conflict, error: conflict ? 'Corrections changed on the server. Choose which version to keep.' : '' });
  }
  async function syncLoop(id: string) {
    try {
      let current = readCorrections(api, id) ?? await refresh(id);
      if (current.conflict) throw new Error('Resolve correction conflicts before analysis.');
      while (current.pending) {
        if (current.conflict) throw new Error('Resolve correction conflicts before analysis.');
        const sent = current;
        const server = await request(id, { base_transcript_id: sent.server.base_transcript_id, expected_revision: sent.server.revision, edits: sent.edits });
        current = readCorrections(api, id)!;
        if (current.server.revision > server.revision || current.conflict) throw new Error('Corrections changed during synchronization. Refresh and resolve the conflict.');
        const edits = current.localVersion === sent.localVersion ? server.edits : current.edits;
        current = save(api, id, { ...current, server, edits, pending: !same(edits, server.edits), conflict: false, error: '' });
      }
      return current;
    } catch (error) {
      if (error instanceof Error && error.message === 'Correction conflict') await refresh(id);
      const current = readCorrections(api, id);
      if (current) save(api, id, { ...current, error: error instanceof Error ? error.message : 'Synchronization failed.' });
      throw error;
    }
  }
  function synchronize(id: string) {
    const k = key(api, id), existing = locks.get(k);
    if (existing) return existing;
    const promise = syncLoop(id).finally(() => { if (locks.get(k) === promise) locks.delete(k); });
    locks.set(k, promise); return promise;
  }
  return { refresh, synchronize };
}
