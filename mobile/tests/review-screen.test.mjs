import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { playback, players, resetPlayback, validationAudio } from './helpers/recording-screen-audio.mjs';
import { backgroundApp, setFocused } from './helpers/recording-screen-ui.mjs';
import { files, network, response } from './helpers/upload-native.mjs';
import { wireResult, deckWire, deckId, attemptId } from './helpers/review-fixtures.mjs';
import { sqliteFaults } from './helpers/sqlite-node.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { SavedAttemptScreen } = await import('../src/features/recording/SavedAttemptScreen.tsx');
const { parseReview, parseDeck } = await import('../src/features/transcription/reviewValidation.ts');
const { saveDeck, saveHistory, reviewKey, readReview } = await import('../src/features/transcription/reviewStorage.ts');
const { readStored, removeStored } = await import('../src/services/storage.ts');
const { getSavedAttempt, saveAttempt } = await import('../src/features/recording/storage.ts');
const { validateAudio, useMediaValidators } = await import('../src/features/transcription/nativeMediaValidation.tsx');
const { useReviewMedia } = await import('../src/features/transcription/useReviewMedia.ts');
const { useReviewPlayerStatus } = await import('../src/features/transcription/useReviewPlayerStatus.ts');
const { saveAnalysis } = await import('../src/features/transcription/analysisStorage.ts');
const api = 'http://review.invalid/api';
const deck = parseDeck(deckWire, deckId, api);
const action = (tree, label) => tree.root.findAllByType('action').find(n => n.props.label === label);
const flatten = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : node?.children ? flatten(node.children) : '';
const text = tree => flatten(tree.toJSON());
const tick = async fn => { await act(async () => { fn?.(); await new Promise(setImmediate); }); };
async function mount() { let tree; await tick(() => { tree = create(React.createElement(Placeholder)); }); return tree; }
// Keep this test file native Node syntax; JSX is only in actual source.
function Placeholder() { return React.createElement(SavedAttemptScreen, { id: attemptId, apiUrl: api }); }
function seed(value = wireResult()) {
  saveDeck(api, deck); saveHistory(api, deck, [parseReview(value, attemptId, api, deck)]);
}
function respond(url) {
  if (url.includes('/decks/') && url.endsWith('/')) return response(200, deckWire);
  if (url.includes('/attempts/')) return response(200, wireResult());
  return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
}
beforeEach(() => {
  sqliteFaults.before = null;
  resetPlayback(); backgroundApp('active'); setFocused(true); validationAudio.status = null;
  files.clear(); network.requests.length = 0; network.respond = respond;
  for (const kind of ['attempt', 'media-audio']) removeStored(reviewKey(api, kind, attemptId));
  for (const kind of ['deck', 'history', 'media-pdf']) removeStored(reviewKey(api, kind, deckId));
  for (const key of ['attempt:' + attemptId, 'pending:' + attemptId, 'deck:' + deckId, 'descriptions:' + deckId + ':33333333-3333-4333-8333-333333333333', 'consent:gemini:feedback-v1', 'consent:openai:feedback-v1']) removeStored(`feedback:v1:${encodeURIComponent(api)}:${key}`);
  removeStored(`analysis:v1:${encodeURIComponent(api)}:${attemptId}`); removeStored(`attempt:${attemptId}`);
});

