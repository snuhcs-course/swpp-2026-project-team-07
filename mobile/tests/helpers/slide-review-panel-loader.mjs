import {resolve as domainResolve} from './domain-loader.mjs';
import {resolve as reviewResolve} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 if(specifier.endsWith('/design/frame'))return {url:'data:text/javascript,export const Txt="text";',shortCircuit:true};
 if(specifier==='react-native')return {url:'data:text/javascript,export const View="view",Pressable="pressable";export const StyleSheet={create:x=>x};',shortCircuit:true};
 if(specifier==='react-native-reanimated')return {url:'data:text/javascript,export const Easing={bezier:()=>()=>0};',shortCircuit:true};
 if(specifier==='./useSlideReview')return {url:'data:text/javascript,export const useSlideReview=()=>globalThis.phase5Panel;',shortCircuit:true};
 if(specifier.endsWith('/design/theme'))return domainResolve(specifier,context,nextResolve);
 return reviewResolve(specifier,context,nextResolve);
}
