import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'expo-audio') return { url: new URL('./recording-screen-audio.mjs', import.meta.url).href, shortCircuit: true };
  if (['react-native', 'expo-router'].includes(specifier) || specifier.endsWith('/ui/components') || specifier.endsWith('/pdf/SlidePreview')) {
    return { url: new URL('./recording-screen-ui.mjs', import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith('.') && context.parentURL) {
    for (const extension of ['', '.ts', '.tsx']) {
      const url = new URL(specifier + extension, context.parentURL);
      if (/\.tsx?$/.test(url.pathname) && existsSync(url)) return { url: url.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
export function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
  }
  return nextLoad(url, context);
}
