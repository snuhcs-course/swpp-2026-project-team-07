import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { File } from "expo-file-system";
import type { AttemptResult } from "../../contracts";
import { Action, Card, Screen, colors, styles } from "../../ui/components";
import { recoverRecording } from "../recording/recovery";
import { getSavedAttempt, saveAttempt, type SavedAttempt } from "../recording/storage";
import { isUploading, uploadAttempt } from "../recording/upload";
import { transcriptionService } from "./service";
import { activeWordIndex, resumeAfterSeek, transcriptSpans } from "./playback";

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
function feedbackLabel(stage?: string) {
  return ({ disabled: "AI feedback is disabled. Transcript and timing do not require it.", waiting_quota: "Waiting for AI quota", waiting: "Waiting for slide analysis", running: "Preparing feedback", complete: "Feedback ready", stale: "Slide descriptions changed. Re-analyze to update suggestions.", unknown_outcome: "AI request outcome is uncertain. Ask the backend operator to review it before retrying." } as Record<string, string>)[stage ?? ""] ?? "Feedback pending";
}

export function ResultsScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId?: string }>();
  const id = typeof attemptId === "string" ? attemptId : "";
  const [saved, setSaved] = useState<SavedAttempt | null>(() => id ? getSavedAttempt(id) : null);
  const [result, setResult] = useState<AttemptResult | undefined>(saved?.result);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const uri = useMemo(() => {
    const local = saved?.recording.audio_uri;
    if (local && new File(local).exists) return local;
    return result?.audio_url ?? null;
  }, [saved?.recording.audio_uri, result?.audio_url]);
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const focused = useIsFocused();
  const intent = useRef(0);
  const seeking = useRef(false);
  const ready = status.isLoaded && !status.error;
  useEffect(() => { if (!focused) { intent.current++; player.pause(); } }, [focused, player]);
  useFocusEffect(useCallback(() => {
    if (!id || refresh < 0) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function read() {
      let again = true;
      const local = getSavedAttempt(id);
      setSaved(local);
      if (local?.state === "submitted" || (!local && id)) {
        try {
          const current = await transcriptionService.getResult(id, { signal: controller.signal });
          if (controller.signal.aborted) return;
          setResult(current); setNotice("");
          if (local) saveAttempt({ ...local, result: current });
          again = current.status === "pending" || current.status === "processing";
        } catch {
          if (controller.signal.aborted) return;
          setNotice("Cannot reach the server. Saved audio and any cached transcript remain available.");
          again = false;
        }
      } else if (local && !isUploading(id)) again = false;
      if (!controller.signal.aborted && again) timer = setTimeout(() => void read(), 2000);
    }
    void read();
    return () => { controller.abort(); if (timer) clearTimeout(timer); intent.current++; };
  }, [id, refresh]));

  async function retry() {
    if (busy || isUploading(id)) return;
    setBusy(true); setNotice("");
    try {
      const local = getSavedAttempt(id);
      if (local && local.state !== "submitted") await uploadAttempt(id);
      else await transcriptionService.retry(id);
      setRefresh(value => value + 1);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Retry failed. Your audio is retained."); }
    finally { setSaved(getSavedAttempt(id)); setBusy(false); }
  }
  function recover() {
    if (!saved || !ready || status.duration <= 0) return;
    try {
      const recording = recoverRecording(saved.recording, status.duration * 1000);
      saveAttempt({ ...saved, recording, state: "saved", error: undefined });
      setSaved(getSavedAttempt(id));
    } catch (cause) { setNotice(String(cause)); return; }
    void retry();
  }
  async function seek(ms: number) {
    if (!ready || seeking.current) return;
    intent.current++; seeking.current = true;
    try { await player.seekTo(Math.max(0, Math.min(ms / 1000, status.duration))); }
    catch { setNotice("Could not seek. Try again."); }
    finally { seeking.current = false; }
  }
  async function toggle() {
    if (!ready) return;
    const operation = ++intent.current;
    if (status.playing) { player.pause(); return; }
    if (seeking.current) return;
    try {
      if (status.didJustFinish || status.currentTime >= status.duration - .05) {
        seeking.current = true;
        await resumeAfterSeek(() => player.seekTo(0), () => intent.current === operation, () => player.play());
      } else player.play();
    } catch { setNotice("Playback failed. The original recording is retained."); }
    finally { seeking.current = false; }
  }
  const transcript = result?.transcript;
  const spans = useMemo(() => transcript ? transcriptSpans(transcript) : [], [transcript]);
  const active = transcript ? activeWordIndex(transcript.words, status.currentTime * 1000) : -1;
  const interrupted = saved?.state === "capturing" || saved?.state === "interrupted";
  const visits = result?.visits ?? saved?.recording.slide_events.map((event, i, events) => ({ slide_index: event.slide_index, start_ms: event.at_ms, end_ms: events[i + 1]?.at_ms ?? saved.recording.duration_ms, words: [] })) ?? [];
  if (!id) return <Screen><Text style={styles.heading}>Choose a saved rehearsal</Text><Action label="Open library" onPress={() => router.replace("/")} /></Screen>;
  return <Screen>
    <Text style={styles.title}>Your rehearsal</Text>
    <Card>
      <Text style={styles.heading}>Playback</Text>
      <Text style={styles.body}>{clock(status.currentTime * 1000)} / {clock(status.duration * 1000 || saved?.recording.duration_ms || 0)}</Text>
      <View style={styles.row}>
        <Action label="Back 5s" secondary disabled={!ready} onPress={() => void seek(status.currentTime * 1000 - 5000)} />
        <Action label={status.playing ? "Pause" : status.didJustFinish ? "Replay" : "Play"} disabled={!ready} onPress={() => void toggle()} />
      </View>
      {!!status.error && <Text style={styles.body}>Audio could not be opened. An abrupt shutdown may have left its container unfinished. The saved file and timeline are retained.</Text>}
    </Card>
    {interrupted && <Card><Text style={styles.heading}>Interrupted recording</Text><Text style={styles.body}>Listen to the saved audio, then recover its timeline and upload it. Recovery uses the actual audio duration.</Text><Action label="Recover & analyze" disabled={!ready || busy} onPress={recover} /></Card>}
    <Card>
      <Text style={styles.heading}>Analysis progress</Text>
      <Text style={styles.body}>Upload: {saved?.state ?? "saved on server"}</Text>
      <Text style={styles.body}>Transcript: {result?.stages?.transcription ?? (transcript ? "complete" : "waiting for upload")}</Text>
      <Text style={styles.body}>{feedbackLabel(result?.stages?.feedback)}</Text>
      {!!result?.next_retry_at && <Text style={styles.body}>Next quota check: {new Date(result.next_retry_at).toLocaleString()}</Text>}
      {!!(notice || saved?.error || result?.error) && <Text accessibilityRole="alert" style={styles.body}>{notice || saved?.error || result?.error?.message}</Text>}
      {!interrupted && (saved?.state !== "submitted" || result?.status === "failed" || result?.feedback_stale || (result?.stages?.feedback === "disabled" && result.feedback_available)) && result?.stages?.feedback !== "unknown_outcome" && <Action label={busy || isUploading(id) ? "Working…" : "Retry unfinished analysis"} disabled={busy || isUploading(id)} onPress={() => void retry()} />}
      <Action label="Refresh saved result" secondary onPress={() => setRefresh(value => value + 1)} />
    </Card>
    <Card>
      <Text style={styles.heading}>Transcript</Text>
      {transcript ? <>
        <Text style={{ color: colors.ink, fontSize: 19, lineHeight: 32 }}>{spans.map((span, i) => <Text key={i} accessibilityRole={span.wordIndex === null ? undefined : "button"}
          onPress={span.wordIndex === null ? undefined : () => void seek(transcript.words[span.wordIndex!].start_ms)}
          style={span.wordIndex === active ? { backgroundColor: "#FFE39B", fontWeight: "700" } : undefined}>{span.text}</Text>)}</Text>
        {!transcript.text && <Text style={styles.body}>No speech was detected.</Text>}
        <Text style={styles.body}>Tap a word to seek. Recognition and word timing may be imperfect, especially when switching languages.</Text>
      </> : <Text style={styles.body}>Your transcript will appear here as soon as local analysis finishes.</Text>}
    </Card>
    <Card><Text style={styles.heading}>Slide visits</Text>{visits.map((visit, i) => <Pressable accessibilityRole="button" key={i} onPress={() => void seek(visit.start_ms)}><Text style={styles.body}>{clock(visit.start_ms)}–{clock(visit.end_ms)} · Slide {visit.slide_index + 1}</Text></Pressable>)}</Card>
    {result?.metrics?.time_per_slide && <Card><Text style={styles.heading}>Timing & pace</Text>
      {result.metrics.time_per_slide.map(slide => <Text key={slide.slide_index} style={styles.body}>Slide {slide.slide_index + 1}: {clock(slide.duration_ms)}</Text>)}
      {result.metrics.speaking_rates.map(rate => <Text key={rate.language} style={styles.body}>{rate.per_minute} {rate.unit}</Text>)}
      <Text style={styles.body}>{result.metrics.rate_note}</Text>
    </Card>}
    <Text style={styles.heading}>Top improvements</Text>
    {(result?.feedback ?? []).map((item, i) => <Card key={i}><Text style={styles.heading}>{item.observation}</Text><Text style={styles.body}>{item.suggestion}</Text><Text style={styles.body}>Slide {item.slide_index + 1}: “{item.slide_evidence}”</Text><Action label={`Hear evidence · ${clock(item.start_ms)}`} secondary onPress={() => void seek(item.start_ms)} /></Card>)}
    {result?.stages?.feedback === "complete" && !result.feedback.length && <Text style={styles.body}>There was not enough supported evidence for a useful suggestion.</Text>}
    {!!result?.deck_id && <Action label="Review slide descriptions" secondary onPress={() => router.push({ pathname: "/descriptions", params: { deckId: result.deck_id } })} />}
  </Screen>;
}
