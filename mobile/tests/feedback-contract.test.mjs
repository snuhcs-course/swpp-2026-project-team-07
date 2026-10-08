import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { resolve } from './helpers/storage-native-loader.mjs';
import { attemptId, deckId, setId, transcriptId, feedbackState, descriptionState, withFeedback } from './helpers/feedback-fixtures.mjs';
registerHooks({ resolve });
const { parseFeedback, parseDescriptionState, feedbackSeekTarget } = await import('../src/features/feedback/validation.ts');
const { parseResult } = await import('../src/features/transcription/resultValidation.ts');
const { parseReview, preferResult } = await import('../src/features/transcription/reviewValidation.ts');
const { createTranscriptionClient } = await import('../src/features/transcription/client.ts');
const { saveAnalysis, readAnalysis } = await import('../src/features/transcription/analysisStorage.ts');
const { saveReview, readReview } = await import('../src/features/transcription/reviewStorage.ts');
const api = 'http://feedback.invalid/api';
const parse = v => parseFeedback(v, attemptId, withFeedback(), 2);
const clone = v => structuredClone(v);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function client(responses, extra = {}) {
  const calls = [];
  const value = createTranscriptionClient({ baseUrl: api, audioFile() { assert.fail('No audio access'); },
    fetch: async (url, init) => { calls.push({ url, init }); assert.ok(responses.length, 'No implicit request'); return responses.shift(); }, ...extra });
  return { value, calls };
}

test('valid original indexed evidence is allowlisted and enables exact bounded seeking', () => {
  const raw = feedbackState();
  raw.raw_body = 'must not survive'; raw.result.suggestions[0].execute = '<script>ignored</script>';
  raw.result.evidence_verified = false;
  const parsed = parse(raw);
  assert.equal(parsed.result.evidence_verified, true);
  assert.equal(parsed.raw_body, undefined); assert.equal(parsed.result.suggestions[0].execute, undefined);
  assert.deepEqual(feedbackSeekTarget(parsed, 0, withFeedback(), 2), { slide_index: 0, start_ms: 0, end_ms: 500 });
  assert.equal(feedbackSeekTarget(parsed, 1, withFeedback(), 2), null);
  assert.equal(feedbackSeekTarget(parsed, 0, withFeedback(), 1), null);
});

test('missing source context cannot enable seeking even if wire claims verification', () => {
  const raw = feedbackState(); raw.result.evidence_verified = true;
  const parsed = parseFeedback(raw, attemptId);
  assert.equal(parsed.result.evidence_verified, false);
  assert.equal(feedbackSeekTarget(parsed, 0, { ...withFeedback(), transcript_id: undefined }, 2), null);
  assert.equal(feedbackSeekTarget(parsed, 0, { ...withFeedback(), transcript: null }, 2), null);
});

test('source, fact, contiguous indexes, counts and exact derived times are enforced', () => {
  const mutations = [
    v => { v.result.suggestions[0].source_id = 'f'.repeat(64); },
    v => { v.result.suggestions[0].slide_index = 2; },
    v => { v.result.suggestions[0].transcript_id = 'e'.repeat(64); },
    v => { v.result.suggestions[0].word_end = 1; },
    v => { v.result.suggestions[0].speech_quote = 'Invented'; },
    v => { v.result.suggestions[0].slide_quote += 'invented'; },
    v => { v.result.suggestions[0].visit_id = 1; },
    v => { v.result.suggestions[0].segment_id = 'v0s1'; },
    v => { v.result.suggestions[0].end_ms = 501; },
    v => { v.result.suggestions[0].start_ms = 2001; },
    v => { v.result.suggestions[0].category = 'audience'; },
    v => { v.result.evidence.visits[0].word_indexes = [1]; },
    v => { v.result.evidence.visits[1].start_ms = 999; },
    v => { v.result.evidence.descriptions.slides[0].summary = { text: 'Synthetic slide 0', uncertain: true, uncertainty: 'uncertain' }; },
    v => { v.result.suggestions = [...v.result.suggestions, ...v.result.suggestions]; v.result.accepted_count = 2; },
    v => { v.result.accepted_count = 3; },
    v => { v.result.status = 'empty'; },
    v => { v.result.feedback_revision = 2; },
    v => { v.result.provenance.model = 'different'; },
  ];
  for (const mutate of mutations) {
    const raw = feedbackState(); mutate(raw); assert.throws(() => parse(raw), undefined, mutate.toString());
    const attempt = parseResult(withFeedback({ feedback_analysis: raw }), attemptId);
    assert.ok(attempt.transcript); assert.equal(attempt.feedback_analysis, undefined);
  }
});

