import {resolve as base} from './qa-loader.mjs';
export {load} from './domain-loader.mjs';
const ui=new URL('./qa-screen-ui.mjs',import.meta.url).href;
export function resolve(specifier,context,next){
 if(['react-native','react-native-reanimated','react-native-svg','expo-speech','expo-haptics'].includes(specifier)||
 /\/(frame|icons|PanView|SlideCard|ui|theme)$/.test(specifier)||specifier==='./shared'||
 /\/(useDeckModel|useDurableQa|AnswerRecorder|useSegmentPlayer)$/.test(specifier))return {url:ui,shortCircuit:true};
 return base(specifier,context,next);
}
