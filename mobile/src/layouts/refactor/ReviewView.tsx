import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Action, Card, Screen, TabBar, Panel, Chip, Notice, colors, styles } from './components';
import { FeedbackView } from './FeedbackView';
import { TranscriptView } from './TranscriptView';
import type { ReviewModel } from '../contracts';
export function ReviewView({ model, arrangement = 'docked' }: { model: ReviewModel; arrangement?: 'docked' | 'top-controls' }) {
  const { tab, setTab, evidenceVisit, duration, position, canSeek, playingIntent, ready, toggle, seek, saved, deckState, review, busy, submitted, interrupted, analysis, media, status, canRecover, recover, upload, notice, serverKnown, canAnalyze, aligned, visits, slideTimings, visit, previousVisit, nextVisit, slideStage, transcriptSpans, refreshAnalysis, seekPreviousVisit, seekNextVisit, loaded, reload } = model;
  useEffect(() => model.bindSlideReveal(() => setTab('slides')), [model.bindSlideReveal, setTab]);
  if (!saved && !review) return <Screen>
    <Text style={styles.heading}>{loaded.error ? "Could not load saved rehearsal" : "Saved rehearsal not found for this API"}</Text>
    {!!loaded.error && <Text accessibilityRole="alert" style={styles.body}>{loaded.error}</Text>}
    <Action label="Reload saved rehearsal" onPress={reload} />
  </Screen>;
  const tabs = <TabBar value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'slides', label: 'Slides' }, { value: 'transcript', label: 'Transcript' }]} />;
  const transport = <>
    <View accessibilityRole="progressbar" accessibilityLabel="Audio progress" accessibilityValue={{ min: 0, max: duration, now: Math.min(position, duration) }} style={{ height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' }}>
      <View style={{ height: 4, width: `${duration > 0 ? Math.min(100, position / duration * 100) : 0}%`, backgroundColor: colors.blue }} />
    </View>
    <View style={styles.between}><Text style={styles.caption}>{formatTime(position)}</Text><Text style={styles.caption}>{formatTime(duration)}</Text></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}><Action label="−5 seconds" displayLabel="−5s" compact disabled={!canSeek} onPress={() => seek(position - 5000)} secondary /></View>
      <View style={{ flex: 2 }}><Action label={playingIntent ? "Pause" : "Play"} disabled={!ready && !playingIntent} onPress={toggle} /></View>
      <View style={{ flex: 1 }}><Action label="+5 seconds" displayLabel="+5s" compact disabled={!canSeek} onPress={() => seek(position + 5000)} secondary /></View>
    </View>
  </>;
  return <Screen scrollKey={`${tab}:${evidenceVisit}`} header={arrangement === "docked" ? tabs : transport} footer={arrangement === "docked" ? transport : tabs}>
    <View style={{ gap: 5 }}><Text style={styles.heading}>{saved?.title || deckState.deck?.title || "Saved rehearsal"}</Text>
      <Text style={styles.caption}>{saved ? "Local capture" : "Server rehearsal · review copy"} · {saved?.created_at || review?.created_at ? new Date(saved?.created_at || review!.created_at!).toLocaleString() : "Date unavailable"}</Text></View>
    {busy && <Notice text="Uploading your saved recording…" busy />}
    <Chip label={submitted ? `Uploaded · ${analysis.result?.processing_state?.replaceAll("_", " ") || "awaiting analysis"}` : interrupted ? "Recovery needed" : saved ? "Saved on this device" : review?.processing_state.replaceAll('_', ' ') || 'Saved'} />
    {!!media.audio.error && <Notice text={media.audio.error} tone="warning" />}
    {!!status.error && <Notice tone="error" text="Audio could not be opened. The original file is retained." />}
    {!media.audio.available && media.audioSpec && <Action label={media.audio.busy ? "Checking audio…" : "Download audio for offline review"} disabled={media.audio.busy} onPress={() => void media.download('audio')} />}
      {interrupted ? <Action label="Recover playable audio" disabled={!canRecover} onPress={recover} /> :
        saved && !submitted && <Action label={busy ? "Uploading…" : "Upload recording"} disabled={busy} onPress={() => void upload()} />}
      <Text style={styles.caption}>New recordings upload automatically. Transcription starts after the first-use OpenAI disclosure. AI feedback starts when you choose Generate feedback.</Text>
      {!!(notice || saved?.error) && <Notice tone="error" text={notice || saved!.error!} />}
    <Panel visible={tab === 'overview'}>
      <Card><View style={styles.between}><View><Text style={styles.label}>DURATION</Text><Text style={styles.numeric}>{formatTime(duration)}</Text></View>
        <View style={{ gap: 4 }}>{review?.metrics?.speaking_rates.map(rate => <View key={rate.language}><Text style={styles.label}>{rate.language === 'en' ? 'English words/min' : 'Korean Hangul runs/min'}: </Text><Text style={[styles.heading, { color: colors.blue }]}>{rate.per_minute.toFixed(1)}</Text></View>)}</View></View>
        {review?.metrics && <Text style={styles.caption}>Rates use total rehearsal time, including silence. Korean Hangul runs are an estimate, not a linguistic word count.</Text>}
      </Card>
      {review?.metrics && <Card><Text style={styles.heading}>Time on each slide</Text>
        {review.metrics.time_per_slide.map(item => <View key={item.slide_index} style={{ gap: 5 }}><View style={styles.between}><Text style={styles.caption}>Slide {item.slide_index + 1}</Text><Text style={styles.caption}>{(item.duration_ms / 1000).toFixed(1)} seconds</Text></View><View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.pale }}><View style={{ height: 8, backgroundColor: colors.blue, width: `${Math.min(100, item.duration_ms / Math.max(1, ...review.metrics!.time_per_slide.map(s => s.duration_ms)) * 100)}%` }} /></View></View>)}

      </Card>}
    </Panel>
    {(serverKnown || analysis.result || review) && <Card>
      <Text style={styles.heading}>Recording analysis</Text>
      <Action label="Refresh" disabled={analysis.busy} onPress={refreshAnalysis} />
      {canAnalyze && (!analysis.result || analysis.result.processing_state === "awaiting_analysis") &&
        <Action label="Analyze recording" disabled={analysis.busy || !!analysis.prompt} onPress={analysis.analyze} />}
      {canAnalyze && analysis.result?.status === "failed" && <Action label="Retry analysis" disabled={analysis.busy || !!analysis.prompt || !analysis.result.retry_available} onPress={analysis.retry} />}
      {analysis.busy && <Notice text="Checking analysis request…" busy />}
      {!!analysis.result?.failed_stage && <Text style={styles.body}>Stopped during {analysis.result.failed_stage.replaceAll("_", " ")}.</Text>}
      {!!analysis.result?.retry_at && <Text style={styles.body}>Retry available after {new Date(analysis.result.retry_at).toLocaleString()}. Refresh to check.</Text>}
      {!!analysis.result?.error && <Notice tone="error" text={analysis.result.error.message} />}
      {!!analysis.notice && <Notice tone="warning" text={analysis.notice} />}
      {analysis.prompt && <>
        <Text style={styles.body}>{analysis.prompt.kind === "disclosure"
          ? "Transcription sends your saved audio through this server to OpenAI for hosted Whisper transcription. Audio and results remain available locally. Continue to allow automatic transcription after future recordings on this device, or Cancel."
          : "The previous OpenAI request may already have been charged. Retrying may send the audio again and incur another charge. There is no guarantee of exactly one provider request. Continue only if you accept this."}</Text>
        <Action label="Continue" onPress={analysis.continuePrompt} />
        <Action label="Cancel" onPress={analysis.cancelPrompt} />
      </>}
      {analysis.result?.analysis_outcome === "no_speech" && <Text style={styles.body}>No speech detected. No audio was sent to OpenAI.</Text>}
    </Card>}
    <Panel visible={tab === 'slides'}>
    <Card>
      <Text style={styles.heading}>{visit >= 0 ? `Slide ${visits[visit].slide_index + 1} · Visit ${visit + 1}` : 'Slides'}</Text>
      {slideStage}
      {!!media.pdf.error && <Text style={styles.body}>{media.pdf.error} Audio and transcript remain available.</Text>}
      {!media.pdf.available && media.pdfSpec && <Action label={media.pdf.busy ? "Checking PDF…" : "Download PDF for offline review"} disabled={media.pdf.busy} onPress={() => void media.download('pdf')} />}
      {!!deckState.notice && <Text style={styles.body}>{deckState.notice}</Text>}
    </Card>
    {!!slideTimings.length && <Card>
      <Text style={styles.heading}>Time by slide</Text>
      <Text style={styles.caption}>Ranges are measured from recording start. Total time includes every visit to the slide.</Text>
      {slideTimings.map(item => <View key={item.slide} style={{ gap: 6 }}>
        <View style={styles.between}><Text style={styles.heading}>Slide {item.slide + 1}</Text><Text style={styles.body}>{item.total / 1000} sec total</Text></View>
        <Text style={styles.body}>{item.ranges.map(range => `${range.start_ms / 1000}–${range.end_ms / 1000} sec`).join(', ')}</Text>
      </View>)}
    </Card>}
    <Card><Text style={styles.heading}>Saved slide visits</Text>
      <Text style={styles.body}>{aligned ? 'Aligned chronological visits' : 'Recorded navigation'}</Text>
      <Action label="Previous visit" disabled={!canSeek || previousVisit < 0} onPress={seekPreviousVisit} secondary />
      <Action label="Next visit" disabled={!canSeek || visit < 0 || nextVisit < 0} onPress={seekNextVisit} secondary />
      {visits.map((item, index) => <Action key={index} label={`Visit ${index + 1} · Slide ${item.slide_index + 1} · ${item.start_ms / 1000}–${item.end_ms / 1000} seconds${item.start_ms === item.end_ms ? ' · instantaneous' : ''}${index === visit ? ' · current' : ''}`}
        displayLabel={`Slide ${item.slide_index + 1} · Visit ${index + 1}${index === visit ? ' · current' : ''}\n${item.start_ms / 1000}–${item.end_ms / 1000} sec${item.start_ms === item.end_ms ? ' · instantaneous' : ''}`}
        disabled={!canSeek} secondary onPress={() => seek(item.start_ms)} />)}
      {!visits.length && <Text style={styles.body}>Saved navigation timing is unavailable.</Text>}
    </Card>
    </Panel>
    <Panel visible={tab === 'transcript'}>
      <View style={{ backgroundColor: colors.transcript, padding: 16, borderRadius: 14, gap: 14 }}>
      {review?.transcript && <>
        <Text style={styles.label}>{review.status === "completed" ? "Transcript" : "Saved partial transcript"}</Text>
        <TranscriptView spans={transcriptSpans} />
      </>}
      {!review?.transcript && <Text style={styles.body}>Your transcript will appear when transcription finishes. If processing has stopped, use Upload recording or Analyze recording to resume. Audio playback remains available.</Text>}
      </View>
    </Panel>
    {model.feedback && <FeedbackView model={model.feedback} />}
  </Screen>;
}

function formatTime(ms: number) { return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`; }
