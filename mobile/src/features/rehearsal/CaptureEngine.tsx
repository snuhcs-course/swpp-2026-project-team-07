// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex historical twenty-minute capture: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-107
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: microphone capture for one take.
// Ported from the former RehearsalScreen without changing its rules: the recording
// service owns the audio clock and slide events, a durable checkpoint is written every
// second, Android stop is awaited via stopCapture, and every finished take is saved as
// a local attempt that uploads and transcribes automatically (auto_process_api).
// The parent remounts this component after every take so a released native recorder
// can never affect a later take.
import { useUiText } from '../../design/language';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import type { SlideEvent } from '../../contracts';
import { API_URL } from '../../services/api';
import { onlineAllowed } from '../../services/storePrivacy';
import { createRecordingService } from '../recording/service';
import { stopCapture } from '../recording/stopCapture';
import { STOP_RECORDING_MS, VOICE_RECORDING_OPTIONS } from '../recording/limits';
import { beginAttempt, checkpointAttempt, interruptAttempt, recoverPendingAttempts } from '../recording/storage';

import { continuousRecorder } from '../../../modules/outloud-recorder';
import { checkpointCapture, incrementalAvailable, registerCapture } from '../recording/incremental';
import { hasAnalysisConsent, saveAnalysisConsent } from '../transcription/analysisStorage';
import { enableInitialQa } from '../qa/automatic';

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
  preferIncremental?: boolean;
  onStarted?: (id: string) => void;
  /** Metering in dBFS and elapsed audio time, about every 70 ms while recording. */
  onMeter: (db: number, elapsedMs: number) => void;
  /** Capture failed or the app went to the background; the take is kept for recovery. */
  onInterrupted: (message: string) => void;
  /** Reached the 30-minute limit, or the app left the foreground: the screen should stop. */
  onMustStop: () => void;
};

export const CaptureEngine = forwardRef<CaptureHandle, Props>(function CaptureEngine({ deck, audience = '', preferIncremental = true, onStarted, onMeter, onInterrupted, onMustStop }, ref) {
  const ui = useUiText();
  const attemptId = useRef('');
  const incremental = useRef(false);
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
    if (incremental.current) {
      const manifest = continuousRecorder.status();
      checkpointAttempt(attemptId.current, manifest.full_uri, manifest.duration_ms, manifest.slide_events);
      checkpointCapture(attemptId.current, manifest);
      lastCheckpoint.current = manifest.duration_ms;
      return;
    }
    const duration = Math.floor(recorder.getStatus().durationMillis);
    checkpointAttempt(attemptId.current, recorder.uri ?? '', duration, service.getSlideEvents());
    lastCheckpoint.current = duration;
  }, [recorder, service]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (phase.current !== 'recording') return;
      try {
        const native = incremental.current ? continuousRecorder.status() : null;
        if (native?.error || (native && !native.isRecording)) { callbacks.current.onMustStop(); return; }
        const status = native ? { durationMillis: native.duration_ms, metering: native.metering } : recorder.getStatus();
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

  useEffect(() => () => {
    if (incremental.current && phase.current === 'recording') {
      phase.current = 'stopping';
      void continuousRecorder.stop().then(manifest => {
        checkpointCapture(attemptId.current, manifest);
        checkpointAttempt(attemptId.current, manifest.full_uri, manifest.duration_ms,
          manifest.slide_events.filter(e => e.at_ms < manifest.duration_ms), true);
        interruptAttempt(attemptId.current, 'Recording interrupted. Saved audio and segments are retained.');
      }).catch(() => { /* Native journal is recovered on next launch. */ });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    async start(slide) {
      if (phase.current !== 'ready') throw new Error('This take has already started.');
      phase.current = 'starting';
      try {
        recoverPendingAttempts();
        let useIncremental = onlineAllowed() && preferIncremental && continuousRecorder.available() && await incrementalAvailable(API_URL);
        if (useIncremental && !hasAnalysisConsent()) {
          useIncremental = await new Promise<boolean>(resolve => Alert.alert(ui('Feedback while you present'),
            ui('Completed slide audio will upload to the configured server during recording. ElevenLabs Scribe transcribes it; transcription may include vocabulary hints from your slides. The configured AI provider receives slide text and transcript for feedback. Audio stays on this phone for retry and playback.'),
            [{ text: ui('After Stop instead'), onPress: () => resolve(false) },
             { text: ui('Use live feedback'), onPress: () => { saveAnalysisConsent(); resolve(true); } }], { cancelable: false }));
        }
        if (useIncremental) {
          const permission = await AudioModule.requestRecordingPermissionsAsync();
          if (!permission.granted) throw new Error('Microphone permission was denied.');
          if (!mounted.current || AppState.currentState !== 'active') throw new Error('Recording could not start. Please try again.');
          const first = slide();
          const manifest = await continuousRecorder.start(first);
          incremental.current = true;
          // Native startup can finish after the screen closes or the app backgrounds.
          if (!mounted.current || AppState.currentState !== 'active') throw new Error('Recording could not start. Please try again.');
          attemptId.current = beginAttempt({ id: deck.id, title: deck.title, uri: deck.uri, pageCount: deck.pageCount }, audience, first, manifest.full_uri);
          registerCapture(attemptId.current, API_URL, manifest);
        } else await service.start(() => {
          if (!mounted.current || failed.current || AppState.currentState !== 'active') throw new Error('Recording could not start. Please try again.');
          return slide();
        }, (uri, first) => {
          attemptId.current = beginAttempt({ id: deck.id, title: deck.title, uri: deck.uri, pageCount: deck.pageCount }, audience, first, uri);
        });
        phase.current = 'recording';
        onStarted?.(attemptId.current);
      } catch (error) {
        if (incremental.current) {
          try { const m = await continuousRecorder.stop(); if (attemptId.current) checkpointCapture(attemptId.current, m); } catch { /* Native journal retains files. */ }
        }
        phase.current = 'done';
        const message = error instanceof Error ? error.message : 'Could not start recording.';
        // As before: a take that was registered but never ran is kept as interrupted, not left "capturing".
        try { if (attemptId.current) interruptAttempt(attemptId.current, message); } catch { /* recovered on next launch */ }
        throw new Error(message);
      }
    },
    slideChanged(slide) {
      if (phase.current !== 'recording') return;
      try {
        if (incremental.current) continuousRecorder.transition(slide);
        else service.onSlideChanged(slide);
        checkpoint();
      } catch { callbacks.current.onMustStop(); }
    },
    async stop() {
      if (phase.current !== 'recording') throw new Error('Nothing is recording.');
      phase.current = 'stopping';
      try {
        if (incremental.current) {
          const manifest = await continuousRecorder.stop();
          checkpointCapture(attemptId.current, manifest);
          const events = manifest.slide_events.filter(event => event.at_ms < manifest.duration_ms);
          checkpointAttempt(attemptId.current, manifest.full_uri, manifest.duration_ms, events, true);
          if (manifest.error) throw new Error(manifest.error);
          enableInitialQa(API_URL, attemptId.current);
          phase.current = 'done';
          return { attemptId: attemptId.current, durationMs: manifest.duration_ms, events };
        }
        const { uri, durationMillis } = await stopCapture(recorder);
        const events = service.getSlideEvents(durationMillis);
        if (!attemptId.current) throw new Error('The recording metadata could not be found.');
        checkpointAttempt(attemptId.current, uri, durationMillis, events, true, onlineAllowed() ? API_URL : undefined);
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
  }), [audience, preferIncremental, onStarted, checkpoint, deck.id, deck.pageCount, deck.title, deck.uri, fail, recorder, service, ui]);

  return null;
});