test('NUL and oversized generated strings quarantined; markup stays inert plain text', () => {
  for (const key of ['observation', 'suggestion', 'speech_quote', 'slide_quote']) {
    const raw = feedbackState(); raw.result.suggestions[0][key] = 'bad\u0000text'; assert.throws(() => parse(raw));
  }
  const long = feedbackState(); long.result.suggestions[0].suggestion = 'x'.repeat(701); assert.throws(() => parse(long));
  const raw = feedbackState(); const untrusted = '<script>alert(1)</script> [x](javascript:evil) https://example.invalid';
  raw.result.suggestions[0].suggestion = untrusted;
  assert.equal(parse(raw).result.suggestions[0].suggestion, untrusted);
});

test('accepted partial empty all-invalid remain distinct, and empty is not invalid success', () => {
  for (const status of ['accepted', 'partial', 'empty', 'all_invalid']) {
    const raw = feedbackState(); raw.result.status = status; raw.result.message = status === 'empty' ? 'No supported suggestions.' : null;
    raw.result.accepted_count = ['empty', 'all_invalid'].includes(status) ? 0 : 1;
    raw.result.discarded_count = ['partial', 'all_invalid'].includes(status) ? 1 : 0;
    if (!raw.result.accepted_count) raw.result.suggestions = [];
    if (status === 'all_invalid') { raw.state = 'failed'; raw.retry_available = true; raw.error = { code: 'unsupported_feedback', message: 'Synthetic unsupported evidence' }; }
    raw.last_output = { status, accepted_count: raw.result.accepted_count, discarded_count: raw.result.discarded_count };
    assert.equal(parse(raw).result.status, status);
    if (status === 'all_invalid') { raw.state = 'completed'; assert.throws(() => parse(raw)); }
  }
});

test('backward and simultaneous visits, repeated phrases and crossing words retain original indexes', () => {
  const attempt = withFeedback();
  attempt.transcript = { text: 'Echo Echo Echo', words: [
    { text: 'Echo', start_ms: 100, end_ms: 1200 }, { text: 'Echo', start_ms: 1000, end_ms: 1300 }, { text: 'Echo', start_ms: 1600, end_ms: 1900 },
  ] };
  attempt.slide_events = [{ slide_index: 1, at_ms: 0 }, { slide_index: 0, at_ms: 1000 }, { slide_index: 1, at_ms: 1000 }, { slide_index: 0, at_ms: 1500 }];
  const raw = feedbackState(); raw.result.evidence.visits = [
    { slide_index: 1, start_ms: 0, end_ms: 1000, word_indexes: [0] },
    { slide_index: 0, start_ms: 1000, end_ms: 1000, word_indexes: [] },
    { slide_index: 1, start_ms: 1000, end_ms: 1500, word_indexes: [1] },
    { slide_index: 0, start_ms: 1500, end_ms: 2000, word_indexes: [2] },
  ];
  for (const index of [0, 1, 2]) {
    const v = clone(raw), visit = [0, 2, 3][index], slide = [1, 1, 0][index];
    Object.assign(v.result.suggestions[0], { slide_index: slide, source_id: v.result.evidence.sources[slide].source_id,
      visit_id: visit, segment_id: `v${visit}s0`, word_start: index, word_end: index, speech_quote: 'Echo',
      slide_quote: `Synthetic slide ${slide}`, start_ms: attempt.transcript.words[index].start_ms, end_ms: attempt.transcript.words[index].end_ms });
    const parsed = parseFeedback(v, attemptId, attempt, 2);
    assert.equal(parsed.result.evidence_verified, true);
    assert.equal(feedbackSeekTarget(parsed, 0, attempt, 2).start_ms, attempt.transcript.words[index].start_ms);
  }
});

