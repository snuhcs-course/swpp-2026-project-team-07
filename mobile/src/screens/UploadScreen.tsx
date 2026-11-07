// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration-prompts-iteration-2.md#finger-linked-page-fade-october-15-2026
// OpenAI Codex light-mode upload: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
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
import { createThemedStyles, useTheme } from '../design/theme';
import { ThemeToggle } from '../design/ThemeToggle';
import { Dialog, HintRow, Pop } from '../design/ui';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { analyzePdf, discardImport, pickPdf, type Progress } from '../features/presentations/importer';
import { useSlideProfiles } from '../features/presentations/useSlideProfiles';
import type { ProfileState } from '../features/presentations/slideProfiles';
import { visibleDecks, type Presentation } from '../features/presentations/store';
import type { LocalPdf } from '../features/pdf/service';
import { PresentationRequirementsEditor } from './PresentationSetup';
import { useBack, useShell } from './shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 326.73;

export function UploadScreen() {
  const { c } = useTheme();
  const { go, home, nav } = useShell();
  const frame = useFrame();
  const [phase, setPhase] = useState<'pick' | 'picking' | 'analyze' | 'configure'>('pick');
  const [readyDeck, setReadyDeck] = useState<Presentation | null>(null);
  const [profileRetryAsk,setProfileRetryAsk]=useState<ProfileState|null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<Progress & { file: string }>({ progress: 0, status: 'Rendering slides', pages: null, file: '' });
  const [pct, setPct] = useState(0);
  const [profileWaitExpired, setProfileWaitExpired] = useState(false);
  const prog = useSharedValue(0);
  const dy = useSharedValue(0);
  const leaving = useRef(false);
  const backExiting = useRef(false);
  const job = useRef<{ pdf: LocalPdf; controller: AbortController } | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileStartFor = useRef('');
  const profiles = useSlideProfiles(readyDeck?.id ?? '', readyDeck?.pageCount ?? 0, phase === 'analyze');
  const recoverProfiles=profiles.recover;
  const profileState = profiles.value;
  const profileTerminal = profileState?.state === 'completed' || ['disabled','configuration_unavailable','source_unavailable'].includes(profileState?.state ?? '') || (!!profiles.error && !profileState) || !profiles.available || profileWaitExpired;
  const showToast=useCallback((message:string)=>{setError(message);if(errorTimer.current)clearTimeout(errorTimer.current);errorTimer.current=setTimeout(()=>setError(''),4500);},[]);

  useEffect(() => { home.uploadBlur.set(withTiming(1, { duration: 420 })); home.analyzing.set(0); home.setup.set(0); }, [home.analyzing, home.setup, home.uploadBlur]);
  useAnimatedReaction(() => Math.round(prog.value * 100), (v, prev) => { if (v !== prev) runOnJS(setPct)(v); });

  useEffect(() => {
    if (phase !== 'analyze' || !readyDeck || profileStartFor.current === readyDeck.id) return;
    profileStartFor.current = readyDeck.id;
    // The profile endpoint deduplicates the same source/schema scope; its existing
    // retry API retains uncertainty and revision safeguards.
    void recoverProfiles();
  }, [phase, readyDeck, recoverProfiles]);

  useEffect(() => {
    if (phase !== 'analyze' || !readyDeck || !profileTerminal) return;
    const timer = setTimeout(() => {
      if (leaving.current) return;
      setPhase('configure');
      home.setup.set(withTiming(1, { duration: 260 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [phase, readyDeck, profileTerminal, home.setup]);

  useEffect(() => {
    if (phase !== 'analyze' || !readyDeck || profileTerminal) return;
    const timer = setTimeout(() => setProfileWaitExpired(true), 25_000);
    return () => clearTimeout(timer);
  }, [phase, readyDeck, profileTerminal]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const current = job.current;
    if (current) { current.controller.abort(); job.current = null; void discardImport(current.pdf); }
    home.gap.set(0);
    home.uploadBlur.set(0);
    home.analyzing.set(0);
    home.setup.set(0);
    go('home', { nav: null });
  }, [go, home.analyzing, home.gap, home.setup, home.uploadBlur]);

  const pick = useCallback(async () => {
    if (phase !== 'pick' || leaving.current) return;
    if(errorTimer.current)clearTimeout(errorTimer.current);
    setError(''); setPhase('picking');
    setProfileWaitExpired(false);
    let pdf: LocalPdf | null = null;
    try { pdf = await pickPdf(); }
    catch (e) { showToast(e instanceof Error ? e.message : 'PDF import failed.'); setPhase('pick'); return; }
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
      if (leaving.current || controller.signal.aborted) return;
      setReadyDeck(deck);
      setInfo(i => ({ ...i, progress: 1, status: 'Ready' }));
      prog.set(withTiming(1, { duration: 450 }));
    } catch (e) {
      if (leaving.current) return;
      job.current = null;
      void discardImport(pdf);
      home.analyzing.set(withTiming(0, { duration: 300 }));
      prog.set(withTiming(0, { duration: 300 }));
      showToast(e instanceof Error && e.message !== 'cancelled' ? e.message : 'The PDF could not be analysed.');
      setPhase('pick');
    }
  }, [home.analyzing, phase, prog, showToast]);
  useEffect(()=>()=>{if(errorTimer.current)clearTimeout(errorTimer.current);},[]);

  const finishSetup = useCallback(() => {
    if (!readyDeck || leaving.current) return;
    const deck = readyDeck;
    leaving.current = true;
    job.current = null;
    const index = visibleDecks().findIndex(d => d.id === deck.id);
    home.p.set(Math.max(0, index));
    home.gap.set(0); home.uploadBlur.set(0); home.analyzing.set(0); home.setup.set(0);
    go('rehearse', { nav: 'fade', deckId: deck.id, slide: 0 });
  }, [go, home.analyzing, home.gap, home.p, home.setup, home.uploadBlur, readyDeck]);

  const pan = {
    onMoveShould: (_e: GestureResponderEvent, g: PanResponderGestureState) => !backExiting.current && g.dy > 8 && g.dy > Math.abs(g.dx),
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const v = Math.min(BACK_FADE_Y, Math.max(0, g.dy / frame.s));
      const visible = 1 - v / BACK_FADE_Y;
      dy.set(v);
      home.uploadBlur.set(visible);
      home.gap.set(visible);
      if (phase === 'analyze' || phase === 'configure') home.analyzing.set(visible);
      if (phase === 'configure') home.setup.set(visible);
    },
    onRelease: () => {
      if (dy.get() > BACK_T) {
        backExiting.current = true;
        dy.set(withTiming(BACK_FADE_Y, { duration: 220, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(leave)();
        }));
        home.uploadBlur.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
        home.gap.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
        if (phase === 'analyze' || phase === 'configure') home.analyzing.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
        if (phase === 'configure') home.setup.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
      } else {
        dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
        home.uploadBlur.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
        home.gap.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
        if (phase === 'analyze' || phase === 'configure') home.analyzing.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
        if (phase === 'configure') home.setup.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
      }
    },
    onTerminate: () => {
      if (backExiting.current) return;
      dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
      home.uploadBlur.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
      home.gap.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
      if (phase === 'analyze' || phase === 'configure') home.analyzing.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
      if (phase === 'configure') home.setup.set(withTiming(1, { duration: 220, easing: EASE_SCREEN }));
    },
  };
  useBack(true, () => { leave(); return true; });

  const content = useAnimatedStyle(() => ({
    // Home's controls and carousel emerge in place during the downward gesture.
    opacity: Math.max(0, 1 - dy.value / BACK_FADE_Y),
  }));
  const ring = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - prog.value) }));
  const analyzing = phase === 'analyze' || phase === 'configure';
  const pr = pct / 100;
  const profileFailed = profileState?.state === 'failed' || profileState?.state === 'needs_confirmation' || profiles.error !== '';
  const stages = [
    { icon: 'i-slides' as const, label: info.pages ? `Found ${info.pages} slides` : 'Finding slides', done: pr >= 0.33, active: pr < 0.33 },
    { icon: 'i-text' as const, label: 'Reading the text', done: profileState?.state === 'completed', active: !!readyDeck && !profileTerminal },
    { icon: 'i-timer' as const, label: 'Planning time per slide', done: pr >= 1, active: pr >= 0.66 && pr < 1 },
  ];

  return (
    <Enter kind={nav.nav}>
      <Animated.View style={[StyleSheet.absoluteFill, content]}>
      <View pointerEvents={readyDeck && phase === 'configure' ? 'none' : 'box-none'}
        style={[StyleSheet.absoluteFill, readyDeck && phase === 'configure' && styles.setupBlur]}>
      <PanView style={StyleSheet.absoluteFill} {...pan}>
          {!analyzing && <>
            <View style={styles.pickArea}>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose a PDF to upload" onPress={() => void pick()} style={styles.pickButton} />
            </View>
            <View style={styles.newHeader} pointerEvents="none"><Txt style={styles.newTitle}>New presentation</Txt><Txt style={styles.newLabel}>New</Txt></View>
            <View style={styles.text} pointerEvents="none">
              <Txt style={styles.title}>Add your presentation</Txt>
              <Txt style={styles.sub}>{phase === 'picking' ? 'Opening your files…' : 'Tap the icon to upload · PDF · up to 50 MB'}</Txt>
              <Txt style={styles.limit}>Any slide count</Txt>
            </View>
            {!!error&&<View accessibilityRole="alert" style={[styles.errorToast,{backgroundColor:c.toast,borderColor:c.toastBorder}]}><Txt style={[styles.errorToastText,{color:c.text}]}>{error}</Txt></View>}
          </>}
          {analyzing && <>
            <View style={styles.ringWrap} pointerEvents="none">
              <Svg width={118} height={118} viewBox="0 0 118 118">
                <Defs><LinearGradient id="gMultiUp" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.accent} /><Stop offset="1" stopColor={c.good} /></LinearGradient></Defs>
                <Circle cx={59} cy={59} r={52} fill="none" stroke={c.track} strokeWidth={5} />
                <AnimatedCircle cx={59} cy={59} r={52} fill="none" stroke="url(#gMultiUp)" strokeWidth={5} strokeLinecap="round" strokeDasharray={`${RING}`}
                  transform="rotate(-90 59 59)" animatedProps={ring} />
              </Svg>
            </View>
            <View style={styles.progress} pointerEvents="none" accessibilityLiveRegion="polite">
              <Txt numberOfLines={1} style={styles.file}>{info.file || 'Preparing your presentation'}</Txt>
              <View style={styles.stages}>
                {stages.map((g, index) => (
                  <View key={g.label} style={styles.stage}>
                    <View style={[styles.stageIcon, g.done && styles.stageDone, index === 1 && profileFailed && styles.stageFailed]}>
                      {index === 1 && profileFailed ? <Txt style={styles.warning}>!</Txt> : g.done ? <Pop duration={380}><UIIcon name="i-check" size={20} color={c.good} /></Pop> : <UIIcon name={g.icon} size={21} color={g.active ? c.text : c.muted2} />}
                    </View>
                    <Txt style={[styles.stageLabel, { color: index === 1 && profileFailed ? c.bad : g.done || g.active ? c.text : c.muted2 }]}>{g.label}</Txt>
                    {index === 1 && profileFailed && <>
                      <Pressable accessibilityRole="button" accessibilityLabel="Try slide profile analysis again" disabled={profiles.busy || !profileState?.retry_available} onPress={() => { if(profileState?.requires_confirmation)setProfileRetryAsk(profileState);else void profiles.recover(); }}><Txt style={[styles.retry,{color:c.accent,opacity:profiles.busy||!profileState?.retry_available?0.45:1}]}>{profiles.busy?'Retrying…':'Try again'}</Txt></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Continue without slide cues" onPress={() => { setPhase('configure'); home.setup.set(withTiming(1,{duration:260})); }}><Txt style={[styles.retry,{color:c.secondary}]}>Continue</Txt></Pressable>
                    </>}
                  </View>
                ))}
              </View>
              {info.imageOnlySlides && pr >= 1 && <Txt style={styles.offline}>Some slides have no text — cues will be thinner.</Txt>}
              {info.textOffline && pr >= 0.66 && <Txt style={styles.offline}>Slide text will be read when the server is reachable.</Txt>}
            </View>
          </>}
          <HintRow gap={6} hints={[{ icon: 'h-dn', text: analyzing ? 'Swipe down to cancel' : 'Swipe down to go back', nudge: 'down' }]} />
      </PanView>
      <ThemeToggle />
      </View>
      {readyDeck && phase === 'configure' && <Enter kind="fade"><PresentationRequirementsEditor deck={readyDeck} initialImport onSaved={finishSetup} onBackPan={pan} /></Enter>}
      {profileRetryAsk && <Dialog title="Retry AI slide analysis?" body="The previous provider request has an uncertain outcome. Retrying may incur another charge." confirm="Retry" onConfirm={() => { const expected=profileRetryAsk;setProfileRetryAsk(null);void profiles.recover(true,expected); }} onCancel={() => setProfileRetryAsk(null)} />}
      </Animated.View>
    </Enter>
  );
}

