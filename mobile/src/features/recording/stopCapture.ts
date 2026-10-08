import type { AudioRecorder, RecordingStatus } from "expo-audio";

/** Freeze the audio clock before Android stop resets it, then await native acknowledgement. */
export async function stopCapture(
  recorder: Pick<AudioRecorder, "pause" | "stop" | "getStatus" | "isRecording" | "addListener">,
): Promise<{ uri: string; durationMillis: number }> {
  // Android resolves stop() even when MediaRecorder.stop throws. Its completion
  // event is authoritative and is dispatched later on the native main queue.
  let finish!: (status: RecordingStatus | null) => void;
  const completed = new Promise<RecordingStatus | null>(resolve => { finish = resolve; });
  const subscription = recorder.addListener("recordingStatusUpdate", status => {
    if (status.isFinished || status.hasError) finish(status);
  });
  const timeout = setTimeout(() => finish(null), 5_000);
  try {
    if (recorder.isRecording) recorder.pause();
    const durationMillis = Math.floor(recorder.getStatus().durationMillis);
    // The completion event also bounds a native stop promise that never settles.
    const status = await Promise.race([recorder.stop().then(() => completed), completed]);
    if (!status || status.hasError || !status.url || !Number.isFinite(durationMillis) || durationMillis <= 0) {
      throw new Error("The recording file could not be saved. Please record again.");
    }
    return { uri: status.url, durationMillis };
  } finally {
    clearTimeout(timeout);
    subscription.remove();
  }
}
