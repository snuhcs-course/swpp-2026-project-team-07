import { resolve as screenResolve } from './recording-screen-loader.mjs';
export { load } from './recording-screen-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (['expo-file-system', 'expo/fetch'].includes(specifier)) return { url: new URL('./upload-native.mjs', import.meta.url).href, shortCircuit: true };
  return screenResolve(specifier, context, nextResolve);
}
