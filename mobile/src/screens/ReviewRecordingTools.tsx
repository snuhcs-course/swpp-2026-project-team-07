// Shared recording tools rendered in the normal Review flow, without a modal surface.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '../design/frame';
import { F } from '../design/tokens';
import { useTheme } from '../design/theme';
import type { DeckModel } from '../features/presentations/useDeckModel';
import { useStore } from '../features/presentations/store';
import { getSavedAttempt } from '../features/recording/storage';
import { readReview } from '../features/transcription/reviewStorage';
import type { useReviewAudio } from '../features/transcription/useReviewMedia';
import { activeWordIndex } from '../features/transcription/playback';
import { stageOf, useWorkers } from '../features/rehearsal/analysis';
import type { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { readFeedback } from '../features/feedback/storage';
import { retainCoaching, useCoaches } from '../features/rehearsal/coaching';
import { API_URL } from '../services/api';
import { PdfTools, RecordingWideSuggestions, sourceTimestamp, TranscriptWords } from './TakePlayback';

export type ReviewEvidence = { start_ms: number; end_ms: number; speech_quote?: string; observation?: string; slide_quote?: string };
type Props = {
  model: DeckModel; id: string; slide: number; player: ReturnType<typeof useSegmentPlayer>;
  media: ReturnType<typeof useReviewAudio>; evidence?: ReviewEvidence | null; onCloseEvidence: () => void;
};

export function ReviewRecordingTools({ model, id, slide, player, media, evidence, onCloseEvidence }: Props) {
  const { c } = useTheme();
  const version = useStore(state => state.version);
  const saved = useMemo(() => { void version; try { return getSavedAttempt(id); } catch { return null; } }, [id, version]);
  const review = useMemo(() => { void version; try { return readReview(API_URL, id); } catch { return null; } }, [id, version]);
  const feedback = useMemo(() => { void version; try { return readFeedback(API_URL, id); } catch { return null; } }, [id, version]);
  const [toolsOpen, setToolsOpen] = useState(false), [wordsOpen, setWordsOpen] = useState(false), [pdfOpen, setPdfOpen] = useState(false);
  const coaches = useCoaches(), coach = coaches.get(id);
  const workers = useWorkers(), worker = workers.get(id);
  useEffect(() => toolsOpen ? retainCoaching(id) : undefined, [id, toolsOpen]);
  const transcript = model.transcripts.get(id) ?? review?.transcript;
  const duration = saved?.recording.duration_ms || review?.duration_ms || 0;
  const part = model.state.run?.parts[slide];
  const segments = part?.attemptId === id ? part.segments : [];
  const visits = segments.map(segment => ({ slide_index: slide, start_ms: segment.startMs, end_ms: segment.endMs, words: [] }));
  const uri = media.audio.uri;
  const ready = !!uri && duration > 0;
  const activeWord = transcript && player.uri === uri && player.positionMs !== null ? activeWordIndex(transcript.words, player.positionMs, duration) : -1;
  const evidenceKey = evidence ? `evidence:${id}:${evidence.start_ms}:${evidence.end_ms}` : null;
  const evidenceSelected = !!evidenceKey && player.playingKey === evidenceKey;
  const evidencePlaying = evidenceSelected && !player.paused;
  const validEvidence = !!evidence && Number.isSafeInteger(evidence.start_ms) && Number.isSafeInteger(evidence.end_ms)
    && evidence.start_ms >= 0 && evidence.end_ms > evidence.start_ms && evidence.end_ms <= duration;
  const playEvidence = () => {
    if (!ready || !uri || !validEvidence || !evidence || !evidenceKey) return;
    void player.playSegments(evidenceKey, [{ uri, startMs: evidence.start_ms, endMs: evidence.end_ms }]);
  };
  const playWord = (ms: number) => {
    if (!ready || !uri) return;
    const index = segments.findIndex(segment => ms >= segment.startMs && ms < segment.endMs);
    if (index < 0) return;
    void player.playSegments(`word:${id}:${slide}:${ms}`, segments.slice(index).map((segment, i) => ({
      uri, startMs: i === 0 ? ms : segment.startMs, endMs: segment.endMs,
    })));
  };
  const stage = worker?.stage ?? (transcript ? 'done' : stageOf(id));
  const action = stage === 'upload_failed' || stage === 'local' ? { label: 'Upload recording', press: worker?.retryUpload }
    : stage === 'failed' ? { label: 'Retry transcription', press: worker?.retry }
      : stage === 'awaiting' && !worker?.prompt ? { label: 'Transcribe recording', press: worker?.analyze } : null;
  const rawWords = transcript && <TranscriptWords transcript={transcript} slide={slide} visits={visits} activeWord={activeWord}
    duration={duration} canSeek={ready} onSeek={playWord} />;
  return <View style={styles.root}>
    {evidence && <View style={[styles.card, { backgroundColor: c.surface06, borderColor: c.hair }]}>
      <Txt style={[styles.heading, { color: c.text }]}>Feedback evidence</Txt>
      {!!evidence.observation && <Txt style={[styles.body, { color: c.text }]}>{evidence.observation}</Txt>}
      {!!evidence.speech_quote && <Txt style={[styles.note, { color: c.secondary }]}>{'Speech: “' + evidence.speech_quote + '”'}</Txt>}
      {!!evidence.slide_quote && <Txt style={[styles.note, { color: c.secondary }]}>{'Slide: ' + evidence.slide_quote}</Txt>}
      <Txt style={[styles.note, { color: c.secondary }]}>{'Source recording · ' + sourceTimestamp(evidence.start_ms) + '–' + sourceTimestamp(evidence.end_ms)}</Txt>
      <Action label={evidencePlaying ? 'Pause evidence' : evidenceSelected ? 'Resume evidence' : 'Play evidence'} disabled={!ready || !validEvidence} onPress={playEvidence} />
      {!validEvidence && <Txt style={[styles.note, { color: c.secondary }]}>Evidence interval is unavailable for this recording. The original audio is retained.</Txt>}
      <Action label="Close evidence" onPress={() => { if (evidenceSelected) player.stop(); onCloseEvidence(); }} />
    </View>}
    {!uri && media.audioSpec && <Action label="Download audio for offline playback" text={media.audio.busy ? 'Checking audio…' : 'Download audio'} disabled={media.audio.busy} onPress={() => void media.download()} />}
    {!!media.audio.error && <Txt accessibilityRole="alert" style={[styles.note, { color: c.secondary }]}>{media.audio.error}</Txt>}
    {!!player.error && <Txt accessibilityRole="alert" style={[styles.note, { color: c.secondary }]}>{player.error}</Txt>}
    <Action label={toolsOpen ? 'Hide recording tools' : 'Show recording tools'} text={toolsOpen ? 'Hide recording tools' : 'Recording tools'} onPress={() => setToolsOpen(open => !open)} />
    {toolsOpen && <View style={styles.root}>
      <Txt style={[styles.note, { color: c.secondary }]}>{worker?.detail || (stage === 'done' ? 'Saved transcript' : stage === 'no_speech' ? 'No speech detected; no audio was sent for transcription.' :
        stage === 'processing' ? 'Transcribing…' : stage === 'uploading' ? 'Uploading recording…' : stage === 'awaiting' ? 'Waiting to start transcription' : stage === 'failed' ? 'Transcription stopped' : 'Your recording is saved on this phone.')}</Txt>
      {!!action && <Action label={action.label} disabled={!action.press || !!worker?.busy || (stage === 'failed' && !worker?.retryAvailable)} onPress={() => action.press?.()} />}
      {stage === 'failed' && worker?.retryAt && <Txt style={[styles.note, { color: c.secondary }]}>{'Retry available after ' + new Date(worker.retryAt).toLocaleString()}</Txt>}
      {worker && stage !== 'local' && <Action label="Refresh transcription status" text={worker.busy ? 'Checking…' : 'Refresh status'} disabled={worker.busy} onPress={() => worker.refresh?.()} />}
      {worker?.prompt && <Txt style={[styles.note, { color: c.secondary }]}>Complete the permission or retry dialog to continue.</Txt>}
      {!!transcript && <>
        <Action label={wordsOpen ? 'Hide original transcript and word playback' : 'Show original transcript and word playback'}
          text={wordsOpen ? 'Hide original transcript' : 'Original transcript · word playback'} onPress={() => setWordsOpen(open => !open)} />
        {wordsOpen && rawWords}
      </>}
      <RecordingWideSuggestions id={id} review={review} coach={coach} feedback={feedback} />
      <Action label="Show PDF offline tools" text={pdfOpen ? 'Hide PDF tools' : 'PDF offline tools'} onPress={() => setPdfOpen(open => !open)} />
      {pdfOpen && <PdfTools id={id} saved={saved} review={review} />}
    </View>}
  </View>;
}
function Action({ label, text = label, disabled, onPress }: { label: string; text?: string; disabled?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.action, { backgroundColor: c.surface10, opacity: disabled ? 0.4 : 1 }]}><Txt style={[styles.actionText, { color: c.text }]}>{text}</Txt></Pressable>;
}
const styles = StyleSheet.create({
  root: { gap: 12 }, card: { gap: 10, padding: 14, borderWidth: 1, borderRadius: 18 },
  heading: { fontFamily: F.semibold, fontSize: 14 }, body: { fontFamily: F.medium, fontSize: 14, lineHeight: 21 },
  note: { fontFamily: F.medium, fontSize: 12, lineHeight: 18 }, action: { minHeight: 44, padding: 12, borderRadius: 14, justifyContent: 'center' },
  actionText: { fontFamily: F.semibold, fontSize: 13 },
});
