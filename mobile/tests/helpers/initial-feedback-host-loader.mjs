import {resolve as base} from './slide-review-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 // Claude Code, prompted by Seoyeon (2026-11-15): v2 host tests model a server without feedback v3.
 if(/\/feedbackRunClient$/.test(specifier))return {url:new URL('./feedback-v3-off.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('/presentations/requirementsDraft'))return {url:'data:text/javascript,export const requirementsPending=id=>globalThis.pendingRequirementDecks?.includes(id)??false;',shortCircuit:true};
 if(specifier.endsWith('/presentations/defaultRequirements'))return {url:'data:text/javascript,export const defaultRequirementsPending=id=>globalThis.pendingDefaultDecks?.includes(id)??false;',shortCircuit:true};
 if(specifier.endsWith('/presentations/store'))return {url:'data:text/javascript,export const useStore=f=>f({version:0});export const bump=()=>{};export const visibleDecks=()=>globalThis.hostDecks;export const getDeckState=id=>globalThis.hostStates[id];',shortCircuit:true};
 if(specifier.endsWith('/presentations/requirementsStore'))return {url:'data:text/javascript,export const getRequirementsVersion=()=>0;export const subscribeRequirements=()=>()=>{};export const readRequirements=()=>({contextId:null,deckId:null,revision:0});',shortCircuit:true};
 if(specifier.endsWith('/transcription/reviewStorage'))return {url:'data:text/javascript,export const readReview=(_api,id)=>globalThis.hostReviews[id];',shortCircuit:true};
 if(specifier==='./useSlideReview')return {url:'data:text/javascript,export const useSlideReview=(...args)=>{globalThis.hostCalls.push(args);return {};};',shortCircuit:true};
 return base(specifier,context,nextResolve);
}
