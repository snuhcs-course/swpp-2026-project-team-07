import { createHash } from 'node:crypto';
// Synthetic files and network responses only; no native files or real requests.
export const files = new Map();
export const network = { requests: [], respond: null };
export class File extends Blob {
  constructor(...parts) {
    const uri = parts.map(p => typeof p === 'string' ? p : p.uri).join('/');
    const fixture = files.get(uri);
    super([fixture?.data ?? 'synthetic audio'], { type: uri.endsWith('.pdf') ? 'application/pdf' : 'audio/wav' });
    this.uri = uri;
    this.name = uri.split('/').at(-1);

    this.fixtureSize = fixture?.size;
  }
  get exists() { return files.has(this.uri); }
  get size() { return files.get(this.uri)?.size ?? (files.get(this.uri)?.data ? new Blob([files.get(this.uri).data]).size : this.fixtureSize ?? super.size); }
  get md5() { return this.exists ? createHash('md5').update(files.get(this.uri)?.data ?? 'synthetic audio').digest('hex') : null; }
  create() { if (this.exists) throw new Error('exists'); files.set(this.uri, { data: new Uint8Array(0) }); }
  delete() { files.delete(this.uri); }
  open() { const uri = this.uri; return { close() {}, writeBytes(chunk) {
    const previous = files.get(uri).data;
    const bytes = new Uint8Array(previous.length + chunk.length); bytes.set(previous); bytes.set(chunk, previous.length); files.set(uri, { data: bytes });
  } }; }
  async move(target) { files.set(target.uri, files.get(this.uri)); files.delete(this.uri); this.uri = target.uri; }
}
export async function fetch(url, init = {}) {
  network.requests.push({ url, ...init });
  if (!network.respond) throw new Error('Unexpected network request');
  return network.respond(url, init);
}
export function response(status, value) { return { ok: status >= 200 && status < 300, status, json: async () => value }; }

export const Paths = { document: 'file:///synthetic-documents' };
export class Directory { constructor(...parts) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).join('/'); } create() {} }
