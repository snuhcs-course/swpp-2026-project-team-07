// OpenAI Codex Review and Full review: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/domain-loader.mjs';
registerHooks({ resolve, load });

const { GRADE_ORDER, slideGrade, feedbackRows } = await import('../src/domain/analysis.ts');
const { runPosition } = await import('../src/domain/run.ts');
const { buildLines, buildVocabulary } = await import('../src/domain/lines.ts');

const ctx = (overrides = {}) => ({
  times: [100], targets: [100], lines: [], points: [[]], ai: [], haveText: true, pending: false, ...overrides,
});
const line = (text, extra = {}) => ({ slide: 0, t: 0, edge: 0, text, ...extra });
const suggestion = (extra = {}) => ({ slide: 0, category: 'clarity', observation: 'Speak more clearly', suggestion: 'Slow down', ...extra });

test('slideGrade handles unreached, clean and pending slides', () => {
  assert.deepEqual(slideGrade(0, ctx({ times: [0] })), { key: 'none', percent: null });
  assert.deepEqual(slideGrade(0, ctx({ pending: true })), { key: 'pending', percent: null });
  assert.deepEqual(slideGrade(0, ctx()), { key: 'green', percent: 100 });
  assert.deepEqual(GRADE_ORDER, ['green', 'yellow', 'orange', 'red']);
});

test('slideGrade caps timing at 40 and fillers at 24', () => {
  assert.equal(slideGrade(0, ctx({ times: [300] })).percent, 60);
  assert.equal(slideGrade(0, ctx({ lines: [line('um um um um um')] })).percent, 76);
});

test('slideGrade subtracts eight for each note as well as point coverage', () => {
  assert.equal(slideGrade(0, ctx({ points: [['Limited access to external feedback']] })).percent, 62);
  assert.equal(slideGrade(0, ctx({ lines: [line('Hello', { edge: 1 })] })).percent, 92);
  assert.equal(slideGrade(0, ctx({ ai: [suggestion()] })).percent, 92);
  assert.equal(slideGrade(0, ctx({ ai: [suggestion(), suggestion({ category: 'audience' })] })).percent, 84);
});

test('slideGrade uses the 85, 70 and 55 boundaries', () => {
  assert.equal(slideGrade(0, ctx({ times: [125] })).key, 'green');
  assert.equal(slideGrade(0, ctx({ times: [150] })).key, 'yellow');
  assert.equal(slideGrade(0, ctx({ times: [165], lines: [line('um')] })).key, 'orange');
  assert.equal(slideGrade(0, ctx({ times: [166], lines: [line('um')] })).key, 'red');
});

test('feedbackRows always has four fixed slots with clean Spot On text', () => {
  const rows = feedbackRows(0, ctx());
  assert.deepEqual(rows.map(r => r.icon), ['i-clock', 'i-bubble', 'i-flag', 'i-wave']);
  assert.deepEqual(rows.map(r => r.text), ['Spot On!', 'Spot On!', 'Spot On!', 'Spot On!']);
});

test('feedbackRows handles unreached, pending and absent slide text', () => {
  assert.deepEqual(feedbackRows(0, ctx({ times: [0] })).map(r => r.text),
    ['Not reached in this run', '—', '—', '—']);
  assert.deepEqual(feedbackRows(0, ctx({ pending: true, worker: { stage: 'processing', detail: 'Matching words' } })).map(r => r.text),
    ['Spot On!', 'Matching words…', '—', '—']);
  assert.equal(feedbackRows(0, ctx({ pending: true }))[1].text, 'Transcript pending');
  assert.equal(feedbackRows(0, ctx({ haveText: false }))[2].text, 'No slide text to check');
});

test('feedbackRows puts an audience AI suggestion in delivery, never filler', () => {
  const rows = feedbackRows(0, ctx({ lines: [line('basically basically basically')],
    ai: [suggestion({ category: 'audience', observation: 'Address the audience directly' })] }));
  assert.equal(rows[1].icon, 'i-bubble');
  assert.equal(rows[1].text, '“basically” 3 times on this slide');
  assert.equal(rows[3].icon, 'i-wave');
  assert.equal(rows[3].text, 'Address the audience directly');
});

test('runPosition maps concatenated audio to true slide starts, including a missing middle recording', () => {
  const all = [
    { slide: 0, runStart: 0, durMs: 30000 },
    { slide: 1, runStart: 30, durMs: 40000 },
    { slide: 2, runStart: 70, durMs: 20000 },
  ];
  assert.equal(runPosition(35000, all), 35);
  assert.equal(runPosition(70000, all), 70);
  assert.equal(runPosition(90000, all), 90);
  const missingMiddle = [all[0], all[2]];
  assert.equal(runPosition(35000, missingMiddle), 75);
  assert.equal(runPosition(50000, missingMiddle), 90);
});

test('real merged-run lines mark a sentence crossing adjacent slide recordings', () => {
  const transcript = { text: 'We explain the point across slides', words: [
    { text: 'We', start_ms: 0, end_ms: 200 },
    { text: 'explain', start_ms: 250, end_ms: 600 },
    { text: 'the', start_ms: 700, end_ms: 900 },
    { text: 'point', start_ms: 1100, end_ms: 1400 },
    { text: 'across', start_ms: 1450, end_ms: 1750 },
    { text: 'slides', start_ms: 1800, end_ms: 2200 },
  ] };
  const run = { parts: [
    { attemptId: 'a', segments: [{ startMs: 0, endMs: 1000 }] },
    { attemptId: 'a', segments: [{ startMs: 1000, endMs: 2300 }] },
  ] };
  const lines = buildLines(run, 2, new Map([['a', transcript]]), {}, buildVocabulary(['', '']));
  assert.deepEqual(lines.map(l => l.edge), [1, -1]);
  assert.equal(feedbackRows(0, ctx({ times: [1, 1], targets: [1, 1], lines, points: [[], []] }))[3].text,
    'Moved to slide 2 mid-sentence');
});
