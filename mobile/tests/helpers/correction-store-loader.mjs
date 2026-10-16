import { resolve as storageResolve } from './storage-native-loader.mjs';
export { load } from './domain-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (specifier === './store' && /\/(correctionStore|transcriptSuggestions|legacyCorrections)\.tsx?$/.test(context.parentURL ?? '')) {
    return { url: 'data:text/javascript,export function bump() {} export const visibleDecks=()=>[]; export const getDeckState=()=>({});', shortCircuit: true };
  }
  if (specifier === 'expo/fetch') return { url: 'data:text/javascript,export const fetch=(...args)=>globalThis.fetch(...args);', shortCircuit: true };
  if (specifier === 'expo-file-system') return { url: 'data:text/javascript,export class File {}', shortCircuit: true };
  return storageResolve(specifier, context, nextResolve);
}
