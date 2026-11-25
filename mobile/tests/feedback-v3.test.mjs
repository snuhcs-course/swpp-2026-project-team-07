// Feedback v3 contract, selection, coaching cards and client.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/feedback-run-loader.mjs';
registerHooks({ resolve, load });
const run = await import('../src/features/feedback/feedbackRun.ts');
const client = await import('../src/features/feedback/feedbackRunClient.ts');
const { createStoreAccess } = await import('../src/services/storeAccess.ts');
const { STORE_API } = await import('../src/services/storeEndpoint.ts');

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
const select = (runs, { parts = [part('a1'), part('a1'), part('a1')], ready = ['a1'], stages = {}, expected = ['a1'], selected } = {}) =>
  run.selectRunFeedbackV3({ n: parts.length, parts, stages: new Map(Object.entries(stages)), ready: new Set(ready),
    expected: new Set(expected), selected, runs: new Map(Object.entries(runs).map(([k, v]) => [k, v && run.parseFeedbackRun(v)])) });

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
  // Outdated results stay visible (screens never regenerate on their own), flagged for an explicit Update.
  const outdated = select({ a1: body({ outdated: true }) });
  assert.deepEqual([outdated.items[1].status, outdated.items[1].score, outdated.items[1].outdated, outdated.overall.score, outdated.overall.outdated],
    ['Scored', 67, true, 67, true]);
  const transcribing = select({}, { ready: [] });
  assert.deepEqual([transcribing.items[1].status, transcribing.items[1].settled], ['Transcript pending', false]);
  const silent = select({}, { ready: [], stages: { a1: 'no_speech' } });
  assert.deepEqual([silent.overall.status, silent.items[1].settled], ['No speech detected', true]);
  const coming = select({ a1: body({ status: 'absent', scores: null, slides: [], whole: null }) });
  assert.deepEqual([coming.items[1].status, coming.items[1].settled], ['Scoring…', false]);
  const old = select({ a1: body({ status: 'absent', scores: null, slides: [], whole: null }) }, { expected: [] });
  assert.deepEqual([old.items[1].status, old.items[1].settled, old.overall.status], ['Not graded', true, 'Not graded']);
  const blocked = run.selectRunFeedbackV3({ n: 1, parts: [part('a1')], stages: new Map(), ready: new Set(['a1']), expected: new Set(),
    waitingForSettings: new Set(['a1']), runs: new Map([['a1', run.parseFeedbackRun(body({ status: 'absent', scores: null, slides: [], whole: null }))]]) });
  assert.deepEqual([blocked.items[0].status, blocked.items[0].settled], ['Settings sync pending', false]);
  const stale = select({ a1: body({ status: 'stale', scores: null, slides: [], whole: null }) });
  assert.deepEqual([stale.items[1].status, stale.items[1].settled, run.feedbackRunOutdated(stale.items[1].run)], ['Not graded', true, true]);
  const failed = select({ a1: body({ status: 'failed', scores: null, error: { code: 'all_parts_failed', message: 'x' },
    slides: [{ slide_index: 1, status: 'failed', error: 'timeout' }], whole: { status: 'failed' } }) });
  assert.deepEqual([failed.items[1].status, failed.items[1].settled, failed.overall.status], ['Feedback failed', true, 'Feedback failed']);
  assert.equal(run.feedbackRunHasFailures(failed.items[1].run), true);
});

test('combined recordings, unrecorded slides and withheld overall scores', () => {
  const combined = select({ a1: body(), a2: body({ attempt_id: 'a2' }) }, { parts: [part('a1'), part('a2'), null], ready: ['a1', 'a2'] });
  assert.equal(combined.overall.status, 'Overall score unavailable');
  assert.equal(combined.items[2].status, 'Not recorded');
  const withheld = select({ a1: body({ scores: { overall: null, overall_level: null, slide_average: 67, whole: 67,
    withheld: [{ reason: 'slides_not_scored', slides: [2] }] } }) });
  assert.equal(withheld.overall.status, 'Overall needs slide 3');
  assert.equal(run.withheldLabel([{ reason: 'whole_not_scored', slides: [] }]), 'Overall score unavailable');
  assert.equal(run.withheldLabel([{ reason: 'slides_not_scored', slides: [3] }, { reason: 'presentation_incomplete', slides: [] }]),
    'Record the whole presentation for an overall score');
});

