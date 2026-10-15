// AI-generated/modified with OpenAI Codex, Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#playback-transcription-and-home-visual-corrections-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// A saved take's validated media, synchronized slide visits and transcript in the redesign UI.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Txt } from '../design/frame';
import { C, F } from '../design/tokens';
import { fmt } from '../domain/format';
import type { DescriptionFact, ReviewAttempt, Transcript, Visit } from '../contracts';
import type { Presentation } from '../features/presentations/store';
import { bump, useStore } from '../features/presentations/store';
import { getSavedAttempt, saveAttempt, type SavedAttempt } from '../features/recording/storage';
import { recoverRecording } from '../features/recording/recovery';
import { API_URL } from '../services/api';
import { readReview } from '../features/transcription/reviewStorage';
import { useReviewDeck } from '../features/transcription/useReviewDeck';
import { useReviewAudio, useReviewPdfMedia } from '../features/transcription/useReviewMedia';
import { useReviewPdf } from '../features/transcription/useReviewPdf';
import { useReviewPlayerStatus } from '../features/transcription/useReviewPlayerStatus';
import { activeVisitIndex, activeWordIndex, createPlaybackController, recordedVisits, seekableWord, transcriptSpans } from '../features/transcription/playback';
import { validEvents, validVisits } from '../features/transcription/reviewValidation';
import { localUri } from '../features/transcription/reviewMedia';
import { stageOf, subscribePlaybackId, useWorkers } from '../features/rehearsal/analysis';
import { inspectCoaching, requestCoaching, retainCoaching, useCoaches, type CoachState } from '../features/rehearsal/coaching';
import { readFeedback } from '../features/feedback/storage';