test('review panels retain the same player and playing intent without requesting generation', async () => {
  seed(); const tree = await mount();
  try {
    const first = tree.root.findByType('screen').findAll(node => typeof node.type === 'string')[1];
    assert.equal(first.type, process.env.EXPO_PUBLIC_UI_LAYOUT === 'contract-test' ? 'view' : 'tab-bar', 'Alternate layout moves the player above content and tabs below it.');
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    await tick(() => action(tree, 'Play').props.onPress());
    const player = players.at(-1), played = playback.played, paused = playback.paused;
    const tabs = () => tree.root.findAllByType('tab-bar')[0];
    assert.ok(tabs(), 'Review exposes Overview, Slides and Transcript navigation');
    assert.equal(tabs().props.value, 'overview');
    for (const value of ['slides', 'transcript', 'overview']) {
      await tick(() => tabs().props.onChange(value));
      assert.equal(tabs().props.value, value);
      assert.equal(players.at(-1), player);
      let transcript = tree.root.findAllByType('text').find(n => n.props.children === 'Transcript');
      while (transcript && transcript.type !== 'panel') transcript = transcript.parent;
      assert.ok(transcript);
      assert.equal(transcript.props.visible, value === 'transcript');
      assert.ok(action(tree, 'Pause'));
    }
    assert.equal(playback.played, played); assert.equal(playback.paused, paused);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

for (const aligned of [true, false]) test(`${aligned ? 'aligned' : 'recorded'} slide timing shows actual ranges and totals across repeated and instantaneous visits`, async () => {
  const events = [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 10000 }, { slide_index: 0, at_ms: 40000 }, { slide_index: 1, at_ms: 40000 }, { slide_index: 0, at_ms: 45250 }];
  const visits = events.map((event, i) => ({ slide_index: event.slide_index, start_ms: event.at_ms, end_ms: events[i + 1]?.at_ms ?? 50000, words: [] }));
  const result = wireResult({ duration_ms: 50000, slide_events: events, visits: aligned ? visits : null, metrics: null,
    analysis_outcome: 'no_speech', transcript: { text: '', words: [] } });
  seed(result); network.respond = () => { throw Error('offline'); };
  const tree = await mount();
  try {
    await tick(() => tree.root.findAllByType('tab-bar')[0].props.onChange('slides'));
    const summary = tree.root.findAllByType('card').find(card => text({ toJSON: () => card }).includes('Time by slide'));
    assert.ok(summary, 'Timing remains readable offline before any audio download or analysis.');
    const slideRows = summary.findAllByType('view').filter(row => row.findAllByType('text').some(n => ['Slide 1', 'Slide 2'].includes(flatten(n))));
    assert.ok(slideRows.some(row => { const value = flatten(row); return value.includes('Slide 1') && value.includes('14.75 sec total') && value.includes('0–10 sec, 40–40 sec, 45.25–50 sec'); }));
    assert.ok(slideRows.some(row => { const value = flatten(row); return value.includes('Slide 2') && value.includes('35.25 sec total') && value.includes('10–40 sec, 40–45.25 sec'); }));
    const visitActions = () => tree.root.findAllByType('action').filter(n => n.props.label.startsWith('Visit '));
    assert.equal(visitActions().length, 5);
    assert.ok(visitActions().every(n => n.props.disabled));
    assert.match(visitActions()[2].props.label, /instantaneous/);
    validationAudio.status = { isLoaded: true, duration: 50, error: null };
    network.respond = url => url.includes('/decks/') ? response(200, deckWire) : url.endsWith(`/attempts/${attemptId}/`) ? response(200, result) : new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    await tick(() => visitActions()[1].props.onPress());
    await tick(() => visitActions()[4].props.onPress());
    assert.deepEqual(playback.seeks, [10, 45.25]);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

test('offline upgrade opens a local capture with only its base-stage analysis cache', async () => {
  const result = wireResult();
  saveAnalysis(api, result);
  saveAttempt({ id: attemptId, local_deck_id: 'synthetic-upgrade', title: 'Synthetic upgrade',
    pdf_uri: 'file:///upgrade.pdf', page_count: 2, created_at: result.created_at, state: 'submitted', server_url: api,
    recording: { id: attemptId, deck_id: deckId, audio_uri: 'file:///upgrade.wav', duration_ms: 2000,
      audience: '', slide_events: result.slide_events } });
  network.respond = () => { throw Error('offline'); };
  sqliteFaults.before = op => { if (op === 'run') throw Error('cache unavailable'); };
  const tree = await mount();
  try {
    assert.match(text(tree), /Hello, 안녕!/); assert.match(text(tree), /English words\/min: 30/);
    assert.match(text(tree), /Aligned chronological visits/); assert.match(text(tree), /Could not refresh/);
    assert.equal(readStored(reviewKey(api, 'attempt', attemptId)), null);
    assert.equal(getSavedAttempt(attemptId).state, 'submitted');
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

const incompleteReviews = {
  legacy: { attempt_id: attemptId, transcript: { text: 'Obsolete legacy text', words: [] } },
  incomplete: wireResult({ processing_revision: undefined, transcript: { text: 'Incomplete refresh text', words: [] },
    duration_ms: undefined, visits: null, metrics: null, audio_url: undefined }),
};
for (const [kind, incoming] of Object.entries(incompleteReviews)) {
  for (const cacheFails of [false, true]) {
    test(`${kind} refresh retains reconciled transcript, timing and recovery metadata (cache failure: ${cacheFails})`, async () => {
      seed(); const tree = await mount();
      const cached = readReview(api, attemptId);
      try {
        network.respond = url => response(200, url.includes('/decks/') ? deckWire : incoming);
        if (cacheFails) sqliteFaults.before = op => { if (op === 'run') throw Error('disk full'); };
        await tick(() => action(tree, 'Refresh').props.onPress());
        assert.match(text(tree), /Hello, 안녕!/); assert.doesNotMatch(text(tree), /Obsolete legacy|Incomplete refresh/);
        assert.match(text(tree), /English words\/min: 30/); assert.match(text(tree), /Aligned chronological visits/);
        assert.ok(action(tree, 'Download audio for offline review'));
        assert.ok(action(tree, 'Download PDF for offline review'));
        assert.deepEqual(readReview(api, attemptId), cached);
        if (cacheFails) assert.match(text(tree), /offline cache could not be saved/);
        assert.ok(network.requests.every(r => r.method === 'GET'));
      } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
    });
  }
}

test('a validated result received during cache failure survives a later legacy refresh in memory', async () => {
  seed({ ...incompleteReviews.legacy, deck_id: deckId });
  sqliteFaults.before = op => { if (op === 'run') throw Error('disk full'); };
  const tree = await mount();
  try {
    assert.match(text(tree), /Hello, 안녕!/); assert.match(text(tree), /offline cache could not be saved/);
    network.respond = url => response(200, url.includes('/decks/') ? deckWire : incompleteReviews.legacy);
    await tick(() => action(tree, 'Refresh').props.onPress());
    assert.match(text(tree), /Hello, 안녕!/); assert.match(text(tree), /English words\/min: 30/);
    assert.ok(action(tree, 'Download audio for offline review'));
    assert.equal(readReview(api, attemptId).transcript.text, 'Obsolete legacy text');
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

for (const source of ['cache', 'memory']) {
  for (const failedCache of ['analysis', 'review']) {
    test(`stale awaiting response preserves ${source} completion before ${failedCache} cache failure`, async () => {
      const waiting = wireResult({ status: 'pending', processing_state: 'awaiting_analysis', processing_revision: 0,
        transcript: null, visits: null, metrics: null, analysis_outcome: null,
        partial_available: { transcript: false, alignment: false },
        provenance: { provider: null, model: null, generation: null, outcome: null, speech_gate: null } });
      const complete = wireResult({ processing_revision: 2 });
      const analysisKey = `analysis:v1:${encodeURIComponent(api)}:${attemptId}`;
      const attemptKey = reviewKey(api, 'attempt', attemptId);
      seed(source === 'cache' ? complete : waiting);
      if (source === 'memory') sqliteFaults.before = op => { if (op === 'run') throw Error('disk full'); };
      network.respond = url => response(200, url.includes('/decks/') ? deckWire : complete);
      const tree = await mount();
      try {
        assert.match(text(tree), /Hello, 안녕!/);
        const cachedAnalysis = readStored(analysisKey), cachedReview = readStored(attemptKey);
        assert.equal(cachedAnalysis.processing_revision, source === 'cache' ? 2 : 0);
        const writes = [];
        sqliteFaults.before = (op, sql, args) => {
          if (op !== 'run' || ![analysisKey, attemptKey].includes(args[0])) return;
          writes.push({ key: args[0], value: JSON.parse(args[1]) });
          if (args[0] === (failedCache === 'analysis' ? analysisKey : attemptKey)) throw Error('disk full');
        };
        network.respond = url => response(200, url.includes('/decks/') ? deckWire : waiting);
        await tick(() => action(tree, 'Refresh').props.onPress());
        assert.match(text(tree), /Hello, 안녕!/); assert.match(text(tree), /English words\/min: 30/);
        assert.match(text(tree), /Aligned chronological visits/); assert.match(text(tree), /offline cache could not be saved/);
        assert.equal(action(tree, 'Analyze recording'), undefined);
        assert.ok(writes.length > 0);
        for (const write of writes) {
          const result = write.key === analysisKey ? write.value : write.value.processing_result;
          assert.deepEqual(result, complete); // Reconcile before either cache sees the stale response.
        }
        assert.deepEqual(readStored(analysisKey), failedCache === 'analysis' ? cachedAnalysis : complete);
        assert.deepEqual(readStored(attemptKey), cachedReview);
        assert.ok(network.requests.every(r => r.method === 'GET'));
      } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
    });
  }
}

for (const leave of ['background', 'navigation', 'API change']) {
  test(`late legacy refresh after ${leave} cannot replace validated state or write cache`, async () => {
    seed(); const tree = await mount(); let finish;
    const cached = readReview(api, attemptId);
    try {
      network.respond = url => url.includes('/attempts/') ? new Promise(resolve => { finish = resolve; }) : response(200, deckWire);
      await tick(() => action(tree, 'Refresh').props.onPress());
      const request = network.requests.findLast(r => r.url.includes('/attempts/'));
      sqliteFaults.before = op => { if (op === 'run') throw Error('disk full'); };
      await tick(() => {
        if (leave === 'background') backgroundApp('background');
        else if (leave === 'navigation') setFocused(false);
        else tree.update(React.createElement(SavedAttemptScreen, { id: attemptId, apiUrl: 'http://switched.invalid/api' }));
      });
      assert.equal(request.signal.aborted, true);
      await tick(() => finish(response(200, incompleteReviews.legacy)));
      assert.doesNotMatch(text(tree), /Obsolete legacy|offline cache could not be saved/);
      if (leave !== 'API change') assert.match(text(tree), /Hello, 안녕!/);
      else assert.doesNotMatch(text(tree), /Hello, 안녕!/);
      assert.deepEqual(readReview(api, attemptId), cached);
      assert.equal(readReview('http://switched.invalid/api', attemptId), null);
      assert.ok(network.requests.every(r => r.method === 'GET'));
    } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
  });
}

test('native focus loss changes Pause to Play and subsequent word/visit seeks stay paused', async () => {
  playback.eventMode = true; seed(); const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const player = players.at(-1);
    await tick(() => action(tree, 'Play').props.onPress());
    await tick(() => player.emit({ playing: false, isBuffering: false, didJustFinish: false, currentTime: 0.4 }));
    assert.equal(!!action(tree, 'Pause'), false); assert.equal(action(tree, 'Play').props.disabled, false);
    await tick(() => tree.root.findAllByType('text').find(n => n.props.children === '안녕').props.onPress());
    await tick(() => tree.root.findAllByType('action').find(n => n.props.label.startsWith('Visit 1')).props.onPress());
    assert.deepEqual(playback.seeks, [1, 0]); assert.equal(playback.played, 1);
    assert.equal(player.currentStatus.playing, false);
    await tick(() => action(tree, 'Play').props.onPress());
    assert.equal(playback.played, 2); assert.ok(action(tree, 'Pause'));
  } finally { await tick(() => tree.unmount()); }
});

test('native buffering and controller-owned seek pauses preserve intent; settled native stops clear it', async () => {
  playback.eventMode = true; seed(); const tree = await mount(); let finish;
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const player = players.at(-1);
    await tick(() => action(tree, 'Play').props.onPress());
    await tick(() => player.emit({ playing: false, isLoaded: false, isBuffering: true }));
    assert.ok(action(tree, 'Pause')); // Buffering alone is not a user/system pause.
    await tick(() => player.emit({ playing: true, isLoaded: true, isBuffering: false }));
    playback.wait = new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, 'Next visit').props.onPress());
    await tick(() => player.emit({ playing: false, isLoaded: true, isBuffering: false }));
    assert.ok(action(tree, 'Pause')); // seekTo still owns this native pause.
    await tick(() => finish());
    assert.equal(playback.played, 2); assert.ok(action(tree, 'Pause'));
    await tick(() => [...player.listeners].forEach(callback => callback({ ...player.currentStatus, playing: false })));
    assert.ok(action(tree, 'Pause')); // Delayed seek-pause event, native snapshot is playing.
    await tick(() => player.emit({ playing: false, isLoaded: false, isBuffering: true }));
    assert.ok(action(tree, 'Pause'));
    await tick(() => player.emit({ playing: false, isLoaded: true, isBuffering: false }));
    assert.equal(!!action(tree, 'Pause'), false);
  } finally { finish?.(); await tick(() => tree.unmount()); }
});

for (const [label, target] of [['+5 seconds', 7], ['−5 seconds', 0]]) {
  test(`delayed same-player EOF keeps fresh time, PDF, word and ${label} target`, async () => {
    playback.eventMode = true;
    const words = [{ text: 'Early', start_ms: 2000, end_ms: 2500 }, { text: 'later', start_ms: 6000, end_ms: 6500 }];
    const result = wireResult({ duration_ms: 10000, transcript: { text: 'Early later.', words }, metrics: null,
      slide_events: [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 5000 }],
      visits: [{ slide_index: 0, start_ms: 0, end_ms: 5000, words: [words[0]] }, { slide_index: 1, start_ms: 5000, end_ms: 10000, words: [words[1]] }] });
    seed(result); network.respond = url => url.startsWith(`${api}/`) ? response(200, url.includes('/decks/') ? deckWire : result) : respond(url);
    validationAudio.status = { isLoaded: true, duration: 10, error: null };
    const tree = await mount();
    try {
      await tick(() => action(tree, 'Download audio for offline review').props.onPress());
      await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
      await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
      const player = players.at(-1);
      await tick(() => player.emit({ currentTime: 2, duration: 10, playing: false, didJustFinish: false }));
      await tick(() => [...player.listeners].forEach(callback => callback({ ...player.currentStatus, currentTime: 10, didJustFinish: true })));
      assert.deepEqual(tree.root.findByProps({ accessibilityLabel: 'Audio progress' }).props.accessibilityValue, { min: 0, max: 10000, now: 2000 });
      assert.equal(tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%').props.page, 1);
      assert.equal(tree.root.findAllByType('text').find(n => n.props.children === 'Early').props.accessibilityState.selected, true);
      assert.equal(action(tree, 'Pause'), undefined);
      await tick(() => action(tree, label).props.onPress());
      assert.deepEqual(playback.seeks, [target]); assert.equal(playback.played, 0);
      assert.ok(network.requests.every(r => r.method === 'GET'));
    } finally { await tick(() => tree.unmount()); }
  });
}

test('status uses fresh native buffering but preserves event-only Android errors and EOF', async () => {
  let listener;
  const player = { id: 'synthetic-native-status', currentStatus: { id: 'synthetic-native-status', currentTime: 2, duration: 10,
    isLoaded: true, playing: true, isBuffering: false, error: null, didJustFinish: false },
    addListener(_event, callback) { listener = callback; return { remove() {} }; } };
  let observed, tree;
  function Probe() { observed = useReviewPlayerStatus(player); return null; }
  await tick(() => { tree = create(React.createElement(Probe)); });
  try {
    const delayed = { ...player.currentStatus };
    player.currentStatus = { ...player.currentStatus, currentTime: 3, isLoaded: false, isBuffering: true };
    await tick(() => listener(delayed));
    assert.equal(observed.status.currentTime, 3); assert.equal(observed.status.isBuffering, true);
    assert.equal(observed.status.isLoaded, false); assert.equal(observed.hasLoaded, true);
    await tick(() => listener({ ...player.currentStatus, error: 'synthetic native decoder error' }));
    assert.equal(observed.status.error, 'synthetic native decoder error'); assert.equal(observed.hasLoaded, false);
    player.currentStatus = { ...player.currentStatus, currentTime: 10, isLoaded: true, isBuffering: false, playing: false };
    await tick(() => listener({ ...player.currentStatus, didJustFinish: true }));
    assert.equal(observed.status.didJustFinish, true); assert.equal(observed.status.currentTime, 10);
  } finally { await tick(() => tree.unmount()); }
});

for (const originalState of ['missing', 'corrupt']) {
  test(`${originalState} original and unusable first known PDF fall back to a later validated same-deck copy`, async () => {
    seed();
    const original = { id: attemptId, local_deck_id: 'synthetic-original', title: 'Synthetic original', pdf_uri: 'file:///original.pdf', page_count: 2,
      created_at: '2026-10-08T00:00:00Z', state: 'submitted', server_url: api,
      recording: { id: attemptId, deck_id: deckId, audio_uri: '', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events } };
    const badId = '33333333-3333-4333-8333-333333333333', goodId = '44444444-4444-4444-8444-444444444444';
    const wrongApiId = '55555555-5555-4555-8555-555555555555';
    saveAttempt(original);
    saveAttempt({ ...original, id: badId, created_at: '2026-10-08T02:00:00Z', pdf_uri: 'file:///wrong-pages.pdf' });
    saveAttempt({ ...original, id: goodId, created_at: '2026-10-08T01:00:00Z', pdf_uri: '/good-copy.pdf' });
    saveAttempt({ ...original, id: wrongApiId, created_at: '2026-10-08T03:00:00Z', pdf_uri: 'file:///wrong-api.pdf', server_url: 'http://other.invalid/api' });
    if (originalState === 'corrupt') files.set(original.pdf_uri, { data: 'synthetic corrupt PDF' });
    for (const uri of ['file:///wrong-pages.pdf', 'file:///good-copy.pdf', 'file:///wrong-api.pdf']) files.set(uri, { data: 'synthetic PDF' });
    const tree = await mount();
    const validator = () => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1);
    try {
      if (originalState === 'corrupt') {
        assert.equal(validator()?.props.source.uri, original.pdf_uri);
        await tick(() => validator().props.onError());
      }
      assert.equal(validator()?.props.source.uri, 'file:///wrong-pages.pdf');
      await tick(() => validator().props.onLoadComplete(3));
      assert.equal(validator()?.props.source.uri, 'file:///good-copy.pdf');
      assert.equal(tree.root.findAllByType('pdf').some(n => n.props.style.width === '100%'), false);
      await tick(() => validator().props.onLoadComplete(2));
      assert.equal(tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%').props.source.uri, 'file:///good-copy.pdf');
      assert.equal(action(tree, 'Download PDF for offline review'), undefined);
      assert.equal(readStored(reviewKey(api, 'media-pdf', deckId)), null);
      assert.deepEqual(getSavedAttempt(attemptId), original);
      assert.ok(files.has('file:///wrong-pages.pdf')); assert.ok(files.has('file:///good-copy.pdf'));
      assert.ok(network.requests.every(r => r.method === 'GET' && r.url.startsWith(`${api}/`)));
    } finally {
      await tick(() => tree.unmount());
      for (const id of [badId, goodId, wrongApiId]) removeStored(`attempt:${id}`);
    }
  });
}

test('server-only opens by UUID, downloads audio and PDF independently, and reopens offline without a capture or process POST', async () => {
  seed(); let tree = await mount();
  try {
    assert.match(text(tree), /Server rehearsal/); assert.match(text(tree), /Hello, 안녕!/);
    assert.equal(getSavedAttempt(attemptId), null); assert.equal(action(tree, 'Upload recording'), undefined);
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    assert.equal(action(tree, 'Play').props.disabled, false); assert.ok(readStored(reviewKey(api, 'media-audio', attemptId)));
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    const validation = tree.root.findAllByType('pdf').find(n => n.props.style.width === 1);
    assert.ok(validation); assert.equal(readStored(reviewKey(api, 'media-pdf', deckId)), null);
    await tick(() => validation.props.onLoadComplete(2));
    assert.ok(readStored(reviewKey(api, 'media-pdf', deckId)));
    const rendered = tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%');
    assert.equal(rendered.props.page, 2); // Native player is at EOF; retain final page.
    await tick(() => action(tree, 'Play').props.onPress());
    assert.deepEqual(playback.seeks, [0]); assert.equal(playback.played, 1);
    await tick(() => action(tree, 'Refresh').props.onPress());
    assert.ok(network.requests.every(r => r.method === 'GET'));
    assert.equal(getSavedAttempt(attemptId), null);
    await tick(() => tree.unmount());
    network.respond = () => { throw Error('offline'); };
    tree = await mount();
    assert.match(text(tree), /Hello, 안녕!/); assert.match(text(tree), /Could not refresh/);
    assert.equal(action(tree, 'Play').props.disabled, false);
    const pdf = tree.root.findAllByType('pdf').find(n => n.props.style.width === 1);
    await tick(() => pdf.props.onLoadComplete(2));
    assert.equal(action(tree, 'Download PDF for offline review'), undefined);
    assert.equal(getSavedAttempt(attemptId), null);
  } finally { await tick(() => tree.unmount()); }
});

test('corrupt originals remain intact, valid downloaded audio survives PDF page-count failure', async () => {
  seed();
  const original = { id: attemptId, local_deck_id: 'synthetic', title: 'Synthetic original', pdf_uri: 'file:///broken.pdf', page_count: 2,
    created_at: '2026-10-08T00:00:00Z', state: 'submitted', server_url: api,
    recording: { id: attemptId, audio_uri: 'file:///broken.wav', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events, deck_id: deckId } };
  saveAttempt(original); files.set(original.pdf_uri, { data: 'broken' }); files.set(original.recording.audio_uri, { data: 'broken' });
  validationAudio.status = { isLoaded: false, duration: 0, error: 'corrupt audio' };
  const tree = await mount();
  try {
    await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onError());
    assert.ok(action(tree, 'Download audio for offline review')); assert.ok(action(tree, 'Download PDF for offline review'));
    validationAudio.status = null;
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(3));
    assert.match(text(tree), /page count does not match/);
    assert.equal(action(tree, 'Play').props.disabled, false);
    assert.ok(readStored(reviewKey(api, 'media-audio', attemptId))); assert.equal(readStored(reviewKey(api, 'media-pdf', deckId)), null);
    assert.deepEqual(getSavedAttempt(attemptId), original); assert.ok(files.has(original.pdf_uri)); assert.ok(files.has(original.recording.audio_uri));
  } finally { await tick(() => tree.unmount()); }
});

test('background during PDF validation discards late callbacks and never publishes or resumes', async () => {
  seed(); const tree = await mount();
  try {
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    const callback = tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete;
    await tick(() => backgroundApp('background')); await tick(() => callback(2));
    assert.equal(readStored(reviewKey(api, 'media-pdf', deckId)), null); assert.equal(playback.played, 0);
    await tick(() => backgroundApp('active')); assert.equal(playback.played, 0);
  } finally { await tick(() => tree.unmount()); }
});

test('no-speech and legacy server rehearsals retain visits/text without enabling invented processing', async () => {
  const silent = wireResult({ analysis_outcome: 'no_speech', transcript: { text: '', words: [] },
    visits: wireResult().visits.map(v => ({ ...v, words: [] })), metrics: { ...wireResult().metrics, speaking_rates: [] } });
  seed(silent); network.respond = url => response(200, url.includes('/decks/') ? deckWire : silent);
  let tree = await mount();
  try {
    assert.match(text(tree), /No speech detected/); assert.ok(action(tree, 'Visit 2 · Slide 2 · 1–2 seconds · current'));
    await tick(() => tree.unmount());
    const legacy = { attempt_id: attemptId, deck_id: deckId, transcript: { text: 'Legacy saved text', words: [] } };
    removeStored(`analysis:v1:${encodeURIComponent(api)}:${attemptId}`); removeStored(reviewKey(api, 'attempt', attemptId));
    seed(legacy); network.respond = url => response(200, url.includes('/decks/') ? deckWire : legacy);
    tree = await mount(); assert.match(text(tree), /Legacy saved text/); assert.equal(action(tree, 'Analyze recording'), undefined);
    assert.equal(getSavedAttempt(attemptId), null); assert.ok(readReview(api, attemptId));
  } finally { await tick(() => tree.unmount()); }
});

test('native audio validation rejects errors, wrong durations, timeout and cancellation, releasing each player', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const spec = { kind: 'audio', durationMs: 2000 };
  try {
    validationAudio.status = { isLoaded: true, duration: 8 };
    await assert.rejects(validateAudio('file:///synthetic', spec, new AbortController().signal), /duration/);
    assert.equal(validationAudio.players.at(-1).released, true);
    validationAudio.status = { isLoaded: false, duration: 0 };
    const timeout = assert.rejects(validateAudio('file:///synthetic', spec, new AbortController().signal), /timed out/);
    t.mock.timers.tick(15000); await timeout; assert.equal(validationAudio.players.at(-1).released, true);
    const controller = new AbortController(); const pending = assert.rejects(validateAudio('file:///synthetic', spec, controller.signal), /cancelled/);
    controller.abort(); await pending; assert.equal(validationAudio.players.at(-1).released, true);
  } finally { t.mock.timers.reset(); }
});

test('PDF native load timeout settles its validator without publishing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let validate; function Host() { const v = useMediaValidators(); validate = v.validate; return v.validators; }
  let tree; await tick(() => { tree = create(React.createElement(Host)); });
  try {
    let pending;
    await tick(() => { pending = assert.rejects(validate('file:///synthetic.pdf', { kind: 'pdf', pageCount: 2 }, new AbortController().signal), /timed out/); });
    await tick(() => t.mock.timers.tick(15000)); await pending;
    assert.equal(tree.root.findAllByType('pdf').length, 0);
  } finally { await tick(() => tree.unmount()); t.mock.timers.reset(); }
});

test('known server history supports explicit Analyze independently of the local capture latest-upload destination', async () => {
  const waiting = wireResult({ status: 'pending', processing_state: 'awaiting_analysis', processing_revision: 0,
    transcript: null, visits: null, metrics: null, analysis_outcome: null, partial_available: { transcript: false, alignment: false },
    provenance: { provider: null, model: null, generation: null, outcome: null, speech_gate: null } });
  seed(waiting); removeStored('analysis-consent:openai:v1');
  saveAttempt({ id: attemptId, local_deck_id: 'synthetic-other-upload', title: 'Synthetic', pdf_uri: '', page_count: 2,
    created_at: '2026-10-08T00:00:00Z', state: 'submitted', server_url: 'http://other.invalid/api',
    recording: { id: attemptId, deck_id: deckId, audio_uri: '', duration_ms: 2000, audience: '', slide_events: waiting.slide_events } });
  network.respond = (url, init) => response(init.method === 'POST' ? 202 : 200, url.includes('/decks/') ? deckWire :
    init.method === 'POST' ? { ...waiting, status: 'processing', processing_state: 'queued', processing_revision: 1 } : waiting);
  const tree = await mount();
  try {
    assert.ok(action(tree, 'Analyze recording')); assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
    await tick(() => action(tree, 'Analyze recording').props.onPress()); assert.ok(action(tree, 'Continue'));
    await tick(() => action(tree, 'Cancel').props.onPress()); assert.equal(network.requests.filter(r => r.method === 'POST').length, 0);
    await tick(() => action(tree, 'Analyze recording').props.onPress()); await tick(() => action(tree, 'Continue').props.onPress());
    const posts = network.requests.filter(r => r.method === 'POST'); assert.equal(posts.length, 1);
    assert.equal(posts[0].url, `${api}/attempts/${attemptId}/process/`);
    assert.equal(getSavedAttempt(attemptId).server_url, 'http://other.invalid/api');
  } finally { await tick(() => tree.unmount()); }
});

test('API switch during a media download rejects late publication and does not reuse another server media', async () => {
  seed(); let finish;
  network.respond = url => url.endsWith('.wav') ? new Promise(resolve => { finish = resolve; }) : respond(url);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const old = network.requests.at(-1);
    await tick(() => tree.update(React.createElement(SavedAttemptScreen, { id: attemptId, apiUrl: 'http://other.invalid/api' })));
    assert.equal(old.signal.aborted, true);
    await tick(() => finish(new Response(new Uint8Array([1, 2, 3]))));
    assert.equal(readStored(reviewKey(api, 'media-audio', attemptId)), null);
    assert.match(text(tree), /not found for this API/); assert.equal(action(tree, 'Analyze recording'), undefined);
    assert.equal(playback.source, null);
  } finally { await tick(() => tree.unmount()); }
});

test('the UI allows Pause while seeking and ignores background seek completion', async () => {
  seed(); const tree = await mount(); let finish;
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    playback.wait = new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, 'Play').props.onPress()); assert.ok(action(tree, 'Pause'));
    await tick(() => action(tree, 'Pause').props.onPress()); await tick(() => finish());
    assert.equal(playback.played, 0);
    playback.wait = new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, 'Play').props.onPress());
    await tick(() => backgroundApp('background')); await tick(() => finish());
    assert.equal(playback.played, 0);
    await tick(() => backgroundApp('active')); assert.equal(playback.played, 0);
  } finally { finish?.(); await tick(() => tree.unmount()); }
});

