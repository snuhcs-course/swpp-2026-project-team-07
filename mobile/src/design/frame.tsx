// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: the 390 × 844 design frame, scaled to the device.
// Every screen is laid out in design units (exactly as in the design bundle) and the
// whole frame is scaled uniformly to fit inside the safe area. Backgrounds are full-bleed.
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type TextProps } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DARK, DUR, EASE_SCREEN, FRAME_H, FRAME_W } from './tokens';

export type FrameInfo = { s: number; left: number; top: number; width: number; height: number };
const FrameContext = createContext<FrameInfo>({ s: 1, left: 0, top: 0, width: FRAME_W, height: FRAME_H });
export const useFrame = () => useContext(FrameContext);

export function Frame({ children, background }: { children: ReactNode; background?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availH = Math.max(1, height - insets.top - insets.bottom);
  const s = Math.min(width / FRAME_W, availH / FRAME_H);
  const info: FrameInfo = { s, width, height, left: (width - FRAME_W * s) / 2, top: insets.top + (availH - FRAME_H * s) / 2 };
  return (
    <FrameContext.Provider value={info}>
      <View style={styles.root}>
        {background}
        <View style={[styles.canvas, { left: (width - FRAME_W) / 2, top: insets.top + (availH - FRAME_H) / 2, transform: [{ scale: s }] }]}>
          {children}
        </View>
      </View>
    </FrameContext.Provider>
  );
}

/** Text that keeps the design's sizes, allowing only a little system font scaling. */
export function Txt(props: TextProps) {
  return <Text maxFontSizeMultiplier={1.1} {...props} />;
}

export type EnterKind = 'rise' | 'zoom' | 'fade' | null;
/** Screen entrance (SPEC §2 screen transitions): rise 460 ms, zoom 420 ms, fade 420 ms. */
export function Enter({ kind, children, style, pointerEvents }: { kind: EnterKind; children: ReactNode; style?: object; pointerEvents?: 'box-none' | 'auto' }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(kind && !reduced ? 0 : 1);
  useEffect(() => {
    if (kind && !reduced) v.set(withTiming(1, { duration: DUR[kind], easing: EASE_SCREEN }));
  }, [kind, reduced, v]);
  const anim = useAnimatedStyle(() => {
    const t = v.value;
    const transform = kind === 'rise' ? [{ translateY: (1 - t) * 80 }] : kind === 'zoom' ? [{ scale: 0.92 + 0.08 * t }] : kind === 'fade' ? [{ scale: 1.04 - 0.04 * t }] : [];
    return { opacity: t, transform };
  });
  return <Animated.View pointerEvents={pointerEvents} style={[StyleSheet.absoluteFill, anim, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK, overflow: 'hidden' },
  canvas: { position: 'absolute', width: FRAME_W, height: FRAME_H },
});
