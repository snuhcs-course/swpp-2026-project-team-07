import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAudioPlayer } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { AppState, Text } from "react-native";
import { Action, Card, Screen, styles } from "../../ui/components";
import { getSavedAttempt, saveAttempt, type SavedAttempt } from "./storage";
import { API_URL } from "../../services/api";
import { activeVisitIndex, adjacentVisit, createPlaybackController, recordedVisits } from "../transcription/playback";
import { recoverRecording } from "./recovery";
import { uploadAttempt } from "./upload";
import { useAttemptAnalysis } from "../transcription/useAttemptAnalysis";
import { normalizeApi } from "../transcription/analysisStorage";
import { readReview } from "../transcription/reviewStorage";
import { isUuid, parseReview, validEvents, validVisits } from "../transcription/reviewValidation";
import { useReviewDeck } from "../transcription/useReviewDeck";
import { useReviewPdf } from "../transcription/useReviewPdf";
import { useReviewMedia } from "../transcription/useReviewMedia";
import { useReviewPlayerStatus } from "../transcription/useReviewPlayerStatus";
import { localUri } from "../transcription/reviewMedia";
import { PlaybackSlide } from "../transcription/PlaybackSlide";
import { PlaybackTranscript } from "../transcription/PlaybackTranscript";
import { FeedbackPanel } from "../feedback/FeedbackPanel";
import type { ReviewAttempt } from "../../contracts";

function readAttempt(id: string, api: string): { saved: SavedAttempt | null; review: ReviewAttempt | null; error: string } {
  try { return { saved: getSavedAttempt(id), review: readReview(api, id), error: "" }; }
  catch (cause) { return { saved: null, review: null, error: cause instanceof Error ? cause.message : "Could not read saved rehearsal. Try again." }; }
}

