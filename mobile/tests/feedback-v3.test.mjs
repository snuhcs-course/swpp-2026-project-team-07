// Feedback v3 contract, selection, coaching cards and client.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/feedback-run-loader.mjs';
registerHooks({ resolve, load });
const run = await import('../src/features/feedback/feedbackRun.ts');
const client = await import('../src/features/feedback/feedbackRunClient.ts');

const speech = (id, slide, start) => ({ kind: 'speech', id, slide_index: slide, start_ms: start, end_ms: start + 900, text: `said ${id}` });
const criterion = (id, level, extra = {}) => ({ id, label: id.replace('_', ' '), maximum_points: 35, level, anchor: 'anchor', points: 23.33,
  reason: 'why', next_level: level === 'advanced' ? '' : `improve ${id}`, evidence: [speech('s1', 1, 3000)], ...extra });
const scoredSlide = (index, extra = {}) => ({ slide_index: index, status: 'scored', score: 67, level: 'competent',
  criteria: [criterion('essential_coverage', 'competent'), criterion('explanation_depth', 'competent'), criterion('clarity_relevance', 'advanced')],
  must_cover: [{ point: 'Jobs drew people', status: 'covered', evidence: [speech('s1', 1, 3000)] }, { point: 'Housing', status: 'missing', evidence: [] }],
  strength: { text: 'Clear opening', evidence: [] },
  improvements: [{ criterion: 'explanation_depth', problem: 'No reason', action: 'Say why', example: 'Because…', evidence: [speech('s2', 1, 5000)],
    gain_slide_points: 11.7, gain_overall_points: 4.1 }],
  measurements: { seconds: 17, target_seconds: 20, words: 30, filler_count: 2, long_pauses: 0, rate: { value: 150, unit: 'words/min', band: 'comfortable' } },
  ...extra });
const body = (extra = {}) => ({
  status: 'completed', enabled: true, outdated: false, run_id: 'r1', attempt_id: 'a1', context_id: 'c1',
  progress: { slides_total: 2, slides_done: 2, whole_done: true },
  scores: { overall: 67, overall_level: 'competent', slide_average: 66.7, whole: 67, withheld: [] },
  slides: [{ slide_index: 0, status: 'not_applicable', reason: 'title_slide_profile' }, scoredSlide(1), scoredSlide(2, { score: 80, level: 'competent' })],
  whole: { status: 'scored', score: 67, criteria: [criterion('delivery', 'competent', { evidence: [speech('s0', 0, 0), { kind: 'measurement', id: 'm:pace', text: 'pace' }] })],
    top_priorities: [{ title: 'Explain why', action: 'Add one reason per slide', why: 'clarity', slide_index: 1 }], summary: 'Solid.' },
  error: null, ...extra });
const part = (attemptId, ms = 1000) => ({ attemptId, segments: [{ startMs: 0, endMs: ms }] });
const select = (runs, { parts = [part('a1'), part('a1'), part('a1')], ready = ['a1'], stages = {} } = {}) =>
  run.selectRunFeedbackV3({ n: parts.length, parts, stages: new Map(Object.entries(stages)), ready: new Set(ready),
    runs: new Map(Object.entries(runs).map(([k, v]) => [k, v && run.parseFeedbackRun(v)])) });

test('parse keeps valid parts and drops malformed ones without guessing', () => {
  const parsed = run.parseFeedbackRun(body({ slides: [scoredSlide(1), { slide_index: -1 }, 'x', { slide_index: 2, status: 'weird' }] }));
  assert.equal(parsed.slides.length, 2);
  assert.equal(parsed.slides[1].status, 'failed');  // Unknown status is never shown as a score.
  assert.equal(parsed.slides[0].criteria[0].evidence[0].start_ms, 3000);
  assert.deepEqual(parsed.whole.criteria[0].evidence.map(e => e.kind), ['speech', 'measurement']);
  assert.equal(run.parseFeedbackRun({ status: 'nonsense' }), null);
  assert.equal(run.parseFeedbackRun(null), null);
  const odd = run.parseFeedbackRun(body({ scores: { overall: 101, overall_level: 'great', withheld: 'x' } }));
  assert.deepEqual([odd.scores.overall, odd.scores.overall_level, odd.scores.withheld], [null, null, []]);
});

test('completed run gives slide and overall scores from the server, with title slide not graded', () => {
  const view = select({ a1: body() });
  assert.deepEqual(view.items.map(i => [i.status, i.score, i.level, i.settled]),
    [['Not applicable', null, null, true], ['Scored', 67, 'competent', true], ['Scored', 80, 'competent', true]]);
  assert.deepEqual([view.overall.score, view.overall.level, view.overall.status], [67, 'competent', 'Scored']);
  assert.deepEqual(view.aggregate, { total: 3, settled: 3, pending: 0, graded: 2, improvements: 2 });
});