test('feedback freshness reconciles independently of Whisper and quarantined feedback cannot erase cache', () => {
  const older = parseResult(withFeedback(), attemptId), newerRaw = withFeedback();
  newerRaw.feedback_analysis.feedback_revision = 2;
  newerRaw.feedback_analysis.result.feedback_revision = 2;
  const newer = parseResult(newerRaw, attemptId);
  assert.equal(preferResult(newer, older).feedback_analysis.feedback_revision, 2);
  assert.equal(preferResult(older, newer, 'history').feedback_analysis.feedback_revision, 2);
  const current = { ...older, processing_revision: 3 };
  const merged = preferResult(current, newer);
  assert.equal(merged.processing_revision, 3); assert.equal(merged.feedback_analysis.feedback_revision, 2);
  const stale = clone(newer); stale.feedback_analysis.state = 'stale'; stale.feedback_analysis.stale = true;
  stale.feedback_analysis.result.stale = true; stale.feedback_analysis.updated_at = '2026-10-08T00:00:02.001100Z';
  assert.equal(preferResult(newer, stale).feedback_analysis.stale, true);
  assert.equal(preferResult(stale, newer).feedback_analysis.stale, true);
  const saved = saveAnalysis(api, stale); saveAnalysis(api, older, 'history');
  assert.equal(readAnalysis(api + '/', attemptId).feedback_analysis.stale, true);
  saveAnalysis(api, parseResult(withFeedback({ feedback_analysis: { bad: 'invalid' } }), attemptId));
  assert.deepEqual(readAnalysis(api, attemptId).feedback_analysis, saved.feedback_analysis);
  assert.equal(readAnalysis('http://different.invalid/api', attemptId), null);
});

test('late current coaching receipts cannot restore obsolete confirmation in either cache', () => {
  const before = feedbackState({ state: 'stale', stale: true, requires_confirmation: true, retry_available: true,
    received_at: null, completed_at: null, result: null, last_output: null, updated_at: '2026-10-08T00:00:03.000100Z' });
  // The description edit and coaching revision stay the same; only the current
  // receipt advances public freshness, clearing uncertainty before normalization.
  const received = { ...clone(before), requires_confirmation: false,
    received_at: '2026-10-08T00:00:03.000200Z', updated_at: '2026-10-08T00:00:03.000200Z' };
  const finalized = { ...clone(received), updated_at: '2026-10-08T00:00:03.000300Z' };
  for (const [index, responses] of [[before, received, finalized], [finalized, received, before]].entries()) {
    // Separate addresses keep review fallback from masking an analysis-cache bug.
    const analysisApi = `http://coaching-receipt-analysis-${index}.invalid/api`;
    const reviewApi = `http://coaching-receipt-review-${index}.invalid/api`;
    for (const [responseIndex, feedback] of responses.entries()) {
      const raw = withFeedback({ feedback_analysis: feedback });
      const source = responseIndex === 0 ? 'detail' : 'history';
      saveAnalysis(analysisApi, parseResult(raw, attemptId), source);
      saveReview(reviewApi, parseReview(raw, attemptId, reviewApi), source);
    }
    for (const cached of [readAnalysis(analysisApi, attemptId), readReview(reviewApi, attemptId)]) {
      const feedback = cached.feedback_analysis;
      assert.equal(feedback.feedback_revision, 1);
      assert.equal(feedback.state, 'stale');
      assert.equal(feedback.requires_confirmation, false);
      assert.equal(feedback.retry_available, true);
      assert.equal(feedback.updated_at, finalized.updated_at);
      assert.equal(feedback.received_at, received.received_at);
      assert.equal(feedback.result, null);
      assert.ok(cached.transcript);
    }
  }
});

