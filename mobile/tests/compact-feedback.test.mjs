// OpenAI Codex, 2026-11-02: verified compact Review data regression; see docs/ai-collaboration/README.md#prompt-logs.
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
// Claude, 2026-11-21: the chips became three facts beside the slide thumbnail; the pop-up became the last page.
const rowTexts = renderer => renderer.root.findAllByType('text').map(node => node.props.children).filter(value => / planned$| fillers?$|points said$|^No slide points$/.test(String(value)));
const showIssue = async (renderer,index) => act(async()=>button(renderer,`Show issue ${index}`).props.onPress());
const button = (renderer,label) => renderer.root.findAllByType('pressable').find(node => node.props.accessibilityLabel === label);
const openFinding = async renderer => {
  const last = button(renderer, 'Show grades and actions');
  assert.ok(last, 'the last page (grades and actions) is reachable from the page dots');
  await act(async () => last.props.onPress());
};

test('measured metrics and verified advice reach the slide facts and the review pages', async () => {
  const findings = [finding('timing', 1, 'Verified timing observation'), finding('fillers', 2, 'Verified filler observation'),
    finding('content', 3, 'Verified content observation'), finding('delivery', 4, 'Verified delivery observation')];
  const { item } = setup({ findings }); assert.equal(item.status, 'reviewed');
  await render(async renderer => {
    assert.deepEqual(rowTexts(renderer), ['0:01 of 0:01 planned', '— fillers', 'No slide points']);
    assert.match(text(renderer), /Verified filler observation/);
    await showIssue(renderer,2);assert.match(text(renderer), /Verified content observation/);
    await showIssue(renderer,3);assert.match(text(renderer), /Verified delivery observation/);
    assert.doesNotMatch(text(renderer), /Legacy observation/);
    assert.equal(renderer.root.findAllByType('slide-feedback').length, 0);
    await openFinding(renderer);assert.match(text(renderer), /Verified timing observation/);
  });
});

test('verified issues preserve priority across content, audience and repetition', async () => {
  setup({ findings: [finding('graph', 1, 'First content priority'), finding('content', 2, 'Lower content priority'), finding('repetition', 3, 'Verified repetition')] });
  await render(async renderer => {
    assert.match(text(renderer),/First content priority/);assert.doesNotMatch(text(renderer),/Lower content priority/);
    await showIssue(renderer,2);assert.match(text(renderer),/Lower content priority/);
    await showIssue(renderer,3);assert.match(text(renderer),/Verified repetition/);
  });
  setup({ findings: [finding('audience', 1, 'Verified audience observation')] });
  await render(renderer => assert.match(text(renderer),/Verified audience observation/));
});

test('switching review pages replaces the previous feedback without a layout event', async () => {
  setup({ findings: [finding('content', 1, 'First complete review'), finding('delivery', 2, 'Second complete review')] });
  await render(async renderer => {
    assert.match(text(renderer), /First complete review/);
    await showIssue(renderer, 2);
    assert.doesNotMatch(text(renderer), /First complete review/);
    assert.match(text(renderer), /Second complete review/);
  });
});

test('stale, failed, disabled, no-speech and untimed states never claim clean feedback or fabricate filler counts', async () => {
  for (const change of [{ stale: true }, { state: 'failed' }, { state: 'disabled' }, { stage: 'no_speech', words: false }, { words: false }, { state: 'queued' }, { changedSource: true }, { changedVisit: true }]) {
    const { item } = setup({ ...change, findings: [finding('content', 1, 'Must not leak old feedback')] });
    assert.notEqual(item.status, 'reviewed');
    await render(async renderer => {
      assert.doesNotMatch(text(renderer), /Spot On!|Nothing to fix|Must not leak old feedback|Legacy observation/);
      assert.ok(rowTexts(renderer).includes('— fillers'));
      await openFinding(renderer);assert.ok(text(renderer).includes(item.label));
    });
  }
});

test('partial assessments display only verified advice; a complete empty assessment may say nothing to fix', async () => {
  const { item } = setup({ status: 'partial', findings: [finding('content', 1, 'Verified partial observation')] });
  assert.equal(item.assessed, false);
  await render(renderer => {assert.match(text(renderer), /Verified partial observation/);assert.doesNotMatch(text(renderer), /Nothing to fix/);
    assert.ok(button(renderer, 'Show grades and actions'));});
  setup();await render(renderer=>{assert.deepEqual(rowTexts(renderer),['0:01 of 0:01 planned','— fillers','No slide points']);assert.match(text(renderer),/Nothing to fix on this slide/);});
});

