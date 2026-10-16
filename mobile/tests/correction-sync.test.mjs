import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/correction-store-loader.mjs';
registerHooks({ resolve, load });
const store = await import('../src/features/presentations/correctionStore.ts');
const { writeStored, readStored } = await import('../src/services/storage.ts');
const { correctionStaleness } = await import('../src/features/feedback/storage.ts');
const { correctionLines } = await import('../src/features/presentations/correctionLines.ts');
const { buildLines, buildVocabulary, splitFlags } = await import('../src/domain/lines.ts');
const { mergeTake } = await import('../src/domain/run.ts');
const api = 'http://corrections.invalid/api', base = 'a'.repeat(64);
const transcript = { text: 'Echo Echo.', words: [{ text: 'Echo', start_ms: 0, end_ms: 700 }, { text: 'Echo', start_ms: 500, end_ms: 1000 }] };
const snapshot = (id, changes = {}) => ({ attempt_id: id, base_transcript_id: base, revision: 0, edits: [], effective_text: transcript.text, source_changed: false, ...changes });
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });

test('offline edits survive, remain distinct per API, and never request analysis', async () => {
  const id = 'offline';
  writeStored('deck:v1:legacy', { edits: { 'offline#0': { text: 'Retain me' } } });
  store.initializeCorrections(api, id, base, transcript);
  store.confirmCorrection(api, id, 0, 0, 'ChatGPT', transcript);
  const client = store.createCorrectionClient(api, async url => { assert.ok(url.endsWith('/corrections/')); throw new Error('offline'); });
  await assert.rejects(client.synchronize(id));
  assert.equal(store.readCorrections(api, id).pending, true);
  assert.equal(store.readCorrections(api, id).edits[0].text, 'ChatGPT');
  assert.equal(store.readCorrections('http://another.invalid/api', id), null);
  assert.equal(readStored('deck:v1:legacy').edits['offline#0'].text, 'Retain me');
});

test('an edit made during PATCH is not cleared by its older response; concurrent sync is shared', async () => {
  const id = 'concurrent'; store.initializeCorrections(api, id, base, transcript);
  store.confirmCorrection(api, id, 0, 0, 'ChatGPT', transcript);
  let release, count = 0;
  const client = store.createCorrectionClient(api, async (_url, init) => {
    const body = JSON.parse(init.body); count++;
    if (count === 1) await new Promise(r => { release = r; });
    return response(snapshot(id, { revision: count, edits: body.edits, effective_text: 'corrected' }));
  });
  const pending = client.synchronize(id);
  assert.equal(client.synchronize(id), pending);
  store.confirmCorrection(api, id, 1, 1, '다시', transcript);
  release(); await pending;
  const saved = store.readCorrections(api, id);
  assert.equal(saved.server.revision, 2); assert.equal(saved.pending, false);
  assert.deepEqual(saved.edits.map(e => e.text), ['ChatGPT', '다시']);
});

test('conflicts retain local edits and require an explicit version choice', async () => {
  const id = 'conflict'; store.initializeCorrections(api, id, base, transcript);
  store.confirmCorrection(api, id, 0, 0, 'Local', transcript);
  const remote = snapshot(id, { revision: 1, edits: [{ word_start: 0, word_end: 0, text: 'Remote' }], effective_text: 'Remote Echo' });
  const client = store.createCorrectionClient(api, async (_url, init) => init.method === 'PATCH' ? response({}, 409) : response(remote));
  await assert.rejects(client.synchronize(id));
  assert.equal(store.readCorrections(api, id).conflict, true);
  assert.equal(store.readCorrections(api, id).edits[0].text, 'Local');
  await client.refresh(id);
  assert.equal(store.readCorrections(api, id).conflict, true, 'Repeated GET must not authorize Keep mine');
  await assert.rejects(client.synchronize(id), /Resolve/);
  store.acceptServerCorrections(api, id);
  assert.equal(store.readCorrections(api, id).edits[0].text, 'Remote');
  assert.equal(store.readCorrections(api, id).pending, false);
});