test('a later old coaching receipt cannot replace the retried generation in either cache', () => {
  const old = feedbackState({ state: 'stale', stale: true, requires_confirmation: false, retry_available: true,
    received_at: '2026-10-08T00:00:04Z', updated_at: '2026-10-08T00:00:04Z',
    completed_at: null, result: null, last_output: null });
  const current = feedbackState({ feedback_revision: 2, description_revision: 2, state: 'queued',
    updated_at: '2026-10-08T00:00:03Z', received_at: null, submitted_at: null,
    completed_at: null, result: null, last_output: null });
  for (const [index, responses] of [[old, current], [current, old]].entries()) {
    const analysisApi = `http://coaching-retry-analysis-${index}.invalid/api`;
    const reviewApi = `http://coaching-retry-review-${index}.invalid/api`;
    for (const feedback of responses) {
      const raw = withFeedback({ feedback_analysis: feedback });
      saveAnalysis(analysisApi, parseResult(raw, attemptId));
      saveReview(reviewApi, parseReview(raw, attemptId, reviewApi));
    }
    for (const cached of [readAnalysis(analysisApi, attemptId), readReview(reviewApi, attemptId)]) {
      assert.equal(cached.feedback_analysis.feedback_revision, 2);
      assert.equal(cached.feedback_analysis.state, 'queued');
      assert.equal(cached.feedback_analysis.updated_at, current.updated_at);
      assert.equal(cached.feedback_analysis.received_at, null);
    }
  }
});

test('legacy caches and partial/no-speech review remain usable with invalid feedback', () => {
  const legacy = withFeedback(); delete legacy.feedback_analysis; delete legacy.transcript_id;
  assert.ok(parseResult(legacy, attemptId));
  const raw = withFeedback({ processing_state: 'failed', status: 'failed', visits: null,
    partial_available: { transcript: true, alignment: false }, error: { code: 'alignment_failed', message: 'Synthetic' }, feedback_analysis: { malicious: true } });
  const partial = parseReview(raw, attemptId, api);
  assert.ok(partial.transcript); assert.ok(partial.processing_result); assert.equal(partial.feedback_analysis, undefined);
  const silent = withFeedback({ analysis_outcome: 'no_speech', transcript: { text: '', words: [] },
    visits: withFeedback().visits.map(v => ({ ...v, words: [] })), feedback_analysis: { bad: true } });
  assert.equal(parseResult(silent, attemptId).analysis_outcome, 'no_speech');
  const review = parseReview(withFeedback(), attemptId, api);
  saveReview('http://feedback-cache.invalid/api', review);
  assert.equal(readReview('http://feedback-cache.invalid/api', attemptId).feedback_analysis.result.evidence_verified, true);
});

test('description parser uses exact deck/source scope, revisions and bounded facts', () => {
  const parsed = parseDescriptionState(descriptionState(), deckId);
  assert.equal(parsed.description_revision, 1);
  for (const modify of [v => { v.deck_id = attemptId; }, v => { v.descriptions.slides[0].source_id = 'f'.repeat(64); },
    v => { v.descriptions.slides[0].summary.text = 'NUL\u0000fact'; }, v => { v.description_revision = true; },
    v => { v.descriptions.slides[0].summary.uncertain = true; }, v => { v.descriptions.slides[0].slide_index = 10; }]) {
    const v = descriptionState(); modify(v); assert.throws(() => parseDescriptionState(v, deckId));
  }
});

