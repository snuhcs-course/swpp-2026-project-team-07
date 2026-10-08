import type { DescriptionState, FeedbackAnalysis, FeedbackSelection } from '../../contracts';
import { readStored, writeStored, removeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { readReview } from '../transcription/reviewStorage';
import { preferFeedback } from '../transcription/reviewValidation';
import { parseDescriptionState, optionalFeedback, type FeedbackContext } from './validation';

export const feedbackKey = (api: string, kind: string, id: string) => `feedback:v1:${encodeURIComponent(normalizeApi(api))}:${kind}:${id}`;
export const consentKey = (api: string, selection: FeedbackSelection) => feedbackKey(api, 'consent', `${selection.provider}:${selection.disclosure_version}`);
export const hasFeedbackConsent = (api: string, selection: FeedbackSelection) => readStored(consentKey(api, selection)) === true;
export const saveFeedbackConsent = (api: string, selection: FeedbackSelection) => writeStored(consentKey(api, selection), true);

export function readFeedback(api: string, id: string, context?: FeedbackContext) {
  const cached = optionalFeedback(readStored(feedbackKey(api, 'attempt', id)), id, context);
  const legacy = readReview(api, id)?.feedback_analysis;
  return preferFeedback(optionalFeedback(legacy, id, context), cached) ?? null;
}
export function saveFeedback(api: string, value: FeedbackAnalysis) { writeStored(feedbackKey(api, 'attempt', value.attempt_id), value); }
export function readDescriptions(api: string, deck: string, set?: string | null): DescriptionState | null {
  const selected = set || readStored<string>(feedbackKey(api, 'deck', deck));
  if (!selected) return null;
  try {
    const value = parseDescriptionState(readStored(feedbackKey(api, 'descriptions', `${deck}:${selected}`)), deck);
    return value.description_set_id === selected ? value : null;
  } catch { return null; }
}
export function saveDescriptions(api: string, value: DescriptionState) {
  if (!value.description_set_id) return;
  writeStored(feedbackKey(api, 'descriptions', `${value.deck_id}:${value.description_set_id}`), value);
  writeStored(feedbackKey(api, 'deck', value.deck_id), value.description_set_id);
}
export function preferDescriptions(previous: DescriptionState | null, next: DescriptionState): DescriptionState {
  if (!previous || previous.description_set_id !== next.description_set_id) return next;
  if (previous.description_revision !== next.description_revision) return previous.description_revision > next.description_revision ? previous : next;
  if (previous.processing_revision !== next.processing_revision) return previous.processing_revision > next.processing_revision ? previous : next;
  // Canonicalize fractions to preserve the backend's sub-millisecond ordering.
  const stamp = (s: string | null) => Date.parse(s ?? '') * 1000 + Number((s?.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
  const a = stamp(previous.updated_at), b = stamp(next.updated_at);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a > b ? previous : next;
  const rank: Record<DescriptionState['state'], number> = { absent: 0, disabled: 0, configuration_unavailable: 0,
    source_unavailable: 0, queued: 1, preparing: 2, waiting_quota: 3, submitted: 4, normalizing: 5,
    failed: 6, needs_confirmation: 6, completed: 7 };
  return rank[previous.state] > rank[next.state] ? previous : next;
}
export type PendingGeneration = { kind: 'feedback' | 'descriptions'; revision: number; set?: string; token: string };
export function readPending(api: string, id: string): PendingGeneration | null {
  const v = readStored<PendingGeneration>(feedbackKey(api, 'pending', id));
  return v && ['feedback', 'descriptions'].includes(v.kind) && Number.isSafeInteger(v.revision) && v.revision >= 0 && typeof v.token === 'string' ? v : null;
}
export function savePending(api: string, id: string, value: PendingGeneration | null) {
  const key = feedbackKey(api, 'pending', id);
  if (value) writeStored(key, value); else removeStored(key);
}
