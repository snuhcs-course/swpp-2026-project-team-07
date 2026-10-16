// Native/model boundaries for real Rehearse, cue hook/cache/client and panel tests.
import { resolve as storageResolve } from './storage-native-loader.mjs';
import { resolve as domainResolve } from './domain-loader.mjs';
export { load } from './domain-loader.mjs';
const native = new URL('./recording-cues-runtime-native.mjs', import.meta.url).href;
export function resolve(specifier, context, nextResolve) {
  if (['react-native', 'react-native-reanimated', 'react-native-svg', 'expo-haptics'].includes(specifier) ||
      /\/(frame|icons|PanView|SlideCard|ui)$/.test(specifier) || specifier === './shared' ||
      /\/(CaptureEngine|takes|useSegmentPlayer|importer|useDeckModel)$/.test(specifier) ||
      specifier.endsWith('/rehearsal/analysis') || specifier.endsWith('/recording/storage') || specifier.endsWith('/presentations/store') || specifier === './TakePlayback') {
    return { url: native, shortCircuit: true };
  }
  return domainResolve(specifier, context, (value, parent) => storageResolve(value, parent, nextResolve));
}
