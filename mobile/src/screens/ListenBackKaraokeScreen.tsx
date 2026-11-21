// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-21): S13 Listen back layout and the
// word-by-word karaoke (spoken / current / upcoming words from each word's timestamps, tap a word to replay from it).
// Timing rules live in domain/karaoke.ts; see LISTEN_BACK_SPEC.md in the implementation package.
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextStyle } from 'react-native';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useUiText } from '../design/language';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView } from '../design/PanView';
import { EASE_SCREEN, F, FRAME_W, type Palette } from '../design/tokens';
import { BACK_FADE_Y } from '../domain/gestures';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt } from '../domain/format';
import { karaokePages, pageAt, runSecondsAt, sourceAt, wordSeekMs, wordState, type KaraokePage, type WordState } from '../domain/karaoke';
import { listenEntryAt, listenTimeline, type ListenVisit } from '../domain/listenTimeline';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer, type Segment } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
type AudioPlan = ListenVisit & { playbackStartMs: number };

export function ListenBackKaraokeScreen({ active = true }: { active?: boolean }) {
  const ui = useUiText();
  const { c } = useTheme();
  const frame = useFrame();
  const { go, nav } = useShell();
  // OpenAI Codex, 2026-11-19: let the review beneath show through a downward swipe.
  const fadeY = useSharedValue(0);
  const swipeFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - fadeY.value / BACK_FADE_Y) }));
  const model = useDeckModel(nav.deckId);
  const player = useSegmentPlayer();
  const [selectedSlide, setSelectedSlide] = useState(Math.max(0, nav.sel));
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  // OpenAI Codex, 2026-11-21: keep arrow navigation independent of the audio clock between taps.
  const selectedChapter = useRef<number | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  // OpenAI Codex, 2026-11-21: transcript swipes browse pages without starting audio; word taps choose playback.
  const [browsedPage, setBrowsedPage] = useState<number | null>(null);
  const browseTouch = useRef<{ x: number; y: number; transcript: boolean } | null>(null);
  const leaving = useRef(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  // Natural ends already acted on; a newer end keeps the last words on screen until the next action.
  const [seenEnds, setSeenEnds] = useState(player.ends ?? 0);
  const run = model?.state.run ?? null;
  const times = useMemo(() => model?.times ?? [], [model?.times]);
  const timeline = useMemo(() => listenTimeline(run, times, model?.lines ?? []), [run, times, model?.lines]);
  const { chapters, lines, total, chronological, visits } = timeline;
  const pages = useMemo(() => karaokePages(lines), [lines]);
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
  const ended = !playing && (player.ends ?? 0) > seenEnds;
  // OpenAI Codex, 2026-11-21: a missing final take is not played; keep its chapter unfilled at natural EOF.
  const audibleEnd = plan.length ? plan[plan.length - 1].runStart + plan[plan.length - 1].durationMs / 1000 : 0;
  const endedPosition = audibleEnd >= total - 0.001 ? total : Math.max(plan[plan.length - 1]?.runStart ?? 0, audibleEnd - 0.001);
  const idlePosition = selectedChapterIndex !== null && selectedPosition !== null ? selectedPosition
    : ended ? endedPosition : selectedPosition ?? (chronological ? 0 : chapters.find(chapter => chapter.slide === selectedSlide)?.runStart ?? 0);
  const playedSeconds = playing ? positionOnRun(player.elapsedMs,plan) : idlePosition;
  const position = scrub ?? playedSeconds;
  const chapter = listenEntryAt(position, chapters);
  const browseIndex = browsedPage !== null && pages.length ? clamp(browsedPage, 0, pages.length - 1) : null;
  const manualSlide = selectedChapterIndex !== null && !playing && scrub === null ? chapters[selectedChapterIndex]?.slide : undefined;
  const activeSlide = browseIndex !== null ? pages[browseIndex].slide : manualSlide ?? chapter?.slide ?? selectedSlide;

  // ── Karaoke: one clock (the run position) → the take and ms in it → the page and the word lit on it. ──
  const live = browseIndex === null && (playing || scrub !== null);
  const found = browseIndex !== null ? { index: browseIndex, word: -1 }
    : manualSlide !== undefined ? firstPageOf(manualSlide, pages)
      : pageAt(sourceAt(position, visits), pages) ?? firstPageOf(activeSlide, pages);
  const page = found ? pages[found.index] : undefined;
  const lit = live && found ? found.word : null;
  const previousText = found ? pages[found.index - 1]?.text ?? '' : '';
  const nextText = found ? pages[found.index + 1]?.text ?? '' : '';

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
  const leaveEnd = () => setSeenEnds(player.ends ?? 0);
  const jump = (delta: number) => {
    const current = selectedChapter.current ?? (chapter ? chapters.indexOf(chapter) : 0);
    const currentSlide = chapters[current]?.slide ?? activeSlide;
    // OpenAI Codex, 2026-11-21: skip to another slide even if this slide has several recorded visits.
    const nextIndex = delta > 0
      ? chapters.findIndex((entry, index) => index > current && entry.slide !== currentSlide)
      : chapters.findLastIndex((entry, index) => index < current && entry.slide !== currentSlide);
    if (nextIndex < 0) return;
    const next = chapters[nextIndex];
    leaveEnd();
    player.stop();
    setNotice('');
    setBrowsedPage(null);
    selectedChapter.current = nextIndex;
    setSelectedChapterIndex(nextIndex);
    setSelectedSlide(next.slide);
    setSelectedPosition(next.runStart);
    setScrub(null);
  };
  const browse = (delta: number) => {
    if (!pages.length) return;
    const nextIndex = clamp((browseIndex ?? found?.index ?? 0) + delta, 0, pages.length - 1);
    const next = pages[nextIndex];
    const seconds = runSecondsAt(next.attemptId, next.startMs, visits)
      ?? chapters.find(entry => entry.slide === next.slide)?.runStart ?? position;
    leaveEnd();
    player.stop();
    setNotice('');
    setScrub(null);
    setBrowsedPage(nextIndex);
    const chapterIndex = chapters.findIndex(entry => entry.slide === next.slide &&
      seconds >= entry.runStart && seconds < entry.runStart + entry.durationMs / 1000);
    const selectedIndex = chapterIndex >= 0 ? chapterIndex : chapters.findIndex(entry => entry.slide === next.slide);
    selectedChapter.current = selectedIndex >= 0 ? selectedIndex : null;
    setSelectedChapterIndex(selectedChapter.current);
    setSelectedSlide(next.slide);
    setSelectedPosition(seconds);
  };
  const seek = (seconds: number, paused: boolean) => {
    leaveEnd();
    if (!segments.length) { setNotice('No saved audio is available on this phone.'); return; }
    const slide=listenEntryAt(seconds,chapters)?.slide??selectedSlide,entry=listenEntryAt(seconds,plan);
    if(!entry||entry.slide!==slide){setNotice(`Audio for slide ${slide+1} is not on this phone.`);return;}
    setNotice('');
    setBrowsedPage(null);
    selectedChapter.current = null;
    setSelectedChapterIndex(null);
    setSelectedSlide(slide);
    setSelectedPosition(seconds);
    setScrub(null);
    const elapsed=entry.playbackStartMs+clamp(seconds-entry.runStart,0,entry.durationMs/1000)*1000;
    void player.seekSegments(key, segments, elapsed, paused);
  };
  const toggle = () => {
    if (!segments.length) { setNotice('No saved audio is available on this phone.'); return; }
    if (ended) { seek(plan[0]?.runStart ?? 0, false); return; }
    // OpenAI Codex, 2026-11-21: a scrub/accessible seek to EOF retains a paused player key; Play must restart it.
    if (playing && player.paused && position >= total - 0.05) { seek(plan[0]?.runStart ?? 0, false); return; }
    if (playing) { player.setPaused(!player.paused); return; }
    // At the end of the run, Play starts again from the beginning.
    seek(idlePosition >= total - 0.05 ? plan[0]?.runStart ?? 0 : idlePosition, false);
  };
  // Tap a word: play from just before it, keeping pause state out of it (a tap always plays).
  // The handler is kept in a ref so the memoised karaoke text does not re-render on every clock tick.
  const tapWord = useRef<(page: KaraokePage, index: number) => void>(() => undefined);
  useEffect(() => {
    tapWord.current = (tapped, index) => {
      const word = tapped.tokens[index]?.word;
      const visit = word && visits.find(item => item.attemptId === tapped.attemptId && word.start_ms >= item.startMs && word.start_ms < item.endMs);
      if (!word || !visit) return;
      const seconds = runSecondsAt(tapped.attemptId, wordSeekMs(word, visit), visits);
      if (seconds !== null) seek(seconds, false);
    };
  });
  const onWord = useCallback((tapped: KaraokePage, index: number) => tapWord.current(tapped, index), []);
  const scrubAt = (pageX: number) => {
    const x = (pageX - frame.left) / frame.s;
    setScrub(clamp((x - 24) / (FRAME_W - 48), 0, 1) * total);
  };
  const inTranscript = (pageY: number) => {
    const startY = (pageY - frame.top) / frame.s;
    return startY >= 195 && startY <= 495;
  };
  const fadeBack = () => {
    if (leaving.current) return;
    leaving.current = true;
    fadeY.set(withTiming(BACK_FADE_Y, { duration: 460, easing: EASE_SCREEN }, done => {
      if (done) runOnJS(back)();
    }));
  };
  if (!model || !run) return null;

  return <><Enter kind={nav.nav}><PanView style={[StyleSheet.absoluteFill, swipeFade]}
    // OpenAI Codex, 2026-11-21: capture a downward drag from controls, including the scrubber, while transcript drags keep browsing.
    onMoveShouldCapture={(_e, g) => !inTranscript(g.y0) && g.dy > 12 && g.dy > Math.abs(g.dx)}
    onMove={(_e, g) => fadeY.set(Math.max(0, Math.min(BACK_FADE_Y, g.dy / frame.s)))}
    onRelease={(_e, g) => { if (g.dy > 90 * frame.s) fadeBack();
      else fadeY.set(withTiming(0, { duration: 360, easing: EASE_SCREEN })); }}
    onTerminate={() => { if (!leaving.current) fadeY.set(withTiming(0, { duration: 360, easing: EASE_SCREEN })); }}>
    <PageSurface hue={model.deck.hue} />
    <View testID="listenTranscriptTouchArea" style={StyleSheet.absoluteFill}
      // OpenAI Codex, 2026-11-21: track both regions here so child touches cannot steal the outside exit gesture.
      onTouchStart={e => { browseTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY,
        transcript: inTranscript(e.nativeEvent.pageY) }; }}
      onTouchMove={e => { const start = browseTouch.current;
        if (!start || start.transcript || leaving.current) return;
        const dx = e.nativeEvent.pageX - start.x, dy = e.nativeEvent.pageY - start.y;
        if (dy > Math.abs(dx)) fadeY.set(Math.max(0, Math.min(BACK_FADE_Y, dy / frame.s)));
      }}
      onTouchEnd={e => { const start = browseTouch.current; browseTouch.current = null;
        if (!start) return;
        const dx = e.nativeEvent.pageX - start.x, dy = e.nativeEvent.pageY - start.y;
        if (start.transcript) {
          if (Math.abs(dy) > 45 * frame.s && Math.abs(dy) > Math.abs(dx)) browse(dy > 0 ? -1 : 1);
        } else if (dy > 90 * frame.s && dy > Math.abs(dx)) fadeBack();
        else fadeY.set(withTiming(0, { duration: 360, easing: EASE_SCREEN }));
      }}
      onTouchCancel={() => { browseTouch.current = null;
        if (!leaving.current) fadeY.set(withTiming(0, { duration: 360, easing: EASE_SCREEN })); }}>
      <View style={styles.header} pointerEvents="none">
        <Txt numberOfLines={1} style={[styles.title, { color: c.text }]}>Listen back</Txt>
        <Txt style={[styles.subtitle, { color: c.secondary }]}>{`Whole run · ${fmt(total)}`}</Txt>
      </View>
      <View style={styles.chipRow} pointerEvents="none">
        <View style={[styles.slideChip, { backgroundColor: c.ink05, borderColor: c.line }]}>
          <Txt verbatim numberOfLines={1} style={[styles.slideChipText, { color: c.text }]}>{ui(`Slide ${activeSlide + 1}`) + ' · ' + (model.deck.slides[activeSlide]?.title ?? ui(`Slide ${activeSlide + 1}`))}</Txt>
        </View>
      </View>
      {lines.length ? <>
        <Txt verbatim numberOfLines={1} ellipsizeMode="head" style={[styles.previous, { color: c.tertiary }]}>{previousText}</Txt>
        <View style={styles.current}>
          {page ? <KaraokeText page={page} lit={lit} onWord={onWord} /> :
            <Txt style={[styles.currentText, { color: c.secondary }]}>{live ? '…' : 'Tap play to listen to your run.'}</Txt>}
        </View>
        <Txt verbatim numberOfLines={2} style={[styles.next, { color: c.tertiary }]}>{nextText}</Txt>
      </> : <View style={styles.noTranscript}><Txt style={[styles.noTranscriptText, { color: c.secondary }]}>{model.pending ? 'Transcript is still processing.' : 'No transcript for this run'}</Txt></View>}
      {!!(notice || player.error) && <Txt accessibilityRole="alert" style={[styles.notice, { color: c.secondary }]}>{notice || player.error}</Txt>}
      <PanView style={styles.scrubberHit} accessibilityRole="adjustable" accessibilityLabel={ui("Run audio position")}
        accessibilityValue={{ min: 0, max: total, now: position, text: ui(`${fmt(position)} of ${fmt(total)}`) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => seek(clamp(position + (e.nativeEvent.actionName === 'increment' ? 5 : -5), 0, total), player.paused || !playing)}
        onStartShould={() => segments.length > 0}
        onGrant={e => { setBrowsedPage(null); player.setPaused(true); scrubAt(e.nativeEvent.pageX); }}
        onMove={e => scrubAt(e.nativeEvent.pageX)}
        onRelease={() => { if (scrub !== null) seek(scrub, false); }}
        onTerminate={() => setScrub(null)}
        onTerminationRequest={(_e, g) => g.dy > 12 && g.dy > Math.abs(g.dx)}>
        <View style={styles.trackRow}>
          {chapters.map((entry, i) => {
            const end = entry.runStart + entry.durationMs / 1000, done = position >= end, now = !done && position >= entry.runStart;
            return <View key={i} style={[styles.trackSegment, { flexGrow: Math.max(0.06, entry.durationMs / 1000), backgroundColor: done ? c.body : c.ink20 }]}>
              {now && entry.durationMs > 0 && <View style={[styles.trackFill, { width: `${clamp((position - entry.runStart) * 1000 / entry.durationMs, 0, 1) * 100}%`, backgroundColor: c.accent }]} />}
            </View>;
          })}
        </View>
        <View style={styles.times}><Txt style={[styles.timeText, { color: c.secondary }]}>{fmt(position)}</Txt><Txt style={[styles.timeText, { color: c.secondary }]}>{fmt(total)}</Txt></View>
      </PanView>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={ui('Previous slide')} onPress={() => jump(-1)} style={styles.skip}><Chevron d="M14.5 5.5 L8 12 L14.5 18.5" color={c.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={ui(playing && !player.paused ? 'Pause whole run' : 'Play whole run')} onPress={toggle}
          style={[styles.play, { backgroundColor: c.accent, boxShadow: `0px 10px 24px ${c.accent}59` }]}>
          <Glyph name={playing && !player.paused ? 'p-pause' : 'p-play'} size={30} color={c.onAccent} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={ui('Next slide')} onPress={() => jump(1)} style={styles.skip}><Chevron d="M9.5 5.5 L16 12 L9.5 18.5" color={c.text} /></Pressable>
      </View>
    </View>
  </PanView></Enter>
  {/* OpenAI Codex, 2026-11-20: playback gestures do not animate the footer. */}
  <HintRow hints={[{ icon: 'h-vert', text: 'Browse text' }, { icon: 'h-tap', text: 'Tap a word' }, { icon: 'h-dn', text: 'Back to review', nudge: 'down' }]} />
  </>;
}

/** The current page: one Text with a nested span per word, so wrapping, centring and font fitting stay native.
 * Colour is the only thing that changes per word (no weight or size change), so the text never reflows while it plays.
 * Re-renders only when the page or the lit word changes, not on every 50 ms clock tick. */
const KaraokeText = memo(function KaraokeText({ page, lit, onWord }: { page: KaraokePage; lit: number | null; onWord: (page: KaraokePage, index: number) => void }) {
  const { c } = useTheme();
  const ui = useUiText();
  return <Txt verbatim numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityLabel={page.text} accessibilityHint={ui('Tap a word to play from it')}
    style={[styles.currentText, { color: c.text }]}>
    {page.tokens.map((token, i) => {
      // The trailing space sits outside the word's span so a filler's underline and tint stop at the word.
      const core = token.text.trimEnd(), space = token.text.slice(core.length);
      return <Fragment key={i}><Txt verbatim suppressHighlighting onPress={() => onWord(page, i)}
        style={wordStyle(wordState(i, lit), token.filler, c)}>{core}</Txt>{space}</Fragment>;
    })}
  </Txt>;
});

/** spoken = text colour · current = accent · upcoming = 45% ink; fillers stay amber and underlined in every state. */
export function wordStyle(state: WordState, filler: boolean, c: Palette): TextStyle {
  if (filler) return { color: state === 'upcoming' ? `${c.warn}8C` : c.warn, textDecorationLine: 'underline',
    backgroundColor: state === 'current' ? `${c.warn}2E` : undefined };
  return { color: state === 'current' ? c.accent : state === 'upcoming' ? c.ink45 : c.text };
}

function Chevron({ d, color }: { d: string; color: string }) {
  return <Svg width={30} height={30} viewBox="0 0 24 24"><Path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function firstPageOf(slide: number, pages: readonly KaraokePage[]) {
  const index = pages.findIndex(page => page.slide === slide);
  return index >= 0 ? { index, word: -1 } : null;
}

function positionOnRun(elapsedMs:number,plan:readonly AudioPlan[]) {
  for(const entry of plan)if(elapsedMs<entry.playbackStartMs+entry.durationMs)return entry.runStart+Math.max(0,elapsedMs-entry.playbackStartMs)/1000;
  const last=plan[plan.length-1];return last?last.runStart+last.durationMs/1000:0;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 46, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 23 }, subtitle: { marginTop: 3, fontFamily: F.medium, fontSize: 14, lineHeight: 18 },
  chipRow: { position: 'absolute', top: 132, left: 24, right: 24, alignItems: 'center' },
  slideChip: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  slideChipText: { fontFamily: F.semibold, fontSize: 14.5, lineHeight: 19 },
  previous: { position: 'absolute', top: 206, left: 28, right: 28, height: 26, fontFamily: F.medium, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  current: { position: 'absolute', top: 258, left: 28, right: 28, height: 156, alignItems: 'center', justifyContent: 'center' },
  currentText: { fontFamily: F.display, fontSize: 28, lineHeight: 36.4, letterSpacing: -0.3, textAlign: 'center' },
  next: { position: 'absolute', top: 430, left: 28, right: 28, height: 52, fontFamily: F.medium, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  noTranscript: { position: 'absolute', top: 270, left: 32, right: 32, minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  noTranscriptText: { fontFamily: F.medium, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  notice: { position: 'absolute', left: 24, right: 24, top: 500, minHeight: 34, fontFamily: F.medium, fontSize: 13.5, textAlign: 'center' },
  scrubberHit: { position: 'absolute', left: 24, right: 24, top: 548, height: 50, gap: 8 },
  trackRow: { height: 24, flexDirection: 'row', gap: 3, alignItems: 'center' },
  trackSegment: { flex: 1, minWidth: 2, height: 4, borderRadius: 2, overflow: 'hidden' }, trackFill: { height: 4, borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' }, timeText: { fontFamily: F.semibold, fontSize: 14.5, lineHeight: 18, fontVariant: ['tabular-nums'] },
  controls: { position: 'absolute', left: 0, right: 0, top: 610, height: 72, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 44 },
  skip: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  play: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
