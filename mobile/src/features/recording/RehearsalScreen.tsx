import { useEffect, useMemo, useRef, useState } from "react";
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { AppState, Text, View } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";
import type { LocalRecording, SlideEvent } from "../../contracts";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "../pdf/SlidePreview";
import { createRecordingService } from "./service";
import { stopCapture } from "./stopCapture";
import { Action, Card, Screen, styles } from "../../ui/components";

function formatDuration(durationMillis: number) {
  // Hours are out of scope
  // for this short rehearsal preview.
  const totalSeconds = Math.floor(durationMillis / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

type CapturePreview = { uri: string; durationMillis: number; slideEvents: SlideEvent[]; recording: LocalRecording | null; };

export function RehearsalScreen() {
  const [savedPreview, setSavedPreview] = useState<CapturePreview | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [retrySlide, setRetrySlide] = useState<number | undefined>(undefined);

  // Removing the attempt component releases its native recorder through
  // useAudioRecorder. A failed/prepared recorder must never be reused on retry.
  if (failure) {
    return (
      <Screen>
        <Text style={styles.heading}>Recording failed</Text>
        <Text accessibilityRole="alert" style={styles.body}>{failure}</Text>
        <Action label="Try recording again" onPress={() => setFailure(null)} />
      </Screen>
    );
  }
  return (
    <RehearsalAttempt
      key={generation}
      savedPreview={savedPreview}
      onStarting={() => setSavedPreview(null)}
      onSaved={(capture, slide) => {
        setSavedPreview(capture);
        setRetrySlide(slide);
        setGeneration(value => value + 1);
      }}
      retrySlide={retrySlide}
      onFailure={(message, slide) => {
        setRetrySlide(slide);
        setFailure(message);
      }}
    />
  );
}

function RehearsalAttempt({ retrySlide, onFailure, savedPreview, onSaved, onStarting }: {
  onStarting: () => void;
  savedPreview: CapturePreview | null;
  onSaved: (capture: CapturePreview, slide: number) => void;
  retrySlide?: number;
  onFailure: (message: string, slide: number) => void;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const params = useLocalSearchParams<{
    slide?: string;
    audience?: string;
    deckId?: string;
  }>();
  const captureFailed = useRef(false);
  const pageCount = demoSlides.length;
  const deckId = typeof params.deckId === "string" ? params.deckId : null;
  // TODO (new feature): add aimDuration in later iterations?
  // as separate presentation-goal UI. It must not change the
  // recorder's actual-audio timeline unless the team defines that policy.

  // Slide events use recorder.getStatus() directly at the navigation action,
  // rather than this periodically refreshed value.
  const initial = retrySlide ?? Number(params.slide ?? 0);
  // The current viewer passes a sample slide index. Keep it valid even if a
  // malformed deep link or a future viewer sends an invalid route parameter.
  const [index, setIndex] = useState(
    Number.isInteger(initial) && initial >= 0 && initial < demoSlides.length
      ? initial
      : 0,
  );
  const visibleSlide = useRef(index);
  // UI state prevents double Start/Stop presses while native work is pending.
  // It is separate from recorderState, which is a periodically polled snapshot.
  const [recordingState, setRecordingState] = useState<
    "ready" | "starting" | "recording" | "stopping"
  >("ready");
  const capturePhase = useRef(recordingState);
  const stopRequested = useRef(false);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const [recordingError, setRecordingError] = useState<string | null>(null);
  // Local output retained after Stop for the current preview navigation.
  // It is not an uploaded attempt or a durable recording-library entry yet.
  const [recordingUri, setRecordingUri] = useState<string | null>(savedPreview?.uri ?? null);

  const [savedDurationMillis, setSavedDurationMillis] = useState(savedPreview?.durationMillis ?? 0);
  const [savedSlideEvents, setSavedSlideEvents] = useState<SlideEvent[]>(savedPreview?.slideEvents ?? []);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [localRecording, setLocalRecording] = useState<LocalRecording | null>(savedPreview?.recording ?? null);
  // directory: "document" avoids the
  // system-cleared cache used by Expo Audio's default recording location.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: "document",
  }, (status) => {
    if ((status.hasError || (status.isFinished && capturePhase.current === "recording")) && mounted.current && !captureFailed.current) {
      captureFailed.current = true;
      onFailure("The recording could not be saved. Please record again.", visibleSlide.current);
    }
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  // TODO(recording): persist LocalRecording metadata locally if recordings must
  // survive an app restart or be retried after a failed upload. State currently
  // lasts only for this mounted rehearsal/preview flow.
  // The service holds its own mutable event list. Memoization is essential:
  // recreating it on each React render would lose earlier slide visits.
  const recordingService = useMemo(
    () => createRecordingService(recorder),
    [recorder],
  );

  // The SDK 57 router exposes the navigation guard through this compatibility
  // entry point. Back stops capture but stays here so in-memory audio is usable.
  usePreventRemove(recordingState !== "ready", () => {
    stopRequested.current = true;
    setRecordingError("Recording stopped before leaving. Listen here before going back.");
    void stopRef.current();
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      // Android's permission activity briefly backgrounds the app during Start.
      // The start callback checks foreground state after permission/preparation;
      // only an already-running capture is stopped by this transition.
      if (state !== "active" && capturePhase.current === "recording") {
        stopRequested.current = true;
        void stopRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  async function startRecording() {
    if (!mounted.current || capturePhase.current !== "ready") return;
    onStarting();
    capturePhase.current = "starting";
    stopRequested.current = false;
    // A new Start is a new local rehearsal: discard the prior preview URI and
    // event list before asking the operating system for microphone access.
    captureFailed.current = false;
    setRecordingError(null);
    setRecordingUri(null);
    setSavedDurationMillis(0);
    setSavedSlideEvents([]);
    setLocalRecording(null);
    // A backend attempt ID belongs to one recording and is reused only for
    // processing retries. Sample slides have no backend deck ID, so remain
    // local-preview-only until PDF import supplies one.
    // TODO(recording): use the team's agreed UUID source/persistence strategy
    // if attempts must be recovered after an app restart.
    setRecordingState("starting");
    try {
      setAttemptId(deckId ? crypto.randomUUID() : null);
      // start resolves only after native preparation and record() succeeded.
      // The service records `index` as the first event at 0 ms.
      await recordingService.start(() => {
        if (!mounted.current || captureFailed.current || stopRequested.current || AppState.currentState !== "active") {
          throw new Error("Recording was cancelled before capture started. Please try again.");
        }
        return visibleSlide.current;
      });
      if (mounted.current && !captureFailed.current) {
        capturePhase.current = "recording";
        setRecordingState("recording");
      }
    } catch (error) {
      if (!mounted.current) return;
      captureFailed.current = true;
      onFailure(error instanceof Error ? error.message : "Could not start recording.", visibleSlide.current);
    }
  }

  async function stopRecording() {
    if (!mounted.current || capturePhase.current !== "recording") return;
    capturePhase.current = "stopping";
    setRecordingState("stopping");
    try {
      const { uri, durationMillis: finalDurationMillis } = await stopCapture(recorder);
      if (!mounted.current || captureFailed.current) return;
      const slideEvents = recordingService.getSlideEvents(finalDurationMillis);
      // Remount after each finalized capture. A late event from this native
      // recorder must never affect a later rehearsal using another recorder.
      onSaved({ uri, durationMillis: finalDurationMillis, slideEvents, recording: deckId && attemptId ? {
        id: attemptId, deck_id: deckId, duration_ms: finalDurationMillis,
        audience: params.audience ?? "", slide_events: slideEvents, audio_uri: uri,
      } : null }, visibleSlide.current);
    } catch (error) {
      if (!mounted.current) return;
      captureFailed.current = true;
      onFailure(error instanceof Error ? error.message : "Could not stop recording.", visibleSlide.current);
    }
  }

  function acceptSlide(nextIndex: number) {
    if (nextIndex === visibleSlide.current) return;
    if (recordingState === "recording") {
      recordingService.onSlideChanged(nextIndex);
    }
    visibleSlide.current = nextIndex;
    setIndex(nextIndex);
  }

  useEffect(() => { stopRef.current = stopRecording; });

  function changeSlide(nextIndex: number) {
    if (!mounted.current || capturePhase.current === "starting" || capturePhase.current === "stopping") return;
    if (nextIndex < 0 || nextIndex >= pageCount || nextIndex === visibleSlide.current) return;
    acceptSlide(nextIndex);
  }

  return (
    <Screen>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          SAMPLE SLIDES · Recording and slide visits
          are available in this session. Restart recovery, upload and AI results are not connected yet.
        </Text>
      </View>
      <View style={styles.between}>
        <Text style={styles.heading}>Rehearsal</Text>
        <Text style={styles.label}>
          {recordingState === "recording" ? "RECORDING" : "MICROPHONE OFF"}
        </Text>
      </View>
      <SlidePreview index={index} />
      <View style={styles.between}>
        <Action
          label="Previous slide"
          secondary
          disabled={index === 0 || !pageCount || recordingState === "starting" || recordingState === "stopping"}
          onPress={() => changeSlide(index - 1)}
        />
        <Text style={styles.body}>{pageCount ? `${index + 1} / ${pageCount}` : "Loading PDF…"}</Text>
        <Action
          label="Next slide"
          secondary
          disabled={index >= pageCount - 1 || !pageCount || recordingState === "starting" || recordingState === "stopping"}
          onPress={() => changeSlide(index + 1)}
        />
      </View>
      <Card>
        <Text
          style={[
            styles.title,
            { textAlign: "center", fontVariant: ["tabular-nums"] },
          ]}
        >
          {/* While recording, show the native live duration. After Stop, retain
              the final duration captured above instead of reverting to 00:00. */}
          {formatDuration(
            recordingState === "ready"
              ? savedDurationMillis
              : recorderState.durationMillis,
          )}
        </Text>
        <Text style={[styles.body, { textAlign: "center" }]}>
          {recordingState === "recording"
            ? "Recording in progress"
            : recordingState === "stopping"
              ? "Saving recording"
            : "Ready for your next rehearsal"}
        </Text>
        <Action
          label={recordingState === "starting" ? "Starting recording…" : "Start recording"}
          disabled={recordingState !== "ready" || !pageCount}
          onPress={() => void startRecording()}
        />
        {recordingState === "recording" && (
          <Action label="Stop recording" secondary onPress={() => void stopRecording()} />
        )}
        {!!recordingError && <Text style={styles.body}>{recordingError}</Text>}
        {!!savedSlideEvents.length && recordingState === "ready" && (
          <Text style={styles.body}>
            {savedSlideEvents.length} slide visit
            {savedSlideEvents.length === 1 ? "" : "s"} captured on the
            recording timeline.
          </Text>
        )}
      </Card>
      {!!params.audience && (
        <Text style={styles.body}>Audience: {params.audience}</Text>
      )}
      <Action
        label={recordingUri ? "Listen to recording" : "Preview saved test transcript"}
        secondary
        // Do not navigate away while native capture is starting, active, or
        // stopping: unmounting the recorder can lose its audio/timeline. The
        // Ready state still permits the original fixture preview before Start.
        disabled={recordingState !== "ready"}
        onPress={() =>
          // DEBUG HANDOFF: the URI and serialized events only bridge this
          // in-memory preview to ResultsScreen. Replace with a LocalRecording
          // ID once attempt storage and upload are implemented.

          //route handoff
          router.push(
            recordingUri
              ? {
                  pathname: "/results",
                  params: {
                    audioUri: recordingUri,
                    slideEvents: JSON.stringify(savedSlideEvents),
                    ...(localRecording
                      ? { recording: JSON.stringify(localRecording) }
                      : {}),
                  },
                }
              : "/results",
          )
        }
      />
    </Screen>
  );
}