test('dependency retry carries exact separate description revisions; stale and uncertainty coexist', () => {
  const raw = feedbackState({ state: 'waiting_descriptions', stage: 'descriptions', description_revision: null, result: null, last_output: null,
    dependency: { deck_id: deckId, description_set_id: setId, state: 'needs_confirmation', processing_revision: 7, description_revision: 0,
      retry_action: 'generate_descriptions', retry_at: null, retry_available: true, requires_confirmation: true, error: { code: 'timeout', message: 'Synthetic' } } });
  const state = parseFeedback(raw, attemptId);
  assert.equal(state.feedback_revision, 1); assert.equal(state.dependency.processing_revision, 7);
  const stale = feedbackState({ state: 'stale', stale: true, requires_confirmation: true }); stale.result.stale = true;
  assert.equal(parse(stale).requires_confirmation, true);
});

function dependentFeedback(state, updated_at, revision = 1) {
  return feedbackState({ state: 'waiting_descriptions', stage: 'descriptions', description_revision: null, result: null, last_output: null,
    dependency: { deck_id: deckId, description_set_id: setId, state, updated_at, processing_revision: revision, description_revision: 0,
      retry_action: ['failed', 'needs_confirmation'].includes(state) ? 'generate_descriptions' : null,
      retry_at: null, retry_available: ['failed', 'needs_confirmation'].includes(state),
      requires_confirmation: state === 'needs_confirmation', error: null } });
}

test('out-of-order dependency responses cannot hide failure or uncertainty actions in either cache', () => {
  for (const state of ['failed', 'needs_confirmation']) {
    // The feedback job has not advanced; dependency freshness must survive parsing.
    const older = parseResult(withFeedback({ feedback_analysis: dependentFeedback('submitted', '2026-10-08T00:00:03.000100Z') }), attemptId);
    const newer = parseResult(withFeedback({ feedback_analysis: dependentFeedback(state, '2026-10-08T00:00:03.000200Z') }), attemptId);
    assert.equal(newer.feedback_analysis.dependency.updated_at, '2026-10-08T00:00:03.000200Z');
    for (const [before, after] of [[older, newer], [newer, older]]) {
      assert.equal(preferResult(before, after, 'history').feedback_analysis.dependency.state, state);
    }
    const cacheApi = `http://dependency-${state}.invalid/api`;
    saveAnalysis(cacheApi, newer);
    saveAnalysis(cacheApi, older, 'history');
    const saved = readAnalysis(cacheApi, attemptId).feedback_analysis.dependency;
    assert.equal(saved.state, state);
    assert.equal(saved.retry_action, 'generate_descriptions');
    assert.equal(saved.requires_confirmation, state === 'needs_confirmation');
    saveReview(cacheApi, parseReview(withFeedback({ feedback_analysis: newer.feedback_analysis }), attemptId, cacheApi));
    saveReview(cacheApi, parseReview(withFeedback({ feedback_analysis: older.feedback_analysis }), attemptId, cacheApi), 'history');
    assert.deepEqual(readReview(cacheApi, attemptId).feedback_analysis.dependency, saved);
  }
});

test('dependency retry and receipt recovery can advance to a lower state rank without reversing on delayed responses', () => {
  const older = dependentFeedback('needs_confirmation', '2026-10-08T00:00:03.000100Z');
  for (const revision of [1, 2]) {
    // Same generation: a late durable receipt. New generation: explicit ack/retry.
    const newer = dependentFeedback('queued', '2026-10-08T00:00:03.000200Z', revision);
    const before = parseResult(withFeedback({ feedback_analysis: older }), attemptId);
    const after = parseResult(withFeedback({ feedback_analysis: newer }), attemptId);
    assert.equal(preferResult(before, after).feedback_analysis.dependency.state, 'queued');
    assert.equal(preferResult(after, before).feedback_analysis.dependency.state, 'queued');
    assert.equal(preferResult(after, before).feedback_analysis.dependency.processing_revision, revision);
  }
});

