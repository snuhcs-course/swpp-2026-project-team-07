// AI-generated/modified with OpenAI Codex, Iteration 2 (2026-10-15).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#guide-based-light-mode-october-15-2026
// OpenAI Codex half-turn correction: docs/ai-collaboration/iteration-2/prompt-log.md#theme-toggle-half-turn-correction-october-15-2026
// OpenAI Codex sun dots: docs/ai-collaboration/iteration-2/prompt-log.md#theme-toggle-sun-dots-october-15-2026
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { EASE_SCREEN } from './tokens';
import { useTheme } from './theme';

const SUN_DOTS = [[110, -410.5], [300.5, -300.5], [410.5, -110],
  [410.5, 110], [300.5, 300.5], [110, 410.5]];

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const reduced = useReducedMotion();
  const turns = useSharedValue(mode === 'light' ? 1 : 0);
  const targetTurns = useRef(mode === 'light' ? 1 : 0);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const next = ++targetTurns.current;
    turns.set(reduced ? next : withTiming(next, { duration: 560, easing: EASE_SCREEN }));
  }, [mode, reduced, turns]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 + 180 * turns.value}deg` }] }));
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel="Light mode" accessibilityState={{ checked: mode === 'light' }}
      onPress={toggle} hitSlop={4} style={styles.hit}>
      <Animated.View style={spin}>
        <Svg width={42} height={42} viewBox="-525 -525 1050 1050" accessibilityElementsHidden>
          <Circle cx={0} cy={0} r={278.5} fill="#FFE550" />
          <Path d="M0 -279.5 A279.5 279.5 0 0 0 0 279.5 Z" fill="#9B9A96" />
          <Circle cx={-89} cy={-169} r={32} fill="#78777C" />
          <Path d="M-121 -72 V-60 A57 57 0 0 1 -178 -3" fill="none" stroke="#78777C" strokeWidth={38} strokeLinecap="round" />
          <Circle cx={-110} cy={101} r={54} fill="#78777C" />
          <Path d="M189 76 A204 204 0 0 1 80 188" fill="none" stroke="#FFD400" strokeWidth={34} strokeLinecap="round" />
          {SUN_DOTS.map(([cx, cy]) => <Circle key={`${cx},${cy}`} cx={cx} cy={cy} r={35} fill="#FFE550" />)}
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // OpenAI Codex header alignment: docs/ai-collaboration/iteration-2/prompt-log.md#home-header-vertical-alignment-october-15-2026
  hit: { position: 'absolute', top: 50, right: 22, width: 44, height: 44, zIndex: 40, alignItems: 'center', justifyContent: 'center' },
});
