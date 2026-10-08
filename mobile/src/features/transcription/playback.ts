import type { Transcript, TranscriptWord } from "../../contracts";

/** A late seek must not undo a newer pause, source change, or navigation. */
export async function resumeAfterSeek(
  seek: () => Promise<void>, isCurrent: () => boolean, play: () => void,
): Promise<void> {
  await seek();
  if (isCurrent()) play();
}

/** Use actual player time, half-open intervals; silence/zero-length words have no highlight. */
export function activeWordIndex(words: TranscriptWord[], positionMs: number, durationMs = Infinity): number {
  if (!Number.isFinite(positionMs) || positionMs < 0) return -1;
  for (let index = words.length - 1; index >= 0; index--) {
    if (seekableWord(words[index], durationMs) && words[index].start_ms <= positionMs && positionMs < words[index].end_ms) return index;
  }
  return -1;
}

/** Preserve original punctuation and whitespace while assigning spans to timestamped words. */
export function transcriptSpans(transcript: Transcript): { text: string; wordIndex: number | null }[] {
  const spans: { text: string; wordIndex: number | null }[] = [];
  const plain = () => [{ text: transcript.text, wordIndex: null }];
  const separators = /^[\s\p{P}]*$/u;
  let cursor = 0;
  for (let index = 0; index < transcript.words.length; index++) {
    const token = transcript.words[index].text.trim();
    const start = token ? transcript.text.indexOf(token, cursor) : -1;
    const end = start + token.length;
    // Gaps may contain punctuation/whitespace, never omitted words. A token
    // cannot end inside another word (including a Hangul run or combining mark).
    if (start < 0 || !separators.test(transcript.text.slice(cursor, start)) ||
      (/[\p{L}\p{N}\p{M}_]$/u.test(token) && /^[\p{L}\p{N}\p{M}_]/u.test(transcript.text.slice(end)))) return plain();
    if (start > cursor) spans.push({ text: transcript.text.slice(cursor, start), wordIndex: null });
    spans.push({ text: token, wordIndex: index });
    cursor = end;
  }
  if (!separators.test(transcript.text.slice(cursor))) return plain();
  if (cursor < transcript.text.length) spans.push({ text: transcript.text.slice(cursor), wordIndex: null });
  return spans;
}

/** A recording's duration is authoritative; never extend it using transcript/native tails. */
export function seekableWord(word: TranscriptWord, duration: number): boolean {
  return Number.isSafeInteger(word.start_ms) && Number.isSafeInteger(word.end_ms) && word.start_ms >= 0 &&
    word.start_ms < word.end_ms && word.end_ms <= duration;
}
export function recordedVisits(events: import('../../contracts').SlideEvent[], duration: number): import('../../contracts').Visit[] {
  return events.map((e, i) => ({ slide_index: e.slide_index, start_ms: e.at_ms, end_ms: events[i + 1]?.at_ms ?? duration, words: [] }));
}
/** Half-open intervals; last simultaneous event wins, and hold the last page at EOF. */
export function activeVisitIndex(visits: import('../../contracts').Visit[], position: number): number {
  if (!Number.isFinite(position) || position < 0) return -1;
  for (let i = visits.length - 1; i >= 0; i--) if (visits[i].start_ms <= position) return i;
  return -1;
}

type ReviewPlayer = { seekTo(seconds: number): Promise<void>; play(): void; pause(): void };
/** One native seek at a time; a newer request replaces the queued target, never the user's pause. */
export function createPlaybackController(player: ReviewPlayer, changed: (playing: boolean) => void, failed: () => void) {
  let enabled = false, disposed = false, generation = 0, playing = false, running = false;
  let pending: { ms: number; duration: number; generation: number } | null = null;
  let inProgressGeneration: number | null = null;
  const pause = () => { playing = false; changed(false); try { player.pause(); } catch { /* Released native object. */ } };
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const target = pending; pending = null; inProgressGeneration = target.generation;
        try { await player.seekTo(target.ms / 1000); }
        catch { if (!disposed && enabled && target.generation === generation) { pause(); failed(); } }
        if (!disposed && enabled && target.generation === generation && !pending) {
          // An EOF event can arrive before seekTo settles. Only the final target
          // may end playing intent; an older EOF cannot override a queued seek.
          if (target.ms >= target.duration) pause();
          else if (playing) player.play();
        }
      }
    } catch { if (!disposed && enabled) { pause(); failed(); } }
    finally { running = false; inProgressGeneration = null; }
  }
  return {
    isPlaying: () => playing,
    // Expo Android can resume a host-paused player before JS receives foreground.
    activate() { if (!disposed && !enabled) { enabled = true; pause(); } },
    deactivate() { enabled = false; generation++; pending = null; pause(); },
    dispose() { disposed = true; enabled = false; generation++; pending = null; try { player.pause(); } catch { /* Released. */ } },
    pause,
    nativePaused() {
      // Seeks temporarily pause native playback while retaining user intent.
      // An ordinary native stop outside that transition (e.g. audio-focus loss)
      // must also clear intent so a later seek cannot restart playback.
      if (!disposed && enabled && playing && !running && !pending) pause();
    },
    finished(position: number, duration: number) {
      // During a seek the target owns intent. After settling, read actual native
      // position so a delayed EOF notification cannot stop playback elsewhere.
      if (!disposed && enabled && !running && !pending && Number.isFinite(position) &&
        Number.isFinite(duration) && duration > 0 && position >= duration) pause();
    },
    play(position: number, duration: number) {
      if (!enabled || disposed) return;
      playing = true; changed(true);
      if (running) {
        if (inProgressGeneration !== generation && !pending) pending = { ms: position >= duration - 50 ? 0 : position, duration, generation };
        return;
      }
      if (position >= duration - 50) { pending = { ms: 0, duration, generation }; player.pause(); void drain(); }
      else if (!running) { try { player.play(); } catch { pause(); failed(); } }
    },
    seek(ms: number, duration: number) {
      if (!enabled || disposed || !Number.isFinite(ms) || duration <= 0) return;
      pending = { ms: Math.round(Math.max(0, Math.min(ms, duration))), duration, generation };
      try { player.pause(); } catch { pause(); failed(); return; }
      void drain();
    },
  };
}

/** Instantaneous visits stay selectable in the list; transport moves to an actual interval. */
export function adjacentVisit(visits: import('../../contracts').Visit[], current: number, direction: -1 | 1): number {
  for (let i = current + direction; i >= 0 && i < visits.length; i += direction) {
    if (visits[i].end_ms > visits[i].start_ms) return i;
  }
  return -1;
}
