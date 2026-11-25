// OpenAI Codex reliability fixes: docs/ai-collaboration/prompt-logs/unattributed/iteration-2.md#record-138
import { useUiText } from '../../design/language';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { PanView } from '../../design/PanView';
import { Txt, useFrame } from '../../design/frame';
import { createThemedStyles, useTheme } from '../../design/theme';
import { C, F } from '../../design/tokens';
import { cueState, type CueCategory, type ProfileState } from './slideProfiles';

type RecoveryAction = 'refresh' | 'generate' | 'retry' | 'confirm';
type Props = {
  state: ProfileState | null; slide: number; error: string | null; busy: boolean;
  onRecover: (action: RecoveryAction) => void;
  requesting?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
  connectionMessage?: string;
};
export function CueGuidancePanel({ state, slide, error, busy, requesting = busy, onRecover,
  onSheetOpenChange, connectionMessage }: Props) {
  const ui = useUiText();
  const { c } = useTheme();
  const frame = useFrame();
  const panelTop = frame.compact ? 320 : 372;
  const panelHeight = 134;
  const [sheet, setSheet] = useState<CueCategory | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const closing = useRef<number | null>(null);
  const nextClose = useRef(0);
  const sheetY = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const sheetMotion = useAnimatedStyle(() => ({opacity:reducedMotion?1:Math.max(0,1-sheetY.value/220),transform:[{translateY:reducedMotion?0:sheetY.value}]}));
  const scrimOpacity = useAnimatedStyle(() => ({ opacity: reducedMotion ? 1 : Math.max(0, 1 - sheetY.value / 220) }));
  useEffect(() => () => {
    closing.current = null;
    cancelAnimation(sheetY);
  }, [sheetY]);
  const views = { must_cover: cueState(state, slide, 'must_cover'), go_deeper: cueState(state, slide, 'go_deeper') };
  const complete = state?.state === 'completed' && !state.stale;
  const sending = requesting && !complete;
  const labels: Record<CueCategory, string> = { must_cover: 'Must cover', go_deeper: 'Further insight' };
  const names: CueCategory[] = ['must_cover', 'go_deeper'];
  const statusFor = (category: CueCategory) => {
    if (complete) return views[category].message;
    if (sending) return 'Requesting AI cues…';
    return error || (!state && connectionMessage) || views[category].message;
  };
  const action: RecoveryAction | null = sheet ? (error && !complete ? 'refresh' : views[sheet].action) : null;
  const actionLabel = action ? { refresh: 'Refresh AI cues', generate: 'Generate AI cues', retry: 'Retry AI cues', confirm: 'Confirm AI cue retry' }[action] : null;
  const sheetItems = sheet ? views[sheet].cues : [];
  const sheetStatus = sheet ? statusFor(sheet) : null;
  // Closing releases input immediately. Keep the outgoing sheet mounted until its own animation finishes.
  const finishClose = (request: number) => {
    if (closing.current === request) setSheet(null);
  };
  const closeSheet = () => {
    if (closing.current !== null) return;
    const request = ++nextClose.current;
    closing.current = request;
    setDismissing(true);
    onSheetOpenChange?.(false);
    if (reducedMotion) {
      finishClose(request);
      return;
    }
    sheetY.set(withTiming(220, { duration: 190, easing: Easing.out(Easing.cubic) }, done => {
      if (done) runOnJS(finishClose)(request);
    }));
  };
  const settleSheet = () => {
    if (closing.current === null) sheetY.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
  };
  const openSheet = (category: CueCategory) => {
    closing.current = null;
    cancelAnimation(sheetY);
    setDismissing(false);
    sheetY.set(reducedMotion ? 0 : 70);
    setSheet(category);
    onSheetOpenChange?.(true);
    if (!reducedMotion) sheetY.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
  };
  return <View style={[styles.panel, { top: panelTop }]}>
    <View pointerEvents="none" style={styles.heading}><Txt style={styles.sectionTitle}>CUES</Txt><View style={styles.rule} /></View>
    <View style={styles.cards}>
      {names.map(category => {
        const data = views[category], cue = data.cues[0], count = data.cues.length;
        const empty = !cue;
        const label = cue ? shortCueLabel(cue.text) : statusFor(category) || (state?.state === 'completed' ? 'Nothing extra here' : 'Cues are on the way');
        return <Pressable key={category} accessibilityRole="button"
          accessibilityLabel={ui(`Open ${labels[category]} cues`)}
          onPress={() => openSheet(category)} style={[styles.card, { borderColor: c.hair, backgroundColor: c.surface06, opacity: empty ? 0.8 : 1 }]}>
          <View style={styles.cardTitle}><Txt style={[styles.kind, { color: category === 'must_cover' ? c.accent : c.muted }]}>{labels[category]}</Txt><Txt style={{ color: c.muted, fontSize: 18 }}>›</Txt></View>
          <Txt verbatim={!!cue} numberOfLines={2} style={cue ? styles.cardLabel : styles.cardStatus}>{label}</Txt>
          {count > 1 && <Txt numberOfLines={1} style={styles.more}>{`+${count - 1} more`}</Txt>}
        </Pressable>;
      })}
    </View>
    {sheet && <View pointerEvents={dismissing ? 'none' : 'auto'} accessibilityElementsHidden={dismissing}
      importantForAccessibility={dismissing ? 'no-hide-descendants' : 'auto'} style={[styles.sheetLayer, { top: -panelTop, bottom: -(frame.height - panelTop - panelHeight) }]}>
      <Animated.View pointerEvents="none" style={[styles.scrim, { backgroundColor: c.scrim }, scrimOpacity]} />
      <Pressable accessibilityLabel={ui("Close cue sheet")} onPress={closeSheet} style={styles.scrim} />
      <PanView style={[styles.sheet, { backgroundColor: c.dialog, borderColor: c.line },sheetMotion]}
        onMoveShould={(_e, g) => closing.current === null && g.dy > 8 && g.dy > Math.abs(g.dx)}
        onMove={(_e, g) => { if (closing.current === null) sheetY.set(Math.max(0, Math.min(220, g.dy / frame.s))); }}
        onRelease={(_e, g) => { if (g.dy > 90) closeSheet(); else settleSheet(); }}
        onTerminate={settleSheet}>
        <View style={[styles.handle, { backgroundColor: c.muted2 }]} />
        <View style={styles.sheetHeader}><Txt style={[styles.sheetTitle, { color: sheet === 'must_cover' ? c.accent : c.text }]}>{labels[sheet]}</Txt>
          <Txt numberOfLines={1} style={styles.context}>Slide {slide + 1}</Txt></View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetItems}>
          {!!sheetStatus && <Txt style={styles.status}>{sheetStatus}</Txt>}
          {action && <Pressable accessibilityRole="button" accessibilityLabel={ui(actionLabel!)} disabled={busy}
            onPress={() => onRecover(action)} style={styles.recovery}>
            <Txt style={[styles.status, { color: c.accent }]}>{actionLabel}</Txt>
          </Pressable>}
          {sheetItems.length ? sheetItems.map((item, index) => (
            <View key={`${sheet}-${index}`} style={styles.detail}>
              <View style={[styles.bullet, { backgroundColor: c.accent }]} />
              <Txt verbatim style={styles.detailTitle}>{item.text}</Txt>
            </View>
          ))
            : !sheetStatus && <Txt style={styles.status}>Cues are not available yet. Try again when the server is reachable.</Txt>}
        </ScrollView>
      </PanView>
      {/* OpenAI Codex, 2026-11-20: the sheet gesture caption stays anchored during drag. */}
      {!dismissing && <Txt pointerEvents="none" style={styles.closeHint}>↓ Swipe down to close</Txt>}
    </View>}
  </View>;
}
function shortCueLabel(text: string) {
  const source=text.trim(),cut=source.search(/[—:,]/u);
  if(cut<0)return source;
  const before=source.slice(0,cut).trim();
  return before.split(/\s+/u).length>=3?before:source;
}
const styles = createThemedStyles({
  panel: { position: 'absolute', left: 16, right: 16, top: 372 },
  // Raise only the heading to preserve the space below the cue cards while recording.
  heading: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 8, transform: [{ translateY: -5 }] },
  sectionTitle: { fontFamily: F.bold, fontSize: 13.5, color: C.secondary, letterSpacing: 0.6 },
  rule: { flex: 1, height: 1, backgroundColor: C.hair },
  cards: { flexDirection: 'row', gap: 10, marginTop: 0 },
  card: { flex: 1, height: 114, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 9 },
  cardTitle: { height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 18 },
  cardLabel: { marginTop: 5, fontFamily: F.semibold, fontSize: 16, lineHeight: 20, color: C.text, flex: 1 },
  cardStatus: { marginTop: 5, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18, color: C.secondary, flex: 1 },
  more: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 17, color: C.secondary },
  recovery: { minHeight: 44, justifyContent: 'center' },
  status: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 18, color: C.secondary },
  sheetLayer: { position: 'absolute', top: -372, right: -16, bottom: -844, left: -16, zIndex: 50, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { minHeight: 348, maxHeight: 644, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 50, borderTopWidth: 1, borderColor: C.line, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', opacity: 0.45 },
  sheetHeader: { marginTop: 18, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { fontFamily: F.display, fontSize: 22, lineHeight: 27 },
  context: { flex: 1, textAlign: 'right', fontFamily: F.medium, fontSize: 13.5, color: C.secondary },
  sheetScroll: { marginTop: 26 },
  sheetItems: { gap: 20, paddingBottom: 24 },
  detail: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  detailTitle: { flex: 1, fontFamily: F.bold, fontSize: 17, lineHeight: 23, color: C.text },
  closeHint: { position: 'absolute', bottom: 24, left: 24, right: 24, textAlign: 'center', fontFamily: F.medium, fontSize: 14.5, color: C.secondary },
});
