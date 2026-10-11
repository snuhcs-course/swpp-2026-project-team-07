import { Text } from 'react-native';
import type { Transcript } from '../../contracts';
import { colors, styles } from '../../ui/components';
import { activeWordIndex, seekableWord, transcriptSpans } from './playback';

/** Adapted from prototype 33907d3: preserve verbatim characters and use only native position. */
export function PlaybackTranscript({ transcript, positionMs, durationMs, ready, onSeek }: {
  transcript: Transcript; positionMs: number; durationMs: number; ready: boolean; onSeek: (ms: number) => void;
}) {
  const spans = transcriptSpans(transcript);
  const active = ready ? activeWordIndex(transcript.words, positionMs, durationMs) : -1;
  return <>
    <Text style={styles.body}>{!transcript.text ? 'No transcribed words.' : spans.map((span, index) => {
      const word = span.wordIndex === null ? null : transcript.words[span.wordIndex];
      const canSeek = !!word && ready && seekableWord(word, durationMs);
      return <Text key={index} accessibilityRole={canSeek ? 'button' : undefined}
        accessibilityState={canSeek ? { selected: span.wordIndex === active } : undefined}
        onPress={canSeek ? () => onSeek(word!.start_ms) : undefined}
        style={span.wordIndex !== null && span.wordIndex === active ? { backgroundColor: colors.blue, color: '#ffffff' } : undefined}>{span.text}</Text>;
    })}</Text>
    <Text style={styles.body}>Tap a timed word to seek. Untimed or out-of-range text stays readable.</Text>
  </>;
}
