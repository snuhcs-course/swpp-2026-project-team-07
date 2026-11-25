const storeBase = 'https://outloud-team07.koreacentral.cloudapp.azure.com/store/';
export const STORE_API = storeBase + 'api';
export const STORE_PRIVACY_URL = storeBase + 'privacy/';
const mediaBase = storeBase + 'media/';

/** Keep the reviewer service on the same HTTPS host outside the installation's scope. */
export function storeRoute(value: string): 'api' | 'media' | null {
  if (/[\s\\#]/.test(value)) return null;
  try {
    const url = new URL(value);
    // Server-generated paths use ordinary segments. Query values may contain encoded JSON.
    if (url.href !== value || !/^\/[A-Za-z0-9_./~-]+$/.test(url.pathname) || url.pathname.includes('//')) return null;
    if (value.startsWith(STORE_API + '/')) return 'api';
    if (value.startsWith(mediaBase)) return 'media';
  } catch { /* Invalid URL. */ }
  return null;
}
