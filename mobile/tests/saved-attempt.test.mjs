import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { playback, resetPlayback } from './helpers/recording-screen-audio.mjs';
import { setFocused } from './helpers/recording-screen-ui.mjs';
import { sqliteFaults } from './helpers/sqlite-node.mjs';
import { files, network, response } from './helpers/upload-native.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { SavedAttemptScreen } = await import('../src/features/recording/SavedAttemptScreen.tsx');
const { beginAttempt, checkpointAttempt, getSavedAttempt, saveAttempt } = await import('../src/features/recording/storage.ts');
const { API_URL } = await import('../src/services/api.ts');
const action = (tree, label) => tree.root.findAllByType('action').find(n => n.props.label === label);
const text = tree => JSON.stringify(tree.toJSON());
async function tick(fn) { await act(async () => { fn(); await new Promise(setImmediate); }); }
async function mount(id) { let tree; await tick(() => { tree = create(React.createElement(SavedAttemptScreen, { id })); }); return tree; }
function saved() {
  const id = beginAttempt({ id: 'local', uri: 'file:///synthetic.pdf', title: 'Synthetic', pageCount: 2 }, '', 1, 'file:///synthetic.wav');
  checkpointAttempt(id, 'file:///synthetic.wav', 2000, [{ slide_index: 1, at_ms: 0 }], true);
  return id;
}
beforeEach(() => { resetPlayback(); setFocused(true); sqliteFaults.before = null; });

test('saved audio reopens from its URI and rewinds at end even without didJustFinish', async () => {
  const id = saved();
  let tree = await mount(id);
  await tick(() => tree.unmount());
  tree = await mount(id);
  try {
    assert.equal(playback.source, 'file:///synthetic.wav');
    await tick(() => action(tree, 'Play').props.onPress());
    assert.deepEqual(playback.seeks, [0]);
    assert.equal(playback.played, 1);
    assert.equal(text(tree).includes('SAVED TEST'), false);
  } finally { await tick(() => tree.unmount()); }
});

test('rapid replay taps serialize seeking; blur invalidates resume before its passive pause effect', async () => {
  const tree = await mount(saved());
  let finish;
  playback.wait = new Promise(resolve => { finish = resolve; });
  try {
    await tick(() => { action(tree, 'Play').props.onPress(); action(tree, 'Play').props.onPress(); });
    assert.deepEqual(playback.seeks, [0]);
    await tick(() => { setFocused(false); finish(); });
    assert.equal(playback.played, 0);
    assert.ok(playback.paused > 0);
  } finally { finish(); await tick(() => tree.unmount()); }
});

test('unmount during replay never resumes released audio', async () => {
  const tree = await mount(saved());
  let finish;
  playback.wait = new Promise(resolve => { finish = resolve; });
  await tick(() => action(tree, 'Play').props.onPress());
  await tick(() => tree.unmount());
  await tick(() => finish());
  assert.equal(playback.played, 0);
});

