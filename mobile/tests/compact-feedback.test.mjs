// OpenAI Codex, 2026-11-02: verified compact Review data regression; see docs/ai-collaboration-prompts-iteration-2.md.
// Actual validated cache/status selection and Review rendering; native view/player/hook boundaries only are fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { withFeedback, attemptId } from './helpers/feedback-fixtures.mjs';
const statusLoader = await import('./helpers/slide-review-loader.mjs'); registerHooks(statusLoader);
const { selectedSlideFeedback } = await import('../src/features/feedback/selectedSlideFeedback.ts');
const { publishSlideReview } = await import('../src/features/feedback/slideReviewStore.ts');
const { reviewKey } = await import('../src/features/transcription/reviewStorage.ts');
const { writeStored } = await import('../src/services/storage.ts');
const screenLoader = await import('./helpers/ai-overview-screen-loader.mjs'); registerHooks(screenLoader);
const React = await import('react'); const { act, create } = await import('react-test-renderer');
const { runtime } = await import('./helpers/ai-overview-screen-native.mjs');
const { ReviewScreen } = await import('../src/screens/ReviewScreen.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let serial = 0;
function setup({ findings = [], status = 'successful', stage = 'done', state = 'completed', stale = false, words = true, changedSource = false, changedVisit = false } = {}) {
  const api = `https://compact-${++serial}.synthetic.invalid/api`, local = `synthetic-compact-${serial}`;
  const review = withFeedback();
  const summary = { slide_index: 0, status, evaluation_mode: 'informative_descriptive', findings, enrichments: [] };
  const value = { attempt_id: attemptId, feedback_revision: 1, transcript_revision: 0, state, stale,
    scope: { context_id: null, slides: [{ slide_index: 0, segments: [{ start_ms: 0, end_ms: 1000 }] }] },
    review_version: 'slide-review-v3', requirements: { context_id: null, revision: null, audience: 'General audience', required_duration_seconds: 120 },
    selection: { token: '1'.repeat(64) }, retry_available: false, requires_confirmation: false, availability: { state: state === 'disabled' ? 'disabled' : 'available' }, dependency: null,
    updated_at: '2026-11-02T00:00:00Z', result: { ...review.feedback_analysis.result, review_version: 'slide-review-v3', transcript_revision: 0, stale: false, slides: [summary] } };
  writeStored(reviewKey(api, 'attempt', attemptId), review); publishSlideReview(api, value, review);
  if (!words) writeStored(reviewKey(api, 'attempt', attemptId), { ...review, transcript: { text: 'Synthetic untimed text', words: [] } });
  if (changedSource) writeStored(reviewKey(api, 'attempt', attemptId), { ...review, transcript_id: 'f'.repeat(64) });
  const deck = { id: local, title: 'Synthetic compact Review', hue: 'blue', pages: [], slides: [{ title: 'One', text: 'Synthetic slide', points: [] }, { title: 'Two', text: '', points: [] }], targets: [1, 1], text: 'ready', timing: { source: 'suggested' } };
  const model = { deck, n: 2, state: { run: { id: 'synthetic-run', parts: [{ attemptId, segments: [{ startMs: 0, endMs: changedVisit ? 900 : 1000 }] }, null], createdAt: '2026-11-02T00:00:00Z', sel: 0 } },
    times: [1, 0], lines: [], points: [[], []], ai: [{ slide: 0, category: 'clarity', observation: 'Legacy observation must not replace verified feedback' }],
    transcripts: words ? new Map([[attemptId, review.transcript]]) : new Map(), stages: new Map([[attemptId, stage]]) };
  runtime.model = model; runtime.scores = null; runtime.nav = { deckId: local, sel: 0, slide: 0, from: null, nav: null };
  runtime.routes = []; runtime.plays = []; runtime.players = []; runtime.audio = new Map();
  runtime.feedback = { ...selectedSlideFeedback(model, api), refresh: async () => {}, notice: '' };
  return { item: runtime.feedback.items[0], model };
}
function finding(category, priority, observation) {
  return { ...withFeedback().feedback_analysis.result.suggestions[0], category, priority, observation,
    ...(category === 'timing' ? { speech_quote: '', word_start: -1, word_end: -1 } : {}) };
}
async function render(run) {
  let renderer;
  try { await act(async () => { renderer = create(React.createElement(ReviewScreen)); }); await run(renderer); }
  finally { if (renderer) await act(async () => renderer.unmount()); }
}
const text = renderer => JSON.stringify(renderer.toJSON());
const rows = renderer => renderer.root.findAllByType('view').filter(node => node.props.style?.minHeight === 22);
const rowTexts = renderer => rows(renderer).map(row => row.findByType('text').props.children);
const button = (renderer,label) => renderer.root.findAllByType('pressable').find(node => node.props.accessibilityLabel === label);
const openFinding = async renderer => {
  const finding = renderer.root.findAllByType('pressable').find(node => node.props.accessibilityLabel?.startsWith('Read slide 1 feedback'));
  assert.ok(finding, 'findings provide a discoverable details button');
  assert.ok(finding.props.style.minHeight >= 44, 'the complete feedback block is a usable touch target');
  await act(async () => finding.props.onPress());
};

test('measured metrics and verified advice reach the same four compact rows with the existing icons', async () => {
  const findings = [finding('timing', 1, 'Verified timing observation'), finding('fillers', 2, 'Verified filler observation'),
    finding('content', 3, 'Verified content observation'), finding('delivery', 4, 'Verified delivery observation')];
  const { item } = setup({ findings }); assert.equal(item.status, 'reviewed');
  await render(renderer => {
    assert.deepEqual(rowTexts(renderer), ['On time', '—', 'Verified content observation', 'Verified delivery observation']);
    assert.deepEqual(rows(renderer).map(row => row.findAllByType('icon')[0].props.name), ['i-clock', 'i-bubble', 'i-flag', 'i-wave']);
    assert.doesNotMatch(text(renderer), /Legacy observation/);
    assert.equal(rows(renderer).length, 4); assert.equal(renderer.root.findAllByType('slide-feedback').length, 0);
    assert.ok(renderer.root.findAllByType('pressable').some(node => node.props.accessibilityLabel === 'Full review'));
  });
});

test('each compact category chooses its highest-priority verified finding, including audience and repetition', async () => {
  setup({ findings: [finding('graph', 1, 'First content priority'), finding('content', 2, 'Lower content priority'), finding('repetition', 3, 'Verified repetition')] });
  await render(renderer => { assert.equal(rowTexts(renderer)[2], 'First content priority'); assert.equal(rowTexts(renderer)[3], 'Verified repetition'); assert.doesNotMatch(text(renderer), /Lower content priority/); });
  setup({ findings: [finding('audience', 1, 'Verified audience observation')] });
  await render(renderer => assert.equal(rowTexts(renderer)[2], 'Verified audience observation'));
});

test('stale, failed, disabled, no-speech and untimed states never show clean claims or fabricate a zero filler count', async () => {
  for (const change of [{ stale: true }, { state: 'failed' }, { state: 'disabled' }, { stage: 'no_speech', words: false }, { words: false }, { state: 'queued' }, { changedSource: true }, { changedVisit: true }]) {
    const { item } = setup({ ...change, findings: [finding('content', 1, 'Must not leak old feedback')] });
    assert.notEqual(item.status, 'reviewed');
    await render(renderer => {
      assert.doesNotMatch(text(renderer), /Spot On!|Must not leak old feedback|Legacy observation/);
      const label = renderer.root.findAllByType('text').find(node => node.props.children === 'fillers');
      assert.equal(label.parent.findAllByType('text')[0].props.children, '—');
      assert.ok(rowTexts(renderer).includes(item.label));
    });
  }
});

test('partial assessments display only verified advice; a complete empty assessment says no issue flagged', async () => {
  const { item } = setup({ status: 'partial', findings: [finding('content', 1, 'Verified partial observation')] });
  assert.equal(item.assessed, false);
  await render(renderer => { assert.equal(rowTexts(renderer)[2], 'Verified partial observation'); assert.doesNotMatch(text(renderer), /Spot On!/);
    assert.ok(button(renderer, 'Read slide 1 feedback: Partially assessed'), 'the accessible button preserves the partial-assessment warning'); });
  setup(); await render(renderer => assert.deepEqual(rowTexts(renderer), ['On time', '—', 'No issue flagged', 'No issue flagged']));
});

test('the reported 17/28-second slide consistently shows under time and three fillers without a positive filler verdict', async () => {
  const { model } = setup();
  model.times[0] = 17; model.deck.targets[0] = 28;
  model.lines = [{ slide: 0, text: 'Um, uh, like, this is a synthetic example.' }];
  await render(renderer => {
    assert.deepEqual(rowTexts(renderer), ['Under time', '3 fillers', 'No issue flagged', 'No issue flagged']);
    assert.match(text(renderer), /0:28 allocation/);
    assert.doesNotMatch(text(renderer), /required target|On target|Spot On!/);
    const rows = renderer.root.findAllByType('text').filter(node => node.props.children === 'Under time');
    assert.equal(rows.length, 2, 'the compact timing row and slide card share the same rule');
    assert.equal(renderer.root.findAllByType('icon').filter(node => node.props.name === 'i-arrow').length, 0, 'a duration status alone is not generated advice');
  });
});

test('compact metric labels preserve full timing and filler advice in the existing details view', async () => {
  const timing = finding('timing', 1, 'Verified timing observation');
  const fillers = finding('fillers', 2, 'Verified filler observation');
  timing.suggestion = 'Shorten the example before the next rehearsal.';
  fillers.suggestion = 'Use a brief pause between these ideas.';
  setup({ findings: [timing, fillers] });
  await render(async renderer => {
    await openFinding(renderer);
    const details = renderer.root.findByType('scroll');
    for (const value of [timing.observation, timing.suggestion, fillers.observation, fillers.suggestion]) {
      assert.ok(details.findAllByType('text').some(node => node.props.children === value), value);
    }
  });
});

test('long feedback opens complete text in a bounded scroll area and closes without navigation', async () => {
  const observation = 'The sentence repeats the location and capital information. ' + 'Explain the important distinction clearly. '.repeat(10);
  const otherObservation = 'A second finding must also be readable in full.';
  setup({ findings: [finding('content', 1, observation), finding('delivery', 2, otherObservation)] });
  await render(async renderer => {
    await openFinding(renderer);
    const scroll = renderer.root.findByType('scroll');
    const detail = scroll.findAllByType('text').find(node => node.props.children === observation);
    assert.ok(detail); assert.equal(detail.props.numberOfLines, undefined);
    assert.ok(scroll.findAllByType('text').some(node => node.props.children === otherObservation));
    const card = renderer.root.findAllByType('view').find(node => node.props.accessibilityViewIsModal);
    assert.ok(card.props.style[0].top > 0 && card.props.style[0].bottom > 0, 'scroll parent is bounded inside the design frame');
    assert.equal(scroll.props.style.flex, 1);
    const background = renderer.root.findAllByType('animated').find(node => node.props.pointerEvents === 'none');
    assert.ok(background); assert.equal(background.props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(background.props.accessibilityElementsHidden, true);
    const pan = renderer.root.findAllByType('pan')[0];
    assert.equal(pan.props.onMoveShould({ nativeEvent: { pageY: 500 } }, { dx: 0, dy: 100 }), false);
    await act(async () => button(renderer, 'Close feedback details').props.onPress());
    assert.equal(renderer.root.findAllByType('scroll').length, 0); assert.deepEqual(runtime.routes, []);
    await openFinding(renderer);
    await act(async () => assert.equal(runtime.back(), true));
    assert.equal(renderer.root.findAllByType('scroll').length, 0); assert.deepEqual(runtime.routes, []);
    await act(async () => runtime.back());
    assert.equal(runtime.routes[0][0], 'rehearse');
  });
});

test('feedback details show changed status honestly and close when selected slide, source recording or active screen changes', async () => {
  for (const change of ['stale', 'slide', 'source', 'inactive']) {
    setup({ findings: [finding('content', 1, 'Only the current verified observation may be expanded')] });
    await render(async renderer => {
      await openFinding(renderer);
      const currentFeedback = runtime.feedback;
      if (change === 'stale') runtime.feedback = { ...runtime.feedback, items: runtime.feedback.items.map(item => ({ ...item, status: 'outdated', assessed: false, findings: [], label: 'Feedback out of date' })) };
      if (change === 'slide') runtime.nav = { ...runtime.nav, sel: 1 };
      if (change === 'source') runtime.model.state.run.parts[0] = { ...runtime.model.state.run.parts[0], attemptId: 'different-recording' };
      await act(async () => renderer.update(React.createElement(ReviewScreen, { active: change !== 'inactive' })));
      assert.equal(renderer.root.findAllByType('scroll').length, change === 'stale' ? 1 : 0, change);
      if (change === 'stale') {
        assert.match(text(renderer), /Feedback out of date/);
        assert.doesNotMatch(text(renderer), /Only the current verified observation may be expanded/);
        await act(async () => button(renderer, 'Close feedback details').props.onPress());
        runtime.feedback = currentFeedback;
        await act(async () => renderer.update(React.createElement(ReviewScreen)));
        assert.equal(renderer.root.findAllByType('scroll').length, 0, 'revalidated feedback stays closed until requested');
      }
      if (change === 'inactive') {
        await act(async () => renderer.update(React.createElement(ReviewScreen)));
        assert.equal(renderer.root.findAllByType('scroll').length, 0);
      }
    });
  }
});
