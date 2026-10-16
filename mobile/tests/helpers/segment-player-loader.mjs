import { resolve as domainResolve, load } from './domain-loader.mjs';
export { load };
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'expo-audio' || specifier === 'react-native') return { url: new URL('./segment-player-native.mjs', import.meta.url).href, shortCircuit: true };
  return domainResolve(specifier, context, nextResolve);
}
