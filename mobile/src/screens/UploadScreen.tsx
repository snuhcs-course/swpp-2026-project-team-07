// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Upload and analysis (SPEC §4.3). The Home carousel stays
// behind, blurred, with the new presentation's icon sharp in the gap.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { C, EASE_SCREEN, F } from '../design/tokens';
import { HintRow, Pop } from '../design/ui';
import { BACK_T } from '../domain/gestures';
import { analyzePdf, discardImport, pickPdf, type Progress } from '../features/presentations/importer';
import { visibleDecks } from '../features/presentations/store';
import type { LocalPdf } from '../features/pdf/service';
import { useBack, useShell } from './shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 653.45;

export function UploadScreen() {
  const { go, home, nav } = useShell();
  const frame = useFrame();
  const [phase, setPhase] = useState<'pick' | 'picking' | 'analyze' | 'done'>('pick');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<Progress & { file: string }>({ progress: 0, status: 'Rendering slides', pages: null, file: '' });
  const [pct, setPct] = useState(0);
  const prog = useSharedValue(0);
  const dy = useSharedValue(0);
  const leaving = useRef(false);
  const gone = useSharedValue(0);
  const job = useRef<{ pdf: LocalPdf; controller: AbortController } | null>(null);

  useEffect(() => { home.uploadBlur.set(withTiming(1, { duration: 420 })); home.analyzing.set(0); }, [home.analyzing, home.uploadBlur]);
  useAnimatedReaction(() => Math.round(prog.value * 100), (v, prev) => { if (v !== prev) runOnJS(setPct)(v); });

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    gone.set(1);
    const current = job.current;
    if (current) { current.controller.abort(); job.current = null; void discardImport(current.pdf); }
    // Close the gap from wherever the drag left it, then show Home.
    const spread = 1 - Math.min(1, dy.get() / 260);
    home.gap.set(spread);
    home.gap.set(withTiming(0, { duration: 520, easing: EASE_SCREEN }));
    home.uploadBlur.set(withTiming(0, { duration: 420 }));
    home.analyzing.set(withTiming(0, { duration: 300 }));
    dy.set(withTiming(520, { duration: 280 }));
    setTimeout(() => go('home', { nav: 'fade' }), 280);
  }, [dy, go, gone, home.analyzing, home.gap, home.uploadBlur]);

  const pick = useCallback(async () => {
    if (phase !== 'pick' || leaving.current) return;
    setError(''); setPhase('picking');
    let pdf: LocalPdf | null = null;
    try { pdf = await pickPdf(); }
    catch (e) { setError(e instanceof Error ? e.message : 'PDF import failed.'); setPhase('pick'); return; }
    if (!pdf || leaving.current) { setPhase('pick'); return; }
    const controller = new AbortController();
    job.current = { pdf, controller };
    setPhase('analyze');
    setInfo({ progress: 0, status: 'Rendering slides', pages: null, file: pdf.title + '.pdf' });
    home.analyzing.set(withTiming(1, { duration: 520, easing: EASE_SCREEN }));
    prog.set(0);
    prog.set(withTiming(0.3, { duration: 2400, easing: Easing.out(Easing.quad) }));
    try {
      const deck = await analyzePdf(pdf, p => {
        setInfo(i => ({ ...i, ...p }));
        if (p.progress >= 1) prog.set(withTiming(1, { duration: 450 }));
        else if (p.progress >= 0.67) prog.set(withTiming(0.95, { duration: 900, easing: Easing.out(Easing.quad) }));
        else if (p.progress >= 0.34) prog.set(withTiming(0.62, { duration: 5000, easing: Easing.out(Easing.quad) }));
      }, controller.signal);
      if (leaving.current) return;
      job.current = null;
      setPhase('done');
      setTimeout(() => {
        if (leaving.current) return;
        const index = visibleDecks().findIndex(d => d.id === deck.id);
        home.p.set(Math.max(0, index));
        home.gap.set(0); home.uploadBlur.set(0); home.analyzing.set(0);
        go('rehearse', { nav: 'fade', deckId: deck.id, slide: 0 });
      }, 500);
    } catch (e) {
      if (leaving.current) return;
      job.current = null;
      void discardImport(pdf);
      home.analyzing.set(withTiming(0, { duration: 300 }));
      prog.set(withTiming(0, { duration: 300 }));
      setError(e instanceof Error && e.message !== 'cancelled' ? e.message : 'The PDF could not be analysed.');
      setPhase('pick');
    }
  }, [go, home.analyzing, home.gap, home.p, home.uploadBlur, phase, prog]);

  const pan = {
    onMoveShould: (_e: GestureResponderEvent, g: PanResponderGestureState) => g.dy > 8 && g.dy > Math.abs(g.dx),
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const d = Math.max(0, g.dy / frame.s), v = d > 160 ? 160 + (d - 160) * 0.5 : d;
      dy.set(v);
      home.uploadBlur.set(1 - Math.min(1, v / 260));
    },
    onRelease: () => {
      if (dy.get() > BACK_T) leave();
      else { dy.set(withTiming(0, { duration: 320, easing: EASE_SCREEN })); home.uploadBlur.set(withTiming(1, { duration: 320 })); }
    },
    onTerminate: () => { dy.set(withTiming(0, { duration: 320 })); home.uploadBlur.set(withTiming(1, { duration: 320 })); },
  };
  useBack(true, () => { leave(); return true; });

  const content = useAnimatedStyle(() => ({ opacity: gone.value ? withTiming(0, { duration: 280 }) : Math.max(0.15, 1 - dy.value / 260), transform: [{ translateY: dy.value * 0.55 }] }));
  const ring = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - prog.value) }));
  const analyzing = phase === 'analyze' || phase === 'done';
  const pr = pct / 100;
  const stages = [
    { icon: 'i-slides' as const, label: 'Slides', done: pr >= 0.33, op: 1 },
    { icon: 'i-text' as const, label: 'Text', done: pr >= 0.66, op: pr >= 0.33 ? 1 : 0.35 },
    { icon: 'i-timer' as const, label: 'Timing', done: pr >= 1, op: pr >= 0.66 ? 1 : 0.35 },
  ];

  return (
    <Enter kind={nav.nav}>
      <PanView style={StyleSheet.absoluteFill} {...pan}>
        <Animated.View style={[StyleSheet.absoluteFill, content]}>
          {!analyzing && <>
            <View style={styles.pickArea}>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose a PDF to upload" onPress={() => void pick()} style={styles.pickButton} />
            </View>
            <View style={styles.text} pointerEvents="none">
              <Txt style={styles.title}>Add your presentation</Txt>
              <Txt style={[styles.sub, error ? { color: C.bad } : null]}>{error || (phase === 'picking' ? 'Opening your files…' : 'Tap the icon to upload')}</Txt>
              <Txt style={styles.limit}>PDF · up to 50 MiB · any slide count</Txt>
            </View>
          </>}
          {analyzing && <>
            <View style={styles.ringWrap} pointerEvents="none">
              <Svg width={223} height={223} viewBox="0 0 223 223">
                <Defs><LinearGradient id="gMultiUp" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7CC2FF" /><Stop offset="0.5" stopColor="#9B7CFF" /><Stop offset="1" stopColor="#FF7EB6" /></LinearGradient></Defs>
                <Circle cx={111.5} cy={111.5} r={104} fill="none" stroke={C.track} strokeWidth={8} />
                <AnimatedCircle cx={111.5} cy={111.5} r={104} fill="none" stroke="url(#gMultiUp)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${RING}`}
                  transform="rotate(-90 111.5 111.5)" animatedProps={ring} />
              </Svg>
            </View>
            <View style={styles.progress} pointerEvents="none" accessibilityLiveRegion="polite">
              <Txt style={styles.pct}>{pct}%</Txt>
              <Txt style={styles.status}>{pr >= 1 ? 'Ready' : info.status}</Txt>
              <Txt numberOfLines={1} style={styles.file}>{info.file + (info.pages ? ' · ' + info.pages + ' slides' : '')}</Txt>
              <View style={styles.stages}>
                {stages.map(g => (
                  <View key={g.label} style={[styles.stage, { opacity: g.op }]}>
                    <View style={{ width: 44, height: 44 }}>
                      <UIIcon name={g.icon} size={44} />
                      {g.done && <View style={styles.check}><Pop duration={380}><UIIcon name="i-check" size={22} /></Pop></View>}
                    </View>
                    <Txt style={styles.stageLabel}>{g.label}</Txt>
                  </View>
                ))}
              </View>
              {info.textOffline && pr >= 0.66 && <Txt style={styles.offline}>Slide text will be read when the server is reachable.</Txt>}
            </View>
          </>}
          <HintRow gap={6} hints={[{ icon: 'h-dn', text: analyzing ? 'Swipe down to cancel' : 'Swipe down to go back', nudge: 'down' }]} />
        </Animated.View>
      </PanView>
    </Enter>
  );
}

