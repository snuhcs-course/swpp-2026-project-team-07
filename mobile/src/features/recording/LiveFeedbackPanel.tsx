import { useDisplayTranslation } from '../localization/useDisplayTranslation';
import { translatedV3 } from '../localization/generatedProse';
import { useUiText } from '../../design/language';
import { stageBudgetNotice } from '../../services/storeBudget';
import { useEffect, useSyncExternalStore } from 'react';
import { Alert, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureFeedback, captureVersion, readCapture, retryCapture, subscribeCaptures } from './incremental';
import { readSavedRun, startFeedbackRun } from '../feedback/feedbackRunClient';
import { useStore } from '../presentations/store';
import { useTheme } from '../../design/theme';
import { Txt, useFrame } from '../../design/frame';

/** An overlay keeps capture mounted and running while available slide feedback is read. */
export function LiveFeedbackPanel({ id, close, landscape = false }: { id: string; close: () => void; landscape?: boolean }) {
  const ui = useUiText();
  useSyncExternalStore(subscribeCaptures, captureVersion);
  useStore(s => s.version);
  const { c } = useTheme();
  const frame = useFrame(), portraitInsets = useSafeAreaInsets();
  const item = readCapture(id);
  const original = captureFeedback(item, item ? readSavedRun(item.api, id, item.contextId ?? null) : null);
  const {value: run} = useDisplayTranslation(true, scope => {
    if (!original) return null;
    const field = scope('feedback', original.runId || id, undefined, original.language);
    return {...original, slides: original.slides.map(s => translatedV3(s, field, 'slides.' + s.slide_index))};
  });
  useEffect(() => {
    if (!landscape) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  }, [landscape, close]);
  const retry = () => {
    const work = async (ack: boolean) => {
      try {
        await retryCapture(id, ack);
        if (item && run?.slides.some(s => s.status === 'failed')) await startFeedbackRun(item.api, id, item.contextId ?? null, true);
      } catch (error) { Alert.alert(ui('Retry unavailable'), ui(error instanceof Error ? error.message : 'Try again when connected.')); }
    };
    if (item?.remote?.segments.some(s => s.requires_confirmation)) Alert.alert(ui('Retry uncertain transcription?'),
      ui('The previous request may have been charged. Retrying it may incur another charge.'),
      [{ text: ui('Cancel'), style: 'cancel' }, { text: ui('Retry'), onPress: () => void work(true) }]);
    else void work(false);
  };
  const notice = stageBudgetNotice(item?.remote) || item?.error || item?.refreshError;
  const content = (
    <View style={styles.shade}><View style={[styles.panel, { backgroundColor: c.bg }, landscape && {
      marginLeft: Math.max(0, portraitInsets.top - frame.top) / frame.s,
      marginRight: Math.max(0, portraitInsets.bottom - frame.top) / frame.s,
    }]}>
      <Txt style={[styles.title, { color: c.text }]}>Feedback so far</Txt>
      <Txt style={{ color: c.text }}>{item?.manifest.stopped ? 'Recording saved.' : 'Recording continues while this panel is open.'}</Txt>
      <Txt style={{ color: c.muted }}>{item?.uploaded.length ?? 0} / {item?.manifest.segments.length ?? 0} segments uploaded · {item?.remote?.segments.filter(s => s.status === 'completed').length ?? 0} transcribed</Txt>
      {!!notice && <Txt accessibilityRole="alert" style={{ color: c.text }}>{notice}</Txt>}
      <ScrollView style={styles.scroll}>
        {!(run?.slides.length) && <Txt style={{ color: c.muted }}>Feedback appears after you finish a slide and its audio is transcribed.</Txt>}
        {run?.slides.map(slide => <View key={slide.slide_index} style={styles.slide}>
          <Txt style={[styles.heading, { color: c.text }]}>Slide {slide.slide_index + 1} · {slide.status === 'scored' ? `${slide.score}/100` : slide.reason === 'recording' ? 'Recording this slide' : slide.status === 'pending' ? 'Waiting for transcript or feedback' : slide.status.replaceAll('_', ' ')}</Txt>
          {slide.provisional && (slide.improvements.length > 0 || slide.criteria.length > 0) && <Txt style={{ color: c.muted }}>Advice from the previous visit; updating after the new speech is ready.</Txt>}
          {slide.improvements.map((improvement, index) => <View key={index} style={styles.advice}>
            <Txt verbatim style={{ color: c.text }}>{improvement.action}</Txt>
            {!!improvement.example && <Txt verbatim style={{ color: c.muted }}>{ui('Try saying:') + ' ' + improvement.example}</Txt>}
          </View>)}
          {!slide.improvements.length && slide.criteria.filter(v => v.next_level).slice(0, 2).map(v => <Txt verbatim key={v.id} style={{ color: c.text }}>{v.next_level}</Txt>)}
        </View>)}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={ui("Retry pending audio and feedback")} onPress={retry} style={styles.button}><Txt style={{ color: c.text }}>Retry</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={ui("Close live feedback")} onPress={close} style={styles.button}><Txt style={{ color: c.text }}>Back to slides</Txt></Pressable>
      </View>
    </View></View>
  );
  // Fullscreen rehearsal rotates its app canvas while Android stays in portrait.
  // A native Modal escapes that canvas, so keep the landscape sheet inside it.
  return landscape
    ? <View style={[StyleSheet.absoluteFill, styles.overlay]} accessibilityViewIsModal onAccessibilityEscape={close}>{content}</View>
    : <Modal visible transparent animationType="slide" onRequestClose={close}>{content}</Modal>;
}
const styles = StyleSheet.create({ overlay: { zIndex: 100, elevation: 100 },
  shade: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  panel: { maxHeight: '80%', padding: 24, paddingBottom: 36, gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  title: { fontSize: 24, fontWeight: '700' }, heading: { fontSize: 17, fontWeight: '600' }, scroll: { flexShrink: 1 },
  slide: { gap: 10, paddingVertical: 14 }, advice: { gap: 6 }, actions: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
});
