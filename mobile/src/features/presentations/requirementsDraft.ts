// Confirmed local choices are separate from server-accepted requirements and never admit AI work.
import { validateRequirementValues, type PresentationRequirements } from '../../domain/presentationRequirements';
import { readStored, removeStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { createPresentationContextClient } from './contextClient';
import { serializeContextWrite } from './contextWriter';
import { hasDefaultRequirements } from './defaultRequirementsState';
import { notifyRequirementsChanged, readRequirements } from './requirementsStore';
export type RequirementValues = Pick<PresentationRequirements, 'requiredDurationSeconds' | 'audience'>;
export type RequirementsDraft = {
  version: 1; base: PresentationRequirements; desired: RequirementValues;
  localVersion: number; pending: boolean; conflict: boolean; error: string;
};
const key = (id: string, api: string) => `presentation-requirements-draft:v1:${normalizeApi(api)}:${encodeURIComponent(id)}`;
const locks = new Map<string, Promise<void>>();
const same = (a: RequirementValues, b: RequirementValues) => a.audience === b.audience && a.requiredDurationSeconds === b.requiredDurationSeconds;
export function readRequirementsDraft(id: string, api: string): RequirementsDraft | null {
  const value = readStored<RequirementsDraft>(key(id, api));
  if (value) {
    if (value.version !== 1 || !Number.isSafeInteger(value.localVersion) || value.localVersion < 1 ||
      typeof value.pending !== 'boolean' || typeof value.conflict !== 'boolean' || typeof value.error !== 'string') throw new Error('Unreadable saved presentation choices.');
    validateRequirementValues(value.desired.requiredDurationSeconds, value.desired.audience);
  }
  return value;
}
function save(id: string, api: string, value: RequirementsDraft) { writeStored(key(id, api), value); notifyRequirementsChanged(); }
export function requirementsPending(id: string, api: string): boolean {
  try { const d = readRequirementsDraft(id, api); return !!d && (d.pending || d.conflict || !!d.error); } catch { return true; }
}
export const requirementsDirty = requirementsPending;
export function confirmRequirements(id: string, api: string, desired: RequirementValues, base = readRequirements(id, api)) {
  if (!id.trim()) throw new Error('Missing presentation identity.');
  validateRequirementValues(desired.requiredDurationSeconds, desired.audience);
  const current = readRequirementsDraft(id, api);
  save(id, api, { version: 1, base: current?.pending ? current.base : base, desired: { ...desired },
    localVersion: (current?.localVersion ?? 0) + 1, pending: true, conflict: current?.conflict ?? false, error: '' });
}
export function acceptServerRequirements(id: string, api: string) { removeStored(key(id, api)); notifyRequirementsChanged(); }
export function keepLocalRequirements(id: string, api: string) {
  const d = readRequirementsDraft(id, api); if (!d) return;
  save(id, api, { ...d, base: readRequirements(id, api), pending: true, conflict: false, error: '', localVersion: d.localVersion + 1 });
}
function mark(id: string, api: string, error: string, conflict = false) {
  const current = readRequirementsDraft(id, api);
  if (current) save(id, api, { ...current, pending: true, conflict, error });
}
function accept(id: string, api: string, sent: RequirementsDraft, server: PresentationRequirements) {
  const latest = readRequirementsDraft(id, api); if (!latest) return;
  if (latest.localVersion === sent.localVersion || same(latest.desired, server)) acceptServerRequirements(id, api);
  else save(id, api, { ...latest, base: server, pending: true, conflict: false, error: '' });
}
export function synchronizeRequirements(id: string, deckId: string, api: string, transport: typeof globalThis.fetch = globalThis.fetch): Promise<void> {
  const k = key(id, api), existing = locks.get(k); if (existing) return existing;
  const promise = serializeContextWrite(id, api, async () => {
    const client = createPresentationContextClient(api, (url, options) => transport(url, { ...options, signal: AbortSignal.timeout(15000) }));
    try {
      let sent = readRequirementsDraft(id, api); if (!sent || sent.conflict) return;
      let server = await client.ensure(id, deckId);
      while ((sent = readRequirementsDraft(id, api))) {
        if (sent.conflict) return;
        if (same(sent.desired, server)) { accept(id, api, sent, server); continue; }
        const base = sent.base;
        const pristine = !base.contextId && server.revision === 0 && !server.audience && server.requiredDurationSeconds === null;
        const initializedDefault = (!base.contextId || base.revision === 0 && !base.audience && base.requiredDurationSeconds === null) && hasDefaultRequirements(id, api);
        if (!pristine && !initializedDefault && (base.contextId !== server.contextId || base.deckId !== server.deckId || base.revision !== server.revision)) {
          mark(id, api, 'Presentation choices changed on the server. Choose which version to keep.', true); return;
        }
        const snapshot = sent;
        try { server = await client.update(id, { ...snapshot.desired, expectedRevision: server.revision }); }
        catch (error) {
          // PATCH may have committed. Read before any retry, retaining the same context identity.
          const current = await client.refresh(id);
          if (!same(current, snapshot.desired)) {
            mark(id, api, current.revision !== server.revision ? 'Presentation choices changed on the server. Choose which version to keep.' :
              error instanceof Error ? error.message : 'Saved on phone · sync pending', current.revision !== server.revision); return;
          }
          server = current;
        }
        accept(id, api, snapshot, server);
      }
    } catch (error) { mark(id, api, error instanceof Error ? error.message : 'Saved on phone · sync pending'); }
  }).finally(() => { if (locks.get(k) === promise) locks.delete(k); });
  locks.set(k, promise); return promise;
}
