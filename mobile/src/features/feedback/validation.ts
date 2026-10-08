/** Untrusted feedback is parsed separately from transcript/audio capabilities. */
import type { CoachingProvenance, CoachingResult, CoachingSuggestion, DescriptionFact, DescriptionProvenance,
  Descriptions, DescriptionState, FeedbackAnalysis, FeedbackDependency, FeedbackEvidence, FeedbackOutput,
  FeedbackRetry, FeedbackTimes, FeedbackSelection, SafeFeedbackError, SlideSource, Transcript, SlideEvent, Visit } from '../../contracts';

type ObjectValue = Record<string, unknown>;
export type FeedbackContext = { attempt_id: string; deck_id?: string | null; duration_ms: number | null;
  transcript_id?: string | null; transcript: Transcript | null; slide_events?: SlideEvent[]; visits?: Visit[] | null };
const fail = (): never => { throw new Error('Invalid feedback data.'); };
const object = (v: unknown): ObjectValue => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as ObjectValue : fail();
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
const text = (v: unknown, max: number, min = 0): string => typeof v === 'string' && !v.includes('\u0000') &&
  [...v].length <= max && [...v].length >= min ? v : fail();
const nonblank = (v: unknown, max: number): string => { const s = text(v, max, 1); return s.trim() ? s : fail(); };
const integer = (v: unknown, max = 2 ** 31 - 1, min = 0): number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max ? v as number : fail();
const choice = <const T extends string>(v: unknown, values: readonly T[]): T => typeof v === 'string' && values.includes(v as T) ? v as T : fail();
const list = (v: unknown, max: number): unknown[] => Array.isArray(v) && v.length <= max ? v : fail();
const date = (v: unknown): string | null => v === null ? null : typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) ? v : fail();
export const canonicalUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const uuid = (v: unknown): string => canonicalUuid(v) ? v : fail();
export const isDigest = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const digest = (v: unknown): string => isDigest(v) ? v : fail();
const nullableUuid = (v: unknown) => v === null ? null : uuid(v);
const nullableRevision = (v: unknown) => v === null ? null : integer(v);
const canonicalQuote = (v: string) => v.replace(/[\s\u001c-\u001f\u0085]+/gu, ' ').trim();
const error = (v: unknown): SafeFeedbackError | null => { if (v === null) return null; const r = object(v);
  return { code: nonblank(r.code, 80), message: nonblank(r.message, 300) }; };
const bounded = (v: unknown) => { try { if (JSON.stringify(v).length > 1_200_000) fail(); } catch { fail(); } };
function times(v: ObjectValue): FeedbackTimes { return { created_at: date(v.created_at), updated_at: date(v.updated_at),
  queued_at: date(v.queued_at), claimed_at: date(v.claimed_at), submitted_at: date(v.submitted_at),
  received_at: date(v.received_at), completed_at: date(v.completed_at) }; }
function retry(v: ObjectValue): FeedbackRetry { return { retry_at: date(v.retry_at), retry_available: bool(v.retry_available),
  requires_confirmation: bool(v.requires_confirmation), error: error(v.error) }; }
function provenance(v: unknown): DescriptionProvenance { const r = object(v);
  const result = { provider: choice(r.provider, ['gemini', 'openai']), project_id: text(r.project_id, 160, 1),
    model: text(r.model, 100, 1), prompt_version: nonblank(r.prompt_version, 40), schema_version: nonblank(r.schema_version, 40) };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result.project_id) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result.model)) fail();
  return result;
}
function coachingProvenance(v: unknown): CoachingProvenance { const r = object(v); return { ...provenance(r),
  coaching_prompt_version: nonblank(r.coaching_prompt_version, 40), coaching_schema_version: nonblank(r.coaching_schema_version, 40) }; }