test('read failure presents a recoverable load action without losing the saved attempt', async () => {
  const id = saved();
  sqliteFaults.before = op => { if (op === 'get') throw new Error('database unavailable'); };
  const tree = await mount(id);
  try {
    assert.match(text(tree), /database unavailable/);
    sqliteFaults.before = null;
    await tick(() => action(tree, 'Reload saved rehearsal').props.onPress());
    assert.ok(action(tree, 'Play'));
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

test('refresh read failure after upload clears busy and exposes retry', async () => {
  const id = saved();
  files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
  network.respond = (url, init) => {
    if (url.endsWith('/decks/')) return response(201, { deck: { id: '11111111-1111-4111-8111-111111111111', page_count: 2 } });
    if (url.includes('/decks/')) return response(200, { id: '11111111-1111-4111-8111-111111111111', page_count: 2 });
    sqliteFaults.before = op => { if (op === 'get') throw new Error('refresh unavailable'); };
    return response(201, { attempt_id: id });
  };
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Upload recording').props.onPress());
    assert.match(text(tree), /refresh unavailable/);
    assert.equal(action(tree, 'Uploading…'), undefined);
    assert.notEqual(action(tree, 'Upload recording').props.disabled, true);
    sqliteFaults.before = null;
    await tick(() => action(tree, 'Upload recording').props.onPress());
    assert.match(text(tree), /Uploaded · awaiting analysis/);
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

test('upload action and awaiting-analysis state are scoped to the configured server', async () => {
  const id = saved();
  saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: 'http://old.invalid/api' });
  let tree = await mount(id);
  try { assert.ok(action(tree, 'Upload recording')); assert.doesNotMatch(text(tree), /Uploaded · awaiting analysis/); }
  finally { await tick(() => tree.unmount()); }
  saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: API_URL });
  tree = await mount(id);
  try { assert.equal(action(tree, 'Upload recording'), undefined); assert.match(text(tree), /Uploaded · awaiting analysis/); }
  finally { await tick(() => tree.unmount()); }
});

for (const alreadyUploaded of [false, true]) {
  test(`switching API then tapping Upload sends the saved recording only to the selected server (previously uploaded: ${alreadyUploaded})`, async () => {
    const id = saved();
    const original = getSavedAttempt(id).recording;
    const selectedApi = 'http://selected.invalid/api';
    const selectedDeck = '22222222-2222-4222-8222-222222222222';
    files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
    if (alreadyUploaded) saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: API_URL });
    network.respond = () => response(200, analysisResult(id));
    const tree = await mount(id);
    try {
      await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id, apiUrl: `${selectedApi}/` })));
      network.requests.length = 0;
      network.respond = (url, init) => {
        if (url === `${selectedApi}/decks/`) return response(201, { deck: { id: selectedDeck, page_count: 2 } });
        if (url === `${selectedApi}/decks/${selectedDeck}/`) return response(200, { id: selectedDeck, page_count: 2 });
        if (url === `${selectedApi}/attempts/`) return response(201, { attempt_id: id });
        if (url === `${selectedApi}/attempts/${id}/` && init.method !== 'POST') return response(200, analysisResult(id));
        throw new Error(`Wrong upload destination: ${url}`);
      };
      await tick(() => { const upload = action(tree, 'Upload recording'); upload.props.onPress(); upload.props.onPress(); });
      const uploads = network.requests.filter(r => r.url === `${selectedApi}/attempts/`);
      assert.equal(uploads.length, 1);
      assert.deepEqual(JSON.parse(uploads[0].body.get('metadata')), {
        id, deck_id: selectedDeck, duration_ms: original.duration_ms, audience: original.audience, slide_events: original.slide_events,
      });
      assert.ok(network.requests.every(r => r.url.startsWith(`${selectedApi}/`)));
      assert.equal(network.requests.some(r => r.url.includes('/process/')), false);
      assert.equal(getSavedAttempt(id).server_url, selectedApi);
      assert.equal(getSavedAttempt(id).recording.audio_uri, original.audio_uri);
      assert.match(text(tree), /Uploaded · awaiting analysis/);
      assert.ok(action(tree, 'Analyze recording'));
      await tick(() => action(tree, 'Play').props.onPress());
      assert.equal(playback.played, 1);
    } finally { await tick(() => tree.unmount()); }
  });
}

