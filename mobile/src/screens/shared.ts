// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OpenAI Codex Full review navigation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-122
// OpenAI Codex follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-047
// OpenAI Codex continuous Home glow and responsive navigation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-114
// OutLoud redesign: navigation state shared by the screens.
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { BackHandler } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { EnterKind } from '../design/frame';
import { readStored } from '../services/storage';

// OpenAI Codex, 2026-11-23: the access gate and Home use the same first-run flag.
export const TUTORIAL_SEEN = 'tutorial.seen';
export function hasSeenTutorial() {
  try { return !!readStored<boolean>(TUTORIAL_SEEN); } catch { return true; }
}

export type ScreenName = 'home' | 'upload' | 'rehearse' | 'review' | 'wait' | 'full' | 'listen' | 'feedback' | 'compare' | 'qa';
export type NavState = { screen: ScreenName; nav: EnterKind; deckId: string | null; slide: number; sel: number; from: ScreenName | null; visit: number; editRequirements?: boolean; swipeFrom?: number };
export type Go = (screen: ScreenName, patch?: Partial<Omit<NavState, 'screen' | 'visit'>>) => void;

/** Shared values the Home carousel and the Upload screen both drive (the carousel stays mounted behind Upload). */
export type HomeShared = {
  p: SharedValue<number>; vy: SharedValue<number>; gap: SharedValue<number>; hold: SharedValue<number>;
  /** Shared Add transition progress from Home (0) to the open picker (1). */
  uploadBlur: SharedValue<number>;
  /** Upload dismissal progress from the resting screen (0) to Home (1). */
  uploadReturn: SharedValue<number>;
  /** Upload analysing: the new icon shrinks into the progress ring. */
  analyzing: SharedValue<number>;
  /** PDF setup dims Home artwork beneath the blurred upload layer. */
  setup: SharedValue<number>;
  press: SharedValue<number>;
  picker: SharedValue<number>;
  /** Return progress from resting rehearsal (0) to the Home card (1). */
  titleReturn: SharedValue<number>;
};

type PageFooterHandoff = {
  exit: SharedValue<{ epoch: number; progress: number }>;
  epoch: number;
  underlay: NavState | null;
};

export const ShellContext = createContext<{ go: Go; nav: NavState; home: HomeShared; footerHandoff?: PageFooterHandoff; setFullscreenLandscape: (value: boolean) => void } | null>(null);
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
