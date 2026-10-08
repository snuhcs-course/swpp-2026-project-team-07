import type { ReviewAttempt } from '../../contracts';
import type { LocalPdf } from '../pdf/service';
import type { SavedAttempt } from '../recording/storage';
import { serverDeckId } from '../recording/upload';
import { normalizeApi } from './analysisStorage';
import { isUuid } from './reviewValidation';
import { readHistory, saveDeck, saveHistory } from './reviewStorage';
import { transcriptionClientFor } from './service';

export type HistoryEntry = { id: string; local?: SavedAttempt; review?: ReviewAttempt };
export type PresentationHistory = { key: string; title: string; deckId: string | null; pdfs: LocalPdf[]; local: SavedAttempt[]; entries: HistoryEntry[] };
export function mergeHistory(local: SavedAttempt[], server: ReviewAttempt[]): HistoryEntry[] {
  const items = new Map<string, HistoryEntry>();
  for (const review of server) items.set(review.attempt_id, { id: review.attempt_id, review });
  for (const capture of local) items.set(capture.id, { ...items.get(capture.id), id: capture.id, local: capture });
  return [...items.values()].sort((a, b) => (b.local?.created_at || b.review?.created_at || '').localeCompare(a.local?.created_at || a.review?.created_at || ''));
}
/** Only known local presentation mappings are browsed; no account-wide request or upload repair. */
export function knownHistory(api: string, pdfs: LocalPdf[], captures: SavedAttempt[]): PresentationHistory[] {
  const groups = new Map<string, PresentationHistory>();
  const localIds = new Set([...pdfs.map(p => p.id), ...captures.map(a => a.local_deck_id)]);
  for (const localId of localIds) {
    const local = captures.filter(a => a.local_deck_id === localId);
    const pdf = pdfs.find(p => p.id === localId);
    const mapping = serverDeckId(localId, api);
    const submitted = local.find(a => normalizeApi(a.server_url || '') === normalizeApi(api) && isUuid(a.recording.deck_id));
    const deckId = isUuid(mapping) ? mapping : submitted?.recording.deck_id ?? null;
    const key = deckId || `local:${localId}`;
    const group = groups.get(key) ?? { key, title: pdf?.title || local[0]?.title || 'Presentation', deckId, pdfs: [], local: [], entries: [] };
    if (pdf) group.pdfs.push(pdf);
    group.local.push(...local); groups.set(key, group);
  }
  for (const group of groups.values()) group.entries = mergeHistory(group.local, group.deckId ? readHistory(api, group.deckId) : []);
  return [...groups.values()];
}
export async function refreshHistory(api: string, group: PresentationHistory, signal: AbortSignal) {
  if (!group.deckId) return;
  const client = transcriptionClientFor(api);
  const deck = await client.getDeck(group.deckId, { signal });
  if (group.local.some(a => a.page_count !== deck.page_count)) throw new Error('The server presentation has a different page count.');
  const history = await client.getHistory(deck, { signal });
  if (signal.aborted) return;
  saveDeck(api, deck); saveHistory(api, deck, history);
}
