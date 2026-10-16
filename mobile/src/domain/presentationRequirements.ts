// AI-assisted Phase 1; see docs/ai-collaboration-prompts-iteration-2.md.
import type { Run } from './run';

export type PresentationRequirements = {
  contextId: string | null; deckId: string | null;
  requiredDurationSeconds: number | null; audience: string; revision: number;
};
export const emptyRequirements = (): PresentationRequirements => ({
  contextId: null, deckId: null, requiredDurationSeconds: null, audience: '', revision: 0,
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const revision = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 2 ** 31 - 1;

export function validateRequirementValues(duration: unknown, audience: unknown) {
  if ((duration !== null && (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 60 || duration > 1800)) ||
      typeof audience !== 'string' || [...audience].length > 500 || audience.includes('\0') ||
      [...audience].some(char => { const code = char.codePointAt(0)!; return code >= 0xD800 && code <= 0xDFFF; })) {
    throw new Error('Invalid presentation requirements.');
  }
}

export function parseContext(input: unknown): PresentationRequirements {
  const v = input as Record<string, unknown> | null;
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.id !== 'string' || !uuid.test(v.id) ||
      typeof v.deck_id !== 'string' || !uuid.test(v.deck_id) || !revision(v.revision)) {
    throw new Error('Invalid presentation context.');
  }
  validateRequirementValues(v.required_duration_seconds, v.audience);
  return { contextId: v.id, deckId: v.deck_id, requiredDurationSeconds: v.required_duration_seconds as number | null,
    audience: v.audience as string, revision: v.revision };
}

export function requirementsStatus(value: PresentationRequirements): 'missing' | 'partial' | 'ready' {
  const time = value.requiredDurationSeconds !== null, audience = !!value.audience.trim();
  return time && audience ? 'ready' : time || audience ? 'partial' : 'missing';
}

export type AnalysisScope = {
  contextId: string; sourceId: string; requirementsRevision: number; profileRevision: number; analysisVersion: string;
};
export type AttemptRevision = { transcriptId: string | null; correctionRevision: number };

/** Canonical, private identity input; not an admission function or a public/loggable identifier. */
export function analysisScopeKey(run: Pick<Run, 'parts'>, scope: AnalysisScope,
  attempts: Readonly<Record<string, AttemptRevision>>): string {
  const identity = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
  if (!identity(scope.contextId) || !identity(scope.sourceId) || !identity(scope.analysisVersion) ||
      !revision(scope.requirementsRevision) || !revision(scope.profileRevision)) throw new Error('Invalid analysis scope.');
  const parts = run.parts.map(part => {
    if (part === null) return null;
    const attempt = attempts[part.attemptId];
    if (!identity(part.attemptId) || !attempt || !revision(attempt.correctionRevision) ||
        (attempt.transcriptId !== null && !identity(attempt.transcriptId)) || !part.segments.length) {
      throw new Error('Missing or invalid attempt revision.');
    }
    const segments = part.segments.map(({ startMs, endMs }) => {
      if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || startMs < 0 || endMs <= startMs) {
        throw new Error('Invalid recorded segment.');
      }
      return [startMs, endMs];
    });
    return { attemptId: part.attemptId, transcriptId: attempt.transcriptId, correctionRevision: attempt.correctionRevision, segments };
  });
  return JSON.stringify({ version: 1, contextId: scope.contextId, sourceId: scope.sourceId,
    requirementsRevision: scope.requirementsRevision, profileRevision: scope.profileRevision,
    analysisVersion: scope.analysisVersion, parts });
}
