import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { API_URL } from "../../services/api";
import { readStored, writeStored } from "../../services/storage";
import { getImportedPdfs } from "../pdf/service";
import { transcriptionService } from "../transcription/service";
import { getSavedAttempt, saveAttempt } from "./storage";

const inFlight = new Map<string, Promise<void>>();
export function uploadAttempt(id: string): Promise<void> {
  const active = inFlight.get(id);
  if (active) return active;
  const task = upload(id).finally(() => inFlight.delete(id));
  inFlight.set(id, task);
  return task;
}
async function upload(id: string) {
  let attempt = getSavedAttempt(id);
  if (!attempt || attempt.state === "submitted") return;
  if ((attempt.state === "capturing" || attempt.state === "interrupted") || !attempt.recording.duration_ms) throw new Error("Finish or recover this recording before uploading.");
  try {
    saveAttempt({ ...attempt, state: "uploading", error: undefined });
    const mappingKey = `server-deck:${API_URL}:${attempt.local_deck_id}`;
    let deckId = readStored<string>(mappingKey);
    if (!deckId) {
      const pdf = (await getImportedPdfs()).find(p => p.id === attempt!.local_deck_id);
      if (!pdf) throw new Error("The original PDF is needed to upload this recording.");
      const body = new FormData();
      body.append("file", new File(pdf.uri), `${pdf.id}.pdf`);
      body.append("title", pdf.title);
      const response = await fetch(`${API_URL}/decks/`, { method: "POST", body, signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`PDF upload failed (HTTP ${response.status}). Check the 10-slide / 20 MB limit.`);
      const data = await response.json();
      if (typeof data.deck?.id !== "string") throw new Error("Invalid deck response.");
      deckId = data.deck.id as string;
      writeStored(mappingKey, deckId);
    }
    attempt = { ...attempt, recording: { ...attempt.recording, deck_id: deckId } };
    saveAttempt({ ...attempt, state: "uploading" });
    await transcriptionService.submit(attempt.recording);
    saveAttempt({ ...attempt, state: "submitted", error: undefined });
  } catch (error) {
    saveAttempt({ ...attempt, state: "upload_failed", error: error instanceof Error ? error.message : "Upload failed. Retry when connected." });
    throw error;
  }
}

export function isUploading(id: string) { return inFlight.has(id); }
export function serverDeckId(localId: string) { return readStored<string>(`server-deck:${API_URL}:${localId}`); }
