// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-117
// OpenAI Codex import-ring layout: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
// OpenAI Codex light-mode upload: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-081
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: Upload and analysis (SPEC §4.3). The new presentation's
// icon carries from the Home carousel gap into the PDF progress ring.
import { useUiText } from '../design/language';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, {
  cancelAnimation, Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { C, EASE_SCREEN, F } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { HintRow, Pop } from '../design/ui';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import type { HueName } from '../domain/hues';
import { analyzePdf, discardImport, pickPdf, SLIDE_TEXT_WAIT_MS, type Progress } from '../features/presentations/importer';
import { visibleDecks, type Presentation } from '../features/presentations/store';
import type { LocalPdf } from '../features/pdf/service';
import { UploadArtwork } from './HomeScreen';
import { PresentationRequirementsEditor, PresentationSetupHint } from './PresentationSetup';
import { ANALYZE_RING_STROKE, analyzeRing } from './homeGeometry';
import { useBack, useShell } from './shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const FILE_BOX = 40, FILE_GAP = 22;
const ADD_HANDOFF_MS = 280;
const STAGE_MS = { finding: 90, reading: 180, planning: 230, ready: 155 };
const STILL_FILL = { finding: 0.14, reading: 0.45, planning: 0.82, ready: 1 };
const READING_ADVANCE_MS = 150;

function waitForStage(ms: number, signal: AbortSignal) {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

export function UploadScreen({ hue = 'violet', empty = false, onReadingPdf }: { hue?: HueName; empty?: boolean; onReadingPdf?: (value: boolean) => void }) {
  const ui = useUiText();
  const { c } = useTheme();
  const { go, home } = useShell();
  const frame = useFrame();
  const [phase, setPhase] = useState<'pick' | 'picking' | 'analyze' | 'configure'>('pick');
  const [setupHintVisible, setSetupHintVisible] = useState(true);
  const [readyDeck, setReadyDeck] = useState<Presentation | null>(null);
  const picking = phase === 'pick' || phase === 'picking';
  const [error, setError] = useState('');
  const [info, setInfo] = useState<Progress & { file: string }>({ stage: 'finding', pages: null, file: '' });
  const reducedMotion = useReducedMotion();
  const prog = useSharedValue(0);
  // Seed the screen's first native style as opaque, independent of the carousel's gap.
  const dy = useSharedValue(0);
  const leaving = useRef(false);
  const backExiting = useRef(false);
  const job = useRef<{ pdf: LocalPdf; controller: AbortController } | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast=useCallback((message:string)=>{setError(message);if(errorTimer.current)clearTimeout(errorTimer.current);errorTimer.current=setTimeout(()=>setError(''),4500);},[]);

  useEffect(() => {
    home.gap.set(1);
    home.uploadBlur.set(withTiming(1, {
      duration: reducedMotion ? 0 : ADD_HANDOFF_MS,
      easing: EASE_SCREEN,
    }));
    home.analyzing.set(0);
    home.setup.set(0);
  }, [home.analyzing, home.gap, home.setup, home.uploadBlur, reducedMotion]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    cancelAnimation(prog);
    const current = job.current;
    if (current) { current.controller.abort(); job.current = null; void discardImport(current.pdf); }
    home.gap.set(0);
    home.uploadBlur.set(0);
    home.analyzing.set(0);
    home.setup.set(0);
    go('home', { nav: null });
  }, [go, home.analyzing, home.gap, home.setup, home.uploadBlur, prog]);

  const pick = useCallback(async () => {
    if (phase !== 'pick' || leaving.current || backExiting.current) return;
    dy.set(0);
    home.uploadReturn.set(0);
    if(errorTimer.current)clearTimeout(errorTimer.current);
    setError(''); setPhase('picking');
    let pdf: LocalPdf | null = null;
    try { pdf = await pickPdf(); }
    catch (e) { showToast(e instanceof Error ? e.message : 'PDF import failed.'); setPhase('pick'); return; }
    if (leaving.current || backExiting.current) { if (pdf) void discardImport(pdf); return; }
    dy.set(0);
    home.uploadReturn.set(0);
    if (!pdf) { setPhase('pick'); return; }
    home.uploadBlur.set(1);
    const controller = new AbortController();
    const { signal } = controller;
    job.current = { pdf, controller };
    const file = pdf.title + '.pdf';
    onReadingPdf?.(true);
    setPhase('analyze');
    setInfo({ stage: 'finding', pages: null, file });
    home.analyzing.set(withTiming(1, { duration: 520, easing: EASE_SCREEN }));
    prog.set(0);
    prog.set(reducedMotion ? STILL_FILL.finding : withTiming(0.3, { duration: 2400, easing: Easing.out(Easing.quad) }));
    let shownStage: Progress['stage'] = 'finding';
    let shownAt = Date.now();
    let stagesShown = Promise.resolve();
    const canceled = () => signal.aborted || leaving.current || backExiting.current;
    try {
      const deck = await analyzePdf(pdf, p => {
        if (p.stage === 'finding') return;
        // Instant extraction and time planning can finish in one React batch.
        // Present the stages in order without holding up PDF or server work.
        stagesShown = stagesShown.then(async () => {
          await waitForStage(STAGE_MS[shownStage] - (Date.now() - shownAt), signal);
          if (canceled()) return;
          shownStage = p.stage;
          shownAt = Date.now();
          setInfo({ ...p, file });
          if (reducedMotion) prog.set(STILL_FILL[p.stage]);
          else if (p.stage === 'reading') prog.set(withSequence(
            withTiming(0.45, { duration: READING_ADVANCE_MS, easing: EASE_SCREEN }),
            withTiming(0.66, { duration: SLIDE_TEXT_WAIT_MS - READING_ADVANCE_MS, easing: Easing.out(Easing.quad) }),
          ));
          else if (p.stage === 'planning') prog.set(withTiming(0.94, { duration: 210, easing: EASE_SCREEN }));
          else prog.set(withTiming(1, { duration: 135, easing: EASE_SCREEN }));
        });
      }, signal);
      await stagesShown;
      if (!reducedMotion) await waitForStage(STAGE_MS.ready - (Date.now() - shownAt), signal);
      if (canceled()) return;
      // OpenAI Codex import setup: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-107
      setReadyDeck(deck);
      setPhase('configure');
      home.setup.set(withTiming(1, { duration: 260 }));
    } catch (e) {
      if (signal.aborted) { void discardImport(pdf); return; }
      if (canceled()) return;
      controller.abort();
      job.current = null;
      void discardImport(pdf);
      home.analyzing.set(withTiming(0, { duration: 300 }));
      prog.set(withTiming(0, { duration: 300 }));
      showToast(e instanceof Error && e.message !== 'cancelled' ? e.message : 'The PDF could not be analysed.');
      onReadingPdf?.(false);
      setPhase('pick');
    }
  }, [dy, home.analyzing, home.setup, home.uploadBlur, home.uploadReturn, onReadingPdf, phase, prog, reducedMotion, showToast]);
  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    const current = job.current;
    if (current) {
      current.controller.abort();
      job.current = null;
      void discardImport(current.pdf);
    }
  }, []);

  const finishSetup = useCallback(() => {
    if (!readyDeck || leaving.current || backExiting.current) return;
    const deck = readyDeck;
    leaving.current = true;
    job.current = null;
    const index = visibleDecks().findIndex(d => d.id === deck.id);
    home.p.set(Math.max(0, index));
    home.gap.set(0); home.uploadBlur.set(0); home.analyzing.set(0); home.setup.set(0);
    go('rehearse', { nav: 'fade', deckId: deck.id, slide: 0 });
  }, [go, home.analyzing, home.gap, home.p, home.setup, home.uploadBlur, readyDeck]);

  const returnHome = () => {
    if (backExiting.current) return;
    backExiting.current = true;
    const timing = { duration: reducedMotion ? 0 : picking ? ADD_HANDOFF_MS : 460, easing: EASE_SCREEN };
    home.uploadBlur.set(withTiming(0, timing));
    if (phase === 'analyze' || phase === 'configure') home.analyzing.set(withTiming(0, timing));
    if (phase === 'configure') home.setup.set(withTiming(0, timing));
    home.gap.set(withTiming(0, timing));
    home.uploadReturn.set(withTiming(1, timing));
    dy.set(withTiming(BACK_FADE_Y, timing, finished => {
      if (finished) runOnJS(leave)();
    }));
  };
  const settleUpload = () => {
    if (backExiting.current) return;
    const timing = { duration: reducedMotion ? 0 : picking ? ADD_HANDOFF_MS : 360, easing: EASE_SCREEN };
    dy.set(withTiming(0, timing));
    home.uploadReturn.set(withTiming(0, timing));
    home.gap.set(withTiming(1, timing));
    home.uploadBlur.set(withTiming(1, timing));
    if (phase === 'analyze' || phase === 'configure') home.analyzing.set(withTiming(1, timing));
    if (phase === 'configure') home.setup.set(withTiming(1, timing));
  };
  const pan = {
    onMoveShould: (_e: GestureResponderEvent, g: PanResponderGestureState) => !backExiting.current && g.dy > 8 && g.dy > Math.abs(g.dx),
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      if (backExiting.current) return;
      const v = Math.min(BACK_FADE_Y, Math.max(0, g.dy / frame.s));
      const progress = v / BACK_FADE_Y;
      const visible = 1 - progress;
      dy.set(v);
      home.uploadReturn.set(progress);
      home.uploadBlur.set(visible);
      home.gap.set(visible);
      if (phase === 'analyze' || phase === 'configure') home.analyzing.set(visible);
      if (phase === 'configure') home.setup.set(visible);
    },
    onRelease: () => {
      if (dy.get() > BACK_T) returnHome();
      else settleUpload();
    },
    onTerminate: settleUpload,
  };
  useBack(true, () => { returnHome(); return true; });

  const content = useAnimatedStyle(() => ({ opacity: picking ? 1 : 1 - dy.value / BACK_FADE_Y }));
  const pickerCopy = useAnimatedStyle(() => ({
    opacity: Math.max(0, 2 * home.uploadBlur.value - 1),
    transform: [{ translateY: 8 * (1 - home.uploadBlur.value) }],
  }));
  const footer = useAnimatedStyle(() => ({ opacity: Math.max(0, 2 * home.uploadBlur.value - 1) }));
  const importFooter = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - 2 * dy.value / BACK_FADE_Y) }));
  // OpenAI Codex import-ring fix: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
  const ringAt = analyzeRing(frame.compact);
  const ringLength = 2 * Math.PI * ringAt.r;
  const ringBox = Math.ceil(2 * ringAt.r + ANALYZE_RING_STROKE) + 2;
  const ringMid = ringBox / 2;
  const ring = useAnimatedProps(() => ({ strokeDashoffset: ringLength * (1 - prog.value) }));
  const ringFade = useAnimatedStyle(() => ({ opacity: home.analyzing.value }));
  const analyzing = phase === 'analyze';
  const crowded = frame.compact && (!!info.imageOnlySlides || !!info.textOffline);
  const stages = [
    { icon: 'i-slides' as const, label: info.pages ? `Found ${info.pages} slides` : 'Finding slides', done: !!info.pages, active: info.stage === 'finding' },
    { icon: 'i-text' as const, label: 'Reading the text', done: (info.stage === 'planning' || info.stage === 'ready') && !info.textOffline, active: info.stage === 'reading' },
    { icon: 'i-timer' as const, label: 'Planning time per slide', done: info.stage === 'ready', active: info.stage === 'planning' },
  ];

  return (
    <>
      <Animated.View testID="upload-content" style={[StyleSheet.absoluteFill, content]}>
      {readyDeck && phase === 'configure' ? (
        // Only the editor content enters. The opaque surface already covers Home.
        <View testID="upload-timing-surface" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
          <Enter kind="fade">
            <PresentationRequirementsEditor deck={readyDeck} initialImport fixedHint onHintVisibilityChange={setSetupHintVisible} onSaved={finishSetup} onBackPan={pan} />
          </Enter>
        </View>
      ) : <>
      <UploadArtwork home={home} hue={hue} followCarousel={picking && !empty} />
      <PanView style={StyleSheet.absoluteFill} {...pan}>
          {!analyzing && <>
            <View style={styles.pickArea}>
              <Pressable accessibilityRole="button" accessibilityLabel={ui("Choose a PDF to upload")} onPress={() => void pick()} style={styles.pickButton} />
            </View>
            <Animated.View testID="add-copy" pointerEvents="none" style={[StyleSheet.absoluteFill, pickerCopy]}>
              <View style={styles.newHeader}><Txt style={styles.newLabel}>New</Txt></View>
              <View style={styles.text}>
                <Txt style={styles.title}>Add your presentation</Txt>
                <Txt style={styles.sub}>{phase === 'picking' ? 'Opening your files…' : 'Tap the icon to upload · PDF · up to 50 MB'}</Txt>
                <Txt style={styles.limit}>Any slide count</Txt>
              </View>
              {!!error&&<View accessibilityRole="alert" style={[styles.errorToast,{backgroundColor:c.toast,borderColor:c.toastBorder}]}><Txt style={[styles.errorToastText,{color:c.text}]}>{error}</Txt></View>}
            </Animated.View>
          </>}
          {analyzing && <>
            <Animated.View style={[styles.ringWrap, { top: ringAt.cy - ringMid }, ringFade]} pointerEvents="none">
              <Svg width={ringBox} height={ringBox} viewBox={`0 0 ${ringBox} ${ringBox}`}>
                <Defs><LinearGradient id="gMultiUp" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.accent} /><Stop offset="1" stopColor={c.good} /></LinearGradient></Defs>
                <Circle cx={ringMid} cy={ringMid} r={ringAt.r} fill="none" stroke={c.track} strokeWidth={ANALYZE_RING_STROKE} />
                <AnimatedCircle cx={ringMid} cy={ringMid} r={ringAt.r} fill="none" stroke="url(#gMultiUp)" strokeWidth={ANALYZE_RING_STROKE} strokeLinecap="round" strokeDasharray={`${ringLength}`}
                  transform={`rotate(-90 ${ringMid} ${ringMid})`} animatedProps={ring} />
              </Svg>
            </Animated.View>
            <View style={[styles.fileWrap, { top: ringAt.top - FILE_GAP - FILE_BOX }]} pointerEvents="none">
              <Txt verbatim numberOfLines={1} style={styles.file}>{info.file || ui('Preparing your presentation')}</Txt>
            </View>
            <View style={[styles.progress, { top: ringAt.bottom, bottom: crowded ? 40 : 0 }]} pointerEvents="box-none" accessibilityLiveRegion="polite">
              <View style={[styles.stages, crowded && styles.stagesCrowded]} pointerEvents="none">
                {stages.map(g => (
                  <View key={g.label} style={styles.stage}>
                    <View style={[styles.stageIcon, g.done && styles.stageDone]}>
                      {g.done ? <Pop duration={380}><UIIcon name="i-check" size={20} color={c.good} /></Pop> : <UIIcon name={g.icon} size={21} color={g.active ? c.text : c.muted2} />}
                    </View>
                    <Txt style={[styles.stageLabel, { color: g.done || g.active ? c.text : c.muted2 }]}>{g.label}</Txt>
                  </View>
                ))}
              </View>
              {info.imageOnlySlides && <Txt style={[styles.offline, crowded && styles.offlineCrowded]}>Some slides have no embedded text.</Txt>}
              {info.textOffline && <Txt style={[styles.offline, crowded && styles.offlineCrowded]}>Slide text will be read when the server is reachable.</Txt>}
            </View>
          </>}
      </PanView>
      </>}
      </Animated.View>
    <Animated.View testID="upload-hints" pointerEvents="none" style={[StyleSheet.absoluteFill, picking ? footer : importFooter]}>
      {phase !== 'configure' && <HintRow gap={6} hints={[{ icon: 'h-dn', text: analyzing ? 'Swipe down to cancel' : 'Swipe down to go back', nudge: 'down' }]} />}
      {phase === 'configure' && setupHintVisible && <PresentationSetupHint />}
    </Animated.View>
    </>
  );
}

