import React from 'react';
export const Text = 'text';
export const View = 'view';
export const TextInput = 'input';
export const ActivityIndicator = 'indicator';
export const Card = 'card';
export function Screen({ children, footer, header }) { return React.createElement('screen', null, header, children, footer); }
export const styles = {};
export const colors = {};
export const DemoNotice = 'demo-notice';
export function Action(props) { return React.createElement('action', props); }
export function SlidePreview(props) { return React.createElement('slide', props); }
export const routes = [];
let routeParams = {};
export function setRouteParams(params = {}) { routeParams = params; routes.length = 0; }
export const router = { push(route) { routes.push(route); }, navigate(route) { routes.push(route); }, back() { routes.push('back'); } };
export function useLocalSearchParams() { return routeParams; }

let removal = null;
export function usePreventRemove(enabled, callback) {
  React.useEffect(() => { removal = enabled ? callback : null; return () => { removal = null; }; }, [enabled, callback]);
}
export function requestBack() { if (!removal) return false; removal({ data: { action: { type: 'GO_BACK' } } }); return true; }
const appListeners = new Set();
export const AppState = { currentState: 'active', addEventListener(_event, callback) { appListeners.add(callback); return { remove() { appListeners.delete(callback); } }; } };
export function backgroundApp(state) { AppState.currentState = state; for (const callback of appListeners) callback(state); }

let focused = true;
const focusEffects = new Map();
const focusListeners = new Set();
export function setFocused(value) {
  focused = value;
  for (const [callback, cleanup] of focusEffects) {
    cleanup?.(); focusEffects.set(callback, value ? callback() : undefined);
  }
  for (const listener of focusListeners) listener();
}
export function useIsFocused() {
  return React.useSyncExternalStore(callback => { focusListeners.add(callback); return () => focusListeners.delete(callback); }, () => focused);
}
export function useFocusEffect(callback) {
  React.useEffect(() => {
    focusEffects.set(callback, focused ? callback() : undefined);
    return () => { focusEffects.get(callback)?.(); focusEffects.delete(callback); };
  }, [callback]);
}
export const Pressable = 'pressable';
export const ScrollView = 'scroll-view';
export const Icon = 'icon';
export const Brand = 'brand';
export const Chip = 'chip';
export function Notice({ title, text }) { return React.createElement('notice', null, title, text); }
export function IconButton(props) { return React.createElement('action', props); }
export function TextAction(props) { return React.createElement('action', props); }
export function RecordControl(props) { return React.createElement('action', props); }
export const SlideProgress = 'slide-progress';
export function TabBar(props) { return React.createElement('tab-bar', props); }
export function Panel({ visible, children }) { return React.createElement('panel', { visible, accessibilityElementsHidden: !visible }, children); }
export function useWindowDimensions() { return { width: 390, height: 844, fontScale: 1 }; }
export const Stack = Object.assign(({ children }) => children, { Screen: 'stack-screen' });
export const Tabs = Object.assign(({ children }) => children, { Screen: 'tabs-screen' });

export const StatusBar = 'status-bar';

export const SafeAreaView = 'safe-area';

export const StyleSheet = { create: value => value };