test('local invalidation retains results but marks them outdated before synchronization', () => {
  const result = { stale: false, suggestions: ['old'] };
  const feedback = { feedback_revision: 1, transcript_revision: 0, state: 'completed', result };
  const outdated = correctionStaleness(feedback, 0, true, false);
  assert.equal(outdated.state, 'stale'); assert.equal(outdated.result.stale, true);
  assert.deepEqual(outdated.result.suggestions, ['old']);
  assert.equal(feedback.result.stale, false);
  assert.equal(correctionStaleness(feedback, 0, false, false), feedback);
});

test('a successful equivalent-text save accepts the server canonical ranges without repeated PATCHes', async () => {
  const id = 'equivalent'; store.initializeCorrections(api, id, base, transcript);
  store.confirmCorrection(api, id, 0, 0, 'Foo', transcript);
  let count = 0;
  const canonical = snapshot(id, { revision: 1, edits: [{ word_start: 0, word_end: 1, text: 'Foo Echo' }], effective_text: 'Foo Echo' });
  const client = store.createCorrectionClient(api, async () => {
    if (++count > 1) throw new Error('Duplicate save loop');
    return response(canonical);
  });
  await client.synchronize(id);
  assert.equal(store.readCorrections(api, id).pending, false);
  assert.equal(count, 1);
});

test('refresh recognizes a committed save after its response was lost despite JSONB object-key ordering', async () => {
  const id = 'lost-response'; store.initializeCorrections(api, id, base, transcript);
  store.confirmCorrection(api, id, 0, 0, 'Foo', transcript);
  let committed = false;
  const client = store.createCorrectionClient(api, async (_url, init) => {
    if (init.method === 'PATCH') { committed = true; throw new Error('Lost response'); }
    return response(snapshot(id, { revision: committed ? 1 : 0, edits: [{ text: 'Foo', word_end: 0, word_start: 0 }], effective_text: 'Foo Echo.' }));
  });
  await assert.rejects(client.synchronize(id));
  await client.refresh(id);
  assert.equal(store.readCorrections(api, id).pending, false);
  assert.equal(store.readCorrections(api, id).conflict, false);
});

test('keeping an AI recognition original dismisses only that offer without changing text or revision', () => {
  const id = 'dismissed'; store.initializeCorrections(api, id, base, transcript);
  const line = { key: id + '#0', audio: { attemptId: id }, source: { first: 0, last: 1, text: transcript.text },
    text: transcript.text, flags: [], words: transcript.words, slide: 0 };
  const offer = { revision: 0, suggestions: [{ word_start: 0, word_end: 0, original: 'Echo', error_type: 'acronym', replacements: ['ECHO'], reason: 'Possible acronym' }] };
  const render = dismissed => correctionLines([line], new Map([[id, transcript]]), buildVocabulary([]), () => store.readCorrections(api, id), () => offer, dismissed)[0];
  const before = render({});
  assert.equal(before.flags.length, 1);
  const kept = render({ [line.key]: { dismissed: [before.flags[0].dismissal] } });
  assert.deepEqual(kept.flags, []);
  assert.equal(kept.text, transcript.text);
  assert.equal(store.readCorrections(api, id).server.revision, 0);
  assert.deepEqual(store.readCorrections(api, id).edits, []);
});

test('displaying a word correction preserves sentence punctuation and native word evidence', () => {
  const id = 'punctuation'; store.initializeCorrections(api, id, base, transcript);
  store.confirmCorrection(api, id, 0, 0, 'ChatGPT', transcript);
  const line = { key: id + '#0', audio: { attemptId: id }, source: { first: 0, last: 1, text: 'Echo Echo.' },
    text: 'Echo Echo.', flags: [], words: transcript.words, slide: 0 };
  const shown = correctionLines([line], new Map([[id, transcript]]), buildVocabulary(['']), () => store.readCorrections(api, id), () => null);
  assert.equal(shown[0].text, 'ChatGPT Echo.');
  assert.deepEqual(shown[0].words, transcript.words);
});