test('selected overall and slide scores use the current assessment while retaining original recording identities', () => {
  const runs = { a1: body(), a2: body({ attempt_id: 'a2', slides: [scoredSlide(1, { score: 42 })] }) };
  const inputs = { parts: [part('a1'), part('a2'), part('a1')], ready: ['a1', 'a2'] };
  const overall = values => ({ status: 'Scoring selected takes…', run: run.parseFeedbackRun(body(values)) });
  const score = { ...body().scores, overall: 54 };
  const finished = select(runs, { ...inputs, selected: overall({ scores: score }) });
  assert.deepEqual([finished.overall.score, finished.overall.level, finished.overall.attemptId], [54, 'competent', null]);
  assert.deepEqual(finished.items.map(i => [i.attemptId, i.score]), [['a1', null], ['a2', 67], ['a1', 80]]);
  const old = select(runs, { ...inputs, selected: overall({ scores: score, outdated: true }) });
  assert.deepEqual([old.overall.score, old.overall.status], [null, 'Score outdated']);
  assert.deepEqual(old.items.map(i => [i.attemptId, i.score]), [['a1', null], ['a2', 42], ['a1', 80]]);
  const waiting = select(runs, { ...inputs, selected: overall({ scores: score, status: 'running' }) });
  assert.deepEqual([waiting.overall.score, waiting.overall.status], [null, 'Scoring selected takes…']);
  const incomplete = select(runs, { ...inputs, selected: overall({
    scores: { ...score, overall: null, withheld: [{ reason: 'presentation_incomplete' }] },
  }) });
  assert.equal(incomplete.overall.status, 'Record missing slides for an overall score');
});

test('selected feedback dedupes admission, uses GET for saved jobs and fences response scope and revisions', async () => {
  const api = 'http://selected.invalid/api';
  const scope = { context_id: 'c1', slides: [
    { slide_index: 0, attempt_id: 'a2', segments: [{ start_ms: 0, end_ms: 1000 }] },
    { slide_index: 1, attempt_id: 'a1', segments: [{ start_ms: 1000, end_ms: 2500 }] },
    { slide_index: 2, attempt_id: 'a2', segments: [{ start_ms: 1000, end_ms: 2500 }] },
  ] };
  const selection = { anchor: 'a1', scope, revision: 'v1' };
  const calls = [];
  const transport = async (url, init) => {
    calls.push([url, init.method, init.body && JSON.parse(init.body)]);
    return Response.json(body({ scope, status: init.method === 'POST' ? 'queued' : 'completed' }));
  };
  const post = client.checkSelectedFeedback(api, selection, 'check', transport);
  assert.equal(client.checkSelectedFeedback(api, selection, 'check', transport), post);
  assert.equal(await post, 'available');
  assert.deepEqual(calls[0], [api + '/attempts/a1/selected-feedback-run/', 'POST', { scope, retry: false }]);
  await client.checkSelectedFeedback(api, selection, 'check', transport);
  assert.deepEqual(calls[1], [api + '/attempts/a1/selected-feedback-run/r1/', 'GET', undefined]);
  assert.equal(client.readSelectedFeedback(api, selection).scores.overall, 67);
  const changed = { ...selection, revision: 'v2' };
  assert.equal(client.readSelectedFeedback(api, changed), null);
  const wrong = async () => Response.json(body({ scope: { ...scope, slides: scope.slides.slice(1) } }));
  assert.equal(await client.checkSelectedFeedback(api, changed, 'check', wrong), 'unavailable');
  assert.equal(client.readSelectedFeedback(api, changed), null);
  assert.equal(await client.checkSelectedFeedback(api, selection, 'check', async () => { throw Error('offline'); }), 'offline');
  assert.equal(client.readSelectedFeedback(api, selection).scores.overall, 67);
  assert.equal(await client.checkSelectedFeedback(api, changed, 'check', async () => new Response(null, { status: 404 })), 'unavailable');
  for (const status of ['waiting', 'unavailable']) {
    await client.checkSelectedFeedback(api, selection, 'update', async () => Response.json(body({ scope })));
    assert.equal(client.readSelectedFeedback(api, selection).scores.overall, 67);
    const missing = async (_url, init) => init.method === 'GET'
      ? Response.json({ error: { code: 'not_found' } }, { status: 404 })
      : Response.json({ error: { code: status === 'waiting' ? 'transcript_not_ready' : 'invalid_request' } },
        { status: status === 'waiting' ? 409 : 400 });
    assert.equal(await client.checkSelectedFeedback(api, selection, 'check', missing), status);
    assert.equal(client.readSelectedFeedback(api, selection), null);
  }
});

