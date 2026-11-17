// OpenAI Codex, 2026-11-02: native asset test boundaries; see docs/ai-collaboration/README.md#prompt-logs.
import { readFileSync } from 'node:fs';
import { transpile } from './transpile.mjs';
import { resolve as pdfResolve } from './pdf-native-loader.mjs';
import { load as domainLoad } from './domain-loader.mjs';
export function resolve(specifier, context, nextResolve) {
  if (['expo-asset', 'react-native-pdf-thumbnail'].includes(specifier)) return {
    url: new URL('./bundled-demo-native.mjs', import.meta.url).href, shortCircuit: true,
  };
  return pdfResolve(specifier, context, nextResolve);
}
export function load(url, context, nextLoad) {
  if (url.endsWith('/assets/demo/Seoul-text.json')) return {
    format: 'module', shortCircuit: true, source: `export default ${readFileSync(new URL(url), 'utf8')};`,
  };
  if (url.endsWith('/presentations/bundledDemo.ts')) return {
    format: 'module', shortCircuit: true, source: transpile(
      readFileSync(new URL(url), 'utf8').replace("require('../../../assets/demo/Seoul.pdf')", '1'),
      url,
    ),
  };
  return domainLoad(url, context, nextLoad);
}
