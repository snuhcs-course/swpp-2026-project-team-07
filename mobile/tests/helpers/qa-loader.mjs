import {resolve as base} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 if(specifier==='expo-file-system')return {url:new URL('./upload-native.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier==='expo/fetch')return {url:'data:text/javascript,export const fetch=(...args)=>globalThis.fetch(...args);',shortCircuit:true};
 if(specifier.endsWith('/presentations/store')||specifier==='./store'&&/correctionStore/.test(context.parentURL??''))return {url:new URL('./qa-test-store.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('/presentations/serverDeck'))return {url:'data:text/javascript,export const serverSlides=()=>{throw new Error("Unexpected deck upload")};',shortCircuit:true};
 if(specifier.endsWith('/transcription/reviewStorage'))return {url:'data:text/javascript,export const readReview=(_api,id)=>globalThis.qaReviews?.[id]??null;',shortCircuit:true};
 return base(specifier,context,nextResolve);
}
