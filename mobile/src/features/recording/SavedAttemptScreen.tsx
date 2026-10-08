import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useFocusEffect, useIsFocused } from "expo-router";
import { AppState, Text } from "react-native";
import { Action, Card, Screen, styles } from "../../ui/components";
import { getSavedAttempt, saveAttempt, type SavedAttempt } from "./storage";
import { API_URL } from "../../services/api";
import { resumeAfterSeek } from "../transcription/playback";
import { recoverRecording } from "./recovery";
import { uploadAttempt } from "./upload";
import { useAttemptAnalysis } from "../transcription/useAttemptAnalysis";
import { normalizeApi } from "../transcription/analysisStorage";

function readAttempt(id: string): { saved: SavedAttempt | null; error: string } {
  try { return { saved: getSavedAttempt(id), error: "" }; }
  catch (cause) { return { saved: null, error: cause instanceof Error ? cause.message : "Could not read saved rehearsal. Try again." }; }
}

export function SavedAttemptScreen({ id, apiUrl = API_URL }: { id: string; apiUrl?: string }) {
  // A new destination/attempt owns its callbacks; old uploads/seeks cannot update it.
  return <SavedAttemptContent key={`${normalizeApi(apiUrl)}:${id}`} id={id} apiUrl={apiUrl} />;
}
function SavedAttemptContent({ id, apiUrl }: { id: string; apiUrl: string }) {
  const [loaded, setLoaded] = useState(() => readAttempt(id));
  const saved = loaded.saved;
  const submitted = saved?.state === "submitted" && normalizeApi(saved.server_url || "") === normalizeApi(apiUrl);
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const analysis = useAttemptAnalysis(id, apiUrl, submitted, autoAnalyze);
  const autoConsumed = useRef(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const uploadBusy = useRef(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const player = useAudioPlayer(saved?.recording.audio_uri || null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const isFocused = useIsFocused();
  const focused = useRef(false);
  const active = useRef(true);
  const intent = useRef(0);
  const seeking = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  function reload() { setLoaded(readAttempt(id)); setNotice(""); }
  useEffect(() => { const currentIntent = intent; active.current = true; return () => { active.current = false; currentIntent.current++; }; }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; intent.current++; };
  }, []));
  useEffect(() => { if (!isFocused) player.pause(); }, [isFocused, player]);
  const upload = useCallback(async () => {
    if (uploadBusy.current) return;
    uploadBusy.current = true; setBusy(true); setNotice("");
    try { await uploadAttempt(id, apiUrl); }
    catch (cause) { if (active.current) setNotice(cause instanceof Error ? cause.message : "Upload failed. The audio is retained."); }
    finally {
      if (active.current) {
        try { setLoaded({ saved: getSavedAttempt(id), error: "" }); }
        catch (cause) { setNotice(previous => [previous, cause instanceof Error ? cause.message : "Could not refresh saved status. Try again."].filter(Boolean).join(" ")); }
        finally { uploadBusy.current = false; setBusy(false); }
      }
    }
  }, [apiUrl, id]);
  useFocusEffect(useCallback(() => {
    if (!foreground || autoConsumed.current || !saved?.auto_process_api ||
        normalizeApi(saved.auto_process_api) !== normalizeApi(apiUrl) ||
        !["saved", "submitted"].includes(saved.state)) return;
    autoConsumed.current = true;
    try {
      // Consume before I/O: reopening, cancellation or a failed request must
      // never silently submit the recording again. Manual retry stays available.
      const next = { ...saved, auto_process_api: undefined };
      saveAttempt(next);
      setLoaded({ saved: next, error: "" });
      setAutoAnalyze(true);
      if (!submitted) void upload();
    } catch {
      setNotice("Could not start automatic transcription. Your recording is saved; upload or analyze it when ready.");
    }
  }, [apiUrl, foreground, saved, submitted, upload]));
  function recover() {
    if (!saved || !status.isLoaded) return;
    try {
      saveAttempt({ ...saved, recording: recoverRecording(saved.recording, status.duration * 1000), state: "saved", error: undefined });
      setLoaded({ saved: getSavedAttempt(id), error: "" }); setNotice("Recovered locally. You can now upload.");
    } catch (cause) { setNotice(String(cause)); }
  }
  async function toggle() {
    if (!status.isLoaded || status.error || !focused.current || seeking.current) return;
    const op = ++intent.current;
    try {
      if (status.playing) { player.pause(); return; }
      if (status.didJustFinish || status.currentTime >= status.duration - 0.05) {
        seeking.current = true;
        try {
          await resumeAfterSeek(() => player.seekTo(0),
            () => active.current && focused.current && op === intent.current,
            () => player.play());
        } finally { seeking.current = false; }
      } else { player.play(); }
    } catch { if (active.current) setNotice("Could not play this audio. Its file and checkpoint are retained."); }
  }
  if (!saved) return <Screen>
    <Text style={styles.heading}>{loaded.error ? "Could not load saved rehearsal" : "Saved rehearsal not found"}</Text>
    {!!loaded.error && <Text accessibilityRole="alert" style={styles.body}>{loaded.error}</Text>}
    <Action label="Reload saved rehearsal" onPress={reload} />
  </Screen>;
  const interrupted = saved.state === "capturing" || saved.state === "interrupted";
  return <Screen>
    <Text style={styles.heading}>{saved.title}</Text>
    <Text style={styles.body}>{new Date(saved.created_at).toLocaleString()}</Text>
    <Card>
      <Text style={styles.heading}>{submitted ? `Uploaded · ${analysis.result?.processing_state?.replaceAll("_", " ") || "awaiting analysis"}` : interrupted ? "Recovery needed" : "Saved on this device"}</Text>
      <Text style={styles.body}>{Math.floor(status.currentTime)} / {Math.floor(status.duration || saved.recording.duration_ms / 1000)} seconds</Text>
      <Action label={status.playing ? "Pause" : "Play"} disabled={!status.isLoaded || !!status.error} onPress={() => void toggle()} />
      {interrupted ? <Action label="Recover playable audio" disabled={!status.isLoaded || !!status.error} onPress={recover} /> :
        !submitted && <Action label={busy ? "Uploading…" : "Upload recording"} disabled={busy} onPress={() => void upload()} />}
      <Text style={styles.body}>Audio and slide visits remain available on this device. New recordings upload the PDF and audio to the configured server automatically. Transcription starts after you accept the first-use OpenAI disclosure; cancelling leaves the server upload saved without transcription. You can retry a stopped upload or analysis here.</Text>
      {!!(notice || saved.error || status.error) && <Text accessibilityRole="alert" style={styles.body}>{notice || saved.error || "Audio could not be opened. The original file is retained."}</Text>}
    </Card>
    {(submitted || analysis.result) && <Card>
      <Text style={styles.heading}>Recording analysis</Text>
      <Action label="Refresh" disabled={analysis.busy} onPress={() => void analysis.refresh()} />
      {submitted && (!analysis.result || analysis.result.processing_state === "awaiting_analysis") &&
        <Action label="Analyze recording" disabled={analysis.busy || !!analysis.prompt} onPress={analysis.analyze} />}
      {submitted && analysis.result?.status === "failed" && <Action label="Retry analysis" disabled={analysis.busy || !!analysis.prompt || !analysis.result.retry_available} onPress={analysis.retry} />}
      {analysis.busy && <Text style={styles.body}>Checking analysis request…</Text>}
      {!!analysis.result?.failed_stage && <Text style={styles.body}>Stopped during {analysis.result.failed_stage.replaceAll("_", " ")}.</Text>}
      {!!analysis.result?.retry_at && <Text style={styles.body}>Retry available after {new Date(analysis.result.retry_at).toLocaleString()}. Refresh to check.</Text>}
      {!!analysis.result?.error && <Text accessibilityRole="alert" style={styles.body}>{analysis.result.error.message}</Text>}
      {!!analysis.notice && <Text accessibilityRole="alert" style={styles.body}>{analysis.notice}</Text>}
      {analysis.prompt && <>
        <Text style={styles.body}>{analysis.prompt.kind === "disclosure"
          ? "Transcription sends your saved audio through this server to OpenAI for hosted Whisper transcription. Audio and results remain available locally. Continue to allow automatic transcription after future recordings on this device, or Cancel."
          : "The previous OpenAI request may already have been charged. Retrying may send the audio again and incur another charge. There is no guarantee of exactly one provider request. Continue only if you accept this."}</Text>
        <Action label="Continue" onPress={analysis.continuePrompt} />
        <Action label="Cancel" onPress={analysis.cancelPrompt} />
      </>}
      {analysis.result?.analysis_outcome === "no_speech" && <Text style={styles.body}>No speech detected. No audio was sent to OpenAI.</Text>}
      {analysis.result?.transcript && <>
        <Text style={styles.heading}>{analysis.result.status === "completed" ? "Transcript" : "Saved partial transcript"}</Text>
        <Text style={styles.body}>{analysis.result.transcript.text || "No transcribed words."}</Text>
      </>}
    </Card>}
    <Card><Text style={styles.heading}>Saved slide visits</Text>
      {saved.recording.slide_events.map((event, index) => <Text key={index} style={styles.body}>{event.at_ms} ms · Slide {event.slide_index + 1}</Text>)}
    </Card>
  </Screen>;
}
