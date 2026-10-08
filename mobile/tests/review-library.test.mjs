import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { network, response } from './helpers/upload-native.mjs';
import { wireResult, deckWire, deckId, attemptId } from './helpers/review-fixtures.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { LibraryScreen } = await import('../src/features/pdf/LibraryScreen.tsx');
const { saveAttempt } = await import('../src/features/recording/storage.ts');
const { writeStored } = await import('../src/services/storage.ts');
const { saveDeck, saveHistory, readHistory } = await import('../src/features/transcription/reviewStorage.ts');
const { parseDeck, parseReview } = await import('../src/features/transcription/reviewValidation.ts');
const { routes } = await import('./helpers/recording-screen-ui.mjs');
const api = 'http://review.invalid/api';
const tick = async fn => { await act(async () => { fn(); await new Promise(setImmediate); }); };
const action = (tree, name) => tree.root.findAllByType('action').filter(n => n.props.label === name);

test('Library displays cached merged presentation history before requests finish, preserves stale entries, and fences API changes', async () => {
  const capture = { id: attemptId, local_deck_id: 'synthetic-library', title: 'Retained synthetic PDF', pdf_uri: '', page_count: 2,
    created_at: '2026-10-08T00:00:00Z', state: 'saved', recording: { id: attemptId, audio_uri: '', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events } };
  saveAttempt(capture); writeStored(`server-deck:${api}:${capture.local_deck_id}`, deckId);
  const deck = parseDeck(deckWire, deckId, api), server = wireResult({ attempt_id: '33333333-3333-4333-8333-333333333333' });
  saveDeck(api, deck); saveHistory(api, deck, [parseReview(wireResult(), attemptId, api, deck), parseReview(server, server.attempt_id, api, deck)]);
  let finish; network.respond = () => new Promise(resolve => { finish = resolve; }); network.requests.length = 0;
  let tree; await tick(() => { tree = create(React.createElement(LibraryScreen, { apiUrl: api })); });
  try {
    assert.equal(action(tree, 'Open saved rehearsal').length, 2); // Local/server UUID dedup.
    assert.equal(network.requests.length, 1); assert.ok(action(tree, 'Refreshing history…').length);
    await tick(() => action(tree, 'Open saved rehearsal')[1].props.onPress());
    assert.ok([attemptId, server.attempt_id].includes(routes.at(-1).params.attemptId));
    await tick(() => finish(response(503, {})));
    assert.match(JSON.stringify(tree.toJSON()), /History may be stale/); assert.equal(action(tree, 'Open saved rehearsal').length, 2);
    network.respond = () => new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, 'Refresh history')[0].props.onPress()); const old = network.requests.at(-1);
    await tick(() => tree.update(React.createElement(LibraryScreen, { apiUrl: 'http://other.invalid/api' })));
    assert.equal(old.signal.aborted, true); await tick(() => finish(response(200, deckWire)));
    assert.equal(action(tree, 'Open saved rehearsal').length, 1); assert.equal(readHistory('http://other.invalid/api', deckId).length, 0);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});
