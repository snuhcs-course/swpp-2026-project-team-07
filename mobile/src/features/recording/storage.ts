import { randomUUID } from "expo-crypto";
import type { AttemptResult, LocalRecording, SlideEvent } from "../../contracts";
import { listStored, readStored, writeStored, removeStored } from "../../services/storage";

export type SavedAttempt = {
  id: string;
  local_deck_id: string;
  created_at: string;
  state: "capturing" | "saved" | "uploading" | "submitted" | "upload_failed";
  recording: LocalRecording;
  error?: string;
  result?: AttemptResult;
};
export function getSavedAttempt(id: string) { return readStored<SavedAttempt>(`attempt:${id}`); }
export function saveAttempt(attempt: SavedAttempt) { writeStored(`attempt:${attempt.id}`, attempt); }
export function savedAttempts(deckId?: string) {
  return listStored<SavedAttempt>("attempt:").filter(a => !deckId || a.local_deck_id === deckId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function beginAttempt(localDeckId: string, audience: string, initialSlide: number) {
  const id = randomUUID();
  const attempt: SavedAttempt = { id, local_deck_id: localDeckId, created_at: new Date().toISOString(), state: "capturing",
    recording: { id, deck_id: "", audience, audio_uri: "", duration_ms: 0, slide_events: [{ slide_index: initialSlide, at_ms: 0 }] } };
  saveAttempt(attempt);
  return id;
}
export function checkpointAttempt(id: string, uri: string, duration: number, events: SlideEvent[], finished = false) {
  const attempt = getSavedAttempt(id);
  if (!attempt) throw new Error("The recording metadata could not be found.");
  saveAttempt({ ...attempt, state: finished ? "saved" : "capturing", recording: {
    ...attempt.recording, audio_uri: uri, duration_ms: Math.floor(duration), slide_events: events,
  } });
}

export function discardEmptyAttempt(id: string) {
  const attempt = getSavedAttempt(id);
  if (attempt && !attempt.recording.duration_ms) removeStored(`attempt:${id}`);
}
