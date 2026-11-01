// OpenAI Codex, 2026-11-02: real capture/take lifecycle boundaries; see docs/ai-collaboration-prompts-iteration-2.md.
import { resolve as screenResolve } from './recording-cues-runtime-loader.mjs';
export { load } from './domain-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  const source = { '/CaptureEngine': 'tsx', '/takes': 'ts', '/recording/storage': 'ts' };
  for (const [suffix, extension] of Object.entries(source)) {
    if (specifier.endsWith(suffix)) return { url: new URL(`${specifier}.${extension}`, context.parentURL).href, shortCircuit: true };
  }
  if (specifier === 'expo-audio') return { url: new URL('./recording-screen-audio.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.endsWith('/useSlideProfiles')) return {
    url: 'data:text/javascript,export const useSlideProfiles=()=>({value:null,busy:false,error:"",refresh(){},recover:async()=>{}});', shortCircuit: true,
  };
  return screenResolve(specifier, context, nextResolve);
}
