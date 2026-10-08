import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { network, response } from './helpers/upload-native.mjs';
import { wireResult, deckWire, deckId, attemptId } from './helpers/review-fixtures.mjs';
registerHooks({ resolve, load });
const { parseReview, parseDeck, mediaUrl } = await import('../src/features/transcription/reviewValidation.ts');
const { readHistory, saveHistory, saveDeck, readDeck, readReview } = await import('../src/features/transcription/reviewStorage.ts');
const { saveAnalysis } = await import('../src/features/transcription/analysisStorage.ts');
const { writeStored } = await import('../src/services/storage.ts');
const { knownHistory, mergeHistory, refreshHistory } = await import('../src/features/transcription/reviewHistory.ts');
const { createTranscriptionClient } = await import('../src/features/transcription/client.ts');
const { transcriptSpans, activeWordIndex } = await import('../src/features/transcription/playback.ts');
const api = 'http://review.invalid/api';
const deck = parseDeck(deckWire, deckId, api);
const local = { id: attemptId, local_deck_id: 'synthetic-local', title: 'Synthetic retained capture', pdf_uri: 'file:///synthetic.pdf', page_count: 2,
  created_at: '2026-10-07T00:00:00Z', state: 'upload_failed', recording: { id: attemptId, audio_uri: 'file:///synthetic.wav', duration_ms: 2000, audience: '', slide_events: wireResult().slide_events } };

test('known history merges by API and UUID, retains capture recovery state and missing-catalog groups', () => {
  writeStored(`server-deck:${api}:${local.local_deck_id}`, deckId);
  const review = parseReview(wireResult(), attemptId, api, deck);
  saveDeck(api, deck); saveHistory(api, deck, [review, review]);
  const groups = knownHistory(api + '/', [], [local]);
  assert.equal(groups.length, 1); assert.equal(groups[0].entries.length, 1);
  assert.equal(groups[0].entries[0].local.state, 'upload_failed'); assert.equal(groups[0].entries[0].review.attempt_id, attemptId);
  assert.equal(groups[0].pdfs.length, 0);
  assert.equal(knownHistory('http://other.invalid/api', [], [local])[0].entries[0].review, undefined);
  assert.equal(readHistory('http://other.invalid/api', deckId).length, 0);
  const other = { ...review, attempt_id: '33333333-3333-4333-8333-333333333333' };
  assert.equal(mergeHistory([local], [review, other]).length, 2);
});

test('offline failures preserve cached history, and late aborted responses cannot publish', async () => {
  const before = readHistory(api, deckId);
  network.respond = () => { throw Error('offline'); };
  await assert.rejects(refreshHistory(api, knownHistory(api, [], [local])[0], new AbortController().signal));
  assert.deepEqual(readHistory(api, deckId), before); assert.deepEqual(readDeck(api, deckId), deck);
  const controller = new AbortController(); let finish;
  network.respond = () => new Promise(resolve => { finish = resolve; });
  const pending = refreshHistory(api, knownHistory(api, [], [local])[0], controller.signal);
  controller.abort(); finish(response(200, { ...deckWire, title: 'stale title' }));
  await assert.rejects(pending); assert.equal(readDeck(api, deckId).title, deck.title);
});

test('history cannot regress newer revisions or same-revision terminal/detail snapshots', () => {
  const latest = wireResult({ processing_revision: 4, transcript: { text: 'Latest detail', words: [] } });
  saveAnalysis(api, latest);
  saveHistory(api, deck, [parseReview(wireResult(), attemptId, api, deck)]);
  assert.equal(readReview(api, attemptId).transcript.text, 'Latest detail');
  saveHistory(api, deck, [parseReview(wireResult({ processing_revision: 4, transcript: { text: 'Late same-revision history', words: [] } }), attemptId, api, deck)]);
  assert.equal(readReview(api, attemptId).transcript.text, 'Latest detail');
  const active = wireResult({ processing_revision: 4, processing_state: 'aligning', status: 'processing' });
  saveAnalysis(api, active); assert.equal(readReview(api, attemptId).status, 'completed');
  // Explicit same-revision detail can update retry availability without allowing a history rollback.
  const failed = wireResult({ processing_revision: 5, status: 'failed', processing_state: 'failed', error: { code: 'alignment_failed', message: 'Synthetic' }, retry_available: false });
  saveAnalysis(api, failed); saveAnalysis(api, { ...failed, retry_available: true });
  assert.equal(readReview(api, attemptId).processing_result.retry_available, true);
});

test('legacy and partial transcripts degrade independently from malformed media, dates, pages and process metadata', () => {
  const legacy = parseReview({ attempt_id: attemptId, transcript: { text: 'Legacy text.', words: [] } }, attemptId, api);
  assert.equal(legacy.transcript.text, 'Legacy text.'); assert.equal(legacy.duration_ms, null); assert.equal(legacy.processing_result, null);
  const partial = parseReview(wireResult({ visits: null, transcript: { text: 'Beyond duration', words: [{ text: 'Beyond', start_ms: 1900, end_ms: 3000 }] }, audio_url: 'file:///private', created_at: 'bad date' }), attemptId, api, deck);
  assert.equal(partial.transcript.words[0].end_ms, 3000); assert.equal(partial.duration_ms, 2000);
  assert.equal(partial.audio_url, null); assert.equal(partial.created_at, null); assert.equal(partial.visits, null);
  const bad = parseReview(wireResult({ slide_events: [{ slide_index: 3, at_ms: 0 }], visits: [{ slide_index: 3, start_ms: 0, end_ms: 2000, words: [] }] }), attemptId, api, deck);
  assert.deepEqual(bad.slide_events, []); assert.equal(bad.visits, null);
  assert.throws(() => parseReview(wireResult({ deck_id: attemptId }), attemptId, api, deck), /presentation/);
  assert.throws(() => parseDeck({ ...deckWire, page_count: 11 }, deckId, api));
  for (const url of ['http://user:pass@review.invalid/a', 'https://review.invalid/a', 'http://other.invalid/a', 'file:///a', 'http://review.invalid/a#fragment']) assert.equal(mediaUrl(url, api), null);
  assert.equal(mediaUrl('http://review.invalid/recordings/a.wav', api), 'http://review.invalid/recordings/a.wav');
});

