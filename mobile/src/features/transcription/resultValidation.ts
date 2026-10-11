import type { AttemptResult, TranscriptWord, Feedback } from "../../contracts";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const word = (value: unknown): value is TranscriptWord => object(value) &&
  typeof value.text === "string" && integer(value.start_ms) &&
  integer(value.end_ms) && value.start_ms <= value.end_ms;
const feedback = (value: unknown): value is Feedback => object(value) &&
  integer(value.slide_index) && integer(value.start_ms) && integer(value.end_ms) &&
  value.start_ms <= value.end_ms && typeof value.observation === "string" &&
  typeof value.slide_evidence === "string" && typeof value.suggestion === "string";

const stages = ["awaiting_analysis", "queued", "checking_audio", "transcribing", "aligning", "completed", "failed", "needs_confirmation"];
const activeStages = ["queued", "checking_audio", "transcribing", "aligning"];
const nullableDate = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
export function validResult(value: unknown, id: string): value is AttemptResult {
  if (!object(value) || value.attempt_id !== id || typeof value.status !== "string" ||
      !["pending", "processing", "completed", "failed"].includes(value.status) ||
      typeof value.processing_state !== "string" || !stages.includes(value.processing_state) ||
      !integer(value.processing_revision) || !integer(value.duration_ms) || value.duration_ms < 1 || value.duration_ms > 600_000 ||
      (value.failed_stage !== null && (typeof value.failed_stage !== "string" || !activeStages.includes(value.failed_stage))) ||
      typeof value.retry_available !== "boolean" || !nullableDate(value.retry_at) || typeof value.requires_confirmation !== "boolean" ||
      (typeof value.feedback_state !== "string" || !["disabled", "legacy"].includes(value.feedback_state)) ||
      ![null, "speech", "no_speech", "legacy"].includes(value.analysis_outcome as string | null)) return false;
  if ((value.status === "pending" && value.processing_state !== "awaiting_analysis") ||
      (value.status === "processing" && !activeStages.includes(value.processing_state)) ||
      (value.status === "completed" && value.processing_state !== "completed") ||
      (value.status === "failed" && !["failed", "needs_confirmation"].includes(value.processing_state)) ||
      value.requires_confirmation !== (value.processing_state === "needs_confirmation") ||
      (value.status !== "failed" && value.retry_available)) return false;
  const transcript = value.transcript;
  if (transcript !== null && (!object(transcript) || typeof transcript.text !== "string" ||
      "raw_response" in transcript || !Array.isArray(transcript.words) || !transcript.words.every(word))) return false;
  const error = value.error;
  if (error !== null && (!object(error) || typeof error.code !== "string" || typeof error.message !== "string")) return false;
  const partial = value.partial_available;
  if (!object(partial) || partial.transcript !== (transcript !== null) || partial.alignment !== (value.visits !== null)) return false;
  const duration = value.duration_ms;
  if (value.visits !== null && (!Array.isArray(value.visits) || !value.visits.every(v => object(v) &&
      integer(v.slide_index) && v.slide_index < 10 && integer(v.start_ms) && integer(v.end_ms) &&
      v.start_ms <= v.end_ms && v.end_ms <= duration && Array.isArray(v.words) &&
      v.words.every(w => word(w) && w.start_ms >= (v.start_ms as number) && w.start_ms < (v.end_ms as number) && w.end_ms <= duration)))) return false;
  const m = value.metrics;
  if (m !== null) {
    if (!object(m) || m.duration_ms !== duration || !Array.isArray(m.time_per_slide) ||
        !m.time_per_slide.every(t => object(t) && integer(t.slide_index) && t.slide_index < 10 && integer(t.duration_ms) && t.duration_ms <= duration) ||
        typeof m.detected_language !== "string" || typeof m.rate_note !== "string" || !Array.isArray(m.speaking_rates) ||
        !m.speaking_rates.every(r => object(r) && typeof r.language === "string" && ["en", "ko"].includes(r.language) && typeof r.unit === "string" && integer(r.count) &&
          typeof r.per_minute === "number" && Number.isFinite(r.per_minute) && r.per_minute >= 0)) return false;
  }
  const p = value.provenance;
  if (!object(p) || ![null, "openai"].includes(p.provider as string | null) || ![null, "whisper-1"].includes(p.model as string | null) ||
      !(p.generation === null || (integer(p.generation) && p.generation <= value.processing_revision)) ||
      ![null, "submitted", "received", "rejected", "uncertain"].includes(p.outcome as string | null) ||
      ![null, "silero-vad"].includes(p.speech_gate as string | null)) return false;
  if (value.status === "completed" && value.analysis_outcome !== "legacy") {
    if (!object(transcript) || !Array.isArray(transcript.words) || !transcript.words.every(w => word(w) && w.start_ms < duration && w.end_ms <= duration) ||
        value.visits === null || m === null || !["speech", "no_speech"].includes(String(value.analysis_outcome))) return false;
    if (value.analysis_outcome === "no_speech" && (transcript.text !== "" || transcript.words.length !== 0 ||
        (value.visits as { words: unknown[] }[]).some(v => v.words.length !== 0))) return false;
  }
  if (value.slide_events !== undefined && (!Array.isArray(value.slide_events) || !value.slide_events.length ||
      !value.slide_events.every((e, i, all) => object(e) && integer(e.slide_index) && e.slide_index < 10 && integer(e.at_ms) && e.at_ms < duration &&
        (i === 0 ? e.at_ms === 0 : e.at_ms >= all[i - 1].at_ms)))) return false;
  return Array.isArray(value.feedback) && value.feedback.every(feedback) &&
    (value.feedback_state !== "disabled" || value.feedback.length === 0) &&
    (value.status !== "completed" || (transcript !== null && error === null)) &&
    (value.status !== "failed" || error !== null);
}
