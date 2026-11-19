import { requireOptionalNativeModule } from 'expo-modules-core';

export type CaptureSegment = {
  sequence: number;
  slide_index: number;
  start_ms: number;
  end_ms: number;
  uri: string;
};
export type CaptureManifest = {
  manifest_uri: string;
  full_uri: string;
  duration_ms: number;
  slide_events: { slide_index: number; at_ms: number }[];
  segments: CaptureSegment[];
  stopped: boolean;
  isRecording: boolean;
  metering: number;
  current_slide: number;
  error?: string;
};
type NativeRecorder = {
  start(initialSlide: number): Promise<CaptureManifest>;
  transition(slide: number): CaptureManifest;
  status(): CaptureManifest;
  stop(): Promise<CaptureManifest>;
  recover(manifestUri: string): CaptureManifest;
};
const native = requireOptionalNativeModule<NativeRecorder>('OutloudRecorder');
function recorder(): NativeRecorder {
  if (!native) throw new Error('Continuous recording requires the updated Android app.');
  return native;
}

export const continuousRecorder = {
  available: () => native !== null,
  start: (initialSlide: number) => recorder().start(initialSlide),
  transition: (slide: number) => recorder().transition(slide),
  status: () => recorder().status(),
  stop: () => recorder().stop(),
  recover: (manifestUri: string) => recorder().recover(manifestUri),
};