test('learning PDF metadata does not cancel an independent in-progress audio download', async () => {
  seed(); removeStored(reviewKey(api, 'deck', deckId));
  let finishDeck, finishAudio;
  network.respond = url => url.includes('/decks/') ? new Promise(resolve => { finishDeck = resolve; }) :
    url.endsWith('.wav') ? new Promise(resolve => { finishAudio = resolve; }) : response(200, wireResult());
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress()); const audioRequest = network.requests.at(-1);
    await tick(() => finishDeck(response(200, deckWire))); assert.equal(audioRequest.signal.aborted, false);
    await tick(() => finishAudio(new Response(new Uint8Array([1, 2, 3]))));
    assert.equal(action(tree, 'Play').props.disabled, false); assert.ok(readStored(reviewKey(api, 'media-audio', attemptId)));
  } finally { await tick(() => tree.unmount()); }
});

test('first audio download reads the new native player snapshot even when its load event preceded subscription', async () => {
  playback.eventMode = true;
  seed(); const tree = await mount();
  try {
    assert.equal(action(tree, 'Play').props.disabled, true);
    const unloadedPlayer = players.at(-1);
    const lateCallbacks = [...unloadedPlayer.listeners];
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const loadedPlayer = players.at(-1);
    assert.notEqual(loadedPlayer.id, unloadedPlayer.id);
    assert.equal(loadedPlayer.currentStatus.isLoaded, true);
    assert.equal(action(tree, 'Play').props.disabled, false);
    await tick(() => lateCallbacks.forEach(callback => callback({ ...unloadedPlayer.currentStatus, error: 'old source failed' })));
    assert.equal(action(tree, 'Play').props.disabled, false);
    assert.equal(action(tree, 'Download audio for offline review'), undefined);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

test('Play then immediate background returns paused at the native position without replacing good audio', async () => {
  playback.eventMode = true;
  seed(); const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const player = players.at(-1);
    await tick(() => player.emit({ isLoaded: true, currentTime: 1 }));
    await tick(() => action(tree, 'Play').props.onPress());
    assert.ok(action(tree, 'Pause'));
    await tick(() => backgroundApp('background'));
    assert.equal(player.currentStatus.playing, false);
    await tick(() => backgroundApp('active'));
    assert.equal(players.at(-1), player);
    assert.equal(action(tree, 'Pause'), undefined);
    assert.equal(action(tree, 'Play').props.disabled, false);
    assert.deepEqual(tree.root.findByProps({ accessibilityLabel: 'Audio progress' }).props.accessibilityValue, { min: 0, max: 2000, now: 1000 });
    assert.equal(playback.played, 1);
    await tick(() => action(tree, 'Play').props.onPress());
    assert.equal(playback.played, 2);
    await tick(() => setFocused(false)); await tick(() => setFocused(true));
    assert.equal(action(tree, 'Pause'), undefined);
    assert.equal(playback.played, 2);
  } finally { await tick(() => tree.unmount()); }
});

test('buffering during a seek accepts newer word/visit/transport targets and Pause still prevents resume', async () => {
  playback.eventMode = true;
  seed(); const tree = await mount(); let finish;
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const player = players.at(-1);
    await tick(() => action(tree, 'Play').props.onPress());
    playback.wait = new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, '+5 seconds').props.onPress());
    assert.deepEqual(playback.seeks, [2]);
    await tick(() => player.emit({ isLoaded: false, isBuffering: true }));
    assert.equal(action(tree, '−5 seconds').props.disabled, false);
    assert.equal(action(tree, '+5 seconds').props.disabled, false);
    assert.equal(action(tree, 'Next visit').props.disabled, false);
    await tick(() => action(tree, '−5 seconds').props.onPress());
    await tick(() => action(tree, 'Next visit').props.onPress());
    const firstVisit = tree.root.findAllByType('action').find(n => n.props.label.startsWith('Visit 1'));
    assert.equal(firstVisit.props.disabled, false);
    await tick(() => firstVisit.props.onPress());
    const word = tree.root.findAllByType('text').find(n => n.props.children === '안녕');
    assert.equal(word.props.accessibilityRole, 'button');
    await tick(() => word.props.onPress());
    assert.deepEqual(playback.seeks, [2]); // Only the newest target survives behind the native seek.
    assert.equal(action(tree, 'Pause').props.disabled, false);
    await tick(() => action(tree, 'Pause').props.onPress());
    await tick(() => finish());
    assert.deepEqual(playback.seeks, [2, 1]); assert.equal(player.currentStatus.currentTime, 1);
    assert.equal(playback.played, 1); assert.equal(action(tree, 'Pause'), undefined);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { finish?.(); await tick(() => tree.unmount()); }
});

