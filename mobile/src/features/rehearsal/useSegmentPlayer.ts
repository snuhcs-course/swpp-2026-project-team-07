// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#transcript-header-playback-october-14-2026
// OpenAI Codex faster presentation exit: docs/ai-collaboration-prompts-iteration-2.md#presentation-to-home-pause-october-15-2026
// OutLoud redesign: play one sentence (a stretch of one take's audio).
// OpenAI Codex Review and Full review: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

export type Segment = { uri: string; startMs: number; endMs: number };
type Playback = { key: string; segments: Segment[]; index: number; token: number; advancing: boolean; paused: boolean };

/** Play a sentence or a sequence of slide visits from saved local audio. */
export function useSegmentPlayer() {
  const player = useAudioPlayer(null, { updateInterval: 50 });
  const [state, setState] = useState<{ key: string | null; progress: number; elapsedMs: number; paused: boolean }>({ key: null, progress: 0, elapsedMs: 0, paused: false });
  const current = useRef<Playback | null>(null);
  const loadedUri = useRef<string | null>(null);
  const token = useRef(0);

  const stop = useCallback(() => {
    if (!current.current) return;
    token.current++;
    current.current = null;
    try { player.pause(); } catch { /* released */ }
    setState({ key: null, progress: 0, elapsedMs: 0, paused: false });
  }, [player]);

  const startSegment = useCallback(async (mine: number, seg: Segment) => {
    if (loadedUri.current !== seg.uri) { player.replace({ uri: seg.uri }); loadedUri.current = seg.uri; }
    for (let i = 0; i < 40 && !player.isLoaded; i++) await new Promise(r => setTimeout(r, 50));
    if (token.current !== mine) return;
    await player.seekTo(seg.startMs / 1000);
    if (token.current !== mine) return;
    if (!current.current?.paused) player.play();
  }, [player]);

  const playSegments = useCallback(async (key: string, segments: Segment[]) => {
    if (current.current?.key === key) {
      const active = current.current;
      active.paused = !active.paused;
      if (active.paused) { try { player.pause(); } catch { /* loading */ } }
      else if (!active.advancing && player.isLoaded) player.play();
      setState(s => ({ ...s, paused: active.paused }));
      return;
    }
    const valid = segments.filter(s => s.endMs > s.startMs);
    if (!valid.length) return;
    const mine = ++token.current;
    current.current = { key, segments: valid, index: 0, token: mine, advancing: false, paused: false };
    setState({ key, progress: 0, elapsedMs: 0, paused: false });
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      await startSegment(mine, valid[0]);
    } catch { if (token.current === mine) stop(); }
  }, [player, startSegment, stop]);
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
        void startSegment(c.token, c.segments[c.index]).then(() => { if (current.current === c) c.advancing = false; }, () => { if (current.current === c) stop(); });
        return;
      }
      const previous = c.segments.slice(0, c.index).reduce((sum, item) => sum + item.endMs - item.startMs, 0);
      const elapsedMs = Math.max(0, Math.min(span, previous + Math.max(0, Math.min(seg.endMs - seg.startMs, pos - seg.startMs))));
      setState(s => (s.key === c.key ? { key: c.key, progress: elapsedMs / Math.max(1, span), elapsedMs, paused: false } : s));
    }, 50);
    return () => clearInterval(timer);
  }, [player, startSegment, state.key, stop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s !== 'active') stop(); });
    return () => { sub.remove(); };
  }, [stop]);

  return { playingKey: state.key, progress: state.progress, elapsedMs: state.elapsedMs, paused: state.paused, play, playSegments, stop };
}