export function TakePlayback({ id, deck, initialSlide, onClose, onSlideChange, onRecovered, initialEvidence }: {
  initialEvidence?: {start_ms:number;end_ms:number};
  id: string; deck: Presentation; initialSlide: number; onClose: () => void;
  onSlideChange?: (slide: number) => void; onRecovered?: (attempt: SavedAttempt) => void;
}) {
  useEffect(() => subscribePlaybackId(id), [id]);
  const version = useStore(s => s.version);
  const saved = useMemo(() => { void version; try { return getSavedAttempt(id); } catch { return null; } }, [id, version]);
  const review = useMemo(() => { void version; try { return readReview(API_URL, id); } catch { return null; } }, [id, version]);
  useEffect(() => {
    const release = retainCoaching(id);
    return release;
  }, [id]);
  const workers = useWorkers();
  const worker = workers.get(id);
  const coaches = useCoaches();
  const coach = coaches.get(id);
  const feedback = useMemo(() => { void version; try { return readFeedback(API_URL, id); } catch { return null; } }, [id, version]);
  const media = useReviewAudio(API_URL, id, saved, review);
  const player = useAudioPlayer(media.audio.uri, { updateInterval: 100 });
  const { status, hasLoaded } = useReviewPlayerStatus(player);
  const [playing, setPlaying] = useState(false);
  const lastWordMs = useRef<number | null>(null);
  const recoveryBusy = useRef(false);
  const [notice, setNotice] = useState('');
  const [pdfTools, setPdfTools] = useState(false);
  const [descriptionsOpen, setDescriptionsOpen] = useState(false);
  const control = useMemo(() => createPlaybackController(player, setPlaying,
    () => setNotice('Could not seek this recording. Its file is still saved.')), [player]);
  const audioUri = media.audio.uri;
  const audioFailed = media.audioFailed;

  useEffect(() => {
    control.activate();
    const sub = AppState.addEventListener('change', app => { if (app === 'active') control.activate(); else control.deactivate(); });
    return () => { sub.remove(); control.dispose(); };
  }, [control]);
  useEffect(() => {
    const current = player.currentStatus;
    if (status.didJustFinish) control.finished(current.currentTime * 1000, current.duration * 1000);
    else if (!status.playing && status.isLoaded && !status.isBuffering && !status.error &&
      !current.playing && current.isLoaded && !current.isBuffering && !current.didJustFinish && !current.error) control.nativePaused();
  }, [control, player, status]);
  useEffect(() => { if (status.error && audioUri) { control.pause(); audioFailed(); } }, [control, audioUri, audioFailed, status.error]);

  const interrupted = saved?.state === 'capturing' || saved?.state === 'interrupted';
  const duration = saved?.recording.duration_ms || review?.duration_ms || (hasLoaded ? Math.round(status.duration * 1000) : 0);
  const position = Number.isFinite(status.currentTime) ? Math.max(0, Math.round(status.currentTime * 1000)) : 0;
  const ready = !!media.audio.uri && status.isLoaded && !status.error && duration > 0;
  const canSeek = !!media.audio.uri && hasLoaded && (status.isLoaded || status.isBuffering) && !status.error && duration > 0;
  const events = useMemo(() => saved && validEvents(saved.recording.slide_events, duration, deck.pageCount)
    ? saved.recording.slide_events : review?.slide_events || [], [saved, review, duration, deck.pageCount]);
  const visits = useMemo(() => {
    const aligned = validVisits(review?.visits, duration, deck.pageCount, events.length ? events : undefined) ? review!.visits : null;
    return aligned || recordedVisits(events, duration);
  }, [review, duration, deck.pageCount, events]);
  const visit = activeVisitIndex(visits, position);
  const slide = position === 0 && !playing ? initialSlide : visit >= 0 ? visits[visit].slide_index : initialSlide;
  useEffect(() => { onSlideChange?.(slide); }, [onSlideChange, slide]);
  const transcript = review?.transcript;
  const activeWord = transcript ? activeWordIndex(transcript.words, position, duration) : -1;
  const stage = worker?.stage ?? (review?.transcript ? 'done' : stageOf(id));
  const canRecover = interrupted && ready && media.audio.uri === localUri(saved?.recording.audio_uri);

  const playWord = async (ms: number) => {
    if (!ready) return;
    if (control.isPlaying() && lastWordMs.current === ms) { control.pause(); return; }
    lastWordMs.current = ms;
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    control.seek(ms, duration);
    control.play(ms, duration);
  };
  const recover = () => {
    if (recoveryBusy.current || !saved || !canRecover || !media.audio.uri) return;
    recoveryBusy.current = true;
    try {
      const recovered: SavedAttempt = { ...saved, recording: recoverRecording({ ...saved.recording, audio_uri: media.audio.uri }, status.duration * 1000),
        state: 'saved', error: undefined, auto_process_api: API_URL.replace(/\/+$/, '') };
      saveAttempt(recovered);
      try { onRecovered?.(recovered); }
      catch (error) { saveAttempt(saved); throw error; }
      setNotice('Recovered locally. You can upload this take.'); bump();
    } catch {
      recoveryBusy.current = false;
      setNotice('Could not recover the recording. The original file is retained.');
    }
  };
  const action = stage === 'upload_failed' || stage === 'local' ? { label: 'Upload recording', press: worker?.retryUpload }
    : stage === 'failed' ? { label: 'Retry transcription', press: worker?.retry }
      : stage === 'awaiting' && !worker?.prompt ? { label: 'Transcribe recording', press: worker?.analyze } : null;
  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Close recording details" onPress={onClose} style={styles.scrim} />
      <View style={styles.sheet}>
      {media.validators}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close recording details" onPress={onClose} style={styles.close}><Txt style={styles.closeText}>×</Txt></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}><Txt style={styles.eyebrow}>RECORDING DETAILS</Txt><Txt numberOfLines={1} style={styles.title}>{deck.title}</Txt></View>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Txt style={styles.slideLabel}>{'Slide ' + (slide + 1) + ' of ' + deck.pageCount}</Txt>
        <View style={styles.card}>
          <Txt style={styles.section}>Recording</Txt>
          <Txt style={styles.time}>{fmt(position / 1000)} <Txt style={styles.sub}>/ {duration ? fmt(duration / 1000) : '—'}</Txt></Txt>
          <View style={styles.progress}><View style={[styles.progressFill, { width: duration ? `${Math.min(100, 100 * position / duration)}%` : '0%' }]} /></View>
          {initialEvidence && <Control label="Play feedback evidence" text={playing ? 'Pause evidence' : 'Play feedback evidence'} disabled={!ready}
            onPress={() => { if (playing) control.pause(); else void playWord(initialEvidence.start_ms); }} />}
          {!media.audio.uri && media.audioSpec && <Control label="Download audio for offline playback" text={media.audio.busy ? 'Checking audio…' : 'Download audio'} disabled={media.audio.busy} onPress={() => void media.download()} />}
          {!!media.audio.error && <Txt style={styles.notice}>{media.audio.error}</Txt>}
          {!!status.error && <Txt style={styles.notice}>Audio could not be opened. The original file is retained.</Txt>}
          {canRecover && <Control label="Recover playable recording" text="Recover recording" onPress={recover} />}
        </View>
        <View style={styles.card}>
          <Txt style={styles.section}>{'Slide ' + (slide + 1) + ' transcription'}</Txt>
          <Txt style={styles.sub}>{worker?.detail || (stage === 'done' ? 'Saved transcript' : stage === 'no_speech' ? 'No speech detected; no audio was sent for transcription.' :
            stage === 'processing' ? 'Transcribing…' : stage === 'uploading' ? 'Uploading recording…' :
              stage === 'awaiting' ? 'Waiting to start transcription' : stage === 'failed' ? 'Transcription stopped' : 'Your recording is saved on this phone.')}</Txt>
          {!!action && <Control label={action.label} text={action.label} disabled={!action.press || !!worker?.busy || (stage === 'failed' && !worker?.retryAvailable)} onPress={() => action.press?.()} />}
          {stage === 'failed' && worker?.retryAt && <Txt style={styles.sub}>{'Retry available after ' + new Date(worker.retryAt).toLocaleString()}</Txt>}
          {worker && stage !== 'local' && <Control label="Refresh transcription status" text={worker.busy ? 'Checking…' : 'Refresh status'} disabled={worker.busy} onPress={() => worker.refresh?.()} />}
          {worker?.prompt && <Txt style={styles.sub}>Complete the permission or retry dialog to continue.</Txt>}
          {!!transcript && <TranscriptWords transcript={transcript} slide={slide} visits={visits} activeWord={activeWord} duration={duration} canSeek={canSeek} onSeek={ms => { void playWord(ms); }} />}
        </View>
        {!!transcript && <View style={styles.card}>
          <Txt style={styles.section}>AI suggestions</Txt>
          <Txt style={styles.sub}>Suggestions compare your delivery with the slide content and saved transcript. Check the evidence before using them.</Txt>
          {review?.deck_id ? <>
            <Txt style={styles.sub}>{coach?.label ?? (feedback?.result ? 'Suggestions saved on this phone' : 'Tap to load feedback options')}</Txt>
            {!!feedback?.stale && <Txt style={styles.notice}>Feedback is outdated. Synchronize corrections, then request an update.</Txt>}
            <Control label={coach ? 'Refresh AI suggestion status' : 'Load AI suggestion status'}
              text={coach ? 'Refresh suggestion status' : 'Load suggestion status'} disabled={!!coach?.busy}
              onPress={() => { if (coach) void coach.details.refresh(); else inspectCoaching(id); }} />
            {!feedback?.result && <Control label="Generate AI suggestions for this take"
              text={coach?.busy ? 'Preparing suggestions…' : 'Generate suggestions'}
              disabled={!!coach?.busy || !!coach?.prompt || !!coach?.details.draft ||
                (!!coach?.details.feedback && (coach.details.feedback.availability.state !== 'available' ||
                  (coach.details.feedback.feedback_revision > 0 && !coach.details.feedback.retry_available)))}
              onPress={() => requestCoaching(id)} />}
            {!!coach?.details.feedback?.retry_available && <Control label={coach.details.feedback.stale ? 'Update feedback' : 'Regenerate AI suggestions'}
              text={coach.details.feedback.stale ? 'Update feedback' : coach.details.feedback.feedback_revision ? 'Regenerate suggestions' : 'Retry suggestions'}
              disabled={coach.busy || !!coach.prompt || !!coach.details.draft || coach.details.feedback.availability.state !== 'available'}
              onPress={() => requestCoaching(id)} />}
            {coach?.details.feedback?.dependency?.retry_action === 'generate_descriptions' && <Control label="Retry slide descriptions"
              text="Retry slide descriptions" disabled={coach.busy || !!coach.prompt || !!coach.details.draft || !coach.details.feedback.dependency.retry_available}
              onPress={() => coach.details.retryDescriptions()} />}
            <Control label={descriptionsOpen ? 'Hide slide descriptions' : 'Show slide descriptions'}
              text={descriptionsOpen ? 'Hide slide descriptions' : 'Slide descriptions'}
              onPress={() => { if (!descriptionsOpen) inspectCoaching(id); setDescriptionsOpen(x => !x); }} />
            {descriptionsOpen && <SlideDescriptions coach={coach} />}
          </> : <Txt style={styles.sub}>Upload and transcribe this take before requesting suggestions.</Txt>}
          {!!coach?.notice && <Txt style={styles.notice}>{coach.notice}</Txt>}
          {!!feedback?.result && <>
            {feedback.result.stale && <Txt style={styles.notice}>These suggestions are out of date.</Txt>}
            {feedback.result.suggestions.slice(0, 3).map((item, index) => <View key={index} style={styles.suggestion}>
              <Txt style={styles.eyebrow}>{item.category + ' · slide ' + (item.slide_index + 1)}</Txt>
              <Txt style={styles.transcript}>{item.observation}</Txt>
              <Txt style={styles.sub}>{item.suggestion}</Txt>
              <Txt style={styles.sub}>{'Slide description (' + (feedback.result?.description_origin === 'edited' ? 'edited' :
                feedback.result?.description_origin === 'generated' ? 'AI generated' : 'origin unavailable') + '; may differ from PDF text): ' + item.slide_quote}</Txt>
              <Txt style={styles.sub}>{'Speech evidence: ' + item.speech_quote}</Txt>
            </View>)}
          </>}
        </View>}
        <Control label="Show PDF offline tools" text={pdfTools ? 'Hide PDF tools' : 'PDF offline tools'} onPress={() => setPdfTools(x => !x)} />
        {pdfTools && <PdfTools id={id} saved={saved} review={review} />}
        {!!notice && <Txt accessibilityRole="alert" style={styles.notice}>{notice}</Txt>}
      </ScrollView>
      </View>
    </View>
  );
}