test('seek eligibility requires the current player initial load and resets on replacement/error', async () => {
  playback.eventMode = true; playback.initiallyLoaded = false;
  seed(); const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const firstPlayer = players.at(-1);
    await tick(() => firstPlayer.emit({ isLoaded: false, isBuffering: true }));
    assert.equal(action(tree, 'Play').props.disabled, true); assert.equal(action(tree, '+5 seconds').props.disabled, true);
    assert.equal(tree.root.findAllByType('text').find(n => n.props.children === '안녕').props.onPress, undefined);
    await tick(() => firstPlayer.emit({ isLoaded: true, isBuffering: false }));
    assert.equal(action(tree, '+5 seconds').props.disabled, false);
    const oldCallbacks = [...firstPlayer.listeners];
    await tick(() => firstPlayer.emit({ isLoaded: false, error: 'synthetic decode error' }));
    assert.equal(action(tree, '+5 seconds').props.disabled, true);
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const nextPlayer = players.at(-1); assert.notEqual(nextPlayer, firstPlayer);
    await tick(() => {
      oldCallbacks.forEach(callback => callback({ ...firstPlayer.currentStatus, isLoaded: true, error: null }));
      nextPlayer.emit({ isLoaded: false, isBuffering: true });
    });
    assert.equal(action(tree, '+5 seconds').props.disabled, true);
    await tick(() => nextPlayer.emit({ isLoaded: true, isBuffering: false }));
    assert.equal(action(tree, '+5 seconds').props.disabled, false);
  } finally { await tick(() => tree.unmount()); }
});

for (const leave of ['background', 'navigation', 'API change']) {
  test(`buffered queued seek is discarded on ${leave}`, async () => {
    playback.eventMode = true;
    seed(); const tree = await mount(); let finish;
    try {
      await tick(() => action(tree, 'Download audio for offline review').props.onPress());
      const player = players.at(-1);
      await tick(() => action(tree, 'Play').props.onPress());
      playback.wait = new Promise(resolve => { finish = resolve; });
      await tick(() => action(tree, '+5 seconds').props.onPress());
      await tick(() => player.emit({ isLoaded: false, isBuffering: true }));
      assert.equal(action(tree, 'Next visit').props.disabled, false);
      await tick(() => action(tree, 'Next visit').props.onPress());
      await tick(() => {
        if (leave === 'background') backgroundApp('background');
        else if (leave === 'navigation') setFocused(false);
        else tree.update(React.createElement(SavedAttemptScreen, { id: attemptId, apiUrl: 'http://other.invalid/api' }));
      });
      await tick(() => finish());
      assert.deepEqual(playback.seeks, [2]); assert.equal(playback.played, 1);
      if (leave !== 'API change') {
        await tick(() => { backgroundApp('active'); setFocused(true); });
        assert.equal(action(tree, 'Pause'), undefined); assert.equal(playback.played, 1);
      } else assert.equal(player.released, true);
      assert.ok(network.requests.every(r => r.method === 'GET'));
    } finally { finish?.(); await tick(() => tree.unmount()); }
  });
}

test('unmounting the first PDF consumer transfers native validation without another download', async () => {
  const review = parseReview(wireResult(), attemptId, api, deck);
  function Consumer() {
    const media = useReviewMedia(api, attemptId, null, review, deck);
    return React.createElement('consumer', { uri: media.pdf.uri, error: media.pdf.error, download: media.pdf.download }, media.validators);
  }
  let first, second;
  await tick(() => { first = create(React.createElement(Consumer)); second = create(React.createElement(Consumer)); });
  try {
    await tick(() => {
      first.root.findByType('consumer').props.download();
      second.root.findByType('consumer').props.download();
    });
    const oldCallback = first.root.findByType('pdf').props.onLoadComplete;
    assert.equal(network.requests.length, 1); assert.equal(readStored(reviewKey(api, 'media-pdf', deckId)), null);
    await tick(() => first.unmount());
    assert.equal(second.root.findByType('consumer').props.error, '');
    const validator = second.root.findByType('pdf');
    await tick(() => oldCallback(2));
    assert.equal(readStored(reviewKey(api, 'media-pdf', deckId)), null);
    await tick(() => validator.props.onLoadComplete(2));
    const record = readStored(reviewKey(api, 'media-pdf', deckId));
    assert.ok(record); assert.equal(second.root.findByType('consumer').props.uri, record.uri);
    assert.equal(network.requests.length, 1); assert.equal(network.requests[0].method, 'GET');
    assert.equal(getSavedAttempt(attemptId), null);
  } finally { await tick(() => { first.unmount(); second.unmount(); }); }
});

test('interrupted absolute-path audio recovers its canonical URI and uploads the same attempt', async () => {
  const original = { id: attemptId, local_deck_id: 'synthetic-recovery', title: 'Synthetic interrupted', pdf_uri: 'file:///synthetic.pdf', page_count: 2,
    created_at: '2026-10-08T00:00:00Z', state: 'interrupted',
    recording: { id: attemptId, audio_uri: '/synthetic.wav', duration_ms: 1000, audience: '', slide_events: wireResult().slide_events } };
  saveAttempt(original); files.set('file:///synthetic.wav', { data: 'synthetic audio' }); files.set(original.pdf_uri, { data: 'synthetic PDF' });
  network.respond = (url, init) => {
    if (url === `${api}/decks/` && init.method === 'POST') return response(201, { deck: deckWire });
    if (url === `${api}/attempts/` && init.method === 'POST') return response(201, { attempt_id: attemptId });
    return respond(url);
  };
  const tree = await mount();
  try {
    assert.equal(playback.source, 'file:///synthetic.wav');
    assert.equal(action(tree, 'Recover playable audio').props.disabled, false);
    await tick(() => action(tree, 'Recover playable audio').props.onPress());
    const recovered = getSavedAttempt(attemptId);
    assert.equal(recovered.state, 'saved'); assert.equal(recovered.recording.audio_uri, 'file:///synthetic.wav');
    assert.equal(recovered.recording.duration_ms, 2000); assert.deepEqual(recovered.recording.slide_events, original.recording.slide_events);
    assert.equal(recovered.id, original.id); assert.ok(files.has('file:///synthetic.wav'));
    await tick(() => action(tree, 'Upload recording').props.onPress());
    const upload = network.requests.find(r => r.url === `${api}/attempts/` && r.method === 'POST');
    assert.ok(upload); assert.equal(JSON.parse(upload.body.get('metadata')).id, attemptId);
    assert.equal(await upload.body.get('audio').text(), 'synthetic audio');
    assert.equal(getSavedAttempt(attemptId).state, 'submitted');
    assert.equal(network.requests.some(r => r.url.endsWith('/process/')), false);
  } finally { await tick(() => tree.unmount()); }
});

test('downloaded review audio cannot replace a missing interrupted original during recovery', async () => {
  seed();
  const original = { id: attemptId, local_deck_id: 'synthetic-missing', title: 'Synthetic interrupted', pdf_uri: '', page_count: 2,
    created_at: '2026-10-08T00:00:00Z', state: 'interrupted',
    recording: { id: attemptId, audio_uri: '/missing.wav', duration_ms: 1000, audience: '', slide_events: [{ slide_index: 0, at_ms: 0 }] } };
  saveAttempt(original); const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    assert.equal(action(tree, 'Play').props.disabled, false);
    assert.equal(action(tree, 'Recover playable audio').props.disabled, true);
    await tick(() => action(tree, 'Recover playable audio').props.onPress());
    assert.deepEqual(getSavedAttempt(attemptId), original);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

test('EOF from an older seek does not pause a newer queued word seek', async () => {
  playback.eventMode = true;
  seed(); const tree = await mount(); let finish;
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    const player = players.at(-1);
    await tick(() => action(tree, 'Play').props.onPress());
    playback.wait = new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, '+5 seconds').props.onPress());
    const word = tree.root.findAllByType('text').find(n => n.props.children === '안녕');
    await tick(() => word.props.onPress());
    await tick(() => player.emit({ currentTime: 2, didJustFinish: true, playing: false }));
    assert.ok(action(tree, 'Pause')); // The newest request still owns playing intent.
    await tick(() => finish());
    assert.deepEqual(playback.seeks, [2, 1]);
    assert.equal(player.currentStatus.currentTime, 1); assert.equal(playback.played, 2);
    assert.ok(action(tree, 'Pause')); assert.ok(network.requests.every(r => r.method === 'GET'));
    await tick(() => player.emit({ didJustFinish: false }));
    // An old event can arrive after both native seeks settle. Its position is
    // stale, while the current native snapshot remains at the newer word.
    await tick(() => [...player.listeners].forEach(callback => callback({ ...player.currentStatus, didJustFinish: true, currentTime: 2 })));
    assert.ok(action(tree, 'Pause')); assert.equal(player.currentStatus.currentTime, 1);
    await tick(() => player.emit({ didJustFinish: false }));
    await tick(() => player.emit({ didJustFinish: true, currentTime: 2, playing: false }));
    assert.equal(action(tree, 'Pause'), undefined); assert.equal(action(tree, 'Play').props.disabled, false);
  } finally { finish?.(); await tick(() => tree.unmount()); }
});

test('a detached PDF renderer cannot clear a successfully validated replacement', async () => {
  seed(); const tree = await mount();
  try {
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
    const first = tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%');
    const oldFailure = first.props.onError;
    const firstRecord = readStored(reviewKey(api, 'media-pdf', deckId));
    await tick(() => oldFailure());
    assert.ok(action(tree, 'Download PDF for offline review'));
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
    const replacement = readStored(reviewKey(api, 'media-pdf', deckId));
    assert.notEqual(replacement.uri, firstRecord.uri);
    await tick(() => oldFailure());
    const rendered = tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%');
    assert.ok(rendered); assert.equal(rendered.props.source.uri, replacement.uri);
    assert.equal(action(tree, 'Download PDF for offline review'), undefined);
    assert.deepEqual(readStored(reviewKey(api, 'media-pdf', deckId)), replacement);
    assert.ok(files.has(firstRecord.uri)); assert.ok(files.has(replacement.uri));
  } finally { await tick(() => tree.unmount()); }
});

