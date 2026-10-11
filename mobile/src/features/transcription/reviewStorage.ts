import type { DeckDetail, ReviewAttempt } from '../../contracts';
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi, readAnalysis, saveAnalysis } from './analysisStorage';
import { parseDeck, parseReview } from './reviewValidation';

export const reviewKey = (api: string, kind: string, id: string) => `review:v1:${encodeURIComponent(normalizeApi(api))}:${kind}:${id}`;
export function readDeck(api: string, id: string): DeckDetail | null {
  const value = readStored<unknown>(reviewKey(api, 'deck', id));
  try { return value ? parseDeck(value, id, api) : null; } catch { return null; }
}
export function saveDeck(api: string, deck: DeckDetail) { writeStored(reviewKey(api, 'deck', deck.id), parseDeck(deck, deck.id, api)); }
export function readReview(api: string, id: string): ReviewAttempt | null {
  const value = readStored<unknown>(reviewKey(api, 'attempt', id));
  try {
    const analysis = readAnalysis(api, id);
    // Base-stage installs only have analysis:v1. Reading an offline review must
    // not depend on a successful network refresh or additive cache write.
    if (!value) return analysis ? parseReview(analysis, id, api) : null;
    const review = parseReview(value, id, api);
    return analysis ? parseReview({ ...review, ...analysis, processing_result: analysis }, id, api) : review;
  } catch { return null; }
}
export function saveReview(api: string, review: ReviewAttempt, source: 'detail' | 'history' = 'detail'): ReviewAttempt {
  const previous = readReview(api, review.attempt_id);
  let next = review;
  if (review.processing_result) {
    const accepted = saveAnalysis(api, review.processing_result, source);
    next = parseReview({ ...review, ...accepted, processing_result: accepted }, review.attempt_id, api);
  } else if (previous?.processing_result) {
    // A legacy or malformed snapshot cannot erase a validated result.
    next = previous;
  }
  writeStored(reviewKey(api, 'attempt', review.attempt_id), next);
  return next;
}
export function readHistory(api: string, deckId: string): ReviewAttempt[] {
  const ids = readStored<unknown>(reviewKey(api, 'history', deckId));
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
    .map(id => readReview(api, id)).filter((r): r is ReviewAttempt => !!r && r.deck_id === deckId);
}
export function saveHistory(api: string, deck: DeckDetail, reviews: ReviewAttempt[]) {
  const old = readHistory(api, deck.id);
  for (const item of reviews) {
    if (item.deck_id !== deck.id) throw new Error('History presentation mismatch.');
    saveReview(api, parseReview(item, item.attempt_id, api, deck), 'history');
  }
  writeStored(reviewKey(api, 'history', deck.id), [...new Set([...old, ...reviews].map(r => r.attempt_id))]);
}
