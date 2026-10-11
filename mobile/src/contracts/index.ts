/** Wire-format names match docs/api-contract.md and the Django serializers. */
export type SlideEvent = { slide_index: number; at_ms: number };
export type TranscriptWord = { text: string; start_ms: number; end_ms: number };
export type Deck = { id: string; title: string; page_count: number };
export type Slide = {
  deck_id: string;
  slide_index: number;
  image_url: string;
  extracted_text: string;
};
export type AttemptMetadata = {
  id: string;
  deck_id: string;
  duration_ms: number;
  slide_events: SlideEvent[];
  audience: string;
};
export type LocalRecording = AttemptMetadata & { audio_uri: string };
export type Transcript = { text: string; words: TranscriptWord[] };
export type Feedback = {
  slide_index: number;
  start_ms: number;
  end_ms: number;
  observation: string;
  slide_evidence: string;
  suggestion: string;
};
export type ProcessingState = "awaiting_analysis" | "queued" | "checking_audio" | "transcribing" | "aligning" | "completed" | "failed" | "needs_confirmation";
export type Visit = { slide_index: number; start_ms: number; end_ms: number; words: TranscriptWord[] };
export type TimingMetrics = {
  duration_ms: number;
  time_per_slide: { slide_index: number; duration_ms: number }[];
  detected_language: string;
  speaking_rates: { language: "en" | "ko"; unit: string; count: number; per_minute: number }[];
  rate_note: string;
};
export type ProcessRequest = { processing_revision?: number; acknowledge_uncertain?: boolean };
export type AttemptResult = {
  attempt_id: string;
  deck_id?: string;
  duration_ms: number;
  slide_events?: SlideEvent[];
  audience?: string;
  created_at?: string;
  audio_url?: string;
  processing_state: ProcessingState;
  processing_revision: number;
  failed_stage: ProcessingState | null;
  retry_available: boolean;
  retry_at: string | null;
  requires_confirmation: boolean;
  partial_available: { transcript: boolean; alignment: boolean };
  visits: Visit[] | null;
  metrics: TimingMetrics | null;
  analysis_outcome: "speech" | "no_speech" | "legacy" | null;
  feedback_state: "disabled" | "legacy";
  provenance: { provider: "openai" | null; model: "whisper-1" | null; generation: number | null;
    outcome: "submitted" | "received" | "rejected" | "uncertain" | null; speech_gate: "silero-vad" | null };
  status: "pending" | "processing" | "completed" | "failed";
  transcript: Transcript | null;
  feedback: Feedback[];
  error: { code: string; message: string } | null;
};

/** Validated read-only capabilities; null means unavailable, never a fabricated capture. */
export type DeckDetail = Deck & { pdf_url: string | null };
export type ReviewAttempt = {
  attempt_id: string; deck_id: string | null; created_at: string | null;
  duration_ms: number | null; slide_events: SlideEvent[]; visits: Visit[] | null;
  transcript: Transcript | null; metrics: TimingMetrics | null; audio_url: string | null;
  status: string; processing_state: ProcessingState | 'unavailable';
  processing_result: AttemptResult | null;
};
