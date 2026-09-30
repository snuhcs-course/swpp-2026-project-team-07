import { useMemo, useState } from "react";
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import type { LocalRecording, SlideEvent } from "../../contracts";
import { demoSlides } from "../../fixtures/demo";
import { SlidePreview } from "../pdf/SlidePreview";
import { createRecordingService } from "./service";
import { Action, Card, Screen, styles } from "../../ui/components";

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
  }>();
  const deckId = typeof params.deckId === "string" ? params.deckId : null;
  // TODO (new feature): add aimDuration in later iterations?
  // as separate presentation-goal UI. It must not change the
  // recorder's actual-audio timeline unless the team defines that policy.

  // directory: "document" avoids the
  // system-cleared cache used by Expo Audio's default recording location.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: "document",
    // is this saving to local?
    // Answer: yes. New recordings are written under the app document directory,
    // which is more durable than Expo Audio's default cache directory.
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  // Slide events use recorder.getStatus() directly at the navigation action,
  // rather than this periodically refreshed value.
  const initial = Number(params.slide ?? 0);
  // The current viewer passes a sample slide index. Keep it valid even if a
  // malformed deep link or a future viewer sends an invalid route parameter.
  const [index, setIndex] = useState(
    Number.isInteger(initial) && initial >= 0 && initial < demoSlides.length
      ? initial
      : 0,
  );
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
      await recorder.stop();
      // After stop resolves, Expo exposes final duration and file information.
      const stoppedState = recorder.getStatus();
      const uri = recorder.uri ?? stoppedState.url;
      // status URL is a fallback in case the native status exposes it first.
      if (!uri) throw new Error("The recording file could not be saved.");
      setRecordingUri(uri);
      // Use the final native status, not the 250 ms UI poll: that poll can
      // still hold a previous recording's duration after a quick re-record.
      const finalDurationMillis = stoppedState.durationMillis;
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

  function changeSlide(nextIndex: number) {
    // Navigation remains available while not recording, but only an active
    // recording may add a timeline event. This preserves backwards/repeated
    // visits rather than treating the timeline as a unique-slide set.
    if (recordingState === "recording") {
      recordingService.onSlideChanged(nextIndex);
    }
    setIndex(nextIndex);
  }

  return (
    <Screen>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          SCREEN PREVIEW · Sample slides only. Recording and slide visits are
          saved locally; upload, transcription, and feedback are unavailable.
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
          disabled={index === 0}
          onPress={() => changeSlide(index - 1)}
        />
        <Text style={styles.body}>{index + 1} / 3</Text>
        <Action
          label="Next slide"
          secondary
          disabled={index === 2}
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
          disabled={recordingState !== "ready"}
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
        label="Preview transcript and feedback"
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
