// Feedback v3 client tests: Node SQLite storage, counted store bumps, plain fetch.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
import { resolve as storageResolve } from './storage-native-loader.mjs';
export { load } from './domain-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('/presentations/store') && /\/feedbackRunClient\.tsx?$/.test(context.parentURL ?? ''))
    return { url: 'data:text/javascript,export function bump(){globalThis.feedbackRunBumps=(globalThis.feedbackRunBumps??0)+1;}', shortCircuit: true };
  if (specifier.endsWith('/services/backendFetch'))
    return { url: 'data:text/javascript,export const backendFetch=(...args)=>globalThis.fetch(...args);', shortCircuit: true };
  return storageResolve(specifier, context, nextResolve);
}
