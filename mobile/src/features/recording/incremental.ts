// Durable segment upload outbox. Recording writes files/checkpoints; network work never owns the microphone.
import { File } from 'expo-file-system';
import type { CaptureManifest } from '../../../modules/outloud-recorder';
import { backendExpoFetch } from '../../services/backendFetch';
import { getSavedAttempt, saveAttempt } from './storage';
import { recoverCapture } from './captureRecovery';
import { serverSlides } from '../presentations/serverDeck';
import { synchronizePresentationDefaults, defaultRequirementsPending } from '../presentations/defaultRequirements';
import { requirementsPending } from '../presentations/requirementsDraft';
import { readRequirements } from '../presentations/requirementsStore';
import { normalizeApi, saveAnalysis } from '../transcription/analysisStorage';
import { saveReview } from '../transcription/reviewStorage';
import { transcriptionClientFor } from '../transcription/service';
import { receiveFeedbackRun } from '../feedback/feedbackRunClient';
import { bump } from '../presentations/store';
import { readCapture, updateCapture as update, type CaptureStatus } from './incrementalState';

export * from './incrementalState';

export async function incrementalAvailable(api: string): Promise<boolean> {
  try {
    const response = await backendExpoFetch(`${normalizeApi(api)}/incremental/capabilities/`, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.json())?.enabled === true;
  } catch { return false; }
}
export function parseCaptureStatus(value: unknown, id: string): CaptureStatus {
  const v = value as CaptureStatus | null;
  if (!v || v.attempt_id !== id || !Number.isSafeInteger(v.revision) || typeof v.finalized !== 'boolean' ||
      typeof v.stopped !== 'boolean' || typeof v.audio_uploaded !== 'boolean' || !Array.isArray(v.segments) ||
      v.segments.some(s => !Number.isSafeInteger(s.sequence) || s.sequence < 0 ||
        !['awaiting_upload', 'queued', 'transcribing', 'completed', 'failed', 'uncertain'].includes(s.status) ||
        typeof s.retry_available !== 'boolean' || typeof s.requires_confirmation !== 'boolean'))
    throw new Error('Invalid segment status. Saved audio is retained.');
  return v;
}
async function responseJson(response: Response) {
  let body;
  try { body = await response.json(); } catch { throw new Error('Server response could not be read. Audio is retained for retry.'); }
  if (!response.ok) throw new Error(body?.error?.message || `Upload failed (HTTP ${response.status}). Audio is kept on this phone.`);
  return body;
}
export function manifestIdentity(manifest: CaptureManifest) {
  // Audio clock changes every frame; only sealed segments, transitions and Stop require a new declaration.
  return JSON.stringify([manifest.segments.length, manifest.slide_events, manifest.stopped, manifest.stopped ? manifest.duration_ms : 0]);
}
const inFlight = new Map<string, Promise<void>>();
function failureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Processing interrupted. Audio is saved on this phone.';
  return /fetch failed|network request failed|failed to fetch|NetworkError|timed out|timeout|aborted/i.test(message)
    ? 'Connection interrupted. Audio is saved on this phone and uploads retry when the server is reachable.' : message;
}
export function syncCapture(id: string, transport = backendExpoFetch): Promise<void> {
  const active = inFlight.get(id);
  if (active) return active;
  const task = synchronize(id, transport).catch(error => {
    update(id, { error: failureMessage(error), retryAt: Date.now() + 5000 });
    // A failed later upload must not hide feedback from segments already received.
    void refreshCapture(id, transport);
  }).finally(() => inFlight.delete(id));
  inFlight.set(id, task); return task;
}
async function synchronize(id: string, transport: typeof backendExpoFetch) {
  let item = readCapture(id);
  if (!item || item.complete || (item.retryAt ?? 0) > Date.now()) return;
  const attempt = getSavedAttempt(id);
  if (!attempt) return;
  if (!item.deckId) {
    const deck = await serverSlides({ id: attempt.local_deck_id, title: attempt.title, uri: attempt.pdf_uri, pageCount: attempt.page_count }, item.api);
    await synchronizePresentationDefaults(attempt.local_deck_id, deck.deckId, item.api);
    if (requirementsPending(attempt.local_deck_id, item.api) || defaultRequirementsPending(attempt.local_deck_id, item.api))
      throw new Error('Settings sync pending. Audio segments are saved and will upload after settings synchronize.');
    const r = readRequirements(attempt.local_deck_id, item.api);
    update(id, { deckId: deck.deckId, contextId: r.deckId === deck.deckId ? r.contextId ?? null : null });
  }
  // Read the latest checkpoint after each awaited operation: a slide transition may have occurred meanwhile.
  for (;;) {
    item = readCapture(id)!;
    const signature = manifestIdentity(item.manifest);
    if (item.declared !== signature) {
      const m = item.manifest;
      const body = { deck_id: item.deckId, context_id: item.contextId ?? null, audience: attempt.recording.audience,
        duration_ms: m.duration_ms, slide_events: m.slide_events, stopped: m.stopped,
        segments: m.segments.map(({ sequence, slide_index, start_ms, end_ms }) => ({ sequence, slide_index, start_ms, end_ms })) };
      const response = await transport(`${item.api}/attempts/${id}/capture/`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      await responseJson(response);
      update(id, { declared: signature, error: undefined, retryAt: undefined });
      continue;
    }
    const segment = item.manifest.segments.find(s => !item!.uploaded.includes(s.sequence));
    if (segment) {
      const file = new File(segment.uri);
      if (!file.exists || !file.size) throw new Error(`Saved segment ${segment.sequence + 1} is unavailable. The full recording is retained.`);
      const body = new FormData(); body.append('file', file, `segment-${segment.sequence}.wav`);
      await responseJson(await transport(`${item.api}/attempts/${id}/segments/${segment.sequence}/`, { method: 'POST', body, signal: AbortSignal.timeout(60000) }));
      update(id, { uploaded: [...new Set([...readCapture(id)!.uploaded, segment.sequence])], error: undefined, retryAt: undefined });
      continue;
    }
    if (item.manifest.stopped && !item.audioUploaded) {
      const file = new File(item.manifest.full_uri);
      if (!file.exists || !file.size) throw new Error('Full recording is unavailable. The segment files are retained.');
      const body = new FormData(); body.append('file', file, 'presentation.wav');
      await responseJson(await transport(`${item.api}/attempts/${id}/capture/audio/`, { method: 'POST', body, signal: AbortSignal.timeout(180000) }));
      update(id, { audioUploaded: true, error: undefined, retryAt: undefined });
      continue;
    }
    break;
  }
  await refreshCapture(id, transport);
}

const polling = new Map<string, Promise<void>>();
/** Poll separately so uploading a large file or retrying an offline upload cannot hide ready feedback. */
export function refreshCapture(id: string, transport = backendExpoFetch): Promise<void> {
  const current = polling.get(id);
  if (current) return current;
  const task = refresh(id, transport).catch(error => {
    update(id, { refreshError: failureMessage(error) });
  }).finally(() => polling.delete(id));
  polling.set(id, task); return task;
}
async function refresh(id: string, transport: typeof backendExpoFetch) {
  let item = readCapture(id);
  if (!item?.declared || item.complete) return;
  const remote = parseCaptureStatus(await responseJson(await transport(`${item.api}/attempts/${id}/capture/`, { signal: AbortSignal.timeout(15000) })), id);
  const previous = readCapture(id)!;
  if (previous.remote && remote.revision < previous.remote.revision) return;
  receiveFeedbackRun(item.api, id, item.contextId ?? null, remote.feedback);
  if (remote.error?.code === 'audio_mismatch') {
    // This is corrupt/mismatched content, not a transient upload failure. Keep files and require Retry.
    update(id, { remote, audioUploaded: false, error: remote.error.message || 'Full audio did not match the saved segments. Retry the original audio.', retryAt: Number.MAX_SAFE_INTEGER });
  } else update(id, { remote });
  update(id, { refreshError: undefined });
  if (remote.finalized) {
    item = readCapture(id)!;
    const review = await transcriptionClientFor(item.api).getReview(id);
    saveReview(item.api, review);
    if (review.processing_result) saveAnalysis(item.api, review.processing_result);
    const latest = getSavedAttempt(id);
    if (latest) saveAttempt({ ...latest, state: latest.state === 'interrupted' ? 'interrupted' : 'submitted', server_url: item.api,
      recording: { ...latest.recording, deck_id: item.deckId, audio_uri: item.manifest.full_uri,
        duration_ms: item.manifest.duration_ms, slide_events: item.manifest.slide_events.filter(e => e.at_ms < item!.manifest.duration_ms) }, auto_process_api: undefined });
    // Keep polling until the whole feedback has settled; capture finalization precedes its model call.
    const feedback = remote.feedback as { status?: string } | undefined;
    update(id, { complete: feedback?.status === 'completed' || feedback?.status === 'failed' });
  }
  bump();
}
export async function retryCapture(id: string, acknowledgeUncertain = false) {
  recoverCapture(id);
  const item = readCapture(id);
  if (!item) return;
  for (const segment of item.remote?.segments ?? []) {
    if (!segment.retry_available || (segment.requires_confirmation && !acknowledgeUncertain)) continue;
    await responseJson(await backendExpoFetch(`${item.api}/attempts/${id}/segments/${segment.sequence}/retry/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledge_uncertain: acknowledgeUncertain }),
      signal: AbortSignal.timeout(20000),
    }));
  }
  update(id, { retryAt: 0, complete: false });
  await syncCapture(id);
}
