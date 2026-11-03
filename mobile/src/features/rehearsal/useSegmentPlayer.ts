// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#transcript-header-playback-october-14-2026
// OpenAI Codex faster presentation exit: docs/ai-collaboration-prompts-iteration-2.md#presentation-to-home-pause-october-15-2026
// OutLoud redesign: play one sentence (a stretch of one take's audio).
// OpenAI Codex Review and Full review: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OpenAI Codex #44: exact queued seeks preserve original visits and playback intent.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

export type Segment = { uri: string; startMs: number; endMs: number };
type Playback = { key: string; segments: Segment[]; index: number; token: number; advancing: boolean; paused: boolean; atEnd: boolean };
type PlaybackState = { key: string | null; progress: number; elapsedMs: number; paused: boolean; positionMs: number | null; uri: string | null };
const idle: PlaybackState = { key: null, progress: 0, elapsedMs: 0, paused: false, positionMs: null, uri: null };

/** Play a sentence or a sequence of slide visits from saved local audio. */
export function useSegmentPlayer() {
  const player = useAudioPlayer(null, { updateInterval: 50 });
  const [state, setState] = useState<PlaybackState>(idle);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<Playback | null>(null);
  const loadedUri = useRef<string | null>(null);
  const token = useRef(0);
  const operations = useRef<Promise<void>>(Promise.resolve());

  const stop = useCallback(() => {
    if (!current.current) return;
    token.current++;
    current.current = null;
    try { player.pause(); } catch { /* released */ }
    setState(idle);
  }, [player]);

  const failed = useCallback(() => {
    loadedUri.current = null;
    stop();
    setError('Audio playback failed. Tap Play to retry.');
  }, [stop]);

  const startSegment = useCallback((mine: number, seg: Segment, positionMs = seg.startMs) => {
    const next = operations.current.catch(() => undefined).then(async () => {
      if (token.current !== mine) return;
      player.pause();
      if (loadedUri.current !== seg.uri) { player.replace({ uri: seg.uri }); loadedUri.current = seg.uri; }
      for (let i = 0; i < 40 && !player.isLoaded && token.current === mine; i++) await new Promise(r => setTimeout(r, 50));
      if (token.current !== mine) return;
      if (!player.isLoaded) throw new Error('Audio did not load');
      await player.seekTo(positionMs / 1000);
      if (token.current !== mine) return;
      if (!current.current?.paused) player.play();
    });
    operations.current = next;
    return next;
  }, [player]);

  const seekSegments = useCallback(async (key: string, segments: Segment[], elapsedMs: number, paused: boolean) => {
    const valid = segments.filter(s => s.endMs > s.startMs);
    if (!valid.length || !Number.isFinite(elapsedMs)) return;
    const span = valid.reduce((sum, seg) => sum + seg.endMs - seg.startMs, 0);
    const target = Math.max(0, Math.min(span, elapsedMs));
    let index = 0, offset = target;
    while (index < valid.length - 1 && offset >= valid[index].endMs - valid[index].startMs) {
      offset -= valid[index].endMs - valid[index].startMs; index++;
    }
    const positionMs = valid[index].startMs + offset;
    setError(null);
    const mine = ++token.current;
    const active: Playback = { key, segments: valid, index, token: mine, advancing: true, paused: paused || target === span, atEnd: target === span };
    current.current = active;
    try { player.pause(); } catch { /* loading */ }
    setState({ key, progress: target / span, elapsedMs: target, paused: active.paused, positionMs, uri: valid[index].uri });
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      await startSegment(mine, valid[index], positionMs);
      if (current.current === active) active.advancing = false;
    } catch { if (token.current === mine) failed(); }
  }, [failed, player, startSegment]);
  const setPaused = useCallback((paused: boolean) => {
    const active = current.current;
    if (!active) return;
    active.paused = paused || active.atEnd;
    if (active.paused) { try { player.pause(); } catch { /* loading */ } }
    else if (!active.advancing && player.isLoaded) player.play();
    setState(s => s.key === active.key ? { ...s, paused: active.paused } : s);
  }, [player]);
  const playSegments = useCallback(async (key: string, segments: Segment[]) => {
    const active = current.current;
    if (active?.key === key) {
      if (active.atEnd) return seekSegments(key, active.segments, 0, false);
      setPaused(!active.paused); return;
    }
    return seekSegments(key, segments, 0, false);
  }, [seekSegments, setPaused]);
  // Existing sentence and Q&A taps retain their tap-again-to-stop behavior.
  const play = useCallback((key: string, seg: Segment) => {
    if (current.current?.key === key) { stop(); return Promise.resolve(); }
    return playSegments(key, [seg]);
  }, [playSegments, stop]);

  useEffect(() => {
    if (!state.key) return;
    const timer = setInterval(() => {
      const c = current.current;
      if (!c || c.advancing || c.paused) return;
      const pos = player.currentTime * 1000;
      const seg = c.segments[c.index];
      const span = c.segments.reduce((sum, item) => sum + item.endMs - item.startMs, 0);
      if (pos >= seg.endMs || (!player.playing && pos > seg.startMs + 200 && pos >= seg.endMs - 150)) {
        if (c.index + 1 >= c.segments.length) { stop(); return; }
        c.advancing = true;
        c.index++;
        void startSegment(c.token, c.segments[c.index]).then(() => { if (current.current === c) c.advancing = false; }, () => { if (current.current === c) failed(); });
        return;
      }
      const previous = c.segments.slice(0, c.index).reduce((sum, item) => sum + item.endMs - item.startMs, 0);
      const elapsedMs = Math.max(0, Math.min(span, previous + Math.max(0, Math.min(seg.endMs - seg.startMs, pos - seg.startMs))));
      setState(s => (s.key === c.key ? { key: c.key, progress: elapsedMs / Math.max(1, span), elapsedMs, paused: false, positionMs: pos, uri: seg.uri } : s));
    }, 50);
    return () => clearInterval(timer);
  }, [failed, player, startSegment, state.key, stop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s !== 'active') stop(); });
    return () => { sub.remove(); token.current++; current.current = null; try { player.pause(); } catch { /* released */ } };
  }, [player, stop]);

  return { playingKey: state.key, progress: state.progress, elapsedMs: state.elapsedMs, paused: state.paused, positionMs: state.positionMs, uri: state.uri, error, play, playSegments, seekSegments, setPaused, stop };
}
