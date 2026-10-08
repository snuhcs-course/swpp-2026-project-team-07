import type { DeviceRecording } from "./storage";

/** Keep original events and reconcile only the final native media duration. */
export function recoverRecording(recording: DeviceRecording, mediaDurationMs: number): DeviceRecording {
  if (!Number.isFinite(mediaDurationMs) || mediaDurationMs <= 0 || mediaDurationMs > 600_000) {
    throw new Error("Audio must be playable and no longer than ten minutes. The original file is retained.");
  }
  const duration_ms = Math.floor(mediaDurationMs);
  const slide_events = recording.slide_events.filter(event => event.at_ms < duration_ms);
  if (!slide_events.length || slide_events[0].at_ms !== 0) throw new Error("The initial slide checkpoint is missing.");
  return { ...recording, duration_ms, slide_events };
}
