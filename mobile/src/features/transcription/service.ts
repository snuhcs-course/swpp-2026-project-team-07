import type { AttemptResult, LocalRecording } from "../../contracts";

// Whisper owner: send multipart audio + JSON metadata; poll the returned attempt ID.
// Never call OpenAI from the app. Keep recordings available after upload failure.
export interface TranscriptionService {
  submit(recording: LocalRecording): Promise<{ attempt_id: string }>;
  getResult(attemptId: string): Promise<AttemptResult>;
  retry(attemptId: string): Promise<void>;
}