test('Refresh retries missing deck metadata and restores explicit PDF recovery without processing', async () => {
  seed(); removeStored(reviewKey(api, 'deck', deckId));
  network.respond = url => { if (url.includes('/decks/')) throw Error('offline'); return respond(url); };
  const tree = await mount();
  try {
    assert.match(text(tree), /Presentation metadata may be stale/);
    assert.equal(action(tree, 'Download PDF for offline review'), undefined);
    network.respond = respond;
    await tick(() => action(tree, 'Refresh').props.onPress());
    assert.equal(network.requests.filter(r => r.url === `${api}/decks/${deckId}/`).length, 2);
    assert.ok(action(tree, 'Download PDF for offline review'));
    assert.doesNotMatch(text(tree), /Presentation metadata may be stale/);
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
    assert.ok(readStored(reviewKey(api, 'media-pdf', deckId)));
    assert.equal(getSavedAttempt(attemptId), null); assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

for (const leave of ['background', 'navigation']) {
  test(`PDF errors from before ${leave} cannot invalidate the retained source after return`, async () => {
    seed(); const tree = await mount();
    try {
      await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
      await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
      const rendered = () => tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%');
      const oldFailure = rendered().props.onError;
      const record = readStored(reviewKey(api, 'media-pdf', deckId));
      await tick(() => leave === 'background' ? backgroundApp('background') : setFocused(false));
      await tick(() => oldFailure());
      assert.equal(rendered().props.source.uri, record.uri);
      await tick(() => leave === 'background' ? backgroundApp('active') : setFocused(true));
      await tick(() => oldFailure());
      assert.equal(rendered().props.source.uri, record.uri);
      await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
      await tick(() => oldFailure());
      assert.equal(rendered().props.source.uri, record.uri);
      assert.equal(action(tree, 'Download PDF for offline review'), undefined);
      await tick(() => rendered().props.onError()); // Current errors must still enable recovery.
      assert.ok(action(tree, 'Download PDF for offline review'));
      assert.deepEqual(readStored(reviewKey(api, 'media-pdf', deckId)), record); assert.ok(files.has(record.uri));
    } finally { await tick(() => tree.unmount()); }
  });
}

test('deck Refresh retains cache on failure and a newer refresh supersedes delayed metadata', async () => {
  seed(); const tree = await mount();
  try {
    network.respond = url => { if (url.includes('/decks/')) throw Error('offline'); return respond(url); };
    await tick(() => action(tree, 'Refresh').props.onPress());
    assert.match(text(tree), /Presentation metadata may be stale/);
    assert.ok(action(tree, 'Download PDF for offline review'));
    assert.equal(readStored(reviewKey(api, 'deck', deckId)).title, deckWire.title);
    const replies = [];
    network.respond = url => url.includes('/decks/') ? new Promise(resolve => replies.push(resolve)) : respond(url);
    await tick(() => action(tree, 'Refresh').props.onPress());
    const superseded = network.requests.findLast(r => r.url.includes('/decks/'));
    await tick(() => action(tree, 'Refresh').props.onPress());
    assert.equal(superseded.signal.aborted, true); assert.equal(replies.length, 2);
    await tick(() => replies[1](response(200, { ...deckWire, title: 'Current synthetic deck' })));
    await tick(() => replies[0](response(200, { ...deckWire, title: 'Superseded synthetic deck' })));
    assert.equal(readStored(reviewKey(api, 'deck', deckId)).title, 'Current synthetic deck');
    assert.match(text(tree), /Current synthetic deck/); assert.doesNotMatch(text(tree), /Superseded synthetic deck|Presentation metadata may be stale/);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

for (const leave of ['background', 'navigation', 'API change']) {
  test(`an explicit deck Refresh is cancelled on ${leave} and late metadata cannot enter cache`, async () => {
    seed(); removeStored(reviewKey(api, 'deck', deckId));
    network.respond = url => { if (url.includes('/decks/')) throw Error('offline'); return respond(url); };
    const tree = await mount(); let finish;
    try {
      network.respond = url => url.includes('/decks/') ? new Promise(resolve => { finish = resolve; }) : respond(url);
      const refresh = action(tree, 'Refresh').props.onPress;
      await tick(() => refresh());
      const request = network.requests.findLast(r => r.url.includes('/decks/'));
      assert.equal(request.signal.aborted, false);
      await tick(() => {
        if (leave === 'background') backgroundApp('background');
        else if (leave === 'navigation') setFocused(false);
        else tree.update(React.createElement(SavedAttemptScreen, { id: attemptId, apiUrl: 'http://other.invalid/api' }));
      });
      assert.equal(request.signal.aborted, true);
      const requests = network.requests.length;
      await tick(() => { refresh(); finish(response(200, deckWire)); });
      assert.equal(network.requests.length, requests);
      assert.equal(readStored(reviewKey(api, 'deck', deckId)), null);
      assert.equal(action(tree, 'Download PDF for offline review'), undefined);
      if (leave === 'API change') assert.match(text(tree), /not found for this API/);
      assert.ok(network.requests.every(r => r.method === 'GET'));
    } finally { await tick(() => tree.unmount()); }
  });
}

// Checkpoint 4: synthetic feedback, real saved screen and client; no paid transport.
const feedbackFixtures = await import('./helpers/feedback-fixtures.mjs');
function feedbackNetwork(initial = feedbackFixtures.absentFeedback()) {
  let current = initial;
  network.respond = (url, init) => {
    if (url.includes('/feedback/')) {
      if (init.method === 'POST') current = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection });
      return response(200, current);
    }
    if (url.includes('/descriptions/')) return response(200, feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection }));
    if (url.includes('/attempts/')) return response(200, feedbackFixtures.withFeedback({ feedback_analysis: current }));
    return respond(url);
  };
}
const paidRequests = () => network.requests.filter(r => r.method === 'POST');

test('feedback disclosure Cancel and obsolete Continue make no request; same-tick Generate/Continue submit once', async () => {
  seed(feedbackFixtures.withFeedback({ feedback_analysis: feedbackFixtures.absentFeedback() })); feedbackNetwork();
  const tree = await mount();
  try {
    const generate = action(tree, 'Generate feedback'); assert.ok(generate);
    await tick(() => { generate.props.onPress(); generate.props.onPress(); });
    assert.match(text(tree), /slide images\/text, descriptions, the saved transcript and optional audience context/);
    assert.match(text(tree), /does not send audio/);
    const obsolete = action(tree, 'Continue feedback').props.onPress;
    await tick(() => action(tree, 'Cancel feedback').props.onPress());
    assert.equal(paidRequests().length, 0);
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    await tick(obsolete);
    assert.equal(paidRequests().length, 0); assert.ok(action(tree, 'Continue feedback'));
    const proceed = action(tree, 'Continue feedback').props.onPress;
    await tick(() => { proceed(); proceed(); });
    assert.equal(paidRequests().length, 1);
    assert.deepEqual(JSON.parse(paidRequests()[0].body), { expected_selection: feedbackFixtures.selection.token });
    assert.match(text(tree), /Synthetic suggestion/); assert.match(text(tree), /Hello, 안녕!/);
    assert.equal(playback.played, 0);
  } finally { await tick(() => tree.unmount()); }
});

test('feedback description Cancel is local and a conflicted save retains its draft and disables generation', async () => {
  seed(feedbackFixtures.withFeedback()); feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
  const tree = await mount();
  try {
    await tick(() => tree.root.findByType('tab-bar').props.onChange('slides'));
    await tick(() => action(tree, 'Show slide 1 description').props.onPress());
    await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
    const input = () => tree.root.findAllByType('input').find(n => n.props.accessibilityLabel === 'Summary text');
    await tick(() => input().props.onChangeText('My unsaved correction'));
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 0);
    await tick(() => action(tree, 'Cancel description edit').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 0);
    await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
    await tick(() => input().props.onChangeText('Keep this draft'));
    const previous = network.respond;
    network.respond = (url, init) => init.method === 'PATCH' ? response(409, { error: { code: 'stale_description_revision', message: 'private must not display' } }) : previous(url, init);
    const save = action(tree, 'Save description').props.onPress;
    await tick(() => { save(); save(); });
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 1);
    for (const tab of ['overview', 'transcript', 'slides']) {
      await tick(() => tree.root.findByType('tab-bar').props.onChange(tab));
      assert.equal(input().props.value, 'Keep this draft');
      assert.equal(paidRequests().length, 0);
    }
    assert.match(text(tree), /draft is retained/); assert.doesNotMatch(text(tree), /private must not display/);
    assert.ok(action(tree, 'Reload descriptions')); assert.equal(paidRequests().length, 0);
  } finally { await tick(() => tree.unmount()); }
});

const feedbackStorage = await import('../src/features/feedback/storage.ts');
const initialFeedback = () => feedbackFixtures.absentFeedback();
function startFeedback() { const f = initialFeedback(); seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackNetwork(f); }

for (const leave of ['background', 'navigation', 'API change', 'attempt change']) {
  test(`feedback disclosure callback is invalid after ${leave}; return never generates or plays`, async () => {
    startFeedback(); const tree = await mount();
    try {
      await tick(() => action(tree, 'Generate feedback').props.onPress());
      const oldContinue = action(tree, 'Continue feedback').props.onPress;
      await tick(() => {
        if (leave === 'background') backgroundApp('background');
        else if (leave === 'navigation') setFocused(false);
        else tree.update(React.createElement(SavedAttemptScreen, { id: leave === 'attempt change' ? '99999999-9999-4999-8999-999999999999' : attemptId,
          apiUrl: leave === 'API change' ? 'http://other-feedback.invalid/api' : api }));
      });
      await tick(oldContinue);
      if (leave === 'background') await tick(() => backgroundApp('active'));
      if (leave === 'navigation') await tick(() => setFocused(true));
      await tick(oldContinue);
      assert.equal(paidRequests().length, 0); assert.equal(playback.played, 0);
      assert.equal(feedbackStorage.hasFeedbackConsent(api, feedbackFixtures.selection), false);
    } finally { await tick(() => tree.unmount()); }
  });
}

test('feedback consent persists by normalized API/provider/version independently of Whisper', async () => {
  const whisperConsentBefore = readStored('analysis-consent:openai:v1');
  startFeedback(); let tree = await mount();
  await tick(() => action(tree, 'Generate feedback').props.onPress());
  await tick(() => action(tree, 'Continue feedback').props.onPress());
  await tick(() => tree.unmount());
  assert.equal(feedbackStorage.hasFeedbackConsent(api + '/', feedbackFixtures.selection), true);
  assert.equal(feedbackStorage.hasFeedbackConsent('http://other.invalid/api', feedbackFixtures.selection), false);
  assert.equal(feedbackStorage.hasFeedbackConsent(api, { ...feedbackFixtures.selection, provider: 'openai' }), false);
  assert.equal(feedbackStorage.hasFeedbackConsent(api, { ...feedbackFixtures.selection, disclosure_version: 'feedback-v2' }), false);
  assert.equal(readStored('analysis-consent:openai:v1'), whisperConsentBefore);
  // A fresh attempt at the same API reuses provider consent without a new prompt.
  const id = '99999999-9999-4999-8999-999999999999';
  const f = initialFeedback(); f.attempt_id = id;
  saveHistory(api, deck, [parseReview(feedbackFixtures.withFeedback({ attempt_id: id, feedback_analysis: f }), id, api, deck)]);
  network.respond = (url, init) => url.includes('/feedback/') ? response(init.method === 'POST' ? 202 : 200, f) : url.includes('/descriptions/') ?
    response(200, feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection })) :
    url.includes('/attempts/') ? response(200, feedbackFixtures.withFeedback({ attempt_id: id, feedback_analysis: f })) : respond(url);
  await tick(() => { tree = create(React.createElement(SavedAttemptScreen, { id, apiUrl: api + '/' })); });
  try {
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.equal(action(tree, 'Continue feedback'), undefined); assert.equal(paidRequests().length, 2);
  } finally { await tick(() => tree.unmount()); removeStored(feedbackStorage.feedbackKey(api, 'attempt', id)); removeStored(reviewKey(api, 'attempt', id)); }
});

