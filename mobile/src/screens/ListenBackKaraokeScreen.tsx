import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView } from '../design/PanView';
import { F, FRAME_W } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt } from '../domain/format';
import { type Line } from '../domain/lines';
import { FILLERS, KO_FILLERS } from '../domain/words';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer, type Segment } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
type AudioPlan = { slide:number; runStart:number; playbackStartMs:number; durationMs:number };

export function ListenBackKaraokeScreen({ active = true }: { active?: boolean }) {
  const { c } = useTheme();
  const frame = useFrame();
  const { go, nav } = useShell();
  const model = useDeckModel(nav.deckId);
  const player = useSegmentPlayer();
  const [selectedSlide, setSelectedSlide] = useState(Math.max(0, nav.sel));
  const [scrub, setScrub] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const run = model?.state.run ?? null;
  const times = useMemo(() => model?.times ?? [], [model?.times]);
  const starts = useMemo(() => times.map((_, i) => times.slice(0, i).reduce((a, b) => a + b, 0)), [times]);
  const lines = model?.lines ?? [];
  const key = `listen:${model?.deck.id ?? ''}`;
  const audio = useMemo(() => {
    const segments: Segment[] = [], plan:AudioPlan[]=[];
    if (!run) return {segments,plan};
    let playbackStartMs=0;
    run.parts.forEach((part,slide) => {
      if (!part) return;
      const uri = audioOf(part.attemptId);
      const slideSegments=uri?part.segments.filter(segment=>segment.endMs>segment.startMs).map(segment=>({uri,...segment})):[];
      const durationMs=slideSegments.reduce((sum,segment)=>sum+segment.endMs-segment.startMs,0);
      if(!slideSegments.length||durationMs<=0)return;
      plan.push({slide,runStart:starts[slide]??0,playbackStartMs,durationMs});
      segments.push(...slideSegments);playbackStartMs+=durationMs;
    });
    return {segments,plan};
  }, [run,starts]);
  const {segments,plan}=audio;
  const playing = active && player.playingKey === key;
  const playedSeconds = playing ? positionOnRun(player.elapsedMs,plan) : starts[selectedSlide] ?? 0;
  const activeSlide = playing ? findSlideAt(playedSeconds, starts, times) : selectedSlide;
  const activeLineIndex = playing ? currentLineIndex(lines, activeSlide, playedSeconds) : Math.max(0, lines.findIndex(line => line.slide === activeSlide));
  const currentLine = lines[activeLineIndex]?.slide === activeSlide ? lines[activeLineIndex] : undefined;
  const currentFillers = currentLine ? fillerIndexes(currentLine.words) : new Set<number>();
  const previousLine = activeLineIndex > 0 ? lines[activeLineIndex - 1] : undefined;
  const nextLine = activeLineIndex >= 0 ? lines[activeLineIndex + 1] : undefined;
  const position = scrub ?? (playing ? playedSeconds : starts[selectedSlide] ?? 0);
  const shownSlide = scrub === null ? activeSlide : findSlideAt(scrub, starts, times);
  const back = () => {
    player.stop();
    if (nav.from === 'wait') go('wait', { deckId: nav.deckId, sel: nav.sel });
    else if (nav.from === 'review') go('review', { deckId: nav.deckId, sel: nav.sel });
    else if (nav.from === 'full') go('full', { deckId: nav.deckId, sel: nav.sel });
    else if (nav.from === 'rehearse') go('rehearse', { nav: null, deckId: nav.deckId, slide: nav.sel });
    else go('home');
  };
  useBack(active, () => { back(); return true; });
  const jump = (delta: number) => {
    const next = clamp((playing ? activeSlide : selectedSlide) + delta, 0, Math.max(0, times.length - 1));
    setSelectedSlide(next);
    setScrub(null);
    if (playing && segments.length) seek(starts[next] ?? 0, false);
  };
  const seek = (seconds: number, paused: boolean) => {
    if (!segments.length) { setNotice('No saved audio is available on this phone.'); return; }
    const slide=findSlideAt(seconds,starts,times),entry=plan.find(item=>item.slide===slide);
    if(!entry){setNotice(`Audio for slide ${slide+1} is not on this phone.`);return;}
    setNotice('');
    setSelectedSlide(slide);
    const elapsed=entry.playbackStartMs+clamp(seconds-entry.runStart,0,entry.durationMs/1000)*1000;
    void player.seekSegments(key, segments, elapsed, paused);
  };
  const toggle = () => {
    if (!segments.length) { setNotice('No saved audio is available on this phone.'); return; }
    if (playing) { player.setPaused(!player.paused); return; }
    seek(starts[selectedSlide] ?? 0, false);
  };
  const scrubAt = (pageX: number) => {
    const x = (pageX - frame.left) / frame.s;
    setScrub(clamp((x - 24) / (FRAME_W - 48), 0, 1) * (model?.total ?? 0));
  };
  const swipeShould = (_e: unknown, g: { dx: number; dy: number }) => (Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy)) || (g.dy > 12 && g.dy > Math.abs(g.dx));
  if (!model || !run) return null;

  return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill}
    onMoveShould={swipeShould}
    onRelease={(_e, g) => { if (g.dy > 90 || g.vy > 0.8) back(); else if (g.dx < -60 || g.vx < -0.6) jump(1); else if (g.dx > 60 || g.vx > 0.6) jump(-1); }}>
    <View style={StyleSheet.absoluteFill}>
      <PageSurface hue={model.deck.hue} />
      <View style={styles.header} pointerEvents="none">
        <Txt numberOfLines={1} style={[styles.title, { color: c.text }]}>Listen back</Txt>
        <Txt style={[styles.subtitle, { color: c.secondary }]}>{`Whole run · ${fmt(model.total)}`}</Txt>
      </View>
      <View style={[styles.slideChip, { backgroundColor: c.surface08 }]}>
        <Txt numberOfLines={1} style={[styles.slideChipText, { color: c.secondary }]}>{`Slide ${shownSlide + 1} · ${model.deck.slides[shownSlide]?.title ?? `Slide ${shownSlide + 1}`}`}</Txt>
      </View>
      {lines.length ? <View style={styles.words}>
        <Txt numberOfLines={2} style={[styles.contextLine, { color: c.tertiary }]}>{previousLine?.text ?? ''}</Txt>
        <View style={styles.currentText} accessibilityLabel={currentLine?.text ?? 'Transcript'}>
          {currentLine ? currentLine.words.map((word, i) => {
            const elapsed = position - currentLine.t;
            const wordStart = currentLine.audio.startMs + elapsed * 1000;
            const highlighted = playing && word.start_ms <= wordStart && word.end_ms >= wordStart;
            const filler = currentFillers.has(i);
            const text = word.text.trim();
            const prefix = i > 0 && !/^[,.;:?!%)\]}]/u.test(text) ? ' ' : '';
            return <Txt key={`${currentLine.key}:${i}`} style={{ color: filler ? c.warn : highlighted ? c.text : c.body,
              fontFamily: highlighted ? F.bold : F.display, textDecorationLine: filler ? 'underline' : 'none' }}>{prefix + text}</Txt>;
          }) : <Txt style={[styles.currentSentence, { color: c.secondary }]}>{playing ? '…' : 'Tap play to listen to your run.'}</Txt>}
        </View>
        <Txt numberOfLines={2} style={[styles.contextLine, { color: c.tertiary }]}>{nextLine?.text ?? ''}</Txt>
      </View> : <View style={styles.noTranscript}><Txt style={[styles.noTranscriptText, { color: c.secondary }]}>{model.pending ? 'Transcript is still processing.' : 'No transcript for this run'}</Txt></View>}
      {!!(notice || player.error) && <Txt accessibilityRole="alert" style={[styles.notice, { color: c.secondary }]}>{notice || player.error}</Txt>}
      <PanView style={styles.scrubberHit} accessibilityRole="adjustable" accessibilityLabel="Run audio position"
        accessibilityValue={{ min: 0, max: model.total, now: position, text: `${fmt(position)} of ${fmt(model.total)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => seek(clamp(position + (e.nativeEvent.actionName === 'increment' ? 5 : -5), 0, model.total), player.paused || !playing)}
        onStartShould={() => segments.length > 0}
        onGrant={e => { player.setPaused(true); scrubAt(e.nativeEvent.pageX); }}
        onMove={e => scrubAt(e.nativeEvent.pageX)}
        onRelease={() => { if (scrub !== null) seek(scrub, false); }}
        onTerminate={() => setScrub(null)}
        onTerminationRequest={() => false}>
        <View style={styles.trackRow}>
          {times.map((t, i) => <View key={i} style={[styles.trackSegment, { flexGrow: Math.max(0.06, t), backgroundColor: c.track }]}>
            {t > 0 && <View style={[styles.trackFill, { width: `${clamp((position - (starts[i] ?? 0)) / t, 0, 1) * 100}%`, backgroundColor: c.strong }]} />}
          </View>)}
          <View pointerEvents="none" style={[styles.playhead, { backgroundColor: c.text, left: `${model.total > 0 ? clamp(position / model.total, 0, 1) * 100 : 0}%` }]} />
        </View>
        <View style={styles.times}><Txt style={[styles.timeText, { color: c.secondary }]}>{fmt(position)}</Txt><Txt style={[styles.timeText, { color: c.secondary }]}>{fmt(model.total)}</Txt></View>
      </PanView>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={() => jump(-1)} style={styles.skip}><Txt style={[styles.skipArrow,{color:c.text}]}>‹</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={playing && !player.paused ? 'Pause whole run' : 'Play whole run'} onPress={toggle} style={[styles.play, { backgroundColor: c.strong }]}>
          <Glyph name={playing && !player.paused ? 'p-pause' : 'p-play'} size={25} color={c.onAccent} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={() => jump(1)} style={styles.skip}><Txt style={[styles.skipArrow,{color:c.text}]}>›</Txt></Pressable>
      </View>
      <HintRow hints={[{ icon: 'h-spin', text: 'Skip a slide' }, { icon: 'h-dn', text: 'Back to review', nudge: 'down' }]} />
    </View>
  </PanView></Enter>;
}

function findSlideAt(seconds: number, starts: readonly number[], times: readonly number[]) {
  for (let i = 0; i < starts.length; i++) if (seconds < (starts[i] ?? 0) + (times[i] ?? 0)) return i;
  return Math.max(0, starts.length - 1);
}
function positionOnRun(elapsedMs:number,plan:readonly AudioPlan[]) {
  for(const entry of plan)if(elapsedMs<entry.playbackStartMs+entry.durationMs)return entry.runStart+Math.max(0,elapsedMs-entry.playbackStartMs)/1000;
  const last=plan[plan.length-1];return last?last.runStart+last.durationMs/1000:0;
}
function currentLineIndex(lines: readonly Line[], slide: number, seconds: number) {
  let found = -1;
  lines.forEach((line, i) => { if (line.slide === slide && line.t <= seconds) found = i; });
  return found;
}
function fillerIndexes(words: Line['words']) {
  const marked = new Set<number>();
  const tokens = words.map(word => word.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, ''));
  for (const filler of [...FILLERS, ...KO_FILLERS]) {
    const parts = filler.toLocaleLowerCase().split(/\s+/u);
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (parts.every((part, offset) => tokens[i + offset] === part)) parts.forEach((_, offset) => marked.add(i + offset));
    }
  }
  return marked;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 46, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 23 }, subtitle: { fontFamily: F.medium, fontSize: 14, lineHeight: 18 },
  slideChip: { position: 'absolute', top: 132, left: 24, right: 24, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  slideChipText: { fontFamily: F.semibold, fontSize: 13.5 },
  words: { position: 'absolute', top: 202, left: 28, right: 28, height: 300, justifyContent: 'space-between' },
  contextLine: { minHeight: 44, fontFamily: F.medium, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  currentText: { minHeight: 132, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 2 },
  currentSentence: { fontFamily: F.display, fontSize: 28, lineHeight: 36, textAlign: 'center' },
  noTranscript: { position: 'absolute', top: 270, left: 32, right: 32, minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  noTranscriptText: { fontFamily: F.medium, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  notice: { position: 'absolute', left: 24, right: 24, top: 514, minHeight: 34, fontFamily: F.medium, fontSize: 13.5, textAlign: 'center' },
  scrubberHit: { position: 'absolute', left: 24, right: 24, top: 552, height: 60, justifyContent: 'center', gap: 9 },
  trackRow: { height: 12, flexDirection: 'row', gap: 3, alignItems: 'center', position: 'relative' },
  trackSegment: { flex: 1, minWidth: 2, height: 5, borderRadius: 3, overflow: 'hidden' }, trackFill: { height: 5, borderRadius: 3 },
  playhead: { position: 'absolute', top: -2, width: 3, height: 12, borderRadius: 2, transform: [{ translateX: -1.5 }] },
  times: { flexDirection: 'row', justifyContent: 'space-between' }, timeText: { fontFamily: F.semibold, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  controls: { position: 'absolute', left: 0, right: 0, top: 610, height: 58, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 32 },
  skip: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, skipArrow:{fontFamily:F.display,fontSize:38,lineHeight:44},
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
