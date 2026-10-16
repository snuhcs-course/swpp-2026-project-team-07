import {resolve as reviewResolve} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 if(specifier.endsWith('/presentations/store'))return {url:'data:text/javascript,export const useStore=f=>f({version:0});export const bump=()=>{};export const visibleDecks=()=>globalThis.initialDecks;export const getDeckState=id=>globalThis.initialDeckStates[id];',shortCircuit:true};
 return reviewResolve(specifier,context,nextResolve);
}
