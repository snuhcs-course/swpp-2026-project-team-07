import type { LocalRecording } from "../../contracts";

/** Reconcile an interrupted checkpoint with the finalized native media duration. */
export function recoverRecording(recording: LocalRecording, mediaDurationMs: number): LocalRecording {
  if (!Number.isFinite(mediaDurationMs) || mediaDurationMs <= 0 || mediaDurationMs > 601_000) {
    throw new Error("The saved audio must be playable and no longer than ten minutes.");
  }
  const duration_ms = Math.min(600_000, Math.round(mediaDurationMs));
  const slide_events = recording.slide_events.filter(event => event.at_ms < duration_ms);
  if (!slide_events.length || slide_events[0].at_ms !== 0) throw new Error("The initial slide checkpoint is missing.");
  return { ...recording, duration_ms, slide_events };
}