function selection(v: unknown, stage: 'descriptions' | 'coaching'): FeedbackSelection | null {
  if (v == null) return null; // Old caches are readable, never generation authority.
  const r = object(v);
  if (r.stage !== stage) fail();
  return { ...provenance(r), stage, disclosure_version: nonblank(r.disclosure_version, 40),
    prompt_digest: digest(r.prompt_digest), token: digest(r.token),
    ...(stage === 'coaching' ? { coaching_prompt_version: nonblank(r.coaching_prompt_version, 40),
      coaching_schema_version: nonblank(r.coaching_schema_version, 40), coaching_prompt_digest: digest(r.coaching_prompt_digest) } : {}) };
}
function fact(v: unknown): DescriptionFact { const r = object(v);
  const result = { text: nonblank(r.text, 400), uncertain: bool(r.uncertain), uncertainty: text(r.uncertainty, 400) };
  if (result.uncertain !== !!result.uncertainty.trim()) fail();
  return result;
}
function sources(v: unknown): SlideSource[] { const result = list(v, 10).map(item => { const r = object(item);
  return { slide_index: integer(r.slide_index, 9), source_id: digest(r.source_id) }; });
  if (!result.length || result.some((s, i) => s.slide_index !== i)) fail();
  return result;
}
export function parseDescriptions(v: unknown, deckId: string, scope?: SlideSource[]): Descriptions {
  const result = { slides: list(object(v).slides, 10).map(item => { const r = object(item); return {
    deck_id: uuid(r.deck_id), slide_index: integer(r.slide_index, 9), source_id: digest(r.source_id), summary: fact(r.summary),
    key_ideas: list(r.key_ideas, 5).map(fact), visual_facts: list(r.visual_facts, 5).map(fact),
  }; }) };
  if (!result.slides.length || (scope && result.slides.length !== scope.length)) fail();
  const sorted = [...result.slides].sort((a, b) => a.slide_index - b.slide_index);
  if (sorted.some((s, i) => s.slide_index !== i || s.deck_id !== deckId || (scope && s.source_id !== scope[i].source_id))) fail();
  return result;
}
const descriptionStates = ['absent', 'disabled', 'configuration_unavailable', 'source_unavailable', 'queued', 'preparing', 'submitted',
  'normalizing', 'waiting_quota', 'completed', 'failed', 'needs_confirmation'] as const;
