import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PanView } from '../../design/PanView';
import { Txt, useFrame } from '../../design/frame';
import { createThemedStyles, useTheme } from '../../design/theme';
import { C, F } from '../../design/tokens';
import { cueState, type CueCategory, type ProfileState, type SlideCue, type Enrichment } from './slideProfiles';

type RecoveryAction = 'refresh' | 'generate' | 'retry' | 'confirm';
type Props = {
  state: ProfileState | null; slide: number; error: string | null; busy: boolean;
  onRecover: (action: RecoveryAction) => void;
  onSheetOpenChange?: (open: boolean) => void;
  playbackNotice?: string | null; requirementsNotice?: string | null;
};
export function CueGuidancePanel({ state, slide, error, busy, onRecover,
  playbackNotice, requirementsNotice, onSheetOpenChange }: Props) {
  const { c } = useTheme();
  const frame = useFrame();
  const panelTop = frame.compact ? 320 : 372;
  const panelHeight = 134;
  const [sheet, setSheet] = useState<CueCategory | null>(null);
  const views = { must_cover: cueState(state, slide, 'must_cover'), go_deeper: cueState(state, slide, 'go_deeper') };
  const common = views.must_cover.message && views.must_cover.message === views.go_deeper.message ? views.must_cover : null;
  const message = busy ? 'Requesting AI cues…' : error || common?.message;
  const action: RecoveryAction | null = error ? 'refresh' : common?.action ?? null;
  const labels: Record<CueCategory, string> = { must_cover: 'Must cover', go_deeper: 'Further insight' };
  const names: CueCategory[] = ['must_cover', 'go_deeper'];
  const sheetItems = sheet ? views[sheet].cues : [];
  const closeSheet = () => { setSheet(null); onSheetOpenChange?.(false); };
  return <View style={[styles.panel, { top: panelTop }]}>
    <View style={styles.heading}><Txt style={styles.sectionTitle}>CUES</Txt><View style={styles.rule} /></View>
    <View style={styles.cards}>
      {names.map(category => {
        const data = views[category], cue = data.cues[0], count = data.cues.length;
        const empty = !cue;
        const label = cue ? shortCueLabel(cue.text) : data.message || (state?.state === 'completed' ? 'Nothing extra here' : 'Cues are on the way');
        return <Pressable key={category} accessibilityRole="button"
          accessibilityLabel={`Open ${labels[category]} cues`}
          onPress={() => { setSheet(category); onSheetOpenChange?.(true); }} style={[styles.card, { borderColor: c.hair, backgroundColor: c.surface06, opacity: empty ? 0.8 : 1 }]}>
          <View style={styles.cardTitle}><Txt style={[styles.kind, { color: category === 'must_cover' ? c.accent : c.muted }]}>{labels[category]}</Txt><Txt style={{ color: c.muted, fontSize: 18 }}>›</Txt></View>
          <Txt numberOfLines={2} style={styles.cardLabel}>{label}</Txt>
          <Txt style={styles.more}>{count > 1 ? `+${count - 1} more` : count === 1 ? 'Tap for detail' : ''}</Txt>
        </Pressable>;
      })}
    </View>
    {!!(message && !common?.message || requirementsNotice || playbackNotice) && <Pressable accessibilityRole={action ? 'button' : undefined}
      onPress={action ? () => onRecover(action) : undefined} style={styles.statusWrap}>
      <Txt numberOfLines={1} style={styles.status}>{message || requirementsNotice || playbackNotice}</Txt>
    </Pressable>}
    {sheet && <View style={[styles.sheetLayer, { top: -panelTop, bottom: -(frame.height - panelTop - panelHeight) }]}>
      <Pressable accessibilityLabel="Close cue sheet" onPress={closeSheet} style={[styles.scrim, { backgroundColor: c.scrim }]} />
      <PanView style={[styles.sheet, { backgroundColor: c.dialog, borderColor: c.line }]}
        onMoveShould={(_e, g) => g.dy > 8 && g.dy > Math.abs(g.dx)}
        onMove={() => undefined}
        onRelease={(_e, g) => { if (g.dy > 90) closeSheet(); }}>
        <View style={[styles.handle, { backgroundColor: c.muted2 }]} />
        <View style={styles.sheetHeader}><Txt style={[styles.sheetTitle, { color: sheet === 'must_cover' ? c.accent : c.text }]}>{labels[sheet]}</Txt>
          <Txt numberOfLines={1} style={styles.context}>Slide {slide + 1}</Txt></View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetItems}>
          {sheetItems.length ? sheetItems.map((item, index) => <CueDetail key={`${sheet}-${index}`} cue={item} />)
            : <Txt style={styles.emptySheet}>{views[sheet].message || 'Cues are not available yet. Try again when the server is reachable.'}</Txt>}
        </ScrollView>
        <Txt style={styles.closeHint}>↓ Swipe down to close</Txt>
      </PanView>
    </View>}
  </View>;
}
function CueDetail({ cue }: { cue: SlideCue | Enrichment }) {
  const { c } = useTheme();
  const details = 'supporting_detail' in cue && typeof cue.supporting_detail === 'string' ? cue.supporting_detail : '';
  return <View style={styles.detail}>
    <View style={[styles.bullet, { backgroundColor: c.accent }]} />
    <View style={styles.detailText}><Txt style={styles.detailTitle}>{cue.text}</Txt>
      {!!details && <Txt style={styles.detailBody}>{details}</Txt>}
      {'information_needed' in cue && !!cue.information_needed && <Txt style={styles.detailBody}>To clarify: {cue.information_needed}</Txt>}
    </View>
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
  heading: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: F.bold, fontSize: 13.5, color: C.secondary, letterSpacing: 0.6 },
  rule: { flex: 1, height: 1, backgroundColor: C.hair },
  cards: { flexDirection: 'row', gap: 10, marginTop: 0 },
  card: { flex: 1, height: 114, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 9 },
  cardTitle: { height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 18 },
  cardLabel: { marginTop: 5, fontFamily: F.semibold, fontSize: 16, lineHeight: 20, color: C.text, flex: 1 },
  more: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 17, color: C.secondary },
  statusWrap: { position: 'absolute', left: 0, right: 0, top: 118, minHeight: 32, justifyContent: 'center' },
  status: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 18, color: C.secondary },
  sheetLayer: { position: 'absolute', top: -372, right: -16, bottom: -844, left: -16, zIndex: 50, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { minHeight: 348, maxHeight: 644, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24, borderTopWidth: 1, borderColor: C.line, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', opacity: 0.45 },
  sheetHeader: { marginTop: 18, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { fontFamily: F.display, fontSize: 22, lineHeight: 27 },
  context: { flex: 1, textAlign: 'right', fontFamily: F.medium, fontSize: 13.5, color: C.secondary },
  sheetScroll: { marginTop: 26 },
  sheetItems: { gap: 20, paddingBottom: 24 },
  emptySheet: { fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: C.secondary },
  detail: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  detailText: { flex: 1, gap: 6 },
  detailTitle: { fontFamily: F.bold, fontSize: 17, lineHeight: 23, color: C.text },
  detailBody: { fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.secondary },
  closeHint: { textAlign: 'center', fontFamily: F.medium, fontSize: 14.5, color: C.secondary },
});
