// Keep the actual screen, Enter, HintRow and PanView; replace only native adapters,
// the deck snapshot and durable network hook with deterministic local fixtures.
import {resolve as base} from './qa-loader.mjs';
import {resolve as domainResolve} from './domain-loader.mjs';
export {load} from './domain-loader.mjs';
const native=new URL('./qa-screen-runtime-native.mjs',import.meta.url).href;
export function resolve(specifier,context,next){
 if(['react-native','react-native-reanimated','react-native-svg','react-native-safe-area-context','expo-speech','expo-haptics'].includes(specifier)||
 /\/(icons|theme)$/.test(specifier)||specifier==='./shared'||
 /\/(useDeckModel|useDurableQa|AnswerRecorder|useSegmentPlayer)$/.test(specifier))return{url:native,shortCircuit:true};
 return domainResolve(specifier,context,(value,parent)=>base(value,parent,next));
}
