import { STORE_API } from './storeEndpoint';

const mode = process.env.EXPO_PUBLIC_ACCESS_MODE;
export const STORE_MODE = mode === 'store';
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000/api"
).replace(/\/+$/, "");
const demoFlag = process.env.EXPO_PUBLIC_REQUIRE_DEMO_CODE;
export const DEMO_CODE_REQUIRED = !STORE_MODE && demoFlag === '1';
export function validAccessConfig(accessMode: string | undefined, api: string, reviewerFlag: string | undefined) {
  return accessMode === 'store' ? api === STORE_API && (!reviewerFlag || reviewerFlag === '0')
    : !accessMode && !/\/store(?:\/|$)/.test(api);
}
export const ACCESS_CONFIG_VALID = validAccessConfig(mode, API_URL, demoFlag);