test('progress, outdated inputs, transcripts and failures have honest statuses', () => {
  const running = select({ a1: body({ status: 'running', scores: null, slides: [scoredSlide(1), { slide_index: 2, status: 'pending' }] }) });
  assert.deepEqual(running.items.slice(1).map(i => [i.status, i.score, i.settled]), [['Scored', 67, true], ['Scoring…', null, false]]);
  assert.equal(running.overall.status, 'Scoring…');
  const outdated = select({ a1: body({ outdated: true }) });
  assert.deepEqual([outdated.items[1].status, outdated.items[1].score, outdated.items[1].settled, outdated.overall.status],
    ['Score outdated', null, false, 'Score outdated']);
  assert.equal(select({}, { ready: [] }).items[1].status, 'Transcript pending');
  assert.equal(select({}, { ready: [], stages: { a1: 'no_speech' } }).overall.status, 'No speech detected');
  const failed = select({ a1: body({ status: 'failed', scores: null, error: { code: 'all_parts_failed', message: 'x' },
    slides: [{ slide_index: 1, status: 'failed', error: 'timeout' }], whole: { status: 'failed' } }) });
  assert.deepEqual([failed.items[1].status, failed.items[1].settled, failed.overall.status], ['Feedback failed', true, 'Feedback failed']);
  assert.equal(run.feedbackRunHasFailures(failed.items[1].run), true);
});

test('combined recordings, unrecorded slides and withheld overall scores', () => {
  const combined = select({ a1: body(), a2: body({ attempt_id: 'a2' }) }, { parts: [part('a1'), part('a2'), null], ready: ['a1', 'a2'] });
  assert.equal(combined.overall.status, 'Combined recordings');
  assert.equal(combined.items[2].status, 'Not recorded');
  const withheld = select({ a1: body({ scores: { overall: null, overall_level: null, slide_average: 67, whole: 67,
    withheld: [{ reason: 'slides_not_scored', slides: [2] }] } }) });
  assert.equal(withheld.overall.status, 'Overall needs slide 3');
  assert.equal(run.withheldLabel([{ reason: 'whole_not_scored', slides: [] }]), 'Overall score unavailable');
});

test('start is needed only for absent, stale or outdated idle runs', () => {
  const parse = extra => run.parseFeedbackRun(body(extra));
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'absent' })), true);
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'stale' })), true);
  assert.equal(run.feedbackRunNeedsStart(parse({ outdated: true })), true);
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'running', outdated: true })), false);
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'absent', enabled: false })), false);
  assert.equal(run.feedbackRunNeedsStart(parse()), false);
});

test('coaching cards lead with the largest gains and add next-level advice not already covered', () => {
  const view = select({ a1: body() });
  const cards = run.slideCards(view.items[1]);
  assert.deepEqual(cards.map(c => [c.criterion, c.gain]), [['explanation_depth', 11.7], ['essential_coverage', 11.7]]);
  assert.equal(cards[0].evidence.start_ms, 5000);
  assert.equal(cards[1].action, 'improve essential_coverage');  // Advanced clarity has no next-level card.
  const all = run.runCards(view.items, view.overall);
  assert.equal(all[0].title, 'Explain why');
  assert.deepEqual(all.slice(1).map(c => c.slide), [1, 2]);
  assert.deepEqual(run.slideCards(view.items[0]), []);
});

test('client saves answers, tracks capability, dedupes requests and only re-renders on change', async () => {
  const api = 'http://v3.invalid/api/', calls = [];
  let answer = () => new Response(JSON.stringify(body()), { status: 200 });
  globalThis.fetch = async (url, init) => { calls.push([url, init.method, init.body]); await new Promise(r => setTimeout(r, 5)); return answer(); };
  assert.equal(client.feedbackV3Capability(api), null);
  const [a, b] = await Promise.all([client.fetchFeedbackRun(api, 'a1', 'c1'), client.fetchFeedbackRun(api, 'a1', 'c1')]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'http://v3.invalid/api/attempts/a1/feedback-run/?context_id=c1');
  assert.equal(a.runId, 'r1'); assert.equal(b, a);
  assert.equal(client.feedbackV3Capability(api), true);
  assert.equal(client.readSavedRun(api, 'a1', 'c1').scores.overall, 67);
  const bumps = globalThis.feedbackRunBumps;
  await client.fetchFeedbackRun(api, 'a1', 'c1');
  assert.equal(globalThis.feedbackRunBumps, bumps);  // Identical answer: no rewrite or re-render.
  await client.startFeedbackRun(api, 'a1', 'c1', true);
  assert.deepEqual(JSON.parse(calls.at(-1)[2]), { context_id: 'c1', retry: true });
  answer = () => new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 });
  assert.equal(await client.fetchFeedbackRun(api, 'zz', null), null);
  assert.equal(client.feedbackV3Capability(api), true);  // Unknown recording, not a missing endpoint.
  answer = () => new Response('<h1>Not Found</h1>', { status: 404 });
  await client.fetchFeedbackRun(api, 'a1', null);
  assert.equal(client.feedbackV3Capability(api), false);  // Older server without feedback v3.
  answer = () => new Response(JSON.stringify({ error: { code: 'feedback_disabled', message: 'off' } }), { status: 409 });
  await assert.rejects(client.startFeedbackRun('http://other.invalid/api', 'a1', null), /off/);
  assert.equal(client.feedbackV3Capability('http://other.invalid/api'), false);
  answer = () => new Response(JSON.stringify({ error: { code: 'transcript_not_ready' } }), { status: 409 });
  assert.equal(await client.startFeedbackRun(api, 'a2', null), null);
  answer = () => new Response('oops', { status: 500 });
  await assert.rejects(client.fetchFeedbackRun(api, 'a1', 'c1'));
  assert.equal(client.readSavedRun(api, 'a1', 'c1').scores.overall, 67);  // Saved copy survives failures.
});
