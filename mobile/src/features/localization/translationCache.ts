// Only display prose travels on this transport. Assessment and recording endpoints are independent.
import { isDisplayWording } from './displayWording';
export type Language = 'en' | 'ko';
export type Kind = 'feedback' | 'profiles' | 'questions' | 'answer' | 'legacy_qa' | 'slide_review' | 'score' | 'coaching';
export type Resource = { kind: Kind; resource_id: string; language: Language; revision?: string };
export type Fields = Record<string, string>;
export type Request = Resource & { fields: Fields };
export type PreparedResource = Omit<Resource, 'language'> & { fields: Fields };
export type PreparedField = { source: string; en?: string; ko?: string };
type Dependencies = {
  api: string;
  read: (key: string) => unknown;
  write: (key: string, value: unknown) => void;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  wait?: () => Promise<void>;
};
const isMap = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const idOf = (r: Resource) => JSON.stringify([r.kind, r.resource_id, r.revision ?? '', r.language]);
const fieldId = (r: Resource, path: string, source: string) => JSON.stringify([idOf(r), path, source]);

/** Known generation metadata or unambiguous prose can be displayed immediately, including offline.
 * Ambiguous/other-language text goes to the translator. Source quotes do not determine the UI language. */
export function sourceLanguage(source: string, hint?: string | null): Language | null {
  const prose = source.replace(/“[^”]*”|"[^"\n]*"/gu, ' ').trim() || source;
  const letters = prose.match(/\p{Letter}/gu) ?? [];
  if (!letters.length) return null;
  if (letters.every(c => /\p{Script=Hangul}/u.test(c))) return 'ko';
  // Mixed scripts can contain a name, an English term, or an entire untranslated clause.
  if (!letters.every(c => /\p{Script=Latin}/u.test(c))) return null;
  if (hint === 'en' || hint === 'eng') return 'en';
  if (/^(?:what|why|how|where|when|which|whose|who|would|should|could|does|do you|can you)\b/iu.test(prose)) return 'en';
  // A single shared/borrowed word (for example “compare”) is insufficient evidence.
  const grammar = new Set(prose.toLowerCase().match(/\b(?:the|these|those|this|your|you|their|they|them|both|how|between|to|should|would|could|which|there|that|before|after|with|without|for|from)\b/gu));
  if (grammar.size >= 2) return 'en';
  return null;
}