test('restoring a correction that spans a slide boundary restores both sides without changing visits/audio', () => {
  const id = 'boundary'; store.initializeCorrections(api, id, base, transcript);
  const run = mergeTake(null, { attemptId: id, visits: [{ slide: 0, startMs: 0, endMs: 500 }, { slide: 1, startMs: 500, endMs: 1500 }],
    spoken: [true, true], whole: true, createdAt: '' }, { n: 2, targets: [10, 10], deckTarget: 20, lastFullTotal: null, takeNo: 1, id: 'boundary-run' }).run;
  const vocab = buildVocabulary(['', '']);
  const original = buildLines(run, 2, new Map([[id, transcript]]), {}, vocab);
  store.confirmCorrection(api, id, 0, 1, 'Corrected across slides', transcript);
  const render = () => correctionLines(original, new Map([[id, transcript]]), vocab, () => store.readCorrections(api, id), () => null);
  const corrected = render();
  assert.equal(corrected[0].text, 'Corrected across slides');
  assert.match(corrected[1].text, /preceding correction/);
  assert.deepEqual(corrected.map(l => [l.audio, l.visit]), original.map(l => [l.audio, l.visit]));
  store.restoreCorrections(api, id, 0, 0, transcript);
  assert.deepEqual(render().map(l => l.text), original.map(l => l.text));
});

test('AI suggestion selects the second repeated term and is rejected after local edits', () => {
  const id = 'words'; store.initializeCorrections(api, id, base, transcript);
  const run = mergeTake(null, { attemptId: id, visits: [{ slide: 0, startMs: 0, endMs: 1500 }], spoken: [true], whole: true, createdAt: '' },
    { n: 1, targets: [10], deckTarget: 10, lastFullTotal: null, takeNo: 1, id: 'run' }).run;
  const vocab = buildVocabulary(['']);
  const lines = buildLines(run, 1, new Map([[id, transcript]]), {}, vocab);
  const suggestion = { revision: 0, suggestions: [{ word_start: 1, word_end: 1, original: 'Echo', error_type: 'acronym', replacements: ['ECHO'], reason: 'Acronym' }] };
  const render = () => correctionLines(lines, new Map([[id, transcript]]), vocab, () => store.readCorrections(api, id), () => suggestion);
  const flagged = render()[0];
  assert.deepEqual(splitFlags(flagged.text, flagged.flags).map(p => [p.t, p.fi]), [['Echo ', -1], ['Echo', 0], ['.', -1]]);
  assert.equal(flagged.flags[0].range.first, 1);
  store.confirmCorrection(api, id, 0, 0, 'Changed', transcript);
  assert.equal(render()[0].flags.some(f => f.range), false);
});

test('legacy arbitrary sentence edits remain archived and are never adopted or displayed', () => {
  const id = 'legacy-ignored';
  const run = mergeTake(null, { attemptId: id, visits: [{ slide: 0, startMs: 0, endMs: 1500 }], spoken: [true], whole: true, createdAt: '' },
    { n: 1, targets: [10], deckTarget: 10, lastFullTotal: null, takeNo: 1, id: 'legacy' }).run;
  const edits = { [id + '#0']: { text: 'A perfectly polished presentation' } };
  writeStored('deck:v1:archived-edits', { run, edits });
  const shown = buildLines(run, 1, new Map([[id, transcript]]), edits, buildVocabulary(['ECHO']));
  assert.equal(shown[0].text, transcript.text);
  assert.equal(shown[0].fixed, false);
  assert.deepEqual(shown[0].flags, [], 'Slide spelling differences alone are not STT evidence');
  assert.equal(readStored('deck:v1:archived-edits').edits[id + '#0'].text, edits[id + '#0'].text);
});

test('delayed suggestion GET cannot clear newer staleness; local correction revisions also fence output', async () => {
  const { createSTTClient, readSTTState } = await import('../src/features/presentations/transcriptSuggestions.ts');
  const id = 'stt-response-order'; let release, count = 0;
  const state = { attempt_id: id, feedback_revision: 1, transcript_revision: 0, state: 'completed', stale: false, analysis_version: 'recognition-v2',
    updated_at: '2026-10-15T00:00:00Z', selection: null, result: { analysis_version: 'recognition-v2', transcript_revision: 0, stale: false, suggestions: [] } };
  const client = createSTTClient(api, async () => {
    if (++count === 1) { await new Promise(r => { release = r; }); return response(state); }
    return response({ ...state, state: 'stale', stale: true, result: { ...state.result, stale: true } });
  });
  const old = client.refresh(id); await client.refresh(id); release(); await old;
  assert.equal(readSTTState(api, id).stale, true);
  const localId = 'stt-local-pending'; store.initializeCorrections(api, localId, base, transcript);
  const localClient = createSTTClient(api, async () => response({ ...state, attempt_id: localId }));
  await localClient.refresh(localId);
  store.confirmCorrection(api, localId, 0, 0, 'Corrected', transcript);
  assert.equal(readSTTState(api, localId).stale, true);
  assert.equal((await localClient.refresh(localId)).stale, true);
});

