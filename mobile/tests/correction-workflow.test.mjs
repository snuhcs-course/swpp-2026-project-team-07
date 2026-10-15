import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/correction-store-loader.mjs';
import { withFeedback, attemptId, transcriptId, descriptionState, descriptionSelection, setId } from './helpers/feedback-fixtures.mjs';
registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { useTranscriptCorrections } = await import('../src/features/presentations/useTranscriptCorrections.ts');
const { writeStored } = await import('../src/services/storage.ts');
const { reviewKey } = await import('../src/features/transcription/reviewStorage.ts');
const { API_URL } = await import('../src/services/api.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const otherId = '99999999-9999-4999-8999-999999999999';
const wire = withFeedback();
for (const id of [attemptId, otherId]) writeStored(reviewKey(API_URL, 'attempt', id), { ...wire, attempt_id: id, feedback_analysis: undefined });
const model = { transcripts: new Map([[attemptId, wire.transcript], [otherId, wire.transcript]]), lines: [] };
const correction = id => ({ attempt_id: id, base_transcript_id: transcriptId, revision: 0, edits: [], effective_text: wire.transcript.text, source_changed: false });
const stt = (id, extra = {}) => ({ attempt_id: id, feedback_revision: 1, transcript_revision: 0, state: 'needs_confirmation', analysis_version: 'recognition-v2',
  updated_at: '2026-10-15T00:00:00Z', stale: false, selection: { token: '1'.repeat(64) }, retry_available: true, requires_confirmation: true,
  result: null, error: null, dependency: null, ...extra });
const response = value => new Response(JSON.stringify(value), { status: 200 });
let value;
function Probe({ id }) { value = useTranscriptCorrections(id, model); return null; }

test('retry acknowledgment cannot move to another take or changed generation; opening only reads', async () => {
  const original = globalThis.fetch, posts = [];
  let generation = 1, renderer;
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'POST') posts.push(url);
    const id = url.includes(otherId) ? otherId : attemptId;
    return response(url.endsWith('/corrections/') ? correction(id) : stt(id, { feedback_revision: generation }));
  };
  try {
    await act(async () => { renderer = create(React.createElement(Probe, { id: attemptId })); });
    assert.deepEqual(posts, []);
    await act(async () => { await value.generate(); });
    assert.equal(value.ask, true);
    const oldConfirm = value.confirm;
    await act(async () => { renderer.update(React.createElement(Probe, { id: otherId })); });
    assert.equal(value.ask, false);
    await act(async () => { oldConfirm(); value.confirm(); });
    assert.deepEqual(posts, []);
    await act(async () => { renderer.update(React.createElement(Probe, { id: attemptId })); });
    await act(async () => { await value.generate(); });
    generation = 2;
    await act(async () => { value.confirm(); await new Promise(r => setImmediate(r)); });
    assert.deepEqual(posts, []);
    assert.match(value.notice, /status changed/);
  } finally { if (renderer) await act(async () => renderer.unmount()); globalThis.fetch = original; }
});

test('failed context has a distinct explicit revisioned retry and never generates presentation feedback', async () => {
  const original = globalThis.fetch, posts = []; let renderer;
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'POST') posts.push({ url, body: JSON.parse(init.body) });
    if (url.includes('/descriptions/')) return response(descriptionState({ state: 'failed', descriptions: null, available_data: false,
      retry_available: true, requires_confirmation: false, error: { code: 'provider_rejected', message: 'Synthetic failed context' }, selection: descriptionSelection }));
    return response(url.endsWith('/corrections/') ? correction(attemptId) : stt(attemptId, { feedback_revision: 3, updated_at: '2026-10-15T00:00:03Z',
      state: 'waiting_descriptions', retry_available: false, requires_confirmation: false,
      dependency: { retry_action: 'generate_descriptions', description_set_id: setId, processing_revision: 1, requires_confirmation: false } }));
  };
  // No polling timer is needed in this interaction proof.
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) => ms === 2000 ? originalTimeout(() => {}, 0) : originalTimeout(fn, ms, ...args);
  try {
    await act(async () => { renderer = create(React.createElement(Probe, { id: attemptId })); });
    await act(async () => { await value.generate(); });
    assert.match(value.notice, /Retry slide context first/);
    await act(async () => { await value.retryContext(); });
    assert.equal(posts.length, 1);
    assert.ok(posts[0].url.endsWith('/descriptions/generate/'));
    assert.equal(posts[0].body.processing_revision, 1);
    assert.equal(posts[0].body.description_set_id, setId);
  } finally { if (renderer) await act(async () => renderer.unmount()); globalThis.fetch = original; globalThis.setTimeout = originalTimeout; }
});

test('synchronization failures expose recovery and successful sync clears it without a persistent success message', async () => {
  const original = globalThis.fetch; let renderer, online = false, posts = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'POST') posts++;
    if (url.endsWith('/corrections/')) {
      if (!online) throw new Error('Offline');
      return response(correction(otherId));
    }
    return response(stt(otherId, { feedback_revision: 0, state: 'absent', requires_confirmation: false }));
  };
  try {
    await act(async () => { renderer = create(React.createElement(Probe, { id: otherId })); });
    assert.match(value.syncError, /Could not synchronize/);
    assert.equal(value.notice, '');
    online = true;
    await act(async () => { await value.synchronize(); });
    assert.equal(value.syncError, '');
    assert.equal(value.notice, '');
    assert.equal(value.state.pending, false);
    assert.equal(posts, 0);
  } finally { if (renderer) await act(async () => renderer.unmount()); globalThis.fetch = original; }
});


test('an explicit transcription check clears a previous sync failure even when corrections need no PATCH', async () => {
  const original = globalThis.fetch; let renderer, online = false;
  globalThis.fetch = async (url, init = {}) => {
    assert.notEqual(init.method, 'POST', 'A completed current check is reused');
    if (url.endsWith('/corrections/')) {
      if (!online) throw new Error('Offline');
      return response(correction(otherId));
    }
    return response(stt(otherId, { state: 'completed', requires_confirmation: false }));
  };
  try {
    await act(async () => { renderer = create(React.createElement(Probe, { id: otherId })); });
    assert.match(value.syncError, /Could not synchronize/);
    await act(async () => { value.clearSyncError(attemptId); });
    assert.match(value.syncError, /Could not synchronize/, 'Another recording cannot clear this failure');
    online = true;
    await act(async () => { await value.generate(); });
    assert.equal(value.syncError, '');
    assert.equal(value.notice, '');
  } finally { if (renderer) await act(async () => renderer.unmount()); globalThis.fetch = original; }
});
