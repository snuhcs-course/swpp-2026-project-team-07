// Confirmed transcript corrections shared by inline Review and the playback sheet.
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, EASE_SNAP, F, HUES } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { playbackPieces, visitHeading, type Line } from '../domain/lines';
import { fmt } from '../domain/format';
import { audioOf, useWorkers, type Stage } from '../features/rehearsal/analysis';
import type { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { updateDeckState } from '../features/presentations/store';
import type { DeckModel } from '../features/presentations/useDeckModel';
import { API_URL } from '../services/api';
import { createCorrectionClient, restoreCorrections } from '../features/presentations/correctionStore';
import { useTranscriptCorrections } from '../features/presentations/useTranscriptCorrections';
import { acceptSuggestedCorrection, suggestionActive } from '../features/presentations/transcriptSuggestions';

type TranscriptCorrectionProps = {
  model: DeckModel; id: string; slide: number; player: ReturnType<typeof useSegmentPlayer>; onBeforePlay: () => void;
  nativePlayback?: { positionMs: number; uri: string | null; playing: boolean };
  inline?: boolean;
  audioUri?: (attemptId: string) => string | null;
};

export function TranscriptCorrections(props: TranscriptCorrectionProps) {
  const { c } = useTheme();
  const stopPlayback = props.player.stop;
  useEffect(() => () => stopPlayback(), [stopPlayback]);
  const visibleLines = props.model.lines.filter(line => line.slide === props.slide);
  const transcript = props.model.transcripts.get(props.id);
  // Moved sentences retain their original recording identity. Each source owns
  // its own correction status, retries and synchronization controls.
  const untimed = !!transcript?.text.trim() && !transcript.words.length;
  const sources = [...new Set([...(untimed ? [] : [props.id]), ...visibleLines.map(line => line.audio.attemptId)])];
  return <>
    {props.inline && untimed && <View style={{ gap: 8, paddingBottom: 14 }}>
      <Txt style={styles.txHeadText}>Transcript</Txt>
      <Txt style={styles.txVisit}>Word timing is unavailable. This original text cannot be assigned to a slide.</Txt>
      <Txt style={[styles.lineText, { color: c.body }]}>{transcript!.text}</Txt>
    </View>}
    {sources.map(source => <SourceTranscriptCorrections key={`${props.slide}:${source}`} {...props} id={source}
    movedSource={source !== props.id} />)}</>;
}

function SourceTranscriptCorrections({ model, id, slide, player, onBeforePlay, nativePlayback, movedSource, inline, audioUri }: TranscriptCorrectionProps & { movedSource: boolean }) {
  const { c } = useTheme();
  const { deck, n, state } = model;
  const run = state.run;
  const sourceAudio = audioUri ?? audioOf;
  const uri = sourceAudio(id);
  const lines = model.lines.filter(line => line.audio.attemptId === id);
  const corrections = useTranscriptCorrections(id, model);
  const [alt, setAlt] = useState<{ key: string; fi: number } | null>(null);
  const [fixNote, setFixNote] = useState<string | null>(null);
  // ── Transcript corrections ────────────────────────────────────────────────
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const note = (text: string) => {
    setFixNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setFixNote(null), 2600);
  };
  const applyAlt = (line: Line, fi: number, value: string) => {
    const f = line.flags[fi];
    if (!lines.some(l => l.key === line.key && l.text === line.text)) { setAlt(null); note('Transcript changed. Select the word again.'); return; }
    if (!f?.range || !f.alts.includes(value)) return;
    try {
      acceptSuggestedCorrection(API_URL, line.audio.attemptId, f.range.first, f.range.last, value, model.transcripts.get(line.audio.attemptId)!);
      player.stop(); setAlt(null); note('Correction saved · feedback may be outdated');
      void createCorrectionClient(API_URL).synchronize(line.audio.attemptId).then(() => corrections.clearSyncError(line.audio.attemptId)).catch(() => note('Saved on phone · sync pending'));
    } catch (e) { setAlt(null); note((e as Error).message); }
  };
  const restoreLine = (line: Line) => {
    if (!line.source) return;
    try {
      restoreCorrections(API_URL, line.audio.attemptId, line.source.first, line.source.last, model.transcripts.get(line.audio.attemptId)!);
      player.stop(); setAlt(null); note('Original transcript restored');
      void createCorrectionClient(API_URL).synchronize(line.audio.attemptId).then(() => corrections.clearSyncError(line.audio.attemptId)).catch(() => note('Restored on phone · sync pending'));
    } catch (e) { note((e as Error).message); }
  };
  const keepFlag = (line: Line, fi: number) => {
    const w = line.flags[fi]?.dismissal ?? line.flags[fi]?.w;
    if (!w) return;
    updateDeckState(deck.id, s => ({ ...s, edits: { ...s.edits, [line.key]: { ...s.edits[line.key], dismissed: [...(s.edits[line.key]?.dismissed || []), w] } } }));
    setAlt(null);
  };
  const moveLine = (line: Line, dir: -1 | 1) => {
    if (line.canMove === false) return;
    const target = line.slide + dir;
    if (target < 0 || target >= n) return;
    player.stop();
    const origin = line.from ?? line.slide;
    updateDeckState(deck.id, s => {
      const e = { ...s.edits[line.key] };
      if (target === origin) delete e.slide; else e.slide = target;
      return { ...s, fixes: s.fixes + 1, edits: { ...s.edits, [line.key]: e } };
    });
    setAlt(null);
    note('Moved to slide ' + (target + 1));
  };
  const playLine = (line: Line) => {
    const uri = sourceAudio(line.audio.attemptId);
    if (!uri) { note('Audio for this take isn’t on this phone'); return; }
    onBeforePlay();
    void player.play(line.key, { uri, startMs: line.audio.startMs, endMs: line.audio.endMs });
  };
  const playbackKey = movedSource ? `moved:${deck.id}:${slide}:${id}` : `slide:${deck.id}:${slide}`;
  const playSlide = () => {
    const part = run?.parts[slide];
    if (!movedSource && !part) return;
    const uri = sourceAudio(id);
    if (!player.playingKey && nativePlayback?.playing && nativePlayback.uri === uri) { onBeforePlay(); return; }
    if (!uri) { note('Audio for this slide isn’t on this phone'); return; }
    onBeforePlay();
    const segments = movedSource ? lines.filter(line => line.slide === slide).map(line => ({ uri, startMs: line.audio.startMs, endMs: line.audio.endMs }))
      : part!.segments.map(segment => ({ uri, ...segment }));
    void player.playSegments(playbackKey, segments);
  };


  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  return <>
    {movedSource && <Txt style={styles.txVisit}>Moved speech · original recording</Txt>}
    <TranscriptPanel cur={slide} n={n} lines={lines.filter(line => line.slide === slide)} recording={false} claimed={false}
      stage={model.stages.get(id) ?? null} movedSource={movedSource} partId={id} accent={HUES[deck.hue].accent} hasRun={!!run}
      inline={inline} audioUri={sourceAudio} playbackActive={player.playingKey ? !player.paused : !!nativePlayback?.playing}
      canPlayback={!!uri} slidePlaying={player.playingKey ? player.playingKey === playbackKey && !player.paused : !!nativePlayback?.playing && nativePlayback.uri === uri} onPlaySlide={playSlide}
      positionMs={player.playingKey ? player.positionMs : nativePlayback?.positionMs ?? null}
      playbackUri={player.playingKey ? player.uri : nativePlayback?.uri ?? null} playbackError={player.error}
      playingKey={player.playingKey} progress={player.progress} alt={alt} fixNote={fixNote} corrections={corrections}
      onPlay={playLine} onAlt={(line, fi) => { player.stop(); setAlt(value => value?.key === line.key && value.fi === fi ? null : { key: line.key, fi }); }}
      onApplyAlt={applyAlt} onRestore={restoreLine} onKeepFlag={keepFlag} onMove={moveLine} />
    {corrections.ask && <View accessibilityRole="alert" style={{ gap: 10, paddingTop: 12 }}>
      <Txt style={[styles.altLead, { color: c.text }]}>Retry transcription suggestions?</Txt>
      <Txt style={styles.txVisit}>The previous request has an uncertain outcome. Retrying may incur another charge.</Txt>
      <View style={styles.alts}>
        <Pressable accessibilityRole="button" accessibilityLabel="Confirm transcription suggestion retry" onPress={corrections.confirm} style={styles.altChip}><Txt style={styles.altText}>Retry</Txt></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel transcription suggestion retry" onPress={corrections.cancel} style={styles.altChip}><Txt style={styles.altText}>Cancel</Txt></Pressable>
      </View>
    </View>}
  </>;
}

