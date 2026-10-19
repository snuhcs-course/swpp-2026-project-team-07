// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode base: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: the 390 × 844 design frame, scaled to the device.
// Every screen is laid out in design units (exactly as in the design bundle) and the
// whole frame is scaled uniformly to fit inside the safe area. Backgrounds are full-bleed.
// OpenAI Codex landscape follow-up: docs/ai-collaboration-prompts-iteration-2.md#landscape-rehearsal-implementation-october-15-2026
// OpenAI Codex portrait-only correction: docs/ai-collaboration-prompts-iteration-2.md#portrait-only-pdf-rotation-correction-october-15-2026
// OpenAI Codex semantic footer motion: docs/ai-collaboration-prompts-iteration-2.md#semantic-bottom-caption-motion-october-15-2026
// OpenAI Codex stationary page entrances: docs/ai-collaboration-prompts-iteration-2.md#stationary-forward-page-fades-october-15-2026
// OpenAI Codex stable frame context: docs/ai-collaboration-prompts-iteration-2.md#continuous-carousel-color-and-navigation-responsiveness-october-15-2026
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type TextProps } from 'react-native';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FRAME_H, FRAME_W } from './tokens';
import { useTheme } from './theme';

export type FrameInfo = { s: number; left: number; top: number; width: number; height: number };
const FrameContext = createContext<FrameInfo>({ s: 1, left: 0, top: 0, width: FRAME_W, height: FRAME_H });
const FooterMotionContext = createContext<SharedValue<number> | null>(null);
export const useFrame = () => useContext(FrameContext);
export const useFooterMotion = () => useContext(FooterMotionContext);

export function Frame({ children, background }: { children: ReactNode; background?: ReactNode }) {
  const { c } = useTheme();
  const reducedMotion = useReducedMotion();
  const footerMotion = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(footerMotion);
    footerMotion.set(0);
    if (reducedMotion) return;
    footerMotion.set(withRepeat(withTiming(2 * Math.PI, { duration: 4800, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(footerMotion);
  }, [footerMotion, reducedMotion]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const designW = FRAME_W;
  const designH = FRAME_H;
  const availW = Math.max(1, width - insets.left - insets.right);
  const availH = Math.max(1, height - insets.top - insets.bottom);
  const s = Math.min(availW / designW, availH / designH);
  const info = useMemo<FrameInfo>(() => ({
    s, width, height, left: insets.left + (availW - designW * s) / 2,
    top: insets.top + (availH - designH * s) / 2,
  }), [s, width, height, insets.left, insets.top, availW, availH, designW, designH]);
  return (
    <FrameContext.Provider value={info}>
      <FooterMotionContext.Provider value={footerMotion}>
        <View style={[styles.root, { backgroundColor: c.bg }]}>
          {background}
          <View style={[styles.canvas, { width: designW, height: designH,
            left: info.left - (designW - designW * s) / 2, top: info.top - (designH - designH * s) / 2,
            transform: [{ scale: s }] }]}>
            {children}
          </View>
        </View>
      </FooterMotionContext.Provider>
    </FrameContext.Provider>
  );
}

/** Text that keeps the design's sizes, allowing only a little system font scaling. */
export function Txt(props: TextProps) {
  return <Text maxFontSizeMultiplier={1.1} {...props} />;
}

export type EnterKind = 'rise' | 'zoom' | 'fade' | null;
/** Fade newly opened pages in place on the UI thread; keep the layout and touch targets fixed. */
export function Enter({ kind, children, style, pointerEvents }: { kind: EnterKind; children: ReactNode; style?: object; pointerEvents?: 'box-none' | 'auto' }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(kind && !reducedMotion ? 0 : 1);
  const [entered, setEntered] = useState(!kind || reducedMotion);
  useEffect(() => {
    let cancelled = false;
    const complete = () => { if (!cancelled) setEntered(true); };
    opacity.set(withTiming(1, { duration: kind && !reducedMotion ? 220 : 0, easing: Easing.out(Easing.cubic) }, finished => {
      if (finished) runOnJS(complete)();
    }));
    return () => { cancelled = true; cancelAnimation(opacity); };
  }, [kind, opacity, reducedMotion]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // Fabric can reapply an animated style's initial opacity on a later React
  // commit. Once the entrance finishes, React must own the opaque final value.
  const visible = entered || !kind || reducedMotion;
  return <Animated.View pointerEvents={pointerEvents} style={[StyleSheet.absoluteFill, style, visible ? { opacity: 1 } : fade]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  canvas: { position: 'absolute', width: FRAME_W, height: FRAME_H },
});
