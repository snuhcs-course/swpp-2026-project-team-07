// Keep native audio outside Node while importing the real recording service.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'expo-audio') {
    return { url: new URL('./expo-audio-stub.mjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
