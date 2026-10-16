// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: rules from the design spec (SPEC §5) on real data shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/domain-loader.mjs';
registerHooks({ resolve, load });

const { fmt, nearestSlot, quote } = await import('../src/domain/format.ts');
const { pickHue } = await import('../src/domain/hues.ts');
const { fillerCounts, fillerTotal, covers, keyWords, wordCount } = await import('../src/domain/words.ts');
const { parseSlideText, slideTargets, defaultTarget } = await import('../src/domain/slides.ts');
const { mergeTake, takeVisits, runTimes, runLabel } = await import('../src/domain/run.ts');
const { sentences, buildLines, buildVocabulary, misheard, splitFlags } = await import('../src/domain/lines.ts');
const { reviewInsights, findingsFor, paceChip, heroStats, compareRows, summarizeTake } = await import('../src/domain/analysis.ts');
const { decideRelease, coverFlow } = await import('../src/domain/gestures.ts');

test('formatting and hues follow the design', () => {
  assert.equal(fmt(767), '12:47');
  assert.equal(fmt(-3), '0:00');
  assert.equal(nearestSlot(9.2, 2, 5), 7);
  assert.equal(quote('a "b" c'), '“a ’b’ c”');
  assert.equal(pickHue([]), 'cyan');
  assert.equal(pickHue(['cyan', 'coral']), 'lime');
});

test('fillers are whole words, including Korean hesitation sounds', () => {
  assert.deepEqual(fillerCounts('Um, basically we, like, basically ship. Unlike others.'), { um: 1, basically: 2, like: 1 });
  assert.equal(fillerTotal('음 그러니까 어 이건 음'), 3);
  assert.equal(wordCount("It's 발표 준비, done"), 4);
});

test('coverage needs half of a point’s key words, on 5-letter stems', () => {
  assert.ok(covers('Feedback only arrives after the talk', 'Feedback arrives after the talk, not during practice'));
  assert.ok(!covers('We talk about the weather', 'Limited access to external feedback'));
  assert.deepEqual(keyWords('The slide-linked transcription 94%'), ['slide', 'linked', 'transcription', '94%']);
  assert.ok(covers('발표를 연습하면 피드백이 바로 나옵니다', '피드백 연습'));
});

test('slide text becomes a title and points; wrapped lines are joined', () => {
  const s = parseSlideText('Solution overview\n• Follows your slides as you\nspeak, no manual tagging\n• Every sentence is linked\n7', 6);
  assert.equal(s.title, 'Solution overview');
  assert.deepEqual(s.points, ['Follows your slides as you speak, no manual tagging', 'Every sentence is linked']);
  assert.equal(parseSlideText('', 3).title, 'Slide 4');
  const t = slideTargets(['a', 'Problem statement with several important words in it', ''], 180);
  assert.equal(t.reduce((a, b) => a + b, 0), 180);
  assert.ok(t[1] > t[0]);
  assert.equal(defaultTarget(18), 600);
  assert.equal(defaultTarget(3), 180);
});

const targets = [30, 30, 30, 30];
const ctx = (prev, extra = {}) => ({ n: 4, targets, deckTarget: 120, lastFullTotal: prev ? 120 : null, takeNo: 1, id: 'r', ...extra });

test('a first take on every slide is a full run', () => {
  const visits = takeVisits([{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 30000 }, { slide_index: 2, at_ms: 62000 }, { slide_index: 3, at_ms: 90000 }], 125000);
  const { run, compare } = mergeTake(null, { attemptId: 'a', visits, spoken: [true, true, true, true], whole: false, createdAt: new Date().toISOString() }, ctx(null));
  assert.deepEqual(runTimes(run, 4), [30, 32, 28, 35]);
  assert.equal(run.full, true);
  assert.equal(run.core, 'full run');
  assert.equal(run.targetSum, 120);
  assert.equal(compare, null);
  assert.equal(runLabel(run), 'Just now · full run');
});