test('selected feedback keeps only cited audio within the original selected visit', async () => {
  const scope = { context_id: 'c1', slides: [
    { slide_index: 0, attempt_id: 'a2', segments: [{ start_ms: 1000, end_ms: 2700 }] },
    { slide_index: 1, attempt_id: 'a1', segments: [{ start_ms: 1000, end_ms: 2700 }] },
  ] };
  const good = { ...speech('selected', 1, 1400), attempt_id: 'a1' };
  const wrong = [
    { ...speech('removed-source', 1, 1400), attempt_id: 'a2' },
    { ...speech('cross-slide', 0, 1400), attempt_id: 'a2' },
    { ...speech('beyond-visit', 1, 2200), attempt_id: 'a1' },
  ];
  const selectedBody = body({ scope, slides: [scoredSlide(1, {
    criteria: [criterion('essential_coverage', 'competent', { evidence: [...wrong, good] })],
  })] });
  const api = 'https://selected-evidence.invalid/api';
  const selection = { anchor: 'a1', scope, revision: 'v1' };
  assert.equal(await client.checkSelectedFeedback(api, selection, 'check', async () => Response.json(selectedBody)), 'available');
  assert.deepEqual(client.readSelectedFeedback(api, selection).slides[0].criteria[0].evidence, [good]);
});

test('selected scores use the store installation for admission and read-only polling', async () => {
  const scope = { context_id: 'c1', slides: [
    { slide_index: 0, attempt_id: 'a2', segments: [{ start_ms: 0, end_ms: 1000 }] },
    { slide_index: 1, attempt_id: 'a1', segments: [{ start_ms: 0, end_ms: 1000 }] },
  ] };
  const selection = { anchor: 'a1', scope, revision: 'store-installation' };
  let choice = 'offline', token = null, reject = false;
  const calls = [];
  const store = createStoreAccess({
    read: async () => token, write: async (_key, value) => { token = value; },
    remove: async () => { token = null; },
  }, { read: () => choice, write: value => { choice = value; } });
  const transport = (url, init) => store(url, init, async (target, options) => {
    calls.push([target, options.method, options.headers?.get('Authorization') ?? null]);
    if (target.endsWith('/installations/')) return Response.json({ token: 'synthetic-installation' }, { status: 201 });
    if (reject) return new Response(null, { status: 401 });
    return Response.json(body({ scope, slides: [scoredSlide(1)], status: options.method === 'POST' ? 'queued' : 'completed' }));
  });
  const selectedPath = STORE_API + '/attempts/a1/selected-feedback-run/';
  assert.equal(await client.checkSelectedFeedback(STORE_API, selection, 'check', transport), 'offline');
  assert.deepEqual(calls, []);
  choice = 'enabled';
  assert.equal(await client.checkSelectedFeedback(STORE_API, selection, 'check', transport), 'available');
  assert.equal(await client.checkSelectedFeedback(STORE_API, selection, 'check', transport), 'available');
  assert.deepEqual(calls, [
    [STORE_API + '/installations/', 'POST', null],
    [selectedPath, 'POST', 'Bearer synthetic-installation'],
    [selectedPath + 'r1/', 'GET', 'Bearer synthetic-installation'],
  ]);
  reject = true;
  assert.equal(await client.checkSelectedFeedback(STORE_API, selection, 'check', transport), 'offline');
  assert.equal(choice, 'expired');
  assert.equal(await client.checkSelectedFeedback(STORE_API, selection, 'retry', transport), 'offline');
  assert.equal(calls.length, 4, 'expiry neither reenrolls nor replays a request');
  assert.equal(client.readSelectedFeedback(STORE_API, selection).scores.overall, 67);
});

