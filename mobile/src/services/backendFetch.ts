// AI-assisted demo access migration, OpenAI Codex, November 1, 2026.
import { ACCESS_CONFIG_VALID, API_URL, DEMO_CODE_REQUIRED, STORE_MODE } from './apiConfig';
import { createDemoAccess } from './demoAccess';
import { createStoreAccess, StorePreflightError } from './storeAccess';
import { readCoachingJson } from './storeBudget';

const secure = {
  read: async (key: string) => (await import('expo-secure-store')).getItemAsync(key),
  write: async (key: string, value: string) => (await import('expo-secure-store')).setItemAsync(key, value),
  remove: async (key: string) => (await import('expo-secure-store')).deleteItemAsync(key),
};
export const demoAccess = createDemoAccess(API_URL, DEMO_CODE_REQUIRED, secure);

// Expo's native fetch enforces redirect:error; React Native's global XHR fetch does not.
const nativeFetch: typeof globalThis.fetch = async (input, init) => {
  const { fetch } = await import('expo/fetch');
  return fetch(input, init);
};
let storeRequest: ReturnType<typeof createStoreAccess> | undefined;
async function request(input: Parameters<typeof globalThis.fetch>[0] | URL, init: RequestInit | undefined, native: boolean) {
  if (!ACCESS_CONFIG_VALID) throw new StorePreflightError('The secure server address could not be verified.');
  if (STORE_MODE) {
    const { storePrivacy } = await import('./storePrivacy');
    storeRequest ??= createStoreAccess(secure, storePrivacy);
    const response = await storeRequest(input, init, nativeFetch);
    if (!response.ok && response.headers.get('content-type')?.includes('application/json'))
      await readCoachingJson(response.clone()).catch(() => {});
    return response;
  }
  return demoAccess.request(input, init, native || DEMO_CODE_REQUIRED ? nativeFetch : globalThis.fetch);
}
export const backendFetch: typeof globalThis.fetch = (input, init) => request(input, init, false);
export const backendExpoFetch: typeof globalThis.fetch = (input, init) => request(input, init, true);
export const enterDemoCode = (code: string) => demoAccess.verifyCode(code, nativeFetch);
