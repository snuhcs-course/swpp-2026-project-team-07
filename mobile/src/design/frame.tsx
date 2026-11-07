// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode base: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: screens use a 390 × 844 design frame, with a 390 × 760 compact
// frame below 0.9 scale. Each frame scales uniformly inside the safe area; backgrounds
// are full-bleed. Screen-specific compact variants keep the text styles unchanged.
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

export type FrameInfo = { s: number; left: number; top: number; width: number; height: number; compact: boolean };
const FrameContext = createContext<FrameInfo>({ s: 1, left: 0, top: 0, width: FRAME_W, height: FRAME_H, compact: false });
const FooterMotionContext = createContext<SharedValue<number> | null>(null);
export const useFrame = () => useContext(FrameContext);
export const useFooterMotion = () => useContext(FooterMotionContext);

export function Frame({ children, background, landscape = false }: { children: ReactNode; background?: ReactNode; landscape?: boolean }) {
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
  const designW = landscape ? FRAME_H : FRAME_W;
  // Fullscreen rehearsal is designed to run edge-to-edge. Safe-area padding
  // here used to shrink the rotated canvas and leave visible black rails.
  const insetLeft = landscape ? 0 : insets.left;
  const insetRight = landscape ? 0 : insets.right;
  const insetTop = landscape ? 0 : insets.top;
  const insetBottom = landscape ? 0 : insets.bottom;
  const availW = Math.max(1, width - insetLeft - insetRight);
  const availH = Math.max(1, height - insetTop - insetBottom);
  const rotatedPortrait = landscape && width < height;
  const regularScale = rotatedPortrait
    ? Math.min(availH / designW, availW / FRAME_W)
    : Math.min(availW / designW, availH / (landscape ? FRAME_W : FRAME_H));
  const compact = !landscape && regularScale < 0.9;
  const designH = landscape ? FRAME_W : compact ? 760 : FRAME_H;
  const s = rotatedPortrait
    ? Math.min(availH / designW, availW / designH)
    : Math.min(availW / designW, availH / designH);
  const info = useMemo<FrameInfo>(() => ({
    s, width: landscape ? designW : width, height: landscape ? designH : height, compact,
    left: rotatedPortrait ? (width - designH * s) / 2 : insetLeft + (availW - designW * s) / 2,
    top: rotatedPortrait ? (height - designW * s) / 2 : insetTop + (availH - designH * s) / 2,
  }), [s, width, height, landscape, rotatedPortrait, compact, insetLeft, insetTop, availW, availH, designW, designH]);
  return (
    <FrameContext.Provider value={info}>
      <FooterMotionContext.Provider value={footerMotion}>
        <View style={[styles.root, { backgroundColor: c.bg }]}>
          {landscape ? null : background}
          <View style={[styles.canvas, { width: designW, height: designH,
            left: rotatedPortrait ? (width - designW) / 2 : info.left - (designW - designW * s) / 2,
            top: rotatedPortrait ? (height - designH) / 2 : info.top - (designH - designH * s) / 2,
            transform: rotatedPortrait ? [{ scale: s }, { rotate: '90deg' }] : [{ scale: s }] }]}>
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