test('selected store score distinguishes a budget denial from a network outage', async () => {
  const api = 'https://selected-budget.invalid/api';
  const selection = { anchor: 'a1', revision: 'test-budget', scope: { context_id: 'c1', slides: [
    { slide_index: 0, attempt_id: 'a1', segments: [{ start_ms: 0, end_ms: 1000 }] },
    { slide_index: 1, attempt_id: 'a2', segments: [{ start_ms: 0, end_ms: 1000 }] },
  ] } };
  for (const code of ['public_budget_exhausted', 'public_budget_unavailable']) {
    const response = async () => Response.json({ error: { code } }, { status: 503 });
    assert.equal(await client.checkSelectedFeedback(api, selection, 'check', response), code);
  }
  const result = body({ status: 'completed', scores: null, whole: { status: 'failed', error: 'public_budget_exhausted' } });
  const view = select({}, { parts: [part('a1'), part('a2')], selected: { run: run.parseFeedbackRun(result) } });
  assert.equal(view.overall.status, 'Free coaching budget too low');
  const partial = run.parseFeedbackRun({ ...result, status: 'running' });
  assert.equal(run.selectedRunBudgetStatus(partial), null);
});

test('a start is needed only when no run exists; outdated runs wait for an explicit update', () => {
  const parse = extra => run.parseFeedbackRun(body(extra));
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'absent' })), true);
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'stale' })), true);
  assert.equal(run.feedbackRunNeedsStart(parse({ outdated: true })), false);
  assert.equal(run.feedbackRunOutdated(parse({ outdated: true })), true);
  assert.equal(run.feedbackRunOutdated(parse({ status: 'running', outdated: true })), false);
  assert.equal(run.feedbackRunNeedsStart(parse({ status: 'absent', enabled: false })), false);
  assert.equal(run.feedbackRunNeedsStart(parse()), false);
});

test('automatic starts: new eligible recordings once, failed starts after the retry delay', () => {
  const c = (id, extra = {}) => ({ id, contextId: 'c1', eligible: true, start: null, ...extra });
  const now = 1_000_000;
  const due = run.startsDue([c('new'), c('done', { start: { state: 'started', at: 0 } }), c('old', { eligible: false }),
    c('failedRecently', { start: { state: 'failed', at: now - 1000 } }), c('failedLongAgo', { start: { state: 'failed', at: now - run.START_RETRY_MS } })], now);
  assert.deepEqual(due.map(x => x.id), ['new', 'failedLongAgo']);
});

