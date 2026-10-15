import {resolve as base} from './qa-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,next){
 if(['react-native','react-native-reanimated'].includes(specifier)||specifier.endsWith('/design/frame'))return {url:new URL('./qa-screen-ui.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier==='./useSlideReview')return {url:'data:text/javascript,export const useSlideReview=()=>globalThis.reviewEvidenceHook;',shortCircuit:true};
 return base(specifier,context,next);
}
