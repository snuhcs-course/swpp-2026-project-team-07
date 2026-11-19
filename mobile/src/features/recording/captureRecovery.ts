import { continuousRecorder } from '../../../modules/outloud-recorder';
import { checkpointCapture, readCapture, updateCapture } from './incrementalState';
import { checkpointAttempt, getSavedAttempt, interruptAttempt, saveAttempt } from './storage';

/** Repair retained native files and reconcile a Stop interrupted between local writes. */
export function recoverCapture(id: string): void {
  const item = readCapture(id);
  if (!item) return;
  try {
    const attempt = getSavedAttempt(id);
    if (!attempt) throw new Error('The saved recording metadata is unavailable.');
    let manifest = item.manifest;
    const needsNativeRecovery = !manifest.stopped || !!manifest.error;
    if (needsNativeRecovery) {
      if (!continuousRecorder.available()) throw new Error('Open this recording in the updated Android app to repair its audio.');
      // A host remount or an upload retry must never finalize the live microphone.
      let recording = null;
      try { recording = continuousRecorder.status(); } catch { /* A process restart has no live native session. */ }
      if (recording?.isRecording && recording.manifest_uri === manifest.manifest_uri) return;
      manifest = continuousRecorder.recover(manifest.manifest_uri);
      checkpointCapture(id, manifest);
    }
    if (manifest.duration_ms < 1) throw new Error('No audio samples were captured. The empty take is retained.');
    const events = manifest.slide_events.filter(event => event.at_ms < manifest.duration_ms);
    if (attempt.recording.audio_uri !== manifest.full_uri || attempt.recording.duration_ms !== manifest.duration_ms ||
        JSON.stringify(attempt.recording.slide_events) !== JSON.stringify(events) || attempt.state === 'capturing') {
      checkpointAttempt(id, manifest.full_uri, manifest.duration_ms, events, true);
      if (attempt.state === 'submitted') saveAttempt({ ...getSavedAttempt(id)!, state: 'submitted' });
    }
    if (needsNativeRecovery || attempt.state === 'capturing' || attempt.state === 'interrupted')
      interruptAttempt(id, 'Interrupted recording recovered. Review the saved audio before keeping it.');
    if (needsNativeRecovery || item.error?.startsWith('Recording recovery failed:'))
      updateCapture(id, { error: undefined, retryAt: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The saved recording could not be repaired.';
    updateCapture(id, { error: `Recording recovery failed: ${message} Saved files are retained. Retry recovery when available.`, retryAt: Number.MAX_SAFE_INTEGER });
    throw error;
  }
}
