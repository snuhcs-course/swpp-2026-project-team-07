// AI-generated with OpenAI Codex, Iteration 2 (2026-10-15).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration-prompts-iteration-2.md#finger-linked-page-fade-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, type KeyboardEvent } from 'react-native';
import { Txt, useFrame } from '../design/frame';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, F, FRAME_H } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { HintRow, RecordButton } from '../design/ui';
import { fmt } from '../domain/format';
import type { Presentation } from '../features/presentations/store';
import { validateRequirementValues } from '../domain/presentationRequirements';
import { API_URL } from '../services/api';
import { readStored } from '../services/storage';
import { normalizeApi } from '../features/transcription/analysisStorage';
import { readRequirements, getRequirementsVersion, subscribeRequirements } from '../features/presentations/requirementsStore';
import { createPresentationContextClient } from '../features/presentations/contextClient';
import { confirmRequirements, readRequirementsDraft, synchronizeRequirements, acceptServerRequirements, keepLocalRequirements, type RequirementValues } from '../features/presentations/requirementsDraft';

const MIN = 60;
const MAX = 1800;
const STEP = 30;
const LEFT = 42;
const WIDTH = 306;
const AUDIENCES = ['Students', 'Teachers', 'Colleagues', 'Clients', 'General audience'] as const;

