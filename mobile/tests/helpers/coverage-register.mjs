// AI-generated with OpenAI Codex, 2026-10-22.
// Attribution: docs/ai-collaboration/prompt-logs/injoon/iteration-2.md#record-142
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpile } from './transpile.mjs';

// Keep the test-specific native mocks; map native Node TypeScript imports too.
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
      return { format: 'module', shortCircuit: true, source: transpile(readFileSync(new URL(url), 'utf8'), url) };
    }
    return nextLoad(url, context);
  },
});
