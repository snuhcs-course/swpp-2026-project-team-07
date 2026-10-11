import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { API_URL } from "../../services/api";
import { readStored, writeStored } from "../../services/storage";
import { transcriptionService } from "../transcription/service";
import { getSavedAttempt, saveAttempt, type SavedAttempt } from "./storage";

const inFlight = new Map<string, Promise<void>>();
type ServerDeck = { id: string; page_count: number };
const decksInFlight = new Map<string, Promise<ServerDeck>>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUploading(id: string) { return inFlight.has(id); }
export function serverDeckId(localId: string) { return readStored<string>(`server-deck:${API_URL}:${localId}`); }
export function uploadAttempt(id: string): Promise<void> {
  const active = inFlight.get(id);
  if (active) return active;
  const task = upload(id).finally(() => inFlight.delete(id));
  inFlight.set(id, task);
  return task;
}
function validateDeck(value: unknown, pageCount: number, expectedId?: string): ServerDeck {
  if (!value || typeof value !== "object" || !("id" in value) || !("page_count" in value) ||
      typeof value.id !== "string" || !uuid.test(value.id) || value.page_count !== pageCount ||
      (expectedId && value.id.toLowerCase() !== expectedId.toLowerCase())) {
    throw new Error("Invalid deck response or changed page count. The recording is retained locally.");
  }
  return { id: value.id.toLowerCase(), page_count: pageCount };
}
async function resolveDeck(attempt: SavedAttempt): Promise<string> {
  const key = `server-deck:${API_URL}:${attempt.local_deck_id}`;
  let pending = decksInFlight.get(key);
  if (!pending) {
    pending = (async () => {
      const cached = readStored<string>(key);
      if (typeof cached === "string" && uuid.test(cached)) {
        const response = await fetch(`${API_URL}/decks/${cached}/`, { signal: AbortSignal.timeout(120_000) });
        if (response.ok) return validateDeck(await response.json(), attempt.page_count, cached);
        // Only a confirmed missing deck permits replacement. Keep mappings on
        // transient errors; an attempt conflict must never change its UUID.
        if (response.status !== 404) throw new Error(`Could not check the saved deck (HTTP ${response.status}). Retry when connected.`);
      }
      const body = new FormData();
      body.append("file", new File(attempt.pdf_uri), "slides.pdf");
      body.append("title", attempt.title);
      const response = await fetch(`${API_URL}/decks/`, { method: "POST", body, signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`PDF upload failed (HTTP ${response.status}). Check the 10-slide / 20 MiB limit.`);
      const data = await response.json();
      const deck = validateDeck(data?.deck, attempt.page_count);
      writeStored(key, deck.id);
      return deck;
    })().finally(() => decksInFlight.delete(key));
    decksInFlight.set(key, pending);
  }
  return validateDeck(await pending, attempt.page_count).id;
}
async function upload(id: string) {
  let attempt = getSavedAttempt(id);
  if (!attempt) throw new Error("Saved rehearsal not found.");
  if (attempt.state === "submitted" && attempt.server_url === API_URL) return;
  if (["capturing", "interrupted"].includes(attempt.state) || !attempt.recording.duration_ms) throw new Error("Recover this recording before uploading.");
  try {
    // Reject legacy oversize audio before sending even the PDF; never delete it.
    const audio = new File(attempt.recording.audio_uri);
    if (!audio.exists || !audio.size) throw new Error("The saved audio could not be opened or is empty. Its local file is retained.");
    if (audio.size > 25_000_000) throw new Error("Audio exceeds 25,000,000 bytes. It stays playable locally; make a shorter new recording to upload.");
    saveAttempt({ ...attempt, state: "uploading", error: undefined });
    const deckId = await resolveDeck(attempt);
    const recording = { ...attempt.recording, deck_id: deckId };
    attempt = { ...attempt, recording, server_url: API_URL };
    saveAttempt({ ...attempt, state: "uploading" });
    await transcriptionService.upload(recording);
    // Upload success is independent of later processing; storage never queues AI.
    saveAttempt({ ...attempt, state: "submitted", error: undefined });
  } catch (error) {
    try {
      saveAttempt({ ...attempt, state: "upload_failed", error: error instanceof Error ? error.message : "Upload failed. Retry when connected." });
    } catch { /* Keep the last durable checkpoint and the original failure. */ }
    throw error;
  }
}