test('switching API during upload ignores the old failure and retains the new upload and replay', async () => {
  const id = saved();
  const selectedApi = 'http://pending-switch.invalid/api';
  const deck = '11111111-1111-4111-8111-111111111111';
  files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
  let failOld;
  network.respond = (url, init) => {
    if (url === `${API_URL}/attempts/`) return new Promise((_resolve, reject) => { failOld = () => reject(new Error('old-server upload failed')); });
    if (url.endsWith('/decks/')) return response(201, { deck: { id: deck, page_count: 2 } });
    if (url.includes('/decks/')) return response(200, { id: deck, page_count: 2 });
    if (url === `${selectedApi}/attempts/`) return response(201, { attempt_id: id });
    return response(200, analysisResult(id));
  };
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Upload recording').props.onPress());
    assert.ok(failOld);
    await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id, apiUrl: selectedApi })));
    assert.notEqual(action(tree, 'Upload recording')?.props.disabled, true);
    await tick(() => action(tree, 'Upload recording').props.onPress());
    await tick(() => failOld());
    assert.equal(getSavedAttempt(id).server_url, selectedApi);
    assert.equal(getSavedAttempt(id).state, 'submitted');
    assert.doesNotMatch(text(tree), /old-server upload failed/);
    assert.ok(action(tree, 'Analyze recording'));
    assert.equal(network.requests.filter(r => r.url.endsWith('/attempts/')).length, 2);
    await tick(() => action(tree, 'Play').props.onPress());
    assert.equal(playback.played, 1);
  } finally { failOld?.(); await tick(() => tree.unmount()); }
});

test('Analyze requires disclosure; Cancel sends nothing and rapid Continue sends one process request', async () => {
  const id = saved();
  saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: API_URL });
  network.requests.length = 0;
  network.respond = (url, init) => response(init.method === 'POST' ? 202 : 200, analysisResult(id, init.method === 'POST' ? 'queued' : 'awaiting_analysis'));
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Analyze recording').props.onPress());
    assert.match(text(tree), /OpenAI/);
    await tick(() => action(tree, 'Cancel').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
    await tick(() => action(tree, 'Analyze recording').props.onPress());
    await tick(() => { const next = action(tree, 'Continue'); next.props.onPress(); next.props.onPress(); });
    assert.equal(network.requests.filter(r => r.method === 'POST').length, 1);
    assert.ok(action(tree, 'Play'));
  } finally { await tick(() => tree.unmount()); }
});

function analysisResult(id, state = 'awaiting_analysis', extra = {}) {
  const complete = state === 'completed';
  const failed = ['failed', 'needs_confirmation'].includes(state);
  return { attempt_id: id, status: complete ? 'completed' : failed ? 'failed' : state === 'awaiting_analysis' ? 'pending' : 'processing',
    duration_ms: 2000, processing_state: state, processing_revision: state === 'awaiting_analysis' ? 0 : 1,
    failed_stage: failed ? 'transcribing' : null, retry_available: failed, retry_at: null,
    requires_confirmation: state === 'needs_confirmation', partial_available: { transcript: complete, alignment: complete },
    transcript: complete ? { text: 'A real synthetic fixture transcript', words: [{ text: 'fixture', start_ms: 10, end_ms: 30 }] } : null,
    visits: complete ? [{ slide_index: 1, start_ms: 0, end_ms: 2000, words: [{ text: 'fixture', start_ms: 10, end_ms: 30 }] }] : null,
    metrics: complete ? { duration_ms: 2000, time_per_slide: [{ slide_index: 1, duration_ms: 2000 }], detected_language: 'english', speaking_rates: [], rate_note: 'Estimate' } : null,
    analysis_outcome: complete ? 'speech' : null, feedback_state: 'disabled', feedback: [],
    error: failed ? { code: 'provider_timeout', message: 'Refresh before retrying.' } : null,
    provenance: { provider: null, model: null, generation: null, outcome: null, speech_gate: null }, ...extra };
}

const { readAnalysis, saveAnalysisConsent } = await import('../src/features/transcription/analysisStorage.ts');
const { removeStored } = await import('../src/services/storage.ts');
const { backgroundApp } = await import('./helpers/recording-screen-ui.mjs');
const { players } = await import('./helpers/recording-screen-audio.mjs');
beforeEach(() => { removeStored('analysis-consent:openai:v1'); network.requests.length = 0; network.respond = null; backgroundApp('active'); });
function uploaded() {
  const id = saved(); saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: API_URL }); return id;
}

