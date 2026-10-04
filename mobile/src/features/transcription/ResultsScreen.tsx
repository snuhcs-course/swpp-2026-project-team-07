import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getDocumentAsync } from "expo-document-picker";
import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
} from "expo-router";
import { savedWhisperTranscript } from "../../fixtures/whisperTranscript";
import type { LocalRecording, SlideEvent } from "../../contracts";
import { Action, Card, colors, styles } from "../../ui/components";
import { activeWordIndex, resumeAfterSeek, transcriptSpans } from "./playback";
import { transcriptionService, TranscriptionClientError } from "./service";

type Preview = "completed" | "processing" | "failed";
const spans = transcriptSpans(savedWhisperTranscript);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

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

function parseRecording(value: string | undefined): LocalRecording | null {
  if (!value) return null;
  try {
    const recording: unknown = JSON.parse(value);
    const record = recording as Record<string, unknown>;
    if (
      recording === null ||
      typeof recording !== "object" ||
      Array.isArray(recording) ||
      typeof record.id !== "string" ||
      typeof record.deck_id !== "string" ||
      typeof record.duration_ms !== "number" ||
      typeof record.audience !== "string" ||
      typeof record.audio_uri !== "string" ||
      !Array.isArray(record.slide_events)
    ) return null;
    return recording as LocalRecording;
  } catch {
    return null;
  }
}

