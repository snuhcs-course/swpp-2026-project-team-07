import { resolve as storageResolve } from './storage-native-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (['expo-file-system', 'expo/fetch'].includes(specifier)) return { url: new URL('./upload-native.mjs', import.meta.url).href, shortCircuit: true };
  return storageResolve(specifier, context, nextResolve);
}