function automaticRecording() {
  const id = saved();
  saveAttempt({ ...getSavedAttempt(id), local_deck_id: `automatic-${id}`, auto_process_api: API_URL });
  files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
  let latest = analysisResult(id);
  network.respond = (url, init) => {
    if (url.endsWith('/decks/')) return response(201, { deck: { id: '11111111-1111-4111-8111-111111111111', page_count: 2 } });
    if (url.includes('/decks/')) return response(200, { id: '11111111-1111-4111-8111-111111111111', page_count: 2 });
    if (url.endsWith('/attempts/')) return response(201, { attempt_id: id });
    if (url.endsWith('/process/')) { latest = analysisResult(id, 'queued'); return response(202, latest); }
    return response(200, latest);
  };
  return id;
}

test('a newly finished recording uploads then starts transcription once without an Analyze tap', async () => {
  const id = automaticRecording(); saveAnalysisConsent();
  const original = getSavedAttempt(id).recording;
  let tree = await mount(id);
  try {
    await tick(() => {});
    const posts = network.requests.filter(r => r.method === 'POST');
    assert.deepEqual(posts.map(r => r.url.split('/api')[1]), ['/decks/', '/attempts/', `/attempts/${id}/process/`]);
    assert.equal(getSavedAttempt(id).auto_process_api, undefined);
    assert.equal(getSavedAttempt(id).recording.audio_uri, original.audio_uri);
    assert.deepEqual(getSavedAttempt(id).recording.slide_events, original.slide_events);
    await tick(() => tree.unmount()); tree = await mount(id);
    await tick(() => action(tree, 'Refresh').props.onPress());
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 1);
  } finally { await tick(() => tree.unmount()); }
});

test('automatic transcription shows first-use disclosure; cancellation survives reopening', async () => {
  const id = automaticRecording();
  let tree = await mount(id);
  try {
    await tick(() => {});
    assert.ok(action(tree, 'Continue'));
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 0);
    await tick(() => action(tree, 'Cancel').props.onPress());
    await tick(() => tree.unmount()); tree = await mount(id);
    assert.equal(action(tree, 'Continue'), undefined);
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 0);
    await tick(() => action(tree, 'Analyze recording').props.onPress());
    await tick(() => action(tree, 'Continue').props.onPress());
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 1);
  } finally { await tick(() => tree.unmount()); }
});

test('cancelling disclosure while the first status read is pending cancels the automatic prompt too', async () => {
  const id = automaticRecording();
  const respond = network.respond;
  let finishRead;
  network.respond = (url, init) => url.endsWith(`/attempts/${id}/`) && init.method !== 'POST'
    ? new Promise(resolve => { finishRead = resolve; }) : respond(url, init);
  const tree = await mount(id);
  try {
    await tick(() => {});
    assert.ok(finishRead);
    await tick(() => action(tree, 'Analyze recording').props.onPress());
    await tick(() => action(tree, 'Cancel').props.onPress());
    await tick(() => finishRead(response(200, analysisResult(id))));
    assert.equal(!!action(tree, 'Continue'), false);
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 0);
  } finally { await tick(() => tree.unmount()); }
});

test('failed automatic upload stays playable and a manual upload retry starts transcription', async () => {
  const id = automaticRecording(); saveAnalysisConsent();
  const respond = network.respond;
  network.respond = () => { throw new Error('offline'); };
  const tree = await mount(id);
  try {
    await tick(() => {});
    assert.equal(getSavedAttempt(id).state, 'upload_failed');
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 0);
    await tick(() => action(tree, 'Play').props.onPress()); assert.equal(playback.played, 1);
    network.respond = respond;
    await tick(() => action(tree, 'Upload recording').props.onPress());
    await tick(() => {});
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 1);
  } finally { await tick(() => tree.unmount()); }
});

