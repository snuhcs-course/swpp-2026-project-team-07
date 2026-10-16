import { resolve as baseResolve } from './transcript-corrections-controller-loader.mjs';
import { resolve as domainResolve, load } from './domain-loader.mjs';
export { load };
export function resolve(specifier, context, nextResolve) {
 if (specifier === 'expo-audio') return { url: new URL('./take-evidence-native.mjs', import.meta.url).href, shortCircuit: true };
 if (specifier.endsWith('/rehearsal/useSegmentPlayer')) return domainResolve(specifier, context, nextResolve);
 return baseResolve(specifier, context, nextResolve);
}
