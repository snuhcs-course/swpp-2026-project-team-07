// Coverage source maps updated with OpenAI Codex, 2026-10-22; see the coverage setup entry in the Iteration 2 prompt log.
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: loads the pure TypeScript domain modules in Node tests.
import { readFileSync, existsSync } from 'node:fs';
import { transpile } from './transpile.mjs';
export function resolve(specifier, context, nextResolve) {
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
    return { format: 'module', shortCircuit: true, source: transpile(readFileSync(new URL(url), 'utf8'), url) };
  }
  return nextLoad(url, context);
}
