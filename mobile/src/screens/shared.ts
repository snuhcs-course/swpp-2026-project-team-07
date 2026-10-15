// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex Full review navigation: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OpenAI Codex continuous Home glow and responsive navigation: docs/ai-collaboration-prompts-iteration-2.md#continuous-carousel-color-and-navigation-responsiveness-october-15-2026
// OutLoud redesign: navigation state shared by the screens.
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { BackHandler } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { EnterKind } from '../design/frame';

export type ScreenName = 'home' | 'upload' | 'rehearse' | 'review' | 'full' | 'compare' | 'qa';
export type NavState = { screen: ScreenName; nav: EnterKind; deckId: string | null; slide: number; sel: number; from: ScreenName | null; visit: number };
export type Go = (screen: ScreenName, patch?: Partial<Omit<NavState, 'screen' | 'visit'>>) => void;

/** Shared values the Home carousel and the Upload screen both drive (the carousel stays mounted behind Upload). */
export type HomeShared = {
  p: SharedValue<number>; vy: SharedValue<number>; gap: SharedValue<number>; hold: SharedValue<number>;
  /** Upload: 1 = fully blurred carousel with a gap; follows the swipe-down. */
  uploadBlur: SharedValue<number>;
  /** Upload analysing: the new icon shrinks into the progress ring. */
  analyzing: SharedValue<number>;
  /** PDF setup dims Home artwork beneath the blurred upload layer. */
  setup: SharedValue<number>;
  press: SharedValue<number>;
  picker: SharedValue<number>;
};

export const ShellContext = createContext<{ go: Go; nav: NavState; home: HomeShared } | null>(null);
export const HomeContext = createContext<{ go: Go; home: HomeShared } | null>(null);
export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error('Shell context missing');
  return value;
}
export function useHomeShell() {
  const value = useContext(HomeContext);
  if (!value) throw new Error('Home context missing');
  return value;
}

/** Android system Back does what swipe-down does on each screen (SPEC §7). Return true when handled.
 * The latest handler is used without re-registering the listener. */
export function useBack(active: boolean, handler: () => boolean) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => latest.current());
    return () => sub.remove();
  }, [active]);
}

// A coarse clock for relative labels ("Just now"), kept outside render so screens stay pure.
let now = Date.now();
const clockSubs = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
function tick() { now = Date.now(); clockSubs.forEach(f => f()); }
function subscribeClock(cb: () => void) {
  clockSubs.add(cb);
  if (!clockTimer) clockTimer = setInterval(tick, 30_000);
  const first = setTimeout(tick, 0);
  return () => {
    clearTimeout(first);
    clockSubs.delete(cb);
    if (!clockSubs.size && clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  };
}
/** Current time in ms, refreshed every 30 seconds while mounted. */
export function useNow() {
  return useSyncExternalStore(subscribeClock, () => now);
}
