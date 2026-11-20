import { useRef } from 'react';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE_SCREEN } from '../design/tokens';

/** Keeps content attached to a horizontal drag, then eases the selected content into place. */
export function useHorizontalSwipeMotion() {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const settling = useRef(false);
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : Math.max(0.3, 1 - Math.abs(x.value) / 190),
    transform: [{ translateX: reduced ? 0 : x.value * 0.38 }],
  }));
  const move = (dx: number) => { if (!reduced) {settling.current=false;x.set(Math.max(-150, Math.min(150, dx)));} };
  const settle = () => {if(settling.current||x.get()===0)return;settling.current=true;x.set(withTiming(0, { duration: reduced ? 0 : 460, easing: EASE_SCREEN }));};
  return { x, style, move, settle };
}
