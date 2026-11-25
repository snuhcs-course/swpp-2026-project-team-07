import type { CredentialStore } from './demoAccess';
import { STORE_API, storeRoute } from './storeEndpoint';

export type StoreChoice = 'offline' | 'enabled' | 'registered' | 'expired' | null;
export const allowsUploads = (choice: StoreChoice) => choice === 'enabled' || choice === 'registered';
export type StorePrivacy = { read(): StoreChoice; write(choice: Exclude<StoreChoice, null>): void };
type Transport = typeof globalThis.fetch;
type Input = Parameters<Transport>[0] | URL;
const key = 'outloud.installation.' + Array.from(STORE_API, c => c.charCodeAt(0).toString(16)).join('');
const enrollment = STORE_API + '/installations/';
const expired = 'Online access expired. Choose online coaching on Home to start a new private workspace. Your local recordings are saved.';
const offline = 'Online coaching is off. Your slides and recordings stay on this phone.';
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._~+/-]{1,512}={0,2}$/.test(value);

/** These failures happen before any user data is sent. A caller may safely clear its uncertainty marker. */
export class StorePreflightError extends Error {}

function checkedResponse(response: Response, expected: string) {
  if (response.redirected || (response.status >= 300 && response.status < 400) || (response.url && response.url !== expected))
    throw new Error('The secure server redirected the request.');
}

export function createStoreAccess(secure: CredentialStore, privacy: StorePrivacy) {
  let current: Promise<string> | null = null;
  let removing = Promise.resolve();
  let rejectedToken: string | null = null;

  function requireConsent() {
    const choice = privacy.read();
    if (!allowsUploads(choice)) throw new StorePreflightError(choice === 'expired' ? expired : offline);
  }

  async function loadToken(transport: Transport) {
    await removing;
    requireConsent();
    const saved = await secure.read(key);
    if (validToken(saved) && saved !== rejectedToken) return saved;
    if (privacy.read() === 'registered') {
      privacy.write('expired');
      throw new StorePreflightError(expired);
    }
    requireConsent();
    const response = await transport(enrollment, { method: 'POST', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000) });
    checkedResponse(response, enrollment);
    if (response.status !== 201) throw new StorePreflightError('Online coaching is unavailable. You can still record on this phone.');
    const token: unknown = (await response.json())?.token;
    if (!validToken(token)) throw new StorePreflightError('The secure server did not return valid installation access.');
    await secure.write(key, token);
    return token;
  }

  return async function request(input: Input, init: RequestInit | undefined, transport: Transport) {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const source = typeof input === 'object' && 'headers' in input ? input : undefined;
    const method = (init?.method ?? source?.method ?? 'GET').toUpperCase();
    const route = storeRoute(target);
    if (!route || new URL(target).pathname === new URL(enrollment).pathname || (route === 'media' && !['GET', 'HEAD'].includes(method)))
      throw new StorePreflightError('The secure server address could not be verified.');
    requireConsent();
    const signal = init?.signal ?? source?.signal;
    if (signal?.aborted) throw new StorePreflightError('Request cancelled.');
    const ticket = current ??= loadToken(transport);
    let secret: string;
    try { secret = await ticket; }
    catch (error) {
      if (current === ticket) current = null;
      if (error instanceof StorePreflightError) throw error;
      throw new StorePreflightError('Online coaching is unavailable. You can still record on this phone.');
    }
    requireConsent();
    if (privacy.read() === 'enabled') {
      try { privacy.write('registered'); }
      catch { throw new StorePreflightError('Could not save your online coaching choice.'); }
    }
    if (signal?.aborted) throw new StorePreflightError('Request cancelled.');
    const headers = new Headers(source?.headers);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    headers.set('Authorization', 'Bearer ' + secret);
    const response = await transport(source ?? target, { ...init, headers, credentials: 'omit', redirect: 'error' });
    checkedResponse(response, target);
    if (response.status === 401 && current === ticket) {
      current = null;
      rejectedToken = secret;
      removing = secure.remove(key).catch(() => {});
      if (allowsUploads(privacy.read())) privacy.write('expired');
    }
    // A rejected write is returned to its owner. New access needs a separate user decision.
    return response;
  };
}