test('coaching cards lead with the largest gains and add next-level advice not already covered', () => {
  const view = select({ a1: body() });
  const cards = run.slideCards(view.items[1]);
  assert.deepEqual(cards.map(c => [c.criterion, c.gain]), [['explanation_depth', 11.7], ['essential_coverage', 11.7]]);
  const translated = {...view.items[1], v3:{...view.items[1].v3, criteria:view.items[1].v3.criteria.map(c=>({...c,label:'필수 내용'}))}};
  const localizedCards = run.slideCards(translated, level=>level === 'Competent' ? '양호' : level);
  assert.equal(localizedCards[1].title, '필수 내용: 양호');
  assert.equal(localizedCards[1].headline, '필수 내용: 양호');
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
  answer = () => new Response(JSON.stringify(body({ status: 'absent', run_id: null, scores: null, slides: [], whole: null })), { status: 200 });
  await client.fetchFeedbackRun(api, 'a1', 'c1');
  assert.equal(client.readSavedRun(api, 'a1', 'c1').runId, 'r1');  // "absent" never replaces a saved run.
});

test('a slow older GET never overwrites a newer answer', async () => {
  const api = 'http://order.invalid/api', releases = [];
  globalThis.fetch = (url, init) => new Promise(resolve => releases.push({ method: init.method, resolve }));
  const slowGet = client.fetchFeedbackRun(api, 'a1', null);
  const post = client.startFeedbackRun(api, 'a1', null);
  await new Promise(r => setTimeout(r, 5));
  releases.find(r => r.method === 'POST').resolve(new Response(JSON.stringify(body({ status: 'queued', run_id: 'new' })), { status: 202 }));
  await post;
  releases.find(r => r.method === 'GET').resolve(new Response(JSON.stringify(body({ run_id: 'older' })), { status: 200 }));
  await slowGet;
  assert.deepEqual([client.readSavedRun(api, 'a1', null).runId, client.readSavedRun(api, 'a1', null).status], ['new', 'queued']);
});

test('automatic start state is saved per recording', () => {
  const api = 'http://start.invalid/api';
  assert.equal(client.readStartState(api, 'a1'), null);
  client.writeStartState(api, 'a1', 'failed', 123);
  assert.deepEqual(client.readStartState(api, 'a1'), { state: 'failed', at: 123 });
  assert.equal(client.readStartState(api, 'a2'), null);
});

test('a POST result is kept even when a poll sent after it is answered first', async () => {
  const api = 'http://post-order.invalid/api', releases = [];
  globalThis.fetch = (url, init) => new Promise(resolve => releases.push({ method: init.method, resolve }));
  const post = client.startFeedbackRun(api, 'a1', null);
  await new Promise(r => setTimeout(r, 5));
  const poll = client.fetchFeedbackRun(api, 'a1', null);
  await new Promise(r => setTimeout(r, 5));
  releases.find(r => r.method === 'GET').resolve(new Response(JSON.stringify(body({ status: 'absent', run_id: null, scores: null, slides: [], whole: null })), { status: 200 }));
  await poll;
  releases.find(r => r.method === 'POST').resolve(new Response(JSON.stringify(body({ status: 'queued', run_id: 'created' })), { status: 202 }));
  await post;
  assert.equal(client.readSavedRun(api, 'a1', null).runId, 'created');
});

test('a delayed POST cannot replace a newer snapshot of the same run', async () => {
  const api = 'http://post-progress.invalid/api', releases = [];
  const at = seconds => `2026-11-15T08:00:${seconds}.000000+00:00`;
  globalThis.fetch = (url, init) => new Promise(resolve => releases.push({ method: init.method, resolve }));
  const post = client.startFeedbackRun(api, 'a1', null);
  const poll = client.fetchFeedbackRun(api, 'a1', null);
  await new Promise(r => setTimeout(r, 5));
  releases.find(r => r.method === 'GET').resolve(new Response(JSON.stringify(body({ updated_at: at('05') })), { status: 200 }));
  await poll;
  releases.find(r => r.method === 'POST').resolve(new Response(JSON.stringify(body({ status: 'queued', updated_at: at('01'), scores: null })), { status: 202 }));
  await post;
  assert.equal(client.readSavedRun(api, 'a1', null).status, 'completed');
  assert.equal(client.readSavedRun(api, 'a1', null).scores.overall, 67);
});

