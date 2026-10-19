import { useState } from 'react';
export const players = [];
export const mode = { wait: null };
export async function setAudioModeAsync() { if (mode.wait) await mode.wait; }
export const AppState = { addEventListener() { return { remove() {} }; } };
export function useAudioPlayer() {
  const [player] = useState(() => {
    const p = { isLoaded: true, playing: false, currentTime: 0, seeks: [], plays: 0, replacements: [], seekWait: null,
      replace(source) { this.replacements.push(source.uri); },
      pause() { this.playing = false; },
      play() { this.plays++; this.playing = true; },
      async seekTo(t) { this.seeks.push(t); if (this.seekWait) await this.seekWait; if (this.seekFails) throw new Error('synthetic seek failure'); this.currentTime = t; },
    };
    players.push(p); return p;
  });
  return player;
}
