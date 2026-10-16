// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Audience Q&A client against synthetic server responses.
// No real network or audio: the expo fetch/file modules are the existing upload fixtures.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve } from './helpers/upload-loader.mjs';
import { files, network, response } from './helpers/upload-native.mjs';
registerHooks({ resolve });
const { saveAnalysisConsent, hasAnalysisConsent } = await import('../src/features/transcription/analysisStorage.ts');
const { API_URL } = await import('../src/services/api.ts');
const { writeStored, readStored } = await import('../src/services/storage.ts');
const { generateQuestions, judgeAnswer } = await import('../src/features/qa/client.ts');

const OLD = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const deck = { id: 'synthetic-qa', title: 'Synthetic talk', uri: 'file:///synthetic.pdf', pageCount: 3 };
const key = `server-deck:${API_URL}:${deck.id}`;
const slides = [{ slide_index: 0, title: 'Problem', transcript: 'Feedback arrives late.' }];
const notJson = status => ({ ok: false, status, json: async () => { throw new SyntaxError('Unexpected token <'); } });
const answer = { audioUri: 'file:///answer.m4a', question: 'Why now?', mainQuestion: 'Why now?', part: 0, slideIndex: 1, durationMs: 42000 };

beforeEach(() => {
  saveAnalysisConsent();
  network.requests.length = 0; network.respond = null;
  files.clear(); files.set('file:///synthetic.pdf', {}); files.set('file:///answer.m4a', { data: 'synthetic answer' });
  writeStored(key, OLD);
});

test('questions are requested for the mapped server deck and sanitised', async () => {
  network.respond = (url, init) => {
    assert.equal(url, `${API_URL}/decks/${OLD}/qa/questions/`);
    const body = JSON.parse(init.body);
    assert.equal(body.audience, 'Faculty panel');
    assert.deepEqual(body.slides, slides);
    return response(200, { questions: [
      { panelist: 'P1', role: 'Methods', slide_index: 9, topic: 'Data', question: 'How was it measured?', follow_up: 'With whom?' },
      { panelist: 'P2', role: 'Industry', slide_index: 2, topic: '', question: '', follow_up: '' },
      { panelist: 'P3', role: 'Ethics', slide_index: 1, topic: 'Consent', question: 'Who sees the audio?', follow_up: 'For how long?' },
      { panelist: 'P4', role: 'Extra', slide_index: 0, topic: '', question: 'Ignored fourth', follow_up: '' },
    ] });
  };
  const qs = await generateQuestions(deck, slides, 'Faculty panel');
  assert.deepEqual(qs.map(q => [q.panelist, q.slide_index, q.question]), [['P1', 0, 'How was it measured?'], ['P3', 1, 'Who sees the audio?']]);
});

test('an older backend without the Q&A route is reported as such', async () => {
  network.respond = () => notJson(404);
  await assert.rejects(generateQuestions(deck, slides, 'Panel'), e => e.code === 'not_found' && /does not have Audience Q&A/.test(e.message));
});

test('feedback switched off on the server surfaces its error code', async () => {
  network.respond = () => response(503, { error: { code: 'disabled', message: 'AI feedback is disabled.' } });
  await assert.rejects(generateQuestions(deck, slides, 'Panel'), e => e.code === 'disabled');
});

test('a server that lost the presentation gets it uploaded again once', async () => {
  network.respond = (url, init) => {
    if (url.endsWith(`/decks/${OLD}/qa/questions/`)) return response(404, { error: { code: 'deck_not_found', message: 'Not on the server.' } });
    if (url.endsWith(`/decks/${OLD}/`)) return response(404, { detail: 'Not found.' });
    if (url.endsWith('/decks/') && init.method === 'POST') return response(201, { deck: { id: NEW, page_count: 3 }, slides: [] });
    if (url.endsWith(`/decks/${NEW}/qa/questions/`)) return response(200, { questions: [{ panelist: 'P1', role: 'Chair', slide_index: 0, topic: '', question: 'Q?', follow_up: '' }] });
    throw new Error('Unexpected ' + url);
  };
  const qs = await generateQuestions(deck, slides, 'Panel');
  assert.equal(qs.length, 1);
  assert.equal(readStored(key), NEW);
  assert.equal(network.requests.filter(r => r.url.endsWith('/decks/') && r.method === 'POST').length, 1);
});

test('an answer is sent as audio plus metadata and the review is validated', async () => {
  network.respond = (url, init) => {
    assert.equal(url, `${API_URL}/decks/${OLD}/qa/answers/`);
    const meta = JSON.parse(init.body.get('metadata'));
    assert.deepEqual(meta, { question: 'Why now?', main_question: 'Why now?', part: 0, slide_index: 1, duration_ms: 42000 });
    assert.ok(init.body.get('audio'));
    return response(200, { transcript: { text: 'Because feedback is late.', words: [] }, verdict: 'partly', did: 'Gave a reason.', evidence: 'No numbers.', clarify: 'Add the survey result.', duration_ms: 41800 });
  };
  const r = await judgeAnswer(deck, answer);
  assert.equal(r.verdict, 'partly');
  assert.equal(r.duration_ms, 41800);
  network.respond = () => response(200, { transcript: { text: '', words: [] }, verdict: 'great' });
  await assert.rejects(judgeAnswer(deck, answer), e => e.code === 'invalid_response');
});

test('a missing answer recording is caught before any upload', async () => {
  files.delete('file:///answer.m4a');
  network.respond = () => { throw new Error('should not upload'); };
  await assert.rejects(judgeAnswer(deck, answer), e => e.code === 'audio_missing');
  assert.equal(network.requests.length, 0);
});


test('old provider consent cannot authorize answer audio or slide hints', async () => {
  const current = 'analysis-consent:elevenlabs:scribe-v2:keyterms:v2';
  writeStored(current, false);
  writeStored('analysis-consent:v1', true);
  writeStored('analysis-consent:elevenlabs:scribe-v2:v1', true);
  assert.equal(hasAnalysisConsent(), false);
  await assert.rejects(judgeAnswer(deck, answer), e => e.code === 'transcription_consent_required');
  assert.equal(network.requests.length, 0);
  saveAnalysisConsent();
  network.respond = () => response(200, { transcript: { text: 'Um, yes.', words: [] }, verdict: 'answered', duration_ms: 42000 });
  assert.equal((await judgeAnswer(deck, answer)).verdict, 'answered');
  assert.equal(network.requests.length, 1);
});
