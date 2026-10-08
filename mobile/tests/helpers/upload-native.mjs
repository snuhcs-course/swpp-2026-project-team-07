// Synthetic files and network responses only; no native files or real requests.
export const files = new Map();
export const network = { requests: [], respond: null };
export class File extends Blob {
  constructor(uri) {
    const fixture = files.get(uri);
    super([fixture?.data ?? 'synthetic audio'], { type: uri.endsWith('.pdf') ? 'application/pdf' : 'audio/wav' });
    this.uri = uri;
    this.name = uri.split('/').at(-1);
    this.exists = !!fixture;
    this.fixtureSize = fixture?.size;
  }
  get size() { return this.fixtureSize ?? super.size; }
}
export async function fetch(url, init = {}) {
  network.requests.push({ url, ...init });
  if (!network.respond) throw new Error('Unexpected network request');
  return network.respond(url, init);
}
export function response(status, value) { return { ok: status >= 200 && status < 300, status, json: async () => value }; }
