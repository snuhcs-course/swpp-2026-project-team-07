import { Text, View, useWindowDimensions } from 'react-native';
import { Action, Card, Chip, Icon, IconButton, Notice, RecordControl, Screen, SlideProgress, colors, styles } from './components';
import type { RecordingModel } from '../contracts';
function formatDuration(ms: number) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
export function RecordingView({ model }: { model: RecordingModel }) {
  const { height } = useWindowDimensions();
  const { savedPreview, savedDurationMillis, savedSlideEvents, params, recordingState, recordingUri, pdfUri, localDeckId, pdfReady, pageCount, index, pdfError, recordingError, elapsedMillis, stage, openReview, onStarting, startRecording, stopRecording, changeSlide } = model;
  if (savedPreview?.attemptId) return <Screen footer={<>
    <Action label="Open review" icon="play" onPress={openReview} />
    <Action label="Record again" secondary icon="mic" onPress={onStarting} />
  </>}>
    <View style={{ alignItems: 'center', paddingVertical: 28, gap: 14 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={32} color={colors.green} /></View>
      <Text style={styles.title}>Session saved</Text>
      <Text style={[styles.body, { textAlign: 'center' }]}>Your recording is ready to listen back.</Text>
    </View>
    <Card><Text style={styles.heading}>{params.title ?? 'Presentation'}</Text><Text style={styles.label}>RECORDED DURATION</Text><Text style={styles.numeric}>{formatDuration(savedDurationMillis)}</Text>
      <Text style={styles.caption}>{savedSlideEvents.length} slide visit{savedSlideEvents.length === 1 ? '' : 's'} captured. You can stop at any point in your presentation.</Text><Chip label="Saved on this device" tone="success" /></Card>
    <Notice text="Your recording is saved. Review opens automatically to upload it. Transcription follows the first-use OpenAI disclosure." />
  </Screen>;

  return (
    <Screen footer={<>
      <RecordControl
        label={recordingState === 'recording' ? 'Stop recording' : recordingState === 'starting' ? 'Starting recording…' : recordingState === 'stopping' ? 'Saving recording…' : 'Start recording'}
        recording={recordingState === 'recording'} busy={recordingState === 'starting' || recordingState === 'stopping'}
        disabled={recordingState === 'starting' || recordingState === 'stopping' || (recordingState === 'ready' && (!pdfReady || !pageCount))}
        onPress={() => void (recordingState === 'recording' ? stopRecording() : startRecording())} />
      <Text style={[styles.caption, { textAlign: 'center' }]}>Saved locally · capture limit 10 minutes</Text>
    </>}>
      <View style={styles.between}><Text style={[styles.heading, { flex: 1 }]}>{pdfUri ? params.title ?? 'Presentation' : 'Sample slides'}</Text>
        <Chip label={`${recordingState === 'recording' ? '● ' : ''}${formatDuration(recordingState === 'ready' ? savedPreview?.durationMillis ?? 0 : elapsedMillis)}`} tone={recordingState === 'recording' ? 'danger' : 'neutral'} /></View>
      {!!pdfUri && recordingState === 'ready' && <Text style={styles.caption}>Stop saves and uploads your recording, then starts transcription after the first-use OpenAI disclosure.</Text>}
      <Text style={styles.caption}>{recordingState === 'recording' ? 'Recording in progress' : recordingState === 'stopping' ? 'Saving recording' : recordingState === 'starting' ? 'Preparing microphone…' : 'Ready when you are. Tap Record to begin.'}</Text>
      {pdfUri ? (
        <View style={{ height: Math.max(190, Math.min(360, height * 0.42)), width: "100%", borderRadius: 12, overflow: "hidden" }}
          pointerEvents={recordingState === "starting" || recordingState === "stopping" ? "none" : "auto"}>
          {stage}
        </View>
      ) : stage}
      {pageCount > 10 && <Text style={styles.body}>Choose a PDF with at most 10 slides to rehearse.</Text>}
      {!!pdfUri && !localDeckId && <Text style={styles.body}>Open this PDF from your imported presentations before recording.</Text>}
      {!!pdfError && <Notice tone="error" text={pdfError} />}
      <SlideProgress count={pageCount} index={index} />
      <View style={styles.between}>
        <IconButton icon="chevron-left"
          label="Previous slide"
          disabled={index === 0 || !pdfReady || !pageCount || recordingState === "starting" || recordingState === "stopping"}
          onPress={() => changeSlide(index - 1)}
        />
        <Text style={styles.body}>{pageCount ? `${index + 1} / ${pageCount}` : "Loading PDF…"}</Text>
        <IconButton icon="chevron-right"
          label="Next slide"
          disabled={index >= pageCount - 1 || !pdfReady || !pageCount || recordingState === "starting" || recordingState === "stopping"}
          onPress={() => changeSlide(index + 1)}
        />
      </View>
      {!!recordingError && <Notice tone="warning" text={recordingError} />}
      {!!params.audience && <Text style={styles.caption}>Audience: {params.audience}</Text>}
      {!pdfUri && <>
        <Notice title="Sample preview" text="These example slides are separate from your imported presentations. Import a PDF to keep a durable rehearsal." />
        <Action label={recordingUri ? "Open review" : "Preview saved test transcript"} secondary disabled={recordingState !== 'ready'} onPress={openReview} />
      </>}
    </Screen>
  );
}
