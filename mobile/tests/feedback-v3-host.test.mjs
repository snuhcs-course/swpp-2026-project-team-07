// FeedbackV3Host: starts new recordings once after transcription; never old ones; safe probing.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/feedback-v3-host-loader.mjs';
registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { FeedbackV3Host } = await import('../src/features/feedback/FeedbackV3Host.tsx');
const { useRunFeedbackV3 } = await import('../src/features/feedback/useRunFeedbackV3.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const review = { transcript_id: 't', deck_id: 'server-deck', transcript: { words: [{ text: 'hi', start_ms: 0, end_ms: 1 }] } };
const part = id => ({ attemptId: id, segments: [{ startMs: 0, endMs: 1000 }] });
function setup(overrides = {}) {
  globalThis.v3Host = {
    decks: [{ id: 'deck' }], states: { deck: { run: { parts: [part('old'), part('new')] }, compare: null } },
    reviews: { old: review, new: review, take: review }, eligible: ['new', 'take'], pending: [], starts: {}, calls: [],
    capability: true, checked: true, get: async () => ({ enabled: true, status: 'absent', runId: null }), post: async () => ({ enabled: true, status: 'queued', runId: 'r1' }),
    ...overrides,
  };
  return globalThis.v3Host;
}
async function mount() {
  let renderer;
  await act(async () => { renderer = create(React.createElement(FeedbackV3Host)); await new Promise(r => setTimeout(r, 20)); });
  await act(async () => { renderer.unmount(); });
}

test('starts only new recordings, once, and records the start', async () => {
  const h = setup();
  await mount();
  assert.deepEqual(h.calls, [['GET', 'new'], ['POST', 'new']]);  // "old" predates v3 eligibility.
  assert.equal(h.starts.new.state, 'started');
  h.calls.length = 0;
  await mount();
  assert.deepEqual(h.calls, []);  // Never started twice.
});

test('an existing run counts as started; v3 switched off records nothing', async () => {
  let h = setup({ get: async () => ({ enabled: true, status: 'completed', runId: 'server-auto' }) });
  await mount();
  assert.deepEqual([h.calls, h.starts.new?.state], [[['GET', 'new']], 'started']);
  h = setup({ get: async () => ({ enabled: false, status: 'absent', runId: null }) });
  await mount();
  assert.deepEqual([h.calls, h.starts.new], [[['GET', 'new']], undefined]);
});

for (const status of ['completed', 'stale']) {
  test(`opening an outdated ${status} assessment and switching English to Korean and back never starts grading`, async () => {
    const { setAppLanguage, useAppLanguage } = await import('../src/design/language.ts');
    const h = setup({ get: async () => ({ enabled: true, status, outdated: true, runId: 'before-format-upgrade' }) });
    function Shell() { return React.createElement(FeedbackV3Host, { key: useAppLanguage() }); }
    let renderer;
    try {
      await act(async () => { setAppLanguage('en'); renderer = create(React.createElement(Shell)); });
      await act(async () => { setAppLanguage('ko'); });
      await act(async () => { setAppLanguage('en'); });
      assert.deepEqual(h.calls, [['GET', 'new']]);
      assert.equal(h.starts.new.state, 'started');
    } finally { await act(async () => renderer?.unmount()); }
  });
}

test('failed starts are recorded so screens stop waiting; pending settings hold the start', async () => {
  let h = setup({ post: async () => null });
  await mount();
  assert.equal(h.starts.new.state, 'failed');
  h = setup({ pending: ['deck'] });
  await mount();
  assert.deepEqual(h.calls, []);
});

test('a take waiting on Keep/Overwrite starts immediately', async () => {
  const h = setup({ states: { deck: { run: { parts: [part('old')] }, compare: { attemptId: 'take' } } } });
  await mount();
  assert.deepEqual(h.calls, [['GET', 'take'], ['POST', 'take']]);
});

test('the capability probe moves past a recording the server does not know', async () => {
  const h = setup({ capability: null, checked: false, eligible: [] });
  h.get = async id => { if (id === 'new') h.capability = true; return id === 'new' ? { enabled: true, status: 'absent', runId: null } : null; };
  await mount();
  assert.deepEqual(h.calls, [['GET', 'old'], ['GET', 'new']]);
  assert.equal(h.capability, true);
});

test('a cached true capability is checked again before automatic work in a new session', async () => {
  const h = setup({ checked: false, get: async () => ({ enabled: false, status: 'absent', runId: null }) });
  await mount();
  assert.deepEqual(h.calls, [['GET', 'old']]);
  assert.equal(h.capability, false);
  assert.equal(h.starts.new, undefined);
});

test('a failed capability probe retries without another store change', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = setup({ capability: null, checked: false, eligible: [], get: async () => { throw new Error('offline'); } });
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(FeedbackV3Host)); await new Promise(r => setTimeout(r, 10)); });
    assert.equal(h.calls.length, 2);
    h.get = async () => ({ enabled: true, status: 'absent', runId: null });
    await act(async () => { t.mock.timers.tick(60000); });
    assert.equal(h.calls.length, 3);
    assert.equal(h.checked, true);
  } finally {
    await act(async () => renderer?.unmount());
    t.mock.timers.reset();
  }
});

