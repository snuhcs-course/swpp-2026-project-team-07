export function resolve(specifier, context, nextResolve) {
  const files = {
    'expo-document-picker': './pdf-picker-stub.mjs',
    'expo-file-system/legacy': './pdf-node-storage.mjs',
  };
  if (files[specifier]) return {
    url: new URL(files[specifier], import.meta.url).href, shortCircuit: true,
  };
  return nextResolve(specifier, context);
}