test('legacy dependency caches use revision and terminal-state tie breaks; invalid new freshness is quarantined', () => {
  const older = dependentFeedback('submitted', undefined);
  const terminal = dependentFeedback('needs_confirmation', undefined);
  const retry = dependentFeedback('queued', undefined, 2);
  const parsed = [older, terminal, retry].map(v => parseResult(withFeedback({ feedback_analysis: v }), attemptId));
  assert.ok(parsed.every(v => v.feedback_analysis));
  assert.equal(preferResult(parsed[1], parsed[0]).feedback_analysis.dependency.state, 'needs_confirmation');
  assert.equal(preferResult(parsed[1], parsed[2]).feedback_analysis.dependency.processing_revision, 2);
  assert.equal(preferResult(parsed[2], parsed[1]).feedback_analysis.dependency.processing_revision, 2);
  const invalid = dependentFeedback('submitted', '<script>invalid</script>');
  const quarantined = parseResult(withFeedback({ feedback_analysis: invalid }), attemptId);
  assert.equal(quarantined.feedback_analysis, undefined);
  assert.ok(quarantined.transcript);
});

test('explicit clients send only selected actions; GET and 409 never retry or process', async () => {
  const { value, calls } = client([json(descriptionState()), json(descriptionState()), json(descriptionState()),
    json(feedbackState()), json(feedbackState()), json({ error: { code: 'stale_revision', message: 'Refresh revision' } }, 409)]);
  await value.getDescriptions(deckId, setId);
  await value.generateDescriptions(deckId, { description_set_id: setId, processing_revision: 4, acknowledge_uncertain: true });
  await value.editDescriptions(deckId, { description_set_id: setId, description_revision: 2, descriptions: descriptionState().descriptions });
  await value.getFeedback(attemptId, {}, withFeedback());
  await value.generateFeedback(attemptId, { feedback_revision: 1, acknowledge_uncertain: true }, {}, withFeedback());
  await assert.rejects(value.generateFeedback(attemptId, { feedback_revision: 1 }), e => e.code === 'stale_revision' && e.status === 409);
  assert.deepEqual(calls.map(c => c.init.method), ['GET', 'POST', 'PATCH', 'GET', 'POST', 'POST']);
  assert.equal(calls.filter(c => c.url.includes('/process/')).length, 0);
  assert.ok(calls[0].url.endsWith(`?description_set_id=${setId}`));
  assert.deepEqual(JSON.parse(calls[1].init.body), { description_set_id: setId, processing_revision: 4, acknowledge_uncertain: true });
});

test('runtime input guards reject provider/model/extras and bad revisions with zero fetches', async () => {
  const { value, calls } = client([]);
  for (const payload of [{ provider: 'openai' }, { model: 'other' }, { feedback_revision: true }, { feedback_revision: 2**31 },
    { feedback_revision: -1 }, { acknowledge_uncertain: true }, { feedback_revision: 1, acknowledge_uncertain: 1 }]) {
    await assert.rejects(value.generateFeedback(attemptId, payload), e => e.code === 'invalid_request');
  }
  for (const payload of [{ provider: 'openai' }, { processing_revision: 1 }, { description_set_id: 'WRONG' },
    { description_set_id: setId, processing_revision: NaN }]) {
    await assert.rejects(value.generateDescriptions(deckId, payload), e => e.code === 'invalid_request');
  }
  await assert.rejects(value.getFeedback('AAAA2222-2222-4222-8222-222222222222'), e => e.code === 'invalid_request');
  assert.equal(calls.length, 0);
});

test('feedback GET cancellation and generation timeout cannot cause automatic paid retries', async () => {
  const controller = new AbortController(); controller.abort();
  const { value, calls } = client([]);
  await assert.rejects(value.getFeedback(attemptId, { signal: controller.signal }), e => e.code === 'cancelled');
  assert.equal(calls.length, 0);
  let count = 0;
  const timeout = client([], { timeoutMs: 5, fetch: (_url, init) => { count++; return new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(Error('aborted')));
  }); } });
  await assert.rejects(timeout.value.generateFeedback(attemptId), e => e.code === 'timeout');
  assert.equal(count, 1);
});

