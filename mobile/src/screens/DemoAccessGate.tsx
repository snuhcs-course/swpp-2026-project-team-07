// AI-assisted demo access migration, OpenAI Codex, November 1, 2026.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt } from '../design/frame';
import { useTheme } from '../design/theme';
import { F } from '../design/tokens';
import { DEMO_CODE_REQUIRED } from '../services/apiConfig';
import { demoAccess, enterDemoCode } from '../services/backendFetch';

/** Once opened, the app stays mounted when server access expires mid-recording. */
export function DemoAccessGate({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const access = useSyncExternalStore(demoAccess.subscribe, demoAccess.getSnapshot, demoAccess.getSnapshot);
  const [opened, setOpened] = useState(false), [offline, setOffline] = useState(false);
  const [code, setCode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { void demoAccess.initialize(); }, []);
  if (!DEMO_CODE_REQUIRED) return children;
  const mounted = access.unlockedOnce || offline;
  const visible = access.state !== 'ready' && (opened || !mounted);
  const close = () => { setOpened(false); setOffline(true); setCode(''); setError(''); };
  async function connect() {
    if (busy || !code.trim()) return;
    setBusy(true); setError('');
    try { await enterDemoCode(code); setCode(''); setOpened(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    {mounted && children}
    {mounted && access.state === 'locked' && !visible && <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.track }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter demo code to reconnect" onPress={() => setOpened(true)} style={styles.bannerButton}>
        <Txt style={{ fontFamily: F.semibold, color: c.strong }}>Server access locked · Enter demo code</Txt>
      </Pressable>
    </View>}
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { backgroundColor: c.bg }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.card} accessibilityViewIsModal>
            <Txt style={[styles.title, { color: c.strong }]}>Open OutLoud</Txt>
            <Txt style={[styles.body, { color: c.body }]}>Enter the demo code provided with this app. Reviewers share this workspace, including uploaded slides and recordings.</Txt>
            {access.state === 'loading' ? <ActivityIndicator accessibilityLabel="Opening saved access" color={c.strong} /> : <>
              <TextInput accessibilityLabel="Demo code" placeholder="Demo code" placeholderTextColor={c.secondary}
                value={code} onChangeText={setCode} secureTextEntry autoCapitalize="none" autoCorrect={false}
                autoComplete="off" maxLength={256} returnKeyType="go" onSubmitEditing={() => { void connect(); }}
                editable={!busy} style={[styles.input, { color: c.strong, borderColor: c.track }]} />
              {!!(error || access.notice) && <Txt accessibilityLiveRegion="polite" style={[styles.body, { color: c.body }]}>{error || access.notice}</Txt>}
              <Pressable accessibilityRole="button" accessibilityLabel="Connect to OutLoud" disabled={busy || !code.trim()} onPress={() => { void connect(); }}
                style={[styles.connect, { backgroundColor: c.strong, opacity: busy || !code.trim() ? 0.5 : 1 }]}>
                {busy ? <ActivityIndicator color={c.bg} /> : <Txt style={{ fontFamily: F.bold, color: c.bg }}>Connect</Txt>}
              </Pressable>
            </>}
            <Pressable accessibilityRole="button" onPress={close} style={styles.offline}>
              <Txt style={{ fontFamily: F.semibold, color: c.body }}>Continue offline</Txt>
            </Pressable>
            <Txt style={[styles.note, { color: c.secondary }]}>Local slides and recordings stay on this phone. Internet access is needed for server features.</Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, gap: 18 },
  title: { fontFamily: F.display, fontSize: 32, lineHeight: 40 },
  body: { fontFamily: F.medium, fontSize: 16, lineHeight: 24 },
  input: { borderWidth: 1, borderRadius: 16, padding: 16, fontFamily: F.medium, fontSize: 18, minHeight: 56 },
  connect: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 14 },
  offline: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: F.medium, fontSize: 13, lineHeight: 20 },
  banner: { position: 'absolute', top: 40, left: 12, right: 12, zIndex: 100, borderWidth: 1, borderRadius: 14 },
  bannerButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
