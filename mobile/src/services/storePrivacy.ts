import { STORE_MODE } from './apiConfig';
import { STORE_API } from './storeEndpoint';
import { allowsUploads, type StoreChoice, type StorePrivacy } from './storeAccess';
import { readStored, subscribeStored, writeStored } from './storage';

const key = 'store-upload-consent:v1:' + STORE_API;
export const storePrivacy: StorePrivacy = {
  read() {
    if (!STORE_MODE) return null;
    try {
      const value = readStored<StoreChoice>(key);
      return value === 'offline' || value === 'expired' || allowsUploads(value) ? value : null;
    } catch { return null; }
  },
  write(choice) { writeStored(key, choice); },
};
export const onlineAllowed = () => !STORE_MODE || allowsUploads(storePrivacy.read());
export const subscribePrivacy = (listener: () => void) => subscribeStored(changed => { if (changed === key) listener(); });
