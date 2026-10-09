import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getDocumentAsync } from "expo-document-picker";
import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
} from "expo-router";
import { savedWhisperTranscript } from "../../fixtures/whisperTranscript";
import type { SlideEvent } from "../../contracts";
import { activeLayout } from "../../layouts/registry";
import { activeWordIndex, resumeAfterSeek, transcriptSpans } from "./playback";

import { SavedAttemptScreen } from "../recording/SavedAttemptScreen";

type Preview = "completed" | "processing" | "failed";
const spans = transcriptSpans(savedWhisperTranscript);

// DEBUG ONLY: slide events are serialized into route params solely to inspect
// the recording timeline before attempt persistence and result APIs exist.
function parseSlideEvents(value: string | undefined): SlideEvent[] {
  // Route parameters are untrusted strings. Validate the small shape required
  // by the UI rather than assuming JSON from navigation is well-formed.
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (event) =>
          event !== null &&
          typeof event === "object" &&
          Number.isInteger(event.slide_index) &&
          event.slide_index >= 0 &&
          Number.isInteger(event.at_ms) &&
          event.at_ms >= 0,
      )
    ) {
      return [];
    }
    return parsed as SlideEvent[];
  } catch {
    return [];
  }
}

export function ResultsScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId?: string }>();
  if (attemptId !== undefined) return typeof attemptId === 'string' ? <SavedAttemptScreen key={attemptId} id={attemptId} /> : <activeLayout.Message title="Invalid rehearsal ID" />;
  return <PreviewResults />;
}

function PreviewResults() { return <activeLayout.Preview model={usePreviewController()} />; }
export function usePreviewController() {
  const params = useLocalSearchParams<{
    audioUri?: string;
    slideEvents?: string;
    title?: string;
    durationMs?: string;
  }>();
  const recordingUri = typeof params.audioUri === "string" ? params.audioUri : null;
  // DEBUG ONLY: the completed recording's slide events travel in the route for
  // manual inspection. Production results should fetch persisted metadata by
  // attempt ID instead of placing JSON in a navigation URL.
  const slideEvents = parseSlideEvents(params.slideEvents);
  // KEEP: play the saved local recording directly. Later server-backed results
  // should still provide their audio source to this same player UI.
  const player = useAudioPlayer(recordingUri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  // KEEP: this state/status pair drives position, duration, progress, seek,
  // pause, and replay for both local recordings and eventual server results.
  const isFocused = useIsFocused();
  const [audioName, setAudioName] = useState<string | null>(
    recordingUri ? params.title ?? "Your recording" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // DEBUG ONLY: fixture processing/failure states, not real backend status.
  const [preview, setPreview] = useState<Preview>("completed");
  const [showPreviewControls, setShowPreviewControls] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const seeking = useRef(false);
  const intent = useRef(0);
  const focused = useRef(false);

  useEffect(() => {
    // KEEP: prevent async picker/seek work from setting state after unmount and
    // cancel the simulated retry timer when leaving the screen.
    mounted.current = true;
    const intentRef = intent;
    const retryTimerRef = retryTimer;
    return () => {
      mounted.current = false;
      intentRef.current++;
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
    };
  }, []);
  useFocusEffect(useCallback(() => {
    // KEEP: invalidate delayed replay actions as soon as this route blurs.
    focused.current = true;
    return () => {
      focused.current = false;
      intent.current++;
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    };
  }, []));
  useEffect(() => {
    // KEEP: pause on blur while the player is alive. Do not pause in unmount
    // cleanup: useAudioPlayer releases its native object on unmount itself.
    if (!isFocused) player.pause();
  }, [isFocused, player]);

  const mismatch =
    !recordingUri &&
    status.isLoaded &&
    Math.abs(status.duration - 23.902) > 0.5;
  const ready = !!audioName && status.isLoaded && !status.error && !mismatch && preview === "completed";
  const active = ready ? activeWordIndex(savedWhisperTranscript.words, status.currentTime * 1000) : -1;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  function selectPreview(next: Preview) {
    // DEBUG ONLY: fixture state selector. A real result screen will receive
    // pending/processing/completed/failed status from the attempt API.
    intent.current++;
    player.pause();
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    setPreview(next);
  }
  function retryPreview() {
    selectPreview("processing");
    retryTimer.current = setTimeout(() => { retryTimer.current = null; setPreview("completed"); }, 1000);
  }
  async function chooseAudio() {
    // DEBUG ONLY: chooses the known TTS fixture so its fixture word timings can
    // be demonstrated. Real local recordings bypass this picker entirely.
    if (picking) return;
    intent.current++;
    player.pause();
    setPicking(true);
    try {
      const result = await getDocumentAsync({ type: "audio/*", multiple: false, copyToCacheDirectory: true });
      if (!mounted.current || !focused.current || result.canceled) return;
      const file = result.assets[0];
      if (file.name !== "whisper-test.m4a") {
        setError("Choose whisper-test.m4a, the audio used for this saved transcript.");
        return;
      }
      setError(null);
      player.replace({ uri: file.uri });
      setAudioName(file.name);
    } catch {
      if (mounted.current) setError("Could not open the audio. Choose the test recording again.");
    } finally {
      if (mounted.current) setPicking(false);
    }
  }
  async function seek(seconds: number) {
    // KEEP: clamps every seek to the loaded audio's valid range and prevents
    // concurrent native seek calls from racing each other.
    if (!ready || seeking.current) return;
    seeking.current = true;
    try { await player.seekTo(Math.max(0, Math.min(seconds, status.duration))); }
    catch { if (mounted.current) setError("Could not move playback. Try again."); }
    finally { seeking.current = false; }
  }
  async function togglePlayback() {
    // KEEP: uses native player position for replay/continue behavior. `intent`
    // prevents an older async seek from restarting playback after navigation.
    if (!ready || seeking.current) return;
    const operation = ++intent.current;
    try {
      setError(null);
      if (status.playing) { player.pause(); return; }
      if (status.didJustFinish || status.currentTime >= status.duration - 0.05) {
        seeking.current = true;
        try {
          await resumeAfterSeek(() => player.seekTo(0),
            () => mounted.current && focused.current && intent.current === operation,
            () => player.play());
        } finally { seeking.current = false; }
        return;
      }
      player.play();
    } catch { if (mounted.current) setError("Could not play the recording. Choose it again."); }
  }

  return { recordingUri, status, ready, progress, audioName, picking, error, mismatch, preview, slideEvents, spans, active, showPreviewControls, setShowPreviewControls, seek, togglePlayback, chooseAudio, retryPreview, selectPreview, words: savedWhisperTranscript.words };
}