function SlideDescriptions({ coach }: { coach: CoachState | undefined }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const details = coach?.details;
  const saved = details?.descriptions;
  const draft = details?.draft;
  const draftSlide = draft?.descriptions.slides.find(s => s.slide_index === draft.slide);
  const changeFact = (kind: 'summary' | 'key_ideas' | 'visual_facts', index: number, next: DescriptionFact) => {
    if (!details || !draft) return;
    details.change({ slides: draft.descriptions.slides.map(slide => slide.slide_index !== draft.slide ? slide :
      { ...slide, [kind]: kind === 'summary' ? next : slide[kind].map((fact, i) => i === index ? next : fact) }) });
  };
  const editor = (label: string, fact: DescriptionFact, kind: 'summary' | 'key_ideas' | 'visual_facts', index = 0) =>
    <View key={`${kind}:${index}`} style={styles.fact}>
      <Txt style={styles.sub}>{label} · 400 characters maximum</Txt>
      <TextInput accessibilityLabel={`${label} text`} style={styles.input} multiline editable={!details?.busy} value={fact.text}
        onChangeText={text => changeFact(kind, index, { ...fact, text })} />
      <Control label={`${label}: ${fact.uncertain ? 'uncertain' : 'certain'} — toggle`} text={fact.uncertain ? 'Mark certain' : 'Mark uncertain'}
        disabled={details?.busy} onPress={() => changeFact(kind, index, { ...fact, uncertain: !fact.uncertain, uncertainty: fact.uncertain ? '' : fact.uncertainty })} />
      {fact.uncertain && <TextInput accessibilityLabel={`${label} uncertainty explanation`} style={styles.input} multiline
        editable={!details?.busy} value={fact.uncertainty} onChangeText={uncertainty => changeFact(kind, index, { ...fact, uncertainty })} />}
    </View>;
  if (!details) return <Txt style={styles.sub}>Loading saved descriptions…</Txt>;
  return <View style={styles.fact}>
    <Txt style={styles.sub}>Read and edit saved descriptions without requesting AI. Saving an edit makes existing suggestions stale; regenerate explicitly to use it.</Txt>
    {saved?.stale && <Txt style={styles.notice}>Descriptions may differ from this recording’s source.</Txt>}
    {!saved?.descriptions && <Txt style={styles.sub}>No saved slide descriptions are available yet.</Txt>}
    {saved?.descriptions?.slides.map(slide => <View key={slide.source_id} style={styles.fact}>
      <Control label={`${expanded === slide.slide_index ? 'Hide' : 'Show'} slide ${slide.slide_index + 1} description`}
        text={`Slide ${slide.slide_index + 1} ${expanded === slide.slide_index ? '▴' : '▾'}`}
        onPress={() => setExpanded(expanded === slide.slide_index ? null : slide.slide_index)} />
      {expanded === slide.slide_index && <>
        <Txt style={styles.sub}>Summary: {slide.summary.text}{slide.summary.uncertain ? ` · Uncertain: ${slide.summary.uncertainty}` : ''}</Txt>
        {slide.key_ideas.map((fact, i) => <Txt key={`idea:${i}`} style={styles.sub}>Key idea: {fact.text}{fact.uncertain ? ` · Uncertain: ${fact.uncertainty}` : ''}</Txt>)}
        {slide.visual_facts.map((fact, i) => <Txt key={`visual:${i}`} style={styles.sub}>Visual fact: {fact.text}{fact.uncertain ? ` · Uncertain: ${fact.uncertainty}` : ''}</Txt>)}
        <Control label={`Edit slide ${slide.slide_index + 1} description`} text="Edit description"
          disabled={details.busy || !!details.prompt || !!draft} onPress={() => details.edit(slide.slide_index)} />
      </>}
    </View>)}
    {draft && draftSlide && <View style={styles.fact}>
      <Txt style={styles.section}>Edit slide {draft.slide + 1} description</Txt>
      <Txt style={styles.sub}>Unsaved draft from revision {draft.revision}. Other slides stay unchanged.</Txt>
      {editor('Summary', draftSlide.summary, 'summary')}
      {draftSlide.key_ideas.map((fact, i) => editor(`Key idea ${i + 1}`, fact, 'key_ideas', i))}
      {draftSlide.visual_facts.map((fact, i) => editor(`Visual fact ${i + 1}`, fact, 'visual_facts', i))}
      <Control label="Save description" text={details.busy ? 'Saving…' : 'Save description'} disabled={details.busy || details.conflict}
        onPress={() => void details.save()} />
      {details.conflict && <Control label="Reload descriptions" text="Reload current version" disabled={details.busy}
        onPress={() => void details.reloadDraft()} />}
      <Control label="Cancel description edit" text="Cancel edit" disabled={details.busy} onPress={details.cancelEdit} />
    </View>}
    {!!details.notice && <Txt style={styles.notice}>{details.notice}</Txt>}
  </View>;
}

