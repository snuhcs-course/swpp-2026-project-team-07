// AI-assisted Phase 1; deliberately separate from pres:v1 and deck:v1 records.
import { randomUUID } from 'expo-crypto';
import { emptyRequirements, parseContext, type PresentationRequirements } from '../../domain/presentationRequirements';
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';

let version = 0;
const listeners = new Set<() => void>();
export const getRequirementsVersion = () => version;
export function notifyRequirementsChanged() { version++; listeners.forEach(listener => listener()); }
export function subscribeRequirements(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const key = (localId: string, apiUrl: string) => {
  if (!localId.trim()) throw new Error('Missing local presentation identity.');
  return `presentation-requirements:v1:${normalizeApi(apiUrl)}:${encodeURIComponent(localId)}`;
};
const validate = (v: PresentationRequirements) => parseContext({ id: v.contextId, deck_id: v.deckId,
  required_duration_seconds: v.requiredDurationSeconds, audience: v.audience, revision: v.revision });

export function readRequirements(localId: string, apiUrl: string): PresentationRequirements {
  const stored = readStored<{ version: number; value: PresentationRequirements }>(key(localId, apiUrl));
  if (stored === null) return emptyRequirements();
  if (stored.version !== 1 || !stored.value) throw new Error('Unreadable presentation requirements.');
  return validate(stored.value);
}

export function saveRequirements(localId: string, apiUrl: string, input: PresentationRequirements) {
  const value = validate(input), current = readRequirements(localId, apiUrl);
  if (current.contextId && (current.contextId !== value.contextId || current.deckId !== value.deckId)) {
    throw new Error('The server returned a different presentation context.');
  }
  if (value.revision < current.revision) return;
  if (current.contextId && value.revision === current.revision &&
      (value.audience !== current.audience || value.requiredDurationSeconds !== current.requiredDurationSeconds)) {
    throw new Error('Conflicting requirements at the same revision.');
  }
  writeStored(key(localId, apiUrl), { version: 1, value });
  notifyRequirementsChanged();
}

/** Reserve before POST so an offline retry uses the same UUID, without inventing requirements. */
export function reserveContext(localId: string, apiUrl: string, deckId: string): PresentationRequirements {
  const current = readRequirements(localId, apiUrl);
  if (current.contextId) {
    if (current.deckId !== deckId) throw new Error('Presentation context belongs to a different deck.');
    return current;
  }
  const next = { ...emptyRequirements(), contextId: randomUUID(), deckId };
  saveRequirements(localId, apiUrl, next);
  return next;
}