type PanelProps = {
  movedSource?: boolean; inline?: boolean; audioUri?: (attemptId: string) => string | null; playbackActive?: boolean;
  corrections: ReturnType<typeof useTranscriptCorrections>; onRestore: (l: Line) => void;
  cur: number; n: number; lines: Line[]; recording: boolean; claimed: boolean; stage: Stage | null; partId: string | null; accent: string; hasRun: boolean;
  canPlayback: boolean; slidePlaying: boolean; onPlaySlide: () => void;
  positionMs: number | null; playbackUri: string | null;
  playbackError: string | null;
  playingKey: string | null; progress: number; alt: { key: string; fi: number } | null; fixNote: string | null;
  onPlay: (l: Line) => void;
  onAlt: (l: Line, fi: number) => void; onApplyAlt: (l: Line, fi: number, v: string) => void; onKeepFlag: (l: Line, fi: number) => void; onMove: (l: Line, dir: -1 | 1) => void;
};
function TranscriptPanel(p: PanelProps) {
  const { c } = useTheme();
  const workers = useWorkers();
  const worker = p.partId ? workers.get(p.partId) : undefined;
  const showLines = !(p.recording && p.claimed);
  const lines = showLines ? p.lines : [];
  const correction = p.corrections.state, suggestion = p.corrections.suggestions;
  const syncFailure = p.corrections.syncError || correction?.error;
  const needsSync = !!correction && (!!correction.pending || !!correction.conflict || !!syncFailure);
  const status = correction?.conflict ? 'Correction conflict · choose a version' : syncFailure ||
    (correction?.pending ? 'Saved on phone · sync pending' : p.corrections.notice ||
      (suggestion?.stale ? 'Transcription suggestions outdated · check again' : suggestion?.error?.message ||
        (p.corrections.busy || suggestionActive(suggestion) ? (suggestion?.state === 'waiting_descriptions' ? 'Preparing slide context…' : 'Checking transcription…') :
          suggestion?.state === 'failed' ? 'Transcription check failed · try again' :
            suggestion?.requires_confirmation ? 'Transcription retry needs confirmation' : '')));
  let empty = '';
  let action: (() => void) | undefined;
  if (!lines.length) {
    if (p.recording) empty = 'Listening…';
    else if (p.stage && p.stage !== 'done' && p.stage !== 'no_speech') {
      const s = p.stage;
      empty = s === 'processing' ? (worker?.detail || 'Transcribing') + '…'
        : s === 'uploading' ? 'Uploading your take…'
          : s === 'upload_failed' ? 'Couldn’t upload this take · tap to retry'
            : s === 'failed' ? 'Transcription stopped · tap to retry'
              : s === 'awaiting' ? (worker?.prompt ? 'Waiting for your OK to transcribe' : 'Transcription not started · tap to start')
                : s === 'interrupted' ? 'This take was interrupted. Its audio is kept on this phone.'
                  : s === 'missing' ? 'This take isn’t on this phone' : 'Saved on this phone · uploads when online';
      action = s === 'upload_failed' ? worker?.retryUpload : s === 'failed' ? worker?.retry : s === 'awaiting' && !worker?.prompt ? worker?.analyze : undefined;
    } else if (p.stage === 'no_speech') empty = 'No speech was detected in this take';
    else empty = p.hasRun ? 'Nothing said on this slide in the last run' : 'Your words appear here after you record';
  }
  const body = <>
        {!p.recording && (needsSync || !!status || !!suggestion?.dependency?.retry_action) && <View style={{ gap: 6 }}>
          {!!status && <Txt style={styles.txVisit}>{status}</Txt>}
          {needsSync && <View style={styles.alts}>
            {correction?.conflict ? <>
              <Pressable accessibilityRole="button" accessibilityLabel="Use server corrections" onPress={p.corrections.keepServer}><Txt style={styles.altText}>Use server</Txt></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Keep my corrections and synchronize" onPress={p.corrections.keepLocal}><Txt style={styles.altText}>Keep mine</Txt></Pressable>
            </> : <Pressable accessibilityRole="button" accessibilityLabel="Synchronize transcript corrections" disabled={p.corrections.busy} onPress={() => void p.corrections.synchronize()}><Txt style={styles.altText}>Sync corrections</Txt></Pressable>}
          </View>}
          {!!suggestion?.dependency?.retry_action && <Pressable accessibilityRole="button" accessibilityLabel="Retry slide context for transcription suggestions"
            disabled={p.corrections.busy} onPress={() => void p.corrections.retryContext()} style={styles.alts}><Txt style={styles.altText}>Retry slide context</Txt></Pressable>}
        </View>}
        {!p.recording && !!(p.playbackError || p.fixNote) && <Txt style={styles.txVisit}>{p.playbackError ? 'Audio failed · tap Play to retry' : p.fixNote}</Txt>}
        {!lines.length && (
          <Pressable disabled={!action} onPress={action} style={{ flexGrow: 1, justifyContent: 'center' }}>
            <Txt style={[styles.empty, action ? { color: C.secondary } : null]}>{empty}</Txt>
          </Pressable>
        )}
        {lines.map((l, i) => {
          const heading = visitHeading(l, lines[i - 1]);
          const uri = (p.audioUri ?? audioOf)(l.audio.attemptId);
          const inAudio = !!uri && p.positionMs !== null && p.playbackUri === uri && p.positionMs >= l.audio.startMs && p.positionMs < l.audio.endMs;
          const playing = p.inline ? inAudio && (p.playingKey === l.key || !!p.playbackActive) : p.playingKey === l.key || (p.slidePlaying && inAudio);
          return <View key={l.key} style={{ gap: 6 }}>
            {heading && <Txt style={styles.txVisit}>{heading}</Txt>}
            <LineRow line={l} {...p} playing={playing} altFi={p.alt?.key === l.key ? p.alt.fi : -1} />
            {!p.recording && p.alt?.key === l.key && l.flags[p.alt.fi] && <View style={[styles.correctionChoices, { backgroundColor: c.surface06, borderColor: c.hair }]}>
              <CorrectionChoices {...p} line={l} altFi={p.alt.fi} />
              <Pressable accessibilityRole="button" accessibilityLabel="Close transcription choices" onPress={() => p.onAlt(l, p.alt!.fi)} style={styles.altChip}><Txt style={styles.altText}>Close</Txt></Pressable>
            </View>}
          </View>;
        })}
  </>;
  return <>
    <View style={styles.txHead}>
      {p.inline ? <Txt style={styles.txHeadText}>{p.movedSource ? 'Moved speech transcript' : 'Transcript'}</Txt> :
      <Pressable accessibilityRole="button" accessibilityLabel={`${p.slidePlaying ? 'Pause' : 'Play'} ${p.movedSource ? 'moved speech on' : ''} slide ${p.cur + 1} transcript audio`}
        disabled={!p.canPlayback || !p.partId} onPress={p.onPlaySlide} hitSlop={8}>
        <Txt style={styles.txHeadText}>{'Slide ' + (p.cur + 1) + ' transcript'}</Txt>
      </Pressable>}
      <View style={styles.txRule} />
      {!!correction && !p.recording && <Pressable accessibilityRole="button" accessibilityLabel="Check transcription for AI correction suggestions"
        disabled={p.corrections.busy || !!correction.conflict || suggestionActive(suggestion)} onPress={() => void p.corrections.generate()} hitSlop={6}>
        <Txt style={[styles.txCheck, (p.corrections.busy || correction.conflict || suggestionActive(suggestion)) && { opacity: 0.5 }]}>Check transcription</Txt>
      </Pressable>}
      {!p.inline && <Pressable accessibilityRole="button" accessibilityLabel={p.movedSource ? `${p.slidePlaying ? 'Pause' : 'Play'} moved speech on slide ${p.cur + 1}` : `${p.slidePlaying ? 'Pause' : 'Play'} slide ${p.cur + 1} recording`}
        disabled={!p.canPlayback || !p.partId} onPress={p.onPlaySlide}
        style={[styles.txPlay, (!p.canPlayback || !p.partId) && { opacity: 0.28 }]}>
        <Glyph name={p.slidePlaying ? 'p-pause' : 'p-play'} size={15} color={p.slidePlaying ? c.text : c.secondary} />
      </Pressable>}
    </View>
    <View style={styles.txBox}>
      {p.inline ? <View style={{ gap: 8, paddingBottom: 14 }}>{body}</View> :
      <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 14, flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>}
    </View>
  </>;
}

