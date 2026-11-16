// AI-assisted demo access migration, OpenAI Codex, November 1, 2026.
import { fromByteArray } from 'base64-js';

export type DemoAccessSnapshot = {
  state: 'loading' | 'locked' | 'ready'; unlockedOnce: boolean; notice: string;
};
export type CredentialStore = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};
type Transport = typeof globalThis.fetch;
type FetchInput = Parameters<Transport>[0] | URL;
const validCode = (value: unknown): value is string => typeof value === 'string' && /^[!-~]{1,256}$/.test(value);

export class DemoAccessError extends Error {}

/** Origin binding also separates secure storage when a build changes servers. */
export function credentialKey(origin: string) {
  return `outloud.demo.${Array.from(origin, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`;
}

export function createDemoAccess(apiUrl: string, required: boolean, store: CredentialStore) {
  let origin: string | null = null;
  try {
    const configured = new URL(apiUrl);
    if (configured.protocol === 'https:' && !configured.username && !configured.password && !configured.search && !configured.hash) origin = configured.origin;
  } catch { /* A protected build fails closed on an invalid endpoint. */ }
  let snapshot: DemoAccessSnapshot = { state: required ? 'loading' : 'ready', unlockedOnce: !required, notice: '' };
  let code: string | null = null, epoch = 0, verification = 0;
  let initialization: Promise<void> | null = null;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (state: DemoAccessSnapshot['state'], notice = '') => {
    const unlockedOnce = snapshot.unlockedOnce || state === 'ready';
    if (snapshot.state === state && snapshot.unlockedOnce === unlockedOnce && snapshot.notice === notice) return;
    snapshot = { state, unlockedOnce, notice }; listeners.forEach(listener => listener());
  };
  const storageWrite = (operation: () => Promise<void>) => {
    const next = writes.then(operation, operation);
    writes = next.catch(() => {}); return next;
  };
  function checkedUrl(input: FetchInput) {
    try {
      const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const target = new URL(value);
      if (!origin || target.protocol !== 'https:' || target.origin !== origin || target.username || target.password || target.hash) throw Error();
      return target;
    } catch { throw new DemoAccessError('The secure server address could not be verified.'); }
  }
  function authenticatedInit(input: FetchInput, init: RequestInit | undefined, secret: string): RequestInit {
    const headers = new Headers(typeof input === 'object' && 'headers' in input ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    headers.set('Authorization', `Basic ${fromByteArray(Uint8Array.from(`reviewer:${secret}`, char => char.charCodeAt(0)))}`);
    return { ...init, headers, redirect: 'error', credentials: 'omit' };
  }
  function checkedResponse(response: Response) {
    if (response.redirected) throw new DemoAccessError('Server redirects are not allowed for demo access.');
    if (response.url) checkedUrl(response.url);
  }
  function initialize(): Promise<void> {
    if (!required) return Promise.resolve();
    if (!initialization) initialization = (async () => {
      if (!origin) { publish('locked', 'A secure server address is required.'); return; }
      try {
        const saved = await store.read(credentialKey(origin));
        code = validCode(saved) ? saved : null;
        publish(code ? 'ready' : 'locked');
      } catch { publish('locked', 'Could not open saved access. Enter the demo code again.'); }
    })();
    return initialization;
  }
  async function verifyCode(value: string, transport: Transport) {
    if (!required) return;
    await initialize();
    const next = value.trim();
    if (!validCode(next)) throw new DemoAccessError('Enter the demo code provided with this app.');
    const attempt = ++verification;
    const url = `${apiUrl.replace(/\/+$/, '')}/health/`;
    checkedUrl(url);
    let response: Response;
    try {
      response = await transport(url, authenticatedInit(url, { method: 'GET', signal: AbortSignal.timeout(15000) }, next));
      checkedResponse(response);
    } catch { throw new DemoAccessError('Could not connect. Check your internet connection and try again.'); }
    if (response.status === 401) throw new DemoAccessError('That demo code did not work. Try again.');
    if (!response.ok) throw new DemoAccessError('The server is unavailable. Try again shortly.');
    const body = await response.json().catch(() => null);
    if (body?.service !== 'outloud-api') throw new DemoAccessError('This address did not return the OutLoud server.');
    if (attempt !== verification) throw new DemoAccessError('A newer code entry is already in progress.');
    const acceptedEpoch = ++epoch;
    code = next;
    try { await storageWrite(() => store.write(credentialKey(origin!), next)); }
    catch {
      if (epoch === acceptedEpoch) { code = null; epoch++; publish('locked'); }
      throw new DemoAccessError('Could not save access securely. Please try again.');
    }
    if (epoch !== acceptedEpoch) throw new DemoAccessError('Server access changed. Enter the current demo code.');
    publish('ready');
  }
  async function request(input: FetchInput, init: RequestInit | undefined, transport: Transport) {
    const target = input instanceof URL ? input.href : input;
    if (!required) return transport(target, init);
    checkedUrl(input);
    await initialize();
    if (!code) throw new DemoAccessError('Enter the demo code to connect. Local recordings remain available.');
    const sentEpoch = epoch;
    const response = await transport(target, authenticatedInit(input, init, code));
    checkedResponse(response);
    if (response.status === 401 && sentEpoch === epoch) {
      code = null; epoch++;
      publish('locked', 'Server access expired. Re-enter the demo code when you are ready.');
      void storageWrite(() => store.remove(credentialKey(origin!))).catch(() => {});
    }
    // Never replay an upload or generation POST after re-entry.
    return response;
  }
  return {
    initialize, verifyCode, request,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