test('a newer retry snapshot can replace a failed run', async () => {
  const api = 'http://retry-version.invalid/api';
  globalThis.fetch = async (_url, init) => new Response(JSON.stringify(body(init.method === 'GET'
    ? { status: 'failed', updated_at: '2026-11-15T08:00:01+00:00' }
    : { status: 'queued', updated_at: '2026-11-15T08:00:02+00:00' })), { status: 200 });
  await client.fetchFeedbackRun(api, 'a1', null);
  await client.startFeedbackRun(api, 'a1', null, true);
  assert.equal(client.readSavedRun(api, 'a1', null).status, 'queued');
});

test('embedded capture feedback invalidates a revisit before a delayed old GET completes', async () => {
  const api = 'http://capture-feedback.invalid/api'; let release;
  const older = body({ updated_at: '2026-11-15T08:00:01+00:00' });
  client.receiveFeedbackRun(api, 'a1', 'c1', older);
  const pending = client.fetchFeedbackRun(api, 'a1', 'c1', async () => new Promise(resolve => { release = resolve; }));
  const newer = body({ status: 'running', updated_at: '2026-11-15T08:00:02+00:00',
    slides: [scoredSlide(1, { status: 'pending', score: null, level: null, provisional: true, reason: 'awaiting_segments' })] });
  client.receiveFeedbackRun(api, 'a1', 'c1', newer);
  release(new Response(JSON.stringify(older), { status: 200 })); await pending;
  const slide = client.readSavedRun(api, 'a1', 'c1').slides[0];
  assert.equal(slide.status, 'pending'); assert.equal(slide.score, null); assert.equal(slide.provisional, true);
  assert.equal(slide.improvements.length, 1, 'prior advice is retained provisionally');
});

test('embedded capture feedback rejects a foreign recording or settings without changing the cache', () => {
  const api = 'http://capture-identity.invalid/api';
  client.receiveFeedbackRun(api, 'a1', 'c1', body());
  assert.throws(() => client.receiveFeedbackRun(api, 'a1', 'c1', body({ attempt_id: 'other' })), /different recording/);
  assert.throws(() => client.receiveFeedbackRun(api, 'a1', 'c1', body({ context_id: 'other' })), /different recording/);
  assert.equal(client.readSavedRun(api, 'a1', 'c1').scores.overall, 67);
});

// Supplied Claude patch, OpenAI Codex integration, Iteration 2 (2026-11-20): prompt-3 coaching fields.
test('prompt-3 coaching fields fill the Feedback cards and older runs still map from problem and action', () => {
  const fresh = scoredSlide(1, { improvements: [{ criterion: 'explanation_depth', problem: 'The slide shows X; you never say it.', action: 'Say X. Link X to Y.',
    example: '“"Because X."”', headline: 'X left out', explanation: ['The slide shows X; you never say it'], steps: ['Say X', 'Link X to Y'],
    over_limit: ['steps.1'], evidence: [speech('s2', 1, 5000)], gain_slide_points: 11.7, gain_overall_points: 4.1 }] });
  const base = body();
  const view = select({ a1: body({ slides: [base.slides[0], fresh], whole: { ...base.whole, top_priorities: [{ headline: 'Close on one point',
    explanation: ['The talk ends on a thank-you', 'People forget the main point'], steps: ['Add one closing sentence'], example: '',
    title: 'Close on one point', action: 'Add one closing sentence.', why: 'The talk ends on a thank-you. People forget the main point.',
    over_limit: [], slide_index: null }] } }) });
  const [priority, card] = run.runCards(view.items, view.overall);
  assert.deepEqual([card.headline, card.explanation, card.steps, card.example, card.overLimit],
    ['X left out', ['The slide shows X; you never say it'], ['Say X', 'Link X to Y'], 'Because X.', true]);
  assert.deepEqual([priority.headline, priority.explanation, priority.steps, priority.overLimit],
    ['Close on one point', ['The talk ends on a thank-you', 'People forget the main point'], ['Add one closing sentence'], false]);
  const old = select({ a1: body() });
  const [oldPriority, oldCard] = run.runCards(old.items, old.overall);
  assert.deepEqual([oldCard.headline, oldCard.explanation, oldCard.steps, oldCard.example], ['No reason', [], ['Say why'], 'Because…']);
  assert.deepEqual([oldPriority.headline, oldPriority.explanation, oldPriority.steps], ['Explain why', ['clarity'], ['Add one reason per slide']]);
  assert.equal(run.unquote('“"nested"”'), 'nested');
});

