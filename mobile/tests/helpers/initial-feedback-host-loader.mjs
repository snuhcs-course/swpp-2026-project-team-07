import {resolve as base} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 if(specifier.endsWith('/presentations/store'))return {url:'data:text/javascript,export const useStore=f=>f({version:0});export const visibleDecks=()=>globalThis.hostDecks;export const getDeckState=id=>globalThis.hostStates[id];',shortCircuit:true};
 if(specifier.endsWith('/presentations/requirementsStore'))return {url:'data:text/javascript,export const getRequirementsVersion=()=>0;export const subscribeRequirements=()=>()=>{};export const readRequirements=()=>({contextId:null,deckId:null,revision:0});',shortCircuit:true};
 if(specifier.endsWith('/transcription/reviewStorage'))return {url:'data:text/javascript,export const readReview=(_api,id)=>globalThis.hostReviews[id];',shortCircuit:true};
 if(specifier==='./useSlideReview')return {url:'data:text/javascript,export const useSlideReview=(...args)=>{globalThis.hostCalls.push(args);return {};};',shortCircuit:true};
 return base(specifier,context,nextResolve);
}
