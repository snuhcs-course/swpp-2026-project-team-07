import {resolve as reviewResolve} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 // Claude Code, prompted by Seoyeon (2026-11-15): v2 host tests model a server without feedback v3.
 if(/\/feedbackRunClient$/.test(specifier))return {url:new URL('./feedback-v3-off.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('/presentations/store'))return {url:'data:text/javascript,export const useStore=f=>f({version:0});export const bump=()=>{};export const visibleDecks=()=>globalThis.initialDecks;export const getDeckState=id=>globalThis.initialDeckStates[id];',shortCircuit:true};
 return reviewResolve(specifier,context,nextResolve);
}