test('a mounted screen loads an old recording when capability becomes known', async () => {
  const h = setup({ capability: null, checked: false, eligible: [] });
  const model = { deck: { id: 'deck' }, n: 1, state: { run: { parts: [part('old')] } }, stages: new Map() };
  function Screen() { useRunFeedbackV3(model); return null; }
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(Screen)); });
    assert.deepEqual(h.calls, []);
    h.capability = true;
    await act(async () => renderer.update(React.createElement(Screen)));
    assert.deepEqual(h.calls, [['GET', 'old']]);
  } finally { await act(async () => renderer?.unmount()); }
});

test('the selected overall assessment starts only after the comparison and input synchronization are done', async () => {
  const h = setup({ selectedCalls: [], corrections: { new: { pending: true } } });
  const model = { deck: { id: 'deck' }, n: 2,
    state: { run: { parts: [part('old'), part('new')] }, compare: { attemptId: 'pending' } }, stages: new Map() };
  function Screen() {
    const v3 = useRunFeedbackV3(model);
    return React.createElement('score', { overall: v3.overall });
  }
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(Screen)); });
    assert.deepEqual(h.selectedCalls, []);
    model.state.compare = null;
    await act(async () => renderer.update(React.createElement(Screen)));
    assert.deepEqual(h.selectedCalls, []);
    assert.equal(renderer.root.findByType('score').props.overall.status, 'Transcript changes pending');
    h.corrections = {};
    await act(async () => renderer.update(React.createElement(Screen)));
    const [{ selection, action }] = h.selectedCalls;
    assert.equal(selection.anchor, 'new');
    assert.equal(action, 'check');
    assert.deepEqual(selection.scope.slides.map(slide => slide.attempt_id), ['old', 'new']);
    await act(async () => renderer.update(React.createElement(Screen)));
    assert.equal(h.selectedCalls.length, 1);
  } finally { await act(async () => renderer?.unmount()); }
});

test('selected overall Update and Retry are independent of an individual take request that fails', async () => {
  for (const action of ['update', 'retry']) {
    const status = action === 'update' ? 'stale' : 'failed';
    const old = { status, enabled: true, runId: 'old-feedback', slides: [], whole: null };
    const h = setup({ selectedCalls: [], selectedRun: { ...old, runId: 'selected-feedback' },
      runs: { old }, post: async () => { throw new Error('Single take endpoint failed'); } });
    const model = { deck: { id: 'deck' }, n: 2,
      state: { run: { parts: [part('old'), part('new')] }, compare: null }, stages: new Map() };
    function Screen() {
      const v3 = useRunFeedbackV3(model);
      return React.createElement('score', { actOnSelection: v3[action] });
    }
    let renderer;
    try {
      await act(async () => { renderer = create(React.createElement(Screen)); });
      await act(async () => renderer.root.findByType('score').props.actOnSelection());
      assert.deepEqual(h.selectedCalls.map(call => call.action), ['check', action]);
      assert.ok(h.calls.some(([method, id]) => method === 'POST' && id === 'old'));
    } finally { await act(async () => renderer?.unmount()); }
  }
});

test('selected score polling stops after store consent expires and keeps completed cached scores visible', async () => {
  const h = setup({ online: false, selectedCalls: [], eligible: [] });
  const model = { deck: { id: 'deck' }, n: 2, state: { run: { parts: [part('old'), part('new')] } }, stages: new Map() };
  function Screen() { return React.createElement('score', { value: useRunFeedbackV3(model) }); }
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(Screen)); });
    const score = () => renderer.root.findByType('score').props.value;
    assert.equal(score().overall.status, 'Online feedback unavailable');
    assert.deepEqual(h.calls, []);
    assert.deepEqual(h.selectedCalls, []);
    await act(async () => {
      h.online = true;
      h.privacyListeners.forEach(listener => listener());
    });
    assert.equal(h.selectedCalls.length, 1);
    h.selectedRun = { enabled: true, status: 'completed', scores: { overall: 67, overall_level: 'competent', withheld: [] },
      runId: 'selected', slides: [], whole: null };
    await act(async () => {
      h.online = false;
      h.privacyListeners.forEach(listener => listener());
    });
    await act(async () => { await score().update(); await score().retry(); });
    assert.equal(score().overall.score, 67);
    assert.equal(h.selectedCalls.length, 1);
  } finally { await act(async () => renderer?.unmount()); }
});

