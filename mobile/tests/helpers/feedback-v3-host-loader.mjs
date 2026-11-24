// FeedbackV3Host tests: in-memory decks, reviews, settings, eligibility and a recording fake client.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
export { load } from './domain-loader.mjs';
import { resolve as domainResolve } from './domain-loader.mjs';
const data = body => ({ url: 'data:text/javascript,' + encodeURIComponent(body), shortCircuit: true });
export function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('/recording/incrementalState')) return {url:'data:text/javascript,export const isIncrementalAttempt=()=>false;export const readCapture=()=>null;export const captureVersion=()=>0;export const subscribeCaptures=()=>()=>{};export const captureFeedback=(_item,run)=>run;',shortCircuit:true};
  const h = 'globalThis.v3Host';
  if (specifier === 'react-native') return data(`export const AppState={currentState:'active',addEventListener:()=>({remove(){}})};`);
  if (specifier === './useRunPresentationScores') return data(`export const useRunPresentationScores=()=>({items:[],overall:null});`);
  if (specifier.endsWith('/services/api')) return data(`export const API_URL='http://host.invalid/api';`);
  if (specifier.endsWith('/presentations/store')) return data(`export const useStore=f=>f({version:0});export const visibleDecks=()=>${h}.decks;export const getDeckState=id=>${h}.states[id];`);
  if (specifier.endsWith('/presentations/requirementsStore')) return data(`export const getRequirementsVersion=()=>0;export const subscribeRequirements=()=>()=>{};export const readRequirements=id=>({deckId:'server-deck',contextId:'ctx'});`);
  if (specifier.endsWith('/presentations/correctionStore')) return data(`export const readCorrections=(_api,id)=>${h}.corrections?.[id]??null;`);
  if (specifier.endsWith('/presentations/requirementsDraft')) return data(`export const requirementsPending=id=>${h}.pending.includes(id);export const requirementsDirty=requirementsPending;`);
  if (specifier.endsWith('/presentations/defaultRequirements')) return data(`export const defaultRequirementsPending=()=>false;`);
  if (specifier.endsWith('/transcription/analysisStorage')) return data(`export const normalizeApi=a=>a.replace(/\\/+$/,'');`);
  if (specifier.endsWith('/transcription/reviewStorage')) return data(`export const readReview=(_api,id)=>${h}.reviews[id]??null;`);
  if (specifier === './automaticFeedback') return data(`export const automaticFeedbackV3Enabled=(_api,id)=>${h}.eligible.includes(id);`);
  if (specifier === './feedbackRunClient') return data(`
    export const feedbackV3Capability=()=>${h}.capability;
    export const feedbackV3CapabilityChecked=()=>${h}.checked;
    export const readSavedRun=(_api,id)=>${h}.runs?.[id]??null;
    export const readSelectedFeedback=()=>${h}.selectedRun??null;
    export const checkSelectedFeedback=async(_api,selection,action)=>{ ${h}.selectedCalls?.push({selection,action}); return 'available'; };
    export const readStartState=(_api,id)=>${h}.starts[id]??null;
    export const writeStartState=(_api,id,state)=>{${h}.starts[id]={state,at:0};};
    export const fetchFeedbackRun=async(_api,id)=>{${h}.calls.push(['GET',id]);const r=await ${h}.get(id);if(r){${h}.checked=true;${h}.capability=r.enabled;}return r;};
    export const startFeedbackRun=async(_api,id)=>{${h}.calls.push(['POST',id]);return ${h}.post(id);};`);
  return domainResolve(specifier, context, nextResolve);
}
