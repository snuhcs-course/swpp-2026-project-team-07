import {resolve as domainResolve,load} from './domain-loader.mjs';
export {load};
const native=new URL('./ai-overview-screen-native.mjs',import.meta.url).href;
export function resolve(specifier,context,next){
 if(/\/(WaitScreen|ListenBackKaraokeScreen)\.tsx$/.test(context.parentURL??'')&&
 (specifier.endsWith('/services/backendFetch')||(process.env.EXPO_PUBLIC_ACCESS_MODE!=='store'&&specifier.endsWith('/services/storePrivacy'))))return {url:native,shortCircuit:true};
 if(['react-native','react-native-reanimated','react-native-svg'].includes(specifier)||
 /\/(frame|icons|PanView|SlideCard|ui|theme|ScoreRing)$/.test(specifier)||specifier==='./shared'||
 /\/(useDeckModel|useSegmentPlayer|useRunFeedbackStatus|useRunPresentationScores|useRunFeedbackV3|SlideReviewSummary|useSlideReview|requirementsStore|requirementsDraft)$/.test(specifier)||
 specifier.endsWith('/rehearsal/takes')||specifier.endsWith('/rehearsal/analysis')||specifier==='./TakePlayback'||specifier==='./TranscriptCorrections'||specifier==='./ReviewRecordingTools'||specifier.endsWith('/presentations/store')||specifier.endsWith('/services/api')||specifier.endsWith('/recording/storage')||specifier.endsWith('/transcription/reviewStorage')||specifier.endsWith('/transcription/useReviewMedia'))return {url:native,shortCircuit:true};
 return domainResolve(specifier,context,next);
}
