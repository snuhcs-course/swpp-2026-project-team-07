// OpenAI Codex Review and Full review: docs/ai-collaboration/iteration-2/prompt-log.md#review-and-full-review-redesign-october-15-2026
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Txt } from './frame';
import { EASE_SCREEN, F } from './tokens';
import { useTheme } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LENGTH = 345.58;

/** The shared 120-unit ring used on Home, Review and Full review. */
export function ScoreRing({ id, percent, value, label, labelColor, gradient, animate = false }: {
  id: string; percent: number | null; value: string; label: string; labelColor: string;
  gradient: readonly [string, string]; animate?: boolean;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const offset = useSharedValue(LENGTH * (1 - Math.max(0, Math.min(100, percent ?? 0)) / 100));
  useEffect(() => {
    const next = LENGTH * (1 - Math.max(0, Math.min(100, percent ?? 0)) / 100);
    offset.set(animate && !reduced ? withTiming(next, { duration: 450, easing: EASE_SCREEN }) : next);
  }, [animate, offset, percent, reduced]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return <View style={styles.box} accessible accessibilityLabel={`${value}, ${label}`}>
    <Svg width={120} height={120} viewBox="0 0 128 128" style={StyleSheet.absoluteFill}>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
        <Stop offset="0" stopColor={gradient[0]} /><Stop offset="1" stopColor={gradient[1]} />
      </LinearGradient></Defs>
      <Circle cx={64} cy={64} r={55} fill="none" stroke={c.track} strokeWidth={13} />
      <AnimatedCircle cx={64} cy={64} r={55} fill="none" stroke={`url(#${id})`} strokeWidth={13}
        strokeLinecap="round" strokeDasharray={`${LENGTH}`} animatedProps={arc} opacity={percent == null ? 0 : 1}
        transform="rotate(-90 64 64)" />
    </Svg>
    <Txt style={[styles.value, { color: c.text }]}>{value}</Txt>
    <Txt style={[styles.label, { color: labelColor }]}>{label}</Txt>
  </View>;
}

const styles = StyleSheet.create({
  box: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: F.display, fontSize: 30, lineHeight: 31, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  label: { marginTop: 4, fontFamily: F.semibold, fontSize: 11, lineHeight: 12, letterSpacing: 0.3 },
});
