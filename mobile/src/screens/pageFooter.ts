import { useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { BACK_FADE_Y } from '../domain/gestures';
import { useShell, type ScreenName } from './shared';

/** Hand off pinned hints with the page fade. Incoming hints belong to the actual visible return destination. */
export function usePageFooter(active: boolean, distance?: SharedValue<number>, destination?: ScreenName) {
  const { nav, footerHandoff } = useShell();
  const exit = footerHandoff?.exit;
  const epoch = footerHandoff?.epoch;
  const visit = nav.visit;
  const underlay = footerHandoff?.underlay;
  const incoming = !active && !!underlay && underlay.visit === visit;
  const outgoing = active && !!underlay && underlay.screen === destination && underlay.deckId === nav.deckId;
  useAnimatedReaction(
    () => outgoing && distance ? Math.max(0, Math.min(1, distance.value / BACK_FADE_Y)) : 0,
    progress => {
      if (exit && outgoing && epoch !== undefined && epoch >= exit.value.epoch) exit.set({ epoch, progress });
    },
  );
  const style = useAnimatedStyle(() => {
    if (active) return { opacity: Math.max(0, 1 - 2 * Math.max(0, distance?.value ?? 0) / BACK_FADE_Y) };
    const transition = exit?.value;
    const progress = incoming && transition?.epoch === epoch ? transition?.progress ?? 0 : 0;
    return { opacity: Math.max(0, 2 * progress - 1) };
  });
  return { visible: active || incoming, style };
}
