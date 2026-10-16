// OpenAI Codex reliability fixes: docs/ai-collaboration-prompts-iteration-2.md#cue-and-feedback-reliability-october-16-2026
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Glyph } from '../../design/icons';
import { createThemedStyles, useTheme } from '../../design/theme';
import { C, F, TONE } from '../../design/tokens';
import { cueState, type CueCategory, type ProfileState, type SlideCue, type Enrichment } from './slideProfiles';

type RecoveryAction = 'refresh' | 'generate' | 'retry' | 'confirm';
type CueGuidancePanelProps = {
  state: ProfileState | null; slide: number; error: string | null; busy: boolean;
  onRecover: (action: RecoveryAction) => void;
  canPlayback?: boolean; slidePlaying?: boolean; onPlaySlide?: () => void;
  playbackNotice?: string | null; requirementsNotice?: string | null;
};

export function CueGuidancePanel({ state, slide, error, busy, onRecover,
  canPlayback = false, slidePlaying = false, onPlaySlide, playbackNotice, requirementsNotice,
}: CueGuidancePanelProps) {
  const { c } = useTheme();
  const views = { must_cover: cueState(state, slide, 'must_cover'), go_deeper: cueState(state, slide, 'go_deeper') };
  // Loading/failure states apply to the saved set, so present their recovery once.
  // Empty-category messages stay with their own category when the set is ready.
  const common = views.must_cover.message && views.must_cover.message === views.go_deeper.message ? views.must_cover : null;
  const message = busy ? 'Requesting AI cues…' : error || common?.message;
  const action: RecoveryAction | null = error ? 'refresh' : common?.action ?? null;
  const recoveryLabel = action === 'refresh' ? 'Refresh AI cues' : action === 'generate' ? 'Generate AI cues' :
    action === 'confirm' ? 'Confirm AI cue retry' : 'Retry AI cues';
  const playable = canPlayback && !!onPlaySlide;
  return <View style={styles.panel}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>Cues</Text>
      <View style={styles.rule} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${slidePlaying ? 'Pause' : 'Play'} slide ${slide + 1} recording`}
        accessibilityState={{ disabled: !playable }} disabled={!playable} hitSlop={4}
        onPress={onPlaySlide} style={[styles.play, !playable && { opacity: 0.28 }]}>
        <Glyph name={slidePlaying ? 'p-pause' : 'p-play'} size={15} color={slidePlaying ? c.strong : c.secondary} />
      </Pressable>
    </View>
    <View style={styles.categoryLabels}>
      {(['must_cover', 'go_deeper'] as const).map(category => <Text key={category} accessibilityRole="header"
        style={[styles.label, styles.columnLabel, { color: category === 'must_cover' ? c.warn : c.info }]}>
        {category === 'must_cover' ? 'Must Cover' : 'Further Insight'}
      </Text>)}
    </View>
    <ScrollView key={`${state?.description_set_id ?? 'unavailable'}:${slide}`} style={styles.scroll}
      contentContainerStyle={styles.content} showsVerticalScrollIndicator>
      <View style={styles.categories}>
        {(['must_cover', 'go_deeper'] as const).map((category: CueCategory) => <View key={category} style={styles.section}>
          {views[category].cues.map(cue => <CueCard key={`${category}:${cue.text}`} cue={cue} state={state} slide={slide}
            background={category === 'must_cover' ? TONE.warn.bg : TONE.info.bg} />)}
          {!common && !!views[category].message && <Text style={styles.status}>{views[category].message}</Text>}
        </View>)}
      </View>
      {!!requirementsNotice && <Text accessibilityLiveRegion="polite" style={styles.status}>{requirementsNotice}</Text>}
      {!!playbackNotice && <Text accessibilityLiveRegion="polite" style={styles.status}>{playbackNotice}</Text>}
      {!!message && (action ? <Pressable accessibilityRole="button" accessibilityLabel={recoveryLabel}
        disabled={busy} onPress={() => { if (!busy) onRecover(action); }} style={styles.recover}>
        <Text accessibilityLiveRegion="polite" style={styles.status}>{message}
          {!busy && !error ? ' · Tap to ' + (action === 'generate' ? 'generate' : 'retry') : ''}</Text>
      </Pressable> : <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>)}
    </ScrollView>
  </View>;
}

function CueCard({cue,state,slide,background}: {cue:SlideCue | Enrichment;state:ProfileState | null;slide:number;background:string}) {
  const [expanded,setExpanded] = useState(false);
  const current = state?.descriptions?.slides.find(s=>s.slide_index===slide);
  const premises = cue.evidence_refs?.map(ref => {
    if (typeof ref !== 'string') return `Slide ${ref.slide_index+1}: ${ref.quote}`;
    const [collection,index] = ref.split('/');
    const fact = collection === 'summary' ? current?.summary : collection === 'key_ideas' ? current?.key_ideas[Number(index)] : current?.visual_facts[Number(index)];
    return fact?.text ?? '';
  }).filter(Boolean) ?? [];
  return <View style={[styles.cue,{backgroundColor:background}]}>
    <Text style={styles.text}>{cue.text}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Hide cue evidence and details' : 'Show cue evidence and details'}
      accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)}>
      <Text style={styles.detailToggle}>{expanded ? 'Hide details' : 'Details'}</Text>
    </Pressable>
    {expanded && <View>
      {premises.map((p,i)=><Text key={i} style={styles.evidence}>{p}</Text>)}
      {'information_needed' in cue && !!cue.information_needed && <Text style={styles.evidence}>To clarify: {cue.information_needed}</Text>}
    </View>}
  </View>;
}

const styles = createThemedStyles({
  panel: { position: 'absolute', left: 16, right: 16, top: 364, height: 142 },
  heading: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  rule: { flex: 1, height: 1, backgroundColor: C.hair },
  play: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.semibold, fontSize: 12 },
  categoryLabels: { flexDirection: 'row', gap: 10 }, columnLabel: { flex: 1, minWidth: 0 },
  categories: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  scroll: { flex: 1, marginTop: 6 }, content: { gap: 10, paddingTop: 2, paddingBottom: 6 },
  section: { flex: 1, minWidth: 0, gap: 6 },
  cue: { paddingTop: 8, paddingHorizontal: 8, borderRadius: 14 },
  text: { fontFamily: F.semibold, fontSize: 13, lineHeight: 18, color: C.body },
  evidence: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, color: C.secondary, marginBottom: 6 },
  detailToggle: { fontFamily: F.medium, fontSize: 12, color: C.secondary, paddingVertical: 8 },
  status: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: C.secondary },
  recover: { paddingVertical: 8 },
});
