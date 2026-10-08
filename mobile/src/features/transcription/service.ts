import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { API_URL } from "../../services/api";
import { createTranscriptionClient } from "./client";

// Backend-only provider credentials. This service never deletes local recordings.
export const transcriptionClientFor = (baseUrl: string) => createTranscriptionClient({
  baseUrl,
  fetch: expoFetch as typeof fetch,
  audioFile: (uri) => new File(uri),
});

export const transcriptionService = transcriptionClientFor(API_URL);

export type TranscriptionService = ReturnType<typeof createTranscriptionClient>;
export { TranscriptionClientError } from "./client";
