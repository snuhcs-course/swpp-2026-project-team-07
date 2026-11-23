// OpenAI Codex, Iteration 2 (2026-11-20): adapted the supplied flag-and-arrow artwork
// to the existing saved language preference. Geometry matches the supplied 44x44 SVGs.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE_SCREEN, F } from './tokens';
import { Txt, useFrame } from './frame';
import { getAppLanguage, setAppLanguage, useAppLanguage } from './language';
import { useTheme } from './theme';

// Flag colours are fixed in both themes, like the sun/moon's yellow.
const KO_RED = '#CD2E3A', KO_BLUE = '#0047A0', EN_BLUE = '#012169', EN_RED = '#C8102E', WHITE = '#FFFFFF';
const R = 13;
const ARROW_ARCS = ["M4.90 15.78 A18.2 18.2 0 0 1 25.78 4.20", "M39.10 28.22 A18.2 18.2 0 0 1 18.22 39.80"];
const ARROW_HEADS = ["M25.82 1.14 L28.91 4.86 L24.57 7.01 Z", "M18.18 42.86 L15.09 39.14 L19.43 36.99 Z"];
const TAEGEUK_RED = 'M9 22 A13 13 0 0 1 35 22 A6.5 6.5 0 0 0 22 22 A6.5 6.5 0 0 1 9 22 Z';
const UNION_DIAGONALS = 'M-4 9 L48 35 M48 9 L-4 35';
const UNION_COUNTERCHANGE = 'M22 22 L48 22 L48 35 Z M22 22 L22 35 L-4 35 Z M22 22 L-4 22 L-4 9 Z M22 22 L22 9 L48 9 Z';
const UNION_CROSS = 'M22 9 V35 M-4 22 H48';

function TaegeukDisc() {
  return (
    <Svg width={42} height={42} viewBox="0 0 44 44">
      <Defs><ClipPath id="olLangDiscKo"><Circle cx={22} cy={22} r={R} /></ClipPath></Defs>
      <G clipPath="url(#olLangDiscKo)">
        <Circle cx={22} cy={22} r={R} fill={KO_BLUE} />
        <Path d={TAEGEUK_RED} fill={KO_RED} />
      </G>
    </Svg>
  );
}
function UnionDisc() {
  return (
    <Svg width={42} height={42} viewBox="0 0 44 44">
      <Defs>
        <ClipPath id="olLangDiscEn"><Circle cx={22} cy={22} r={R} /></ClipPath>
        <ClipPath id="olLangUnionT"><Path d={UNION_COUNTERCHANGE} /></ClipPath>
      </Defs>
      <G clipPath="url(#olLangDiscEn)">
        <Rect x={-4} y={9} width={52} height={26} fill={EN_BLUE} />
        <Path d={UNION_DIAGONALS} stroke={WHITE} strokeWidth={5.2} />
        <Path d={UNION_DIAGONALS} stroke={EN_RED} strokeWidth={3.4667} clipPath="url(#olLangUnionT)" />
        <Path d={UNION_CROSS} stroke={WHITE} strokeWidth={8.6667} />
        <Path d={UNION_CROSS} stroke={EN_RED} strokeWidth={5.2} />
      </G>
    </Svg>
  );
}
function Ring({ color }: { color: string }) {
  // Hairline round the disc so the Union flag's white never melts into the light background.
  return <Svg width={42} height={42} viewBox="0 0 44 44"><Circle cx={22} cy={22} r={12.6} fill="none" stroke={color} strokeWidth={0.8} /></Svg>;
}
function Arrows({ color }: { color: string }) {
  return (
    <Svg width={42} height={42} viewBox="0 0 44 44">
      {ARROW_ARCS.map(d => <Path key={d} d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />)}
      {ARROW_HEADS.map(d => <Path key={d} d={d} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />)}
    </Svg>
  );
}

export function LanguageToggle({ featureScreen = false, landscape = false, inline = false }: {
  featureScreen?: boolean; landscape?: boolean; inline?: boolean;
}) {
  const lang = useAppLanguage();
  const [saveFailed, setSaveFailed] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  const toggle = () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    const saved = setAppLanguage(getAppLanguage() === 'en' ? 'ko' : 'en');
    setSaveFailed(!saved);
    if (!saved) noticeTimer.current = setTimeout(() => setSaveFailed(false), 4000);
  };
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const featurePosition = landscape ? {
    // Frame rotates the portrait canvas clockwise in fullscreen.
    top: Math.max(0, insets.right - frame.left) / frame.s + 8,
    left: Math.max(0, insets.top - frame.top) / frame.s + 12,
  } : styles.featureHit;
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const turns = useSharedValue(0);
  const targetTurns = useRef(0);
  const ko = useSharedValue(lang === 'ko' ? 1 : 0);
  const previous = useRef(lang);
  useEffect(() => {
    if (previous.current === lang) return;
    previous.current = lang;
    const target = lang === 'ko' ? 1 : 0;
    if (reduced) { ko.set(withTiming(target, { duration: 160 })); return; }
    const next = ++targetTurns.current;
    turns.set(withTiming(next, { duration: 420, easing: EASE_SCREEN }));
    ko.set(withDelay(110, withTiming(target, { duration: 200 })));
  }, [lang, reduced, turns, ko]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * turns.value}deg` }] }));
  const koStyle = useAnimatedStyle(() => ({ opacity: ko.value }));
  const enStyle = useAnimatedStyle(() => ({ opacity: 1 - ko.value }));
  return (
    <><Pressable accessibilityRole="switch" accessibilityLabel={lang === 'ko' ? '앱 언어: 한국어' : 'App language: English'}
      accessibilityHint={lang === 'ko' ? '영어로 전환합니다.' : 'Switch to Korean.'}
      accessibilityState={{ checked: lang === 'ko' }} onPress={toggle} hitSlop={4}
      style={inline ? styles.inlineHit : [styles.hit, featureScreen && featurePosition]}>
      <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={[StyleSheet.absoluteFill, enStyle]}><UnionDisc /></Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, koStyle]}><TaegeukDisc /></Animated.View>
        <View style={StyleSheet.absoluteFill}><Ring color={c.ink20} /></View>
        <Animated.View style={[StyleSheet.absoluteFill, spin]}><Arrows color={c.text} /></Animated.View>
      </View>
      {inline && <Txt verbatim style={[styles.inlineLabel, { color: c.text }]}>English / 한국어</Txt>}
    </Pressable>
    {saveFailed && <View pointerEvents="none" accessibilityRole="alert"
      style={[styles.notice, inline && styles.inlineNotice, { backgroundColor: c.surface, borderColor: c.hair }]}>
      <Txt style={[styles.noticeText, { color: c.text }]}>Language changed for this session. Your preference could not be saved.</Txt>
    </View>}</>
  );
}

const styles = StyleSheet.create({
  // Mirrors ThemeToggle (right 18): same y-centre as the Home wordmark (top 57, 36 high → centre 75).
  hit: { position: 'absolute', top: 53, left: 18, width: 44, height: 44, zIndex: 40, alignItems: 'center', justifyContent: 'center' },
  inlineHit: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineLabel: { fontFamily: F.semibold, fontSize: 15 },
  featureHit: { top: 3, left: 16 },
  notice: { position: 'absolute', left: 18, right: 18, top: 109, zIndex: 60, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  inlineNotice: { position: 'relative', left: 0, right: 0, top: 0 },
  noticeText: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  box: { width: 42, height: 42 },
});
