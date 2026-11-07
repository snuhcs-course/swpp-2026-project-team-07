// AI-generated with OpenAI Codex, Iteration 2 (2026-10-15).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration-prompts-iteration-2.md#finger-linked-page-fade-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, type KeyboardEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line } from 'react-native-svg';
import { Txt, useFrame } from '../design/frame';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, F, FRAME_H } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { HintRow, RecordButton } from '../design/ui';
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
const DIAL_SIZE = 240;
const LEFT = (390 - DIAL_SIZE) / 2;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 112;
const AUDIENCES = ['Students', 'Teachers', 'Colleagues', 'Clients', 'General public', 'Not sure'] as const;

export function PresentationSetup({ deck, error, initialValues = { requiredDurationSeconds: 600, audience: '' }, onConfirm, onBackPan, onChange, recovery, disabled = false }: {
  deck: Presentation; error: string; initialValues?: RequirementValues; onConfirm: (seconds: number | null, audience: string) => void; onBackPan: PanHandlers;
  onChange?: () => void; recovery?: ReactNode; disabled?: boolean;
}) {
  const frame = useFrame();
  const { c } = useTheme();
  const [target, setTarget] = useState(initialValues.requiredDurationSeconds ?? 600);
  const [required, setRequired] = useState(initialValues.requiredDurationSeconds !== null);
  const [audience, setAudience] = useState(initialValues.audience);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const longPressed = useRef(false);
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
    if (keyboardTop !== null && customOpen) scroll.current?.scrollTo({ y: 300, animated: false });
  }, [keyboardTop, customOpen, viewportHeight]);
  const change = () => { onChange?.(); setValidation(''); };
  const confirm = () => {
    try { validateRequirementValues(required ? target : null, audience); onConfirm(required ? target : null, audience); }
    catch { setValidation('Use a time from 1–30 minutes and an audience of at most 500 characters.'); }
  };
  const dialValue = Math.max(1, Math.round(target / 60));
  const arcLength = 2 * Math.PI * DIAL_RADIUS;
  const knobAngle = ((dialValue - 1) / 30) * Math.PI * 2 - Math.PI / 2;
  const knobX = DIAL_CENTER + Math.cos(knobAngle) * DIAL_RADIUS;
  const knobY = DIAL_CENTER + Math.sin(knobAngle) * DIAL_RADIUS;
  const selectAt = (pageX: number, pageY: number) => {
    const x = (pageX - frame.left) / frame.s - (LEFT + DIAL_CENTER);
    const y = (pageY - frame.top) / frame.s - 170 - DIAL_CENTER;
    const angle = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const next = Math.max(1, Math.min(30, Math.round(angle / (Math.PI * 2) * 30) + 1));
    change(); setRequired(true);
    setTarget(previous => { if (Math.round(previous / 60) !== next) void Haptics.selectionAsync().catch(() => undefined); return next * 60; });
  };
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
        <Txt style={styles.time}>{required ? dialValue : '10'}</Txt>
        <Txt style={styles.minutes}>minutes</Txt>
      </View>
      <PanView style={styles.sliderTouch} accessibilityRole="adjustable" accessibilityLabel="Time of entire presentation"
        accessibilityValue={{ min: 1, max: 30, now: dialValue, text: `${dialValue} minutes` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'clear', label: 'Clear required presentation time' }]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'clear') { change(); setRequired(false); return; }
          change(); setRequired(true); setTarget(v => Math.max(MIN, Math.min(MAX, v + (e.nativeEvent.actionName === 'increment' ? 60 : -60))));
        }}
        onStartShould={() => true} onGrant={e => selectAt(e.nativeEvent.pageX, e.nativeEvent.pageY)} onMove={e => selectAt(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onTerminationRequest={() => false}>
        <Svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
          <Circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={DIAL_RADIUS} fill="none" stroke={c.track} strokeWidth={6} />
          <Circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={DIAL_RADIUS} fill="none" stroke={c.accent} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${arcLength}`} strokeDashoffset={arcLength * (1 - dialValue / 30)} transform={`rotate(-90 ${DIAL_CENTER} ${DIAL_CENTER})`} />
          {Array.from({ length: 60 }, (_, i) => {
            const angle = i / 60 * Math.PI * 2 - Math.PI / 2;
            const major = i % 5 === 0;
            const r1 = major ? 88 : 96;
            return <Line key={i} x1={DIAL_CENTER + Math.cos(angle) * r1} y1={DIAL_CENTER + Math.sin(angle) * r1}
              x2={DIAL_CENTER + Math.cos(angle) * 104} y2={DIAL_CENTER + Math.sin(angle) * 104}
              stroke={major ? c.muted : c.muted2} strokeWidth={major ? 2 : 1.5} strokeLinecap="round" />;
          })}
          <Circle cx={knobX} cy={knobY} r={15} fill={c.text} />
        </Svg>
      </PanView>
      </View>
      <View style={styles.audienceArea}>
        <Txt style={styles.audienceTitle}>Who’s listening?</Txt>

        <View style={styles.chips}>{AUDIENCES.map(value => {
          const customAudience = !!audience && audience !== 'General audience' && !AUDIENCES.some(v => v === audience);
          const selected = value === 'Not sure' ? audience === 'General audience' || customAudience : audience === value;
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={value==='Not sure'?'Not sure. Long press to edit a custom audience.':value}
            accessibilityState={{ selected }} onLongPress={value==='Not sure'?()=>{longPressed.current=true;setCustomDraft(customAudience?audience:'');setCustomOpen(true);}:undefined}
            onPress={() => {if(longPressed.current){longPressed.current=false;return;}change(); setAudience(selected ? '' : value === 'Not sure' ? 'General audience' : value); }} style={[styles.chip, {
              backgroundColor: selected ? c.text : c.raised,
              borderColor: selected ? c.text : c.line,
          }]}><Txt style={[styles.chipText, { color: selected ? c.onAccent : c.text }]}>{value}</Txt></Pressable>;
        })}
        </View>
      </View>
      {!!(validation || error || recovery) && <View style={styles.feedback}>
        {!!(validation || error) && <Txt accessibilityRole="alert" style={styles.error}>{validation || error}</Txt>}
        {recovery && <View style={styles.recovery}>{recovery}</View>}
      </View>}
      <View style={[styles.saveSlot, frame.compact && { top: 610 }]}>
        <RecordButton green glyph="check" label="Save presentation time and audience" onPress={confirm} disabled={disabled} style={styles.confirm} />
      </View>
      </ScrollView>
      {keyboardTop === null && <HintRow gap={18} hints={[{ icon: 'h-spin', text: 'Turn the dial' }, { icon: 'h-dn', text: 'Back', nudge: 'down' }]} />}
      {customOpen&&<View style={styles.customOverlay}>
        <Pressable accessibilityLabel="Close custom audience editor" onPress={()=>{Keyboard.dismiss();setCustomOpen(false);}} style={[StyleSheet.absoluteFill,{backgroundColor:c.scrim}]} />
        <View style={[styles.customPanel,{backgroundColor:c.dialog,borderColor:c.hair}]} accessibilityViewIsModal>
          <Txt style={[styles.customTitle,{color:c.text}]}>Custom audience</Txt>
          <TextInput accessibilityLabel="Target audience" multiline maxLength={500} value={customDraft} onChangeText={setCustomDraft}
            style={[styles.input,{color:c.text,borderColor:c.border14}]} placeholder="Describe your audience" placeholderTextColor={c.secondary}/>
          <View style={styles.customActions}>
            <Txt style={styles.counter}>{[...customDraft].length}/500</Txt>
            <Pressable accessibilityRole="button" onPress={()=>{Keyboard.dismiss();setCustomOpen(false);}}><Txt style={[styles.actionText,{color:c.secondary}]}>Cancel</Txt></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>{change();setAudience(customDraft.trim());Keyboard.dismiss();setCustomOpen(false);}}><Txt style={[styles.actionText,{color:c.accent}]}>Save</Txt></Pressable>
          </View>
        </View>
      </View>}
    </PanView>
  </View>;
}

const styles = createThemedStyles({
  viewport: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { minHeight: FRAME_H, paddingBottom: 99 },
  headerBlock: { height: 360 },
  feedback: { marginTop: 12, gap: 12 },
  saveSlot: { position: 'absolute', left: 0, right: 0, top: 674, height: 84 },
  customOverlay:{...StyleSheet.absoluteFill,zIndex:60,justifyContent:'center',paddingHorizontal:24},
  customPanel:{borderWidth:1,borderRadius:22,padding:18,gap:12},
  customTitle:{fontFamily:F.display,fontSize:20,lineHeight:25},
  customActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:20,minHeight:36},
  actionText:{fontFamily:F.semibold,fontSize:14},
  recoveryText: { fontFamily: F.semibold, fontSize: 13.5, color: C.text },
  input: { borderWidth: 1, borderRadius: 12, width: '100%', minHeight: 60, maxHeight: 75, padding: 8, fontFamily: F.medium, fontSize: 15, marginTop: 10 },
  counter: { alignSelf: 'flex-end', fontSize: 13.5, color: C.secondary },
  recovery: { marginHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, rowGap: 12 },
  heading: { position: 'absolute', left: 40, right: 40, top: 46, alignItems: 'center' },
  deckTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 22, color: C.text, textAlign: 'center' },
  slideCount: { fontFamily: F.medium, fontSize: 14.5, color: C.secondary, marginTop: 3 },
  timeArea: { position: 'absolute', left: 20, right: 20, top: 262, alignItems: 'center' },
  time: { fontFamily: F.display, fontSize: 64, lineHeight: 66, color: C.text, fontVariant: ['tabular-nums'] },
  minutes: { fontFamily: F.medium, fontSize: 14.5, lineHeight: 19, color: C.secondary },
  sliderTouch: { position: 'absolute', left: LEFT, top: 170, width: DIAL_SIZE, height: DIAL_SIZE, alignItems: 'center', justifyContent: 'center' },
  audienceArea: { position: 'absolute', top: 478, left: 24, right: 24, alignItems: 'center' },
  audienceTitle: { alignSelf: 'flex-start', fontFamily: F.bold, fontSize: 17, lineHeight: 23, color: C.text },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { minHeight: 34, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: F.semibold, fontSize: 14.5, lineHeight: 20 },
  error: { marginHorizontal: 25, textAlign: 'center', fontFamily: F.medium, fontSize: 13.5, lineHeight: 18, color: C.bad },
  confirm: { top: 0 },
});

/** The same editor is used after import and over the idle rehearsal page. */
export function PresentationRequirementsEditor({ deck, initialImport = false, onSaved, onBackPan, active = true }: {
  deck: Presentation; initialImport?: boolean; onSaved: () => void; onBackPan: PanHandlers; active?: boolean;
}) {
  const requirementsVersion = useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const { c } = useTheme();
  const [base, setBase] = useState(() => readRequirements(deck.id, API_URL));
  const [error, setError] = useState('');
  const touched = useRef(false);
  const pending = readRequirementsDraft(deck.id, API_URL);
  useEffect(() => {
    if (active && !touched.current) setBase(readRequirements(deck.id, API_URL));
  }, [active, deck.id, requirementsVersion]);
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
  // Reserving a context ID does not mean its untouched requirements have been initialized.
  const initialValues = pending?.desired ?? (initialImport && base.revision === 0 &&
    base.requiredDurationSeconds === null && !base.audience.trim()
    ? { requiredDurationSeconds: 600, audience: '' } : base);
  return <PresentationSetup key={`${base.contextId}:${base.revision}`} deck={deck} initialValues={initialValues}
    error={error || (pending?.conflict ? pending.error : pending ? 'Saved on phone · sync pending' : '')}
    onChange={() => { touched.current = true; }} onConfirm={save} onBackPan={onBackPan} disabled={!!pending?.conflict || !active}
    recovery={pending?.conflict ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Use server presentation choices" onPress={() => { acceptServerRequirements(deck.id, API_URL); onSaved(); }}><Txt style={[styles.recoveryText, { color: c.text }]}>Use server</Txt></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Keep my presentation choices" onPress={() => { keepLocalRequirements(deck.id, API_URL); sync(); onSaved(); }}><Txt style={[styles.recoveryText, { color: c.text }]}>Keep mine</Txt></Pressable>
    </> : undefined} />;
}