test('provider change while disclosure is open requires another explicit generation action', async () => {
  startFeedback(); const tree = await mount();
  try {
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    const oldContinue = action(tree, 'Continue feedback').props.onPress;
    const selection = { ...feedbackFixtures.selection, provider: 'openai', project_id: 'other-project', model: 'synthetic-model', token: '3'.repeat(64) };
    feedbackNetwork(initialFeedback());
    const prior = network.respond;
    network.respond = (url, init) => url.includes('/feedback/') ? response(200, initialFeedbackWithSelection(selection)) : prior(url, init);
    await tick(oldContinue);
    assert.equal(paidRequests().length, 0); assert.match(text(tree), /Selection or status changed/);
    assert.equal(feedbackStorage.hasFeedbackConsent(api, feedbackFixtures.selection), false);
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.match(text(tree), /OpenAI \(synthetic-model\)/); assert.ok(action(tree, 'Cancel feedback'));
  } finally { await tick(() => tree.unmount()); }
});
function initialFeedbackWithSelection(selection) { return feedbackFixtures.absentFeedback({ selection }); }

test('selection mismatch refreshes after 409 but never automatically resubmits or shows private error', async () => {
  startFeedback(); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const tree = await mount();
  try {
    const previous = network.respond; let mismatch = false;
    const changed = { ...feedbackFixtures.selection, token: '4'.repeat(64), model: 'changed-model' };
    network.respond = (url, init) => {
      if (url.includes('/feedback/') && init.method === 'POST') { mismatch = true; return response(409, { error: { code: 'selection_mismatch', message: 'secret provider body' } }); }
      if (url.includes('/feedback/') && mismatch) return response(200, initialFeedbackWithSelection(changed));
      return previous(url, init);
    };
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.equal(paidRequests().length, 1); assert.match(text(tree), /choose generation again/);
    assert.match(text(tree), /changed-model/); assert.doesNotMatch(text(tree), /secret provider body/);
    assert.equal(feedbackStorage.readPending(api, attemptId), null);
  } finally { await tick(() => tree.unmount()); }
});

test('timed-out feedback requires refresh and a separate charge acknowledgement before another POST', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  startFeedback(); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const previous = network.respond;
  network.respond = (url, init) => init.method === 'POST' ? new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('timeout')))) : previous(url, init);
  let tree = await mount();
  try {
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.equal(paidRequests().length, 1);
    await tick(() => t.mock.timers.tick(60_001));
    assert.match(text(tree), /outcome is unconfirmed/); assert.equal(paidRequests().length, 1);
    assert.equal(feedbackStorage.readPending(api, attemptId).kind, 'feedback');
    await tick(() => tree.unmount()); tree = await mount();
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.match(text(tree), /Another request may incur another charge/);
    await tick(() => action(tree, 'Cancel feedback').props.onPress()); assert.equal(paidRequests().length, 1);
    feedbackNetwork();
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    const next = action(tree, 'Continue feedback').props.onPress;
    await tick(() => { next(); next(); });
    assert.equal(paidRequests().length, 2); assert.equal(feedbackStorage.readPending(api, attemptId), null);
    assert.ok(network.requests.every(r => !r.url.endsWith('/process/')));
  } finally { await tick(() => tree.unmount()); }
});

test('failed description dependency retries its exact set/revision with its own acknowledgement', async () => {
  const dependency = { ...feedbackFixtures.descriptionState({ state: 'needs_confirmation', descriptions: null, available_data: false,
    description_revision: 0, processing_revision: 4, requires_confirmation: true, retry_available: true }), retry_action: 'generate_descriptions' };
  const f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: 'waiting_descriptions', stage: 'descriptions',
    description_revision: null, result: null, last_output: null, dependency });
  const d = feedbackFixtures.descriptionState({ ...dependency, selection: feedbackFixtures.descriptionSelection });
  seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackNetwork(f);
  const previous = network.respond;
  network.respond = (url, init) => url.includes('/descriptions/') ? response(200, d) : previous(url, init);
  feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Retry slide descriptions').props.onPress());
    assert.match(text(tree), /Another request may incur another charge/); assert.equal(paidRequests().length, 0);
    const next = action(tree, 'Continue feedback').props.onPress;
    await tick(() => { next(); next(); });
    assert.equal(paidRequests().length, 1); assert.match(paidRequests()[0].url, /descriptions\/generate\/$/);
    assert.deepEqual(JSON.parse(paidRequests()[0].body), { description_set_id: feedbackFixtures.setId, processing_revision: 4,
      acknowledge_uncertain: true, expected_selection: feedbackFixtures.descriptionSelection.token });
    assert.equal(playback.played, 0);
  } finally { await tick(() => tree.unmount()); }
});

test('cached partial feedback and descriptions survive offline restart and malformed feedback', async () => {
  const f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection });
  f.result.status = 'partial'; f.result.discarded_count = 1; f.last_output = { status: 'partial', accepted_count: 1, discarded_count: 1 };
  seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackNetwork(f);
  let tree = await mount(); await tick(() => tree.unmount());
  network.respond = () => { throw Error('offline'); }; tree = await mount();
  try {
    assert.match(text(tree), /Partial feedback/); assert.match(text(tree), /Synthetic suggestion/); assert.match(text(tree), /may be stale/);
    await tick(() => action(tree, 'Show slide 1 description').props.onPress()); assert.match(text(tree), /Synthetic slide 0/);
    assert.equal(action(tree, 'Review evidence 1').props.disabled, true); // no media
    network.respond = () => response(200, { bad: '<script>private malformed</script>' });
    await tick(() => action(tree, 'Refresh feedback').props.onPress());
    assert.match(text(tree), /Synthetic suggestion/); assert.match(text(tree), /Hello, 안녕!/);
    assert.doesNotMatch(text(tree), /private malformed/); assert.equal(getSavedAttempt(attemptId), null);
    assert.equal(paidRequests().length, 0);
  } finally { await tick(() => tree.unmount()); }
});

for (const source of ['fresh', 'cached']) {
  test(`${source} descriptions remain readable and editable when deck metadata fails; evidence stays disabled`, async () => {
    seed(feedbackFixtures.withFeedback()); feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
    removeStored(reviewKey(api, 'deck', deckId));
    if (source === 'cached') feedbackStorage.saveDescriptions(api, feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection }));
    const previous = network.respond;
    network.respond = (url, init) => {
      if (url.endsWith(`/decks/${deckId}/`)) return response(503, {});
      if (source === 'cached' && url.includes('/descriptions/')) throw Error('offline');
      return previous(url, init);
    };
    const tree = await mount();
    try {
      assert.equal(readStored(reviewKey(api, 'deck', deckId)), null);
      assert.equal(feedbackStorage.readDescriptions(api, deckId, feedbackFixtures.setId).descriptions.slides.length, 2);
      assert.ok(action(tree, 'Show slide 1 description'));
      assert.ok(action(tree, 'Show slide 2 description'));
      await tick(() => action(tree, 'Show slide 1 description').props.onPress());
      assert.match(text(tree), /Synthetic slide 0/); assert.match(text(tree), /Generated · revision 1/);
      await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
      const input = tree.root.findAllByType('input').find(n => n.props.accessibilityLabel === 'Summary text');
      const beforeEdit = network.requests.length;
      await tick(() => input.props.onChangeText('Unsaved synthetic correction'));
      await tick(() => action(tree, 'Cancel description edit').props.onPress());
      assert.equal(network.requests.length, beforeEdit);
      assert.match(text(tree), /Synthetic slide 0/); assert.doesNotMatch(text(tree), /Unsaved synthetic correction/);
      await tick(() => action(tree, 'Show slide 2 description').props.onPress());
      assert.match(text(tree), /Synthetic slide 1/);
      await tick(() => action(tree, 'Download audio for offline review').props.onPress());
      assert.equal(action(tree, 'Play').props.disabled, false);
      assert.equal(action(tree, 'Review evidence 1').props.disabled, true);
      await tick(() => action(tree, 'Review evidence 1').props.onPress());
      assert.deepEqual(playback.seeks, []); assert.equal(playback.played, 0);
      assert.match(text(tree), /Hello, 안녕!/); assert.equal(getSavedAttempt(attemptId), null);
      assert.ok(network.requests.every(r => r.method === 'GET'));
    } finally { await tick(() => tree.unmount()); }
  });
}

test('description edit validates uncertainty locally, preserves other slides and marks feedback stale without Whisper', async () => {
  let f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }), d = feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection });
  seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  network.respond = (url, init) => {
    if (url.includes('/descriptions/')) {
      if (init.method === 'PATCH') {
        d = { ...d, description_revision: 2, processing_revision: 2, descriptions: JSON.parse(init.body).descriptions, edited: true,
          updated_at: '2026-10-08T00:00:04Z', provenance: { ...d.provenance, origin: 'edited' } };
        f = { ...f, state: 'stale', stale: true, retry_available: true, updated_at: d.updated_at, result: { ...f.result, stale: true } };
      }
      return response(200, d);
    }
    if (url.includes('/feedback/')) return response(200, f);
    if (url.includes('/attempts/')) return response(200, feedbackFixtures.withFeedback({ feedback_analysis: f }));
    return respond(url);
  };
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Show slide 1 description').props.onPress());
    await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
    const input = label => tree.root.findAllByType('input').find(n => n.props.accessibilityLabel === label);
    for (const invalid of ['', 'x'.repeat(401), 'bad\u0000text']) {
      await tick(() => input('Summary text').props.onChangeText(invalid));
      await tick(() => action(tree, 'Save description').props.onPress());
      assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 0);
    }
    await tick(() => input('Summary text').props.onChangeText('수정한 설명'));
    await tick(() => action(tree, 'Summary: certain — toggle').props.onPress());
    await tick(() => action(tree, 'Save description').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 0);
    await tick(() => input('Summary uncertainty explanation').props.onChangeText('글자가 흐립니다'));
    await tick(() => action(tree, 'Save description').props.onPress());
    const patches = network.requests.filter(r => r.method === 'PATCH'); assert.equal(patches.length, 1);
    const payload = JSON.parse(patches[0].body);
    assert.equal(payload.description_revision, 1); assert.equal(payload.description_set_id, feedbackFixtures.setId);
    assert.deepEqual(payload.descriptions.slides[1], feedbackFixtures.descriptions.slides[1]);
    assert.equal(payload.descriptions.slides[0].source_id, feedbackFixtures.sources[0].source_id);
    assert.match(text(tree), /Stale suggestions/); assert.equal(action(tree, 'Review evidence 1').props.disabled, true);
    assert.equal(paidRequests().length, 0); assert.match(text(tree), /수정한 설명/);
    await tick(() => action(tree, 'Regenerate feedback').props.onPress());
    assert.equal(paidRequests().length, 1); assert.match(paidRequests()[0].url, /feedback\/generate\/$/);
    assert.ok(network.requests.every(r => !r.url.endsWith('/process/')));
  } finally { await tick(() => tree.unmount()); }
});

for (const playing of [false, true]) {
  test(`evidence uses existing player, preserves ${playing ? 'playing' : 'paused'} intent and rapid seek/Pause wins`, async () => {
    playback.eventMode = true; seed(feedbackFixtures.withFeedback()); feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
    const tree = await mount(); let finish;
    try {
      assert.equal(action(tree, 'Review evidence 1').props.disabled, true);
      await tick(() => action(tree, 'Download audio for offline review').props.onPress());
      assert.equal(action(tree, 'Review evidence 1').props.disabled, false);
      if (playing) await tick(() => action(tree, 'Play').props.onPress());
      await tick(() => action(tree, 'Review evidence 1').props.onPress());
      assert.equal(tree.root.findByType('tab-bar').props.value, 'slides');
      assert.equal(players.at(-1).currentStatus.playing, playing);
      assert.deepEqual(playback.seeks, [0]);
      if (playing) {
        playback.wait = new Promise(resolve => { finish = resolve; });
        await tick(() => { action(tree, 'Review evidence 1').props.onPress(); action(tree, 'Review evidence 1').props.onPress(); });
        await tick(() => action(tree, 'Pause').props.onPress());
        const played = playback.played;
        await tick(() => finish()); assert.equal(playback.played, played); assert.equal(players.at(-1).currentStatus.playing, false);
      }
      assert.equal(paidRequests().length, 0);
    } finally { finish?.(); await tick(() => tree.unmount()); }
  });
}