test('a selected public budget denial does not start repeated polling', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = setup({ selectedCalls: [], selectedResponse: 'public_budget_exhausted' });
  const model = { deck: { id: 'deck' }, n: 2, state: { run: { parts: [part('old'), part('new')] } }, stages: new Map() };
  function Screen() { return React.createElement('score', { value: useRunFeedbackV3(model) }); }
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(Screen)); });
    await act(async () => { t.mock.timers.tick(10000); });
    const result = renderer.root.findByType('score').props.value;
    assert.equal(result.overall.status, 'Free coaching budget too low');
    assert.equal(result.failures, false);
    assert.equal(result.missing, false);
    assert.equal(result.canRequest, false);
    await act(async () => result.retry());
    assert.equal(h.selectedCalls.length, 1);
  } finally {
    await act(async () => renderer?.unmount());
    t.mock.timers.reset();
  }
});

test('a recoverable public budget denial waits for explicit selected retry', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = setup({ selectedCalls: [], selectedResponse: 'public_budget_unavailable' });
  const model = { deck: { id: 'deck' }, n: 2, state: { run: { parts: [part('old'), part('new')] } }, stages: new Map() };
  function Screen() { return React.createElement('score', { value: useRunFeedbackV3(model) }); }
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(Screen)); });
    const score = () => renderer.root.findByType('score').props.value;
    assert.equal(score().overall.status, 'Free coaching unavailable');
    assert.equal(score().budgetRetry, true);
    assert.equal(score().canRequest, true);
    assert.equal(score().failures, true);
    await act(async () => { t.mock.timers.tick(10000); });
    assert.deepEqual(h.selectedCalls.map(call => call.action), ['check']);
    h.selectedResponse = 'available';
    await act(async () => score().retry());
    assert.deepEqual(h.selectedCalls.map(call => call.action), ['check', 'retry']);
    assert.equal(h.calls.some(([method]) => method === 'POST'), false);
  } finally {
    await act(async () => renderer?.unmount());
    t.mock.timers.reset();
  }
});

test('a newly saved score still displays if consent expires before coaching translation', async () => {
  const { getAppLanguage, setAppLanguage } = await import('../src/design/language.ts');
  const { markNewWording } = await import('../src/features/localization/firstWording.ts');
  const { parseFeedbackRun } = await import('../src/features/feedback/feedbackRun.ts');
  const runId = '761b5fc4-6c86-4c2b-a7b4-f2058b85575e';
  const saved = parseFeedbackRun({
    enabled: true, status: 'completed', run_id: runId, language: 'en',
    scores: { overall: 67, overall_level: 'competent', withheld: [] },
    slides: [{ slide_index: 0, status: 'scored', score: 67, level: 'competent' }],
    whole: { status: 'scored', summary: 'An untranslated summary.', top_priorities: [{
      title: 'Compare the outcomes', action: 'Add a concrete reason.', why: 'Engage the audience.',
    }] },
  });
  const h = setup({ online: false, runs: { old: saved } });
  const model = { deck: { id: 'deck' }, n: 1, state: { run: { parts: [part('old')] } }, stages: new Map() };
  const previousLanguage = getAppLanguage();
  markNewWording('http://host.invalid/api', 'feedback', runId);
  function Screen() { return React.createElement('score', { value: useRunFeedbackV3(model) }); }
  let renderer;
  try {
    await act(async () => { setAppLanguage('ko'); renderer = create(React.createElement(Screen)); });
    const result = renderer.root.findByType('score').props.value;
    assert.equal(result.overall.score, 67);
    assert.equal(result.preparingDisplay, false);
    assert.equal(result.canRequest, false);
    assert.deepEqual(h.calls, []);
  } finally {
    await act(async () => renderer?.unmount());
    setAppLanguage(previousLanguage);
  }
});

