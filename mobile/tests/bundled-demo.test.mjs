// OpenAI Codex, 2026-11-02: bundled demo lifecycle tests; see docs/ai-collaboration-prompts-iteration-2.md.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, load } from './helpers/bundled-demo-loader.mjs';
registerHooks({ resolve, load });
const { root, documentDirectory } = await import('./helpers/pdf-node-storage.mjs');
const { demoNative } = await import('./helpers/bundled-demo-native.mjs');
const { sqliteFaults } = await import('./helpers/sqlite-node.mjs');
const { readStored, writeStored, removeStored, listStored } = await import('../src/services/storage.ts');
const { pdfService, getImportedPdfs } = await import('../src/features/pdf/service.ts');
const { saveAttempt, getSavedAttempt } = await import('../src/features/recording/storage.ts');
const { loadPresentations, getSnapshot, deckById, setHidden, visibleDecks } = await import('../src/features/presentations/store.ts');
const { SEOUL_DEMO_ID: id, SEOUL_DEMO_MARKER: marker } = await import('../src/features/presentations/bundledDemo.ts');
const key = `pres:v1:${id}`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedHash = '48e673f2dce98c5b4a67a1ad52fcb68092bdc5d606c03d68892e6b187be1f9aa';

beforeEach(async () => {
  sqliteFaults.before = null;
  await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(root, { recursive: true });
  for (const record of [marker, key, 'pres-hidden:v1', 'attempt:existing-audio']) removeStored(record);
  Object.assign(demoNative, { assetDownloads: 0, renders: 0, failRender: false });
});
after(() => fs.rm(root, { recursive: true, force: true }));

test('fresh offline startup seeds the exact seven-page PDF with durable images/text and no provider intent', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('No startup network request is allowed'); };
  try { await loadPresentations(); } finally { globalThis.fetch = previousFetch; }
  assert.equal(getSnapshot().error, '');
  const deck = deckById(id);
  assert.equal(deck.title, 'Seoul'); assert.equal(deck.pageCount, 7); assert.equal(deck.text, 'ready');
  assert.equal(deck.pages.length, 7); assert.equal(deck.slides.length, 7);
  assert.ok(deck.slides.every(slide => slide.text.trim())); assert.equal(deck.slides[0].title, 'Seoul');
  assert.equal(deck.target, 600); assert.equal(deck.targets.reduce((a, b) => a + b, 0), 600);
  assert.equal(deck.audience, 'General audience');
  assert.equal(digest(await fs.readFile(new URL(deck.uri))), expectedHash);
  for (const page of deck.pages) { assert.ok(page.uri.startsWith(documentDirectory)); assert.ok((await fs.stat(new URL(page.uri))).size > 0); }
  assert.equal(readStored(marker), true); assert.equal((await getImportedPdfs()).length, 1);
  assert.deepEqual(listStored('presentation-defaults:'), []); assert.deepEqual(listStored('presentation-requirements-draft:'), []);
  assert.deepEqual(listStored('deck:v1:'), []); assert.deepEqual(listStored('presentation-score:'), []);
});

test('concurrent startup and foreground loads prepare one copy and publish one catalog entry', async () => {
  const first = loadPresentations(), second = loadPresentations(); assert.equal(first, second);
  await Promise.all([first, second, loadPresentations()]);
  assert.equal(demoNative.assetDownloads, 1); assert.equal(demoNative.renders, 1);
  assert.deepEqual((await getImportedPdfs()).map(pdf => pdf.id), [id]);
});

test('persisted installation survives restart loads and respects later hide or remove choices', async () => {
  await loadPresentations(); const original = readStored(key);
  setHidden(id, true); await loadPresentations();
  assert.deepEqual(readStored(key), original); assert.equal(visibleDecks().some(deck => deck.id === id), false);
  await pdfService.removePdf(id); await loadPresentations();
  assert.equal(deckById(id), null); assert.equal((await getImportedPdfs()).length, 0);
  assert.equal(readStored(marker), true); assert.equal(demoNative.renders, 1); assert.equal(demoNative.assetDownloads, 1);
});

test('renderer failure preserves existing decks, recordings and hidden state; a later load retries', async () => {
  const custom = { id: 'custom-existing', title: 'Existing talk', uri: new URL('existing.pdf', documentDirectory).href };
  await fs.writeFile(new URL(custom.uri), '%PDF-1.7 synthetic existing'); await pdfService.addBundledPdf(custom);
  const look = { ...custom, order: 4, hue: 'violet', icon: 'book', pageCount: 1, pages: [], slides: [], text: 'pending', target: 60, targets: [60], audience: 'Existing audience', createdAt: '2026-10-01T00:00:00Z' };
  const savedState = { run: { id: 'existing-run', parts: [{ attemptId: 'existing-audio' }] }, takes: 2 };
  const audio = new URL('existing-audio.m4a', documentDirectory); await fs.writeFile(audio, 'Synthetic existing audio');
  const attempt = { id: 'existing-audio', local_deck_id: custom.id, title: custom.title, pdf_uri: custom.uri, page_count: 1,
    created_at: '2026-10-01T00:00:00Z', state: 'saved', recording: { id: 'existing-audio', audio_uri: audio.href,
      audience: '', duration_ms: 1000, slide_events: [{ slide_index: 0, at_ms: 0 }] } };
  saveAttempt(attempt);
  writeStored('pres:v1:custom-existing', look); writeStored('deck:v1:custom-existing', savedState); writeStored('pres-hidden:v1', [custom.id]);
  demoNative.failRender = true; await loadPresentations();
  assert.match(getSnapshot().error, /renderer failure/); assert.equal(readStored(marker), null);
  assert.deepEqual(readStored('pres:v1:custom-existing'), look); assert.deepEqual(readStored('deck:v1:custom-existing'), savedState);
  assert.deepEqual(getSnapshot().hidden, [custom.id]); assert.equal(deckById(custom.id).title, 'Existing talk'); assert.equal(deckById(id), null);
  demoNative.failRender = false; await loadPresentations();
  assert.equal(getSnapshot().error, ''); assert.equal(deckById(id).pageCount, 7);
  assert.deepEqual(readStored('pres:v1:custom-existing'), look); assert.deepEqual(readStored('deck:v1:custom-existing'), savedState);
  assert.deepEqual(getSnapshot().hidden, [custom.id]); assert.equal(deckById(id).order, 5);
  assert.deepEqual(getSavedAttempt(attempt.id), attempt); assert.equal(await fs.readFile(audio, 'utf8'), 'Synthetic existing audio');
});

test('a failed final marker write reuses the completed presentation without rendering or resetting it', async () => {
  let failed = false;
  sqliteFaults.before = (operation, _sql, args) => {
    if (!failed && operation === 'run' && args[0] === marker) { failed = true; throw Error('Synthetic marker write failure'); }
  };
  await loadPresentations(); sqliteFaults.before = null;
  assert.match(getSnapshot().error, /marker write failure/); assert.equal(readStored(marker), null);
  const deck = { ...readStored(key), icon: 'globe' }; writeStored(key, deck);
  await loadPresentations(); assert.equal(readStored(marker), true); assert.deepEqual(readStored(key), deck);
  assert.equal(demoNative.renders, 1); assert.equal(demoNative.assetDownloads, 1); assert.equal((await getImportedPdfs()).length, 1);
});
