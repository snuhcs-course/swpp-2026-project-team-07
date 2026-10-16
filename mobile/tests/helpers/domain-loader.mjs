// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: loads the pure TypeScript domain modules in Node tests.
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
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
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
  }
  return nextLoad(url, context);
}
