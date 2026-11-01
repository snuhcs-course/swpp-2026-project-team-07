// AI-assisted demo access migration, OpenAI Codex, November 1, 2026.
import { API_URL, DEMO_CODE_REQUIRED } from './apiConfig';
import { createDemoAccess } from './demoAccess';

export const demoAccess = createDemoAccess(API_URL, DEMO_CODE_REQUIRED, {
  read: async key => (await import('expo-secure-store')).getItemAsync(key),
  write: async (key, value) => (await import('expo-secure-store')).setItemAsync(key, value),
  remove: async key => (await import('expo-secure-store')).deleteItemAsync(key),
});

// Expo's native fetch enforces redirect:error; React Native's global XHR fetch does not.
const nativeFetch: typeof globalThis.fetch = async (input, init) => {
  const { fetch } = await import('expo/fetch');
  return fetch(input, init);
};
export const backendFetch: typeof globalThis.fetch = (input, init) =>
  demoAccess.request(input, init, DEMO_CODE_REQUIRED ? nativeFetch : globalThis.fetch);
export const backendExpoFetch: typeof globalThis.fetch = (input, init) =>
  demoAccess.request(input, init, nativeFetch);
export const enterDemoCode = (code: string) => demoAccess.verifyCode(code, nativeFetch);
