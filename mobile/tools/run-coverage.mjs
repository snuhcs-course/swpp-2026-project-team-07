// AI-generated with OpenAI Codex, 2026-10-22.
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#coverage-setup-and-first-measurement--october-22-2026
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobile = fileURLToPath(new URL('../', import.meta.url));
// Restart/persistence tests spawn Node children. They must emit the same maps.
const options = [process.env.NODE_OPTIONS, '--enable-source-maps', '--import=' + new URL('../tests/helpers/coverage-register.mjs', import.meta.url).href].filter(Boolean).join(' ');
const files = readdirSync(new URL('../tests/', import.meta.url)).filter(name => name.endsWith('.test.mjs')).sort().map(name => 'tests/' + name);
const run = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/c8/bin/c8.js', import.meta.url)), process.execPath, '--test', ...files], {
  cwd: mobile, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: options },
});
const report = spawnSync('python3', ['../tools/coverage_report.py', 'mobile', '--check'], { cwd: mobile, stdio: 'inherit' });
process.exitCode = run.status === 0 && report.status === 0 ? 0 : 1;
