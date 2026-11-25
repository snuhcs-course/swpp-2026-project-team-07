import React from 'react';
import { runtime } from './ai-overview-screen-native.mjs';
export { useFocusEffect } from './recording-screen-ui.mjs';
export { AppState, StyleSheet, View, Pressable, Txt, Circle, Defs, Path, Rect, Stop, LinearGradient,
  useSharedValue, withTiming, runOnJS } from './ai-overview-screen-native.mjs';

export const Text = 'text', Image = 'image', G = 'group', Ellipse = 'ellipse', ClipPath = 'clip-path';
export const Modal = 'privacy-modal', ScrollView = 'scroll';
export const Alert = { alert: (...args) => globalThis.storeAlert?.(...args) };
export const Linking = { openURL: async url => globalThis.openPolicy?.(url) };
export const RadialGradient = 'radial-gradient', PanView = 'pan', GestureDetector = 'gesture';
export const HomeFeedbackStats = 'home-stats', PresentationRequirementsEditor = 'requirements', PresentationSetupHint = 'setup-hint';
export const useWindowDimensions = () => ({ width: 390, height: 844 });
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
export const useReducedMotion = () => runtime.reducedMotion ?? false;
export const useAnimatedStyle = fn => fn();
export const useAnimatedProps = fn => fn();
export const useDerivedValue = fn => ({ get value() { return fn(); } });
export const useAnimatedReaction = (read, react) => {
  const previous = React.useRef();
  const next = read();
  React.useEffect(() => { react(next, previous.current); previous.current = next; }, [next]);
};
export const withRepeat = value => value;
export const withDelay = (_delay, value) => value;
export const withSequence = (...values) => values.at(-1);
export const cancelAnimation = () => {};
const identity = value => value;
export const Easing = { bezier: () => identity, out: () => identity, inOut: () => identity,
  linear: identity, cubic: identity, quad: identity, exp: identity };
export const usePanGesture = config => config;
export const useLongPressGesture = config => config;
export const useTapGesture = config => config;
export const useSimultaneousGestures = (...configs) => configs;
export const NotificationFeedbackType = { Warning: 'warning' }, ImpactFeedbackStyle = { Light: 'light' };
export const notificationAsync = async () => {};
export const impactAsync = async () => {};
const listeners = new Set();
export const BackHandler = { addEventListener(_event, handler) {
  listeners.add(handler);
  return { remove: () => listeners.delete(handler) };
} };
export function pressBack() {
  return [...listeners].reverse().some(handler => handler());
}
const Svg = props => React.createElement('svg', props);
export default Object.assign(Svg, { View: 'animated', createAnimatedComponent: component => component });