export function PresentationSetup({ deck, error, initialValues = { requiredDurationSeconds: 300, audience: 'General audience' }, onConfirm, onBackPan, onChange, recovery, disabled = false }: {
  deck: Presentation; error: string; initialValues?: RequirementValues; onConfirm: (seconds: number | null, audience: string) => void; onBackPan: PanHandlers;
  onChange?: () => void; recovery?: ReactNode; disabled?: boolean;
}) {
  const frame = useFrame();
  const { c } = useTheme();
  const [target, setTarget] = useState(initialValues.requiredDurationSeconds ?? 300);
  const [required, setRequired] = useState(initialValues.requiredDurationSeconds !== null);
  const [audience, setAudience] = useState(initialValues.audience);
  const [custom, setCustom] = useState(!!initialValues.audience && !AUDIENCES.some(v => v === initialValues.audience));
  const [validation, setValidation] = useState('');
  const scroll = useRef<ScrollView>(null);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() => Keyboard.metrics()?.screenY ?? null);
  useEffect(() => {
    const show = (event: KeyboardEvent) => setKeyboardTop(event.endCoordinates.screenY);
    const showing = Keyboard.addListener('keyboardDidShow', show);
    const changing = Keyboard.addListener('keyboardDidChangeFrame', show);
    const hiding = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => { showing.remove(); changing.remove(); hiding.remove(); };
  }, []);
  // Frame.top is the physical top after its centered scale transform. Convert the
  // keyboard's physical screen coordinate into this 390 × 844 stage's units.
  const viewportHeight = keyboardTop === null ? FRAME_H : Math.max(0, Math.min(FRAME_H, (keyboardTop - frame.top - 12) / frame.s));
  useEffect(() => {
    scroll.current?.scrollTo({ y: keyboardTop !== null && custom ? 344 : 0, animated: false });
  }, [keyboardTop, custom, viewportHeight]);
  const change = () => { onChange?.(); setValidation(''); };
  const confirm = () => {
    try { validateRequirementValues(required ? target : null, audience); onConfirm(required ? target : null, audience); }
    catch { setValidation('Use a time from 1–30 minutes and an audience of at most 500 characters.'); }
  };
  const selectAt = (pageX: number) => {
    const x = Math.max(0, Math.min(WIDTH, (pageX - frame.left) / frame.s - LEFT));
    change(); setRequired(true);
    setTarget(Math.max(MIN, Math.min(MAX, MIN + Math.round((x / WIDTH) * (MAX - MIN) / STEP) * STEP)));
  };
  const markerX = LEFT + (target - MIN) / (MAX - MIN) * WIDTH;
  const ticks = Array.from({ length: 59 }, (_, i) => {
    const minute = i / 2 + 1;
    const x = i / 58 * WIDTH;
    const major = Number.isInteger(minute) && minute % 5 === 0;
    return <View key={i} style={{ position: 'absolute', left: x - (major ? 1.25 : 0.8), top: major ? 0 : 5,
      width: major ? 2.5 : 1.6, height: major ? 23 : 13, borderRadius: 2,
      backgroundColor: Math.abs(minute - target / 60) < 0.25 ? c.text : c.secondary, opacity: major ? 0.75 : 0.36 }} />;
  });
  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal importantForAccessibility="yes">
    <PanView style={StyleSheet.absoluteFill} {...onBackPan}>
      <ScrollView ref={scroll} accessibilityLabel="Presentation setup choices" style={[styles.viewport, { height: viewportHeight }]}
        contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" showsVerticalScrollIndicator>
      <View style={styles.headerBlock}>
      <View style={styles.heading} pointerEvents="none">
        <Txt numberOfLines={1} style={styles.deckTitle}>{deck.title}</Txt>
        <Txt style={styles.slideCount}>{deck.pageCount} slides</Txt>
      </View>
      <View style={styles.timeArea} pointerEvents="none">
        <Txt style={styles.question}>How long is your presentation?</Txt>
        <Txt style={styles.time}>{required ? fmt(target) : 'No time limit'}</Txt>
      </View>
      <PanView style={styles.sliderTouch} accessibilityRole="adjustable" accessibilityLabel="Time of entire presentation"
        accessibilityValue={{ min: 1, max: 30, now: target / 60, text: fmt(target) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => { change(); setRequired(true); setTarget(v => Math.max(MIN, Math.min(MAX, v + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP)))); }}
        onStartShould={() => true} onGrant={e => selectAt(e.nativeEvent.pageX)} onMove={e => selectAt(e.nativeEvent.pageX)}
        onTerminationRequest={() => false}>
        <View style={styles.ticks} pointerEvents="none">{ticks}<View style={[styles.marker, { left: markerX - LEFT - 1.5, backgroundColor: c.text }]} /></View>
      </PanView>
      <View style={styles.labels} pointerEvents="none">{[5, 10, 15, 20, 25, 30].map(m =>
        <Txt key={m} style={[styles.tickLabel, { left: LEFT + (m - 1) / 29 * WIDTH - 14 }]}>{m}</Txt>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear required presentation time" onPress={() => { change(); setRequired(false); }} style={styles.clearTime}><Txt style={styles.optional}>No required time</Txt></Pressable>
      </View>
      <View style={styles.audienceArea}>
        <Txt style={styles.audienceTitle}>Do you have a target audience?</Txt>

        <View style={styles.chips}>{AUDIENCES.map(value => {
          const selected = audience === value;
          return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }}
            onPress={() => { change(); setAudience(selected ? '' : value); setCustom(false); }} style={[styles.chip, {
              backgroundColor: selected ? c.surface12 : c.surface08,
              borderColor: selected ? c.text : c.border14,
            }]}><Txt style={[styles.chipText, { color: c.text }]}>{value}</Txt></Pressable>;
        })}
          <Pressable accessibilityRole="button" accessibilityLabel="Other audience" onPress={() => { change(); setCustom(true); if (AUDIENCES.some(v => v === audience)) setAudience(''); }} style={[styles.chip, { borderColor: custom ? c.text : c.border14 }]}><Txt style={[styles.chipText, { color: c.text }]}>Other…</Txt></Pressable>
        </View>
        {custom && <><TextInput accessibilityLabel="Target audience" multiline value={audience} onFocus={() => scroll.current?.scrollTo({ y: 344, animated: true })} onChangeText={value => { change(); setAudience(value); }} style={[styles.input, { color: c.text, borderColor: c.border14 }]} placeholder="Describe your audience" placeholderTextColor={c.secondary} />
          <View style={styles.inputFooter}>{keyboardTop !== null && <Pressable accessibilityRole="button" accessibilityLabel="Hide audience keyboard" onPress={() => Keyboard.dismiss()} style={styles.done}><Txt style={[styles.chipText, { color: c.text }]}>Done</Txt></Pressable>}<Txt style={styles.counter}>{[...audience].length}/500</Txt></View></>}
        <Pressable accessibilityRole="button" accessibilityLabel="Clear target audience" onPress={() => { change(); setAudience(''); setCustom(false); }}><Txt style={styles.optional}>No target audience</Txt></Pressable>
      </View>
      {!!(validation || error || recovery) && <View style={styles.feedback}>
        {!!(validation || error) && <Txt accessibilityRole="alert" style={styles.error}>{validation || error}</Txt>}
        {recovery && <View style={styles.recovery}>{recovery}</View>}
      </View>}
      <View style={styles.saveSlot}>
        <View pointerEvents="none" style={[styles.confirmRing, { borderColor: c.border14 }]} />
        <RecordButton green glyph="check" label="Save presentation time and audience" onPress={confirm} disabled={disabled} style={styles.confirm} />
      </View>
      </ScrollView>
      {keyboardTop === null && <HintRow gap={18} hints={[{ icon: 'h-spin', text: 'Drag to set the time' }, { icon: 'h-dn', text: 'Swipe down to go back', nudge: 'down' }]} />}
    </PanView>
  </View>;
}

