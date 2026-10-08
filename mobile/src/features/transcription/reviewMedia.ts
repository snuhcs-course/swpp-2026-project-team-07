import { Directory, File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from './analysisStorage';
import { reviewKey } from './reviewStorage';
import { isUuid, mediaUrl, validDuration } from './reviewValidation';

export const MEDIA_LIMITS = { audio: 25_000_000, pdf: 20 * 1024 * 1024 };
export type MediaSpec = { api: string; id: string; kind: 'audio' | 'pdf'; url: string; durationMs?: number; pageCount?: number };
export type MediaRecord = MediaSpec & { uri: string; bytes: number; md5: string; validated: true };
export type Validator = (uri: string, spec: MediaSpec, signal: AbortSignal) => Promise<void>;
type Consumer = { validate: Validator; signal: AbortSignal };
export type MediaFile = { uri: string; exists: boolean; size: number; md5: string | null; create(): void; delete(): void;
  open(): { writeBytes(value: Uint8Array): void; close(): void } };
type Dependencies = {
  move: (source: MediaFile, target: MediaFile) => Promise<void>;
  fetch: typeof fetch; file: (uri: string) => MediaFile; allocate: (kind: 'audio' | 'pdf', url: string) => { temporary: MediaFile; destination: MediaFile };
  read: (key: string) => MediaRecord | null; write: (key: string, value: MediaRecord) => void;
};
export function localUri(value: unknown): string | null {
  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value)) return null;
  if (value.startsWith('/')) return `file://${value}`;
  return /^(file|content):\/\//.test(value) ? value : null;
}
export function mediaIdentity(spec: MediaSpec) { return reviewKey(spec.api, `media-${spec.kind}`, spec.id); }
function validSpec(spec: MediaSpec) {
  if (!isUuid(spec.id) || !mediaUrl(spec.url, spec.api) ||
      (spec.kind === 'audio' ? !validDuration(spec.durationMs) : !Number.isInteger(spec.pageCount) || spec.pageCount! < 1 || spec.pageCount! > 10)) {
    throw new Error('Validated media metadata is unavailable. Refresh this rehearsal first.');
  }
}
const cancelled = () => new Error('Media operation cancelled.');
export function checkCancelled(signal: AbortSignal) { if (signal.aborted) throw cancelled(); }
/** Also settles when a native/network promise ignores cancellation. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { promise.catch(() => {}); reject(cancelled()); return; }
    const abort = () => reject(cancelled());
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
export function createMediaManager(deps: Dependencies) {
  const jobs = new Map<string, { controller: AbortController; task: Promise<MediaRecord>; consumers: Set<Consumer> }>();
  async function validateForConsumers(uri: string, spec: MediaSpec, signal: AbortSignal, consumers: Set<Consumer>) {
    while (true) {
      checkCancelled(signal);
      const owner = [...consumers].find(consumer => !consumer.signal.aborted);
      if (!owner) throw cancelled();
      const validation = new AbortController();
      const abort = () => validation.abort();
      signal.addEventListener('abort', abort, { once: true });
      owner.signal.addEventListener('abort', abort, { once: true });
      try {
        await abortable(owner.validate(uri, spec, validation.signal), validation.signal);
        checkCancelled(signal); checkCancelled(owner.signal);
        return;
      } catch (cause) {
        // A native PDF renderer belongs to its screen. Transfer validation of the
        // same temporary file when that screen leaves, without repeating the GET.
        // Genuine decode/page-count errors still fail the shared operation.
        if (!owner.signal.aborted) throw cause;
      } finally {
        signal.removeEventListener('abort', abort);
        owner.signal.removeEventListener('abort', abort);
      }
    }
  }
  function cached(spec: MediaSpec): MediaRecord | null {
    try { validSpec(spec); } catch { return null; }
    const value = deps.read(mediaIdentity(spec));
    if (!value || value.validated !== true || !value.md5 || value.bytes > MEDIA_LIMITS[spec.kind] || value.api !== normalizeApi(spec.api) || value.id !== spec.id || value.kind !== spec.kind ||
        value.url !== spec.url || value.durationMs !== spec.durationMs || value.pageCount !== spec.pageCount || !localUri(value.uri)) return null;
    try {
      const file = deps.file(value.uri);
      return file.exists && file.size > 0 && file.size === value.bytes && file.md5 === value.md5 ? value : null;
    } catch { return null; }
  }
  async function run(spec: MediaSpec, validate: Validator, signal: AbortSignal) {
    validSpec(spec); checkCancelled(signal);
    const { temporary, destination } = deps.allocate(spec.kind, spec.url);
    let promoted = false, published = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let handle: ReturnType<MediaFile['open']> | undefined;
    try {
      const response = await abortable(deps.fetch(spec.url, { method: 'GET', signal, redirect: 'error', credentials: 'omit' }), signal);
      checkCancelled(signal);
      if (!response.ok || response.redirected || (response.url && mediaUrl(response.url, spec.api) !== spec.url)) throw new Error('Media download failed or redirected.');
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MEDIA_LIMITS[spec.kind])) throw new Error('Media exceeds the download byte limit.');
      if (!response.body) throw new Error('The server did not provide a media stream.');
      temporary.create(); handle = temporary.open(); reader = response.body.getReader();
      let bytes = 0;
      while (true) {
        const chunk = await abortable(reader.read(), signal); checkCancelled(signal);
        if (chunk.done) break;
        if (bytes + chunk.value.byteLength > MEDIA_LIMITS[spec.kind]) throw new Error('Media exceeds the download byte limit.');
        handle.writeBytes(chunk.value); bytes += chunk.value.byteLength;
      }
      handle.close(); handle = undefined;
      if (!bytes || temporary.size !== bytes) throw new Error('Downloaded media is empty or incomplete.');
      await abortable(validate(temporary.uri, spec, signal), signal); checkCancelled(signal);
      const md5 = temporary.md5;
      if (!md5) throw new Error('Could not verify downloaded media.');
      // Unique destinations preserve every prior good file even on cancellation/SQLite failure.
      await deps.move(temporary, destination); promoted = true; checkCancelled(signal);
      const record: MediaRecord = { ...spec, api: normalizeApi(spec.api), uri: destination.uri, bytes, md5, validated: true };
      try { deps.write(mediaIdentity(spec), record); published = true; }
      catch (cause) {
        // If SQLite acknowledged a write before surfacing an error, retain its valid file.
        try { published = deps.read(mediaIdentity(spec))?.uri === record.uri; } catch { published = true; }
        throw cause;
      }
      return record;
    } finally {
      try { handle?.close(); } catch { /* Only this operation's handle. */ }
      if (reader) { void reader.cancel().catch(() => {}); }
      if (!published) {
        try { if (temporary.exists) temporary.delete(); } catch { /* Retain an unreferenced owned temporary on cleanup failure. */ }
        try { if (promoted && destination.exists) destination.delete(); } catch { /* Never delete previous good files. */ }
      }
    }
  }
  async function download(spec: MediaSpec, validate: Validator, signal: AbortSignal, force = false): Promise<MediaRecord> {
    validSpec(spec); checkCancelled(signal);
    const existing = cached(spec);
    if (existing && !force) return existing;
    const key = `${mediaIdentity(spec)}:${spec.url}:${spec.durationMs}:${spec.pageCount}`;
    const consumer = { validate, signal };
    let job = jobs.get(key);
    if (!job || job.controller.signal.aborted) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000);
      const entry = { controller, consumers: new Set([consumer]), task: Promise.resolve(null as unknown as MediaRecord) };
      entry.task = run(spec, (uri, currentSpec, currentSignal) => validateForConsumers(uri, currentSpec, currentSignal, entry.consumers), controller.signal)
        .finally(() => { clearTimeout(timer); if (jobs.get(key) === entry) jobs.delete(key); });
      job = entry; jobs.set(key, job);
    } else job.consumers.add(consumer);
    try { return await abortable(job.task, signal); }
    finally { job.consumers.delete(consumer); if (job.consumers.size === 0) job.controller.abort(); }
  }
  return { cached, download };
}

export const reviewMedia = createMediaManager({
  move: (source, target) => new File(source.uri).move(new File(target.uri)),
  fetch: expoFetch as typeof fetch, file: uri => new File(uri), read: readStored, write: writeStored,
  allocate(kind, url) {
    const directory = new Directory(Paths.document, 'outloud-review');
    directory.create({ intermediates: true, idempotent: true });
    const extension = kind === 'pdf' ? '.pdf' : new URL(url).pathname.match(/\.(m4a|wav|mp3|mp4|mpeg|mpga|webm)$/i)?.[0] || '.audio';
    const name = randomUUID();
    return { temporary: new File(directory, `${name}.partial${extension}`), destination: new File(directory, `${name}${extension}`) };
  },
});
export function existingLocalFile(uri: unknown): string | null {
  const normalized = localUri(uri);
  try { return normalized && new File(normalized).exists && new File(normalized).size > 0 ? normalized : null; } catch { return null; }
}
