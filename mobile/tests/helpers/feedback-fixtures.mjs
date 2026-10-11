// Synthetic contract fixtures; no provider calls, user text or media.
import { attemptId, deckId, wireResult } from './review-fixtures.mjs';
export { attemptId, deckId };
export const setId = '33333333-3333-4333-8333-333333333333';
export const transcriptId = 'a'.repeat(64);
export const sources = [{ slide_index: 0, source_id: 'b'.repeat(64) }, { slide_index: 1, source_id: 'c'.repeat(64) }];
export const fact = text => ({ text, uncertain: false, uncertainty: '' });
export const descriptions = { slides: sources.map(s => ({ ...s, deck_id: deckId, summary: fact(`Synthetic slide ${s.slide_index}`), key_ideas: [], visual_facts: [] })) };
export const provenance = { provider: 'gemini', project_id: 'synthetic-project', model: 'gemini-3.1-flash-lite',
  prompt_version: 'description-v2', schema_version: 'description-v1', coaching_prompt_version: 'coaching-v1', coaching_schema_version: 'coaching-v1' };
const times = { created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:02.001000Z', queued_at: '2026-10-08T00:00:00Z',
  claimed_at: '2026-10-08T00:00:01Z', submitted_at: '2026-10-08T00:00:01Z', received_at: '2026-10-08T00:00:02Z', completed_at: '2026-10-08T00:00:02Z' };
const retry = { retry_at: null, retry_available: false, requires_confirmation: false, error: null };
export function descriptionState(extra = {}) { return structuredClone({ deck_id: deckId, description_set_id: setId, state: 'completed', stage: 'descriptions',
  processing_revision: 1, description_revision: 1, descriptions, edited: false, stale: false, available_data: true,
  provenance: { ...provenance, origin: 'generated', sources }, ...times, ...retry, ...extra }); }
export function feedbackState(extra = {}) {
  const recording = wireResult();
  return structuredClone({ attempt_id: attemptId, feedback_revision: 1, state: 'completed', stage: 'coaching',
    availability: { state: 'available', error: null }, provenance, description_set_id: setId, description_revision: 1, dependency: null,
    stale: false, ...times, ...retry, result: { status: 'accepted', message: null, accepted_count: 1, discarded_count: 0,
      feedback_revision: 1, description_set_id: setId, description_revision: 1, provenance: { ...provenance }, completed_at: times.completed_at, stale: false,
      evidence: { attempt_id: attemptId, deck_id: deckId, transcript_id: transcriptId, chronology_id: 'd'.repeat(64),
        duration_ms: 2000, page_count: 2, audience_supplied: false,
        visits: recording.visits.map((v, i) => ({ slide_index: v.slide_index, start_ms: v.start_ms, end_ms: v.end_ms, word_indexes: [i] })), sources, descriptions },
      suggestions: [{ category: 'clarity', slide_index: 0, source_id: sources[0].source_id, transcript_id: transcriptId,
        visit_id: 0, segment_id: 'v0s0', word_start: 0, word_end: 0, speech_quote: 'Hello', description_ref: 'summary',
        slide_quote: descriptions.slides[0].summary.text, observation: 'Synthetic observation', suggestion: 'Synthetic suggestion', start_ms: 0, end_ms: 500 }] },
    last_output: { status: 'accepted', accepted_count: 1, discarded_count: 0 }, ...extra });
}
export const withFeedback = (extra = {}) => wireResult({ transcript_id: transcriptId, feedback_analysis: feedbackState(), ...extra });
export const selection = { ...provenance, stage: 'coaching', disclosure_version: 'feedback-v1',
  prompt_digest: 'e'.repeat(64), coaching_prompt_digest: 'f'.repeat(64), token: '1'.repeat(64) };
export const descriptionSelection = { provider: provenance.provider, project_id: provenance.project_id, model: provenance.model,
  prompt_version: provenance.prompt_version, schema_version: provenance.schema_version, stage: 'descriptions',
  disclosure_version: 'feedback-v1', prompt_digest: 'e'.repeat(64), token: '2'.repeat(64) };
export function absentFeedback(extra = {}) { return feedbackState({ feedback_revision: 0, state: 'absent', stage: null,
  provenance: null, description_set_id: null, description_revision: null, result: null, last_output: null,
  created_at: null, updated_at: null, selection, ...extra }); }