test('automatic handoff waits for foreground and never follows a different API destination', async () => {
  const id = automaticRecording(); saveAnalysisConsent();
  backgroundApp('background');
  let tree = await mount(id);
  try {
    assert.equal(network.requests.length, 0);
    await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id, apiUrl: 'http://other.invalid/api' })));
    await tick(() => backgroundApp('active'));
    assert.equal(network.requests.length, 0);
    assert.equal(getSavedAttempt(id).auto_process_api, API_URL);
    await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id })));
    await tick(() => {});
    assert.equal(network.requests.filter(r => r.url.endsWith('/process/')).length, 1);
    assert.ok(network.requests.every(r => r.url.startsWith(API_URL)));
  } finally { await tick(() => tree.unmount()); }
});

for (const stage of ['queued', 'completed', 'failed', 'needs_confirmation']) {
  test(`automatic handoff never resubmits a server result in ${stage}`, async () => {
    const id = automaticRecording(); saveAnalysisConsent();
    saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: API_URL });
    network.respond = () => response(200, analysisResult(id, stage));
    const tree = await mount(id);
    try {
      await tick(() => {});
      assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
      if (stage === 'needs_confirmation') assert.ok(action(tree, 'Retry analysis'));
    } finally { await tick(() => tree.unmount()); }
  });
}

