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

test('verified selected-slide observations reach the same four compact rows with the existing icons', async () => {
  const findings = [finding('timing', 1, 'Verified timing observation'), finding('fillers', 2, 'Verified filler observation'),
    finding('content', 3, 'Verified content observation'), finding('delivery', 4, 'Verified delivery observation')];
  const { item } = setup({ findings }); assert.equal(item.status, 'reviewed');
  await render(renderer => {
    assert.deepEqual(rowTexts(renderer), findings.map(value => value.observation));
    assert.deepEqual(rows(renderer).map(row => row.findByType('icon').props.name), ['i-clock', 'i-bubble', 'i-flag', 'i-wave']);
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

test('partial assessments display only their verified findings; a complete empty assessment may show Spot On', async () => {
  const { item } = setup({ status: 'partial', findings: [finding('content', 1, 'Verified partial observation')] });
  assert.equal(item.assessed, false);
  await render(renderer => { assert.equal(rowTexts(renderer)[2], 'Verified partial observation'); assert.doesNotMatch(text(renderer), /Spot On!/); });
  setup(); await render(renderer => assert.deepEqual(rowTexts(renderer), ['Spot On!', 'Spot On!', 'Spot On!', 'Spot On!']));
});
