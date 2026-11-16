// Synthetic provider identities; no credentials, media or provider calls.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/openrouter-mobile-loader.mjs';
import { attemptId, deckId, descriptionState, feedbackState, selection, descriptionSelection, withFeedback } from './helpers/feedback-fixtures.mjs';
registerHooks({ resolve, load });
const { parseDescriptionState, parseFeedback } = await import('../src/features/feedback/validation.ts');
const { parseProfileState } = await import('../src/features/presentations/slideProfiles.ts');
const { hasFeedbackConsent, saveFeedbackConsent } = await import('../src/features/feedback/storage.ts');
const identity = { provider: 'openrouter', project_id: 'synthetic-router', model: 'openai/gpt-6-luna' };

test('OpenRouter selection and saved feedback parse without losing evidence or accepting malformed model paths', () => {
  const raw = feedbackState({ selection: { ...selection, ...identity } });
  Object.assign(raw.provenance, identity);
  Object.assign(raw.result.provenance, identity);
  const parsed = parseFeedback(raw, attemptId, withFeedback(), 2);
  assert.equal(parsed.selection.model, 'openai/gpt-6-luna');
  assert.equal(parsed.result.provenance.provider, 'openrouter');
  assert.equal(parsed.result.evidence_verified, true);
  for (const model of ['gpt-6-luna', '/openai/gpt-6-luna', 'openai//gpt-6-luna', 'openai/../gpt-6-luna', 'https://openrouter.ai/openai/gpt-6-luna']) {
    const invalid = structuredClone(raw); invalid.selection.model = model;
    assert.throws(() => parseFeedback(invalid, attemptId, withFeedback(), 2), undefined, model);
  }
  for (const provider of ['openai', 'gemini']) {
    const historical = feedbackState();
    const historicalIdentity = { provider, model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.1-flash-lite' };
    Object.assign(historical.provenance, historicalIdentity);
    Object.assign(historical.result.provenance, historicalIdentity);
    assert.equal(parseFeedback(historical, attemptId, withFeedback(), 2).result.provenance.provider, provider);
  }
});

test('OpenRouter profiles use the unchanged OpenAI profile schema and keep certain evidence checks', () => {
  const raw = descriptionState({ selection: { ...descriptionSelection, ...identity, prompt_version: 'slide-profile-v5', schema_version: 'slide-profile-v5' } });
  Object.assign(raw.provenance, identity, { prompt_version: 'slide-profile-v5', schema_version: 'slide-profile-v5' });
  for (const s of raw.descriptions.slides) Object.assign(s, { slide_kind: 'content', must_cover: [{ text: 'Clarify the comparison.', evidence_refs: ['summary'] }], go_deeper: [] });
  assert.equal(parseDescriptionState(raw, deckId).selection.provider, 'openrouter');
  const parsed = parseProfileState(raw, deckId, 2);
  assert.equal(parsed.descriptions.slides[0].must_cover[0].text, 'Clarify the comparison.');
  raw.descriptions.slides[0].summary.uncertain = true;
  raw.descriptions.slides[0].summary.uncertainty = 'Unreadable';
  assert.throws(() => parseProfileState(raw, deckId, 2));
});

test('historical OpenAI consent does not authorize OpenRouter submissions', () => {
  const api = 'http://router-consent.invalid/api';
  const router = { ...selection, ...identity };
  saveFeedbackConsent(api, { ...selection, provider: 'openai', model: 'gpt-6-luna' });
  assert.equal(hasFeedbackConsent(api, router), false);
  saveFeedbackConsent(api, router);
  assert.equal(hasFeedbackConsent(api, router), true);
  assert.equal(hasFeedbackConsent('http://other.invalid/api', router), false);
});

test('coaching disclosure identifies OpenRouter and the upstream Luna model', async () => {
  const React = await import('react');
  const { act, create } = await import('react-test-renderer');
  const { CoachHost, useCoaches, inspectCoaching, retainCoaching } = await import('../src/features/rehearsal/coaching.tsx');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.openrouterReview = withFeedback();
  globalThis.openrouterFeedback = { feedback: null, busy: false, notice: '', prompt: { kind: 'disclosure', intent: { selection: { ...selection, ...identity } } } };
  let displayed;
  function Observer() { displayed = useCoaches().get(attemptId)?.prompt; return null; }
  const release = retainCoaching(attemptId);
  inspectCoaching(attemptId);
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(React.Fragment, null, React.createElement(CoachHost), React.createElement(Observer))); });
    assert.deepEqual(displayed, { kind: 'disclosure', provider: 'OpenRouter', model: 'openai/gpt-6-luna' });
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    release();
    delete globalThis.openrouterFeedback;
    delete globalThis.openrouterReview;
  }
});