test('both saved formats project exact source fields into bilingual cards without touching the assessment', async () => {
  const { translatedV3 } = await import('../src/features/localization/generatedProse.ts');
  const legacy = { ...scoredSlide(1).improvements[0], problem: 'First sentence. Second sentence?', action: '  Say why!  ' };
  const native = { ...legacy, headline: 'Compare the counts', explanation: ['First count is missing', 'Second count is unclear'],
    steps: ['Name the two counts', 'Explain the change'], over_limit: ['steps.1'] };
  const original = body().whole.top_priorities[0];
  for (const structured of [false, true]) {
    const stored = run.parseFeedbackRun(body({ slides: [scoredSlide(1, { language: 'en', improvements: [structured ? native : legacy] })],
      whole: { ...body().whole, language: 'en', top_priorities: [structured ? { ...native, ...original } : original] } }));
    const before = structuredClone(stored);
    const fields = new Map();
    const localize = (path, source, hint) => { fields.set(path, [source, hint]); return '번역 ' + source; };
    const project = translate => {
      const slide = translatedV3(stored.slides[0], translate, 'slides.1');
      const whole = translatedV3(stored.whole, translate, 'whole');
      return run.runCards([{ slide: 1, attemptId: stored.attemptId, v3: slide }], { attemptId: stored.attemptId, run: { whole } });
    };
    const [priority, card] = project(localize);
    const path = 'slides.1.improvements.0.';
    assert.deepEqual(fields.get(path + 'problem'), [legacy.problem, 'en']);
    assert.deepEqual(fields.get(path + 'action'), [legacy.action, 'en']);
    assert.equal(card.key, 'i1:0');
    assert.equal(card.evidence.start_ms, 5000);
    assert.equal(card.example, legacy.example);
    if (structured) {
      assert.equal(card.headline, '번역 ' + native.headline);
      assert.deepEqual(card.steps, native.steps.map(text => '번역 ' + text));
      assert.deepEqual(priority.explanation, native.explanation.map(text => '번역 ' + text));
      assert.deepEqual(fields.get(path + 'steps.1'), [native.steps[1], 'en']);
      assert.deepEqual(fields.get('whole.top_priorities.0.explanation.0'), [native.explanation[0], 'en']);
      assert.equal(card.overLimit, true);
    } else {
      assert.equal(card.headline, '번역 ' + legacy.problem);
      assert.deepEqual(card.steps, ['번역 ' + legacy.action]);
      assert.equal(priority.headline, '번역 ' + original.title);
      assert.deepEqual(fields.get('whole.top_priorities.0.why'), [original.why, 'en']);
      assert.equal([...fields.keys()].some(key => /\.(headline|steps|explanation)(\.|$)/.test(key)), false);
    }
    assert.equal([...fields.keys()].some(key => /\.(example|evidence|over_limit|score)(\.|$)/.test(key)), false);
    const [englishPriority, englishCard] = project((_path, source) => source);
    assert.equal(englishCard.headline, structured ? native.headline : legacy.problem);
    assert.deepEqual(englishPriority.steps, structured ? native.steps : [original.action]);
    assert.deepEqual(stored, before);
  }
});
