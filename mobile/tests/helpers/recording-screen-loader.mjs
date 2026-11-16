// Coverage source maps updated with OpenAI Codex, 2026-10-22; see the coverage setup entry in the Iteration 2 prompt log.
import { resolve as storageResolve } from "./storage-native-loader.mjs";
import { readFileSync, existsSync } from 'node:fs';
import { transpile } from './transpile.mjs';
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native-pdf') return { url: new URL('./recording-screen-pdf.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'expo-audio') return { url: new URL('./recording-screen-audio.mjs', import.meta.url).href, shortCircuit: true };
  if (['react-native', 'expo-router', 'expo-router/react-navigation'].includes(specifier) || specifier.endsWith('/ui/components') || specifier.endsWith('/SlidePreview')) {
    return { url: new URL('./recording-screen-ui.mjs', import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith('.') && context.parentURL) {
    for (const extension of ['', '.ts', '.tsx']) {
      const url = new URL(specifier + extension, context.parentURL);
      if (/\.tsx?$/.test(url.pathname) && existsSync(url)) return { url: url.href, shortCircuit: true };
    }
  }
  return storageResolve(specifier, context, nextResolve);
}
export function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
    return { format: 'module', shortCircuit: true, source: transpile(readFileSync(new URL(url), 'utf8'), url) };
  }
  return nextLoad(url, context);
}
