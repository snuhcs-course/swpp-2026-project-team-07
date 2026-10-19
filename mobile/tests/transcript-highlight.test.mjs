import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/domain-loader.mjs';
registerHooks({ resolve, load });
const lines = await import('../src/domain/lines.ts');
const words = [{ text: 'We', start_ms: 100, end_ms: 300 }, { text: 'use', start_ms: 400, end_ms: 600 }, { text: 'out', start_ms: 700, end_ms: 900 }, { text: 'loud', start_ms: 1000, end_ms: 1200 }];
const line = { text: 'We use out loud.', words, flags: [{ w: 'out loud', alts: ['OutLoud'] }] };
test('native audio time highlights one word and preserves multiword correction controls and punctuation', () => {
  const pieces = lines.playbackPieces(line, 800);
  assert.equal(pieces.map(p => p.t).join(''), line.text);
  assert.deepEqual(pieces.filter(p => p.active).map(p => p.t), ['out']);
  assert.equal(pieces.filter(p => p.fi === 0).map(p => p.t).join(''), 'out loud');
});
test('silence, stop and exact word end do not highlight an unrelated word', () => {
  for (const pos of [null, 50, 300, 650, 1200]) assert.equal(lines.playbackPieces(line, pos).some(p => p.active), false);
  assert.deepEqual(lines.playbackPieces(line, 1000).filter(p => p.active).map(p => p.t), ['loud']);
});
test('corrected text that no longer maps to timed words stays readable without invented highlighting', () => {
  const edited = { ...line, text: 'We use ChatGPT.' };
  const pieces = lines.playbackPieces(edited, 800);
  assert.equal(pieces.map(p => p.t).join(''), edited.text);
  assert.equal(pieces.some(p => p.active), false);
});

test('an ignored full-sentence edit does not disable highlighting on a clipped slide visit', () => {
  const source = { text: 'hello world', words: [{ text: 'hello', start_ms: 0, end_ms: 500 }, { text: 'world', start_ms: 1000, end_ms: 1500 }] };
  const run = { parts: [{ attemptId: 'a', segments: [{ startMs: 0, endMs: 1000 }] }, { attemptId: 'a', segments: [{ startMs: 1000, endMs: 2000 }] }] };
  const built = lines.buildLines(run, 2, new Map([['a', source]]), { 'a#0': { text: 'Old full-sentence correction' } }, lines.buildVocabulary(['', '']));
  assert.equal(built[0].text, 'Hello');
  assert.deepEqual(lines.playbackPieces(built[0], 250).filter(p => p.active).map(p => p.t), ['Hello']);
});
