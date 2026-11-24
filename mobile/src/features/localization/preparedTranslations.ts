// Display-only work for the selected rehearsal. Background preparation and a visible card share one flight.
import { readCoachingJson } from '../../services/storeBudget';
import { isDisplayWording } from './displayWording';
import { rubricWording } from './rubricWording';
import { sourceLanguage, splitRequest, type createTranslationCache, type Fields, type Language,
  type PreparedField, type PreparedResource, type Request } from './translationCache';

type Cache = ReturnType<typeof createTranslationCache>;
type Job = { resource: PreparedResource; enrolled: boolean; submitted: Fields; retry: boolean;
  running: boolean; next: number; failures: number; polls: number; terminal: boolean };
type Options = { api: string; cache: Cache; fetch: (url: string, init: RequestInit) => Promise<Response>;
  language: () => Language; now?: () => number; schedule?: typeof setTimeout; unschedule?: typeof clearTimeout };
const map = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const identity = (r: PreparedResource) => JSON.stringify([r.kind, r.resource_id, r.revision ?? '']);

export function createPreparedTranslations({ api, cache, fetch, language, now = Date.now,
  schedule = setTimeout, unschedule = clearTimeout }: Options) {
  let selected: PreparedResource[] = [], active = true, inFlight = 0;
  const visible = new Set<Request[]>(), jobs = new Map<string, Job>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function missing(r: PreparedResource, target: Language): Fields {
    const resource = { ...r, language: target };
    return Object.fromEntries(Object.entries(r.fields).filter(([path, source]) =>
      /\p{Letter}/u.test(source) && !rubricWording(r.kind, path, source, target) &&
      !cache.get(resource, path, source) && !(sourceLanguage(source) === target && isDisplayWording(resource, path, source, source))));
  }

  function ready(r: PreparedResource) {
    return Object.keys(r.fields).length > 0 && !Object.keys(missing(r, 'en')).length && !Object.keys(missing(r, 'ko')).length;
  }
  function hasTerminal(r: PreparedResource) {
    return (['en','ko'] as const).some(l => Object.entries(r.fields).some(([p,s]) => cache.unavailable({...r,language:l},p,s)));
  }

  function delay() {
    if (timer !== undefined) { unschedule(timer); timer = undefined; }
    if (!active || inFlight >= 3) return;
    const due = Math.min(...Array.from(jobs.values(), j => j.running ? Infinity : j.next));
    if (due < Infinity) timer = schedule(pump, Math.max(0, due - now()));
  }

  function reconcile() {
    const wanted = new Map<string, PreparedResource>();
    for (const r of [...selected, ...Array.from(visible).flat()]) {
      const key = identity(r);
      const row = wanted.get(key) ?? { kind: r.kind, resource_id: r.resource_id, revision: r.revision, fields: {} };
      Object.assign(row.fields, r.fields);
      wanted.set(key, row);
    }
    for (const key of jobs.keys()) if (!wanted.has(key)) jobs.delete(key);
    for (const [key, resource] of wanted) {
      const job = jobs.get(key);
      if (!job) {
        const terminal = hasTerminal(resource);
        const known = terminal ? Object.entries(resource.fields).filter(([p,s]) => (['en','ko'] as const).some(l =>
          cache.unavailable({...resource,language:l},p,s) || cache.get({...resource,language:l},p,s))) : [];
        jobs.set(key, { resource, enrolled: terminal, submitted: Object.fromEntries(known), retry: false, terminal,
          running: false, failures: 0, polls: 0,
          next: ready(resource) ? Infinity : now() });
      } else if (JSON.stringify(job.resource.fields) !== JSON.stringify(resource.fields)) {
        job.resource = resource;
        job.polls = 0;
        job.next = ready(resource) ? Infinity : now();
      }
    }
    delay();
  }

  async function work(job: Job) {
    const r = job.resource, key = identity(r), alive = () => active && jobs.get(key) === job;
    const url = api + '/localization/prepared/';
    const base = { kind: r.kind, resource_id: r.resource_id, revision: r.revision ?? '' };
    let state: unknown, cursor: string | null = null, terminal = false;
    async function read(method: 'GET' | 'POST', fields?: Fields) {
      const query = 'revision=' + encodeURIComponent(base.revision) + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      const address = method === 'POST' ? url : url + r.kind + '/' + encodeURIComponent(r.resource_id) + '/?' + query;
      const response = await fetch(address, { method, signal: AbortSignal.timeout(15000), ...(method === 'POST' ? {
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, preferred_language: language(),
          ...(fields ? { fields } : {}), ...(job.retry ? { retry: true } : {}) }),
      } : {}) });
      if (!alive()) return;
      if (!response.ok) {
        // A completed phone record can outlive its exact server revision. An upcoming result with no prose can still arrive.
        if (response.status === 400 || response.status === 409 && Object.keys(r.fields).length > 0) {
          terminal = true; state = 'failed'; cursor = null; return;
        }
        throw Error('Preparation unavailable');
      }
      const data: unknown = await readCoachingJson(response);
      if (!alive()) return;
      if (!map(data) || data.kind !== r.kind || data.resource_id !== r.resource_id || data.revision !== base.revision ||
          !['absent','pending','failed','completed'].includes(String(data.state)) || !map(data.fields) ||
          !(data.next_cursor === null || typeof data.next_cursor === 'string')) throw Error('Invalid prepared result');
      // The phone is authoritative for the original bytes of each path; a stale/cross-revision reply cannot replace them.
      const variants: Record<string, PreparedField> = {};
      for (const [path, entry] of Object.entries(data.fields)) {
        if (map(entry) && typeof entry.source === 'string') variants[path] = { source: entry.source,
          en: typeof entry.en === 'string' ? entry.en : undefined, ko: typeof entry.ko === 'string' ? entry.ko : undefined };
      }
      cache.install(job.resource, variants, language());
      if (map(data.terminal_fields)) for (const l of ['en','ko'] as const) {
        const paths = data.terminal_fields[l];
        if (!Array.isArray(paths)) continue;
        const unresolved = missing(job.resource,l);
        const blocked = Object.fromEntries(paths.filter((p): p is string =>
          typeof p === 'string' && !!unresolved[p] && variants[p]?.source === unresolved[p]).map(p => [p,unresolved[p]]));
        if (Object.keys(blocked).length) cache.block({...r,language:l},blocked);
      }
      state = data.state;
      terminal = data.terminal === true;
      cursor = data.next_cursor;
    }
    const added = Object.fromEntries(Object.entries(r.fields).filter(([p, s]) => job.submitted[p] !== s || job.retry));
    if (r.kind === 'legacy_qa' && Object.keys(added).length) {
      for (const batch of splitRequest({ ...r, language: language() }, added)) {
        if (!alive()) return;
        await read('POST', batch.fields);
        Object.assign(job.submitted, batch.fields);
      }
      job.enrolled = true;
    } else if (!job.enrolled || job.retry) {
      await read('POST'); job.enrolled = true;
    } else await read('GET');
    const seen = new Set<string>();
    while (alive() && cursor && !ready(job.resource)) {
      if (seen.has(cursor)) throw Error('Repeated translation page');
      seen.add(cursor); await read('GET');
    }
    if (!alive()) return;
    if (ready(job.resource)) { job.terminal = false; job.next = Infinity; return; }
    if (job.resource !== r) { job.next = now(); return; }
    const locales = ['en','ko'] as const;
    if (terminal) {
      for (const l of locales) cache.block({...r,language:l},missing(r,l));
    }
    if (terminal || (Object.keys(r.fields).length > 0 && locales.every(l =>
      Object.entries(missing(r,l)).every(([p,s])=>cache.unavailable({...r,language:l},p,s))))) {
      job.terminal = true; job.retry = false; job.next = Infinity; return;
    }
    if (state === 'completed') {
      // A completed server snapshot can omit a field from an older phone schema. Request just that exact prose.
      const first = language(), other: Language = first === 'ko' ? 'en' : 'ko';
      for (const target of [first, other]) for (const batch of splitRequest({ ...r, language: target }, missing(r, target))) {
        if (!alive()) return;
        await cache.load(batch, true);
      }
      if (!alive()) return;
      if (!Object.keys(job.resource.fields).length || ready(job.resource)) { job.next = Infinity; return; }
    }
    job.retry = state === 'failed';
    if (state === 'absent') job.enrolled = false;
    if (state !== 'pending') throw Error('Incomplete translation');
    job.failures = 0;
    job.next = now() + Math.min(15000, 2000 * (1 + job.polls++));
  }

  function pump() {
    timer = undefined;
    if (!active) return;
    for (const job of jobs.values()) {
      if (inFlight >= 3) break;
      if (job.running || job.next > now()) continue;
      job.running = true; inFlight++;
      void work(job).catch(() => {
        job.next = now() + Math.min(60000, 2000 * 2 ** Math.min(5, job.failures++));
      }).finally(() => { job.running = false; inFlight--; delay(); });
    }
    delay();
  }
  function wake() {
    active = true;
    for (const j of jobs.values()) if (j.next !== Infinity || j.terminal) j.next = now();
    delay();
  }
  return {
    select: (resources: PreparedResource[]) => { selected = resources; reconcile(); },
    retain: (requests: Request[]) => { visible.add(requests); reconcile(); return () => { visible.delete(requests); reconcile(); }; },
    pause: () => { active = false; delay(); },
    wake,
    stop: () => { active = false; selected = []; visible.clear(); jobs.clear(); delay(); },
  };
}
