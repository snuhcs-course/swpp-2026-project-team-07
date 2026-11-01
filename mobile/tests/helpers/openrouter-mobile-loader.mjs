// Native boundaries only; the provider parser, storage and coaching UI run unchanged.
import { resolve as base, load } from './cue-panel-loader.mjs';
export { load };
export function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/rehearsal/coaching.tsx')) {
    if (specifier.endsWith('/feedback/useFeedbackReview')) return { url: 'data:text/javascript,export const useFeedbackReview=()=>globalThis.openrouterFeedback;', shortCircuit: true };
    if (specifier.endsWith('/transcription/reviewStorage')) return { url: 'data:text/javascript,export const readReview=()=>globalThis.openrouterReview;', shortCircuit: true };
    if (specifier.endsWith('/presentations/store')) return { url: 'data:text/javascript,export const useStore=f=>f({version:0});export const bump=()=>{};', shortCircuit: true };
  }
  return base(specifier, context, nextResolve);
}