test('feedback polling only runs focused/foregrounded and ignores a cancelled GET', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: 'queued', result: null, last_output: null });
  seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackNetwork(f);
  const tree = await mount(); let finish;
  try {
    const previous = network.respond;
    network.respond = (url, init) => url.includes('/feedback/') ? new Promise(resolve => { finish = resolve; }) : previous(url, init);
    await tick(() => t.mock.timers.tick(2000));
    const request = network.requests.findLast(r => r.url.includes('/feedback/'));
    await tick(() => backgroundApp('background')); assert.equal(request.signal.aborted, true);
    const count = network.requests.length;
    await tick(() => t.mock.timers.tick(10_000)); assert.equal(network.requests.length, count);
    await tick(() => finish(response(200, feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }))));
    assert.doesNotMatch(text(tree), /Synthetic suggestion/);
    feedbackNetwork(f); await tick(() => backgroundApp('active'));
    assert.equal(paidRequests().length, 0); assert.equal(playback.played, 0);
    await tick(() => setFocused(false));
    const afterBlur = network.requests.length;
    await tick(() => t.mock.timers.tick(10_000)); assert.equal(network.requests.length, afterBlur);
  } finally { await tick(() => tree.unmount()); }
});

for (const reload of ['success', 'failure']) {
  test(`feedback polling resumes after failed Save preflight, Reload ${reload} and Cancel`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const queued = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: 'queued', result: null, last_output: null });
    seed(feedbackFixtures.withFeedback({ feedback_analysis: queued })); feedbackNetwork(queued);
    const tree = await mount();
    try {
      await tick(() => action(tree, 'Show slide 1 description').props.onPress());
      await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
      const input = () => tree.root.findAllByType('input').find(n => n.props.accessibilityLabel === 'Summary text');
      await tick(() => input().props.onChangeText('Retained synthetic draft'));
      const previous = network.respond;
      network.respond = (url, init) => { if (url.includes('/descriptions/')) throw Error('offline'); return previous(url, init); };
      await tick(() => action(tree, 'Save description').props.onPress());
      assert.ok(action(tree, 'Reload descriptions')); assert.equal(input().props.value, 'Retained synthetic draft');
      assert.equal(action(tree, 'Save description').props.disabled, true);
      if (reload === 'success') network.respond = previous;
      const reloadAction = action(tree, 'Reload descriptions').props.onPress;
      const beforeReload = network.requests.length;
      await tick(() => { reloadAction(); reloadAction(); });
      assert.equal(network.requests.length, beforeReload + 1);
      assert.equal(input().props.value, reload === 'success' ? 'Synthetic slide 0' : 'Retained synthetic draft');
      const beforeCancel = network.requests.length;
      await tick(() => action(tree, 'Cancel description edit').props.onPress());
      assert.equal(network.requests.length, beforeCancel);
      network.respond = previous;
      const feedbackReads = () => network.requests.filter(r => r.url.endsWith('/feedback/') && r.method === 'GET').length;
      const beforePoll = feedbackReads();
      await tick(() => t.mock.timers.tick(2000));
      assert.equal(feedbackReads(), beforePoll + 1);
      assert.match(text(tree), /Queued/);

      await tick(() => backgroundApp('background'));
      const afterBackground = network.requests.length;
      await tick(() => t.mock.timers.tick(10_000)); assert.equal(network.requests.length, afterBackground);
      await tick(() => backgroundApp('active'));
      await tick(() => setFocused(false));
      const afterBlur = network.requests.length;
      await tick(() => t.mock.timers.tick(10_000)); assert.equal(network.requests.length, afterBlur);
      await tick(() => setFocused(true));
      feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, updated_at: '2026-10-08T00:00:05Z' }));
      await tick(() => t.mock.timers.tick(2000));
      assert.match(text(tree), /Completed/); assert.match(text(tree), /Synthetic suggestion/);
      const afterComplete = network.requests.length;
      await tick(() => t.mock.timers.tick(10_000)); assert.equal(network.requests.length, afterComplete);
      assert.equal(playback.played, 0); assert.ok(network.requests.every(r => r.method === 'GET'));
    } finally { await tick(() => tree.unmount()); }
  });
}

test('older feedback GET cannot overwrite newer POST state at the same Whisper revision', async () => {
  startFeedback(); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const tree = await mount(); let finish;
  try {
    const previous = network.respond;
    network.respond = (url, init) => url.includes('/feedback/') && init.method === 'GET' ? new Promise(resolve => { finish = resolve; }) : previous(url, init);
    await tick(() => action(tree, 'Refresh feedback').props.onPress());
    const read = network.requests.findLast(r => r.url.includes('/feedback/'));
    feedbackNetwork(); await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.equal(read.signal.aborted, true); assert.match(text(tree), /Synthetic suggestion/);
    await tick(() => finish(response(200, initialFeedback())));
    assert.match(text(tree), /Synthetic suggestion/); assert.equal(paidRequests().length, 1);
    assert.equal(feedbackStorage.readFeedback(api, attemptId).feedback_revision, 1);
  } finally { await tick(() => tree.unmount()); }
});

test('late generation after leaving cannot publish; a returning read reconciles before another action', async () => {
  startFeedback(); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const previous = network.respond; let finish;
  network.respond = (url, init) => init.method === 'POST' ? new Promise(resolve => { finish = resolve; }) : previous(url, init);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    await tick(() => setFocused(false));
    assert.equal(paidRequests()[0].signal.aborted, true);
    await tick(() => finish(response(200, feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }))));
    assert.doesNotMatch(text(tree), /Synthetic suggestion/); assert.ok(feedbackStorage.readPending(api, attemptId));
    feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
    await tick(() => setFocused(true));
    assert.match(text(tree), /Synthetic suggestion/); assert.equal(feedbackStorage.readPending(api, attemptId), null);
    assert.equal(paidRequests().length, 1); assert.equal(playback.played, 0);
  } finally { await tick(() => tree.unmount()); }
});

test('description preflight conflict and timed-out PATCH keep drafts until explicit Reload or Cancel', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  seed(feedbackFixtures.withFeedback()); feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Show slide 1 description').props.onPress());
    await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
    const input = () => tree.root.findAllByType('input').find(n => n.props.accessibilityLabel === 'Summary text');
    await tick(() => input().props.onChangeText('Keep on preflight conflict'));
    const previous = network.respond;
    const changed = feedbackFixtures.descriptionState({ description_revision: 2, processing_revision: 2, edited: true,
      selection: feedbackFixtures.descriptionSelection, updated_at: '2026-10-08T00:00:05Z' });
    network.respond = (url, init) => url.includes('/descriptions/') ? response(200, changed) : previous(url, init);
    await tick(() => action(tree, 'Save description').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 0); assert.equal(input().props.value, 'Keep on preflight conflict');
    await tick(() => action(tree, 'Reload descriptions').props.onPress());
    assert.equal(input().props.value, 'Synthetic slide 0');
    await tick(() => input().props.onChangeText('Keep after timeout'));
    const get = network.respond;
    network.respond = (url, init) => init.method === 'PATCH' ? new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('timeout')))) : get(url, init);
    await tick(() => action(tree, 'Save description').props.onPress());
    await tick(() => t.mock.timers.tick(60_001));
    assert.equal(input().props.value, 'Keep after timeout'); assert.match(text(tree), /draft is retained/);
    assert.equal(action(tree, 'Save description').props.disabled, true);
    await tick(() => action(tree, 'Cancel description edit').props.onPress());
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 1); assert.equal(paidRequests().length, 0);
  } finally { await tick(() => tree.unmount()); }
});

for (const kind of ['empty', 'all_invalid', 'retained']) {
  test(`feedback ${kind} status is truthful and cannot hide transcript or audio controls`, async () => {
    const f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection });
    if (kind === 'retained') { f.feedback_revision = 2; f.result.stale = true; }
    else { f.result.suggestions = []; f.result.accepted_count = 0; f.result.status = kind;
      f.result.message = kind === 'empty' ? 'No supported suggestions.' : null; f.result.discarded_count = kind === 'empty' ? 0 : 1; }
    f.last_output = { status: kind === 'empty' ? 'empty' : 'all_invalid', accepted_count: 0, discarded_count: kind === 'empty' ? 0 : 1 };
    if (kind !== 'empty') { f.state = 'failed'; f.retry_available = true; f.error = { code: 'unsupported_feedback', message: 'private unsupported body' }; }
    seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackNetwork(f); const tree = await mount();
    try {
      assert.match(text(tree), /Hello, 안녕!/); assert.ok(action(tree, 'Download audio for offline review'));
      if (kind === 'empty') assert.match(text(tree), /No supported suggestions/);
      else { assert.doesNotMatch(text(tree), /No supported suggestions|private unsupported body/); assert.match(text(tree), /Latest generation failed/); }
      if (kind === 'retained') { assert.match(text(tree), /Stale suggestions/); assert.match(text(tree), /Synthetic suggestion/); }
      assert.equal(paidRequests().length, 0);
    } finally { await tick(() => tree.unmount()); }
  });
}

test('unknown page count or stale/invalid evidence cannot seek even with loaded audio', async () => {
  seed(feedbackFixtures.withFeedback()); feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
  removeStored(reviewKey(api, 'deck', deckId));
  const previous = network.respond;
  network.respond = (url, init) => url.endsWith(`/decks/${deckId}/`) ? response(503, {}) : previous(url, init);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    assert.equal(action(tree, 'Play').props.disabled, false); assert.equal(action(tree, 'Review evidence 1').props.disabled, true);
    const stale = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: 'stale', stale: true, retry_available: true }); stale.result.stale = true;
    feedbackNetwork(stale); await tick(() => action(tree, 'Refresh').props.onPress());
    await tick(() => action(tree, 'Refresh feedback').props.onPress());
    assert.equal(action(tree, 'Review evidence 1').props.disabled, true); assert.deepEqual(playback.seeks, []);
    const invalid = feedbackFixtures.feedbackState(); invalid.result.suggestions[0].word_start = 90;
    feedbackNetwork(invalid); await tick(() => action(tree, 'Refresh feedback').props.onPress());
    assert.equal(action(tree, 'Review evidence 1').props.disabled, true); assert.match(text(tree), /Hello, 안녕!/);
  } finally { await tick(() => tree.unmount()); }
});

test('feedback cache write failure keeps received suggestions in memory and never creates a local capture', async () => {
  startFeedback(); const tree = await mount();
  try {
    sqliteFaults.before = (op, sql, args) => { if (op === 'run' && String(args[0]).includes('feedback:v1:')) throw Error('disk full'); };
    feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
    await tick(() => action(tree, 'Refresh feedback').props.onPress());
    assert.match(text(tree), /Synthetic suggestion/); assert.match(text(tree), /offline cache could not be saved/);
    network.respond = () => { throw Error('offline'); }; await tick(() => action(tree, 'Refresh feedback').props.onPress());
    assert.match(text(tree), /Synthetic suggestion/); assert.equal(getSavedAttempt(attemptId), null);
    assert.equal(paidRequests().length, 0);
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

test('backward/simultaneous feedback evidence selects the native-clock visit and never drives PDF independently', async () => {
  playback.eventMode = true;
  const recording = feedbackFixtures.withFeedback({ metrics: null });
  recording.transcript = { text: 'Echo Echo Echo', words: [
    { text: 'Echo', start_ms: 100, end_ms: 700 }, { text: 'Echo', start_ms: 1000, end_ms: 1300 }, { text: 'Echo', start_ms: 1600, end_ms: 1900 }] };
  recording.slide_events = [{ slide_index: 1, at_ms: 0 }, { slide_index: 0, at_ms: 1000 }, { slide_index: 1, at_ms: 1000 }, { slide_index: 0, at_ms: 1500 }];
  recording.visits = recording.slide_events.map((event, i) => ({ slide_index: event.slide_index, start_ms: event.at_ms,
    end_ms: recording.slide_events[i + 1]?.at_ms ?? 2000, words: i === 1 ? [] : [recording.transcript.words[i === 0 ? 0 : i - 1]] }));
  const f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection });
  f.result.evidence.visits = recording.visits.map((v, i) => ({ ...v, words: undefined, word_indexes: i === 1 ? [] : [i === 0 ? 0 : i - 1] }));
  Object.assign(f.result.suggestions[0], { visit_id: 3, segment_id: 'v3s0', word_start: 2, word_end: 2, speech_quote: 'Echo', start_ms: 1600, end_ms: 1900 });
  recording.feedback_analysis = f;
  seed(recording); feedbackNetwork(f); const previous = network.respond;
  network.respond = (url, init) => url.endsWith(`/attempts/${attemptId}/`) ? response(200, recording) : previous(url, init);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Download audio for offline review').props.onPress());
    await tick(() => action(tree, 'Download PDF for offline review').props.onPress());
    await tick(() => tree.root.findAllByType('pdf').find(n => n.props.style.width === 1).props.onLoadComplete(2));
    const visible = () => tree.root.findAllByType('pdf').find(n => n.props.style.width === '100%');
    const player = players.at(-1);
    await tick(() => player.emit({ currentTime: 1, duration: 2, isLoaded: true, playing: false, didJustFinish: false }));
    assert.equal(visible().props.page, 2); assert.match(text(tree), /Slide 2 · Visit 3/);
    await tick(() => action(tree, 'Review evidence 1').props.onPress());
    assert.deepEqual(playback.seeks, [1.6]); assert.equal(playback.played, 0);
    assert.equal(visible().props.page, 2); // Seek completion alone is not a fabricated playback clock.
    await tick(() => player.emit({ currentTime: 1.6 }));
    assert.equal(visible().props.page, 1); assert.match(text(tree), /Slide 1 · Visit 4/);
  } finally { await tick(() => tree.unmount()); }
});

