import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Card, colors, styles } from './components';
import type { PreviewModel } from '../contracts';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function PreviewView({ model }: { model: PreviewModel }) {
  const { recordingUri, status, ready, progress, audioName, picking, error, mismatch, preview, slideEvents, spans, active, showPreviewControls, setShowPreviewControls, seek, togglePlayback, chooseAudio, retryPreview, selectPreview, words } = model;
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16, gap: 12 }}>
        <Text style={styles.label}>
          {recordingUri ? "SAVED RECORDING" : "SAVED TEST · KOREAN TTS"}
        </Text>
        <Text style={styles.title}>{recordingUri ? "Listen to your rehearsal" : "Listen & follow"}</Text>
        <Text style={styles.body}>{recordingUri ? "Play the audio from this rehearsal." : "Play the sample audio, follow each word and tap a word to seek."}</Text>
        <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 12 }}>
          <View style={styles.between}>
            <Text style={{ ...styles.body, fontVariant: ["tabular-nums"] }}>
              {clock(status.currentTime)} / {clock(status.duration || (recordingUri ? 0 : 23.902))}
            </Text>
            <Text style={styles.label}>
              {status.playing ? "PLAYING" : ready ? "PAUSED" : "LOADING AUDIO"}
            </Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={{ height: 5, backgroundColor: colors.pale, borderRadius: 3 }}>
            <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: colors.blue, borderRadius: 3 }} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Action label="Back 5s" secondary disabled={!ready} onPress={() => void seek(status.currentTime - 5)} /></View>
            <View style={{ flex: 1 }}><Action label={status.playing ? "Pause" : status.didJustFinish ? "Replay" : "Play"} disabled={!ready} onPress={() => void togglePlayback()} /></View>
          </View>
          {/* DEBUG ONLY: picker for the fixture TTS audio. Keep local-recording
              playback above; replace this fixture path with server results later. */}
          {!recordingUri && !audioName && (
            <Text style={styles.body}>
              Choose the matching whisper-test.m4a to hear this saved transcript.
              Nothing is uploaded.
            </Text>
          )}
          {!recordingUri && (
            <Pressable
              accessibilityRole="button"
              disabled={picking}
              onPress={() => void chooseAudio()}
            >
              <Text style={{ color: colors.blue, paddingVertical: 6 }}>
                {picking
                  ? "Opening files…"
                  : audioName
                    ? "Change test audio"
                    : "Choose test audio"}
              </Text>
            </Pressable>
          )}
          {audioName && !status.isLoaded && !status.error && <Text style={styles.body}>Loading audio…</Text>}
          {(error || status.error || mismatch) && <Text accessibilityRole="alert" style={{ color: "#A53232" }}>
            {error ?? (mismatch ? "This audio length does not match the saved transcript. Choose the matching test file." : "Audio could not be loaded. Choose the test file again.")}
          </Text>}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, gap: 20 }}>
        {preview === "completed" && recordingUri && (
          <>
            <Card>
              <Text style={styles.heading}>Transcript not available yet</Text>
              <Text style={styles.body}>
                Listen to the recording from this session. Upload, restart recovery,
                transcription and feedback are not connected yet.
              </Text>
            </Card>
            <Card>
              <Text style={styles.heading}>Slide timeline · testing</Text>
              {/* DEBUG ONLY: render raw events to verify timestamp capture.
                  Keep the data, but replace this card with aligned result UI. */}
              {slideEvents.length ? (
                slideEvents.map((event, eventIndex) => (
                  <Text key={`${event.at_ms}-${eventIndex}`} style={styles.body}>
                    {clock(event.at_ms / 1_000)} · Slide {event.slide_index + 1}
                  </Text>
                ))
              ) : (
                <Text style={styles.body}>No slide visits were captured.</Text>
              )}
            </Card>
          </>
        )}
        {preview === "completed" && !recordingUri && <>
          <Text style={{ color: colors.ink, fontSize: 23, lineHeight: 40 }}>
            {spans.map((span, index) => <Text key={index}
              accessibilityRole={span.wordIndex !== null ? "button" : undefined}
              accessibilityState={span.wordIndex !== null ? { disabled: !ready, selected: span.wordIndex === active } : undefined}
              onPress={span.wordIndex !== null && ready ? () => void seek(words[span.wordIndex!].start_ms / 1000) : undefined}
              style={span.wordIndex === active ? { backgroundColor: "#FFE39B", color: colors.ink, fontWeight: "700" } : undefined}>
              {span.text}
            </Text>)}
          </Text>
          <Text style={{ ...styles.body, fontSize: 12 }}>Saved Whisper output from synthetic speech. Highlight follows the audio player; word timing may be imperfect. No live recording or transcription is running.</Text>
        </>}
        {preview === "processing" && <Card><ActivityIndicator color={colors.blue} /><Text style={styles.heading}>Preparing your transcript</Text><Text style={styles.body}>Waiting-state preview only. No audio is being processed.</Text></Card>}
        {preview === "failed" && <Card><Text style={styles.heading}>Processing could not finish</Text><Text style={styles.body}>Simulated error. Retry restores the saved transcript locally after one second.</Text><Action label="Retry preview" onPress={retryPreview} /></Card>}
        {!recordingUri && <>
          <Pressable accessibilityRole="button" onPress={() => setShowPreviewControls(!showPreviewControls)}>
            <Text style={{ color: colors.muted, paddingVertical: 12 }}>{showPreviewControls ? "Hide preview states" : "Preview other states"}</Text>
          </Pressable>
          {showPreviewControls && <View style={{ gap: 8 }}>
            <Action label="Saved result" secondary onPress={() => selectPreview("completed")} />
            <Action label="Processing preview" secondary onPress={() => selectPreview("processing")} />
            <Action label="Failure preview" secondary onPress={() => selectPreview("failed")} />
          </View>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
