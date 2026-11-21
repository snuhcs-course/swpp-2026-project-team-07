// Only a generation witnessed in this session can delay its initial ready transition.
// Historical/offline assessments open immediately, and a delivered section keeps its position on later flags.
import type { DisplayField } from './useDisplayTranslation';
import { isDisplayWording } from './displayWording';
import { rubricWording } from './rubricWording';
import { sourceLanguage, type Kind, type Language, type Resource } from './translationCache';

const fresh = new Map<string, Map<string, string>>();
const identity = (api: string, kind: Kind, id: string, revision?: string) =>
  JSON.stringify([api.replace(/\/+$/, ''), kind, id, revision ?? '']);
export function markNewWording(api: string, kind: Kind, id: string, revision?: string) {
  const key = identity(api, kind, id, revision);
  if (fresh.has(key)) return;
  fresh.set(key, new Map());
  if (fresh.size > 128) fresh.delete(fresh.keys().next().value!);
}
export function firstWordingPending(api: string, resource: Omit<Resource, 'language'>, section: string, language: Language,
  cache: { get: (resource: Resource, path: string, source: string) => string | null;
    unavailable?: (resource: Resource, path: string, source: string) => boolean }, project: (text: DisplayField) => unknown) {
  const delivered = fresh.get(identity(api, resource.kind, resource.resource_id, resource.revision));
  if (!delivered) return false;
  let missing = false;
  const target = { ...resource, language };
  const fields: string[] = [];
  project((path, source, hint) => {
    fields.push(path,source);
    if (/\p{Letter}/u.test(source) && !rubricWording(resource.kind, path, source, language) &&
        !cache.get(target, path, source) && !cache.unavailable?.(target, path, source) &&
        !(sourceLanguage(source, hint) === language && isDisplayWording(target, path, source, source))) missing = true;
    return source;
  });
  const signature = JSON.stringify(fields);
  if (delivered.get(section) === signature) return false;
  if (!missing) delivered.set(section,signature);
  return missing;
}
