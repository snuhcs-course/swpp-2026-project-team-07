// OpenAI Codex: B09 real screen/capture/take flow; synthetic native boundaries.
import { resolve as runtimeResolve } from './recording-cues-runtime-loader.mjs';
export { load } from './domain-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'expo-audio') return { url: new URL('./recording-screen-audio.mjs', import.meta.url).href, shortCircuit: true };
  if (/\/(CaptureEngine|takes)$/.test(specifier) || specifier.endsWith('/recording/storage')) {
    return { url: new URL(specifier + (specifier.endsWith('CaptureEngine') ? '.tsx' : '.ts'), context.parentURL).href, shortCircuit: true };
  }
  if (specifier.endsWith('/presentations/store')) return { url: new URL('./retry-recording-store.mjs', import.meta.url).href, shortCircuit: true };
  return runtimeResolve(specifier, context, nextResolve);
}
