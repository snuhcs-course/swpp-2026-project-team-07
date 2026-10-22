// AI-generated with OpenAI Codex, 2026-10-22.
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#coverage-setup-and-first-measurement--october-22-2026
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function transpile(source, url) {
  return ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      inlineSourceMap: true,
      inlineSources: true,
    },
  }).outputText;
}