test('a delayed description GET cannot replace a saved edit or re-enable stale evidence', async () => {
  seed(feedbackFixtures.withFeedback()); feedbackNetwork(feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection }));
  const tree = await mount(); let finish;
  try {
    await tick(() => action(tree, 'Show slide 1 description').props.onPress());
    await tick(() => action(tree, 'Edit slide 1 description').props.onPress());
    const previous = network.respond;
    network.respond = (url, init) => url.includes('/descriptions/') ? new Promise(resolve => { finish = resolve; }) : previous(url, init);
    await tick(() => action(tree, 'Refresh feedback').props.onPress());
    const delayed = network.requests.findLast(r => r.url.includes('/descriptions/'));
    const input = tree.root.findAllByType('input').find(n => n.props.accessibilityLabel === 'Summary text');
    await tick(() => input.props.onChangeText('Saved new fact'));
    const edited = feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection, description_revision: 2,
      processing_revision: 2, edited: true, updated_at: '2026-10-08T00:00:06Z' });
    edited.descriptions.slides[0].summary.text = 'Saved new fact';
    network.respond = (url, init) => init.method === 'PATCH' ? response(200, edited) : previous(url, init);
    await tick(() => action(tree, 'Save description').props.onPress());
    assert.equal(delayed.signal.aborted, true); assert.match(text(tree), /Saved new fact/);
    await tick(() => finish(response(200, feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection }))));
    assert.match(text(tree), /Saved new fact/); assert.match(text(tree), /Stale suggestions/);
    assert.equal(feedbackStorage.readDescriptions(api, deckId, feedbackFixtures.setId).description_revision, 2);
    assert.equal(network.requests.filter(r => r.method === 'PATCH').length, 1); assert.equal(paidRequests().length, 0);
  } finally { await tick(() => tree.unmount()); }
});

test('a stale dependency GET cannot restore confirmation after description retry; completed dependencies keep polling for coaching', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dependency = { ...feedbackFixtures.descriptionState({ state: 'needs_confirmation', descriptions: null, available_data: false,
    description_revision: 0, processing_revision: 4, requires_confirmation: true, retry_available: true }), retry_action: 'generate_descriptions' };
  const f = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: 'waiting_descriptions', stage: 'descriptions',
    description_revision: null, result: null, last_output: null, dependency });
  const before = feedbackFixtures.descriptionState({ ...dependency, selection: feedbackFixtures.descriptionSelection });
  const queued = { ...before, processing_revision: 5, state: 'queued', retry_available: false, requires_confirmation: false, updated_at: '2026-10-08T00:00:07Z' };
  let currentDescription = before;
  seed(feedbackFixtures.withFeedback({ feedback_analysis: f })); feedbackNetwork(f); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const previous = network.respond;
  network.respond = (url, init) => url.includes('/descriptions/') ? response(200, init.method === 'POST' ? queued : currentDescription) : previous(url, init);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Retry slide descriptions').props.onPress());
    await tick(() => action(tree, 'Continue feedback').props.onPress());
    assert.match(text(tree), /Describing slides · Queued/); assert.doesNotMatch(text(tree), /Needs confirmation/);
    assert.equal(action(tree, 'Retry slide descriptions'), undefined);
    currentDescription = feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection, processing_revision: 5,
      updated_at: '2026-10-08T00:00:08Z' });
    await tick(() => t.mock.timers.tick(2000));
    const beforePoll = network.requests.length;
    await tick(() => t.mock.timers.tick(2000));
    assert.ok(network.requests.length > beforePoll); assert.equal(paidRequests().length, 1);
  } finally { await tick(() => tree.unmount()); }
});

test('known feedback rejection uses safe copy without claiming an unknown charged request', async () => {
  startFeedback(); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
  const previous = network.respond;
  network.respond = (url, init) => init.method === 'POST' ? response(400, { error: { code: 'no_speech', message: 'private provider body' } }) : previous(url, init);
  const tree = await mount();
  try {
    await tick(() => action(tree, 'Generate feedback').props.onPress());
    assert.match(text(tree), /No speech is available for suggestions/);
    assert.doesNotMatch(text(tree), /outcome is unconfirmed|private provider body/);
    assert.equal(feedbackStorage.readPending(api, attemptId), null); assert.equal(paidRequests().length, 1);
    assert.match(text(tree), /Hello, 안녕!/);
  } finally { await tick(() => tree.unmount()); }
});

for (const stage of ['coaching', 'descriptions']) {
  test(`${stage} quota stop uses safe copy and saved Gemini selection; expiry/lifecycle never retry automatically`, async t => {
    const start = new Date('2026-10-08T00:00:10Z');
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: start });
    const error = { code: 'quota_stopped', message: 'Hostile private provider detail' };
    const retry_at = '2026-10-08T00:01:00Z';
    let description = feedbackFixtures.descriptionState({ selection: feedbackFixtures.descriptionSelection,
      ...(stage === 'descriptions' ? { state: 'failed', descriptions: null, available_data: false, description_revision: 0,
        processing_revision: 4, retry_available: false, retry_at, error } : {}) });
    let current = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: stage === 'coaching' ? 'failed' : 'waiting_descriptions',
      stage, retry_available: false, retry_at: stage === 'coaching' ? retry_at : null,
      error: stage === 'coaching' ? error : { code: 'description_dependency_failed', message: 'Private dependency detail' },
      ...(stage === 'descriptions' ? { description_revision: null, result: null, last_output: null,
        dependency: { ...description, retry_action: 'generate_descriptions' } } : {}) });
    seed(feedbackFixtures.withFeedback({ feedback_analysis: current }));
    network.respond = (url, init) => {
      if (url.includes('/descriptions/')) return response(200, description);
      if (url.includes('/feedback/')) return response(200, current);
      if (url.includes('/attempts/')) return response(200, feedbackFixtures.withFeedback({ feedback_analysis: current }));
      return respond(url, init);
    };
    let tree = await mount();
    const label = stage === 'coaching' ? 'Retry feedback' : 'Retry slide descriptions';
    try {
      assert.match(text(tree), /Generation stopped because the Gemini quota is unavailable/);
      assert.match(text(tree), /Retry after/); assert.match(text(tree), /Gemini · gemini-3.1-flash-lite/);
      assert.doesNotMatch(text(tree), /Hostile private|Private dependency/);
      if (stage === 'descriptions') assert.equal(action(tree, label).props.disabled, true);
      else assert.equal(action(tree, label), undefined);
      await tick(() => t.mock.timers.tick(60_000));
      await tick(() => action(tree, 'Refresh feedback').props.onPress());
      await tick(() => backgroundApp('background')); await tick(() => backgroundApp('active'));
      await tick(() => tree.unmount()); tree = await mount();
      assert.equal(paidRequests().length, 0);
      assert.match(text(tree), /Hello, 안녕!/); assert.equal(playback.played, 0);
      if (stage === 'coaching') assert.match(text(tree), /Synthetic suggestion/);
      // Only fresh metadata enables the explicit retry; it still carries Gemini.
      description = { ...description, retry_available: stage === 'descriptions', updated_at: '2026-10-08T00:01:11Z' };
      current = { ...current, retry_available: stage === 'coaching', updated_at: '2026-10-08T00:01:11Z',
        dependency: stage === 'descriptions' ? { ...description, retry_action: 'generate_descriptions' } : null };
      await tick(() => action(tree, 'Refresh feedback').props.onPress());
      const retry = action(tree, label).props.onPress;
      await tick(() => { retry(); retry(); });
      assert.equal(paidRequests().length, 0); assert.match(text(tree), /to Gemini/);
      const proceed = action(tree, 'Continue feedback').props.onPress;
      await tick(() => { proceed(); proceed(); });
      assert.equal(paidRequests().length, 1);
      assert.deepEqual(JSON.parse(paidRequests()[0].body), stage === 'coaching'
        ? { feedback_revision: 1, expected_selection: feedbackFixtures.selection.token }
        : { description_set_id: feedbackFixtures.setId, processing_revision: 4, expected_selection: feedbackFixtures.descriptionSelection.token });
    } finally { await tick(() => tree.unmount()); }
  });
}

for (const guard of ['stale', 'uncertain']) {
  test(`dependency quota copy does not mask ${guard} coaching`, async () => {
    const dependency = { ...feedbackFixtures.descriptionState({ state: 'failed', descriptions: null, available_data: false,
      description_revision: 0, error: { code: 'quota_stopped', message: 'Private quota detail' } }), retry_action: 'generate_descriptions' };
    const current = feedbackFixtures.feedbackState({ selection: feedbackFixtures.selection, state: guard === 'stale' ? 'stale' : 'needs_confirmation',
      stage: 'descriptions', stale: guard === 'stale', requires_confirmation: guard === 'uncertain', result: null, last_output: null,
      description_revision: null, dependency, error: { code: guard === 'stale' ? 'descriptions_changed' : 'uncertain_submission', message: 'Private failure detail' } });
    seed(feedbackFixtures.withFeedback({ feedback_analysis: current })); feedbackNetwork(current);
    const previous = network.respond;
    network.respond = (url, init) => url.includes('/descriptions/') ? response(200, feedbackFixtures.descriptionState({ ...dependency, selection: feedbackFixtures.descriptionSelection })) : previous(url, init);
    const tree = await mount();
    try {
      assert.doesNotMatch(text(tree), /Generation stopped because the Gemini quota|Private quota|Private failure/);
      if (guard === 'stale') assert.match(text(tree), /Descriptions changed/);
      assert.equal(paidRequests().length, 0);
    } finally { await tick(() => tree.unmount()); }
  });
}

for (const code of ['invalid_source', 'invalid_image', 'source_unavailable']) {
  test(`feedback source rejection explains the deck problem without a refresh loop: ${code}`, async () => {
    startFeedback(); feedbackStorage.saveFeedbackConsent(api, feedbackFixtures.selection);
    const previous = network.respond;
    network.respond = (url, init) => init.method === 'POST'
      ? response(400, { error: { code, message: 'private provider body' } }) : previous(url, init);
    const tree = await mount();
    try {
      await tick(() => action(tree, 'Generate feedback').props.onPress());
      assert.match(text(tree), /slide images|saved PDF/i);
      assert.doesNotMatch(text(tree), /Generation was not admitted|outcome is unconfirmed|private provider body/);
      assert.equal(feedbackStorage.readPending(api, attemptId), null);
      assert.equal(paidRequests().length, 1);
      assert.match(text(tree), /Hello, 안녕!/);
    } finally { await tick(() => tree.unmount()); }
  });
}