test('consent save failure does not send audio and leaves replay available', async () => {
  const id = uploaded();
  network.respond = () => response(200, analysisResult(id));
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Analyze recording').props.onPress());
    sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
    await tick(() => action(tree, 'Continue').props.onPress());
    assert.match(text(tree), /Could not save consent/);
    assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
    await tick(() => action(tree, 'Play').props.onPress());
    assert.equal(playback.played, 1);
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

test('uncertain retry requires confirmation and refresh; repeated Continue posts one revision', async () => {
  const id = uploaded(); saveAnalysisConsent();
  let latest = analysisResult(id, 'needs_confirmation');
  network.respond = (_url, init) => {
    if (init.method === 'POST') { latest = analysisResult(id, 'queued', { processing_revision: 2 }); return response(202, latest); }
    return response(200, latest);
  };
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Retry analysis').props.onPress());
    assert.match(text(tree), /may already have been charged/);
    await tick(() => action(tree, 'Cancel').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
    await tick(() => action(tree, 'Retry analysis').props.onPress());
    await tick(() => { const next = action(tree, 'Continue'); next.props.onPress(); next.props.onPress(); });
    const posts = network.requests.filter(r => r.method === 'POST');
    assert.equal(posts.length, 1);
    assert.deepEqual(JSON.parse(posts[0].body), { processing_revision: 1, acknowledge_uncertain: true });
  } finally { await tick(() => tree.unmount()); }
});

test('offline reopening preserves a cached partial transcript and local audio', async () => {
  const id = uploaded();
  const partial = analysisResult(id, 'failed', { transcript: { text: 'Partial words outside duration', words: [{ text: 'partial', start_ms: 1900, end_ms: 3000 }] }, partial_available: { transcript: true, alignment: false } });
  network.respond = () => response(200, partial);
  let tree = await mount(id);
  await tick(() => tree.unmount());
  network.respond = () => { throw new Error('offline'); };
  tree = await mount(id);
  try {
    assert.match(text(tree), /Partial words outside duration/);
    assert.match(text(tree), /Could not refresh/);
    assert.deepEqual(readAnalysis(API_URL, id), partial);
    await tick(() => action(tree, 'Play').props.onPress());
    assert.equal(playback.played, 1);
    await tick(() => action(tree, 'Retry analysis').props.onPress());
    await tick(() => action(tree, 'Continue').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
  } finally { await tick(() => tree.unmount()); }
});

for (const state of ['completed', 'failed', 'awaiting_analysis']) {
  test(`A → B upload → A offline keeps its own cached analysis visible (${state})`, async () => {
    const id = uploaded();
    const original = getSavedAttempt(id).recording;
    const otherApi = 'http://cache-switch.invalid/api';
    const deck = '22222222-2222-4222-8222-222222222222';
    const cached = analysisResult(id, state, state === 'failed' ? {
      transcript: { text: 'Synthetic partial transcript from API A', words: [{ text: 'partial', start_ms: 1900, end_ms: 3000 }] },
      partial_available: { transcript: true, alignment: false },
    } : {});
    files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
    network.respond = () => response(200, cached);
    let tree = await mount(id);
    try {
      assert.deepEqual(readAnalysis(API_URL, id), cached);
      await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id, apiUrl: otherApi })));
      assert.doesNotMatch(text(tree), /Recording analysis/);
      network.respond = (url, init) => {
        if (url === `${otherApi}/decks/`) return response(201, { deck: { id: deck, page_count: 2 } });
        if (url === `${otherApi}/decks/${deck}/`) return response(200, { id: deck, page_count: 2 });
        if (url === `${otherApi}/attempts/`) return response(201, { attempt_id: id });
        if (url === `${otherApi}/attempts/${id}/` && init.method !== 'POST') return response(200, analysisResult(id, 'completed', {
          transcript: { text: 'Synthetic transcript from API B', words: [] },
        }));
        throw new Error(`Unexpected destination: ${url}`);
      };
      await tick(() => action(tree, 'Upload recording').props.onPress());
      assert.equal(getSavedAttempt(id).server_url, otherApi);
      assert.match(text(tree), /Synthetic transcript from API B/);
      await tick(() => tree.unmount());
      network.requests.length = 0;
      network.respond = () => { throw new Error('offline'); };
      tree = await mount(id);
      assert.match(text(tree), /Recording analysis/);
      if (cached.transcript) assert.ok(text(tree).includes(cached.transcript.text));
      if (state === 'failed') assert.match(text(tree), /Saved partial transcript/);
      assert.doesNotMatch(text(tree), /Synthetic transcript from API B/);
      assert.ok(action(tree, 'Upload recording'));
      assert.equal(action(tree, 'Analyze recording'), undefined);
      assert.equal(action(tree, 'Retry analysis'), undefined);
      assert.match(text(tree), /Could not refresh/);
      assert.equal(network.requests.length, 1);
      await tick(() => action(tree, 'Refresh').props.onPress());
      assert.equal(network.requests.length, 2);
      assert.ok(network.requests.every(r => r.url === `${API_URL}/attempts/${id}/` && r.method !== 'POST'));
      assert.deepEqual(readAnalysis(API_URL, id), cached);
      assert.equal(getSavedAttempt(id).recording.audio_uri, original.audio_uri);
      assert.deepEqual(getSavedAttempt(id).recording.slide_events, original.slide_events);
      await tick(() => action(tree, 'Play').props.onPress());
      assert.equal(playback.played, 1);
      // Reconnection refreshes A without uploading again or enabling provider work.
      const refreshed = analysisResult(id, 'completed', { transcript: { text: 'Refreshed synthetic API A transcript', words: [] } });
      network.respond = () => response(200, refreshed);
      await tick(() => action(tree, 'Refresh').props.onPress());
      assert.match(text(tree), /Refreshed synthetic API A transcript/);
      assert.deepEqual(readAnalysis(API_URL, id), refreshed);
      assert.equal(getSavedAttempt(id).server_url, otherApi);
      assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
    } finally { await tick(() => tree.unmount()); }
  });
}

test('API address changes isolate the cache and ignore an old pending callback', async () => {
  const id = uploaded();
  let resolve;
  network.respond = () => new Promise(r => { resolve = r; });
  const tree = await mount(id);
  const request = network.requests[0];
  try {
    await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id, apiUrl: 'http://different.invalid/api' })));
    assert.equal(request.signal.aborted, true);
    await tick(() => resolve(response(200, analysisResult(id, 'completed'))));
    assert.doesNotMatch(text(tree), /A real synthetic fixture transcript/);
    assert.equal(readAnalysis(API_URL, id), null);
    assert.equal(readAnalysis('http://different.invalid/api', id), null);
    assert.ok(action(tree, 'Upload recording'));
    await tick(() => action(tree, 'Play').props.onPress());
    assert.equal(playback.played, 1);
  } finally { await tick(() => tree.unmount()); }
});

