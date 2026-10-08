import { useEffect, useRef, useState } from 'react';
export const RecordingPresets = { HIGH_QUALITY: {} };
export const AudioModule = { requestRecordingPermissionsAsync: async () => ({ granted: true }) };
export async function setAudioModeAsync() {}
export const captures = [];
export let failNextStart = false;
export function resetCaptureFixture(failStart = false) { captures.length = 0; failNextStart = failStart; }
export function useAudioRecorder(options, listener) {
  const callback = useRef(listener);
  callback.current = listener;
  const [recorder] = useState(() => {
    const listeners = new Set();
    const emit = status => { callback.current?.(status); for (const listener of listeners) listener(status); };
    const capture = {
      isPrepared: false, isRecording: false, released: false, uri: 'file:///test.m4a',
      durationMillis: 1000,
      async prepareToRecordAsync() {
        if (this.isPrepared) throw new Error('already prepared');
        if (this.prepareWait) await this.prepareWait;
        this.isPrepared = true;
      },
      record() {
        if (failNextStart) { failNextStart = false; throw new Error('native start failed'); }
        this.isRecording = true;
      },
      pause() { this.isRecording = false; },
      async stop() { if (this.stopWait) await this.stopWait; this.isPrepared = false; this.isRecording = false; queueMicrotask(() => this.emitFinished()); },
      addListener(_event, listener) { listeners.add(listener); return { remove() { listeners.delete(listener); } }; },
      getStatus() { return { canRecord: this.isPrepared, isRecording: this.isRecording, durationMillis: this.durationMillis }; },
      emitFinished() { emit({ hasError: false, isFinished: true, url: this.uri }); },
      emitError() { emit({ hasError: true, isFinished: true, url: null }); },
    };
    captures.push(capture);
    return capture;
  });
  // Mirrors the hook's native SharedObject lifetime; errors alone do not release it.
  useEffect(() => () => {
    recorder.released = true;
    recorder.isPrepared = false;
    recorder.isRecording = false;
  }, [recorder]);
  return recorder;
}
export function useAudioRecorderState(recorder) { return recorder.getStatus(); }
