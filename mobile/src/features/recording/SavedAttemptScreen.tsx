import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAudioPlayer } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { activeLayout } from "../../layouts/registry";
import { transcriptPresentation } from "../transcription/transcriptPresentation";
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
import { FeedbackPanel } from "../feedback/FeedbackPanel";
import type { ReviewAttempt } from "../../contracts";

function readAttempt(id: string, api: string): { saved: SavedAttempt | null; review: ReviewAttempt | null; error: string } {
  try { return { saved: getSavedAttempt(id), review: readReview(api, id), error: "" }; }
  catch (cause) { return { saved: null, review: null, error: cause instanceof Error ? cause.message : "Could not read saved rehearsal. Try again." }; }
}

export function SavedAttemptScreen({ id, apiUrl = API_URL }: { id: string; apiUrl?: string }) {
  if (!isUuid(id)) return <activeLayout.Message title="Invalid rehearsal ID" />;
  return <SavedAttemptContent key={`${normalizeApi(apiUrl)}:${id}`} id={id} apiUrl={apiUrl} />;
}
function SavedAttemptContent({ id, apiUrl }: { id: string; apiUrl: string }) {
  const { model, validators, feedbackInput } = useSavedReviewController(id, apiUrl);
  // Validators and controller lifetimes belong to this host, never a tab panel.
  return <>{validators}{feedbackInput ? <FeedbackPanel key={feedbackInput.identity} {...feedbackInput}>
    {feedback => <activeLayout.Review model={{ ...model, feedback }} />}
  </FeedbackPanel> : <activeLayout.Review model={model} />}</>;
}
export function useSavedReviewController(id: string, apiUrl: string) {
  const [tab, setTab] = useState<'overview' | 'slides' | 'transcript'>('overview');
  const slideReveal = useRef<(() => void) | null>(null);
  const bindSlideReveal = useCallback((callback: () => void) => { slideReveal.current = callback; return () => { if (slideReveal.current === callback) slideReveal.current = null; }; }, []);
  const [evidenceVisit, setEvidenceVisit] = useState(0);
  const [loaded, setLoaded] = useState(() => readAttempt(id, apiUrl));
  const saved = loaded.saved;
  const submitted = saved?.state === "submitted" && normalizeApi(saved.server_url || "") === normalizeApi(apiUrl);
  // Local capture state and server-only review identity are distinct. A cache alone never authorizes a local upload's processing on another API.
  const serverKnown = !!submitted || !!loaded.review?.deck_id;
  const expectedDeck = loaded.review?.deck_id || (submitted ? saved?.recording.deck_id : undefined);
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const autoConsumed = useRef(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  const analysis = useAttemptAnalysis(id, apiUrl, serverKnown, expectedDeck, saved?.recording.duration_ms || undefined, autoAnalyze);
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
  const slideTimings = [...new Set(visits.map(item => item.slide_index))].sort((a, b) => a - b).map(slide => {
    const ranges = visits.filter(item => item.slide_index === slide);
    return { slide, ranges, total: ranges.reduce((sum, item) => sum + item.end_ms - item.start_ms, 0) };
  });
  const visit = activeVisitIndex(visits, position);
  const previousVisit = adjacentVisit(visits, visit, -1);
  const nextVisit = adjacentVisit(visits, visit, 1);
  const canAnalyze = serverKnown && (!!submitted || (!!deckState.deck && !!review?.processing_result));
  function reload() { setLoaded(readAttempt(id, apiUrl)); setNotice(""); }
  const upload = useCallback(async () => {
    if (uploadBusy.current) return;
    uploadBusy.current = true; setBusy(true); setNotice("");
    try { await uploadAttempt(id, apiUrl); }
    catch (cause) { if (active.current) setNotice(cause instanceof Error ? cause.message : "Upload failed. The audio is retained."); }
    finally {
      if (active.current) {
        try { const refreshed = getSavedAttempt(id); setLoaded(previous => ({ ...previous, saved: refreshed, error: "" })); }
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
      setLoaded(previous => ({ ...previous, saved: next, error: "" }));
      setAutoAnalyze(true);
      if (!submitted) void upload();
    } catch {
      setNotice("Could not start automatic transcription. Your recording is saved; upload or analyze it when ready.");
    }
  }, [apiUrl, foreground, saved, submitted, upload]));
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
  const interrupted = saved?.state === 'capturing' || saved?.state === 'interrupted';
  const slideStage = media.pdf.uri ? <PlaybackSlide uri={media.pdf.uri} slide={visit >= 0 ? visits[visit].slide_index : 0} pages={pages} onError={media.pdfFailed} /> : null;
  const transcriptSpans = transcriptPresentation(review?.transcript, position, duration, canSeek, seek);
  function refreshAnalysis() { if (!analysis.busy) { deckState.refresh(); void analysis.refresh(); } }
  function seekPreviousVisit() { if (previousVisit >= 0) seek(visits[previousVisit].start_ms); }
  function seekNextVisit() { if (visit >= 0 && nextVisit >= 0) seek(visits[nextVisit].start_ms); }
  return {
    validators: media.validators,
    feedbackInput: review?.deck_id ? { id, apiUrl, review, pages: deckState.deck?.page_count || (submitted ? saved?.page_count : undefined), canSeek, section: tab,
      identity: `${normalizeApi(apiUrl)}:${id}:${review.deck_id}:${review.transcript_id || ''}:${review.duration_ms}:${JSON.stringify(review.slide_events)}`,
      slideIndex: visit >= 0 ? visits[visit].slide_index : undefined,
      onSeek: (ms: number) => { slideReveal.current?.(); setEvidenceVisit(value => value + 1); seek(ms); } } : null,
    model: {
      tab, setTab, evidenceVisit, bindSlideReveal, duration, position, canSeek, playingIntent, ready, toggle, seek,
      saved: saved ? { title: saved.title, created_at: saved.created_at, error: saved.error } : null,
      deckState: { deck: deckState.deck, notice: deckState.notice }, review, busy, submitted, interrupted,
      analysis: { result: analysis.result, busy: analysis.busy, prompt: analysis.prompt, notice: analysis.notice,
        analyze: () => { if (canAnalyze) analysis.analyze(); }, retry: () => { if (canAnalyze) analysis.retry(); }, continuePrompt: analysis.continuePrompt, cancelPrompt: analysis.cancelPrompt },
      media: { audio: { available: !!media.audio.uri, error: media.audio.error, busy: media.audio.busy }, pdf: { available: !!media.pdf.uri, error: media.pdf.error, busy: media.pdf.busy },
        audioSpec: !!media.audioSpec, pdfSpec: !!media.pdfSpec, download: media.download }, status: { error: status.error },
      canRecover, recover, upload, notice, serverKnown, canAnalyze, aligned, visits, slideTimings, visit, previousVisit, nextVisit, slideStage, transcriptSpans,
      refreshAnalysis, seekPreviousVisit, seekNextVisit, loaded: { error: loaded.error }, reload,
    },
  };
}