test('redoing one slide keeps every other slide and offers a comparison', () => {
  const first = mergeTake(null, { attemptId: 'a', visits: takeVisits([0, 1, 2, 3].map(i => ({ slide_index: i, at_ms: i * 30000 })), 120000),
    spoken: [true, true, true, true], whole: false, createdAt: '2026-10-14T00:00:00Z' }, ctx(null)).run;
  // Start on slide 2, speak, swipe past slide 3 without speaking.
  const visits = takeVisits([{ slide_index: 1, at_ms: 0 }, { slide_index: 2, at_ms: 20000 }], 23000);
  const { run, redone, compare } = mergeTake(first, { attemptId: 'b', visits, spoken: [false, true, false, false], whole: false,
    createdAt: new Date().toISOString() }, ctx(first));
  assert.deepEqual(redone, [1]);
  assert.deepEqual(runTimes(run, 4), [30, 20, 30, 30]);
  assert.equal(run.parts[2].attemptId, 'a');
  assert.equal(run.core, 'slide 2 redone');
  assert.deepEqual(compare.slides, [1]);
  assert.equal(run.delta, -10);
});

test('a whole take replaces the run and compares every slide', () => {
  const first = mergeTake(null, { attemptId: 'a', visits: takeVisits([0, 1, 2, 3].map(i => ({ slide_index: i, at_ms: i * 30000 })), 120000),
    spoken: [true, true, true, true], whole: false, createdAt: '2026-10-14T00:00:00Z' }, ctx(null)).run;
  const visits = takeVisits([{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 25000 }], 50000);
  const { run, compare } = mergeTake(first, { attemptId: 'c', visits, spoken: [true, true, false, false], whole: true, createdAt: new Date().toISOString() }, ctx(first));
  assert.deepEqual(runTimes(run, 4), [25, 25, 0, 0]);
  assert.equal(run.core, 'new take · stopped at slide 2');
  assert.equal(compare.whole, true);
  assert.deepEqual(compare.slides, [0, 1, 2, 3]);
});

const transcript = {
  text: 'Hi everyone, I’m presenting out loud. It links every sentence to a slide. Next we look at the manual levels here',
  words: [
    ['Hi', 0, 300], ['everyone', 300, 800], ['I’m', 900, 1100], ['presenting', 1100, 1700], ['out', 1700, 1900], ['loud', 1900, 2300],
    ['It', 3000, 3200], ['links', 3200, 3600], ['every', 3600, 3900], ['sentence', 3900, 4400], ['to', 4400, 4500], ['a', 4500, 4600], ['slide', 4600, 5000],
    ['Next', 9000, 9300], ['we', 9300, 9400], ['look', 9400, 9700], ['at', 9700, 9800], ['the', 9800, 9900], ['manual', 9900, 10400], ['levels', 10400, 10900], ['here', 10900, 11200],
  ].map(([text, start_ms, end_ms]) => ({ text, start_ms, end_ms })),
};

test('sentences keep Whisper punctuation and become slide lines with audio ranges', () => {
  const s = sentences(transcript);
  assert.equal(s.length, 3);
  assert.equal(s[0].text, 'Hi everyone, I’m presenting out loud.');
  const run = mergeTake(null, { attemptId: 'a', visits: takeVisits([{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 8000 }], 12000),
    spoken: [true, true], whole: false, createdAt: new Date().toISOString() }, { ...ctx(null), n: 2, targets: [8, 4] }).run;
  const vocab = buildVocabulary(['OutLoud rehearsal coach', 'Evaluation against manual labels']);
  const lines = buildLines(run, 2, new Map([['a', transcript]]), {}, vocab);
  assert.deepEqual(lines.map(l => [l.slide, l.text]), [[0, 'Hi everyone, I’m presenting out loud.'], [0, 'It links every sentence to a slide.'], [1, 'Next we look at the manual levels here']]);
  assert.deepEqual(lines[0].flags, [{ w: 'out loud', alts: ['OutLoud'] }]);
  assert.deepEqual(lines[2].flags, [{ w: 'manual levels', alts: ['manual labels'] }]);
  assert.deepEqual(lines[1].audio, { attemptId: 'a', startMs: 3000, endMs: 5000 });
  assert.equal(lines[2].t, 8 + 1);
  // Corrections: replace text, dismiss a flag, move a line.
  const edited = buildLines(run, 2, new Map([['a', transcript]]), {
    [lines[0].key]: { text: 'Hi everyone, I’m presenting OutLoud.' },
    [lines[2].key]: { slide: 0, dismissed: ['manual levels'] },
  }, vocab);
  assert.equal(edited[0].fixed, true);
  assert.deepEqual(edited[0].flags, []);
  assert.equal(edited.filter(l => l.slide === 0).length, 3);
  assert.equal(edited.find(l => l.moved).from, 1);
  assert.deepEqual(splitFlags('presenting out loud.', [{ w: 'out loud', alts: [] }]).map(x => x.fi), [-1, 0, -1]);
  assert.deepEqual(misheard('We use outloud daily', vocab, 0), [{ w: 'outloud', alts: ['OutLoud'] }]);
});

