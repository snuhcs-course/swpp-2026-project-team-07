import { useMemo, useRef, useState } from "react";
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import Pdf from "react-native-pdf";
import type { PdfRef } from "react-native-pdf";
import type { LocalRecording, SlideEvent } from "../../contracts";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "../pdf/SlidePreview";
import { createRecordingService } from "./service";
import { stopCapture } from "./stopCapture";
import { Action, Card, Screen, colors, styles } from "../../ui/components";

function formatDuration(durationMillis: number) {
  // Hours are out of scope
  // for this short rehearsal preview.
  const totalSeconds = Math.floor(durationMillis / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function RehearsalScreen() {
  const params = useLocalSearchParams<{
    slide?: string;
    audience?: string;
    deckId?: string;
    uri?: string;
    title?: string;
  }>();
  const pdfUri = typeof params.uri === "string" ? params.uri : "";
  const pdfRef = useRef<PdfRef>(null);
  const captureFailed = useRef(false);
  const [pageCount, setPageCount] = useState(pdfUri ? 0 : demoSlides.length);
  const [pdfError, setPdfError] = useState("");
  const deckId = typeof params.deckId === "string" ? params.deckId : null;
  // TODO (new feature): add aimDuration in later iterations?
  // as separate presentation-goal UI. It must not change the
  // recorder's actual-audio timeline unless the team defines that policy.

  // Slide events use recorder.getStatus() directly at the navigation action,
  // rather than this periodically refreshed value.
  const initial = Number(params.slide ?? 0);
  // The current viewer passes a sample slide index. Keep it valid even if a
  // malformed deep link or a future viewer sends an invalid route parameter.
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
  const [recordingError, setRecordingError] = useState<string | null>(null);
  // Local output retained after Stop for the current preview navigation.
  // It is not an uploaded attempt or a durable recording-library entry yet.
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const [savedDurationMillis, setSavedDurationMillis] = useState(0);
  const [savedSlideEvents, setSavedSlideEvents] = useState<SlideEvent[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [localRecording, setLocalRecording] = useState<LocalRecording | null>(null);
  // directory: "document" avoids the
  // system-cleared cache used by Expo Audio's default recording location.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: "document",
    // is this saving to local?
    // Answer: yes. New recordings are written under the app document directory,
    // which is more durable than Expo Audio's default cache directory.
  }, (status) => {
    if (status.hasError) {
      captureFailed.current = true;
      setRecordingError("The recording could not be saved. Please record again.");
      setRecordingUri(null);
      setSavedDurationMillis(0);
      setSavedSlideEvents([]);
      setLocalRecording(null);
      setRecordingState("ready");
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

  async function startRecording() {
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
    setAttemptId(deckId ? crypto.randomUUID() : null);
    setRecordingState("starting");
    try {
      // start resolves only after native preparation and record() succeeded.
      // The service records `index` as the first event at 0 ms.
      await recordingService.start(index);
      setRecordingState("recording");
    } catch (error) {
      setRecordingState("ready");
      setRecordingError(
        error instanceof Error ? error.message : "Could not start recording.",
      );
    }
  }

  async function stopRecording() {
    setRecordingError(null);
    setRecordingState("stopping");
    try {
      const { uri, durationMillis: finalDurationMillis } = await stopCapture(recorder);
      if (captureFailed.current) throw new Error("The recording could not be saved. Please record again.");
      setRecordingUri(uri);
      setSavedDurationMillis(finalDurationMillis);
      const slideEvents = recordingService.getSlideEvents(finalDurationMillis);
      setSavedSlideEvents(slideEvents);
      if (deckId && attemptId) {
        setLocalRecording({
          id: attemptId,
          deck_id: deckId,
          duration_ms: finalDurationMillis,
          audience: params.audience ?? "",
          slide_events: slideEvents,
          audio_uri: uri,
        });
      }
      setRecordingState("ready");
    } catch (error) {
      // stop() can finish natively before URI/status access fails. Only offer
      // Stop again if native capture really remains active; otherwise recover
      // to Ready instead of trapping the user behind a non-functional button.
      setRecordingState(recorder.isRecording ? "recording" : "ready");
      setRecordingError(
        error instanceof Error ? error.message : "Could not stop recording.",
      );
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

  function changeSlide(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pageCount) return;
    if (pdfUri) {
      // The native page callback records when the page actually becomes visible.
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
          stay on this device. Server upload and AI results are not connected yet.
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
            fitPolicy={0}
            style={{ flex: 1, width: "100%", backgroundColor: colors.white }}
            onLoadComplete={(pages) => { setPageCount(pages); setPdfError(""); }}
            onPageChanged={(page, pages) => { setPageCount(pages); acceptSlide(page - 1); }}
            onError={() => setPdfError("This PDF could not be opened in rehearsal.")}
            renderActivityIndicator={() => <ActivityIndicator color={colors.blue} />}
          />
        </View>
      ) : <SlidePreview index={index} />}
      {!!pdfError && <Text accessibilityRole="alert" style={styles.body}>{pdfError}</Text>}
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
          disabled={recordingState !== "ready" || !pageCount || !!pdfError}
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
