import type { CaptureManifest } from '../../../modules/outloud-recorder';
import type { FeedbackRun } from '../feedback/feedbackRun';
import { listStored, readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';

export type SegmentStatus = { sequence: number; status: string; error: unknown; retry_available: boolean; requires_confirmation: boolean };
export type CaptureStatus = { attempt_id: string; revision: number; stopped: boolean; finalized: boolean; audio_uploaded: boolean;
  segments: SegmentStatus[]; error?: { code?: string; message?: string } | null; feedback?: unknown };
export type CaptureOutbox = { id: string; api: string; manifest: CaptureManifest; deckId?: string; contextId?: string | null;
  declared?: string; uploaded: number[]; audioUploaded: boolean; remote?: CaptureStatus; error?: string; refreshError?: string; retryAt?: number; complete?: boolean };
const key = (id: string) => `capture-outbox:v1:${id}`;
let version = 0;
const listeners = new Set<() => void>();
export const captureVersion = () => version;
export function subscribeCaptures(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function readCapture(id: string): CaptureOutbox | null { return readStored(key(id)); }
export function captures(): CaptureOutbox[] { return listStored('capture-outbox:v1:'); }
export function isIncrementalAttempt(api: string, id: string) { return readCapture(id)?.api === normalizeApi(api); }
export function updateCapture(id: string, patch: Partial<CaptureOutbox>) {
  const old = readCapture(id);
  if (!old) throw new Error('Recording upload metadata is missing.');
  writeStored(key(id), { ...old, ...patch }); version++; listeners.forEach(fn => fn());
}
export function registerCapture(id: string, api: string, manifest: CaptureManifest) {
  if (readCapture(id)) throw new Error('Recording already has a segment manifest.');
  writeStored(key(id), { id, api: normalizeApi(api), manifest, uploaded: [], audioUploaded: false });
  version++; listeners.forEach(fn => fn());
}
export function checkpointCapture(id: string, manifest: CaptureManifest) {
  const old = readCapture(id);
  if (!old || manifest.duration_ms < old.manifest.duration_ms || manifest.segments.length < old.manifest.segments.length) return;
  updateCapture(id, { manifest });
}

/** Local visits invalidate old scores immediately, including while the next manifest cannot upload. */
export function captureFeedback(item: CaptureOutbox | null, run: FeedbackRun | null): FeedbackRun | null {
  if (!item || !run || item.remote?.finalized) return run;
  const pending = new Set(item.manifest.segments.filter(segment =>
    !item.remote?.segments.some(remote => remote.sequence === segment.sequence && remote.status === 'completed'))
    .map(segment => segment.slide_index));
  const active = item.manifest.stopped ? null : item.manifest.current_slide;
  if (active !== null) pending.add(active);
  if (!pending.size) return run;
  return { ...run, status: 'running', slides: run.slides.map(slide => pending.has(slide.slide_index)
    ? { ...slide, status: 'pending', score: null, level: null, provisional: true,
      reason: slide.slide_index === active ? 'recording' : 'awaiting_segments' } : slide) };
}
