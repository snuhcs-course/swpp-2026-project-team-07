// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import type { LocalRecording } from "../../contracts";

// Recording owner: implement using expo-audio and persistent expo-file-system storage.
// start resolves only once capture has started. Audio and events share the same origin.
export interface RecordingService {
  start(
    deckId: string,
    initialSlideIndex: number,
    audience: string,
  ): Promise<void>;
  onSlideChanged(slideIndex: number): void;
  stop(): Promise<LocalRecording>;
  cancel(): Promise<void>;
}