export function splitRequest(resource: Resource, fields: Fields): Request[] {
  const batches: Request[] = [];
  let values: Fields = {}, size = 0;
  for (const [path, source] of Object.entries(fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (Object.keys(values).length && (Object.keys(values).length >= 32 || size + source.length > 12000)) {
      batches.push({ ...resource, fields: values }); values = {}; size = 0;
    }
    values[path] = source;
    size += source.length;
  }
  if (size) batches.push({ ...resource, fields: values });
  return batches;
}

export function createTranslationCache(deps: Dependencies) {
  const saved = new Map<string, Fields>();
  const terminal = new Map<string, Set<string>>();
  const pending = new Set<string>(), failed = new Set<string>();
  const observers = new Set<() => void>(), views = new Set<Request[]>();
  let prepareVisible: ((requests: Request[]) => () => void) | undefined;
  let version = 0;
  const notify = () => { version++; for (const f of observers) f(); };
  const storageKey = (r: Resource) => 'display-translation:v1:' + JSON.stringify([deps.api, idOf(r)]);
  const terminalKey = (r: Resource) => 'display-unavailable:v1:' + JSON.stringify([deps.api, idOf(r)]);
  function blocked(resource: Resource) {
    const id = idOf(resource);
    if (!terminal.has(id)) {
      let keys: unknown;
      try { keys = deps.read(terminalKey(resource)); } catch { /* An unreadable marker cannot hide available wording. */ }
      terminal.set(id, new Set(Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : []));
    }
    return terminal.get(id)!;
  }
  function saveBlocked(resource: Resource, keys: Set<string>) {
    try { deps.write(terminalKey(resource), [...keys]); } catch { /* The current session still knows the outcome. */ }
  }
  function block(resource: Resource, fields: Fields) {
    const keys = blocked(resource);
    let changed = false;
    for (const [p,s] of Object.entries(fields)) {
      const k = JSON.stringify([p,s]);
      if (!get(resource,p,s) && !keys.has(k)) { keys.add(k); changed = true; }
    }
    if (changed) { saveBlocked(resource, keys); notify(); }
  }
  function entries(resource: Resource) {
    const id = idOf(resource);
    if (!saved.has(id)) {
      const table: Fields = Object.create(null);
      try {
        const disk = deps.read(storageKey(resource));
        if (isMap(disk)) for (const [signature, value] of Object.entries(disk)) {
          if (typeof value !== 'string') continue;
          try {
            const field: unknown = JSON.parse(signature);
            if (Array.isArray(field) && field.length === 2 && typeof field[0] === 'string' &&
                typeof field[1] === 'string' && isDisplayWording(resource, field[0], field[1], value)) table[signature] = value;
          } catch { /* Older or malformed keys do not invalidate the other fields. */ }
        }
      } catch { /* The original assessment is available independently. */ }
      saved.set(id, table);
    }
    return saved.get(id)!;
  }
  function persist(resource: Resource, table: Fields) {
    try { deps.write(storageKey(resource), table); } catch { /* Keep the completed translation usable in this session. */ }
  }
  function get(resource: Resource, path: string, source: string) {
    return entries(resource)[JSON.stringify([path, source])] ?? null;
  }
  function install(resource: PreparedResource, variants: Record<string, PreparedField>, preferred: Language) {
    let changed = false;
    for (const language of [preferred, preferred === 'ko' ? 'en' : 'ko'] as Language[]) {
      const target = { ...resource, language };
      const table = entries(target);
      let dirty = false, unblocked = false;
      for (const [path, source] of Object.entries(resource.fields)) {
        const row = variants[path], value = row?.[language];
        if (row?.source !== source || typeof value !== 'string' || !value.trim() ||
            !isDisplayWording(target, path, source, value)) continue;
        const signature = JSON.stringify([path, source]);
        if (blocked(target).delete(signature)) unblocked = true;
        if (table[signature] !== undefined) continue;
        table[signature] = value;
        failed.delete(fieldId(target, path, source));
        dirty = true;
      }
      if (dirty) { persist(target, table); changed = true; }
      if (unblocked) { saveBlocked(target, blocked(target)); changed = true; }
    }
    if (changed) notify();
  }
  async function load(request: Request, retry: boolean) {
    const fields = Object.fromEntries(Object.entries(request.fields).filter(([p, s]) => {
      const id = fieldId(request, p, s);
      return !get(request, p, s) && !pending.has(id) && (!failed.has(id) || retry);
    }));
    const ids = Object.entries(fields).map(([p, s]) => fieldId(request, p, s));
    if (!ids.length) return;
    for (const id of ids) { pending.add(id); failed.delete(id); }
    let url = deps.api + '/localization/';
    let init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, fields, ...(retry ? { retry: true } : {}) }) };
    try {
      let expectedId: string | undefined;
      for (let polls = 0; polls < 240; polls++) {
        const response = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('Translation service unavailable');
        const reply: unknown = await response.json();
        if (!isMap(reply) || typeof reply.id !== 'string' || !/^[a-f0-9]{64}$/.test(reply.id) ||
            (expectedId !== undefined && reply.id !== expectedId) || reply.language !== request.language) throw Error('Invalid translation identity');
        expectedId = reply.id;
        if (reply.state === 'completed') {
          const result = reply.translations;
          if (!isMap(result) || Object.keys(result).length !== ids.length ||
              Object.keys(fields).some(path => typeof result[path] !== 'string' || !(result[path] as string).trim())) throw Error('Incomplete translation');
          const table = entries(request);
          const other: Resource = { ...request, language: request.language === 'en' ? 'ko' : 'en' };
          const translated: Fields = {};
          const originals: Fields = {};
          const sourceLanguages = isMap(reply.source_languages) ? reply.source_languages : {};
          for (const [path, source] of Object.entries(fields)) {
            const key = JSON.stringify([path, source]);
            const sourceLanguage = sourceLanguages[path];
            const text = sourceLanguage === request.language ? source : result[path] as string;
            if (!isDisplayWording(request, path, source, text)) throw Error('Invalid display wording');
            translated[key] = table[key] ?? text;
            const neutralPanelist = path.endsWith('.panelist') && sourceLanguage === 'zxx' && result[path] === source;
            if ((sourceLanguage === other.language || neutralPanelist) && isDisplayWording(other, path, source, source)) originals[key] = source;
          }
          persist(request, Object.assign(table, translated));
          // The translator identified short or mixed-script originals we could not recognize on the phone.
          if (Object.keys(originals).length) {
            const otherTable = Object.assign(entries(other), originals);
            persist(other, otherTable);
          }
          return;
        }
        if (reply.state !== 'pending') throw Error('Translation failed');
        await (deps.wait ? deps.wait() : new Promise(resolve => setTimeout(resolve, 1500)));
        url = deps.api + '/localization/' + expectedId + '/'; init = { method: 'GET' };
      }
      throw Error('Translation timed out');
    } catch { for (const id of ids) failed.add(id); }
    finally { for (const id of ids) pending.delete(id); notify(); }
  }
  function retain(requests: Request[]) {
    if (prepareVisible) return prepareVisible(requests);
    views.add(requests);
    for (const r of requests) void load(r, false);
    notify();
    return () => { views.delete(requests); notify(); };
  }
  function status(language: Language) {
    let translating = false;
    for (const requests of views) for (const request of requests) {
      if (request.language !== language) continue;
      for (const [path, source] of Object.entries(request.fields)) {
        const id = fieldId(request, path, source);
        if (failed.has(id)) return 'failed';
        if (pending.has(id)) translating = true;
      }
    }
    return translating ? 'pending' : 'idle';
  }
  return {
    get, install, block, retain, load, status, failed: (r: Resource, path: string, s: string) => failed.has(fieldId(r, path, s)),
    unavailable: (r: Resource, path: string, s: string) => blocked(r).has(JSON.stringify([path,s])),
    setPreparationOwner: (owner?: typeof prepareVisible) => { prepareVisible = owner; },
    subscribe: (f: () => void) => { observers.add(f); return () => { observers.delete(f); }; }, version: () => version,
    retry: (language: Language) => { for (const rs of views) for (const r of rs) if (r.language === language) void load(r, true); notify(); },
  };
}
