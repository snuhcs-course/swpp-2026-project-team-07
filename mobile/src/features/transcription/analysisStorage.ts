import type { AttemptResult } from '../../contracts';
import { readStored, writeStored } from '../../services/storage';
import { validResult } from './resultValidation';
import { preferResult } from './reviewValidation';

export const normalizeApi = (api: string) => api.replace(/\/+$/, '');
const resultKey = (api: string, id: string) => `analysis:v1:${encodeURIComponent(normalizeApi(api))}:${id}`;
export function readAnalysis(api: string, id: string): AttemptResult | null {
  const value = readStored<unknown>(resultKey(api, id));
  return validResult(value, id) ? value : null;
}
export function saveAnalysis(api: string, result: AttemptResult, source: 'detail' | 'history' = 'detail') {
  if (!validResult(result, result.attempt_id)) throw new Error('Could not cache an invalid analysis result.');
  const accepted = preferResult(readAnalysis(api, result.attempt_id), result, source);
  writeStored(resultKey(api, result.attempt_id), accepted);
  return accepted;
}
export function hasAnalysisConsent() { return readStored<boolean>('analysis-consent:openai:v1') === true; }
export function saveAnalysisConsent() { writeStored('analysis-consent:openai:v1', true); }
