/** Explicit description/coaching contracts. No generation is implied by a GET. */
export type SafeFeedbackError = { code: string; message: string };
export type FeedbackProvider = 'gemini' | 'openai';
export type DescriptionFact = { text: string; uncertain: boolean; uncertainty: string };
export type SlideDescription = { deck_id: string; slide_index: number; source_id: string;
  summary: DescriptionFact; key_ideas: DescriptionFact[]; visual_facts: DescriptionFact[] };
export type Descriptions = { slides: SlideDescription[] };
export type DescriptionProvenance = { provider: FeedbackProvider; project_id: string; model: string;
  prompt_version: string; schema_version: string };
export type CoachingProvenance = DescriptionProvenance & { coaching_prompt_version: string; coaching_schema_version: string };
export type FeedbackSelection = DescriptionProvenance & { stage: 'descriptions' | 'coaching'; disclosure_version: string;
  prompt_digest: string; coaching_prompt_version?: string; coaching_schema_version?: string; coaching_prompt_digest?: string; token: string };
export type FeedbackTimes = { created_at: string | null; updated_at: string | null; queued_at: string | null;
  claimed_at: string | null; submitted_at: string | null; received_at: string | null; completed_at: string | null };
export type FeedbackRetry = { retry_at: string | null; retry_available: boolean; requires_confirmation: boolean;
  error: SafeFeedbackError | null };
export type DescriptionState = FeedbackTimes & FeedbackRetry & {
  selection?: FeedbackSelection | null; deck_id: string; description_set_id: string | null; state: 'absent' | 'disabled' | 'configuration_unavailable' |
    'source_unavailable' | 'queued' | 'preparing' | 'submitted' | 'normalizing' | 'waiting_quota' | 'completed' | 'failed' | 'needs_confirmation';
  stage: 'descriptions' | null; processing_revision: number; description_revision: number;
  descriptions: Descriptions | null; edited: boolean; stale: boolean; available_data: boolean;
  provenance: (DescriptionProvenance & { origin: 'generated' | 'edited' | null; sources: SlideSource[] }) | null;
};
export type DescriptionGenerateRequest = { expected_selection?: string; description_set_id?: string; processing_revision?: number; acknowledge_uncertain?: boolean };
export type DescriptionEditRequest = { description_set_id: string; description_revision: number; descriptions: Descriptions };
export type FeedbackGenerateRequest = { expected_selection?: string; feedback_revision?: number; acknowledge_uncertain?: boolean };
export type SlideSource = { slide_index: number; source_id: string };
export type EvidenceVisit = { slide_index: number; start_ms: number; end_ms: number; word_indexes: number[] };
export type FeedbackEvidence = { attempt_id: string; deck_id: string; transcript_id: string; chronology_id: string;
  duration_ms: number; page_count: number; audience_supplied: boolean; visits: EvidenceVisit[];
  sources: SlideSource[]; descriptions: Descriptions };
export type CoachingSuggestion = { category: 'consistency' | 'clarity' | 'audience'; slide_index: number; source_id: string;
  transcript_id: string; visit_id: number; segment_id: string; word_start: number; word_end: number;
  speech_quote: string; description_ref: string; slide_quote: string; observation: string; suggestion: string;
  start_ms: number; end_ms: number };
export type FeedbackOutput = { status: 'accepted' | 'partial' | 'empty' | 'all_invalid'; accepted_count: number; discarded_count: number };
export type CoachingResult = FeedbackOutput & { message: string | null; suggestions: CoachingSuggestion[]; feedback_revision: number;
  description_set_id: string; description_revision: number; provenance: CoachingProvenance; completed_at: string;
  stale: boolean; description_origin?: 'generated' | 'edited' | 'unavailable'; evidence: FeedbackEvidence;
  /** Derived locally on every parse. Never trust this bit from the server/cache. */
  evidence_verified: boolean };
export type FeedbackDependency = FeedbackRetry & { deck_id: string; description_set_id: string; state: DescriptionState['state'];
  processing_revision: number; description_revision: number; retry_action: 'generate_descriptions' | null;
  /** Latest dependency transition; optional for older cached metadata. */
  updated_at?: string | null };
export type FeedbackAnalysis = FeedbackTimes & FeedbackRetry & { selection?: FeedbackSelection | null; attempt_id: string; feedback_revision: number;
  state: 'absent' | 'disabled' | 'unavailable' | 'waiting_descriptions' | 'queued' | 'preparing' | 'submitted' | 'normalizing' |
    'waiting_quota' | 'needs_confirmation' | 'failed' | 'completed' | 'stale'; stage: 'descriptions' | 'coaching' | null;
  availability: { state: 'available' | 'disabled' | 'unavailable'; error: SafeFeedbackError | null };
  provenance: CoachingProvenance | null; description_set_id: string | null; description_revision: number | null;
  dependency: FeedbackDependency | null; stale: boolean; result: CoachingResult | null; last_output: FeedbackOutput | null };
