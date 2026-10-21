// OpenAI Codex: in-memory screen model; captures use real SQLite attempt storage.
export * from './recording-cues-runtime-native.mjs';
import { runtime } from './recording-cues-runtime-native.mjs';
export function saveDeckState(_id, state) { runtime.model.state = state; runtime.emit(); }
