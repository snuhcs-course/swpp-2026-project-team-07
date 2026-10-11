import { randomUUID } from "expo-crypto";
import type { AttemptResult, AttemptMetadata, SlideEvent } from "../../contracts";
import { listStored, readStored, writeStored } from "../../services/storage";

// Local PDF keys never occupy the server deck_id field.
export type DeviceRecording = Omit<AttemptMetadata, "deck_id"> & { audio_uri: string; deck_id?: string };
export type SavedAttempt = {
  id: string; local_deck_id: string; title: string; pdf_uri: string; page_count: number;
  created_at: string;
  state: "capturing" | "interrupted" | "saved" | "uploading" | "submitted" | "upload_failed";
  recording: DeviceRecording; error?: string; result?: AttemptResult;
  server_url?: string;
};
export function getSavedAttempt(id: string) { return readStored<SavedAttempt>(`attempt:${id}`); }
export function saveAttempt(attempt: SavedAttempt) { writeStored(`attempt:${attempt.id}`, attempt); }
export function savedAttempts(deckId?: string) {
  return listStored<SavedAttempt>("attempt:").filter(a => !deckId || a.local_deck_id === deckId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function beginAttempt(deck: { id: string; title: string; uri: string; pageCount: number }, audience: string, initialSlide: number, audioUri = "") {
  // Complete startup recovery before allowing any new active capture.
  recoverPendingAttempts();
  const id = randomUUID();
  saveAttempt({ id, local_deck_id: deck.id, title: deck.title, pdf_uri: deck.uri, page_count: deck.pageCount,
    created_at: new Date().toISOString(), state: "capturing",
    recording: { id, audience, audio_uri: audioUri, duration_ms: 0, slide_events: [{ slide_index: initialSlide, at_ms: 0 }] } });
  return id;
}
export function checkpointAttempt(id: string, uri: string, duration: number, events: SlideEvent[], finished = false) {
  const attempt = getSavedAttempt(id);
  if (!attempt) throw new Error("The recording metadata could not be found.");
  if (!Number.isFinite(duration) || duration < 0) throw new Error("Invalid audio clock.");
  if (finished && (!uri || duration < 1 || duration > 600_000)) throw new Error("Recording exceeds the ten-minute limit or is empty. Audio is kept for recovery.");
  saveAttempt({ ...attempt, state: finished ? "saved" : "capturing", error: undefined, recording: {
    ...attempt.recording, audio_uri: uri || attempt.recording.audio_uri,
    duration_ms: Math.floor(duration), slide_events: events.map(event => ({ ...event })),
  } });
}
export function interruptAttempt(id: string, error: string) {
  const attempt = getSavedAttempt(id);
  if (attempt) saveAttempt({ ...attempt, state: "interrupted", error });
}
// Run once per process, before the first capture. Never rewrite an active recording.
let recovered = false;
export function recoverPendingAttempts() {
  if (recovered) return;
  for (const attempt of savedAttempts()) {
    if (attempt.state === "capturing") interruptAttempt(attempt.id, "Recording interrupted. Check the saved audio before recovery.");
    if (attempt.state === "uploading") saveAttempt({ ...attempt, state: "upload_failed", error: "Upload was interrupted. Retry safely with the same attempt ID." });
  }
  recovered = true;
}