const TranscriptWords = memo(function TranscriptWords({ transcript, slide, visits, activeWord, duration, canSeek, onSeek }: {
  transcript: Transcript; slide: number; visits: Visit[]; activeWord: number; duration: number; canSeek: boolean; onSeek: (ms: number) => void;
}) {
  const [openUnalignedSlide, setOpenUnalignedSlide] = useState<number | null>(null);
  const showUnaligned = openUnalignedSlide === slide;
  const { spans, unaligned } = useMemo(() => {
    const selected = new Set<number>();
    let visitIndex = 0;
    transcript.words.forEach((word, index) => {
      while (visitIndex < visits.length && word.start_ms >= visits[visitIndex].end_ms) visitIndex++;
      const visit = visits[visitIndex];
      if (visit?.slide_index === slide && word.start_ms >= visit.start_ms && word.start_ms < visit.end_ms) selected.add(index);
    });
    const source = transcriptSpans(transcript);
    if (!visits.length || !source.some(span => span.wordIndex !== null)) return { spans: [], unaligned: true };
    const nextWord: (number | null)[] = Array(source.length).fill(null);
    let next: number | null = null;
    for (let i = source.length - 1; i >= 0; i--) {
      if (source[i].wordIndex !== null) next = source[i].wordIndex;
      nextWord[i] = next;
    }
    let previous: number | null = null;
    const spans = source.map((span, index) => {
      if (span.wordIndex !== null) { previous = span.wordIndex; return { ...span, index, visible: selected.has(span.wordIndex) }; }
      return { ...span, index, visible: previous !== null ? selected.has(previous) : nextWord[index] !== null && selected.has(nextWord[index]!) };
    }).filter(span => span.visible);
    return { spans, unaligned: false };
  }, [transcript, slide, visits]);
  if (unaligned) return <View style={{ gap: 8 }}>
    <Txt style={styles.sub}>This take has text without usable word timestamps, so it cannot be assigned to slides.</Txt>
    <Control label={showUnaligned ? 'Hide unsplit transcript' : 'Show unsplit transcript'} text={showUnaligned ? 'Hide unsplit transcript' : 'Show unsplit transcript'}
      onPress={() => setOpenUnalignedSlide(value => value === slide ? null : slide)} />
    {showUnaligned && <Txt style={styles.transcript}>{transcript.text}</Txt>}
  </View>;
  if (!spans.length) return <Txt style={styles.sub}>{visits.length ? 'No words transcribed on this slide.' : 'Slide timing is unavailable for this take.'}</Txt>;
  return <Txt style={styles.transcript}>{spans.map(span => {
    const word = span.wordIndex === null ? null : transcript.words[span.wordIndex];
    return <Txt key={span.index} onPress={word && canSeek && seekableWord(word, duration) ? () => onSeek(word.start_ms) : undefined}
      style={span.wordIndex === activeWord ? styles.activeWord : undefined}>{span.text}</Txt>;
  })}</Txt>;
});

