import {resolve as domainResolve,load} from './domain-loader.mjs';
export {load};
const native=new URL('./ai-overview-screen-native.mjs',import.meta.url).href;
export function resolve(specifier,context,next){
 if(['react-native','react-native-reanimated','react-native-svg'].includes(specifier)||
 /\/(frame|icons|PanView|SlideCard|ui|theme|ScoreRing|GradeGrid)$/.test(specifier)||specifier==='./shared'||
 /\/(useDeckModel|useSegmentPlayer|useRunFeedbackStatus|useRunPresentationScores|FeedbackStatusRing|SlideReviewSummary)$/.test(specifier)||
 specifier.endsWith('/rehearsal/analysis')||specifier==='./TakePlayback'||specifier==='./TranscriptCorrections'||specifier==='./ReviewRecordingTools'||specifier.endsWith('/presentations/store')||specifier.endsWith('/services/api')||specifier.endsWith('/recording/storage')||specifier.endsWith('/transcription/reviewStorage')||specifier.endsWith('/transcription/useReviewMedia'))return {url:native,shortCircuit:true};
 return domainResolve(specifier,context,next);
}
