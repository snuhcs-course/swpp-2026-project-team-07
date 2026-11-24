// Real screen and navigation, synthetic microphone/network and native view boundaries.
export * from './recording-cues-runtime-native.mjs';
export { default } from './recording-cues-runtime-native.mjs';
import React from 'react';
import { runtime, Easing as easing } from './recording-cues-runtime-native.mjs';
export const Easing = { ...easing, out: f => f };
export const Path = 'path', MiniSlide = 'mini-slide', StatusBar = 'status-bar';
export const OrientationLock = { PORTRAIT_UP: 1 }, lockAsync = async () => {};
export const useSafeAreaInsets = () => runtime.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
export const createThemedStyles = value => value;
export const useTheme = () => ({ c: new Proxy({}, { get: () => '#ffffff' }) });
export const useShell = () => ({ ...runtime.shell, setFullscreenLandscape: () => {} });
export const useSlideProfiles = () => ({ value: null, busy: false, refresh() {}, recover() {} });
export const cueState = () => ({ cues: [], message: '' });
export const CueGuidancePanel = 'cue-panel', PresentationRequirementsEditor = 'settings', PresentationSetupHint = 'setup-hint';
export const requirementsPending = () => false, defaultRequirementsPending = () => false;
export const readRequirementsDraft = () => null, getRequirementsVersion = () => 0;
export const subscribeRequirements = () => () => {};
export const captureVersion = () => 0, subscribeCaptures = () => () => {};
export const readCapture = id => runtime.incremental && id === 'synthetic-capture' ? { remote: { segments: [] } } : null;
export function LiveFeedbackPanel({ close }) { return React.createElement('live-feedback', { close }); }
export const CaptureEngine = React.forwardRef(function Capture(props, ref) {
  const [capture] = React.useState(() => {
    const value = { started: 0, recording: false, released: false, slides: [], props,
      async checkLiveFeedback() { return runtime.incremental; },
      async start(current) { this.started++; this.recording = true; this.slides.push(current()); this.props.onStarted?.('synthetic-capture'); },
      slideChanged(slide) { if (this.recording) this.slides.push(slide); },
      async stop() { if (!this.recording) throw new Error('Nothing is recording.'); this.recording = false; return { attemptId: 'synthetic-capture', durationMs: 5000, events: [{ slide_index: this.slides[0], at_ms: 0 }] }; },
      isRecording() { return this.recording; } };
    runtime.captures.push(value); return value;
  });
  capture.props = props;
  React.useImperativeHandle(ref, () => capture, [capture]);
  React.useEffect(() => () => { capture.released = true; }, [capture]);
  return null;
});
