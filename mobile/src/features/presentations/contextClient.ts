// AI-assisted Phase 1; API-only integration, no screens, defaults, or provider jobs.
import { parseContext, validateRequirementValues } from '../../domain/presentationRequirements';
import { normalizeApi } from '../transcription/analysisStorage';
import { readRequirements, reserveContext, saveRequirements } from './requirementsStore';

export class PresentationContextError extends Error {
  status: number; code: string;
  constructor(status: number, code: string) { super(`Presentation requirements request failed (HTTP ${status}).`); this.status = status; this.code = code; }
}

export function createPresentationContextClient(apiUrl: string, transport: typeof globalThis.fetch = globalThis.fetch) {
  const api = normalizeApi(apiUrl);
  async function request(localId: string, path: string, options: RequestInit) {
    const expected = readRequirements(localId, api);
    const response = await transport(`${api}/presentation-contexts/${path}`, options);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const allowed = ['invalid_request', 'not_found', 'context_conflict', 'stale_revision', 'revision_exhausted', 'temporarily_unavailable'];
      throw new PresentationContextError(response.status, allowed.includes(body?.error?.code) ? body.error.code : 'unavailable');
    }
    const value = parseContext(await response.json());
    if (value.contextId !== expected.contextId || value.deckId !== expected.deckId) {
      throw new Error('The server returned a different presentation context.');
    }
    saveRequirements(localId, api, value);
    return readRequirements(localId, api);
  }
  const body = (method: string, value: unknown): RequestInit => ({ method,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  function contextPath(localId: string) {
    const value = readRequirements(localId, api);
    if (!value.contextId) throw new Error('Create the presentation context first.');
    return `${value.contextId}/`;
  }
  return {
    ensure(localId: string, deckId: string) {
      const value = reserveContext(localId, api, deckId);
      return request(localId, '', body('POST', { id: value.contextId, deck_id: deckId }));
    },
    refresh(localId: string) { return request(localId, contextPath(localId), { method: 'GET' }); },
    update(localId: string, value: { requiredDurationSeconds: number | null; audience: string; expectedRevision: number }) {
      validateRequirementValues(value.requiredDurationSeconds, value.audience);
      if (!Number.isInteger(value.expectedRevision) || value.expectedRevision < 0 || value.expectedRevision > 2 ** 31 - 1) {
        throw new Error('Invalid expected revision.');
      }
      return request(localId, contextPath(localId), body('PATCH', { expected_revision: value.expectedRevision,
        required_duration_seconds: value.requiredDurationSeconds, audience: value.audience }));
    },
  };
}
