import { emptyRequirements } from '../../domain/presentationRequirements';
import { presentationTiming, type PresentationTiming } from '../../domain/slides';
import { partSeconds, type Run } from '../../domain/run';
import { readStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { hasDefaultRequirements } from './defaultRequirements';
import { readRequirements } from './requirementsStore';
import type { Presentation } from './store';

/** No network, provider work or persistence writes. A different server deck cannot inherit a requirement. */
export function timedPresentation(deck: Presentation, apiUrl: string) {
  let requirements = emptyRequirements();
  try {
    const candidate = readRequirements(deck.id, apiUrl);
    const serverId = readStored<string>(`server-deck:${normalizeApi(apiUrl)}:${deck.id}`);
    if (candidate.contextId && candidate.deckId === serverId) requirements = candidate;
  } catch { /* Missing/corrupt context is not an explicit duration. Keep legacy defaults. */ }
  const timing = presentationTiming(deck, requirements);
  return { ...deck, target: timing.total, targets: timing.targets, timing, requirementsDefault: !!requirements.contextId&&hasDefaultRequirements(deck.id,apiUrl) };
}

/** JJ's full/partial-run policy with current targets, including after clearing a requirement. */
export function selectedRunTarget(run: Run | null, timing: PresentationTiming): number {
  if (!run) return 0;
  return run.full ? timing.total : run.parts.reduce((sum, part, i) =>
    sum + (partSeconds(part) > 0 ? timing.targets[i] ?? 0 : 0), 0);
}
