import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import type { STTSuggestion } from './correctionLines';
import type { Transcript } from '../../contracts';
import { confirmCorrection, readCorrections } from './correctionStore';
import { bump } from './store';

export const STT_ANALYSIS_VERSION = 'recognition-v2';
export type STTState = { attempt_id: string; analysis_version?: string; feedback_revision: number; transcript_revision: number; state: string;
  updated_at: string | null; stale: boolean; selection: { token: string } | null; retry_available: boolean;
  requires_confirmation: boolean; error: { message: string } | null;
  result: { analysis_version?: string; transcript_revision: number; stale: boolean; suggestions: STTSuggestion[] } | null;
  dependency: { retry_action: string | null; description_set_id: string; processing_revision: number; requires_confirmation: boolean } | null };
const key = (api: string, id: string) => `transcription-suggestions:v2:${encodeURIComponent(normalizeApi(api))}:${id}`;
const active = new Set(['queued', 'waiting_descriptions', 'preparing', 'submitted', 'normalizing', 'waiting_quota']);
export const suggestionActive = (s: STTState | null) => !!s && !s.stale && active.has(s.state);
export function readSTTState(api: string, id: string): STTState | null {
  const value = readStored<STTState>(key(api, id)), correction = readCorrections(api, id);
  if (!value?.feedback_revision) return value;
  if (value.analysis_version === STT_ANALYSIS_VERSION && (!correction || (!correction.pending && !correction.conflict && !correction.server.source_changed &&
      correction.server.revision === (value.transcript_revision ?? 0)))) return value;
  return { ...value, state: 'stale', stale: true, retry_available: true,
    result: value.result ? { ...value.result, stale: true } : null };
}
export function readSTTSuggestions(api: string, id: string) {
  const s = readSTTState(api, id);
  return s?.state === 'completed' && !s.stale && s.result && !s.result.stale ? { revision: s.result.transcript_revision, suggestions: s.result.suggestions } : null;
}
export function createSTTClient(apiUrl: string, fetcher: typeof fetch = fetch) {
  const api = normalizeApi(apiUrl);
  async function request(id: string, body?: object) {
    const response = await fetcher(`${api}/attempts/${id}/correction-suggestions/`, { method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Transcription suggestions could not be updated. Refresh before retrying.');
    const s = await response.json() as STTState;
    if (s.attempt_id !== id || !Number.isSafeInteger(s.feedback_revision) || s.feedback_revision < 0 || typeof s.stale !== 'boolean' ||
        !['absent', 'disabled', 'unavailable', 'completed', 'failed', 'stale', 'needs_confirmation', ...active].includes(s.state) ||
        (s.selection !== null && !/^[a-f0-9]{64}$/.test(s.selection?.token))) throw new Error('Invalid suggestion response.');
    if (s.result && s.result.analysis_version !== STT_ANALYSIS_VERSION) s.result = null; // Historical candidates are not actionable.
    if (s.result) {
      if (!Number.isSafeInteger(s.result.transcript_revision) || s.result.transcript_revision < 0 || typeof s.result.stale !== 'boolean' ||
          !Array.isArray(s.result.suggestions) || s.result.suggestions.length > 30) throw new Error('Invalid suggestions.');
      const used = new Set<number>();
      for (const x of s.result.suggestions) {
        if (!Number.isSafeInteger(x.word_start) || !Number.isSafeInteger(x.word_end) || x.word_start < 0 || x.word_end < x.word_start || x.word_end >= 6000 ||
            !['malformed_word', 'technical_term', 'proper_noun', 'acronym', 'mixed_language'].includes(x.error_type) ||
            typeof x.original !== 'string' || !x.original || x.original.length > 1000 || typeof x.reason !== 'string' || !x.reason.trim() || x.reason.length > 400 ||
            !Array.isArray(x.replacements) || !x.replacements.length || x.replacements.length > 3 || x.replacements.some(r => typeof r !== 'string' || !r.trim() || r.length > 400 || r.includes('\u0000'))) throw new Error('Invalid suggestion range.');
        for (let i = x.word_start; i <= x.word_end; i++) { if (used.has(i)) throw new Error('Overlapping suggestions.'); used.add(i); }
      }
    }
    const previous = readSTTState(api, id);
    if (previous && (previous.feedback_revision > s.feedback_revision || (previous.feedback_revision === s.feedback_revision &&
        (Date.parse(previous.updated_at ?? '') > Date.parse(s.updated_at ?? '') ||
          (previous.updated_at === s.updated_at && previous.stale && !s.stale))))) return previous;
    writeStored(key(api, id), s); bump(); return readSTTState(api, id)!;
  }
  return { refresh: (id: string) => request(id),
    generate: (id: string, body: object) => request(id, body) };
}

/** Only the current cached, source-indexed AI offer can enter the local overlay. */
export function acceptSuggestedCorrection(api: string, id: string, first: number, last: number, replacement: string, transcript: Transcript) {
  const current = readCorrections(api, id), offered = readSTTSuggestions(api, id);
  const suggestion = offered?.suggestions.find(s => s.word_start === first && s.word_end === last && s.replacements.includes(replacement));
  if (!current || current.pending || current.conflict || !suggestion || offered?.revision !== current.server.revision ||
      suggestion.original !== transcript.words.slice(first, last + 1).map(w => w.text).join(' ')) {
    throw new Error('Suggestion is outdated or unavailable. Check transcription again.');
  }
  return confirmCorrection(api, id, first, last, replacement, transcript);
}