test('background and blur cancel active polling, stale completions do not update cache', async () => {
  const id = uploaded();
  let resolve;
  network.respond = () => new Promise(r => { resolve = r; });
  const tree = await mount(id);
  try {
    const pending = network.requests[0];
    await tick(() => backgroundApp('background'));
    assert.equal(pending.signal.aborted, true);
    await tick(() => resolve(response(200, analysisResult(id, 'completed'))));
    assert.equal(readAnalysis(API_URL, id), null);
    await tick(() => backgroundApp('active'));
    const foreground = network.requests.at(-1);
    await tick(() => setFocused(false));
    assert.equal(foreground.signal.aborted, true);
    await tick(() => resolve(response(200, analysisResult(id, 'completed'))));
    assert.equal(readAnalysis(API_URL, id), null);
  } finally { await tick(() => tree.unmount()); }
});

test('polling timer is cancelled on navigation and offline polling keeps its cache', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const id = uploaded();
  network.respond = () => response(200, analysisResult(id, 'transcribing'));
  const tree = await mount(id);
  try {
    network.respond = () => { throw new Error('offline'); };
    await tick(() => t.mock.timers.tick(2000));
    assert.match(text(tree), /Could not refresh/);
    assert.equal(readAnalysis(API_URL, id).processing_state, 'transcribing');
    const count = network.requests.length;
    await tick(() => t.mock.timers.tick(10000));
    assert.equal(network.requests.length, count);
    network.respond = () => response(200, analysisResult(id, 'transcribing'));
    await tick(() => action(tree, 'Refresh').props.onPress());
    await tick(() => setFocused(false));
    const afterBlur = network.requests.length;
    await tick(() => t.mock.timers.tick(3000));
    assert.equal(network.requests.length, afterBlur);
  } finally { await tick(() => tree.unmount()); t.mock.timers.reset(); }
});

test('a timed-out processing request refreshes without retrying or marking the server failed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const id = uploaded(); saveAnalysisConsent();
  let started = false;
  network.respond = (_url, init) => {
    if (init.method === 'POST') {
      started = true;
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    return response(200, analysisResult(id, started ? 'transcribing' : 'awaiting_analysis'));
  };
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Analyze recording').props.onPress());
    await tick(() => t.mock.timers.tick(60000));
    assert.equal(network.requests.filter(r => r.method === 'POST').length, 1);
    assert.equal(readAnalysis(API_URL, id).status, 'processing');
    assert.match(text(tree), /outcome is unconfirmed/);
    assert.ok(action(tree, 'Play'));
  } finally { await tick(() => tree.unmount()); t.mock.timers.reset(); }
});

test('changing attempts releases the old player and prevents an old seek from resuming', async () => {
  const first = saved();
  const tree = await mount(first);
  const oldPlayer = players.at(-1);
  let finish;
  playback.wait = new Promise(r => { finish = r; });
  try {
    await tick(() => action(tree, 'Play').props.onPress());
    const next = saved();
    await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id: next })));
    assert.equal(oldPlayer.released, true);
    assert.notEqual(players.at(-1), oldPlayer);
    await tick(() => finish());
    assert.equal(playback.played, 0);
    assert.throws(() => oldPlayer.play(), /released/);
  } finally { finish(); await tick(() => tree.unmount()); }
});

test('cache write failure leaves a received transcript visible and never changes upload metadata', async () => {
  const id = uploaded();
  const original = getSavedAttempt(id);
  network.respond = () => response(200, analysisResult(id, 'completed'));
  sqliteFaults.before = op => { if (op === 'run') throw new Error('cache full'); };
  const tree = await mount(id);
  try {
    assert.match(text(tree), /A real synthetic fixture transcript/);
    assert.match(text(tree), /offline cache could not be saved/);
    assert.deepEqual(getSavedAttempt(id), original);
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});
