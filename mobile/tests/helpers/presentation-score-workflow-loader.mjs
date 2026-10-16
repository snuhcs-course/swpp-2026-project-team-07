import {resolve as baseResolve} from './correction-store-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 if(['react-native','expo-router'].includes(specifier))return {url:new URL('./recording-screen-ui.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('/presentations/store') || specifier==='./store' && /correctionStore/.test(context.parentURL??''))return {url:new URL('./slide-review-runtime-store.mjs',import.meta.url).href,shortCircuit:true};
 return baseResolve(specifier,context,nextResolve);
}