export function parseDescriptionState(v: unknown, deckId: string): DescriptionState {
  bounded(v); const r = object(v);
  if (uuid(r.deck_id) !== deckId) fail();
  const p = r.provenance === null ? null : object(r.provenance);
  const scope = p ? { ...provenance(p), origin: p.origin === null ? null : choice(p.origin, ['generated', 'edited']), sources: sources(p.sources) } : null;
  const result: DescriptionState = { deck_id: deckId, description_set_id: nullableUuid(r.description_set_id),
    ...(r.selection !== undefined ? { selection: selection(r.selection, 'descriptions') } : {}),
    state: choice(r.state, descriptionStates), stage: r.stage === null ? null : choice(r.stage, ['descriptions']),
    processing_revision: integer(r.processing_revision), description_revision: integer(r.description_revision),
    descriptions: r.descriptions === null ? null : parseDescriptions(r.descriptions, deckId, scope?.sources),
    edited: bool(r.edited), stale: bool(r.stale), available_data: bool(r.available_data), provenance: scope, ...times(r), ...retry(r) };
  if (result.available_data !== (result.descriptions !== null) || (result.descriptions && (!scope || result.description_revision < 1)) ||
      (result.description_set_id === null && (scope || result.processing_revision || result.descriptions)) ||
      result.requires_confirmation !== (result.state === 'needs_confirmation') ||
      (result.state === 'completed' && !result.descriptions)) fail();
  return result;
}
function output(v: unknown): FeedbackOutput { const r = object(v);
  const result = { status: choice(r.status, ['accepted', 'partial', 'empty', 'all_invalid']),
    accepted_count: integer(r.accepted_count, 3), discarded_count: integer(r.discarded_count, 3) };
  const { status, accepted_count: accepted, discarded_count: discarded } = result;
  if (accepted + discarded > 3 || (status === 'accepted' && (!accepted || discarded)) ||
      (status === 'partial' && (!accepted || !discarded)) || (status === 'empty' && (accepted || discarded)) ||
      (status === 'all_invalid' && (accepted || !discarded))) fail();
  return result;
}
function evidence(v: unknown, id: string): FeedbackEvidence { const r = object(v);
  const duration = integer(r.duration_ms, 600_000, 1), pages = integer(r.page_count, 10, 1), deck = uuid(r.deck_id);
  const scope = sources(r.sources);
  const visits = list(r.visits, 1000).map(item => { const visit = object(item); return {
    slide_index: integer(visit.slide_index, pages - 1), start_ms: integer(visit.start_ms, duration - 1),
    end_ms: integer(visit.end_ms, duration), word_indexes: list(visit.word_indexes, 6000).map(i => integer(i, 5999)),
  }; });
  if (!visits.length || scope.length !== pages || visits.some((visit, i) =>
    visit.start_ms > visit.end_ms || visit.start_ms !== (i ? visits[i - 1].end_ms : 0) ||
    (i === visits.length - 1 && visit.end_ms !== duration) ||
    visit.word_indexes.some((w, j) => j > 0 && w <= visit.word_indexes[j - 1]))) fail();
  const indexes = visits.flatMap(visit => visit.word_indexes).sort((a, b) => a - b);
  if (!indexes.length || indexes.length > 6000 || indexes.some((w, i) => w !== i)) fail();
  if (uuid(r.attempt_id) !== id) fail();
  return { attempt_id: id, deck_id: deck, transcript_id: digest(r.transcript_id), chronology_id: digest(r.chronology_id),
    duration_ms: duration, page_count: pages, audience_supplied: bool(r.audience_supplied), visits, sources: scope,
    descriptions: parseDescriptions(r.descriptions, deck, scope) };
}
function suggestion(v: unknown, context: FeedbackEvidence): CoachingSuggestion {
  const r = object(v);
  const result: CoachingSuggestion = { category: choice(r.category, ['consistency', 'clarity', 'audience']),
    slide_index: integer(r.slide_index, context.page_count - 1), source_id: digest(r.source_id), transcript_id: digest(r.transcript_id),
    visit_id: integer(r.visit_id, context.visits.length - 1), segment_id: text(r.segment_id, 12, 1),
    word_start: integer(r.word_start, 5999), word_end: integer(r.word_end, 5999), speech_quote: nonblank(r.speech_quote, 1000),
    description_ref: text(r.description_ref, 20, 1), slide_quote: nonblank(r.slide_quote, 400),
    observation: nonblank(r.observation, 600), suggestion: nonblank(r.suggestion, 700),
    start_ms: integer(r.start_ms, context.duration_ms - 1), end_ms: integer(r.end_ms, context.duration_ms) };
  const visit = context.visits[result.visit_id];
  const chunks: number[][] = [];
  for (const index of visit.word_indexes) {
    const last = chunks[chunks.length - 1];
    if (!last || last.length === 40 || last[last.length - 1] + 1 !== index) chunks.push([index]); else last.push(index);
  }
  const chunk = chunks.find((_, i) => `v${result.visit_id}s${i}` === result.segment_id);
  const slide = context.descriptions.slides.find(s => s.slide_index === result.slide_index);
  const match = /^(summary|key_ideas\/[0-4]|visual_facts\/[0-4])$/.exec(result.description_ref);
  const [kind, ordinal] = result.description_ref.split('/');
  const cited = !match || !slide ? null : kind === 'summary' ? slide.summary : kind === 'key_ideas' ? slide.key_ideas[Number(ordinal)] : slide.visual_facts[Number(ordinal)];
  if (!chunk || visit.slide_index !== result.slide_index || !slide || slide.source_id !== result.source_id ||
      result.transcript_id !== context.transcript_id || result.word_start > result.word_end ||
      !chunk.includes(result.word_start) || !chunk.includes(result.word_end) ||
      !cited || cited.uncertain || cited.text !== result.slide_quote ||
      result.start_ms > result.end_ms || (result.category === 'audience' && !context.audience_supplied)) fail();
  return result;
}
/** No text/timestamp matching: reconstruct the complete original-index partition. */
function verifyEvidence(result: CoachingResult, context?: FeedbackContext, pages?: number): boolean {
  if (!context || context.attempt_id !== result.evidence.attempt_id || context.deck_id !== result.evidence.deck_id ||
      context.transcript_id !== result.evidence.transcript_id || context.duration_ms !== result.evidence.duration_ms ||
      (pages !== undefined && pages !== result.evidence.page_count) || !context.transcript || !context.slide_events?.length) return false;
  const { words } = context.transcript, visits = result.evidence.visits;
  if (!words.length || words.length > 6000 || visits.length !== context.slide_events.length) return false;
  const expected = visits.map(() => [] as number[]);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w || typeof w.text !== 'string' || w.text.includes('\u0000') || !w.text.trim() ||
        !Number.isSafeInteger(w.start_ms) || !Number.isSafeInteger(w.end_ms) || w.start_ms < 0 ||
        w.start_ms >= result.evidence.duration_ms || w.end_ms < w.start_ms || w.end_ms > result.evidence.duration_ms) return false;
    let visit = visits.length - 1;
    while (visit > 0 && visits[visit].start_ms > w.start_ms) visit--;
    expected[visit].push(i);
  }
  if (visits.some((visit, i) => visit.slide_index !== context.slide_events![i].slide_index ||
      visit.start_ms !== context.slide_events![i].at_ms || JSON.stringify(visit.word_indexes) !== JSON.stringify(expected[i]))) return false;
  return result.suggestions.every(card => {
    const selected = words.slice(card.word_start, card.word_end + 1);
    return canonicalQuote(card.speech_quote) === canonicalQuote(selected.map(w => w.text).join(' ')) &&
      card.start_ms === Math.min(...selected.map(w => w.start_ms)) && card.end_ms === Math.max(...selected.map(w => w.end_ms));
  });
}
function result(v: unknown, id: string, context?: FeedbackContext, pages?: number): CoachingResult {
  const r = object(v), scope = evidence(r.evidence, id), summary = output(r);
  const cards = list(r.suggestions, 3).map(item => suggestion(item, scope));
  const used = new Set<number>();
  for (const card of cards) for (let i = card.word_start; i <= card.word_end; i++) { if (used.has(i)) fail(); used.add(i); }
  if (cards.length !== summary.accepted_count || !date(r.completed_at)) fail();
  const parsed: CoachingResult = { ...summary, message: r.message === null ? null : nonblank(r.message, 100), suggestions: cards, feedback_revision: integer(r.feedback_revision, 2 ** 31 - 1, 1),
    description_set_id: uuid(r.description_set_id), description_revision: integer(r.description_revision, 2 ** 31 - 1, 1),
    description_origin: r.description_origin === undefined ? 'unavailable' : choice(r.description_origin, ['generated', 'edited', 'unavailable']),
    provenance: coachingProvenance(r.provenance), completed_at: date(r.completed_at)!, stale: bool(r.stale), evidence: scope, evidence_verified: false };
  if ((parsed.status === 'empty' && parsed.message !== 'No supported suggestions.') ||
      (parsed.status !== 'empty' && parsed.message !== null)) fail();
  parsed.evidence_verified = verifyEvidence(parsed, context, pages);
  // Present malformed cards neither as verified nor as silently repaired data.
  // No context permits read-only text, but a provided matching context must agree.
  if (context?.deck_id && context.deck_id !== scope.deck_id) fail();
  const completeContext = context?.transcript && context.deck_id && context.duration_ms && context.slide_events?.length && context.transcript_id;
  if (completeContext && ((context.transcript_id === scope.transcript_id && !parsed.evidence_verified) ||
      (context.transcript_id !== scope.transcript_id && !parsed.stale))) fail();
  return parsed;
}
function dependency(v: unknown): FeedbackDependency { const r = object(v); return { deck_id: uuid(r.deck_id),
  description_set_id: uuid(r.description_set_id), state: choice(r.state, descriptionStates),
  processing_revision: integer(r.processing_revision), description_revision: integer(r.description_revision),
  ...(r.updated_at !== undefined ? { updated_at: date(r.updated_at) } : {}),
  retry_action: r.retry_action === null ? null : choice(r.retry_action, ['generate_descriptions']), ...retry(r) }; }
