import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView } from '../design/PanView';
import { EASE_SCREEN, F, FRAME_W } from '../design/tokens';
import { BACK_FADE_Y } from '../domain/gestures';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt } from '../domain/format';
import { type Line } from '../domain/lines';
import { listenEntryAt, listenTimeline, type ListenVisit } from '../domain/listenTimeline';
import { FILLERS, KO_FILLERS } from '../domain/words';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer, type Segment } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';
import { useHorizontalSwipeMotion } from './swipeMotion';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
type AudioPlan = ListenVisit & { playbackStartMs: number };

export function ListenBackKaraokeScreen({ active = true }: { active?: boolean }) {
  const { c } = useTheme();
  const frame = useFrame();
  const { go, nav } = useShell();
  // OpenAI Codex, 2026-11-19: let the review beneath show through a downward swipe.
  const fadeY = useSharedValue(0);
  const swipe = useHorizontalSwipeMotion();
  const swipeFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - fadeY.value / BACK_FADE_Y) }));
  const model = useDeckModel(nav.deckId);
  const player = useSegmentPlayer();
  const [selectedSlide, setSelectedSlide] = useState(Math.max(0, nav.sel));
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const run = model?.state.run ?? null;
  const times = useMemo(() => model?.times ?? [], [model?.times]);
  const timeline = useMemo(() => listenTimeline(run, times, model?.lines ?? []), [run, times, model?.lines]);
  const { chapters, lines, total, chronological } = timeline;
  const key = `listen:${model?.deck.id ?? ''}`;
  const audio = useMemo(() => {
    const segments: Segment[] = [], plan:AudioPlan[]=[];
    let playbackStartMs=0;
    for (const visit of timeline.visits) {
      const uri = audioOf(visit.attemptId);
      if (!uri) continue;
      plan.push({ ...visit, playbackStartMs });
      segments.push({ uri, startMs: visit.startMs, endMs: visit.endMs });
      playbackStartMs += visit.durationMs;
    }
    return {segments,plan};
  }, [timeline.visits]);
  const {segments,plan}=audio;
  const playing = active && player.playingKey === key;
  const idlePosition = selectedPosition ?? (chronological ? 0 : chapters.find(chapter => chapter.slide === selectedSlide)?.runStart ?? 0);
  const playedSeconds = playing ? positionOnRun(player.elapsedMs,plan) : idlePosition;
  const position = scrub ?? playedSeconds;
  const chapter = listenEntryAt(position, chapters);
  const activeSlide = chapter?.slide ?? selectedSlide;
  const inVisit = (line: Line) => !chronological || !!chapter && line.t >= chapter.runStart && line.t < chapter.runStart + chapter.durationMs / 1000;
  const activeLineIndex = playing || scrub !== null
    ? lines.findLastIndex(line => line.slide === activeSlide && inVisit(line) && line.t <= position)
    : lines.findIndex(line => line.slide === activeSlide && inVisit(line));
  const currentLine = activeLineIndex >= 0 ? lines[activeLineIndex] : undefined;
  const currentFillers = currentLine ? fillerIndexes(currentLine.words) : new Set<number>();
  const followingLineIndex = activeLineIndex >= 0 ? activeLineIndex + 1 : lines.findIndex(line => line.t > position);
  const previousLine = currentLine ? lines[activeLineIndex - 1] : followingLineIndex < 0 ? lines.at(-1) : lines[followingLineIndex - 1];
  const nextLine = followingLineIndex >= 0 ? lines[followingLineIndex] : undefined;
  const back = () => {
    player.stop();
    // OpenAI Codex, 2026-11-19: listening is always allowed to return to the available full review.
    if (nav.from === 'wait') go('full', { deckId: nav.deckId, sel: nav.sel, from: 'wait' });
    else if (nav.from === 'review') go('review', { deckId: nav.deckId, sel: nav.sel });
    else if (nav.from === 'full') go('full', { deckId: nav.deckId, sel: nav.sel });
    else if (nav.from === 'rehearse') go('rehearse', { nav: null, deckId: nav.deckId, slide: nav.sel });
    else go('home');
  };
  useBack(active, () => { back(); return true; });
  const jump = (delta: number) => {
    const current = chapter ? chapters.indexOf(chapter) : 0;
    const next = chapters[clamp(current + delta, 0, Math.max(0, chapters.length - 1))];
    if (!next) return;
    setSelectedSlide(next.slide);
    setSelectedPosition(next.runStart);
    setScrub(null);
    if (playing && segments.length) seek(next.runStart, false);
  };
  const animatedJump = (delta: number) => {swipe.move(delta>0?-95:95);jump(delta);swipe.settle();};
  const seek = (seconds: number, paused: boolean) => {
    if (!segments.length) { setNotice('No saved audio is available on this phone.'); return; }
    const slide=listenEntryAt(seconds,chapters)?.slide??selectedSlide,entry=listenEntryAt(seconds,plan);
    if(!entry||entry.slide!==slide){setNotice(`Audio for slide ${slide+1} is not on this phone.`);return;}
    setNotice('');
    setSelectedSlide(slide);
    setSelectedPosition(seconds);
    setScrub(null);
    const elapsed=entry.playbackStartMs+clamp(seconds-entry.runStart,0,entry.durationMs/1000)*1000;
    void player.seekSegments(key, segments, elapsed, paused);
  };
  const toggle = () => {
    if (!segments.length) { setNotice('No saved audio is available on this phone.'); return; }
    if (playing) { player.setPaused(!player.paused); return; }
    seek(idlePosition, false);
  };
  const scrubAt = (pageX: number) => {
    const x = (pageX - frame.left) / frame.s;
    setScrub(clamp((x - 24) / (FRAME_W - 48), 0, 1) * total);
  };
  const swipeShould = (_e: unknown, g: { dx: number; dy: number }) => (Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy)) || (g.dy > 12 && g.dy > Math.abs(g.dx));
  if (!model || !run) return null;

  return <Enter kind={nav.nav}><PanView style={[StyleSheet.absoluteFill, swipeFade]}
    onMoveShould={swipeShould}
    onMove={(_e, g) => { if(Math.abs(g.dx)>Math.abs(g.dy)){swipe.move(g.dx/frame.s);fadeY.set(0);}else{swipe.settle();fadeY.set(Math.max(0, Math.min(BACK_FADE_Y, g.dy / frame.s)));} }}
    onRelease={(_e, g) => { const horizontal=Math.abs(g.dx)>Math.abs(g.dy)||Math.abs(g.vx)>0.6&&Math.abs(g.vx)>Math.abs(g.vy);if (!horizontal&&(g.dy > 90 || g.vy > 0.8)) fadeY.set(withTiming(BACK_FADE_Y, { duration: 460, easing: EASE_SCREEN }, done => { if (done) runOnJS(back)(); })); else { fadeY.set(withTiming(0, { duration: 360, easing: EASE_SCREEN })); if (horizontal&&(g.dx < -60 || g.vx < -0.6)){if(Math.abs(g.dx)<18)swipe.move(-95);jump(1);} else if (horizontal&&(g.dx > 60 || g.vx > 0.6)){if(Math.abs(g.dx)<18)swipe.move(95);jump(-1);} swipe.settle(); } }}
    onTerminate={() => {swipe.settle();fadeY.set(withTiming(0, { duration: 360, easing: EASE_SCREEN }));}}>
    <PageSurface hue={model.deck.hue} />
    <Animated.View style={[StyleSheet.absoluteFill,swipe.style]}>
      <View style={styles.header} pointerEvents="none">
        <Txt numberOfLines={1} style={[styles.title, { color: c.text }]}>Listen back</Txt>
        <Txt style={[styles.subtitle, { color: c.secondary }]}>{`Whole run · ${fmt(total)}`}</Txt>
      </View>
      <View style={[styles.slideChip, { backgroundColor: c.surface08 }]}>
        <Txt numberOfLines={1} style={[styles.slideChipText, { color: c.secondary }]}>{`Slide ${activeSlide + 1} · ${model.deck.slides[activeSlide]?.title ?? `Slide ${activeSlide + 1}`}`}</Txt>
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
        accessibilityValue={{ min: 0, max: total, now: position, text: `${fmt(position)} of ${fmt(total)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => seek(clamp(position + (e.nativeEvent.actionName === 'increment' ? 5 : -5), 0, total), player.paused || !playing)}
        onStartShould={() => segments.length > 0}
        onGrant={e => { player.setPaused(true); scrubAt(e.nativeEvent.pageX); }}
        onMove={e => scrubAt(e.nativeEvent.pageX)}
        onRelease={() => { if (scrub !== null) seek(scrub, false); }}
        onTerminate={() => setScrub(null)}
        onTerminationRequest={() => false}>
        <View style={styles.trackRow}>
          {chapters.map((entry, i) => <View key={i} style={[styles.trackSegment, { flexGrow: Math.max(0.06, entry.durationMs / 1000), backgroundColor: c.track }]}>
            {entry.durationMs > 0 && <View style={[styles.trackFill, { width: `${clamp((position - entry.runStart) * 1000 / entry.durationMs, 0, 1) * 100}%`, backgroundColor: c.strong }]} />}
          </View>)}
          <View pointerEvents="none" style={[styles.playhead, { backgroundColor: c.text, left: `${total > 0 ? clamp(position / total, 0, 1) * 100 : 0}%` }]} />
        </View>
        <View style={styles.times}><Txt style={[styles.timeText, { color: c.secondary }]}>{fmt(position)}</Txt><Txt style={[styles.timeText, { color: c.secondary }]}>{fmt(total)}</Txt></View>
      </PanView>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={() => animatedJump(-1)} style={styles.skip}><Txt style={[styles.skipArrow,{color:c.text}]}>‹</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={playing && !player.paused ? 'Pause whole run' : 'Play whole run'} onPress={toggle} style={[styles.play, { backgroundColor: c.strong }]}>
          <Glyph name={playing && !player.paused ? 'p-pause' : 'p-play'} size={25} color={c.onAccent} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={() => animatedJump(1)} style={styles.skip}><Txt style={[styles.skipArrow,{color:c.text}]}>›</Txt></Pressable>
      </View>
      <HintRow hints={[{ icon: 'h-spin', text: 'Skip a slide' }, { icon: 'h-dn', text: 'Back to review', nudge: 'down' }]} />
    </Animated.View>
  </PanView></Enter>;
}

function positionOnRun(elapsedMs:number,plan:readonly AudioPlan[]) {
  for(const entry of plan)if(elapsedMs<entry.playbackStartMs+entry.durationMs)return entry.runStart+Math.max(0,elapsedMs-entry.playbackStartMs)/1000;
  const last=plan[plan.length-1];return last?last.runStart+last.durationMs/1000:0;
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