const styles = createThemedStyles({
  newHeader: { position: 'absolute', top: 205, left: 0, right: 0, alignItems: 'center' },
  newLabel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, overflow: 'hidden', fontFamily: F.semibold, fontSize: 13.5, color: C.secondary, backgroundColor: C.surface06 },
  pickArea: { position: 'absolute', left: 0, right: 0, top: 211, alignItems: 'center' },
  pickButton: { width: 260, height: 223 },
  text: { position: 'absolute', left: 28, right: 28, top: 560, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: C.text, textAlign: 'center' },
  sub: { marginTop: 12, fontFamily: F.medium, fontSize: 15, color: C.secondary, textAlign: 'center' },
  limit: { marginTop: 4, fontFamily: F.medium, fontSize: 13.5, color: C.tertiary },
  errorToast:{position:'absolute',left:24,right:24,top:98,minHeight:44,paddingHorizontal:16,paddingVertical:10,borderWidth:1,borderRadius:22,alignItems:'center',justifyContent:'center',zIndex:30},
  errorToastText:{fontFamily:F.semibold,fontSize:14,lineHeight:19,textAlign:'center'},
  ringWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fileWrap: { position: 'absolute', left: 28, right: 28, height: FILE_BOX, justifyContent: 'flex-end', alignItems: 'center' },
  progress: { position: 'absolute', left: 28, right: 28, bottom: 0, paddingTop: 40, justifyContent: 'flex-start', alignItems: 'center' },
  file: { fontFamily: F.display, fontSize: 20, lineHeight: 26, color: C.text, maxWidth: 320, textAlign: 'center' },
  stages: { alignItems: 'flex-start', gap: 12 },
  stagesCrowded: { gap: 8 },
  stage: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14 },
  stageIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  stageDone: { borderColor: C.good },
  check: { position: 'absolute', right: -8, bottom: -6 },
  stageLabel: { fontFamily: F.semibold, fontSize: 15, color: C.secondary },
  offline: { marginTop: 10, fontFamily: F.medium, fontSize: 13.5, color: C.tertiary, textAlign: 'center' },
  offlineCrowded: { marginTop: 4 },
});
