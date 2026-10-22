// AI-generated with OpenAI Codex, 2026-10-22.
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#coverage-setup-and-first-measurement--october-22-2026
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobile = fileURLToPath(new URL('../', import.meta.url));
const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'outloud-coverage-validation-')));
try {
  writeFileSync(join(fixture, 'choose.ts'), 'export type Flag = boolean | null;\n\nexport function choose(flag: Flag) {\n if (flag) {\n  return "yes";\n }\n if (flag === null) return "missing"; return "no";\n}\nexport function untouched() {\n return "unused";\n}\n');
  writeFileSync(join(fixture, 'never.ts'), 'export function never() {\n return "never";\n}\n');
  writeFileSync(join(fixture, 'fixture.test.mjs'), 'import {choose} from "./choose.ts"; import assert from "node:assert/strict"; import {execFileSync} from "node:child_process"; assert.equal(choose(true), "yes"); execFileSync(process.execPath,["--input-type=module","-e",\'import {choose} from "./choose.ts"; if(choose(false)!=="no")process.exit(1);\']);');
  writeFileSync(join(fixture, '.c8rc.json'), JSON.stringify({ all: true, src: ['.'], include: ['*.ts'], extension: ['.ts'], reporter: ['json', 'json-summary'] }));
  const options = [process.env.NODE_OPTIONS, '--enable-source-maps', '--import=' + new URL('../tests/helpers/coverage-register.mjs', import.meta.url).href].filter(Boolean).join(' ');
  const run = spawnSync(process.execPath, [resolve(mobile, 'node_modules/c8/bin/c8.js'), process.execPath, '--test', 'fixture.test.mjs'], { cwd: fixture, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: options } });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const summary = JSON.parse(readFileSync(join(fixture, 'coverage/coverage-summary.json')));
  const detail = JSON.parse(readFileSync(join(fixture, 'coverage/coverage-final.json')));
  const chosen = detail[join(fixture, 'choose.ts')];
  assert.ok(chosen, 'Coverage must map to the original TypeScript path: '+JSON.stringify(Object.keys(detail)));
  const covered = line => Object.entries(chosen.statementMap).some(([id, entry]) => entry.start.line === line && chosen.s[id] > 0);
  assert.equal(covered(5), true, 'Executed return must map to TypeScript line 5');
  assert.equal(covered(7), true, 'Child execution must map to TypeScript line 7');
  assert.equal(covered(10), false, 'Uncalled function must stay uncovered at TypeScript line 10');
  assert.ok(Object.values(chosen.b).flat().some(count => count === 0), 'Unexecuted branches must remain uncovered');
  assert.equal(summary[join(fixture, 'never.ts')].lines.pct, 0, 'Never-imported source must appear at zero');
  const raw = readdirSync(join(fixture, 'coverage/tmp')).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(fixture, 'coverage/tmp', name))));
  const scripts = raw.flatMap(report => report.result.filter(script => script.url.endsWith('/choose.ts')).map(script => ({ script, map: report['source-map-cache']?.[script.url] })));
  assert.ok(scripts.length >= 2 && scripts.every(entry => entry.map), 'Parent and child must both record source maps');
  assert.equal(new Set(scripts.map(entry => entry.script.functions[0].ranges[0].endOffset)).size, 1, 'Parent and child must use identical generated offsets');
  console.log('Coverage collector validation passed: parent/child TypeScript maps, missed branch, never-imported file.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
