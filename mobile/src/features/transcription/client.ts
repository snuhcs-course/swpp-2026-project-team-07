import { validResult } from "./resultValidation";
import { parseDeck, parseReview } from './reviewValidation';
import type { DeckDetail, ReviewAttempt, AttemptResult, LocalRecording, ProcessRequest } from "../../contracts";
export { validResult } from "./resultValidation";

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
  async function getDeck(id: string, options: Options = {}): Promise<DeckDetail> {
    return parseDeck(await request(id, `/decks/${encodeURIComponent(id)}/`, 200, { method: 'GET' }, options), id, base);
  }
  async function getReview(id: string, options: Options = {}, deck?: DeckDetail): Promise<ReviewAttempt> {
    return parseReview(await request(id, `/attempts/${encodeURIComponent(id)}/`, 200, { method: 'GET' }, options), id, base, deck);
  }
  async function getHistory(deck: DeckDetail, options: Options = {}): Promise<ReviewAttempt[]> {
    const data = await request(deck.id, `/decks/${encodeURIComponent(deck.id)}/attempts/`, 200, { method: 'GET' }, options);
    if (!Array.isArray(data)) throw error('invalid_response', deck.id, 'Invalid rehearsal history.');
    return data.map(item => {
      if (!object(item) || typeof item.attempt_id !== 'string' || item.deck_id !== deck.id) throw error('invalid_response', deck.id, 'History contains a different presentation.');
      return parseReview(item, item.attempt_id, base, deck);
    });
  }
  return { upload, submit, getResult, getReview, getDeck, getHistory, process, retry, waitForResult };
}
