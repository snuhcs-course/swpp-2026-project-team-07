import { resolve as storageResolve } from './storage-native-loader.mjs';
export { load } from './domain-loader.mjs';
const stub = code => ({ url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true });
export function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('/modules/outloud-recorder')) return stub('export const continuousRecorder={available:()=>!!globalThis.captureRecorder,status:()=>globalThis.captureRecorder.status(),recover:(uri)=>globalThis.captureRecorder.recover(uri)};');
  if (specifier === 'expo-file-system') return stub('export class File extends Blob {constructor(uri){super([new Uint8Array(100)]);this.uri=uri;this.exists=true;}}');
  if (specifier.endsWith('/services/backendFetch')) return stub('export const backendExpoFetch=(...a)=>globalThis.captureFetch(...a);');
  if (specifier.endsWith('/presentations/store')) return stub('export function bump(){}');
  if (specifier.endsWith('/presentations/serverDeck')) return stub('export async function serverSlides(){return {deckId:"deck"}}');
  if (specifier.endsWith('/presentations/defaultRequirements')) return stub('export async function synchronizePresentationDefaults(){};export function defaultRequirementsPending(){return false}');
  if (specifier.endsWith('/presentations/requirementsDraft')) return stub('export function requirementsPending(){return false}');
  if (specifier.endsWith('/presentations/requirementsStore')) return stub('export function readRequirements(){return {deckId:"deck",contextId:null}}');
  if (specifier.endsWith('/feedback/feedbackRunClient')) return stub('export function receiveFeedbackRun(...args){globalThis.captureFeedbackReceived?.(...args)}');
  if (specifier.endsWith('/transcription/service')) return stub('export function transcriptionClientFor(){return {getReview:async()=>({attempt_id:"take"})}}');
  if (specifier.endsWith('/transcription/reviewStorage')) return stub('export function saveReview(){}');
  return storageResolve(specifier, context, nextResolve);
}
