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
export type AttemptResult = {
  attempt_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  transcript: Transcript | null;
  feedback: Feedback[];
  error: { code: string; message: string } | null;
};
