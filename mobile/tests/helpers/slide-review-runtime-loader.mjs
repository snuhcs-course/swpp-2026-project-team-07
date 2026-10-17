import {resolve as reviewResolve} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
const store = new URL('./slide-review-runtime-store.mjs',import.meta.url).href;
export function resolve(specifier,context,nextResolve){
 if(specifier.endsWith('/presentations/store') || specifier==='./store' && /correctionStore/.test(context.parentURL??''))return {url:store,shortCircuit:true};
 return reviewResolve(specifier,context,nextResolve);
}