export function parseFeedback(v: unknown, id: string, context?: FeedbackContext, pages?: number): FeedbackAnalysis {
  bounded(v); const r = object(v), available = object(r.availability);
  if (uuid(r.attempt_id) !== id) fail();
  const parsed: FeedbackAnalysis = { attempt_id: id, feedback_revision: integer(r.feedback_revision),
    ...(r.selection !== undefined ? { selection: selection(r.selection, 'coaching') } : {}),
    state: choice(r.state, ['absent', 'disabled', 'unavailable', 'waiting_descriptions', 'queued', 'preparing', 'submitted', 'normalizing',
      'waiting_quota', 'needs_confirmation', 'failed', 'completed', 'stale']),
    stage: r.stage === null ? null : choice(r.stage, ['descriptions', 'coaching']),
    availability: { state: choice(available.state, ['available', 'disabled', 'unavailable']), error: error(available.error) },
    provenance: r.provenance === null ? null : coachingProvenance(r.provenance),
    description_set_id: nullableUuid(r.description_set_id), description_revision: nullableRevision(r.description_revision),
    dependency: r.dependency === null ? null : dependency(r.dependency), stale: bool(r.stale),
    result: r.result === null ? null : result(r.result, id, context, pages),
    last_output: r.last_output === null ? null : output(r.last_output), ...times(r), ...retry(r) };
  if ((parsed.feedback_revision === 0 && (parsed.result || parsed.description_set_id || parsed.provenance || parsed.stage)) ||
      (parsed.feedback_revision > 0 && (!parsed.description_set_id || !parsed.provenance || !parsed.stage || !parsed.updated_at)) ||
      parsed.stale !== (parsed.state === 'stale') ||
      (parsed.result && (parsed.result.feedback_revision > parsed.feedback_revision || parsed.result.description_set_id !== parsed.description_set_id ||
        JSON.stringify(parsed.result.provenance) !== JSON.stringify(parsed.provenance) ||
        (parsed.result.feedback_revision !== parsed.feedback_revision && !parsed.result.stale))) ||
      (parsed.state === 'completed' && (!parsed.result || parsed.result.status === 'all_invalid' || parsed.result.stale)) ||
      (parsed.result && !parsed.result.stale && parsed.result.description_revision !== parsed.description_revision) ||
      (parsed.stale && parsed.result && !parsed.result.stale) ||
      (parsed.result && parsed.result.feedback_revision === parsed.feedback_revision && parsed.last_output &&
        (parsed.result.status !== parsed.last_output.status || parsed.result.accepted_count !== parsed.last_output.accepted_count ||
          parsed.result.discarded_count !== parsed.last_output.discarded_count)) ||
      (parsed.requires_confirmation && !['needs_confirmation', 'stale'].includes(parsed.state)) ||
      (parsed.stage === 'descriptions') !== (parsed.dependency !== null) ||
      (parsed.dependency && (parsed.dependency.description_set_id !== parsed.description_set_id ||
        parsed.dependency.requires_confirmation !== (parsed.dependency.state === 'needs_confirmation') ||
        (context?.deck_id && parsed.dependency.deck_id !== context.deck_id)))) fail();
  return parsed;
}
export function optionalFeedback(v: unknown, id: string, context?: FeedbackContext, pages?: number): FeedbackAnalysis | undefined {
  try { return v === undefined ? undefined : parseFeedback(v, id, context, pages); } catch { return undefined; }
}
/** Revalidate at use; neither a wire/cache flag nor a legacy card enables seeking. */
export function feedbackSeekTarget(value: FeedbackAnalysis, cardIndex: number, context: FeedbackContext, pages: number) {
  try {
    const parsed = parseFeedback(value, context.attempt_id, context, pages);
    const result = parsed.result;
    if (parsed.stale || result?.stale || !result?.evidence_verified || !Number.isSafeInteger(cardIndex) || cardIndex < 0) return null;
    const card = result.suggestions[cardIndex];
    return card && card.end_ms > card.start_ms ? { slide_index: card.slide_index, start_ms: card.start_ms, end_ms: card.end_ms } : null;
  } catch { return null; }
}

