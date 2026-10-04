import {
  AudioModule,
  setAudioModeAsync,
  type AudioRecorder,
} from "expo-audio";
import type { LocalRecording, SlideEvent } from "../../contracts";

// The eventual service contract: one recording attempt owns its audio file and
// every slide visit. `stop`/`cancel` will create or discard a LocalRecording
// once real deck/attempt persistence is connected.
export interface RecordingService {
  start(initialSlideIndex: number): Promise<void>;
  onSlideChanged(slideIndex: number): void;
  // TODO(recording): implement stop/cancel here, create the complete
  // LocalRecording, and define interruption/background behavior together with
  // the timeline policy. RehearsalScreen temporarily owns native stop handling.
  stop(): Promise<LocalRecording>;
  cancel(): Promise<void>;
}

type RecordingTimelineService = Pick<
  RecordingService,
  "start" | "onSlideChanged"
> & {
  getSlideEvents(durationMillis?: number): SlideEvent[];
};

// TODO(recording): replace this partial service type once RecordingService
// creates and returns the complete LocalRecording to the transcription flow.

/**
 * Small, screen-local implementation of the capture portion of RecordingService.
 *
 * This deliberately has no wall-clock timer. Audio, its duration, and slide
 * events must share the recorder's clock so a later transcription word at t ms
 * can be assigned to the correct slide visit. The caller must keep this object
 * stable for the full recording session (RehearsalScreen uses useMemo).
 */
export function createRecordingService(
  recorder: AudioRecorder,
): RecordingTimelineService {
  let slideEvents: SlideEvent[] = [];

  return {
    async start(initialSlideIndex: number): Promise<void> {
      // Android/iOS may show a system prompt here. Do not prepare or start the
      // recorder after denial: no UI state should claim capture has begun.
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission was denied.");
      }

      // Configure the native audio session before preparing the microphone.
      // This enables input and permits recording while the device is silenced.
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      // Preparation allocates the configured document-directory output file.
      // `record()` is synchronous in expo-audio; the first event is then the
      // visible slide at the agreed audio origin, exactly 0 ms.
      await recorder.prepareToRecordAsync();
      recorder.record();
      slideEvents = [{ slide_index: initialSlideIndex, at_ms: 0 }];
    },

    onSlideChanged(slideIndex: number): void {
      // Captures the destination slide and its audio-relative timestamp.
      // Each visit is kept, including repeated and backward navigation.
      if (!recorder.isRecording) return;
      // Read native status immediately at the button action. The 250 ms UI
      // polling interval must not quantize a transition timestamp.
      const atMs = Math.max(0, Math.floor(recorder.getStatus().durationMillis));
      slideEvents.push({ slide_index: slideIndex, at_ms: atMs });

    },

    getSlideEvents(durationMillis?: number): SlideEvent[] {
      // Returns a copy so callers cannot reorder or mutate the private timeline.
      // At stop, discard only events at the exact duration boundary: the contract
      // requires every visit start to be strictly before duration_ms.
      const events =
        durationMillis === undefined
          ? slideEvents
          : slideEvents.filter((event) => event.at_ms < durationMillis);
      return [...events];
    },
  };
}
