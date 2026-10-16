import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve } from './helpers/storage-native-loader.mjs';
registerHooks({ resolve });
const slides = await import('../src/domain/slides.ts');
const { emptyRequirements } = await import('../src/domain/presentationRequirements.ts');
const timingModule = await import('../src/features/presentations/timing.ts');
const { timedPresentation } = timingModule;
const { saveRequirements, getRequirementsVersion, subscribeRequirements } = await import('../src/features/presentations/requirementsStore.ts');
const { readStored, writeStored } = await import('../src/services/storage.ts');
const { mergeTake } = await import('../src/domain/run.ts');

test('required allocation uses exact integer seconds with stable slide-order tie breaks', () => {
  assert.equal(typeof slides.requiredSlideTargets, 'function');
  for (const total of [60, 61, 301, 1800]) {
    for (const texts of [[''], ['', '', ''], ['', 'important chart values compared against previous measurement', ''], Array(2000).fill('')]) {
      const targets = slides.requiredSlideTargets(texts, total);
      assert.equal(targets.length, texts.length);
      assert.ok(targets.every(t => Number.isInteger(t) && t >= 0));
      assert.equal(targets.reduce((a, b) => a + b, 0), total);
      assert.deepEqual(targets, slides.requiredSlideTargets(texts, total));
    }
  }
  assert.deepEqual(slides.requiredSlideTargets(['', '', ''], 61), [21, 20, 20]);
  assert.deepEqual(slides.requiredSlideTargets([], 60), []);
  assert.equal(slides.requiredSlideTargets(['text'], null), null);
  for (const invalid of [0, 59, 1801, 60.5, NaN, Infinity, true, '60']) {
    assert.throws(() => slides.requiredSlideTargets(['text'], invalid));
  }
});

test('explicit requirements override suggested timing without mutating legacy defaults or requiring an audience', () => {
  assert.equal(typeof slides.presentationTiming, 'function');
  const deck = { target: 600, targets: [300, 300], pageCount: 2, slides: [{ text: '' }, { text: '' }] };
  const original = structuredClone(deck);
  const missing = emptyRequirements();
  assert.deepEqual(slides.presentationTiming(deck, missing), { source: 'legacy_default', total: 600, targets: [300, 300], requirementsRevision: null });
  const req = { ...missing, requiredDurationSeconds: 901, revision: 3 };
  assert.deepEqual(slides.presentationTiming(deck, req), { source: 'required', total: 901, targets: [451, 450], requirementsRevision: 3 });
  assert.deepEqual(slides.presentationTiming(deck, { ...req, requiredDurationSeconds: null, revision: 4 }), slides.presentationTiming(deck, missing));
  assert.deepEqual(deck, original);
});

test('saved timing is isolated by API and server deck and never overwrites selected-run or legacy records', () => {
  const api = 'http://timing.test/api';
  const deck = { id: 'timing-deck', target: 120, targets: [60, 60], pageCount: 2, slides: [{ text: '' }, { text: '' }] };
  const contextId = '11111111-1111-4111-8111-111111111111', deckId = '22222222-2222-4222-8222-222222222222';
  writeStored('pres:v1:timing-deck', deck);
  writeStored('deck:v1:timing-deck', { run: { id: 'selected-run' }, compare: { id: 'pending-compare' } });
  const before = [readStored('pres:v1:timing-deck'), readStored('deck:v1:timing-deck')];
  let notifications = 0;
  const version = getRequirementsVersion();
  const unsubscribe = subscribeRequirements(() => notifications++);
  saveRequirements(deck.id, api, { contextId, deckId, requiredDurationSeconds: 1800, audience: '', revision: 1 });
  assert.equal(notifications, 1);
  assert.ok(getRequirementsVersion() > version);
  assert.equal(timedPresentation(deck, api).timing.source, 'legacy_default');
  writeStored(`server-deck:${api}:${deck.id}`, deckId);
  assert.equal(timedPresentation(deck, api + '/').target, 1800);
  assert.deepEqual(timedPresentation(deck, api).targets, [900, 900]);
  assert.equal(timedPresentation(deck, 'http://other.test/api').target, 120);
  writeStored(`server-deck:${api}:${deck.id}`, contextId);
  assert.equal(timedPresentation(deck, api).target, 120);
  writeStored(`server-deck:${api}:${deck.id}`, deckId);
  saveRequirements(deck.id, api, { contextId, deckId, requiredDurationSeconds: 60, audience: '', revision: 2 });
  assert.deepEqual(timedPresentation(deck, api).targets, [30, 30]);
  saveRequirements(deck.id, api, { contextId, deckId, requiredDurationSeconds: 1800, audience: '', revision: 1 });
  assert.equal(timedPresentation(deck, api).target, 60);
  saveRequirements(deck.id, api, { contextId, deckId, requiredDurationSeconds: null, audience: '', revision: 3 });
  assert.equal(timedPresentation(deck, api).target, 120);
  unsubscribe();
  assert.deepEqual([readStored('pres:v1:timing-deck'), readStored('deck:v1:timing-deck')], before);
});

test('current required time changes Review totals while preserving historical run and Compare snapshots', () => {
  assert.equal(typeof timingModule.selectedRunTarget, 'function');
  const partial = { full: false, targetSum: 30, parts: [{ attemptId: 'a', segments: [{ startMs: 0, endMs: 1000 }] }, null,
    { attemptId: 'b', segments: [{ startMs: 600001, endMs: 601001 }] }] };
  const before = structuredClone(partial);
  const timing = { source: 'required', total: 900, targets: [200, 300, 400], requirementsRevision: 2 };
  assert.equal(timingModule.selectedRunTarget(partial, timing), 600);
  assert.equal(timingModule.selectedRunTarget({ ...partial, full: true }, timing), 900);
  assert.equal(timingModule.selectedRunTarget(partial, { ...timing, source: 'legacy_default', total: 120, targets: [30, 60, 30] }), 60);
  assert.equal(timingModule.selectedRunTarget(null, timing), 0);
  assert.deepEqual(partial, before);
});

test('clearing a requirement restores consistent full and partial Review totals for runs recorded under it', () => {
  const deck = { target: 120, targets: [60, 60], pageCount: 2, slides: [{ text: '' }, { text: '' }] };
  const required = slides.presentationTiming(deck, { ...emptyRequirements(), requiredDurationSeconds: 900, revision: 1 });
  const cleared = slides.presentationTiming(deck, { ...emptyRequirements(), revision: 2 });
  for (const full of [false, true]) {
    const visits = full ? [{ slide: 0, startMs: 0, endMs: 1000 }, { slide: 1, startMs: 1000, endMs: 2000 }]
      : [{ slide: 0, startMs: 0, endMs: 1000 }];
    const { run } = mergeTake(null, { attemptId: 'recorded-under-required-time', visits, spoken: [true, full],
      whole: false, createdAt: '2026-10-15T00:00:00Z' },
      { n: 2, targets: required.targets, deckTarget: required.total, lastFullTotal: null, takeNo: 1, id: 'selected' });
    const saved = structuredClone(run);
    assert.equal(run.targetSum, full ? 900 : 450);
    assert.equal(timingModule.selectedRunTarget(run, cleared), full ? 120 : 60);
    assert.deepEqual(run, saved);
  }
});