test('only offered AI replacements are accepted locally; acceptance/restoration keep source timing and offline state', async () => {
  const { createSTTClient, acceptSuggestedCorrection } = await import('../src/features/presentations/transcriptSuggestions.ts');
  const { playbackPieces } = await import('../src/domain/lines.ts');
  const id = 'accept-ai'; store.initializeCorrections(api, id, base, transcript);
  const offer = { word_start: 0, word_end: 0, original: 'Echo', error_type: 'acronym', replacements: ['ECHO'], reason: 'Synthetic acronym recognition' };
  const client = createSTTClient(api, async () => response({ attempt_id: id, analysis_version: 'recognition-v2', feedback_revision: 1,
    transcript_revision: 0, state: 'completed', stale: false, updated_at: null, selection: null,
    result: { analysis_version: 'recognition-v2', transcript_revision: 0, stale: false, suggestions: [offer] } }));
  await client.refresh(id);
  assert.throws(() => acceptSuggestedCorrection(api, id, 0, 0, 'Rewritten speech', transcript), /unavailable/);
  const original = JSON.stringify(transcript);
  acceptSuggestedCorrection(api, id, 0, 0, 'ECHO', transcript);
  assert.equal(store.readCorrections(api, id).pending, true);
  const reopen = await import('../src/features/presentations/correctionStore.ts');
  assert.equal(reopen.readCorrections(api, id).edits[0].text, 'ECHO');
  assert.throws(() => acceptSuggestedCorrection(api, id, 0, 0, 'ECHO', transcript), /outdated/);
  const line = { key: id + '#0', audio: { attemptId: id }, source: { first: 0, last: 1, text: transcript.text },
    text: transcript.text, flags: [], words: transcript.words, slide: 0 };
  const corrected = correctionLines([line], new Map([[id, transcript]]), buildVocabulary([]), () => store.readCorrections(api, id), () => null)[0];
  assert.equal(corrected.text, 'ECHO Echo.');
  assert.deepEqual(corrected.words, transcript.words);
  assert.equal(playbackPieces(corrected, 100).find(p => p.active)?.t, 'ECHO');
  store.restoreCorrections(api, id, 0, 0, transcript);
  assert.equal(JSON.stringify(transcript), original);
  assert.deepEqual(store.readCorrections(api, id).edits, []);
});

test('old suggestion result schema remains read-only and cannot block explicit upgrade', async () => {
  const { createSTTClient, readSTTState } = await import('../src/features/presentations/transcriptSuggestions.ts');
  const id = 'historical-schema'; let posts = 0;
  const old = { attempt_id: id, feedback_revision: 1, transcript_revision: 0, analysis_version: 'corrections-v1',
    state: 'stale', stale: true, updated_at: null, selection: null, result: { analysis_version: 'corrections-v1',
      transcript_revision: 0, stale: true, suggestions: [{ word_start: 0, word_end: 0, original: 'Echo', replacements: ['ECHO'], reason: 'Old schema' }] } };
  const client = createSTTClient(api, async (_url, init) => {
    if (init.method === 'POST') posts++;
    return response(init.method === 'POST' ? { ...old, feedback_revision: 2, analysis_version: 'recognition-v2', state: 'queued', stale: false } : old);
  });
  assert.equal((await client.refresh(id)).result, null);
  assert.equal(readSTTState(api, id).stale, true);
  const next = await client.generate(id, { feedback_revision: 1 });
  assert.equal(posts, 1); assert.equal(next.state, 'queued'); assert.equal(next.result, null);
});

test('old rewrite-derived coaching stays retained but outdated even offline', async () => {
  const { withCorrectionStaleness } = await import('../src/features/feedback/storage.ts');
  const original = { feedback_revision: 1, transcript_revision: 2, analysis_version: 'corrections-v1', state: 'completed',
    result: { stale: false, suggestions: ['Retained evidence'] } };
  const old = withCorrectionStaleness(original, api, 'old-coaching');
  assert.equal(old.stale, true); assert.equal(old.result.stale, true);
  assert.deepEqual(old.result.suggestions, original.result.suggestions);
});
