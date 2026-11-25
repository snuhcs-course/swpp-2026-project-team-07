import { useCallback, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useUiText } from '../design/language';
import { useTheme } from '../design/theme';
import { F } from '../design/tokens';
import { storePrivacy } from '../services/storePrivacy';
import { STORE_PRIVACY_URL } from '../services/storeEndpoint';

export const uploadDisclosure = 'For free online coaching, OutLoud automatically uploads the slides you open for coaching, recordings, transcripts, audience settings and Q&A. With live feedback, audio uploads while you record. ElevenLabs transcribes audio with slide vocabulary. OpenRouter and its model providers process slide images, text and transcripts for feedback. After 30 days without activity from this installation, OutLoud deletes its uploads and derived results. Each provider retains data under its published terms. Your local recordings stay on this phone. To change your choice, touch and hold OutLoud on Home, then choose Online coaching settings.';
const recoveryDisclosure = 'The previous private workspace is unavailable. Allow uploads to create a new workspace for this phone. Pending uploads may resume. Your local recordings are saved.';

type PrivacyPrompt = { expired: boolean; next?: () => void };

export function useStorePrivacyPrompt() {
  const [prompt, setPrompt] = useState<PrivacyPrompt | null>(null);
  const pending = useRef<PrivacyPrompt | null>(null);
  const show = useCallback((next?: () => void) => {
    if (pending.current) return;
    const request = { expired: storePrivacy.read() === 'expired', next };
    pending.current = request;
    setPrompt(request);
  }, []);
  const choose = (request: PrivacyPrompt, online: boolean) => {
    if (pending.current !== request) return true;
    try { storePrivacy.write(online ? 'enabled' : 'offline'); }
    catch { return false; }
    pending.current = null;
    setPrompt(null);
    request.next?.();
    return true;
  };
  return { show, dialog: prompt && <StorePrivacyDialog expired={prompt.expired} onChoose={online => choose(prompt, online)} /> };
}

function StorePrivacyDialog({ expired, onChoose }: { expired: boolean; onChoose: (online: boolean) => boolean }) {
  const ui = useUiText();
  const { c } = useTheme();
  const [error, setError] = useState('');
  const openPolicy = () => {
    setError('');
    // Keep the choice and any pending navigation when the user returns from the browser.
    void Linking.openURL(STORE_PRIVACY_URL).catch(() => setError('Could not open the privacy policy.'));
  };
  const choose = (online: boolean) => {
    if (!onChoose(online)) setError('Could not save your online coaching choice.');
  };
  const body = (expired ? ui(recoveryDisclosure) + '\n\n' : '') + ui(uploadDisclosure);
  return (
    <Modal transparent onRequestClose={() => {}}>
      <View style={[styles.overlay, { backgroundColor: c.scrim }]}>
        <View accessibilityViewIsModal testID="store-privacy-dialog" style={[styles.card, { backgroundColor: c.dialog, borderColor: c.border12 }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: c.strong }]}>{ui('Allow uploads for online coaching?')}</Text>
          <ScrollView style={styles.disclosure} persistentScrollbar>
            <Text style={[styles.body, { color: c.text }]}>{body}</Text>
          </ScrollView>
          {error !== '' && <Text accessibilityRole="alert" style={[styles.body, { color: c.bad }]}>{ui(error)}</Text>}
          <View style={[styles.actions, { borderColor: c.border12 }]}>
            <Pressable accessibilityRole="link" onPress={openPolicy} style={styles.action}>
              <Text style={[styles.actionText, styles.linkText, { color: c.text }]}>{ui('Privacy policy')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => choose(false)} style={[styles.action, { backgroundColor: c.surface08 }]}>
              <Text style={[styles.actionText, { color: c.strong }]}>{ui('Keep on device')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => choose(true)} style={[styles.action, { backgroundColor: c.strong }]}>
              <Text style={[styles.actionText, { color: c.bg }]}>{ui('Allow uploads')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, maxHeight: '100%', borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontFamily: F.display, fontSize: 20, lineHeight: 25 },
  disclosure: { flexGrow: 0, flexShrink: 1 },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 21 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, gap: 6 },
  action: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 8, borderRadius: 14 },
  actionText: { fontFamily: F.semibold, fontSize: 15, textAlign: 'center' },
  linkText: { textDecorationLine: 'underline' },
});
