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
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const review = { transcript_id: 't', deck_id: 'server-deck', transcript: { words: [{ text: 'hi', start_ms: 0, end_ms: 1 }] } };
const part = id => ({ attemptId: id, segments: [{ startMs: 0, endMs: 1000 }] });
function setup(overrides = {}) {
  globalThis.v3Host = {
    decks: [{ id: 'deck' }], states: { deck: { run: { parts: [part('old'), part('new')] }, compare: null } },
    reviews: { old: review, new: review, take: review }, eligible: ['new', 'take'], pending: [], starts: {}, calls: [],
    capability: true, get: async () => ({ enabled: true, status: 'absent', runId: null }), post: async () => ({ enabled: true, status: 'queued', runId: 'r1' }),
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
  const h = setup({ capability: null, eligible: [] });
  h.get = async id => { if (id === 'new') h.capability = true; return id === 'new' ? { enabled: true, status: 'absent', runId: null } : null; };
  await mount();
  assert.deepEqual(h.calls, [['GET', 'old'], ['GET', 'new']]);
  assert.equal(h.capability, true);
});
