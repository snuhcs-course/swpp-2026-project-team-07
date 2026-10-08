import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import Pdf from "react-native-pdf";
import type { PdfRef } from "react-native-pdf";
import { usePreventRemove } from "expo-router/react-navigation";
import type { SlideEvent } from "../../contracts";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "../pdf/SlidePreview";
import { createRecordingService } from "./service";
import { stopCapture } from "./stopCapture";
import { beginAttempt, checkpointAttempt, interruptAttempt, recoverPendingAttempts } from "./storage";
import { Action, Card, Screen, colors, styles } from "../../ui/components";

function formatDuration(durationMillis: number) {
  // Hours are out of scope
  // for this short rehearsal preview.
  const totalSeconds = Math.floor(durationMillis / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

type CapturePreview = { attemptId?: string; uri: string; durationMillis: number; slideEvents: SlideEvent[]; pageCount: number; };

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
  const attemptId = useRef("");
  const lastCheckpoint = useRef(-1);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const params = useLocalSearchParams<{
    slide?: string;
    audience?: string;
    localDeckId?: string;
    uri?: string;
    title?: string;
  }>();
  const captureFailed = useRef(false);
  const pdfUri = typeof params.uri === "string" ? params.uri : "";
  const pdfRef = useRef<PdfRef>(null);
  const [pageCount, setPageCount] = useState(pdfUri ? 0 : demoSlides.length);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfPageConfirmed, setPdfPageConfirmed] = useState(false);
  const [changingPage, setChangingPage] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfHasError = useRef(false);
  const pdfReady = !pdfUri || (pdfLoaded && pdfPageConfirmed && !changingPage && !pdfError && pageCount <= 10 && !!params.localDeckId);
  const localDeckId = typeof params.localDeckId === "string" ? params.localDeckId : "";
  // TODO (new feature): add aimDuration in later iterations?
  // as separate presentation-goal UI. It must not change the
  // recorder's actual-audio timeline unless the team defines that policy.

  // Slide events use recorder.getStatus() directly at the visible-page callback,
  // rather than this periodically refreshed value.
  const initial = retrySlide ?? Number(params.slide ?? 0);
  // Real PDFs can have more pages than the sample deck. Native callbacks confirm
  // the page and bounds before Start is enabled.
  const [index, setIndex] = useState(
    Number.isInteger(initial) && initial >= 0 && (pdfUri || initial < demoSlides.length)
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
  // Retain local output after Stop; real PDFs navigate by durable attempt ID.
  const [recordingUri, setRecordingUri] = useState<string | null>(savedPreview?.uri ?? null);

  const [savedDurationMillis, setSavedDurationMillis] = useState(savedPreview?.durationMillis ?? 0);
  const [savedSlideEvents, setSavedSlideEvents] = useState<SlideEvent[]>(savedPreview?.slideEvents ?? []);

  // directory: "document" avoids the
  // system-cleared cache used by Expo Audio's default recording location.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: "document",
  }, (status) => {
    if ((status.hasError || (status.isFinished && capturePhase.current === "recording")) && mounted.current && !captureFailed.current) {
      failCapture("The recording could not be finalized. Any checkpoint remains in saved rehearsals.");
    }
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  // The service holds its own mutable event list. Memoization is essential:
  // recreating it on each React render would lose earlier slide visits.
  const recordingService = useMemo(
    () => createRecordingService(recorder),
    [recorder],
  );

  function failCapture(message: string) {
    captureFailed.current = true;
    try {
      if (attemptId.current) interruptAttempt(attemptId.current, message);
    } catch {
      message += " Could not update saved metadata. The previous checkpoint and audio file are retained.";
    }
    // Always unmount/release the native recorder, even when SQLite also fails.
    onFailure(message, visibleSlide.current);
  }

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
    if (capturePhase.current !== "ready" || !pdfReady || !mounted.current) return;
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

    setRecordingState("starting");
    try {
      recoverPendingAttempts();
      // start resolves only after native preparation and record() succeeded.
      // Read the visible page after asynchronous native preparation, immediately
      // before capture begins. Ignore callbacks belonging to a released attempt.
      await recordingService.start(() => {
        if (!mounted.current || captureFailed.current || pdfHasError.current || stopRequested.current || AppState.currentState !== "active") {
          throw new Error("Recording could not start. Please try again.");
        }
        return visibleSlide.current;
      }, (uri, slide) => {
        if (!localDeckId) return; // Sample capture stays separate from durable real PDFs.
        attemptId.current = beginAttempt({ id: localDeckId, title: params.title ?? "Presentation", uri: pdfUri, pageCount }, params.audience ?? "", slide, uri);
      });
      if (mounted.current && !captureFailed.current) {
        capturePhase.current = "recording";
        setRecordingState("recording");
      }
    } catch (error) {
      if (!mounted.current) return;
      failCapture(error instanceof Error ? error.message : "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (capturePhase.current !== "recording" || !mounted.current) return;
    capturePhase.current = "stopping";
    setRecordingState("stopping");
    try {
      const { uri, durationMillis: finalDurationMillis } = await stopCapture(recorder);
      if (!mounted.current || captureFailed.current) return;
      const slideEvents = recordingService.getSlideEvents(finalDurationMillis);
      // Remount after each finalized capture. A late event from this native
      // recorder must never affect a later rehearsal using another recorder.
      if (attemptId.current) checkpointAttempt(attemptId.current, uri, finalDurationMillis, slideEvents, true);
      onSaved({ attemptId: attemptId.current || undefined, uri, durationMillis: finalDurationMillis, slideEvents, pageCount }, visibleSlide.current);
    } catch (error) {
      if (!mounted.current) return;
      failCapture(error instanceof Error ? error.message : "Could not stop recording.");
    }
  }

  useEffect(() => { stopRef.current = stopRecording; });

  const checkpoint = useCallback(() => {
    if (!attemptId.current || capturePhase.current !== "recording") return;
    const duration = Math.floor(recorder.getStatus().durationMillis);
    checkpointAttempt(attemptId.current, recorder.uri ?? "", duration, recordingService.getSlideEvents());
    lastCheckpoint.current = duration;
  }, [recorder, recordingService]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (capturePhase.current !== "recording") return;
      try {
        const duration = recorder.getStatus().durationMillis;
        if (duration - lastCheckpoint.current >= 1000) checkpoint();
        if (duration >= 599_000) void stopRef.current();
      } catch {
        setRecordingError("Could not save the timeline. Stopping capture; the previous checkpoint is retained.");
        void stopRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [checkpoint, recorder]);

  function acceptSlide(nextIndex: number) {
    if (!mounted.current || nextIndex === visibleSlide.current) return;
    // The service checks native capture state, avoiding a stale React render at
    // the start/stop boundary. Only actual visible-page changes reach it.
    recordingService.onSlideChanged(nextIndex);
    try { checkpoint(); } catch { void stopRef.current(); }
    visibleSlide.current = nextIndex;
    setIndex(nextIndex);
  }

  function changeSlide(nextIndex: number) {
    if (!mounted.current || !pdfReady || capturePhase.current === "starting" || capturePhase.current === "stopping") return;
    if (nextIndex < 0 || nextIndex >= pageCount) return;
    if (pdfUri) {
      setChangingPage(true);
      pdfRef.current?.setPage(nextIndex + 1);
    } else {
      acceptSlide(nextIndex);
    }
  }

  return (
    <Screen>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {pdfUri ? "ON-DEVICE PDF" : "SAMPLE SLIDES"} · Recording and slide visits
          are saved on this device for imported PDFs. Upload the saved recording,
          then choose Analyze recording to start analysis. Upload can be retried.
        </Text>
      </View>
      <View style={styles.between}>
        <Text style={styles.heading}>Rehearsal</Text>
        <Text style={styles.label}>
          {recordingState === "recording" ? "RECORDING" : "MICROPHONE OFF"}
        </Text>
      </View>
      {!!pdfUri && <Text style={styles.body}>{params.title ?? "Presentation"}</Text>}
      {pdfUri ? (
        <View style={{ height: 460, width: "100%", borderRadius: 12, overflow: "hidden" }}
          pointerEvents={recordingState === "starting" || recordingState === "stopping" ? "none" : "auto"}>
          <Pdf
            ref={pdfRef}
            source={{ uri: pdfUri }}
            page={Number.isInteger(initial) && initial >= 0 ? initial + 1 : 1}
            horizontal
            enablePaging
            scrollEnabled={recordingState !== "starting" && recordingState !== "stopping"}
            fitPolicy={0}
            style={{ flex: 1, width: "100%", backgroundColor: colors.white }}
            onLoadComplete={(pages) => {
              if (!mounted.current || !Number.isInteger(pages) || pages < 1) return;
              setPageCount(pages);
              setPdfLoaded(true);
              pdfHasError.current = false;
              setPdfError("");
            }}
            onPageChanged={(page, pages) => {
              if (!mounted.current || pdfHasError.current || !Number.isInteger(pages) || !Number.isInteger(page) || page < 1 || page > pages) return;
              setPageCount(pages);
              setPdfPageConfirmed(true);
              setChangingPage(false);
              acceptSlide(page - 1);
            }}
            onError={() => {
              if (!mounted.current) return;
              pdfHasError.current = true;
              setPdfPageConfirmed(false);
              setChangingPage(false);
              setPdfError("This PDF could not be opened in rehearsal.");
            }}
            renderActivityIndicator={() => <ActivityIndicator color={colors.blue} />}
          />
        </View>
      ) : <SlidePreview index={index} />}
      {pageCount > 10 && <Text style={styles.body}>Choose a PDF with at most 10 slides to rehearse.</Text>}
      {!!pdfUri && !localDeckId && <Text style={styles.body}>Open this PDF from your imported presentations before recording.</Text>}
      {!!pdfError && <Text accessibilityRole="alert" style={styles.body}>{pdfError}</Text>}
      <View style={styles.between}>
        <Action
          label="Previous slide"
          secondary
          disabled={index === 0 || !pdfReady || !pageCount || recordingState === "starting" || recordingState === "stopping"}
          onPress={() => changeSlide(index - 1)}
        />
        <Text style={styles.body}>{pageCount ? `${index + 1} / ${pageCount}` : "Loading PDF…"}</Text>
        <Action
          label="Next slide"
          secondary
          disabled={index >= pageCount - 1 || !pdfReady || !pageCount || recordingState === "starting" || recordingState === "stopping"}
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
          disabled={recordingState !== "ready" || !pdfReady || !pageCount}
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
          // Imported PDFs use durable IDs; sample captures keep a local preview.
          router.push(
            recordingUri
              ? savedPreview?.attemptId ? { pathname: "/results", params: { attemptId: savedPreview.attemptId } } : {
                  pathname: "/results",
                  params: {
                    audioUri: recordingUri,
                    slideEvents: JSON.stringify(savedSlideEvents),
                    durationMs: savedDurationMillis,
                    localDeckId,
                    pageCount: savedPreview?.pageCount ?? pageCount,
                    title: params.title ?? "Sample slides",
                    pdfUri,
                  },
                }
              : "/results",
          )
        }
      />
    </Screen>
  );
}
