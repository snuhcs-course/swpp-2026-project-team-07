// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex twenty-minute capture: docs/ai-collaboration/iteration-2/prompt-log.md#presentation-time-and-audience-setup-october-15-2026
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: microphone capture for one take.
// Ported from the former RehearsalScreen without changing its rules: the recording
// service owns the audio clock and slide events, a durable checkpoint is written every
// second, Android stop is awaited via stopCapture, and every finished take is saved as
// a local attempt that uploads and transcribes automatically (auto_process_api).
// The parent remounts this component after every take so a released native recorder
// can never affect a later take.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { RecordingPresets, useAudioRecorder } from 'expo-audio';
import type { SlideEvent } from '../../contracts';
import { API_URL } from '../../services/api';
import { createRecordingService } from '../recording/service';
import { stopCapture } from '../recording/stopCapture';
import { STOP_RECORDING_MS, VOICE_RECORDING_OPTIONS } from '../recording/limits';
import { beginAttempt, checkpointAttempt, interruptAttempt, recoverPendingAttempts } from '../recording/storage';

export type FinishedTake = { attemptId: string; durationMs: number; events: SlideEvent[] };
export type CaptureHandle = {
  /** Ask for the microphone, prepare and start. Resolves once audio is being captured. */
  start(slide: () => number): Promise<void>;
  /** Timestamp a slide change on the recorder's own clock. */
  slideChanged(slide: number): void;
  stop(): Promise<FinishedTake>;
  isRecording(): boolean;
};
type Props = {
  deck: { id: string; title: string; uri: string; pageCount: number };
  audience?: string;
  /** Metering in dBFS and elapsed audio time, about every 70 ms while recording. */
  onMeter: (db: number, elapsedMs: number) => void;
  /** Capture failed or the app went to the background; the take is kept for recovery. */
  onInterrupted: (message: string) => void;
  /** Reached the 20-minute limit, or the app left the foreground: the screen should stop. */
  onMustStop: () => void;
};

export const CaptureEngine = forwardRef<CaptureHandle, Props>(function CaptureEngine({ deck, audience = '', onMeter, onInterrupted, onMustStop }, ref) {
  const attemptId = useRef('');
  const phase = useRef<'ready' | 'starting' | 'recording' | 'stopping' | 'done'>('ready');
  const failed = useRef(false);
  const lastCheckpoint = useRef(-1);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const callbacks = useRef({ onMeter, onInterrupted, onMustStop });
  useEffect(() => { callbacks.current = { onMeter, onInterrupted, onMustStop }; });

  const fail = useCallback((message: string) => {
    if (failed.current) return;
    failed.current = true;
    try { if (attemptId.current) interruptAttempt(attemptId.current, message); }
    catch { message += ' Could not update saved metadata. The previous checkpoint and audio file are retained.'; }
    callbacks.current.onInterrupted(message);
  }, []);

  // directory "document" keeps audio out of the system-cleared cache.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, ...VOICE_RECORDING_OPTIONS, isMeteringEnabled: true, directory: 'document' }, status => {
    if ((status.hasError || (status.isFinished && phase.current === 'recording')) && mounted.current) {
      fail('The recording could not be finalized. Any checkpoint remains in saved rehearsals.');
    }
  });
  // Memoized: the service holds the take's private slide-event list.
  const service = useMemo(() => createRecordingService(recorder), [recorder]);

  const checkpoint = useCallback(() => {
    if (!attemptId.current || phase.current !== 'recording') return;
    const duration = Math.floor(recorder.getStatus().durationMillis);
    checkpointAttempt(attemptId.current, recorder.uri ?? '', duration, service.getSlideEvents());
    lastCheckpoint.current = duration;
  }, [recorder, service]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (phase.current !== 'recording') return;
      try {
        const status = recorder.getStatus();
        callbacks.current.onMeter(typeof status.metering === 'number' ? status.metering : -160, status.durationMillis);
        if (status.durationMillis - lastCheckpoint.current >= 1000) checkpoint();
        if (status.durationMillis >= STOP_RECORDING_MS) callbacks.current.onMustStop();
      } catch {
        callbacks.current.onMustStop();
      }
    }, 70);
    return () => clearInterval(timer);
  }, [checkpoint, recorder]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      // The permission dialog briefly backgrounds the app during start; only a running capture stops.
      if (state !== 'active' && phase.current === 'recording') callbacks.current.onMustStop();
    });
    return () => sub.remove();
  }, []);

  useImperativeHandle(ref, () => ({
    async start(slide) {
      if (phase.current !== 'ready') throw new Error('This take has already started.');
      phase.current = 'starting';
      try {
        recoverPendingAttempts();
        await service.start(() => {
          if (!mounted.current || failed.current || AppState.currentState !== 'active') throw new Error('Recording could not start. Please try again.');
          return slide();
        }, (uri, first) => {
          attemptId.current = beginAttempt({ id: deck.id, title: deck.title, uri: deck.uri, pageCount: deck.pageCount }, audience, first, uri);
        });
        phase.current = 'recording';
      } catch (error) {
        phase.current = 'done';
        const message = error instanceof Error ? error.message : 'Could not start recording.';
        // As before: a take that was registered but never ran is kept as interrupted, not left "capturing".
        try { if (attemptId.current) interruptAttempt(attemptId.current, message); } catch { /* recovered on next launch */ }
        throw new Error(message);
      }
    },
    slideChanged(slide) {
      if (phase.current !== 'recording') return;
      service.onSlideChanged(slide);
      try { checkpoint(); } catch { callbacks.current.onMustStop(); }
    },
    async stop() {
      if (phase.current !== 'recording') throw new Error('Nothing is recording.');
      phase.current = 'stopping';
      try {
        const { uri, durationMillis } = await stopCapture(recorder);
        const events = service.getSlideEvents(durationMillis);
        if (!attemptId.current) throw new Error('The recording metadata could not be found.');
        checkpointAttempt(attemptId.current, uri, durationMillis, events, true, API_URL);
        phase.current = 'done';
        return { attemptId: attemptId.current, durationMs: durationMillis, events };
      } catch (error) {
        phase.current = 'done';
        const message = error instanceof Error ? error.message : 'Could not stop recording.';
        fail(message);
        throw new Error(message);
      }
    },
    isRecording: () => phase.current === 'recording',
  }), [audience, checkpoint, deck.id, deck.pageCount, deck.title, deck.uri, fail, recorder, service]);

  return null;
});
