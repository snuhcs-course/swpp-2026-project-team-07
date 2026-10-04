import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordingPresets, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import Pdf, { type PdfRef } from "react-native-pdf";
import { createRecordingService } from "./service";
import { stopCapture } from "./stopCapture";
import { finalizeOnce } from "./finalizeOnce";
import { beginAttempt, checkpointAttempt, discardEmptyAttempt, getSavedAttempt, saveAttempt } from "./storage";
import { uploadAttempt } from "./upload";
import { Action, Card, Screen, colors, styles } from "../../ui/components";

export function RehearsalScreen() {
  const params = useLocalSearchParams<{ slide?: string; audience?: string; localDeckId?: string; uri?: string; title?: string }>();
  const initial = Math.max(0, Number(params.slide) || 0);
  const [index, setIndex] = useState(initial);
  const [pages, setPages] = useState(0);
  const [phase, setPhase] = useState<"ready" | "starting" | "recording" | "saving">("ready");
  const phaseRef = useRef(phase);
  const [error, setError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [savedId, setSavedId] = useState("");
  const idRef = useRef("");
  const lastDuration = useRef(0);
  const lastCheckpoint = useRef(0);
  const pdf = useRef<PdfRef>(null);
  const visibleSlide = useRef(initial);
  const stopRef = useRef<(navigate?: boolean, nativeFinished?: boolean) => Promise<void>>(async () => {});
  const stopping = useRef<Promise<void> | null>(null);
  const nativeFailure = useRef(false);
  const leaveAfterStart = useRef(false);
  const navigation = useNavigation();
  const leaveDispatched = useRef(false);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: "document" }, status => {
    if (status.hasError) nativeFailure.current = true;
    if ((status.isFinished || status.hasError) && phaseRef.current === "recording") void stopRef.current(false, true);
  });
  const live = useAudioRecorderState(recorder, 250);
  const timeline = useMemo(() => createRecordingService(recorder), [recorder]);

  function changePhase(next: typeof phase) { phaseRef.current = next; setPhase(next); }
  async function start() {
    if (phaseRef.current !== "ready") return;
    changePhase("starting"); setError(""); setSavedId(""); setLeave(null);
    nativeFailure.current = false; leaveDispatched.current = false; lastDuration.current = 0; lastCheckpoint.current = 0;
    try {
      idRef.current = beginAttempt(params.localDeckId!, params.audience ?? "", index);
      await timeline.start(index, uri => checkpointAttempt(idRef.current, uri, 0, [{ slide_index: index, at_ms: 0 }]));
      changePhase("recording");
      if (leaveAfterStart.current || AppState.currentState !== "active") await stopRef.current(false);
    } catch (cause) {
      if (recorder.getStatus().canRecord) { try { await recorder.stop(); } catch { /* Keep any file for recovery. */ } }
      if (idRef.current) discardEmptyAttempt(idRef.current);
      changePhase("ready");
      setError(cause instanceof Error ? cause.message : "Could not start recording.");
    }
  }

  const stop = useCallback((navigate = true, nativeFinished = false): Promise<void> => {
    if (stopping.current) return stopping.current;
    if (phaseRef.current === "starting") { leaveAfterStart.current = true; return Promise.resolve(); }
    if (phaseRef.current !== "recording") return Promise.resolve();
    phaseRef.current = "saving"; setPhase("saving");
    return finalizeOnce(stopping, async () => {
      try {
        const fallback = lastDuration.current >= 599_000 ? 600_000 : lastDuration.current;
        const capture = nativeFinished
          ? { uri: recorder.uri ?? getSavedAttempt(idRef.current)?.recording.audio_uri ?? "", durationMillis: fallback }
          : await stopCapture(recorder, lastDuration.current);
        if (nativeFailure.current || !capture.uri || capture.durationMillis <= 0) throw new Error("Capture was interrupted. Open this saved rehearsal to recover its audio.");
        const duration = Math.min(600_000, capture.durationMillis);
        checkpointAttempt(idRef.current, capture.uri, duration, timeline.getSlideEvents(duration), true);
        setSavedId(idRef.current);
        // Background upload survives screen navigation. File/metadata remain on every failure.
        void uploadAttempt(idRef.current).catch(() => {});
        if (navigate && AppState.currentState === "active") setLeave(() => () => router.push({ pathname: "/results", params: { attemptId: idRef.current } }));
      } catch (cause) {
        const attempt = getSavedAttempt(idRef.current);
        if (attempt) saveAttempt({ ...attempt, state: "interrupted", error: "Recording was interrupted. Recover the saved audio from its rehearsal page." });
        setError(cause instanceof Error ? cause.message : "Could not finish saving. Your checkpoint is retained.");
      } finally {
        phaseRef.current = "ready"; setPhase("ready");
      }
    });
  }, [recorder, timeline]);
  useEffect(() => { stopRef.current = stop; }, [stop]);
  useEffect(() => {
    if (phase !== "ready" || !leave || leaveDispatched.current) return;
    // Let the native stack apply the released removal guard before navigation.
    const timer = setTimeout(() => { leaveDispatched.current = true; setLeave(null); leave(); }, 100);
    return () => clearTimeout(timer);
  }, [phase, leave]);
  usePreventRemove(phase !== "ready", ({ data }) => {
    setLeave(() => () => navigation.dispatch(data.action));
    void stopRef.current(false);
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") {
        if (phaseRef.current === "recording") void stopRef.current(false);
      }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const snapshot = recorder.getStatus();
    const duration = Math.floor(snapshot.durationMillis);
    if (duration > lastDuration.current) lastDuration.current = duration;
    if (duration >= 599_500) { void stopRef.current(); return; }
    if (duration - lastCheckpoint.current >= 1000 && recorder.uri) {
      try {
        checkpointAttempt(idRef.current, recorder.uri, duration, timeline.getSlideEvents());
        lastCheckpoint.current = duration;
      } catch { void stopRef.current(false); }
    }
    if (!snapshot.isRecording && duration > 0) void stopRef.current(false);
  }, [live.durationMillis, live.isRecording, phase, recorder, timeline]);

  function onPage(page: number, count: number) {
    setPages(count);
    const next = page - 1;
    if (next === visibleSlide.current) return;
    if (phaseRef.current === "recording") {
      timeline.onSlideChanged(next);
      if (recorder.uri) {
        try { checkpointAttempt(idRef.current, recorder.uri, recorder.getStatus().durationMillis, timeline.getSlideEvents()); }
        catch { setError("Could not save the timeline. Stopping recording."); void stopRef.current(false); }
      }
    }
    visibleSlide.current = next; setIndex(next);
  }
  if (!params.uri || !params.localDeckId) return <Screen><Text style={styles.heading}>Import a PDF to rehearse</Text><Text style={styles.body}>Sample slides are a preview. Import your own PDF to save a recording and receive analysis.</Text><Action label="Back to library" onPress={() => router.replace("/")} /></Screen>;
  return <Screen>
    <Text style={styles.heading}>{params.title ?? "Rehearsal"}</Text>
    <Text style={styles.body}>Up to 10 minutes. Stop saves your recording and starts analysis. Leaving or backgrounding stops and saves.</Text>
    <View style={{ height: 340, overflow: "hidden", borderRadius: 12 }} pointerEvents={phase === "starting" || phase === "saving" ? "none" : "auto"}>
      <Pdf ref={pdf} source={{ uri: params.uri }} page={initial + 1} horizontal enablePaging fitPolicy={0}
        style={{ flex: 1, width: "100%", backgroundColor: colors.white }}
        onLoadComplete={setPages} onPageChanged={onPage} onError={() => setPdfError("This PDF could not be opened.")}
        renderActivityIndicator={() => <ActivityIndicator color={colors.blue} />} />
    </View>
    <View style={styles.between}>
      <Action label="Previous" secondary disabled={!index || phase === "starting" || phase === "saving"} onPress={() => pdf.current?.setPage(index)} />
      <Text style={styles.body}>{index + 1} / {pages || "…"}</Text>
      <Action label="Next" secondary disabled={index >= pages - 1 || phase === "starting" || phase === "saving"} onPress={() => pdf.current?.setPage(index + 2)} />
    </View>
    <Card>
      <Text style={styles.title}>{Math.floor(live.durationMillis / 60000)}:{String(Math.floor(live.durationMillis / 1000) % 60).padStart(2, "0")}</Text>
      <Text style={styles.label}>{phase.toUpperCase()}</Text>
      {phase === "recording" ? <Action label="Stop & analyze" onPress={() => void stop()} /> : <Action label={phase === "ready" ? "Start recording" : "Saving…"} disabled={phase !== "ready" || !pages || pages > 10 || !!pdfError} onPress={() => { leaveAfterStart.current = false; void start(); }} />}
      {!!(error || pdfError) && <Text accessibilityRole="alert" style={styles.body}>{error || pdfError}</Text>}
      {!!savedId && <Action label="Open saved rehearsal" secondary onPress={() => router.push({ pathname: "/results", params: { attemptId: savedId } })} />}
    </Card>
    {!!params.audience && <Text style={styles.body}>Audience: {params.audience}</Text>}
    <Action label={phase === "recording" ? "Save & leave rehearsal" : "Back to slides"} secondary onPress={() => router.back()} />
  </Screen>;
}