test('partial legacy review cache reconciles feedback without requiring process permission', () => {
  const original = withFeedback(); delete original.status; delete original.processing_state;
  const legacyApi = 'http://partial-feedback.invalid/api';
  const initial = parseReview(original, attemptId, legacyApi);
  assert.equal(initial.processing_result, null);
  saveReview(legacyApi, initial);
  const newer = clone(original); newer.feedback_analysis.feedback_revision = 2; newer.feedback_analysis.result.feedback_revision = 2;
  saveReview(legacyApi, parseReview(newer, attemptId, legacyApi), 'history');
  saveReview(legacyApi, initial);
  assert.equal(readReview(legacyApi, attemptId).feedback_analysis.feedback_revision, 2);
  assert.equal(readReview(legacyApi, attemptId).processing_result, null);
});

test('an explicit description lookup rejects another set even on the same deck', async () => {
  const { value } = client([json(descriptionState({ description_set_id: attemptId }))]);
  await assert.rejects(value.getDescriptions(deckId, setId), e => e.code === 'invalid_response');
});

test('incomplete chronology leaves feedback readable but cannot enable evidence seeking', () => {
  const recording = withFeedback(); delete recording.slide_events;
  const state = parseFeedback(feedbackState(), attemptId, recording);
  assert.equal(state.result.suggestions.length, 1);
  assert.equal(state.result.evidence_verified, false);
  assert.equal(feedbackSeekTarget(state, 0, recording, 2), null);
});

test('contradictory revision, stale, outcome and confirmation metadata is quarantined', () => {
  for (const mutate of [v => { v.description_revision = 2; }, v => { v.state = 'stale'; v.stale = true; },
    v => { v.last_output = { status: 'all_invalid', accepted_count: 0, discarded_count: 1 }; },
    v => { v.requires_confirmation = true; }, v => { v.stage = 'descriptions'; },
    v => { v.result.message = 'Fake extra result'; }]) {
    const v = feedbackState(); mutate(v); assert.throws(() => parse(v));
    assert.ok(parseResult(withFeedback({ feedback_analysis: v }), attemptId).transcript);
  }
});

test('a failed new generation keeps old description facts and stale suggestions with separate output counts', () => {
  const raw = feedbackState({ feedback_revision: 2, description_revision: 2, state: 'failed', retry_available: true,
    error: { code: 'unsupported_feedback', message: 'Synthetic unsupported evidence' },
    last_output: { status: 'all_invalid', accepted_count: 0, discarded_count: 1 } });
  raw.result.stale = true;
  const state = parse(raw);
  assert.equal(state.result.feedback_revision, 1);
  assert.equal(state.result.description_revision, 1);
  assert.equal(state.description_revision, 2);
  assert.equal(state.result.suggestions.length, 1);
  assert.equal(state.last_output.status, 'all_invalid');
  assert.equal(state.result.evidence_verified, true);
});

test('stale analysis or retained stale result remains readable but cannot seek', () => {
  const raw = feedbackState({ state: 'stale', stale: true }); raw.result.stale = true;
  assert.equal(parse(raw).result.suggestions.length, 1);
  assert.equal(feedbackSeekTarget(raw, 0, withFeedback(), 2), null);
  raw.state = 'failed'; raw.stale = false;
  assert.equal(feedbackSeekTarget(raw, 0, withFeedback(), 2), null);
});

test('selection assertions permit initial requests but never provider selection or malformed tokens', async () => {
  const token = 'f'.repeat(64);
  const { value, calls } = client([json(feedbackState(), 202), json(descriptionState(), 202)]);
  await value.generateFeedback(attemptId, { expected_selection: token });
  await value.generateDescriptions(deckId, { expected_selection: token });
  assert.deepEqual(calls.map(c => JSON.parse(c.init.body)), [{ expected_selection: token }, { expected_selection: token }]);
  for (const invalid of [null, true, 'F'.repeat(64), 'f'.repeat(63)]) {
    await assert.rejects(value.generateFeedback(attemptId, { expected_selection: invalid }));
    await assert.rejects(value.generateDescriptions(deckId, { expected_selection: invalid }));
  }
  assert.equal(calls.length, 2);
});

