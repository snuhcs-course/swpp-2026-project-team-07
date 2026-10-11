import type { AttemptResult, LocalRecording, TranscriptWord, Feedback, ProcessRequest } from "../../contracts";

export class TranscriptionClientError extends Error {
  readonly code: string;
  readonly attemptId: string;
  readonly status?: number;

  constructor(code: string, message: string, attemptId: string, status?: number) {
    super(message);
    this.name = "TranscriptionClientError";
    this.code = code;
    this.attemptId = attemptId;
    this.status = status;
  }
}

type Options = { signal?: AbortSignal };
type PollOptions = Options & { intervalMs?: number; maxAttempts?: number; onUpdate?: (result: AttemptResult) => void };
type Dependencies = {
  baseUrl: string;
  audioFile: (uri: string) => Blob;
  fetch?: typeof fetch;
  timeoutMs?: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

export function createTranscriptionClient(deps: Dependencies) {
  const fetcher = deps.fetch ?? fetch;
  const base = deps.baseUrl.replace(/\/+$/, "");
  const timeoutMs = deps.timeoutMs ?? 60_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid request timeout.");
  const error = (code: string, id: string, message: string, status?: number) =>
    new TranscriptionClientError(code, message, id, status);
  function checkId(id: string) {
    if (!uuid.test(id)) throw error("invalid_recording", id, "A valid attempt UUID is required.");
  }
  function cancelled(id: string) { return error("cancelled", id, "Result checking was cancelled."); }

  async function request(id: string, route: string, expected: number | number[], init: RequestInit, options: Options) {
    checkId(id);
    if (options.signal?.aborted) throw cancelled(id);
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetcher(`${base}${route}`, { ...init, signal: controller.signal });
      if (!(Array.isArray(expected) ? expected : [expected]).includes(response.status)) {
        let detail: unknown;
        try { detail = await response.json(); } catch { /* Use the safe HTTP fallback. */ }
        if (object(detail) && object(detail.error) && typeof detail.error.code === "string" && typeof detail.error.message === "string") {
          throw error(detail.error.code, id, detail.error.message, response.status);
        }
        throw error(response.status === 501 ? "not_implemented" : "http_error", id,
          response.status === 501 ? "The server has not implemented this feature yet." :
            `The server returned HTTP ${response.status}.`, response.status);
      }
      let data: unknown;
      try { data = await response.json(); }
      catch {
        if (controller.signal.aborted) throw cancelled(id);
        throw error("invalid_response", id, "The server returned invalid JSON.");
      }
      if (controller.signal.aborted) throw cancelled(id);
      return data;
    } catch (cause) {
      if (timedOut) throw error("timeout", id, "The request timed out. Your local recording is unchanged.");
      if (options.signal?.aborted) throw cancelled(id);
      if (cause instanceof TranscriptionClientError) throw cause;
      throw error("network_error", id, "Could not reach the server. Your local recording is unchanged.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  const processing = new Set<string>();
  async function process(id: string, payload: ProcessRequest = {}, options: Options = {}): Promise<AttemptResult> {
    if (processing.has(id)) throw error("request_in_progress", id, "An analysis request is already in progress. Refresh for its status.");
    if ((payload.processing_revision !== undefined && !integer(payload.processing_revision)) ||
        (payload.acknowledge_uncertain !== undefined && typeof payload.acknowledge_uncertain !== "boolean")) {
      throw error("invalid_request", id, "Invalid analysis revision or acknowledgement.");
    }
    processing.add(id);
    try {
      const data = await request(id, `/attempts/${encodeURIComponent(id)}/process/`, [200, 202],
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, options);
      if (!validResult(data, id)) throw error("invalid_response", id, "The processing response did not match the recording.");
      return data;
    } finally { processing.delete(id); }
  }
  async function retry(id: string, payload: ProcessRequest, options: Options = {}) {
    if (!integer(payload.processing_revision)) throw error("invalid_request", id, "Refresh before retrying with the current revision.");
    return process(id, payload, options);
  }

  async function upload(recording: LocalRecording, options: Options = {}) {
    const { id, deck_id, duration_ms, audience, slide_events, audio_uri } = recording;
    checkId(id);
    if (options.signal?.aborted) throw cancelled(id);
    if (!uuid.test(deck_id) || !integer(duration_ms) || duration_ms === 0 ||
        typeof audience !== "string" || audience.length > 500 ||
        typeof audio_uri !== "string" || !/^(file|content):\/\//.test(audio_uri) ||
        !Array.isArray(slide_events) || !slide_events.length ||
        !slide_events.every((event, index) => object(event) && integer(event.slide_index) &&
          integer(event.at_ms) && event.at_ms < duration_ms &&
          (index === 0 ? event.at_ms === 0 : event.at_ms >= slide_events[index - 1].at_ms))) {
      throw error("invalid_recording", id, "Recording metadata or local audio URI is invalid.");
    }
    let file: Blob;
    try { file = deps.audioFile(audio_uri); }
    catch { throw error("audio_unavailable", id, "The local audio file could not be opened."); }
    if (!file.size || file.size > 25_000_000) {
      throw error("invalid_audio_size", id, "Audio must contain 1 to 25,000,000 bytes.");
    }
    // File.name from Expo preserves the container suffix; never invent an m4a extension.
    const name = (file as Blob & { name?: string }).name;
    if (!name || !/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(name)) {
      throw error("unsupported_audio", id, "The recording needs a supported audio filename.");
    }
    const body = new FormData();
    body.append("audio", file, name);
    body.append("metadata", JSON.stringify({ id, deck_id, duration_ms, audience, slide_events }));
    // Let fetch generate the multipart Content-Type boundary.
    const uploaded = await request(id, "/attempts/", 201, { method: "POST", body }, options);
    if (!object(uploaded) || uploaded.attempt_id !== id) {
      throw error("invalid_response", id, "The upload response did not match the recording.");
    }
    return { attempt_id: id };
  }

  async function getResult(id: string, options: Options = {}): Promise<AttemptResult> {
    const data = await request(id, `/attempts/${encodeURIComponent(id)}/`, 200,
      { method: "GET" }, options);
    if (!validResult(data, id)) throw error("invalid_response", id, "The result did not match the expected recording format.");
    return data;
  }

  async function waitForResult(id: string, options: PollOptions = {}): Promise<AttemptResult> {
    const { intervalMs = 2000, maxAttempts = 60 } = options;
    checkId(id);
    if (!integer(intervalMs) || !integer(maxAttempts) || maxAttempts === 0) {
      throw error("invalid_poll_options", id, "Polling needs a nonnegative interval and positive attempt count.");
    }
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await getResult(id, options);
      options.onUpdate?.(result);
      if (result.status === "completed" || result.status === "failed") return result;
      if (attempt + 1 === maxAttempts) break;
      await new Promise<void>((resolve, reject) => {
        if (options.signal?.aborted) { reject(cancelled(id)); return; }
        const abort = () => { clearTimeout(timer); reject(cancelled(id)); };
        const timer = setTimeout(() => {
          options.signal?.removeEventListener("abort", abort);
          resolve();
        }, intervalMs);
        options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    throw error("poll_limit", id, "Processing is still pending. Check this attempt again later.");
  }

  async function submit(recording: LocalRecording, options: Options = {}) {
    const result = await upload(recording, options);
    await process(recording.id, {}, options);
    return result;
  }
  return { upload, submit, getResult, process, retry, waitForResult };
}
