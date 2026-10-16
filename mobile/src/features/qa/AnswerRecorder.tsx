// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: records one Audience Q&A answer (kept on the phone).
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { AppState } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { stopCapture } from '../recording/stopCapture';

export type AnswerHandle = { start(): Promise<void>; stop(): Promise<{ uri: string; durationMs: number }>; recording(): boolean };

export const AnswerRecorder = forwardRef<AnswerHandle, { onMeter: (db: number, ms: number) => void; onMustStop: () => void }>(
  function AnswerRecorder({ onMeter, onMustStop }, ref) {
    const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true, directory: 'document' });
    const active = useRef(false);
    const cb = useRef({ onMeter, onMustStop });
    useEffect(() => { cb.current = { onMeter, onMustStop }; });
    useEffect(() => {
      const t = setInterval(() => {
        if (!active.current) return;
        try {
          const s = recorder.getStatus();
          cb.current.onMeter(typeof s.metering === 'number' ? s.metering : -160, s.durationMillis);
          if (s.durationMillis >= 300_000) cb.current.onMustStop();
        } catch { cb.current.onMustStop(); }
      }, 70);
      const sub = AppState.addEventListener('change', st => { if (st !== 'active' && active.current) cb.current.onMustStop(); });
      return () => { clearInterval(t); sub.remove(); };
    }, [recorder]);
    useImperativeHandle(ref, () => ({
      async start() {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error('Microphone permission was denied.');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (AppState.currentState !== 'active') throw new Error('Recording could not start. Please try again.');
        recorder.record();
        active.current = true;
      },
      async stop() {
        active.current = false;
        const { uri, durationMillis } = await stopCapture(recorder);
        return { uri, durationMs: durationMillis };
      },
      recording: () => active.current,
    }), [recorder]);
    return null;
  });
