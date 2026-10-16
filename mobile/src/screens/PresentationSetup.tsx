// AI-generated with OpenAI Codex, Iteration 2 (2026-10-15).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration-prompts-iteration-2.md#finger-linked-page-fade-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt, useFrame } from '../design/frame';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, F } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { HintRow, RecordButton } from '../design/ui';
import { fmt } from '../domain/format';
import type { Presentation } from '../features/presentations/store';

const MIN = 60;
const MAX = 1200;
const STEP = 30;
const LEFT = 42;
const WIDTH = 306;
const AUDIENCES = ['Students', 'Teachers', 'Colleagues', 'Clients', 'General public', 'None of the above'] as const;

export function PresentationSetup({ deck, error, onConfirm, onBackPan }: {
  deck: Presentation; error: string; onConfirm: (seconds: number, audience: string) => void; onBackPan: PanHandlers;
}) {
  const frame = useFrame();
  const { c } = useTheme();
  const [target, setTarget] = useState(Math.max(MIN, Math.min(MAX, deck.target)));
  const [audience, setAudience] = useState<string>('');
  const selectAt = (pageX: number) => {
    const x = Math.max(0, Math.min(WIDTH, (pageX - frame.left) / frame.s - LEFT));
    setTarget(Math.max(MIN, Math.min(MAX, MIN + Math.round((x / WIDTH) * (MAX - MIN) / STEP) * STEP)));
  };
  const markerX = LEFT + (target - MIN) / (MAX - MIN) * WIDTH;
  const ticks = Array.from({ length: 39 }, (_, i) => {
    const minute = i / 2 + 1;
    const x = i / 38 * WIDTH;
    const major = Number.isInteger(minute) && minute % 5 === 0;
    return <View key={i} style={{ position: 'absolute', left: x - (major ? 1.25 : 0.8), top: major ? 0 : 5,
      width: major ? 2.5 : 1.6, height: major ? 23 : 13, borderRadius: 2,
      backgroundColor: Math.abs(minute - target / 60) < 0.25 ? c.text : c.secondary, opacity: major ? 0.75 : 0.36 }} />;
  });
  return <View style={StyleSheet.absoluteFill}>
    <PanView style={StyleSheet.absoluteFill} {...onBackPan}>
      <View style={styles.heading} pointerEvents="none">
        <Txt numberOfLines={1} style={styles.deckTitle}>{deck.title}</Txt>
        <Txt style={styles.slideCount}>{deck.pageCount} slides</Txt>
      </View>
      <View style={styles.timeArea} pointerEvents="none">
        <Txt style={styles.question}>How long is your presentation?</Txt>
        <Txt style={styles.time}>{fmt(target)}</Txt>
      </View>
      <PanView style={styles.sliderTouch} accessibilityRole="adjustable" accessibilityLabel="Time of entire presentation"
        accessibilityValue={{ min: 1, max: 20, now: target / 60, text: fmt(target) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => setTarget(v => Math.max(MIN, Math.min(MAX, v + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP))))}
        onStartShould={() => true} onGrant={e => selectAt(e.nativeEvent.pageX)} onMove={e => selectAt(e.nativeEvent.pageX)}
        onTerminationRequest={() => false}>
        <View style={styles.ticks} pointerEvents="none">{ticks}<View style={[styles.marker, { left: markerX - LEFT - 1.5, backgroundColor: c.text }]} /></View>
      </PanView>
      <View style={styles.labels} pointerEvents="none">{[5, 10, 15, 20].map(m =>
        <Txt key={m} style={[styles.tickLabel, { left: LEFT + (m - 1) / 19 * WIDTH - 14 }]}>{m}</Txt>)}</View>
      <View style={styles.audienceArea}>
        <Txt style={styles.audienceTitle}>Do you have a target audience?</Txt>
        <Txt style={styles.optional}>Optional</Txt>
        <View style={styles.chips}>{AUDIENCES.map(value => {
          const selected = audience === value || (value === 'None of the above' && audience === 'None of the above');
          return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }}
            onPress={() => setAudience(selected ? '' : value)} style={[styles.chip, {
              backgroundColor: selected ? c.surface12 : c.surface08,
              borderColor: selected ? c.text : c.border14,
            }]}><Txt style={[styles.chipText, { color: c.text }]}>{value}</Txt></Pressable>;
        })}</View>
      </View>
      <View pointerEvents="none" style={[styles.confirmRing, { borderColor: c.border14 }]} />
      {!!error && <Txt accessibilityRole="alert" style={styles.error}>{error}</Txt>}
      <RecordButton green glyph="check" label="Save presentation time and audience" onPress={() => onConfirm(target, audience === 'None of the above' ? '' : audience)} style={styles.confirm} />
      <HintRow gap={18} hints={[{ icon: 'h-spin', text: 'Drag to set the time' }, { icon: 'h-dn', text: 'Swipe down to go back', nudge: 'down' }]} />
    </PanView>
  </View>;
}

const styles = createThemedStyles({
  heading: { position: 'absolute', left: 22, right: 22, top: 50, alignItems: 'center' },
  deckTitle: { fontFamily: F.display, fontSize: 27, lineHeight: 32, color: C.text, textAlign: 'center' },
  slideCount: { fontFamily: F.medium, fontSize: 15, color: C.secondary, marginTop: 2 },
  timeArea: { position: 'absolute', left: 20, right: 20, top: 150, alignItems: 'center' },
  question: { fontFamily: F.display, fontSize: 23, lineHeight: 30, color: C.text, textAlign: 'center' },
  time: { fontFamily: F.displayHeavy, fontSize: 64, lineHeight: 75, color: C.text, fontVariant: ['tabular-nums'], marginTop: 11 },
  sliderTouch: { position: 'absolute', left: LEFT, top: 260, width: WIDTH, height: 48 },
  ticks: { position: 'absolute', left: 0, top: 8, width: WIDTH, height: 32 },
  marker: { position: 'absolute', top: -6, width: 3, height: 35, borderRadius: 2 },
  labels: { position: 'absolute', left: 0, right: 0, top: 302 },
  tickLabel: { position: 'absolute', width: 28, fontFamily: F.bold, fontSize: 11, textAlign: 'center', color: C.tertiary },
  audienceArea: { position: 'absolute', left: 22, right: 22, top: 396, alignItems: 'center' },
  audienceTitle: { fontFamily: F.display, fontSize: 23, lineHeight: 30, color: C.text, textAlign: 'center' },
  optional: { marginTop: 7, fontFamily: F.medium, fontSize: 14, color: C.secondary },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 19 },
  chip: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: F.semibold, fontSize: 13 },
  error: { position: 'absolute', left: 25, right: 25, top: 607, textAlign: 'center', fontFamily: F.medium, fontSize: 12, color: C.bad },
  confirmRing: { position: 'absolute', left: 139, top: 633, width: 112, height: 112, borderRadius: 56, borderWidth: 4 },
  confirm: { top: 647 },
});
