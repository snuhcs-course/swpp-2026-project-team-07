import { resolve as baseResolve } from './recording-cues-runtime-loader.mjs';
export { load } from './domain-loader.mjs';
const native = new URL('./incremental-screen-native.mjs', import.meta.url).href;
export function resolve(specifier, context, next) {
  if (specifier.endsWith('recording-cues-runtime-native.mjs')) return next(specifier, context);
  if (['expo-screen-orientation', 'expo-status-bar', 'react-native-safe-area-context'].includes(specifier) ||
      /\/(theme|incremental|LiveFeedbackPanel|CueGuidancePanel|useSlideProfiles|slideProfiles|defaultRequirements|requirementsDraft|requirementsStore)$/.test(specifier) ||
      specifier === './PresentationSetup') return { url: native, shortCircuit: true };
  const result = baseResolve(specifier, context, next);
  return result.url === new URL('./recording-cues-runtime-native.mjs', import.meta.url).href
    ? { url: native, shortCircuit: true } : result;
}
