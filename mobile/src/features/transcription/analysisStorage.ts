import type { AttemptResult } from '../../contracts';
import { readStored, writeStored } from '../../services/storage';
import { parseResult } from './resultValidation';
import { preferResult } from './reviewValidation';

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
export function hasAnalysisConsent() { return readStored<boolean>('analysis-consent:openai:v1') === true; }
export function saveAnalysisConsent() { writeStored('analysis-consent:openai:v1', true); }
