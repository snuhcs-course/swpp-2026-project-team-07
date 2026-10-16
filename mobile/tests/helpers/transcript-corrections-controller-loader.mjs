import { resolve as domainResolve, load } from './domain-loader.mjs';
export { load };
export function resolve(specifier, context, nextResolve) {
 const mocked = ['react-native', 'react-native-reanimated', 'react-native-svg', 'expo-audio'];
 const suffixes = ['/design/frame','/design/icons','/design/PanView','/design/theme','/rehearsal/analysis','/presentations/store',
  '/presentations/useTranscriptCorrections','/presentations/transcriptSuggestions','/presentations/correctionStore','/services/api',
  '/presentations/useDeckModel','/rehearsal/useSegmentPlayer','/recording/storage','/recording/recovery','/transcription/reviewStorage',
  '/transcription/useReviewDeck','/transcription/useReviewMedia','/transcription/useReviewPdf','/transcription/useReviewPlayerStatus',
  '/transcription/reviewValidation','/transcription/reviewMedia','/rehearsal/coaching','/feedback/storage'];
 if (mocked.includes(specifier) || suffixes.some(suffix => specifier.endsWith(suffix))) return { url: new URL('./transcript-corrections-controller-native.mjs', import.meta.url).href, shortCircuit: true };
 return domainResolve(specifier, context, nextResolve);
}
