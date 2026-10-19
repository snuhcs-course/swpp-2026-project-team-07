/** Shared validated selected-slide cache and GET-only reads. Generation stays in useSlideReview. */
import type { ReviewAttempt } from '../../contracts';
import type { LocalCorrections } from '../../domain/corrections';
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { bump } from '../presentations/store';
import { parseSlideReview, type ReviewScope, type SlideReview } from './slideReview';

// Shared with the app-level initial scheduler so mounted readers never abandon an active claim.
export const slideReviewInitialClaims = new Set<string>();
// Session-only preflight outcomes expose explicit recovery without consuming a durable admission claim.
export const slideReviewInitialPreflights = new Map<string, {identity:string;observation:string;status:'running'|'failed';notice:string}>();

export type SlideReviewTarget = { id: string; scope: ReviewScope; review: ReviewAttempt | null };
export const slideReviewIdentity = (api: string, id: string, scope: ReviewScope) => JSON.stringify([normalizeApi(api), id, scope]);
export const slideReviewKey = (api: string, id: string, scope: ReviewScope) => `slide-review:v1:${slideReviewIdentity(api, id, scope)}`;
export const slideReviewInitialKey = (api: string, id: string, scope: ReviewScope) => `slide-review-initial:v1:${JSON.stringify([normalizeApi(api), id, scope.slides])}`;
export function readSlideReview(api: string, id: string, scope: ReviewScope, review: ReviewAttempt | null): SlideReview | null {
  try { const saved = readStored<unknown>(slideReviewKey(api, id, scope)); return saved ? parseSlideReview(saved, id, scope, review) : null; }
  catch { return null; }
}
export function slideReviewPreflightObservation(api:string,id:string,scope:ReviewScope,review:ReviewAttempt|null) {
  const saved=readSlideReview(api,id,scope,review);
  return JSON.stringify(saved?.selection?.token??null);
}
const rank: Record<string, number> = { absent: 0, disabled: 0, unavailable: 0, queued: 1, waiting_descriptions: 1, waiting_quota: 2,
  preparing: 2, submitted: 3, normalizing: 4, failed: 5, needs_confirmation: 5, completed: 6, stale: 7 };
const stamp = (value: string | null) => Date.parse(value ?? '') * 1000 + Number((value?.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
export function publishSlideReview(api: string, value: SlideReview, review: ReviewAttempt | null): SlideReview {
  const next = parseSlideReview(value, value.attempt_id, value.scope, review);
  const previous = readSlideReview(api, next.attempt_id, next.scope, review);
  if (previous) {
    if (JSON.stringify(previous) === JSON.stringify(next)) return previous;
    if (previous.feedback_revision > next.feedback_revision) return previous;
    if (previous.feedback_revision === next.feedback_revision) {
      const before = stamp(previous.updated_at), after = stamp(next.updated_at);
      if (Number.isFinite(before) && Number.isFinite(after) && before > after) return previous;
      if ((!Number.isFinite(before) || !Number.isFinite(after) || before === after) && (rank[previous.state] ?? 0) > (rank[next.state] ?? 0)) return previous;
    }
  }
  writeStored(slideReviewKey(api, next.attempt_id, next.scope), next); bump(); return next;
}
export function effectiveSlideReview(raw: SlideReview | null, input: {
  requirementsRevision: number | null; correction: LocalCorrections | null; transcriptId?: string;
  initial?: string | null; dirty?: boolean;
}): SlideReview | null {
  if (!raw) return null;
  const c = input.correction, revision = raw.transcript_revision ?? raw.result?.transcript_revision ?? 0;
  const changedSource = !!raw.result && (!input.transcriptId || raw.result.evidence.transcript_id !== input.transcriptId) ||
    !!c && (c.server.source_changed || !!input.transcriptId && c.server.base_transcript_id !== input.transcriptId);
  const changed = changedSource || !!input.dirty || !!c && (c.pending || c.conflict) ||
    (!raw.feedback_revision && (input.initial === 'started' || !!c && c.server.revision > 0)) ||
    !!raw.feedback_revision && (raw.requirements.revision !== input.requirementsRevision ||
      (c ? c.server.revision !== revision : revision > 0));
  return changed ? { ...raw, state: 'stale', stale: true, retry_available: true, result: raw.result ? { ...raw.result, stale: true } : null } : raw;
}

// One bounded queue across selected detail views and overviews, deduplicated by the existing cache identity.
const flights = new Map<string, Promise<SlideReview>>();
const queue: (() => void)[] = [];
let reading = 0;
function schedule<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      reading++;
      void operation().then(resolve, reject).finally(() => { reading--; queue.shift()?.(); });
    };
    if (reading < 3) start(); else queue.push(start);
  });
}
export function createSlideReviewReader(apiUrl: string, transport: typeof globalThis.fetch = globalThis.fetch) {
  const api = normalizeApi(apiUrl);
  return { read(target: SlideReviewTarget): Promise<SlideReview> {
    const key = slideReviewKey(api, target.id, target.scope), existing = flights.get(key);
    if (existing) return existing;
    const promise = schedule(async () => {
      const response = await transport(`${api}/attempts/${target.id}/slide-review/?scope=${encodeURIComponent(JSON.stringify(target.scope))}`, {
        method: 'GET', signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Could not refresh AI feedback. Saved feedback is retained.');
      const next = parseSlideReview(await response.json(), target.id, target.scope, target.review);
      return publishSlideReview(api, next, target.review);
    }).finally(() => { if (flights.get(key) === promise) flights.delete(key); });
    flights.set(key, promise); return promise;
  } };
}
