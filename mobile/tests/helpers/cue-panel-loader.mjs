import {resolve as storageResolve} from './storage-native-loader.mjs';
export {load} from './recording-screen-loader.mjs';
export function resolve(specifier,context,nextResolve) {
  if(['react-native','react-native-reanimated'].includes(specifier)) return {url:new URL('./cue-panel-native.mjs',import.meta.url).href,shortCircuit:true};
  if(specifier.endsWith('/CueGuidancePanel')) return {url:new URL('../../src/features/presentations/CueGuidancePanel.tsx',import.meta.url).href,shortCircuit:true};
  return storageResolve(specifier,context,nextResolve);
}