test('review insights pick the slides holding the overage', () => {
  const ins = reviewInsights([30, 50, 30, 60], [30, 30, 30, 30], 170, 120);
  assert.equal(ins.tip, 'Trim slides 2 and 4 — they hold 0:50 of your 0:50 over. Reach slide 4 by 1:30; you got there at 1:50.');
  assert.equal(ins.best.label, 'Slides 1–3');
  assert.equal(ins.worst.label, 'Slides 2–4');
  assert.equal(reviewInsights([20, 20], [30, 30], 40, 60).tip, 'You finished 0:20 under. Slide 1 ran shortest — there’s room to expand it.');
});

test('findings react to fixes, pace chip matches the design', () => {
  const line = (slide, text, extra = {}) => ({ key: slide + text, slide, t: 0, rel: 0, text, flags: [], edge: 0, moved: false, from: null, fixed: false, audio: { attemptId: 'a', startMs: 0, endMs: 1 }, ...extra });
  const lines = [line(0, 'Um basically it is basically unstructured.'), line(0, 'More', { edge: 1 })];
  const rows = findingsFor(0, lines, ['Limited access to external feedback'], [], true);
  assert.deepEqual(rows.map(r => r.icon), ['i-bubble', 'i-flag', 'i-arrow']);
  assert.equal(rows[0].text, '“basically” 2 times on this slide');
  assert.deepEqual(findingsFor(0, [line(0, 'Most people have limited access to external feedback')], ['Limited access to external feedback'], [], true), []);
  assert.equal(paceChip(70, 1, 0, [30, 30, 30]).text, '0:10 behind');
  assert.equal(paceChip(10, 1, 0, [30, 30, 30]).text, '0:20 ahead');
  assert.equal(paceChip(45, 1, 0, [30, 30, 30]).text, 'On pace');
});

test('home stats and compare rows come from the merged transcript', () => {
  const run = mergeTake(null, { attemptId: 'a', visits: takeVisits([{ slide_index: 0, at_ms: 0 }], 60000), spoken: [true], whole: false, createdAt: new Date().toISOString() },
    { ...ctx(null), n: 1, targets: [60] }).run;
  const words = Array.from({ length: 140 }, (_, i) => i % 20 === 0 ? 'um' : 'word');
  const line = { key: 'k', slide: 0, t: 0, rel: 0, text: words.join(' ') + ' feedback arrives late', flags: [], edge: 0, moved: false, from: null, fixed: false, audio: { attemptId: 'a', startMs: 0, endMs: 1 } };
  const stats = heroStats(run, 1, [line], [['Feedback arrives too late', 'Nobody times slides']], true);
  assert.equal(stats.coverage, 50);
  assert.equal(stats.wpm, 143);
  assert.equal(stats.pace, 'steady');
  assert.equal(stats.fpm, 7);
  const a = summarizeTake([40], [{ ...line, text: 'Basically basically we start.' }], ['We start'], true);
  const b = summarizeTake([30], [{ ...line, text: 'We start with feedback.' }], ['We start'], true);
  assert.deepEqual(compareRows(a, b, ['We start']).map(r => r.text), ['“basically” 2 → 0']);
});

test('slide carousel release rules and cover flow match the prototype', () => {
  assert.deepEqual(decideRelease({ x: -40, base: 0, vel: -0.5, step: 374, slide: 2, n: 5 }).dir, 1);
  assert.deepEqual(decideRelease({ x: -80, base: 0, vel: 0, step: 374, slide: 2, n: 5 }).dir, 1);
  assert.deepEqual(decideRelease({ x: -60, base: 0, vel: 0, step: 374, slide: 2, n: 5 }).dir, 0);
  assert.deepEqual(decideRelease({ x: 120, base: 0, vel: 0, step: 374, slide: 0, n: 5 }).dir, 0);
  const front = coverFlow(0, 0, 5, 0);
  assert.equal(front.x, 0);
  assert.equal(front.scale, 1);
  const side = coverFlow(1, 0, 5, 0);
  assert.equal(side.x, 196);
  assert.equal(side.rotateY, -55);
  assert.ok(Math.abs(side.blur - 3.2) < 1e-9);
});