const styles = createThemedStyles({
  setupBlur: { filter: [{ blur: 18 }] },
  newHeader: { position: 'absolute', top: 205, left: 28, right: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newTitle: { fontFamily: F.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: C.text },
  newLabel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, overflow: 'hidden', fontFamily: F.semibold, fontSize: 13.5, color: C.secondary, backgroundColor: C.surface06 },
  pickArea: { position: 'absolute', left: 0, right: 0, top: 211, alignItems: 'center' },
  pickButton: { width: 260, height: 223 },
  text: { position: 'absolute', left: 28, right: 28, top: 560, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: C.text, textAlign: 'center' },
  sub: { marginTop: 12, fontFamily: F.medium, fontSize: 15, color: C.secondary, textAlign: 'center' },
  limit: { marginTop: 4, fontFamily: F.medium, fontSize: 13.5, color: C.tertiary },
  errorToast:{position:'absolute',left:24,right:24,top:98,minHeight:44,paddingHorizontal:16,paddingVertical:10,borderWidth:1,borderRadius:22,alignItems:'center',justifyContent:'center',zIndex:30},
  errorToastText:{fontFamily:F.semibold,fontSize:14,lineHeight:19,textAlign:'center'},
  ringWrap: { position: 'absolute', left: 0, right: 0, top: 150, alignItems: 'center' },
  progress: { position: 'absolute', left: 28, right: 28, top: 290, alignItems: 'center' },
  file: { fontFamily: F.display, fontSize: 20, lineHeight: 26, color: C.text, maxWidth: 320, textAlign: 'center' },
  stages: { alignSelf: 'stretch', gap: 26, marginTop: 54 },
  stage: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14 },
  stageIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  stageDone: { borderColor: C.good },
  stageFailed:{borderColor:C.bad}, warning:{fontFamily:F.bold,fontSize:20,color:C.bad},
  retry:{fontFamily:F.semibold,fontSize:14,minHeight:44,textAlignVertical:'center',paddingHorizontal:8},
  check: { position: 'absolute', right: -8, bottom: -6 },
  stageLabel: { flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.secondary },
  offline: { marginTop: 10, fontFamily: F.medium, fontSize: 13.5, color: C.tertiary, textAlign: 'center' },
});
