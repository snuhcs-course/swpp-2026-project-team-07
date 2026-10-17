// Review keeps saved-audio playback, synchronized transcript and corrections in its page.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '../design/frame';
import { Glyph } from '../design/icons';
import { MiniSlide } from '../design/SlideCard';
import { F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { fmt } from '../domain/format';
import { useStore } from '../features/presentations/store';
import type { DeckModel } from '../features/presentations/useDeckModel';
import { getSavedAttempt } from '../features/recording/storage';
import { audioOf, subscribePlaybackId } from '../features/rehearsal/analysis';
import type { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { readReview } from '../features/transcription/reviewStorage';
import { useReviewAudio } from '../features/transcription/useReviewMedia';
import { API_URL } from '../services/api';
import { TranscriptCorrections } from './TranscriptCorrections';
import { ReviewRecordingTools, type ReviewEvidence } from './ReviewRecordingTools';

const beforePlay = () => {};
export function ReviewSlidePlayback({ model, id, slide, player, evidence, evidenceRequest, onCloseEvidence, onEvidenceShown }: {
 model: DeckModel; id: string; slide: number; player: ReturnType<typeof useSegmentPlayer>;
 evidence: ReviewEvidence | null; evidenceRequest: number; onCloseEvidence: () => void; onEvidenceShown?: (y: number) => void;
}) {
 const { c } = useTheme(), { deck } = model;
 const version = useStore(state => state.version);
 const saved = useMemo(() => { void version; try { return getSavedAttempt(id); } catch { return null; } }, [id, version]);
 const review = useMemo(() => { void version; try { return readReview(API_URL, id); } catch { return null; } }, [id, version]);
 const media = useReviewAudio(API_URL, id, saved, review);
 const stop = player.stop;
 const toolsY = useRef<number | null>(null);
 useEffect(() => {
  if (evidenceRequest && toolsY.current !== null) onEvidenceShown?.(toolsY.current);
 }, [evidenceRequest, onEvidenceShown]);
 useEffect(() => subscribePlaybackId(id), [id]);
 useEffect(() => () => stop(), [id, media.audio.uri, stop]);
 const audioUri = useCallback((source: string) => source === id ? media.audio.uri : audioOf(source), [id, media.audio.uri]);
 const part = model.state.run?.parts[slide], time = model.times[slide] ?? 0;
 const key = `slide:${deck.id}:${slide}`, selected = player.playingKey === key, playing = selected && !player.paused;
 const toggle = () => {
  if (!part || !media.audio.uri) return;
  void player.playSegments(key, part.segments.map(segment => ({ uri: media.audio.uri!, ...segment })));
 };
 return <>
  {media.validators}
  <View style={[styles.card, { borderColor: c.hair, backgroundColor: c.surface06 }]}>
   <ReviewSlidePreview model={model} slide={slide}/>
   <View style={styles.playback}><Pressable accessibilityRole="button" accessibilityLabel={playing ? `Pause slide ${slide + 1}` : `Play slide ${slide + 1}, ${fmt(time)}`}
    accessibilityState={{ disabled: !part || time <= 0 || !media.audio.uri }} disabled={!part || time <= 0 || !media.audio.uri} onPress={toggle} style={styles.playButton}>
    <Glyph name={playing ? 'p-pause' : 'p-play'} size={18} color={c.text}/></Pressable>
    <View style={[styles.track, { backgroundColor: c.ink18 }]}><View style={{ height: 6, width: `${100 * (selected ? player.progress : 0)}%`, backgroundColor: c.text }}/></View>
    <Txt style={[styles.label, { color: c.secondary }]}>{selected ? `${fmt(player.elapsedMs / 1000)} / ${fmt(time)}` : fmt(time)}</Txt>
   </View>
   {!!player.error && <Txt accessibilityRole="alert" style={[styles.note, { color: c.secondary }]}>{player.error}</Txt>}
   <TranscriptCorrections model={model} id={id} slide={slide} player={player} onBeforePlay={beforePlay} inline audioUri={audioUri}/>
  </View>
  <View onLayout={event => { toolsY.current = event.nativeEvent.layout.y; }}><ReviewRecordingTools model={model} id={id} slide={slide} player={player} media={media} evidence={evidence} onCloseEvidence={onCloseEvidence}/></View>
 </>;
}
export function ReviewSlidePreview({ model, slide }: { model: DeckModel; slide: number }) {
 const { c } = useTheme(), { deck } = model;
 return <View style={styles.previewRow}><MiniSlide hue={deck.hue} page={deck.pages[slide]} title={deck.slides[slide]?.title ?? ''} width={156} height={88} radius={12}/>
  <View style={{ flex: 1, gap: 6 }}><Txt style={[styles.slideLabel, { color: c.secondary }]}>{`Slide ${slide + 1}`}</Txt><Txt style={[styles.previewTitle, { color: c.text }]}>{deck.slides[slide]?.title ?? `Slide ${slide + 1}`}</Txt></View>
 </View>;
}
const styles = StyleSheet.create({
 card: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 12 }, previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
 slideLabel: { fontFamily: F.semibold, fontSize: 13 }, previewTitle: { fontFamily: F.display, fontSize: 17, lineHeight: 22 },
 playback: { flexDirection: 'row', alignItems: 'center', gap: 8 }, playButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
 track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' }, label: { fontFamily: F.medium, fontSize: 12, lineHeight: 17 }, note: { fontFamily: F.medium, fontSize: 12, lineHeight: 18 },
});
