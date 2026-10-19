// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: background upload + hosted transcription for each take.
// Each take that the screens need is handled by an invisible <AttemptWorker>, which reuses
// the existing useAttemptAnalysis hook (revision-aware processing, polling, offline cache,
// first-use ElevenLabs disclosure) and the existing uploadAttempt service, exactly as the
// former saved-rehearsal screen did after a recording.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AttemptResult, Transcript } from '../../contracts';
import { API_URL } from '../../services/api';
import { getSavedAttempt, saveAttempt, type SavedAttempt } from '../recording/storage';
import { uploadAttempt } from '../recording/upload';
import { enableInitialQa } from '../qa/automatic';
import { enableInitialFeedback } from '../feedback/automaticFeedback';
import { enableAutomaticScore } from '../feedback/automaticPresentationScore';
import { normalizeApi, readAnalysis } from '../transcription/analysisStorage';
import { readReview } from '../transcription/reviewStorage';
import { existingLocalFile, reviewMedia } from '../transcription/reviewMedia';
import { useAttemptAnalysis } from '../transcription/useAttemptAnalysis';
import { bump } from '../presentations/store';

export type Stage = 'local' | 'uploading' | 'upload_failed' | 'awaiting' | 'processing' | 'done' | 'no_speech' | 'failed' | 'interrupted' | 'missing';
export type WorkerState = {
  stage: Stage; detail: string; prompt: 'disclosure' | 'uncertain' | null;
  busy: boolean; retryAvailable: boolean; retryAt: string | null;
  continuePrompt?: () => void; cancelPrompt?: () => void; retry?: () => void; analyze?: () => void; retryUpload?: () => void; refresh?: () => void;
};
const workers = new Map<string, WorkerState>();
const listeners = new Set<() => void>();
let version = 0;
function publish(id: string, state: WorkerState | null) {
  if (state) workers.set(id, state); else workers.delete(id);
  version++;
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Takes whose one-time automatic transcription hand-off was consumed in this session. */
const handedOff = new Set<string>();
const handOffFailed = new Set<string>();
function notify() { version++; listeners.forEach(l => l()); }
/** A saved take opened from Home also needs the single shared upload/analysis worker. */
const playbackIds = new Set<string>();
const playbackListeners = new Set<() => void>();
let playbackSnapshot: readonly string[] = [];
const subscribePlayback = (l: () => void) => { playbackListeners.add(l); return () => { playbackListeners.delete(l); }; };
export function subscribePlaybackId(id: string) {
  playbackIds.add(id); playbackSnapshot = [...playbackIds]; playbackListeners.forEach(l => l());
  return () => { playbackIds.delete(id); playbackSnapshot = [...playbackIds]; playbackListeners.forEach(l => l()); };
}
export function usePlaybackIds() {
  return useSyncExternalStore(subscribePlayback, () => playbackSnapshot);
}
export function useWorkers() {
  useSyncExternalStore(subscribe, () => version);
  return workers;
}

const api = () => normalizeApi(API_URL);
/** Transcript of a take, once hosted transcription has produced one (cached offline). */
export function transcriptOf(id: string): Transcript | null {
  try { return readReview(api(), id)?.transcript ?? null; } catch { return null; }
}
function resultOf(id: string): AttemptResult | null {
  try { return readAnalysis(api(), id); } catch { return null; }
}
/** Where a take stands, from the saved attempt and the cached analysis (no network). */
export function stageOf(id: string): Stage {
  const result = resultOf(id);
  if (result?.analysis_outcome === 'no_speech' && result.status === 'completed') return 'no_speech';
  if (result?.status === 'completed' || transcriptOf(id)) return 'done';
  if (result?.status === 'failed') return 'failed';
  if (result?.status === 'processing') return 'processing';
  let review: ReturnType<typeof readReview> = null;
  try { review = readReview(api(), id); } catch { /* Keep the local recording accessible. */ }
  if (review?.status === 'completed') return review.transcript ? 'done' : 'no_speech';
  if (review?.status === 'failed') return 'failed';
  if (review?.status === 'processing') return 'processing';
  if (review?.status === 'pending') return 'awaiting';
  let saved: SavedAttempt | null = null;
  try { saved = getSavedAttempt(id); } catch { /* storage unavailable */ }
  if (!saved) return result ? 'awaiting' : 'missing';
  if (saved.state === 'capturing' || saved.state === 'interrupted') return 'interrupted';
  if (saved.state === 'uploading') return 'uploading';
  if (saved.state === 'upload_failed') return 'upload_failed';
  if (saved.state === 'submitted') return 'awaiting';
  return 'local';
}
/** Local audio of a take: the original recording, or a validated offline download. */
export function audioOf(id: string): string | null {
  try {
    const own = existingLocalFile(getSavedAttempt(id)?.recording.audio_uri);
    if (own) return own;
    const review = readReview(api(), id);
    if (review?.audio_url && review.duration_ms) {
      return reviewMedia.cached({ api: api(), id, kind: 'audio', url: review.audio_url, durationMs: review.duration_ms })?.uri ?? null;
    }
  } catch { /* fall through */ }
  return null;
}

const STAGE_TEXT: Record<string, string> = { queued: 'Queued', checking_audio: 'Checking audio', transcribing: 'Transcribing', aligning: 'Matching words to slides' };

function AttemptWorker({ id }: { id: string }) {
  const address = API_URL;
  const [saved, setSaved] = useState<SavedAttempt | null>(() => { try { return getSavedAttempt(id); } catch { return null; } });
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const submitted = saved?.state === 'submitted' && normalizeApi(saved.server_url || '') === normalizeApi(address);
  const cached = useMemo(() => { try { return readReview(address, id); } catch { return null; } }, [address, id]);
  const serverKnown = !!submitted || !!cached?.deck_id;
  const expectedDeck = cached?.deck_id || (submitted ? saved?.recording.deck_id : undefined);
  const auto = useSyncExternalStore(subscribe, () => handedOff.has(id));
  const handOffError = useSyncExternalStore(subscribe, () => handOffFailed.has(id));
  const analysis = useAttemptAnalysis(id, address, serverKnown, expectedDeck, saved?.recording.duration_ms || undefined, auto);
  const consumed = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const upload = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setUploading(true); setUploadError('');
    try { await uploadAttempt(id, address); }
    catch (error) { if (mounted.current) setUploadError(error instanceof Error ? error.message : 'Upload failed. The audio is kept on this phone.'); }
    finally {
      busy.current = false;
      if (mounted.current) { setUploading(false); try { setSaved(getSavedAttempt(id)); } catch { /* keep */ } }
      bump();
    }
  }, [address, id]);

  // Same one-time hand-off as the former saved-rehearsal screen: consume the flag
  // before any I/O so reopening never silently submits the recording twice.
  useEffect(() => {
    if (consumed.current || !saved?.auto_process_api || normalizeApi(saved.auto_process_api) !== normalizeApi(address) ||
        !['saved', 'submitted'].includes(saved.state)) return;
    consumed.current = true;
    try {
      saveAttempt({ ...saved, auto_process_api: undefined });
      enableInitialQa(address,id);
      enableAutomaticScore(address,id);
      handedOff.add(id);
    } catch { handOffFailed.add(id); }
    notify();
    if (handedOff.has(id) && !submitted) void upload();
  }, [address, id, saved, submitted, upload]);

  const result = analysis.result;
  const stage: Stage = (() => {
    if (result?.analysis_outcome === 'no_speech' && result.status === 'completed') return 'no_speech';
    if (result?.status === 'completed') return 'done';
    if (result?.status === 'failed') return 'failed';
    if (result?.status === 'processing') return 'processing';
    if (uploading || saved?.state === 'uploading') return 'uploading';
    if (uploadError || saved?.state === 'upload_failed') return 'upload_failed';
    if (saved?.state === 'interrupted' || saved?.state === 'capturing') return 'interrupted';
    if (serverKnown) return 'awaiting';
    return 'local';
  })();
  const detail = stage === 'processing' ? STAGE_TEXT[result?.processing_state ?? ''] ?? 'Transcribing'
    : stage === 'failed' ? (result?.error?.message || 'Transcription stopped.') : stage === 'upload_failed' ? (uploadError || saved?.error || 'Upload failed.')
      : handOffError && !analysis.notice ? 'Could not start automatic transcription. Your recording is saved.' : analysis.notice;
  const { continuePrompt, cancelPrompt, retry, analyze, prompt, refresh } = analysis;
  useEffect(() => {
    publish(id, { stage, detail, prompt: prompt?.kind ?? null, busy: uploading || analysis.busy,
      retryAvailable: !!result?.retry_available, retryAt: result?.retry_at ?? null,
      continuePrompt, cancelPrompt, retry: retry as () => void, analyze, refresh: () => void refresh(), retryUpload: () => void upload() });
  }, [id, stage, detail, prompt, continuePrompt, cancelPrompt, retry, analyze, refresh, result?.retry_available, result?.retry_at, analysis.busy, uploading, upload]);
  useEffect(() => () => publish(id, null), [id]);
  // New results land in the review cache: let the screens rebuild their lines.
  useEffect(() => {
    if (result?.status === 'completed' && result.transcript?.words.length) enableInitialFeedback(API_URL, id);
    bump();
  }, [id, result?.status, result?.processing_state, result?.transcript]);
  return null;
}

/** Keeps a worker alive for every take a screen still needs words for. */
export function AnalysisHost({ ids }: { ids: readonly string[] }) {
  const unique = [...new Set(ids)];
  return <>{unique.map(id => <AttemptWorker key={id} id={id} />)}</>;
}