test('GET deck/history/review are read-only and reject mismatched attempt-deck association', async () => {
  const calls = [];
  const client = createTranscriptionClient({ baseUrl: api, audioFile() { assert.fail('no upload'); }, fetch: async (url, init) => {
    calls.push({ url, method: init.method });
    return response(200, url.endsWith('/attempts/') ? [wireResult()] : url.includes('/decks/') ? deckWire : wireResult());
  } });
  const actual = await client.getDeck(deckId); await client.getHistory(actual); await client.getReview(attemptId);
  assert.equal(calls.length, 3); assert.ok(calls.every(c => c.method === 'GET' && !c.url.includes('/process/')));
  const invalid = createTranscriptionClient({ baseUrl: api, audioFile() {}, fetch: async () => response(200, [wireResult({ deck_id: attemptId })]) });
  await assert.rejects(invalid.getHistory(actual), /different presentation/);
});

test('malformed first timestamp cannot assign the second Echo timing to the first occurrence', () => {
  const review = parseReview({ attempt_id: attemptId, transcript: { text: 'Echo Echo', words: [
    { text: 'Echo', start_ms: 'invalid', end_ms: 500 },
    { text: 'Echo', start_ms: 1000, end_ms: 1500 },
  ] } }, attemptId, api);
  assert.equal(review.transcript.text, 'Echo Echo');
  assert.deepEqual(transcriptSpans(review.transcript), [{ text: 'Echo Echo', wordIndex: null }]);
  assert.equal(activeWordIndex(review.transcript.words, 1000, 2000), -1);
});

test('API-scoped history, deck, analysis and media metadata survive a fresh process without creating a local capture', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os');
  const { join } = await import('node:path'); const { execFileSync } = await import('node:child_process');
  const folder = mkdtempSync(join(tmpdir(), 'outloud-review-restart-'));
  const env = { ...process.env, ONLOUD_TEST_DB: join(folder, 'review.db') };
  const setup = `import { registerHooks } from 'node:module'; import { resolve, load } from './tests/helpers/saved-screen-loader.mjs'; registerHooks({resolve,load});
    const s = await import('./src/features/transcription/reviewStorage.ts'); const v = await import('./src/features/transcription/reviewValidation.ts');
    const f = await import('./tests/helpers/review-fixtures.mjs'); const kv = await import('./src/services/storage.ts'); const api='http://review.invalid/api';`;
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', setup + `
      const deck=v.parseDeck(f.deckWire,f.deckId,api);s.saveDeck(api,deck);s.saveHistory(api,deck,[v.parseReview(f.wireResult(),f.attemptId,api,deck)]);
      const m=await import('./src/features/transcription/reviewMedia.ts');const native=await import('./tests/helpers/upload-native.mjs');
      native.network.respond=()=>new Response(new Uint8Array([1,2,3]));
      await m.reviewMedia.download({api,id:f.attemptId,kind:'audio',url:f.wireResult().audio_url,durationMs:2000},async()=>{},new AbortController().signal);`], { env, stdio: 'pipe' });
    const reopened = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', setup + `
      console.log(JSON.stringify({history:s.readHistory(api,f.deckId),deck:s.readDeck(api,f.deckId),
      other:s.readHistory('http://other.invalid/api',f.deckId),capture:kv.readStored('attempt:'+f.attemptId),media:kv.readStored(s.reviewKey(api,'media-audio',f.attemptId))}));`], { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
    assert.equal(reopened.history[0].transcript.text, wireResult().transcript.text); assert.equal(reopened.deck.id, deckId);
    assert.equal(reopened.other.length, 0); assert.equal(reopened.capture, null);
    assert.equal(reopened.media.bytes, 3); assert.equal(reopened.media.validated, true); assert.match(reopened.media.uri, /outloud-review/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('upgrade reads analysis-only cache as a review without writing or crossing API/attempt identities', async () => {
  const { readStored } = await import('../src/services/storage.ts');
  const { sqliteFaults } = await import('./helpers/sqlite-node.mjs');
  const upgradeApi = 'http://upgrade.invalid/api';
  const cached = wireResult({ audio_url: 'http://upgrade.invalid/synthetic.wav' });
  saveAnalysis(upgradeApi, cached);
  sqliteFaults.before = op => { if (op === 'run') throw Error('offline upgrade cannot write'); };
  try {
    const review = readReview(upgradeApi + '/', attemptId);
    assert.deepEqual(review, parseReview(cached, attemptId, upgradeApi));
    assert.equal(readStored(`review:v1:${encodeURIComponent(upgradeApi)}:attempt:${attemptId}`), null);
    assert.equal(readReview('http://other-upgrade.invalid/api', attemptId), null);
    assert.equal(readReview(upgradeApi, deckId), null);
  } finally { sqliteFaults.before = null; }
});
