import { View } from 'react-native';
import Pdf from 'react-native-pdf';
/** Native-PDF playback rendering adapted from prototype 33907d3, using validated local media only. */
export function PlaybackSlide({ uri, slide, pages, onError }: { uri: string; slide: number; pages: number; onError: () => void }) {
  return <View pointerEvents="none" style={{ width: '100%', aspectRatio: 16 / 10 }}>
    <Pdf key={uri} source={{ uri }} page={slide + 1} horizontal enablePaging scrollEnabled={false} enableDoubleTapZoom={false} fitPolicy={2}
      style={{ flex: 1, width: '100%' }} onLoadComplete={count => { if (count !== pages) onError(); }} onError={onError} />
  </View>;
}