test('complete description edits enforce UTF-8 64 KiB bound before fetch', async () => {
  const large = descriptionState().descriptions;
  large.slides = Array.from({ length: 10 }, (_, i) => ({ ...structuredClone(large.slides[0]), slide_index: i,
    summary: { text: '語'.repeat(400), uncertain: true, uncertainty: '語'.repeat(400) },
    key_ideas: Array.from({ length: 5 }, () => ({ text: '語'.repeat(400), uncertain: true, uncertainty: '語'.repeat(400) })),
    visual_facts: Array.from({ length: 5 }, () => ({ text: '語'.repeat(400), uncertain: true, uncertainty: '語'.repeat(400) })) }));
  const { value, calls } = client([json(descriptionState())]);
  await assert.rejects(value.editDescriptions(deckId, { description_set_id: setId, description_revision: 1, descriptions: large }));
  assert.equal(calls.length, 0);
});

test('selection and captured origin metadata are bounded, allowlisted, and legacy caches remain readable', async () => {
  const { selection, descriptionSelection } = await import('./helpers/feedback-fixtures.mjs');
  const f = feedbackState({ selection: { ...selection, api_key: 'never publish' } });
  f.result.description_origin = 'generated';
  assert.equal(parse(f).selection.api_key, undefined); assert.equal(parse(f).result.description_origin, 'generated');
  assert.equal(parse(feedbackState()).result.description_origin, 'unavailable');
  assert.equal(parseDescriptionState(descriptionState({ selection: descriptionSelection }), deckId).selection.token, descriptionSelection.token);
  for (const field of ['token', 'prompt_digest', 'coaching_prompt_digest']) {
    const invalid = structuredClone(f); invalid.selection[field] = 'bad'; assert.throws(() => parse(invalid));
  }
  const invalid = structuredClone(f); invalid.result.description_origin = 'guessed'; assert.throws(() => parse(invalid));
});

test('description cache reconciliation preserves its own revision and terminal uncertainty', async () => {
  const { preferDescriptions } = await import('../src/features/feedback/storage.ts');
  const before = descriptionState({ state: 'submitted', descriptions: null, available_data: false, description_revision: 0 });
  const uncertain = { ...before, state: 'needs_confirmation', requires_confirmation: true, retry_available: true };
  assert.equal(preferDescriptions(uncertain, before).state, 'needs_confirmation');
  assert.equal(preferDescriptions(uncertain, { ...before, processing_revision: 2, state: 'queued' }).state, 'queued');
  const edited = descriptionState({ description_revision: 2, processing_revision: 2, edited: true });
  assert.equal(preferDescriptions(edited, descriptionState()).description_revision, 2);
});

test('quota_stopped parses for coaching and its failed description dependency without dropping saved evidence', () => {
  const error = { code: 'quota_stopped', message: 'Untrusted server detail' };
  const retry_at = '2026-10-08T02:00:00Z';
  const stopped = parse(feedbackState({ state: 'failed', error, retry_at }));
  assert.equal(stopped.error.code, 'quota_stopped');
  assert.equal(stopped.result.suggestions.length, 1);
  const description = descriptionState({ state: 'failed', error, retry_at, descriptions: null, available_data: false, description_revision: 0 });
  assert.equal(parseDescriptionState(description, deckId).error.code, 'quota_stopped');
  const dependency = { ...description, retry_action: 'generate_descriptions' };
  const pending = parse(feedbackState({ state: 'waiting_descriptions', stage: 'descriptions', description_revision: null,
    result: null, last_output: null, dependency, error: { code: 'description_dependency_failed', message: 'Dependency failed' } }));
  assert.equal(pending.dependency.error.code, 'quota_stopped');
  assert.equal(pending.dependency.retry_at, retry_at);
  const waiting = parse(feedbackState({ state: 'waiting_quota', error: { code: 'waiting_quota', message: 'Wait' }, retry_at }));
  assert.equal(waiting.state, 'waiting_quota');
});
