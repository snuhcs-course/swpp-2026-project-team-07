import { Alert, Linking } from 'react-native';
import { storePrivacy } from '../services/storePrivacy';
import { STORE_PRIVACY_URL } from '../services/storeEndpoint';

export const uploadDisclosure = 'For free online coaching, OutLoud automatically uploads the slides you open for coaching, recordings, transcripts, audience settings and Q&A. With live feedback, audio uploads while you record. ElevenLabs transcribes audio with slide vocabulary. OpenRouter and its model providers process slide images, text and transcripts for feedback. After 30 days without activity from this installation, OutLoud deletes its uploads and derived results. Each provider retains data under its published terms. Your local recordings stay on this phone. You can turn uploads off on Home.';
const recoveryDisclosure = 'The previous private workspace is unavailable. Allow uploads to create a new workspace for this phone. Pending uploads may resume. Your local recordings are saved.';
let showing = false;

export function showStorePrivacy(ui: (text: string) => string, next?: () => void) {
  if (showing) return;
  showing = true;
  const expired = storePrivacy.read() === 'expired';
  const choose = (online: boolean) => {
    showing = false;
    try { storePrivacy.write(online ? 'enabled' : 'offline'); }
    catch { Alert.alert(ui('Could not save your online coaching choice.')); return; }
    next?.();
  };
  Alert.alert(ui('Allow uploads for online coaching?'), (expired ? ui(recoveryDisclosure) + '\n\n' : '') + ui(uploadDisclosure), [
    { text: ui('Privacy policy'), onPress: () => {
      showing = false;
      void Linking.openURL(STORE_PRIVACY_URL).catch(() => Alert.alert(ui('Could not open the privacy policy.')));
    } },
    { text: ui('Keep on device'), onPress: () => choose(false) },
    { text: ui('Allow uploads'), onPress: () => choose(true) },
  ], { cancelable: false });
}
