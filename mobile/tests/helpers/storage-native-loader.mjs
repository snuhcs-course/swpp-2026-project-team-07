import { existsSync } from 'node:fs';
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'expo-sqlite') return { url: new URL('./sqlite-node.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'expo-crypto') return { url: 'node:crypto', shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(url)) return { url: url.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
