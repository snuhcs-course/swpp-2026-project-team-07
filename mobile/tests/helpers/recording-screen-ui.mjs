import React from 'react';
export const Text = 'text';
export const View = 'view';
export const TextInput = 'input';
export const ActivityIndicator = 'indicator';
export const Card = 'card';
export const Screen = 'screen';
export const styles = {};
export const colors = {};
export const DemoNotice = 'demo-notice';
export function Action(props) { return React.createElement('action', props); }
export function SlidePreview(props) { return React.createElement('slide', props); }
export const routes = [];
let routeParams = {};
export function setRouteParams(params = {}) { routeParams = params; routes.length = 0; }
export const router = { push(route) { routes.push(route); } };
export function useLocalSearchParams() { return routeParams; }

let removal = null;
export function usePreventRemove(enabled, callback) {
  React.useEffect(() => { removal = enabled ? callback : null; return () => { removal = null; }; }, [enabled, callback]);
}
export function requestBack() { if (!removal) return false; removal({ data: { action: { type: 'GO_BACK' } } }); return true; }
const appListeners = new Set();
export const AppState = { currentState: 'active', addEventListener(_event, callback) { appListeners.add(callback); return { remove() { appListeners.delete(callback); } }; } };
export function backgroundApp(state) { AppState.currentState = state; for (const callback of appListeners) callback(state); }