test('the reported 17/28-second slide shows under time and three measured fillers without a positive filler verdict', async () => {
  const { model } = setup();
  model.times[0] = 17; model.deck.targets[0] = 28;
  model.lines = [{ slide: 0, text: 'Um, uh, like, this is a synthetic example.' }];
  await render(renderer => {
    assert.deepEqual(rowTexts(renderer), ['0:17 of 0:28 planned', '3 fillers', 'No slide points']);
    assert.doesNotMatch(text(renderer), /required target|On target|Spot On!/);
    assert.equal(renderer.root.findAllByType('pressable').filter(n=>n.props.accessibilityLabel?.startsWith('Show issue')).length,0);
  });
});

test('timing advice without a page of its own stays in full on the last page; filler advice has its own page', async () => {
  const timing = finding('timing', 1, 'Verified timing observation');
  const fillers = finding('fillers', 2, 'Verified filler observation');
  timing.suggestion = 'Shorten the example before the next rehearsal.';
  fillers.suggestion = 'Use a brief pause between these ideas.';
  setup({ findings: [timing, fillers] });
  await render(async renderer => {
    for (const value of [fillers.observation, fillers.suggestion]) assert.ok(renderer.root.findAllByType('text').some(node => node.props.children === value), value);
    await openFinding(renderer);
    for (const value of [timing.observation, timing.suggestion]) assert.ok(renderer.root.findAllByType('text').some(node => node.props.children === value), value);
  });
});

test('long feedback is shown complete on its own page, never cut, with no pop-up; Back leaves the review', async () => {
  const observation = 'The sentence repeats the location and capital information. ' + 'Explain the important distinction clearly. '.repeat(10);
  const otherObservation = 'A second finding must also be readable in full.';
  setup({ findings: [finding('content', 1, observation), finding('delivery', 2, otherObservation)] });
  await render(async renderer => {
    const detail = renderer.root.findAllByType('text').find(node => node.props.children === observation);
    assert.ok(detail); assert.equal(detail.props.numberOfLines, undefined);
    const viewport = renderer.root.findAllByType('animated').find(node => node.props.onLayout);
    const scroll = () => renderer.root.findByType('scroll');
    await act(async () => viewport.props.onLayout({ nativeEvent: { layout: { y: 120, height: 400 } } }));
    await act(async () => scroll().props.onContentSizeChange(320, 1200));
    assert.equal(scroll().props.scrollEnabled, true);
    assert.equal(detail.props.style[1].fontSize, 22);
    await showIssue(renderer, 2);
    assert.ok(renderer.root.findAllByType('text').some(node => node.props.children === otherObservation));
    assert.equal(renderer.root.findAllByType('view').filter(node => node.props.accessibilityViewIsModal).length, 0);
    await act(async () => scroll().props.onContentSizeChange(320, 200));
    assert.equal(scroll().props.scrollEnabled, false, 'short feedback leaves vertical swipes available');
    await act(async () => assert.equal(runtime.back(), true));
    assert.equal(runtime.routes[0][0], 'rehearse');
  });
});

test('the last page shows changed status honestly and a new slide or recording starts again on its first page', async () => {
  for (const change of ['stale', 'slide', 'source']) {
    setup({ findings: [finding('content', 1, 'Only the current verified observation may be shown')] });
    await render(async renderer => {
      await openFinding(renderer);
      if (change === 'stale') runtime.feedback = { ...runtime.feedback, items: runtime.feedback.items.map(item => ({ ...item, status: 'outdated', assessed: false, findings: [], label: 'Feedback out of date' })) };
      if (change === 'slide') runtime.nav = { ...runtime.nav, sel: 1 };
      if (change === 'source') runtime.model.state.run.parts[0] = { ...runtime.model.state.run.parts[0], attemptId: 'different-recording' };
      await act(async () => renderer.update(React.createElement(ReviewScreen)));
      if (change === 'stale') { assert.match(text(renderer), /Feedback out of date/); assert.doesNotMatch(text(renderer), /Only the current verified observation may be shown/); }
      if (change === 'slide') assert.match(text(renderer), /Slide 2 of 2/);
      if (change === 'source') assert.match(text(renderer), /CONTENT · 1 OF 1/, 'a new recording opens on its first feedback page again');
    });
  }
});
