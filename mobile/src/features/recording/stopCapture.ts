import type { AudioRecorder } from "expo-audio";

/** Freeze the audio clock before Android stop resets its native duration. */
export async function stopCapture(
  recorder: Pick<AudioRecorder, "pause" | "stop" | "getStatus" | "uri" | "isRecording">,
): Promise<{ uri: string; durationMillis: number }> {
  if (recorder.isRecording) recorder.pause();
  const durationMillis = Math.floor(recorder.getStatus().durationMillis);
  await recorder.stop();
  const uri = recorder.uri;
  if (!uri || durationMillis <= 0) {
    throw new Error("The recording file could not be saved. Please record again.");
  }
  return { uri, durationMillis };
}
