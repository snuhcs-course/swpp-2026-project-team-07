import { Text } from 'react-native';
import { colors, styles } from './components';
import type { ReviewModel } from '../contracts';
export function TranscriptView({ spans }: { spans: ReviewModel['transcriptSpans'] }) {
  return <><Text style={styles.body}>{spans.length ? spans.map((span, index) => <Text key={index} accessibilityRole={span.onSeek ? 'button' : undefined} accessibilityState={span.onSeek ? { selected: span.selected } : undefined} onPress={span.onSeek} style={span.selected ? { backgroundColor: colors.blue, color: '#ffffff' } : undefined}>{span.text}</Text>) : 'No transcribed words.'}</Text><Text style={styles.body}>Tap a timed word to seek. Untimed or out-of-range text stays readable.</Text></>;
}