function PdfTools({ id, saved, review }: { id: string; saved: SavedAttempt | null; review: ReviewAttempt | null }) {
  const serverDeckId = review?.deck_id || (saved?.state === 'submitted' ? saved.recording.deck_id : undefined) || null;
  const deckState = useReviewDeck(API_URL, serverDeckId, saved?.page_count);
  const knownPdfs = useReviewPdf(API_URL, serverDeckId);
  const media = useReviewPdfMedia(API_URL, id, saved, deckState.deck, knownPdfs);
  return <View style={styles.card}>
    {media.validators}
    <Txt style={styles.section}>Presentation PDF</Txt>
    {media.pdf.uri ? <Txt style={styles.sub}>The original PDF is available for offline review.</Txt> :
      media.pdfSpec ? <Control label="Download PDF for offline review" text={media.pdf.busy ? 'Checking PDF…' : 'Download PDF'}
        disabled={media.pdf.busy} onPress={() => void media.download()} /> : <Txt style={styles.sub}>No downloadable PDF is available for this take.</Txt>}
    {!!media.pdf.error && <Txt style={styles.notice}>{media.pdf.error}</Txt>}
    {!!deckState.notice && <Txt style={styles.notice}>{deckState.notice}</Txt>}
  </View>;
}

function Control({ label, text, onPress, disabled, primary }: { label: string; text: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.button, primary && styles.primary, disabled && { opacity: 0.4 }]}><Txt style={[styles.buttonText, primary && { color: '#17131A' }]}>{text}</Txt></Pressable>;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 40 },
  scrim: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,7,12,0.72)' },
  sheet: { position: 'absolute', left: 0, right: 0, top: 315, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    backgroundColor: '#100E14', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  header: { position: 'absolute', left: 22, right: 22, top: 18, flexDirection: 'row', alignItems: 'center', gap: 16, zIndex: 2 },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: F.medium, fontSize: 28, lineHeight: 32, color: C.text },
  eyebrow: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.5, color: C.secondary },
  title: { fontFamily: F.display, fontSize: 18, color: C.text },
  body: { paddingTop: 88, paddingHorizontal: 24, paddingBottom: 100, gap: 14 },
  slideLabel: { fontFamily: F.semibold, fontSize: 13, color: C.secondary },
  card: { borderRadius: 20, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 16, gap: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  section: { fontFamily: F.display, fontSize: 17, color: C.text },
  time: { fontFamily: F.display, fontSize: 28, color: C.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  sub: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.secondary },
  progress: { height: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 4, backgroundColor: '#FFAA77' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 9 },
  button: { minHeight: 38, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  primary: { backgroundColor: '#FFC791' },
  buttonText: { fontFamily: F.semibold, fontSize: 13, color: C.text },
  transcript: { fontFamily: F.medium, fontSize: 15, lineHeight: 24, color: C.body },
  activeWord: { color: '#FFC791', backgroundColor: 'rgba(255,199,145,0.18)' },
  suggestion: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10, gap: 7 },
  notice: { fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: '#FFB7A7' },
  fact: { gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 },
  input: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', padding: 10,
    color: C.text, fontFamily: F.medium, fontSize: 14, textAlignVertical: 'top' },
});
