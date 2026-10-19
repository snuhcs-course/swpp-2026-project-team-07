import {resolve as baseResolve,load} from './recording-screen-loader.mjs';
export {load};
export function resolve(specifier,context,nextResolve) {
  if(['react-native','react-native-reanimated','react-native-svg'].includes(specifier)) return {url:new URL('./cue-panel-native.mjs',import.meta.url).href,shortCircuit:true};
  return baseResolve(specifier,context,nextResolve);
}
