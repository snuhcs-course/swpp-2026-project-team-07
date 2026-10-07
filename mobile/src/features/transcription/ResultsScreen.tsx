import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getDocumentAsync } from "expo-document-picker";
import { useFocusEffect } from "expo-router";
import { savedWhisperTranscript } from "../../fixtures/whisperTranscript";
import { Action, Card, colors, styles } from "../../ui/components";
import { activeWordIndex, resumeAfterSeek, transcriptSpans } from "./playback";

type Preview = "completed" | "processing" | "failed";
const spans = transcriptSpans(savedWhisperTranscript);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function ResultsScreen() {
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<Preview>("completed");
  const [showPreviewControls, setShowPreviewControls] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const seeking = useRef(false);
  const intent = useRef(0);
  const focused = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      intent.current++;
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    };
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => {
      focused.current = false;
      intent.current++;
      player.pause();
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    };
  }, [player]));

  const mismatch = status.isLoaded && Math.abs(status.duration - 23.902) > 0.5;
  const ready = !!audioName && status.isLoaded && !status.error && !mismatch && preview === "completed";
  const active = ready ? activeWordIndex(savedWhisperTranscript.words, status.currentTime * 1000) : -1;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  function selectPreview(next: Preview) {
    intent.current++;
    player.pause();
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    setPreview(next);
  }
  function retryPreview() {
    selectPreview("processing");
    retryTimer.current = setTimeout(() => { retryTimer.current = null; setPreview("completed"); }, 1000);
  }
  async function chooseAudio() {
    if (picking) return;
    intent.current++;
    player.pause();
    setPicking(true);
    try {
      const result = await getDocumentAsync({ type: "audio/*", multiple: false, copyToCacheDirectory: true });
      if (!mounted.current || !focused.current || result.canceled) return;
      const file = result.assets[0];
      if (file.name !== "whisper-test.m4a") {
        setError("Choose whisper-test.m4a, the audio used for this saved transcript.");
        return;
      }
      setError(null);
      player.replace({ uri: file.uri });
      setAudioName(file.name);
    } catch {
      if (mounted.current) setError("Could not open the audio. Choose the test recording again.");
    } finally {
      if (mounted.current) setPicking(false);
    }
  }
  async function seek(seconds: number) {
    if (!ready || seeking.current) return;
    seeking.current = true;
    try { await player.seekTo(Math.max(0, Math.min(seconds, status.duration))); }
    catch { if (mounted.current) setError("Could not move playback. Try again."); }
    finally { seeking.current = false; }
  }
  async function togglePlayback() {
    if (!ready || seeking.current) return;
    const operation = ++intent.current;
    try {
      setError(null);
      if (status.playing) { player.pause(); return; }
      if (status.didJustFinish || status.currentTime >= status.duration - 0.05) {
        seeking.current = true;
        try {
          await resumeAfterSeek(() => player.seekTo(0),
            () => mounted.current && focused.current && intent.current === operation,
            () => player.play());
        } finally { seeking.current = false; }
        return;
      }
      player.play();
    } catch { if (mounted.current) setError("Could not play the recording. Choose it again."); }
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16, gap: 12 }}>
        <Text style={styles.label}>SAVED TEST · KOREAN TTS</Text>
        <Text style={styles.title}>Listen & follow</Text>
        <Text style={styles.body}>Play your recording. Follow each word. Tap a word to jump back into the audio.</Text>
        <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 12 }}>
          <View style={styles.between}>
            <Text style={{ ...styles.body, fontVariant: ["tabular-nums"] }}>{clock(status.currentTime)} / {clock(status.duration || 23.902)}</Text>
            <Text style={styles.label}>{status.playing ? "PLAYING" : ready ? "PAUSED" : "TEST AUDIO"}</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={{ height: 5, backgroundColor: colors.pale, borderRadius: 3 }}>
            <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: colors.blue, borderRadius: 3 }} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Action label="Back 5s" secondary disabled={!ready} onPress={() => void seek(status.currentTime - 5)} /></View>
            <View style={{ flex: 1 }}><Action label={status.playing ? "Pause" : status.didJustFinish ? "Replay" : "Play"} disabled={!ready} onPress={() => void togglePlayback()} /></View>
          </View>
          {!audioName && <Text style={styles.body}>Choose the matching whisper-test.m4a to hear this saved transcript. Nothing is uploaded.</Text>}
          <Pressable accessibilityRole="button" disabled={picking} onPress={() => void chooseAudio()}>
            <Text style={{ color: colors.blue, paddingVertical: 6 }}>{picking ? "Opening files…" : audioName ? "Change test audio" : "Choose test audio"}</Text>
          </Pressable>
          {audioName && !status.isLoaded && !status.error && <Text style={styles.body}>Loading audio…</Text>}
          {(error || status.error || mismatch) && <Text accessibilityRole="alert" style={{ color: "#A53232" }}>
            {error ?? (mismatch ? "This audio length does not match the saved transcript. Choose the matching test file." : "Audio could not be loaded. Choose the test file again.")}
          </Text>}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40, gap: 20 }}>
        {preview === "completed" && <>
          <Text style={{ color: colors.ink, fontSize: 23, lineHeight: 40 }}>
            {spans.map((span, index) => <Text key={index}
              accessibilityRole={span.wordIndex !== null ? "button" : undefined}
              accessibilityState={span.wordIndex !== null ? { disabled: !ready, selected: span.wordIndex === active } : undefined}
              onPress={span.wordIndex !== null && ready ? () => void seek(savedWhisperTranscript.words[span.wordIndex!].start_ms / 1000) : undefined}
              style={span.wordIndex === active ? { backgroundColor: "#FFE39B", color: colors.ink, fontWeight: "700" } : undefined}>
              {span.text}
            </Text>)}
          </Text>
          <Text style={{ ...styles.body, fontSize: 12 }}>Saved Whisper output from synthetic speech. Highlight follows the audio player; word timing may be imperfect. No live recording or transcription is running.</Text>
        </>}
        {preview === "processing" && <Card><ActivityIndicator color={colors.blue} /><Text style={styles.heading}>Preparing your transcript</Text><Text style={styles.body}>Waiting-state preview only. No audio is being processed.</Text></Card>}
        {preview === "failed" && <Card><Text style={styles.heading}>Processing could not finish</Text><Text style={styles.body}>Simulated error. Retry restores the saved transcript locally after one second.</Text><Action label="Retry preview" onPress={retryPreview} /></Card>}
        <Pressable accessibilityRole="button" onPress={() => setShowPreviewControls(!showPreviewControls)}>
          <Text style={{ color: colors.muted, paddingVertical: 12 }}>{showPreviewControls ? "Hide preview states" : "Preview other states"}</Text>
        </Pressable>
        {showPreviewControls && <View style={{ gap: 8 }}>
          <Action label="Saved result" secondary onPress={() => selectPreview("completed")} />
          <Action label="Processing preview" secondary onPress={() => selectPreview("processing")} />
          <Action label="Failure preview" secondary onPress={() => selectPreview("failed")} />
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}