export function ResultsScreen() {
  const params = useLocalSearchParams<{
    audioUri?: string;
    slideEvents?: string;
    recording?: string;
  }>();
  const recordingUri = typeof params.audioUri === "string" ? params.audioUri : null;
  const localRecording = useMemo(
    () => parseRecording(params.recording),
    [params.recording],
  );
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
    recordingUri ? "Your recording" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
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
  useEffect(() => {
    // TODO(transcription): navigate with an attempt ID and load this metadata
    // from durable local/server storage instead of serializing a LocalRecording
    // through route parameters.
    const recording = localRecording;
    if (!recording) return;
    const controller = new AbortController();
    async function submitRecording() {
      setSubmissionNotice("Uploading recording…");
      try {
        const { attempt_id } = await transcriptionService.submit(recording!, {
          signal: controller.signal,
        });
        setSubmissionNotice("Processing recording…");
        await transcriptionService.waitForResult(attempt_id, {
          signal: controller.signal,
        });
        // TODO(transcription): store the completed AttemptResult in state and
        // render its transcript, feedback, and aligned slide visits here.
        setSubmissionNotice("Recording processed. Live result display is next.");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setSubmissionNotice(
          cause instanceof TranscriptionClientError
            ? cause.message
            : "Could not submit the recording.",
        );
      }
    }
    void submitRecording();
    return () => controller.abort();
  }, [localRecording]);

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

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16, gap: 12 }}>
        <Text style={styles.label}>
          {recordingUri ? "SAVED RECORDING" : "SAVED TEST · KOREAN TTS"}
        </Text>
        <Text style={styles.title}>Listen & follow</Text>
        <Text style={styles.body}>Play your recording. Follow each word. Tap a word to jump back into the audio.</Text>
        <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 12 }}>
          <View style={styles.between}>
            <Text style={{ ...styles.body, fontVariant: ["tabular-nums"] }}>
              {clock(status.currentTime)} / {clock(status.duration || (recordingUri ? 0 : 23.902))}
            </Text>
            <Text style={styles.label}>
              {status.playing ? "PLAYING" : ready ? "PAUSED" : "LOADING AUDIO"}
            </Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={{ height: 5, backgroundColor: colors.pale, borderRadius: 3 }}>
            <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: colors.blue, borderRadius: 3 }} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Action label="Back 5s" secondary disabled={!ready} onPress={() => void seek(status.currentTime - 5)} /></View>
            <View style={{ flex: 1 }}><Action label={status.playing ? "Pause" : status.didJustFinish ? "Replay" : "Play"} disabled={!ready} onPress={() => void togglePlayback()} /></View>
          </View>
          {/* DEBUG ONLY: picker for the fixture TTS audio. Keep local-recording
              playback above; replace this fixture path with server results later. */}
          {!recordingUri && !audioName && (
            <Text style={styles.body}>
              Choose the matching whisper-test.m4a to hear this saved transcript.
              Nothing is uploaded.
            </Text>
          )}
          {!recordingUri && (
            <Pressable
              accessibilityRole="button"
              disabled={picking}
              onPress={() => void chooseAudio()}
            >
              <Text style={{ color: colors.blue, paddingVertical: 6 }}>
                {picking
                  ? "Opening files…"
                  : audioName
                    ? "Change test audio"
                    : "Choose test audio"}
              </Text>
            </Pressable>
          )}
          {audioName && !status.isLoaded && !status.error && <Text style={styles.body}>Loading audio…</Text>}
          {(error || status.error || mismatch) && <Text accessibilityRole="alert" style={{ color: "#A53232" }}>
            {error ?? (mismatch ? "This audio length does not match the saved transcript. Choose the matching test file." : "Audio could not be loaded. Choose the test file again.")}
          </Text>}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, gap: 20 }}>
        {preview === "completed" && recordingUri && (
          <>
            <Card>
              <Text style={styles.heading}>Transcript not available yet</Text>
              <Text style={styles.body}>
                This is your saved local recording. It is submitted when a real
                deck ID is available; live transcript and feedback display are
                still pending.
              </Text>
              {!!submissionNotice && (
                <Text style={styles.body}>{submissionNotice}</Text>
              )}
            </Card>
            <Card>
              <Text style={styles.heading}>Slide timeline · testing</Text>
              {/* DEBUG ONLY: render raw events to verify timestamp capture.
                  Keep the data, but replace this card with aligned result UI. */}
              {slideEvents.length ? (
                slideEvents.map((event, eventIndex) => (
                  <Text key={`${event.at_ms}-${eventIndex}`} style={styles.body}>
                    {clock(event.at_ms / 1_000)} · Slide {event.slide_index + 1}
                  </Text>
                ))
              ) : (
                <Text style={styles.body}>No slide visits were captured.</Text>
              )}
            </Card>
          </>
        )}
        {preview === "completed" && !recordingUri && <>
          <Text style={{ color: colors.ink, fontSize: 23, lineHeight: 40 }}>
            {spans.map((span, index) => <Text key={index}
              accessibilityRole={span.wordIndex !== null ? "button" : undefined}
              accessibilityState={span.wordIndex !== null ? { disabled: !ready, selected: span.wordIndex === active } : undefined}
              onPress={span.wordIndex !== null && ready ? () => void seek(savedWhisperTranscript.words[span.wordIndex!].start_ms / 1000) : undefined}
              style={span.wordIndex === active ? { backgroundColor: "#FFE39B", color: colors.ink, fontWeight: "700" } : undefined}>
              {span.text}
            </Text>)}
          </Text>
          <Text style={{ ...styles.body, fontSize: 12 }}>Saved Whisper output from synthetic speech. Highlight follows the audio player; word timing may be imperfect. No live recording or transcription is running.</Text>
        </>}
        {preview === "processing" && <Card><ActivityIndicator color={colors.blue} /><Text style={styles.heading}>Preparing your transcript</Text><Text style={styles.body}>Waiting-state preview only. No audio is being processed.</Text></Card>}
        {preview === "failed" && <Card><Text style={styles.heading}>Processing could not finish</Text><Text style={styles.body}>Simulated error. Retry restores the saved transcript locally after one second.</Text><Action label="Retry preview" onPress={retryPreview} /></Card>}
        {!recordingUri && <>
          <Pressable accessibilityRole="button" onPress={() => setShowPreviewControls(!showPreviewControls)}>
            <Text style={{ color: colors.muted, paddingVertical: 12 }}>{showPreviewControls ? "Hide preview states" : "Preview other states"}</Text>
          </Pressable>
          {showPreviewControls && <View style={{ gap: 8 }}>
            <Action label="Saved result" secondary onPress={() => selectPreview("completed")} />
            <Action label="Processing preview" secondary onPress={() => selectPreview("processing")} />
            <Action label="Failure preview" secondary onPress={() => selectPreview("failed")} />
          </View>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
