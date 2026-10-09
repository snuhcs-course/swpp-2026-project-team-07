import type { Transcript } from '../../contracts';
import { activeLayout } from '../../layouts/registry';
import { transcriptPresentation } from './transcriptPresentation';
export function PlaybackTranscript({ transcript, positionMs, durationMs, ready, onSeek }: { transcript: Transcript; positionMs: number; durationMs: number; ready: boolean; onSeek: (ms: number) => void }) {
  return <activeLayout.Transcript spans={transcriptPresentation(transcript, positionMs, durationMs, ready, onSeek)} />;
}
