import type { AttemptResult, DeckDetail, ReviewAttempt, SlideEvent, TimingMetrics, Visit } from '../../contracts';
import { validResult } from './resultValidation';

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export const validDuration = (v: unknown): v is number => integer(v) && v > 0 && v <= 600_000;

/** Media is explicit GET-only, same-origin, with no credentials or server-chosen local paths. */
export function mediaUrl(value: unknown, api: string): string | null {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value), base = new URL(api);
    if (!['http:', 'https:'].includes(base.protocol) || url.origin !== base.origin ||
        base.username || base.password || url.username || url.password || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export function parseDeck(value: unknown, id: string, api: string): DeckDetail {
  if (!object(value) || !isUuid(id) || value.id !== id || typeof value.title !== 'string' ||
      !integer(value.page_count) || value.page_count < 1 || value.page_count > 10) throw new Error('Invalid presentation metadata.');
  return { id, title: value.title, page_count: value.page_count, pdf_url: mediaUrl(value.pdf_url, api) };
}
export function validEvents(value: unknown, duration: number, pages = 10): value is SlideEvent[] {
  return Array.isArray(value) && value.length > 0 && value.every((e, i) => object(e) && integer(e.slide_index) &&
    e.slide_index < pages && integer(e.at_ms) && e.at_ms < duration && (i === 0 ? e.at_ms === 0 : e.at_ms >= value[i - 1].at_ms));
}
export function validVisits(value: unknown, duration: number, pages = 10, events?: SlideEvent[]): value is Visit[] {
  return Array.isArray(value) && value.length > 0 && (!events || events.length === value.length) && value.every((v, i) =>
    object(v) && integer(v.slide_index) && v.slide_index < pages && integer(v.start_ms) && integer(v.end_ms) &&
    v.start_ms <= v.end_ms && v.end_ms <= duration && (i === 0 ? v.start_ms === 0 : v.start_ms === value[i - 1].end_ms) &&
    (i !== value.length - 1 || v.end_ms === duration) &&
    (!events || (v.slide_index === events[i].slide_index && v.start_ms === events[i].at_ms)) && Array.isArray(v.words));
}

function reviewMetrics(value: unknown, duration: number | null, pages: number): TimingMetrics | null {
  if (!duration || !object(value) || value.duration_ms !== duration || typeof value.detected_language !== 'string' || typeof value.rate_note !== 'string' ||
      !Array.isArray(value.time_per_slide) || !value.time_per_slide.every(t => object(t) && integer(t.slide_index) && t.slide_index < pages && integer(t.duration_ms) && t.duration_ms <= duration) ||
      new Set(value.time_per_slide.map(t => t.slide_index)).size !== value.time_per_slide.length ||
      value.time_per_slide.reduce((sum, t) => sum + t.duration_ms, 0) !== duration ||
      !Array.isArray(value.speaking_rates) || !value.speaking_rates.every(r => object(r) && ['en', 'ko'].includes(String(r.language)) && typeof r.unit === 'string' && integer(r.count) &&
        typeof r.per_minute === 'number' && Number.isFinite(r.per_minute) && r.per_minute >= 0) ||
      new Set(value.speaking_rates.map(r => r.language)).size !== value.speaking_rates.length) return null;
  return value as TimingMetrics;
}

/** Review capabilities degrade independently. Strict process validation remains separate. */
export function parseReview(value: unknown, id: string, api: string, deck?: DeckDetail): ReviewAttempt {
  if (!object(value) || !isUuid(id) || value.attempt_id !== id ||
      (value.deck_id != null && (!isUuid(value.deck_id) || (deck && value.deck_id !== deck.id)))) {
    throw new Error('This rehearsal does not belong to the expected presentation.');
  }
  const duration = validDuration(value.duration_ms) ? value.duration_ms : null;
  const pages = deck?.page_count ?? 10;
  const events = duration && validEvents(value.slide_events, duration, pages) ? value.slide_events : [];
  const visits = duration && validVisits(value.visits, duration, pages, events.length ? events : undefined) ? value.visits : null;
  const rawTranscript = value.transcript;
  const transcript = object(rawTranscript) && typeof rawTranscript.text === 'string' ? {
    text: rawTranscript.text,
    // Dropping a malformed token can bind a later repeated word to the wrong
    // occurrence. Keep the verbatim text, but fall back to untimed text as a whole.
    words: Array.isArray(rawTranscript.words) && rawTranscript.words.every(w => object(w) && typeof w.text === 'string' &&
      integer(w.start_ms) && integer(w.end_ms) && w.start_ms <= w.end_ms)
      ? rawTranscript.words.map(w => ({ text: w.text as string, start_ms: w.start_ms as number, end_ms: w.end_ms as number })) : [],
  } : null;
  const candidate = value.processing_result ?? value;
  const processing = validResult(candidate, id) ? candidate : null;
  const metrics = reviewMetrics(value.metrics, duration, pages);
  const processTimeline = processing && (!processing.slide_events || validEvents(processing.slide_events, processing.duration_ms, pages)) &&
    (!processing.visits || validVisits(processing.visits, processing.duration_ms, pages, processing.slide_events)) &&
    (!processing.metrics || reviewMetrics(processing.metrics, processing.duration_ms, pages));
  return { attempt_id: id, deck_id: isUuid(value.deck_id) ? value.deck_id : null,
    created_at: typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at)) ? value.created_at : null,
    duration_ms: duration, slide_events: events, visits, transcript, metrics,
    audio_url: mediaUrl(value.audio_url, api),
    status: typeof value.status === 'string' && ['pending', 'processing', 'completed', 'failed'].includes(value.status) ? value.status : 'unknown',
    processing_state: processing?.processing_state ?? 'unavailable',
    processing_result: processTimeline && processing && (!deck || (!processing.deck_id || processing.deck_id === deck.id)) ? processing : null,
  };
}

export function preferResult(previous: AttemptResult | null, next: AttemptResult, source: 'detail' | 'history' = 'detail'): AttemptResult {
  if (!previous) return next;
  if (previous.processing_revision !== next.processing_revision) return previous.processing_revision > next.processing_revision ? previous : next;
  const rank = { awaiting_analysis: 0, queued: 1, checking_audio: 2, transcribing: 3, aligning: 4, failed: 5, needs_confirmation: 5, completed: 6 };
  if (rank[previous.processing_state] > rank[next.processing_state]) return previous;
  if (source === 'history' && rank[previous.processing_state] === rank[next.processing_state]) return previous;
  return next;
}