/** Runtime request guards reject extra/client-selected provider fields before fetch. */
export function validateFeedbackRequest(value: unknown) {
  const r = object(value);
  if (Object.keys(r).some(k => !['feedback_revision', 'acknowledge_uncertain', 'expected_selection'].includes(k))) fail();
  if ('expected_selection' in r) digest(r.expected_selection);
  if ('feedback_revision' in r) integer(r.feedback_revision);
  if ('acknowledge_uncertain' in r) { bool(r.acknowledge_uncertain); if (!('feedback_revision' in r)) fail(); }
}
export function validateDescriptionRequest(value: unknown, deckId: string, edit = false) {
  const r = object(value), allowed = edit ? ['description_set_id', 'description_revision', 'descriptions'] :
    ['description_set_id', 'processing_revision', 'acknowledge_uncertain', 'expected_selection'];
  if (Object.keys(r).some(k => !allowed.includes(k)) || (edit && Object.keys(r).length !== 3)) fail();
  if ('expected_selection' in r) digest(r.expected_selection);
  if ('description_set_id' in r) uuid(r.description_set_id);
  if ('processing_revision' in r) integer(r.processing_revision);
  if ('description_revision' in r) integer(r.description_revision);
  if ('acknowledge_uncertain' in r) bool(r.acknowledge_uncertain);
  if (Object.keys(r).some(k => k !== 'expected_selection') && !('description_set_id' in r)) fail();
  if (edit) { bounded(r.descriptions); parseDescriptions(r.descriptions, deckId);
    // JSON uses UTF-8 on the wire; count code points without a native TextEncoder dependency.
    const bytes = [...JSON.stringify(r.descriptions)].reduce((n, c) => n + (c.codePointAt(0)! <= 0x7f ? 1 : c.codePointAt(0)! <= 0x7ff ? 2 : c.codePointAt(0)! <= 0xffff ? 3 : 4), 0);
    if (bytes > 64 * 1024) fail();
  }
}
