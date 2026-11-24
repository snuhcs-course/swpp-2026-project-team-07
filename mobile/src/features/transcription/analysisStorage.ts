// Scribe migration: OpenAI Codex, Iteration 2 (2026-10-16); see active collaboration log.
import type { AttemptResult } from '../../contracts';
import { readStored, writeStored } from '../../services/storage';
import { parseResult } from './resultValidation';
import { preferResult } from './reviewValidation';
import { STORE_MODE } from '../../services/apiConfig';
import { onlineAllowed } from '../../services/storePrivacy';

export const normalizeApi = (api: string) => api.replace(/\/+$/, '');
const resultKey = (api: string, id: string) => `analysis:v1:${encodeURIComponent(normalizeApi(api))}:${id}`;
export function readAnalysis(api: string, id: string): AttemptResult | null {
  const value = readStored<unknown>(resultKey(api, id));
  return parseResult(value, id);
}
export function saveAnalysis(api: string, result: AttemptResult, source: 'detail' | 'history' = 'detail') {
  const parsed = parseResult(result, result.attempt_id);
  if (!parsed) throw new Error('Could not cache an invalid analysis result.');
  const accepted = preferResult(readAnalysis(api, result.attempt_id), parsed, source);
  writeStored(resultKey(api, result.attempt_id), accepted);
  return accepted;
}
export function hasAnalysisConsent() { return STORE_MODE ? onlineAllowed() : readStored<boolean>('analysis-consent:elevenlabs:scribe-v2:keyterms:v2') === true; }
export function saveAnalysisConsent() { if (!STORE_MODE) writeStored('analysis-consent:elevenlabs:scribe-v2:keyterms:v2', true); }
