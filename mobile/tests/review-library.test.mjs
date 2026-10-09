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

for (const mode of ['all', 'practice']) test(`${mode} displays cached merged presentation history before requests finish, preserves stale entries, and fences API changes`, async () => {
  const capture = { id: attemptId, local_deck_id: 'synthetic-library', title: 'Retained synthetic PDF', pdf_uri: '', page_count: 2,
    created_at: '2026-10-08T00:00:00Z', state: 'saved', recording: { id: attemptId, audio_uri: '', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events } };
  saveAttempt(capture); writeStored(`server-deck:${api}:${capture.local_deck_id}`, deckId);
  const deck = parseDeck(deckWire, deckId, api), server = wireResult({ attempt_id: '33333333-3333-4333-8333-333333333333' });
  saveDeck(api, deck); saveHistory(api, deck, [parseReview(wireResult(), attemptId, api, deck), parseReview(server, server.attempt_id, api, deck)]);
  let finish; network.respond = () => new Promise(resolve => { finish = resolve; }); network.requests.length = 0;
  let tree; await tick(() => { tree = create(React.createElement(LibraryScreen, { apiUrl: api, mode })); });
  try {
    assert.equal(action(tree, 'Open saved rehearsal').length, 2); // Local/server UUID dedup.
    const historyCards = tree.root.findAllByType('card').filter(card => action({ root: card }, 'Open saved rehearsal').length);
    assert.equal(historyCards.length, 1, 'Attempts for the same presentation stay together, including server-only attempts.');
    // Catalog restoration uses real async file I/O in this harness. Wait for request admission, not an assumed event-loop tick.
    for (let i = 0; i < 40 && !network.requests.length; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(network.requests.length, 1); assert.ok(action(tree, 'Refreshing history…').length);
    await tick(() => action(tree, 'Open saved rehearsal')[1].props.onPress());
    assert.ok([attemptId, server.attempt_id].includes(routes.at(-1).params.attemptId));
    await tick(() => finish(response(503, {})));
    assert.match(JSON.stringify(tree.toJSON()), /History may be stale/); assert.equal(action(tree, 'Open saved rehearsal').length, 2);
    network.respond = () => new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, 'Refresh history')[0].props.onPress()); const old = network.requests.at(-1);
    await tick(() => tree.update(React.createElement(LibraryScreen, { apiUrl: 'http://other.invalid/api', mode })));
    assert.equal(old.signal.aborted, true); await tick(() => finish(response(200, deckWire)));
    assert.equal(action(tree, 'Open saved rehearsal').length, 1); assert.equal(readHistory('http://other.invalid/api', deckId).length, 0);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});

test('Practice groups attempts by presentation identity, orders groups and attempts newest first, and keeps missing PDFs', async () => {
  const ids = ['bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-000000000003'];
  const { removeStored } = await import('../src/services/storage.ts');
  for (let i = 0; i < ids.length; i++) saveAttempt({ id: ids[i], local_deck_id: i === 1 ? 'group-b' : 'group-a', title: 'Synthetic grouped presentation', pdf_uri: '', page_count: 2,
    created_at: `2026-10-10T0${i + 1}:00:00Z`, state: 'saved', recording: { id: ids[i], audio_uri: '', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events } });
  network.respond = () => { throw Error('offline'); }; network.requests.length = 0;
  let tree; await tick(() => { tree = create(React.createElement(LibraryScreen, { apiUrl: api, mode: 'practice' })); });
  try {
    const cards = tree.root.findAllByType('card').filter(card => card.findAllByType('text').some(n => n.props.children === 'Synthetic grouped presentation'));
    assert.equal(cards.length, 2, 'Distinct presentations with identical titles must not be merged.');
    const first = action({ root: cards[0] }, 'Open saved rehearsal'), second = action({ root: cards[1] }, 'Open saved rehearsal');
    assert.equal(first.length, 2); assert.equal(second.length, 1);
    const opened = [];
    for (const button of [...first, ...second]) { await tick(() => button.props.onPress()); opened.push(routes.at(-1).params.attemptId); }
    assert.deepEqual(opened, [ids[2], ids[0], ids[1]]);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); ids.forEach(id => removeStored(`attempt:${id}`)); }
});

test('Home limits recent presentations, opens the latest review and exposes the complete library', async () => {
  for (let i = 1; i <= 4; i++) saveAttempt({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`, local_deck_id: `home-${i}`, title: `Home deck ${i}`, pdf_uri: '', page_count: 2,
    created_at: `2026-10-08T0${i}:00:00Z`, state: 'saved', recording: { audio_uri: '', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events } });
  network.respond = () => { throw Error('offline'); }; network.requests.length = 0;
  let tree; await tick(() => { tree = create(React.createElement(LibraryScreen, { apiUrl: api, mode: 'home' })); });
  try {
    assert.equal(action(tree, 'Review latest rehearsal').length, 3);
    await tick(() => action(tree, 'See all')[0].props.onPress());
    assert.equal(routes.at(-1), '/library');
    await tick(() => action(tree, 'Review latest rehearsal')[0].props.onPress());
    assert.equal(routes.at(-1).params.attemptId, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004');
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { await tick(() => tree.unmount()); }
});


test('Home opens imported slides and ignores a picker result after navigation away', async () => {
  const { pdfService } = await import('../src/features/pdf/service.ts');
  const { setFocused } = await import('./helpers/recording-screen-ui.mjs');
  const originalImport = pdfService.importPdf;
  const sample = { id: 'synthetic-new-import', title: 'New import', uri: 'file:///new.pdf' };
  let tree, finish;
  try {
    setFocused(true); network.requests.length = 0;
    await tick(() => { tree = create(React.createElement(LibraryScreen, { apiUrl: api, mode: 'home' })); });
    pdfService.importPdf = async () => sample;
    await tick(() => action(tree, 'Import PDF')[0].props.onPress());
    assert.deepEqual(routes.at(-1), { pathname: '/viewer', params: { uri: sample.uri, title: sample.title, localDeckId: sample.id } });
    pdfService.importPdf = () => new Promise(resolve => { finish = resolve; });
    await tick(() => action(tree, 'Import PDF')[0].props.onPress());
    const navigations = routes.length;
    await tick(() => setFocused(false));
    await tick(() => finish(sample));
    assert.equal(routes.length, navigations);
    assert.ok(network.requests.every(r => r.method === 'GET'));
  } finally { pdfService.importPdf = originalImport; await tick(() => tree?.unmount()); setFocused(true); }
});

test('newly imported presentations stay recent before their first recording', async () => {
  const { recentPresentations } = await import('../src/features/home/historyPresentation.ts');
  const importedAt = Date.parse('2026-10-08T05:00:00Z');
  const old = { key: 'old', pdfs: [], entries: [{ id: 'old-attempt', local: { created_at: '2026-10-07T05:00:00Z' } }] };
  const fresh = { key: 'new', pdfs: [{ id: `${importedAt}-synthetic` }], entries: [] };
  assert.deepEqual(recentPresentations([old, fresh]).map(group => group.key), ['new', 'old']);
});
