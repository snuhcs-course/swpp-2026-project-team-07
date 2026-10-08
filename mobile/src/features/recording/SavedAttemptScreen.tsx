import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useFocusEffect, useIsFocused } from "expo-router";
import { Text } from "react-native";
import { Action, Card, Screen, styles } from "../../ui/components";
import { getSavedAttempt, saveAttempt, type SavedAttempt } from "./storage";
import { API_URL } from "../../services/api";
import { resumeAfterSeek } from "../transcription/playback";
import { recoverRecording } from "./recovery";
import { uploadAttempt } from "./upload";

function readAttempt(id: string): { saved: SavedAttempt | null; error: string } {
  try { return { saved: getSavedAttempt(id), error: "" }; }
  catch (cause) { return { saved: null, error: cause instanceof Error ? cause.message : "Could not read saved rehearsal. Try again." }; }
}

export function SavedAttemptScreen({ id }: { id: string }) {
  const [loaded, setLoaded] = useState(() => readAttempt(id));
  const saved = loaded.saved;
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const player = useAudioPlayer(saved?.recording.audio_uri || null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const isFocused = useIsFocused();
  const focused = useRef(false);
  const active = useRef(true);
  const intent = useRef(0);
  const seeking = useRef(false);
  function reload() { setLoaded(readAttempt(id)); setNotice(""); }
  useEffect(() => { const currentIntent = intent; active.current = true; return () => { active.current = false; currentIntent.current++; }; }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; intent.current++; };
  }, []));
  useEffect(() => { if (!isFocused) player.pause(); }, [isFocused, player]);
  async function upload() {
    if (busy) return;
    setBusy(true); setNotice("");
    try { await uploadAttempt(id); }
    catch (cause) { if (active.current) setNotice(cause instanceof Error ? cause.message : "Upload failed. The audio is retained."); }
    finally {
      if (active.current) {
        try { setLoaded({ saved: getSavedAttempt(id), error: "" }); }
        catch (cause) { setNotice(previous => [previous, cause instanceof Error ? cause.message : "Could not refresh saved status. Try again."].filter(Boolean).join(" ")); }
        finally { setBusy(false); }
      }
    }
  }
  function recover() {
    if (!saved || !status.isLoaded) return;
    try {
      saveAttempt({ ...saved, recording: recoverRecording(saved.recording, status.duration * 1000), state: "saved", error: undefined });
      setLoaded({ saved: getSavedAttempt(id), error: "" }); setNotice("Recovered locally. You can now upload.");
    } catch (cause) { setNotice(String(cause)); }
  }
  async function toggle() {
    if (!status.isLoaded || status.error || !focused.current || seeking.current) return;
    const op = ++intent.current;
    try {
      if (status.playing) { player.pause(); return; }
      if (status.didJustFinish || status.currentTime >= status.duration - 0.05) {
        seeking.current = true;
        try {
          await resumeAfterSeek(() => player.seekTo(0),
            () => active.current && focused.current && op === intent.current,
            () => player.play());
        } finally { seeking.current = false; }
      } else { player.play(); }
    } catch { if (active.current) setNotice("Could not play this audio. Its file and checkpoint are retained."); }
  }
  if (!saved) return <Screen>
    <Text style={styles.heading}>{loaded.error ? "Could not load saved rehearsal" : "Saved rehearsal not found"}</Text>
    {!!loaded.error && <Text accessibilityRole="alert" style={styles.body}>{loaded.error}</Text>}
    <Action label="Reload saved rehearsal" onPress={reload} />
  </Screen>;
  const interrupted = saved.state === "capturing" || saved.state === "interrupted";
  const submitted = saved.state === "submitted" && saved.server_url === API_URL;
  return <Screen>
    <Text style={styles.heading}>{saved.title}</Text>
    <Text style={styles.body}>{new Date(saved.created_at).toLocaleString()}</Text>
    <Card>
      <Text style={styles.heading}>{submitted ? "Uploaded · awaiting analysis" : interrupted ? "Recovery needed" : "Saved on this device"}</Text>
      <Text style={styles.body}>{Math.floor(status.currentTime)} / {Math.floor(status.duration || saved.recording.duration_ms / 1000)} seconds</Text>
      <Action label={status.playing ? "Pause" : "Play"} disabled={!status.isLoaded || !!status.error} onPress={() => void toggle()} />
      {interrupted ? <Action label="Recover playable audio" disabled={!status.isLoaded || !!status.error} onPress={recover} /> :
        !submitted && <Action label={busy ? "Uploading…" : "Upload recording"} disabled={busy} onPress={() => void upload()} />}
      <Text style={styles.body}>Audio and slide visits stay on this device. Uploaded recordings are awaiting analysis; transcription is not connected in this stage.</Text>
      {!!(notice || saved.error || status.error) && <Text accessibilityRole="alert" style={styles.body}>{notice || saved.error || "Audio could not be opened. The original file is retained."}</Text>}
    </Card>
    <Card><Text style={styles.heading}>Saved slide visits</Text>
      {saved.recording.slide_events.map((event, index) => <Text key={index} style={styles.body}>{event.at_ms} ms · Slide {event.slide_index + 1}</Text>)}
    </Card>
  </Screen>;
}