test('cached whole Feedback cards stay offline-ready when slide rubric and coverage translations are missing', async () => {
  const { displayTranslations } = await import('../src/features/localization/useDisplayTranslation.ts');
  const { setAppLanguage } = await import('../src/design/language.ts');
  const { parseFeedbackRun, runCards } = await import('../src/features/feedback/feedbackRun.ts');
  const id = 'e90b96ba-a00b-4f00-a434-c1e030fd494a';
  const item = { criterion: 'content', headline: 'Compare both groups', explanation: ['The first group needs context'],
    steps: ['Name both groups'], problem: 'An unused joined explanation.', action: 'An unused joined instruction.',
    example: 'Our two groups differ.', evidence: [{ kind: 'speech', id: 's', slide_index: 0, start_ms: 100, end_ms: 600, text: 'I sampled both groups.' }] };
  const priority = { title: 'Name the baseline', why: 'The baseline is missing', action: 'Introduce the baseline.' };
  const run = parseFeedbackRun({ status: 'completed', enabled: true, language: 'en', run_id: id, attempt_id: 'new',
    slides: [{ slide_index: 0, status: 'scored', improvements: [item], must_cover: [{ point: 'Uncached coverage note', status: 'partial' }],
      criteria: [{ id: 'clarity', label: 'Clarity', next_level: 'Uncached rubric advice' }]}],
    whole: { status: 'scored', top_priorities: [priority], summary: 'Uncached overall summary' } });
  const saved = {
    'slides.0.improvements.0.headline': item.headline, 'slides.0.improvements.0.explanation.0': item.explanation[0],
    'slides.0.improvements.0.steps.0': item.steps[0], 'whole.top_priorities.0.title': priority.title,
    'whole.top_priorities.0.why': priority.why, 'whole.top_priorities.0.action': priority.action,
  };
  const wording = {
    [item.headline]: '두 집단을 비교하세요.', [item.explanation[0]]: '첫 번째 집단의 배경이 필요해요.', [item.steps[0]]: '두 집단을 모두 말하세요.',
    [priority.title]: '기준값을 알려 주세요.', [priority.why]: '기준값이 빠졌어요.', [priority.action]: '먼저 기준값을 소개하세요.',
  };
  const model = { deck: { id: 'deck' }, n: 1, state: { run: { parts: [part('new')] } }, stages: new Map() };
  setup({ runs: { new: run }, get: async () => run });
  const requests = [], original = globalThis.fetch;
  function Screen({ mode }) {
    const v3 = useRunFeedbackV3(model, true, mode);
    return React.createElement('cards', { cards: runCards(v3.items, v3.overall) });
  }
  let view;
  try {
    setAppLanguage('ko');
    globalThis.fetch = async (_url, init) => {
      const { fields } = JSON.parse(init.body);
      assert.deepEqual(fields, saved);
      return Response.json({ id: 'd'.repeat(64), state: 'completed', language: 'ko',
        translations: Object.fromEntries(Object.entries(fields).map(([key, source]) => [key, wording[source]])),
        source_languages: Object.fromEntries(Object.keys(fields).map(key => [key, 'en'])) });
    };
    await displayTranslations.load({ kind: 'feedback', resource_id: id, language: 'ko', fields: saved }, false);
    globalThis.fetch = async (_url, init) => { requests.push(JSON.parse(init.body).fields); return new Response(null, { status: 503 }); };
    await act(async () => { view = create(React.createElement(Screen, { mode: 'all' })); });
    assert.deepEqual(requests, []);
    assert.equal(displayTranslations.status('ko'), 'idle');
    const cards = view.root.findByType('cards').props.cards;
    assert.deepEqual(cards.map(c => [c.headline, c.explanation, c.steps]), [
      [wording[priority.title], [wording[priority.why]], [wording[priority.action]]],
      [wording[item.headline], [wording[item.explanation[0]]], [wording[item.steps[0]]]],
    ]);
    assert.equal(cards[1].example, item.example);
    assert.equal(cards[1].evidence.text, item.evidence[0].text);
    await act(async () => view.update(React.createElement(Screen, { mode: 0 })));
    assert.ok(requests.some(fields => fields['slides.0.criteria.0.next_level'] === 'Uncached rubric advice'));
    assert.ok(requests.some(fields => fields['slides.0.must_cover.0.point'] === 'Uncached coverage note'));
    assert.equal(displayTranslations.status('ko'), 'failed');
    const previous = requests.length;
    await act(async () => view.update(React.createElement(Screen, { mode: 'all' })));
    assert.equal(displayTranslations.status('ko'), 'idle');
    assert.equal(requests.length, previous);
  } finally { if (view) await act(async () => view.unmount()); setAppLanguage('en'); globalThis.fetch = original; }
});