export function CorrectionChoices(p: Pick<PanelProps, 'onApplyAlt'|'onKeepFlag'|'onPlay'> & {line:Line;altFi:number}) {
  const { c } = useTheme();
  const flag = p.line.flags[p.altFi];
  if (!flag) return null;
  return <View style={{ gap: 10 }}>
    <Txt style={styles.altLead}>{'Did you say “' + flag.w + '”?'}</Txt>
    {!!flag.reason && <Txt style={styles.txVisit}>{flag.reason}</Txt>}
    {flag.alts.map(a => <Pressable key={a} accessibilityRole="button" accessibilityLabel={`Replace “${flag.w}” with “${a}”`}
      onPress={() => p.onApplyAlt(p.line, p.altFi, a)} style={[styles.altChip, { minHeight: 44, justifyContent: 'center', backgroundColor: 'rgba(255,216,102,.18)' }]}>
      <Txt style={[styles.altText, { color: c.goldText }]}>{a}</Txt>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel={`Keep “${flag.w}” as heard`} onPress={() => p.onKeepFlag(p.line, p.altFi)} style={[styles.altChip, { minHeight: 44, justifyContent: 'center' }]}>
      <Txt style={styles.altText}>Keep original</Txt>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Play audio for this transcription suggestion" onPress={() => p.onPlay(p.line)} style={[styles.altChip, { minHeight: 44, justifyContent: 'center' }]}>
      <Txt style={styles.altText}>Play audio</Txt>
    </Pressable>
  </View>;
}

export function LineRow(p: PanelProps & { line: Line; playing: boolean; altFi: number }) {
  const { c } = useTheme();
  const { line } = p;
  const canMoveLine = line.canMove !== false;
  const frame = useFrame();
  const dx = useSharedValue(0);
  const [dragX, setDragX] = useState(0);
  const g = useRef<{ axis: 'x' | 'y' | null } | null>(null);
  const responder: PanHandlers = {
    onMoveShould: (_e, gs) => canMoveLine && !p.recording && Math.abs(gs.dx) > 7 * frame.s && Math.abs(gs.dx) > Math.abs(gs.dy),
    onGrant: () => { g.current = { axis: 'x' }; },
    onMove: (_e, gs) => {
      const s = g.current;
      if (!s) return;
      const x = gs.dx / frame.s, y = gs.dy / frame.s;
      if (!s.axis) {
        if (Math.abs(x) < 7 && Math.abs(y) < 7) return;
        s.axis = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
      }
      if (s.axis !== 'x') return;
      const edge = (x < 0 && p.cur === 0) || (x > 0 && p.cur === p.n - 1);
      const v = edge ? x * 0.25 : x;
      dx.set(v); setDragX(v);
    },
    onRelease: e => end(false, e),
    onTerminate: () => end(true),
    onTerminationRequest: () => g.current?.axis !== 'x',
  };
  function end(cancelled: boolean, event?: GestureResponderEvent) {
    const s = g.current;
    g.current = null;
    const v = dx.get();
    dx.set(withTiming(0, { duration: 220, easing: EASE_SNAP })); setDragX(0);
    if (!s || cancelled) return;
    if (s.axis === 'x') { if (canMoveLine && Math.abs(v) > 90) p.onMove(line, v < 0 ? -1 : 1); return; }
    if (!s.axis && event) p.onPlay(line);
  }
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const toPrev = dragX < 0, target = p.cur + (toPrev ? -1 : 1), canMove = canMoveLine && target >= 0 && target < p.n, past = Math.abs(dragX) > 90 && canMove;
  const segs = playbackPieces(p.recording ? { ...line, flags: [] } : line, p.playing && p.playbackUri === (p.audioUri ?? audioOf)(line.audio.attemptId) ? p.positionMs : null);
  const progress = p.playing && p.positionMs !== null ? Math.max(0, Math.min(1, (p.positionMs - line.audio.startMs) / Math.max(1, line.audio.endMs - line.audio.startMs))) : 0;
  const pct = Math.round(progress * 100);
  return (
    <View style={{ flexShrink: 0 }}>
      <View pointerEvents="none" style={[styles.reveal, { justifyContent: toPrev ? 'flex-end' : 'flex-start', backgroundColor: past ? p.accent : c.surface08, opacity: Math.min(1, Math.abs(dragX) / 50) }]}>
        <Txt style={styles.revealText}>{dragX && canMove ? (toPrev ? '← Slide ' + (target + 1) : 'Slide ' + (target + 1) + ' →') : ''}</Txt>
      </View>
      <PanView style={[styles.lineRow, { backgroundColor: p.playing ? undefined : dragX ? c.surface06 : 'transparent' }, row]} {...responder}
        accessible={false}>
        {p.playing && (
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Rect x="0" y="0" width={`${pct}%`} height="100%" rx={10} fill={c.ink14} />
            <Rect x={`${pct}%`} y="0" width={`${100 - pct}%`} height="100%" fill={c.ink05} />
          </Svg>
        )}
        <Pressable disabled={p.recording} accessibilityRole="button" accessibilityLabel={'Play sentence at ' + fmt(line.t)} onPress={() => p.onPlay(line)} style={styles.playCol}>
          <Txt style={styles.lineTime}>{fmt(line.t)}</Txt>
        </Pressable>
          <Txt disabled={p.recording} accessibilityRole="button" accessibilityLabel={'Play sentence: ' + line.text}
            accessibilityActions={[{ name: 'activate' },
          ...(canMoveLine && p.cur > 0 ? [{ name: 'movePrev', label: 'Move to slide ' + p.cur }] : []), ...(canMoveLine && p.cur < p.n - 1 ? [{ name: 'moveNext', label: 'Move to slide ' + (p.cur + 2) }] : [])]}
            onAccessibilityAction={e => { const a = e.nativeEvent.actionName; if (a === 'activate') p.onPlay(line); else if (canMoveLine && a === 'movePrev') p.onMove(line, -1); else if (canMoveLine && a === 'moveNext') p.onMove(line, 1); }}
            onPress={() => p.onPlay(line)} style={[styles.lineText, { color: p.playing ? c.text : c.body }]}>
            {segs.map((sg, i) => sg.fi < 0 ? <Txt key={i} style={sg.active ? { backgroundColor: p.accent, color: c.bg } : undefined}>{sg.t}</Txt> : (
              <Txt key={i} accessibilityRole="button" accessibilityLabel={'Possibly misheard: ' + line.flags[sg.fi].w + '. Show corrections'} onPress={e => { e.stopPropagation(); p.onAlt(line, sg.fi); }}
                style={[styles.flag, sg.active && { backgroundColor: p.accent, color: c.bg }]}>{sg.t}</Txt>
            ))}
          </Txt>
      </PanView>
      {!p.recording && line.flags.map((flag, fi) => <Pressable key={fi} accessibilityRole="button"
        accessibilityLabel={'Show replacements for ' + flag.w} onPress={() => p.onAlt(line, fi)} style={styles.altChip}>
        <Txt style={styles.altText}>{'Correct “' + flag.w + '”'}</Txt>
      </Pressable>)}
      {line.fixed && !p.recording && <Pressable accessibilityRole="button" accessibilityLabel="Restore original transcript sentence" onPress={() => p.onRestore(line)} style={styles.alts}>
        <Txt style={styles.altText}>Restore original</Txt>
      </Pressable>}
      {!!line.edge && !p.recording && (
        <View style={styles.edge} pointerEvents="none">
          <Glyph name="h-spin" size={14} color={c.warn} />
          <Txt style={styles.edgeText}>{!canMoveLine ? 'Said as the slide changed · timing follows the recorded slide boundary' : line.edge < 0 ? 'Said as the slide changed · swipe ← to move to slide ' + p.cur : 'Said as the slide changed · swipe → to move to slide ' + (p.cur + 2)}</Txt>
        </View>
      )}
    </View>
  );
}

const styles = createThemedStyles({
  txHead: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 },
  txHeadText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  txRule: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  txCheck: { fontFamily: F.semibold, fontSize: 11, color: C.secondary },
  txVisit: { fontFamily: F.semibold, fontSize: 11, color: C.secondary, paddingHorizontal: 8 },
  txPlay: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  correctionChoices: { padding: 14, gap: 10, borderRadius: 16, borderWidth: 1 },
  txBox: { minHeight: 100 },
  empty: { textAlign: 'center', fontFamily: F.medium, fontSize: 13, color: C.tertiary },
  reveal: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 10 },
  revealText: { fontFamily: F.bold, fontSize: 12, color: '#FFFFFF' },
  lineRow: { flexDirection: 'row', gap: 8, paddingTop: 6, paddingBottom: 6, paddingRight: 8, paddingLeft: 4, borderRadius: 10, overflow: 'hidden' },
  playCol: { width: 34, alignItems: 'center', paddingTop: 3 },
  lineTime: { fontFamily: F.semibold, fontSize: 11, color: C.tertiary, fontVariant: ['tabular-nums'] },
  lineText: { flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 19.3 },
  flag: { backgroundColor: 'rgba(255, 216, 102, 0.14)', color: '#FFE08A', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'rgba(255, 216, 102, 0.85)' },
  alts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: 4, paddingLeft: 42 },
  altLead: { fontFamily: F.semibold, fontSize: 12, color: C.tertiary },
  altChip: { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 999 },
  altText: { fontFamily: F.bold, fontSize: 12, color: C.secondary },
  edge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4, paddingLeft: 42 },
  edgeText: { flex: 1, fontFamily: F.semibold, fontSize: 12, color: '#FFC266' },
});