const styles = StyleSheet.create({
  pickArea: { position: 'absolute', left: 0, right: 0, top: 211, alignItems: 'center' },
  pickButton: { width: 260, height: 223 },
  text: { position: 'absolute', left: 28, right: 28, top: 547, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.7, color: C.text, textAlign: 'center' },
  sub: { marginTop: 12, fontFamily: F.medium, fontSize: 15, color: C.secondary, textAlign: 'center' },
  limit: { marginTop: 4, fontFamily: F.medium, fontSize: 13, color: C.tertiary },
  ringWrap: { position: 'absolute', left: 0, right: 0, top: 211, alignItems: 'center' },
  progress: { position: 'absolute', left: 28, right: 28, top: 547, alignItems: 'center' },
  pct: { fontFamily: F.display, fontSize: 52, lineHeight: 54, letterSpacing: -1.5, color: C.text, fontVariant: ['tabular-nums'] },
  status: { marginTop: 10, fontFamily: F.semibold, fontSize: 15, color: C.text },
  file: { marginTop: 4, fontFamily: F.medium, fontSize: 13, color: C.secondary, maxWidth: 320 },
  stages: { flexDirection: 'row', gap: 40, marginTop: 18 },
  stage: { alignItems: 'center', gap: 6 },
  check: { position: 'absolute', right: -8, bottom: -6 },
  stageLabel: { fontFamily: F.semibold, fontSize: 13, color: C.secondary },
  offline: { marginTop: 10, fontFamily: F.medium, fontSize: 12, color: C.tertiary, textAlign: 'center' },
});