const styles = createThemedStyles({
  viewport: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { minHeight: FRAME_H, paddingBottom: 99 },
  headerBlock: { height: 360 },
  feedback: { marginTop: 12, gap: 12 },
  saveSlot: { height: 136, marginTop: 'auto' },
  inputFooter: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  done: { marginRight: 'auto', minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  recoveryText: { fontFamily: F.semibold, fontSize: 13, color: C.text },
  clearTime: { position: 'absolute', top: 310, left: 100, right: 100, alignItems: 'center', minHeight: 40 },
  input: { borderWidth: 1, borderRadius: 12, width: '100%', minHeight: 60, maxHeight: 75, padding: 8, fontFamily: F.medium, fontSize: 13, marginTop: 10 },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: C.secondary },
  recovery: { marginHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 12 },
  heading: { position: 'absolute', left: 22, right: 22, top: 50, alignItems: 'center' },
  deckTitle: { fontFamily: F.display, fontSize: 27, lineHeight: 32, color: C.text, textAlign: 'center' },
  slideCount: { fontFamily: F.medium, fontSize: 15, color: C.secondary, marginTop: 2 },
  timeArea: { position: 'absolute', left: 20, right: 20, top: 125, alignItems: 'center' },
  question: { fontFamily: F.display, fontSize: 23, lineHeight: 30, color: C.text, textAlign: 'center' },
  time: { fontFamily: F.displayHeavy, fontSize: 45, lineHeight: 60, color: C.text, fontVariant: ['tabular-nums'], marginTop: 11 },
  sliderTouch: { position: 'absolute', left: LEFT, top: 235, width: WIDTH, height: 48 },
  ticks: { position: 'absolute', left: 0, top: 8, width: WIDTH, height: 32 },
  marker: { position: 'absolute', top: -6, width: 3, height: 35, borderRadius: 2 },
  labels: { position: 'absolute', left: 0, right: 0, top: 277 },
  tickLabel: { position: 'absolute', width: 28, fontFamily: F.bold, fontSize: 11, textAlign: 'center', color: C.tertiary },
  audienceArea: { marginHorizontal: 22, alignItems: 'center' },
  audienceTitle: { fontFamily: F.display, fontSize: 23, lineHeight: 30, color: C.text, textAlign: 'center' },
  optional: { marginTop: 7, fontFamily: F.medium, fontSize: 14, color: C.secondary },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: F.semibold, fontSize: 13 },
  error: { marginHorizontal: 25, textAlign: 'center', fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: C.bad },
  confirmRing: { position: 'absolute', left: 139, top: 24, width: 112, height: 112, borderRadius: 56, borderWidth: 4 },
  confirm: { top: 38 },
});

/** The same editor is used after import and over the idle rehearsal page. */
export function PresentationRequirementsEditor({ deck, initialImport = false, onSaved, onBackPan, active = true }: {
  deck: Presentation; initialImport?: boolean; onSaved: () => void; onBackPan: PanHandlers; active?: boolean;
}) {
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const { c } = useTheme();
  const [base, setBase] = useState(() => readRequirements(deck.id, API_URL));
  const [error, setError] = useState('');
  const touched = useRef(false);
  const pending = readRequirementsDraft(deck.id, API_URL);
  useEffect(() => {
    if (!active || !base.contextId) return;
    let disposed = false;
    void createPresentationContextClient(API_URL).refresh(deck.id).then(value => {
      if (!disposed && !touched.current) setBase(value);
    }).catch(() => { /* Cached choices remain editable; Save performs a fresh preflight. */ });
    return () => { disposed = true; };
  }, [active, base.contextId, deck.id]);
  const sync = () => {
    const serverId = readStored<string>(`server-deck:${normalizeApi(API_URL)}:${deck.id}`);
    if (serverId) void synchronizeRequirements(deck.id, serverId, API_URL);
  };
  const save = (requiredDurationSeconds: number | null, audience: string) => {
    if (!active) return;
    try { confirmRequirements(deck.id, API_URL, { requiredDurationSeconds, audience }, base); sync(); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save presentation choices.'); }
  };
  const initialValues = pending?.desired ?? (initialImport && !base.contextId
    ? { requiredDurationSeconds: 300, audience: 'General audience' } : base);
  return <PresentationSetup key={`${base.contextId}:${base.revision}`} deck={deck} initialValues={initialValues}
    error={error || (pending?.conflict ? pending.error : pending ? 'Saved on phone · sync pending' : '')}
    onChange={() => { touched.current = true; }} onConfirm={save} onBackPan={onBackPan} disabled={!!pending?.conflict || !active}
    recovery={pending?.conflict ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Use server presentation choices" onPress={() => { acceptServerRequirements(deck.id, API_URL); onSaved(); }}><Txt style={[styles.recoveryText, { color: c.text }]}>Use server</Txt></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Keep my presentation choices" onPress={() => { keepLocalRequirements(deck.id, API_URL); sync(); onSaved(); }}><Txt style={[styles.recoveryText, { color: c.text }]}>Keep mine</Txt></Pressable>
    </> : undefined} />;
}