export function SavedAttemptScreen({ id, apiUrl = API_URL }: { id: string; apiUrl?: string }) {
  if (!isUuid(id)) return <Screen><Text style={styles.heading}>Invalid rehearsal ID</Text></Screen>;
  return <SavedAttemptContent key={`${normalizeApi(apiUrl)}:${id}`} id={id} apiUrl={apiUrl} />;
}
function SavedAttemptContent({ id, apiUrl }: { id: string; apiUrl: string }) {
  const [loaded, setLoaded] = useState(() => readAttempt(id, apiUrl));
  const saved = loaded.saved;
  const submitted = saved?.state === "submitted" && normalizeApi(saved.server_url || "") === normalizeApi(apiUrl);
  // Local capture state and server-only review identity are distinct. A cache alone never authorizes a local upload's processing on another API.
  const serverKnown = !!submitted || !!loaded.review?.deck_id;
  const expectedDeck = loaded.review?.deck_id || (submitted ? saved?.recording.deck_id : undefined);
  const analysis = useAttemptAnalysis(id, apiUrl, serverKnown, expectedDeck, saved?.recording.duration_ms || undefined);
  const rawReview = analysis.review || loaded.review;
  const deckId = rawReview?.deck_id || (submitted && isUuid(saved?.recording.deck_id) ? saved.recording.deck_id : null);
  const deckState = useReviewDeck(apiUrl, deckId, saved?.page_count);
  const review = useMemo(() => rawReview ? parseReview(rawReview, id, apiUrl, deckState.deck || undefined) : null, [rawReview, id, apiUrl, deckState.deck]);
  const knownPdf = useReviewPdf(apiUrl, deckId);
  const media = useReviewMedia(apiUrl, id, saved, review, deckState.deck, knownPdf);
  const uploadBusy = useRef(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const player = useAudioPlayer(media.audio.uri, { updateInterval: 100 });
  const { status, hasLoaded, refreshStatus } = useReviewPlayerStatus(player);
  const [playingIntent, setPlayingIntent] = useState(false);
  const active = useRef(true);
  const control = useMemo(() => createPlaybackController(player, setPlayingIntent, () => setNotice("Could not seek this audio. Its file and checkpoint are retained.")), [player]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => () => control.dispose(), [control]);
  useFocusEffect(useCallback(() => {
    if (AppState.currentState === 'active') { control.activate(); refreshStatus(); }
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') control.activate(); else control.deactivate();
      refreshStatus();
    });
    return () => { control.deactivate(); listener.remove(); };
  }, [control, refreshStatus]));
  useEffect(() => {
    const current = player.currentStatus;
    if (status.didJustFinish) {
      control.finished(current.currentTime * 1000, current.duration * 1000);
    } else if (!status.playing && status.isLoaded && !status.isBuffering && !status.error &&
        !current.playing && current.isLoaded && !current.isBuffering && !current.didJustFinish && !current.error) {
      // Use fresh native state to reject a delayed seek-pause notification.
      // EOF follows its own position/seek policy above.
      control.nativePaused();
    }
  }, [status, control, player]);
  const audioUri = media.audio.uri, audioFailed = media.audioFailed;
  useEffect(() => {
    if (status.error && audioUri) { control.pause(); audioFailed(); }
  }, [status.error, audioUri, audioFailed, control]);
  const interruptedCapture = saved?.state === 'interrupted' || saved?.state === 'capturing';
  const duration = saved?.recording.duration_ms || review?.duration_ms || (interruptedCapture && hasLoaded ? Math.round(status.duration * 1000) : 0);
  const position = Number.isFinite(status.currentTime) ? Math.max(0, Math.round(status.currentTime * 1000)) : 0;
  const ready = !!media.audio.uri && status.isLoaded && !status.error && duration > 0;
  const canSeek = !!media.audio.uri && hasLoaded && (status.isLoaded || status.isBuffering) && !status.error && duration > 0;
  const seek = (ms: number) => { if (canSeek) control.seek(ms, duration); };
  const canRecover = !!audioUri && audioUri === localUri(saved?.recording.audio_uri) && status.isLoaded && !status.error;
  const pages = saved?.page_count || deckState.deck?.page_count || 10;
  const events = saved && validEvents(saved.recording.slide_events, duration, pages) ? saved.recording.slide_events : review?.slide_events || [];
  const aligned = validVisits(review?.visits, duration, pages, events.length ? events : undefined) ? review!.visits : null;
  const visits = aligned || recordedVisits(events, duration);
  const visit = activeVisitIndex(visits, position);
  const previousVisit = adjacentVisit(visits, visit, -1);
  const nextVisit = adjacentVisit(visits, visit, 1);
  const canAnalyze = serverKnown && (!!submitted || (!!deckState.deck && !!review?.processing_result));
  function reload() { setLoaded(readAttempt(id, apiUrl)); setNotice(""); }
  async function upload() {
    if (uploadBusy.current) return;
    uploadBusy.current = true; setBusy(true); setNotice("");
    try { await uploadAttempt(id, apiUrl); }
    catch (cause) { if (active.current) setNotice(cause instanceof Error ? cause.message : "Upload failed. The audio is retained."); }
    finally {
      if (active.current) {
        try { setLoaded({ ...loaded, saved: getSavedAttempt(id), error: "" }); }
        catch (cause) { setNotice(previous => [previous, cause instanceof Error ? cause.message : "Could not refresh saved status. Try again."].filter(Boolean).join(" ")); }
        finally { uploadBusy.current = false; setBusy(false); }
      }
    }
  }
  function recover() {
    if (!saved || !canRecover || !audioUri) return;
    try {
      saveAttempt({ ...saved, recording: recoverRecording({ ...saved.recording, audio_uri: audioUri }, status.duration * 1000), state: "saved", error: undefined });
      setLoaded({ ...loaded, saved: getSavedAttempt(id), error: "" }); setNotice("Recovered locally. You can now upload.");
    } catch (cause) { setNotice(String(cause)); }
  }
  function toggle() {
    if (control.isPlaying()) { control.pause(); return; }
    if (ready) control.play(position, duration);
  }
  if (!saved && !review) return <Screen>
    <Text style={styles.heading}>{loaded.error ? "Could not load saved rehearsal" : "Saved rehearsal not found for this API"}</Text>
    {!!loaded.error && <Text accessibilityRole="alert" style={styles.body}>{loaded.error}</Text>}
    <Action label="Reload saved rehearsal" onPress={reload} />
  </Screen>;
  const interrupted = saved?.state === "capturing" || saved?.state === "interrupted";
  return <Screen>
    {media.validators}
    <Text style={styles.heading}>{saved?.title || deckState.deck?.title || "Saved rehearsal"}</Text>
    <Text style={styles.body}>{saved ? "Local capture" : "Server rehearsal · review copy"} · {saved?.created_at || review?.created_at ? new Date(saved?.created_at || review!.created_at!).toLocaleString() : "Date unavailable"}</Text>
    <Card>
      <Text style={styles.heading}>{submitted ? `Uploaded · ${analysis.result?.processing_state?.replaceAll("_", " ") || "awaiting analysis"}` : interrupted ? "Recovery needed" : saved ? "Saved on this device" : review?.processing_state.replaceAll('_', ' ')}</Text>
      <Text style={styles.body}>{Math.floor(position / 1000)} / {Math.floor(duration / 1000)} seconds</Text>
      <Action label={playingIntent ? "Pause" : "Play"} disabled={!ready && !playingIntent} onPress={toggle} />
      <Action label="−5 seconds" disabled={!canSeek} onPress={() => seek(position - 5000)} secondary />
      <Action label="+5 seconds" disabled={!canSeek} onPress={() => seek(position + 5000)} secondary />
      {!!media.audio.error && <Text style={styles.body}>{media.audio.error}</Text>}
      {!!status.error && <Text accessibilityRole="alert" style={styles.body}>Audio could not be opened. The original file is retained.</Text>}
      {!media.audio.uri && media.audioSpec && <Action label={media.audio.busy ? "Checking audio…" : "Download audio for offline review"} disabled={media.audio.busy} onPress={() => void media.download('audio')} />}
      {interrupted ? <Action label="Recover playable audio" disabled={!canRecover} onPress={recover} /> :
        saved && !submitted && <Action label={busy ? "Uploading…" : "Upload recording"} disabled={busy} onPress={() => void upload()} />}
      <Text style={styles.body}>Viewing, downloading and replaying do not analyze this recording. Analyze sends audio only when you choose it.</Text>
      {!!(notice || saved?.error) && <Text accessibilityRole="alert" style={styles.body}>{notice || saved?.error}</Text>}
    </Card>
    <Card>
      <Text style={styles.heading}>{visit >= 0 ? `Slide ${visits[visit].slide_index + 1} · Visit ${visit + 1}` : 'Slides'}</Text>
      {media.pdf.uri && <PlaybackSlide uri={media.pdf.uri} slide={visit >= 0 ? visits[visit].slide_index : 0} pages={pages} onError={media.pdfFailed} />}
      {!!media.pdf.error && <Text style={styles.body}>{media.pdf.error} Audio and transcript remain available.</Text>}
      {!media.pdf.uri && media.pdfSpec && <Action label={media.pdf.busy ? "Checking PDF…" : "Download PDF for offline review"} disabled={media.pdf.busy} onPress={() => void media.download('pdf')} />}
      {!!deckState.notice && <Text style={styles.body}>{deckState.notice}</Text>}
    </Card>
    {(serverKnown || analysis.result || review) && <Card>
      <Text style={styles.heading}>Recording analysis</Text>
      <Action label="Refresh" disabled={analysis.busy} onPress={() => { deckState.refresh(); void analysis.refresh(); }} />
      {canAnalyze && (!analysis.result || analysis.result.processing_state === "awaiting_analysis") &&
        <Action label="Analyze recording" disabled={analysis.busy || !!analysis.prompt} onPress={analysis.analyze} />}
      {canAnalyze && analysis.result?.status === "failed" && <Action label="Retry analysis" disabled={analysis.busy || !!analysis.prompt || !analysis.result.retry_available} onPress={analysis.retry} />}
      {analysis.busy && <Text style={styles.body}>Checking analysis request…</Text>}
      {!!analysis.result?.failed_stage && <Text style={styles.body}>Stopped during {analysis.result.failed_stage.replaceAll("_", " ")}.</Text>}
      {!!analysis.result?.retry_at && <Text style={styles.body}>Retry available after {new Date(analysis.result.retry_at).toLocaleString()}. Refresh to check.</Text>}
      {!!analysis.result?.error && <Text accessibilityRole="alert" style={styles.body}>{analysis.result.error.message}</Text>}
      {!!analysis.notice && <Text accessibilityRole="alert" style={styles.body}>{analysis.notice}</Text>}
      {analysis.prompt && <>
        <Text style={styles.body}>{analysis.prompt.kind === "disclosure"
          ? "Analyze sends your saved audio through this server to OpenAI for hosted Whisper transcription. Audio and results remain available locally. Continue to allow this for future analyses on this device, or Cancel."
          : "The previous OpenAI request may already have been charged. Retrying may send the audio again and incur another charge. There is no guarantee of exactly one provider request. Continue only if you accept this."}</Text>
        <Action label="Continue" onPress={analysis.continuePrompt} />
        <Action label="Cancel" onPress={analysis.cancelPrompt} />
      </>}
      {analysis.result?.analysis_outcome === "no_speech" && <Text style={styles.body}>No speech detected. No audio was sent to OpenAI.</Text>}
      {review?.transcript && <>
        <Text style={styles.heading}>{review.status === "completed" ? "Transcript" : "Saved partial transcript"}</Text>
        <PlaybackTranscript transcript={review.transcript} positionMs={position} durationMs={duration} ready={canSeek} onSeek={seek} />
      </>}
    </Card>}
    {review?.deck_id && <FeedbackPanel key={`${normalizeApi(apiUrl)}:${id}:${review.deck_id}:${review.transcript_id || ''}:${review.duration_ms}:${JSON.stringify(review.slide_events)}`}
      id={id} apiUrl={apiUrl} review={review} pages={deckState.deck?.page_count || (submitted ? saved?.page_count : undefined)} canSeek={canSeek} onSeek={seek} />}
    <Card><Text style={styles.heading}>Saved slide visits</Text>
      <Text style={styles.body}>{aligned ? 'Aligned chronological visits' : 'Recorded navigation'}</Text>
      <Action label="Previous visit" disabled={!canSeek || previousVisit < 0} onPress={() => seek(visits[previousVisit].start_ms)} secondary />
      <Action label="Next visit" disabled={!canSeek || visit < 0 || nextVisit < 0} onPress={() => seek(visits[nextVisit].start_ms)} secondary />
      {visits.map((item, index) => <Action key={index} label={`Visit ${index + 1} · Slide ${item.slide_index + 1} · ${item.start_ms}–${item.end_ms} ms${item.start_ms === item.end_ms ? ' · instantaneous' : ''}${index === visit ? ' · current' : ''}`}
        disabled={!canSeek} secondary onPress={() => seek(item.start_ms)} />)}
      {!visits.length && <Text style={styles.body}>Saved navigation timing is unavailable.</Text>}
    </Card>
    {review?.metrics && <Card>
      <Text style={styles.heading}>Saved rehearsal timing</Text>
      {review.metrics.time_per_slide.map(item => <Text key={item.slide_index} style={styles.body}>Slide {item.slide_index + 1}: {(item.duration_ms / 1000).toFixed(1)} seconds</Text>)}
      {review.metrics.speaking_rates.map(rate => <Text key={rate.language} style={styles.body}>{rate.language === 'en' ? 'English words/min' : 'Korean Hangul runs/min'}: {rate.per_minute.toFixed(1)}</Text>)}
      <Text style={styles.body}>Rates use total rehearsal time, including silence. Korean Hangul runs are an estimate, not a linguistic word count.</Text>
    </Card>}
  </Screen>;
}
