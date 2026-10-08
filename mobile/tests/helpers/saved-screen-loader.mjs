import { resolve as screenResolve } from './recording-screen-loader.mjs';
export { load } from './recording-screen-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (['expo-file-system', 'expo/fetch'].includes(specifier)) return { url: new URL('./upload-native.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'expo-document-picker') return { url: new URL('./pdf-picker-stub.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'expo-file-system/legacy') return { url: new URL('./pdf-node-storage.mjs', import.meta.url).href, shortCircuit: true };
  return screenResolve(specifier, context, nextResolve);
}
