import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as fs from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { resolve, load } from './helpers/library-screen-loader.mjs';
import { documentDirectory, root } from './helpers/pdf-node-storage.mjs';
import { select } from './helpers/pdf-picker-stub.mjs';
import { demoNative } from './helpers/bundled-demo-native.mjs';
import { network, response } from './helpers/upload-native.mjs';
import { pressBack } from './helpers/library-screen-native.mjs';
import { runtime } from './helpers/ai-overview-screen-native.mjs';
registerHooks({ resolve, load });

const { HomeScreen } = await import('../src/screens/HomeScreen.tsx');
const { UploadScreen } = await import('../src/screens/UploadScreen.tsx');
const { HomeContext, ShellContext, TUTORIAL_SEEN } = await import('../src/screens/shared.ts');
const { bump, deckById, savePresentation, saveDeckState, getDeckState, forgetPresentation, visibleDecks } =
  await import('../src/features/presentations/store.ts');
const { useDeckModel } = await import('../src/features/presentations/useDeckModel.ts');
const { notifyRequirementsChanged } = await import('../src/features/presentations/requirementsStore.ts');
const { getImportedPdfs } = await import('../src/features/pdf/service.ts');
const { analyzePdf, ensureSlideText, ensurePages, pickPdf, SLIDE_TEXT_WAIT_MS } = await import('../src/features/presentations/importer.ts');
const { serverSlides, serverPdfUnconfirmed } = await import('../src/features/presentations/serverDeck.ts');
const { defaultRequirementsPending } = await import('../src/features/presentations/defaultRequirements.ts');
const { API_URL } = await import('../src/services/api.ts');
const { DARK_PALETTE } = await import('../src/design/tokens.ts');
const { readStored, writeStored, removeStored } = await import('../src/services/storage.ts');
// Claude prototype guide integrated by OpenAI Codex, Iteration 4 (2026-11-21): skip first-run overlay in older Home tests.
const { TUTORIAL_PAGES } = await import('../src/screens/HomeTutorial.tsx');
writeStored(TUTORIAL_SEEN, true);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const h = React.createElement;
const box = value => ({ value, set(next) { this.value = next; }, get() { return this.value; } });
let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  for (const deck of visibleDecks()) forgetPresentation(deck.id);
  network.requests.length = 0;
  network.respond = null;
  demoNative.failRender = false;
  demoNative.pageCount = 7;
  delete runtime.reducedMotion;
  select({ canceled: true, assets: null });
});
after(() => fs.rm(root, { recursive: true, force: true }));

async function mount(Screen, props) {
  const home = Object.fromEntries(['p', 'vy', 'gap', 'hold', 'uploadBlur', 'uploadReturn', 'analyzing', 'setup', 'press', 'picker', 'titleReturn']
    .map(key => [key, box(key === 'press' || key === 'titleReturn' ? 1 : 0)]));
  const routes = [];
  const ctx = { home, go: (...args) => routes.push(args), nav: { nav: null } };
  const Context = Screen === HomeScreen ? HomeContext : ShellContext;
  await act(async () => { renderer = create(h(Context.Provider, { value: ctx }, h(Screen, props))); });
  const rerender = next => act(async () => renderer.update(h(Context.Provider, { value: ctx }, h(Screen, next))));
  return { home, routes, rerender };
}
const byLabel = label => renderer.root.find(node => typeof node.type === 'string' && node.props.accessibilityLabel === label);
const click = label => act(async () => byLabel(label).props.onPress());
const action = name => act(async () => renderer.root.findByProps({ accessibilityRole: 'adjustable' })
  .props.onAccessibilityAction({ nativeEvent: { actionName: name } }));
const textShown = text => renderer.root.findAllByType('text').some(node => node.children.join('') === text);
function deck(id, order) {
  return { id, title: id, order, hue: 'violet', icon: 'present', pageCount: 1, pages: [],
    slides: [{ text: '', points: [] }], text: 'pending', target: 60, targets: [60], createdAt: '2026-11-01' };
}

test('home carousel opens rehearsal or saved review and restores a deck after Undo', async () => {
  savePresentation(deck('First talk', 1));
  savePresentation(deck('Second talk', 2));
  saveDeckState('First talk', { ...getDeckState('First talk'), run: { id: 'saved-run' } });
  const { routes, home } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.equal(renderer.root.findAllByType('home-stats').length, 2, 'adjacent stats stay mounted for the crossfade');
  await act(async () => renderer.root.findAllByType('home-stats').find(node => node.props.active).props.onOpenReview());
  assert.deepEqual(routes.pop(), ['full', { nav: 'fade', deckId: 'First talk', from: 'home' }]);
  await action('increment');
  assert.equal(home.p.value, 1);
  await action('activate');
  assert.deepEqual(routes.pop(), ['rehearse', { nav: 'fade', deckId: 'Second talk', slide: 0, from: 'home' }]);
  await action('delete');
  assert.deepEqual(visibleDecks().map(d => d.id), ['First talk']);
  const undo = renderer.root.findAllByType('pressable').find(node =>
    node.findAllByType('text').some(child => child.children.join('') === 'Undo'));
  await act(async () => undo.props.onPress());
  assert.deepEqual(visibleDecks().map(d => d.id), ['First talk', 'Second talk']);
  assert.equal(home.p.value, 1);
  await action('add');
  assert.deepEqual(routes.pop(), ['upload', { nav: 'fade' }]);
});

test('portrait rehearsal keeps Home controls ready beneath the page without enabling them', async () => {
  savePresentation(deck('Current talk', 1));
  await mount(HomeScreen, { mode: 'rehearse', uploadLook: null });
  const underlay = renderer.root.find(node => node.type === 'view' && node.props.pointerEvents === 'none'
    && node.props.accessibilityElementsHidden === true && node.props.importantForAccessibility === 'no-hide-descendants');
  assert.equal(underlay.findAllByProps({ accessibilityRole: 'switch' }).length, 2);
  assert.equal(textShown('Spin'), true);
  assert.ok(underlay.findByType('gesture').props.gesture.every(gesture => gesture.enabled === false));
  assert.equal(underlay.findByType('home-stats').props.active, false);
});

test('Home footer and score stay hidden through the first half of the rehearsal return', async () => {
  savePresentation(deck('Footer handoff talk', 1));
  const props = { mode: 'rehearse', uploadLook: null };
  const { home, rerender } = await mount(HomeScreen, props);
  const footerOpacity = () => renderer.root.findAllByType('animated').find(view =>
    view.findAllByType('text').some(node => node.children.join('') === 'Spin')).props.style.at(-1).opacity;
  const scoreOpacity = () => renderer.root.findByType('home-stats').parent.props.style.at(-1).opacity;

  for (const [progress, opacity] of [[0, 0], [0.25, 0], [0.5, 0], [0.75, 0.5], [1, 1], [0.25, 0]]) {
    home.titleReturn.set(progress);
    // The native adapter samples animated styles on React render.
    await rerender({ ...props, onFrontDeckChange: () => {} });
    assert.equal(footerOpacity(), opacity);
    assert.equal(scoreOpacity(), opacity);
  }
  await rerender({ ...props, mode: 'home' });
  assert.equal(footerOpacity(), 1);
  assert.equal(scoreOpacity(), 1);
});

test('Add and Home share the backdrop, icon and control handoff on return', async () => {
  savePresentation(deck('Upload backdrop talk', 1));
  const home = Object.fromEntries(['p', 'vy', 'gap', 'hold', 'uploadBlur', 'uploadReturn', 'analyzing', 'setup', 'press', 'picker', 'titleReturn']
    .map(key => [key, box(['gap', 'press', 'titleReturn'].includes(key) ? 1 : 0)]));
  const routes = [];
  const ctx = { home, go: (...args) => routes.push(args), nav: { nav: null } };
  // The native adapter samples shared styles during React renders.
  const view = (mode, readingPdf = false) => h(HomeContext.Provider, { value: { ...ctx, home: { ...home } } },
    h(HomeScreen, { mode, uploadLook: null, readingPdf, onFrontDeckChange: () => {} }),
    mode === 'upload' && h(ShellContext.Provider, { value: ctx }, h(UploadScreen)));
  await act(async () => { renderer = create(view('upload')); });
  const part = testID => renderer.root.findByProps({ testID }).props;
  const opacity = testID => flat(part(testID).style).opacity;
  const carousel = () => renderer.root.findByProps({ accessibilityRole: 'adjustable' });
  const pan = () => renderer.root.findByType('pan').props;
  const move = distance => act(async () => {
    pan().onMove({}, { dx: 0, dy: distance });
    renderer.update(view('upload'));
  });
  const check = (outgoing, incoming, appearance) => {
    assert.ok(Math.abs(opacity('upload-hints') - outgoing) < 1e-6);
    assert.ok(Math.abs(opacity('add-copy') - outgoing) < 1e-6);
    assert.ok(Math.abs(opacity('home-hints') - incoming) < 1e-6);
    assert.ok(Math.abs(opacity('home-card-caption') - incoming) < 1e-6);
    assert.ok(Math.abs(opacity('home-appearance') - appearance) < 1e-6);
    assert.equal(part('home-appearance').pointerEvents, 'none');
    assert.equal(part('home-hints').importantForAccessibility, 'no-hide-descendants');
    assert.equal(renderer.root.findAllByType('home-stats').length, 0);
    assert.equal(renderer.root.findAllByType('text').filter(node => node.children.join('') === 'OutLoud').length, 1);
  };
  const iconStyle = () => flat(renderer.root.find(node => typeof node.type === 'string' && flat(node.props.style).zIndex === 300).props.style);
  await act(async () => renderer.update(view('upload')));
  check(1, 0, 0);
  assert.notEqual(flat(carousel().props.style).display, 'none', 'the Add picker keeps the neighboring cards for the handoff');
  home.gap.set(0);
  await act(async () => renderer.update(view('upload')));
  check(1, 0, 0);
  assert.equal(opacity('upload-content'), 1, 'a carousel-gap update cannot hide the upload surface');
  await move(63);
  check(0.3, 0, 2 / 15);
  assert.ok(Math.abs(iconStyle().transform[1].scale - 0.86) < 1e-6);
  assert.ok(Math.abs(iconStyle().opacity - 0.65 ** 2) < 1e-6);
  await act(async () => { pan().onRelease(); renderer.update(view('upload')); });
  check(1, 0, 0);
  assert.equal(iconStyle().transform[1].scale, 1);
  assert.deepEqual(routes, []);
  await move(135);
  check(0, 0.5, 2 / 3);
  runtime.timingCallbacks = [];
  try {
    await act(async () => { pan().onRelease(); renderer.update(view('upload')); });
    check(0, 1, 1);
    assert.equal(iconStyle().opacity, 0, 'the real deck has closed over the Add slot');
    assert.deepEqual(routes, [], 'Home is still inert when the fade reaches its last frame');
    await act(async () => runtime.timingCallbacks.shift()(true));
    assert.deepEqual(routes, [['home', { nav: null }]]);
  } finally {
    delete runtime.timingCallbacks;
  }
  await act(async () => renderer.update(view('home')));
  assert.equal(renderer.root.findByType('home-stats').props.active, true);
  assert.equal(part('home-appearance').pointerEvents, 'box-none');
  assert.equal(opacity('home-appearance'), 1);
  assert.equal(opacity('home-hints'), 1);
  assert.equal(textShown('Upload backdrop talk'), true);
  assert.equal(textShown('Spin'), true);
  await act(async () => renderer.update(view('upload', true)));
  assert.equal(flat(carousel().props.style).display, 'none', 'PDF progress hides even the icons and shadows');
  assert.equal(renderer.root.findAllByProps({ testID: 'home-card-caption' }).length, 0);
  assert.equal(renderer.root.findAllByProps({ testID: 'home-appearance' }).length, 0);
  assert.equal(renderer.root.findAllByProps({ testID: 'home-hints' }).length, 0);
  await act(async () => renderer.update(view('home')));
  assert.notEqual(flat(carousel().props.style).display, 'none', 'the carousel returns with Home');
});

test('portrait rehearsal reveals the carousel at the same icon height when returning Home', async () => {
  const talk = deck('Home return talk', 1);
  savePresentation(talk);
  const { home, rerender } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  const slot = () => renderer.root.find(node => node.props.deck?.id === talk.id && node.props.floatPhase);
  const iconOpacity = () => slot().findByProps({ renderToHardwareTextureAndroid: true }).props.style.at(-1).opacity;
  const homeTitleOpacity = () => slot().findAllByType('animated').filter(layer =>
    layer.findAllByType('text').some(node => node.children.join('') === talk.title)).at(-1).props.style.opacity;
  const phase = slot().props.floatPhase;
  const pausedAt = Math.PI / 2;
  phase.set(pausedAt);

  await act(async () => { home.titleReturn.set(0); savePresentation({ ...talk }); });
  assert.equal(homeTitleOpacity(), 1, 'the active Home title stays visible before rehearsal takes over');

  home.titleReturn.set(0.65);
  await rerender({ mode: 'rehearse', uploadLook: null });
  assert.equal(slot().props.floatEnabled, true);
  assert.equal(phase.get(), pausedAt);
  assert.equal(iconOpacity(), 0, 'the PDF is still moving toward the selected icon');
  assert.equal(homeTitleOpacity(), 0, 'rehearsal carries the title during the swipe');
  await act(async () => { home.titleReturn.set(1); savePresentation({ ...talk }); });
  assert.ok(Math.abs(iconOpacity() - 1) < 0.000001);
  assert.equal(homeTitleOpacity(), 1, 'Home owns the title before the gesture commits');

  await rerender({ mode: 'home', uploadLook: null });
  assert.ok(Math.abs(homeTitleOpacity() - 1) < 0.000001);
  assert.equal(slot().props.floatEnabled, true);
  assert.ok(Math.abs(phase.get() - pausedAt - 2 * Math.PI) < 0.000001);
});

for (const title of ['Seoul', 'Presentation skills workshop with a long title for the November rehearsal']) {
  test(`Home keeps its title layout and fades slide count in during the return for ${title}`, async () => {
    const selected = { ...deck(title, 1), pageCount: 10 };
    const neighbour = deck('Neighbour', 2);
    savePresentation(selected);
    savePresentation(neighbour);
    const { home, rerender } = await mount(HomeScreen, { mode: 'rehearse', uploadLook: null });
    const label = (deckId, text) => renderer.root.find(node => node.props.deck?.id === deckId && node.props.floatPhase)
      .findAllByType('text').find(node => node.children.join('') === text);
    const opacity = (deckId, text) => hostParent(label(deckId, text)).props.style.opacity;
    const titleOpacity = () => opacity(title, title);
    const countOpacity = () => opacity(title, '10 slides · 01');
    const sideOpacity = () => opacity(neighbour.id, neighbour.title);
    const returnTo = progress => act(async () => {
      home.titleReturn.set(progress);
      savePresentation({ ...selected });
      savePresentation({ ...neighbour });
    });
    const titleLayout = () => {
      const node = label(title, title);
      return { width: flat(node.props.style).width, lines: node.props.numberOfLines };
    };

    await returnTo(0.65);
    assert.deepEqual(titleLayout(), { width: 244, lines: 2 });
    assert.equal(titleOpacity(), 0);
    assert.equal(countOpacity(), 0);
    assert.equal(sideOpacity(), 0);
    await returnTo(0.70);
    const earlyCount = countOpacity();
    assert.equal(titleOpacity(), 0);
    assert.ok(earlyCount > 0 && earlyCount < 1);
    await returnTo(0.82);
    assert.ok(titleOpacity() > 0 && titleOpacity() < 1);
    assert.ok(countOpacity() > earlyCount && countOpacity() < 1);
    assert.equal(sideOpacity(), 0, 'nearby titles wait for the wider rehearsal title to fade');
    await returnTo(0.94);
    assert.equal(titleOpacity(), 1);
    assert.ok(sideOpacity() > 0 && sideOpacity() < 1);
    assert.deepEqual(titleLayout(), { width: 244, lines: 2 });
    await returnTo(0.5);
    assert.equal(titleOpacity(), 0, 'a reversing swipe restores rehearsal ownership');
    assert.equal(countOpacity(), 0);
    assert.equal(sideOpacity(), 0);
    await returnTo(1);
    assert.equal(titleOpacity(), 1);
    assert.equal(countOpacity(), 1);
    await rerender({ mode: 'home', uploadLook: null });
    assert.equal(titleOpacity(), 1);
    assert.equal(countOpacity(), 1);
    assert.deepEqual(titleLayout(), { width: 244, lines: 2 });
  });
}

// OpenAI Codex integrated supplied Home blur regression: docs/ai-collaboration-prompts-iteration-2.md#widen-and-blur-home-carousel--november-20-2026
test('Home side cards, titles included, are blurred and the front card is sharp', async () => {
  for (const [id, order] of [['Front talk', 1], ['Next talk', 2], ['Last talk', 3]]) savePresentation(deck(id, order));
  await mount(HomeScreen, { mode: 'home', uploadLook: null });
  const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const cards = renderer.root.findAll(node => typeof node.type === 'string'
    && (flatten(node.props.style).transform ?? []).some(t => t.perspective === 700));
  assert.equal(cards.length, 3, 'front card and one card either side');
  const blurOf = card => (flatten(card.props.style).filter ?? []).find(f => 'blur' in f)?.blur ?? 0;
  const titleOf = card => card.findAllByType('text').map(t => t.children.join(''))[0];
  const byTitle = Object.fromEntries(cards.map(card => [titleOf(card), blurOf(card)]));
  assert.equal(byTitle['Front talk'], 0);
  assert.equal(byTitle['Next talk'], 2);
  assert.equal(byTitle['Last talk'], 2);
});

test('a fast Home wrap reuses card views and defers stats and blur until settling', async () => {
  for (let index = 0; index < 14; index++) savePresentation(deck(`Library talk ${index}`, index + 1));
  const prepared = [];
  const { home } = await mount(HomeScreen, { mode: 'home', uploadLook: null, onFrontDeckChange: id => prepared.push(id) });
  const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const cards = () => renderer.root.findAll(node => typeof node.type === 'string'
    && (flatten(node.props.style).transform ?? []).some(t => t.perspective === 700));
  const slots = () => renderer.root.findAll(node => node.props.deck?.id && node.props.floatPhase);
  const originalSlots = slots();
  const sameSlots = () => slots().every((slot, index) => slot === originalSlots[index]);
  const hasBlur = () => cards().some(node => flatten(node.props.style).filter?.some(filter => filter.blur > 0));
  // The mock reads animated styles on render; Android observes the shared values directly.
  const rereadStyles = () => visibleDecks().forEach(item => savePresentation({ ...item }));
  assert.equal(cards().length, 5);
  assert.equal(hasBlur(), true);
  assert.deepEqual(prepared, ['Library talk 0']);
  const gesture = () => renderer.root.findByType('gesture').props.gesture[0];
  const drag = (pan, x) => {
    pan.onBegin();
    pan.onActivate();
    pan.onUpdate({ translationX: 12, translationY: 0, velocityX: 400 });
    pan.onUpdate({ translationX: x, translationY: 0, velocityX: 400 });
  };
  const pan = gesture();
  await act(async () => { drag(pan, 620); rereadStyles(); });
  assert.ok(home.p.value < -2, 'the drag crossed the wrap point');
  assert.equal(cards().length, 5);
  assert.equal(sameSlots(), true);
  assert.equal(hasBlur(), false);
  assert.equal(renderer.root.findAllByType('home-stats').length, 3, 'slow movement preserves the stats crossfade');
  assert.deepEqual(prepared, ['Library talk 0']);
  await act(async () => {
    pan.onUpdate({ translationX: 1040, translationY: 0, velocityX: 3000 });
    rereadStyles();
  });
  assert.equal(cards().length, 5);
  assert.equal(sameSlots(), true);
  assert.equal(renderer.root.findAllByType('home-stats').length, 0);

  const fastPosition = async position => act(async () => {
    pan.onUpdate({ translationX: 12 - position * 190, translationY: 0, velocityX: 3000 });
    rereadStyles();
  });
  await fastPosition(-8.1);
  const retainedCards = slots().map(slot => slot.props.deck.id);
  await fastPosition(-7.4);
  assert.deepEqual(slots().map(slot => slot.props.deck.id), retainedCards, 'crossing one fast card reuses the buffered window');
  assert.ok(retainedCards.includes('Library talk 6') && retainedCards.includes('Library talk 8'), 'both sides of the visible fast spin stay populated');

  runtime.timingCallbacks = [];
  try {
    await act(async () => { pan.onDeactivate({ velocityX: 1400, canceled: false }); rereadStyles(); });
    const selected = ((home.p.value % 14) + 14) % 14;
    const selectedTitle = `Library talk ${selected}`;
    assert.equal(cards().length, 5);
    assert.equal(hasBlur(), false);
    assert.equal(renderer.root.findAllByType('home-stats').length, 0);
    assert.deepEqual(prepared, ['Library talk 0']);
    await act(async () => { runtime.timingCallbacks.pop()(true); rereadStyles(); });
    assert.equal(hasBlur(), true);
    assert.equal(renderer.root.findAllByType('home-stats').find(node => node.props.active).props.deckId, selectedTitle);
    assert.deepEqual(prepared, ['Library talk 0', selectedTitle]);
    assert.ok(byLabel(`${selectedTitle}, 1 slides`));

    const startFling = async () => {
      const next = gesture();
      await act(async () => {
        drag(next, -200);
        next.onDeactivate({ velocityX: -1600, canceled: false });
        rereadStyles();
      });
      assert.equal(hasBlur(), false);
    };
    await startFling();
    await action('delete');
    await act(async () => { runtime.timingCallbacks.pop()(false); rereadStyles(); });
    assert.equal(visibleDecks().length, 13);
    assert.equal(hasBlur(), true);
    assert.ok(renderer.root.findAllByType('home-stats').some(node => node.props.active));

    await startFling();
    const undo = renderer.root.findAllByType('pressable').find(node =>
      node.findAllByType('text').some(child => child.children.join('') === 'Undo'));
    await act(async () => { undo.props.onPress(); runtime.timingCallbacks.pop()(false); rereadStyles(); });
    assert.equal(visibleDecks().length, 14);
    assert.equal(hasBlur(), true);
    assert.ok(renderer.root.findAllByType('home-stats').some(node => node.props.active));
  } finally {
    delete runtime.timingCallbacks;
  }
});

test('mounted pages share a long deck model and refresh it after analysis or timing changes', async () => {
  const talk = deck('Long saved talk', 1);
  savePresentation({ ...talk, pageCount: 91, slides: Array.from({ length: 91 }, (_, i) => ({ title: `Slide ${i + 1}`, text: '', points: [] })) });
  const results = [];
  function Reader({ index }) {
    results[index] = useDeckModel(talk.id);
    return null;
  }
  await act(async () => { renderer = create(h(React.Fragment, null, h(Reader, { index: 0 }), h(Reader, { index: 1 }))); });
  const initial = results[0];
  assert.equal(initial.n, 91);
  assert.strictEqual(results[0], results[1]);
  await act(async () => bump());
  const afterAnalysis = results[0];
  assert.notStrictEqual(afterAnalysis, initial);
  assert.strictEqual(afterAnalysis, results[1]);
  await act(async () => notifyRequirementsChanged());
  assert.notStrictEqual(results[0], afterAnalysis);
  assert.strictEqual(results[0], results[1]);
});

test('Home card tap shows and releases a press response before navigation', async () => {
  savePresentation(deck('Tap target', 1));
  const { home } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  const tapGesture = renderer.root.findByType('gesture').props.gesture[2];
  await act(async () => tapGesture.onBegin());
  assert.equal(home.press.value, 0.93);
  await act(async () => tapGesture.onFinalize());
  assert.equal(home.press.value, 1);
});

test('home opens the icon picker, logo tutorial and credits, and leaves the last presentation in the library', async () => {
  savePresentation(deck('Only talk', 1));
  const { routes } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
  await action('delete');
  assert.equal(visibleDecks().length, 1);
  await action('longpress');
  assert.equal(textShown('Choose an icon'), true);
  await click('Literature');
  assert.equal(deckById('Only talk').icon, 'book');
  assert.equal(textShown('Choose an icon'), true);
  await click('Close icon picker');
  assert.equal(textShown('Choose an icon'), false);
  await click('How OutLoud works');
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 1);
  await act(async () => assert.equal(pressBack(), true));
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
  await act(async () => byLabel('How OutLoud works').props.onLongPress());
  await act(async () => assert.equal(pressBack(), true));
  assert.equal(routes.length, 0);
});

test('reopened tutorial pauses Home icons at their current position through the downward dismissal', async () => {
  writeStored(TUTORIAL_SEEN, true);
  const talk = deck('Tutorial position talk', 1);
  savePresentation(talk);
  const props = { mode: 'home', uploadLook: null };
  const { rerender } = await mount(HomeScreen, props);
  const slot = () => renderer.root.find(node => node.props.deck?.id === talk.id && node.props.floatPhase);
  const phase = slot().props.floatPhase;
  const pausedAt = Math.PI / 2;
  phase.set(pausedAt);

  await click('How OutLoud works');
  assert.equal(slot().props.floatEnabled, true);
  assert.equal(phase.get(), pausedAt);
  const pan = () => renderer.root.findAllByType('gesture').find(node =>
    node.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length > 0).props.gesture;
  const part = testID => renderer.root.findByProps({ testID }).props;
  const opacity = testID => flat(part(testID).style).opacity;
  const coordinates = flat(byLabel('Light mode').props.style);
  const update = () => rerender({ ...props, onFrontDeckChange: () => {} });
  await update();
  assert.equal(opacity('home-appearance'), 0);
  assert.equal(part('home-appearance').pointerEvents, 'none');
  assert.equal(opacity('tutorial-hints'), 1);
  await act(async () => {
    pan().onActivate();
    pan().onUpdate({ translationX: 0, translationY: 63 });
  });
  await update();
  assert.ok(opacity('home-appearance') > 0);
  assert.ok(opacity('tutorial-hints') > 0);
  assert.equal(opacity('home-hints'), 0);
  await act(async () => pan().onDeactivate({ translationX: 0, translationY: 63, canceled: false }));
  await update();
  assert.equal(opacity('home-appearance'), 0);
  assert.equal(opacity('tutorial-hints'), 1);
  await act(async () => {
    pan().onActivate();
    pan().onUpdate({ translationX: 0, translationY: 135 });
  });
  await update();
  assert.equal(opacity('tutorial-hints'), 0);
  assert.equal(opacity('home-hints'), 0.5);
  assert.equal(part('home-appearance').pointerEvents, 'none');
  assert.deepEqual(flat(byLabel('Light mode').props.style), coordinates);
  assert.equal(phase.get(), pausedAt);
  runtime.timingCallbacks = [];
  try {
    await act(async () => pan().onDeactivate({ translationX: 0, translationY: 135, canceled: false }));
    await update();
    assert.equal(opacity('tutorial-hints'), 0);
    assert.equal(opacity('home-hints'), 1);
    assert.equal(opacity('home-appearance'), 1);
    assert.equal(part('home-appearance').pointerEvents, 'none');
    await act(async () => runtime.timingCallbacks.shift()(true));
  } finally {
    delete runtime.timingCallbacks;
  }
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
  assert.equal(opacity('home-hints'), 1);
  assert.equal(part('home-appearance').pointerEvents, 'box-none');
  assert.ok(Math.abs(phase.get() - pausedAt - 2 * Math.PI) < 0.000001);
});

// OpenAI Codex, 2026-11-20: the picker fades from the top while its bottom cue stays fixed.
test('icon picker fades from the top during a drag while its close hint stays fixed', async () => {
  savePresentation(deck('Picker talk', 1));
  const { home } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  await action('longpress');
  const pickerLayer = () => byLabel('Close icon picker').parent;
  const hint = () => renderer.root.findAllByType('text').find(node => node.children.join('') === 'Swipe down to close');
  assert.equal(pickerLayer().props.style.at(-1).opacity, 1);
  assert.ok(hint());
  assert.equal(pickerLayer().findAllByType('text').some(node => node.children.join('') === 'Swipe down to close'), false);
  const pan = renderer.root.findByType('pan');
  await act(async () => pan.props.onMove({}, { dx: 0, dy: 30 }));
  await click('Literature');
  const sectionOpacity = top => renderer.root.findAllByType('animated').find(node =>
    Array.isArray(node.props.style) && node.props.style[0]?.top === top).props.style.at(-1).opacity;
  let titleLayer = renderer.root.findAllByType('text').find(node => node.children.join('') === 'Choose an icon').parent;
  while (titleLayer.type !== 'animated') titleLayer = titleLayer.parent;
  const titleOpacity = titleLayer.props.style.at(-1).opacity;
  assert.ok(titleOpacity < sectionOpacity(232), 'title fades before color swatches');
  assert.ok(sectionOpacity(232) < sectionOpacity(292), 'color swatches fade before icon grid');
  await act(async () => pan.props.onMove({}, { dx: 0, dy: 90 }));
  await click('Physics'); // The store update rerenders the animated style in this test renderer.
  assert.equal(pickerLayer().props.style.at(-1).opacity, 0.5);
  assert.ok(hint());
  await act(async () => pan.props.onRelease());
  await click('Science');
  assert.equal(pickerLayer().props.style.at(-1).opacity, 1);
  await act(async () => pan.props.onMove({}, { dx: 0, dy: 140 }));
  await click('Business');
  assert.ok(pickerLayer().props.style.at(-1).opacity < 0.3);
  assert.ok(hint());
  await act(async () => pan.props.onRelease());
  assert.equal(home.picker.value, 0);
  assert.equal(textShown('Choose an icon'), false);
});

test('Home switches every gesture label and TalkBack, keeps the selected deck, and restores its preference', async () => {
  writeStored('settings.languagePreference', 'en');
  savePresentation(deck('First talk', 1));
  savePresentation(deck('Open', 2)); // A deck title may also be the English for a button.
  const { home, routes } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  await action('increment');
  assert.equal(home.p.value, 1);
  const english = byLabel('App language: English');
  assert.equal(english.props.accessibilityState.checked, false);
  assert.equal(english.props.accessibilityHint, 'Switch to Korean.');
  await click('App language: English');
  assert.equal(readStored('settings.languagePreference'), 'ko');
  assert.equal(byLabel('앱 언어: 한국어').props.accessibilityHint, '영어로 전환합니다.');
  assert.equal(byLabel('앱 언어: 한국어').props.accessibilityState.checked, true);
  for (const label of ['돌리기', '열기', '아이콘', '추가', '삭제', 'Open']) assert.ok(textShown(label), label);
  const card = byLabel('Open, 슬라이드 1장');
  assert.equal(card.props.accessibilityActions.find(a => a.name === 'activate').label, '열기');
  assert.equal(home.p.value, 1);
  assert.deepEqual(routes, []);
  await act(async () => renderer.unmount()); renderer = undefined;
  await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.ok(byLabel('앱 언어: 한국어'));
  const toggle = byLabel('앱 언어: 한국어').props.onPress;
  await act(async () => { toggle(); toggle(); });
  assert.equal(readStored('settings.languagePreference'), 'ko');
  await click('앱 언어: 한국어');
  assert.equal(readStored('settings.languagePreference'), 'en');
  for (const label of ['Spin', 'Open', 'Icon', 'Add', 'Delete']) assert.ok(textShown(label), label);
});

test('Korean copy translates formatted feedback and controls while preserving the exact evidence or practice sentence', async () => {
  const { koreanText } = await import('../src/design/koreanText.ts');
  assert.equal(koreanText('Slide 3 of 6: Open'), '슬라이드 3 / 6: Open');
  assert.equal(koreanText('Slide score 74 · Strong'), '슬라이드 점수 74 · ' + koreanText('Strong'));
  assert.equal(koreanText('Try saying: “Open · Delete.”'), '이렇게 말해 보세요: “Open · Delete.”');
  assert.equal(koreanText('Speech: “Open · Delete”'), '발언: “Open · Delete”');
  assert.equal(koreanText('Slide description (edited; may differ from PDF text): Open'), '슬라이드 설명 (직접 수정, PDF 원문과 다를 수 있어요): Open');
  assert.equal(koreanText('From slide 3'), '슬라이드 3에서');
  assert.equal(koreanText('periwinkle colour'), '연한 남보라색');
  assert.equal(koreanText('1000 ms'), '1000밀리초');
  assert.equal(koreanText('toString'), 'toString');
});

test('Korean tutorial covers all eight page topics, titles, descriptions and navigation hints', async () => {
  const { koreanText } = await import('../src/design/koreanText.ts');
  for (const page of TUTORIAL_PAGES) {
    for (const key of [page.topic, page.title, page.body]) {
      assert.notEqual(koreanText(key), key, key);
    }
  }
  for (const key of ['Swipe for more', 'Swipe down to close', 'Got it', 'Next page']) {
    assert.notEqual(koreanText(key), key, key);
  }
});

test('Korean recording labels cover new slides, saved takes, the long press action, and interrupted recording', async () => {
  const { koreanText } = await import('../src/design/koreanText.ts');
  const hold = '. Hold 1.5 seconds to redo the whole presentation';
  const prompt = '. 1.5초간 누르면 전체 발표를 다시 녹음해요';
  assert.equal(koreanText('Redo slide 1' + hold), '슬라이드 1 다시 녹음' + prompt);
  assert.equal(koreanText('Record slide 12' + hold), '슬라이드 12 녹음' + prompt);
  assert.equal(koreanText('Record slide 2'), '슬라이드 2 녹음');
  assert.equal(koreanText('Redo slide 12'), '슬라이드 12 다시 녹음');
  assert.equal(koreanText('Starting in 3. Tap to cancel'), '3초 후 시작해요. 누르면 취소돼요');
  assert.equal(koreanText('Stop recording'), '녹음 종료');
  assert.equal(koreanText('Full run · target 10:00'), '전체 발표 · 목표 10:00');
  assert.equal(koreanText('Recording interrupted 1 of 2 · tap to inspect'), '녹음이 중단됐어요 (1 / 2) · 눌러서 확인');
  assert.equal(koreanText('Recording interrupted · tap to inspect'), '녹음이 중단됐어요 · 눌러서 확인');
});

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!await predicate()) {
    assert.ok(Date.now() < deadline, 'Upload did not reach the expected state');
    await act(async () => delay(5));
  }
}

async function choosePdf(title) {
  const uri = new URL(title + '.pdf', documentDirectory).href;
  await fs.writeFile(new URL(uri), '%PDF-1.7 synthetic upload');
  select({ canceled: false, assets: [{ uri, name: title + '.pdf', mimeType: 'application/pdf' }] });
}
const serverId = '11111111-1111-4111-8111-111111111111';
function extractedText(method, pageCount = 7) {
  const deckFields = { id: serverId, page_count: pageCount };
  const slides = [{ slide_index: 0, extracted_text: 'Recovered slide title' }];
  return method === 'POST' ? response(201, { deck: deckFields, slides }) : response(200, { ...deckFields, slides });
}
const progressRing = () => renderer.root.findAllByType('circle').filter(node => node.props.animatedProps);
const ringFill = ({ props }) => 1 - props.animatedProps.strokeDashoffset / (2 * Math.PI * props.r);

test('PDF import reads slide text and lets setup finish without touching the cue API', async t => {
  const { routes, home, rerender } = await mount(UploadScreen);
  await choosePdf('Online text-only import');
  demoNative.pageCount = 10;
  let finishText;
  const unexpected = [];
  t.mock.method(globalThis, 'fetch', async url => {
    unexpected.push(url);
    throw new Error('Unexpected direct request during import');
  });
  network.respond = async (url, init) => {
    assert.match(url, /\/decks\/$/);
    assert.equal(init.method, 'POST');
    return new Promise(resolve => { finishText = () => resolve(extractedText(init.method, 10)); });
  };
  await click('Choose a PDF to upload');
  await waitFor(() => textShown('Finding slides'));
  assert.equal(progressRing().length, 1);
  const fill = progressRing()[0];
  assert.ok(ringFill(fill) < 0.34);
  await waitFor(() => !!finishText && textShown('Found 10 slides'));
  assert.equal(textShown('Reading the text'), true);
  home.gap.set(0);
  await rerender();
  assert.equal(flat(renderer.root.findByProps({ testID: 'upload-content' }).props.style).opacity, 1);
  assert.deepEqual(progressRing(), [fill]);
  assert.ok(ringFill(fill) > 0.34 && ringFill(fill) < 0.67);
  assert.equal(renderer.root.findAllByType('requirements').length, 0);
  await act(async () => finishText());
  await waitFor(() => ringFill(fill) > 0.67 && ringFill(fill) < 1);
  assert.equal(textShown('Planning time per slide'), true);
  assert.equal(renderer.root.findAllByType('requirements').length, 0);
  await waitFor(() => ringFill(fill) === 1);
  assert.equal(renderer.root.findAllByType('requirements').length, 0);
  assert.deepEqual(progressRing(), [fill]);
  await waitFor(() => renderer.root.findAllByType('requirements').length === 1);
  assert.equal(progressRing().length, 0, 'the completed ring is removed before Timing enters');
  assert.equal(flat(renderer.root.findByProps({ testID: 'upload-content' }).props.style).opacity, 1);
  const imported = visibleDecks()[0];
  assert.equal(imported.text, 'ready');
  assert.equal(imported.slides[0].text, 'Recovered slide title');
  await act(async () => renderer.root.findByType('requirements').props.onSaved());
  assert.deepEqual(routes, [['rehearse', { nav: 'fade', deckId: imported.id, slide: 0 }]]);
  assert.equal(network.requests.length, 1, 'no cue status or generation request before rehearsal opens');
  assert.deepEqual(unexpected, []);
});

test('reduced motion keeps same ring and ordered PDF stages for immediately available text', async () => {
  runtime.reducedMotion = true;
  await mount(UploadScreen);
  await choosePdf('Quick reduced-motion import');
  network.respond = async (_url, init) => extractedText(init.method);
  await click('Choose a PDF to upload');
  await waitFor(() => textShown('Finding slides'));
  const fill = progressRing()[0];
  assert.ok(ringFill(fill) < 0.34);
  await waitFor(() => textShown('Found 7 slides'));
  assert.ok(ringFill(fill) > 0.34 && ringFill(fill) < 0.67);
  await waitFor(() => ringFill(fill) > 0.67);
  assert.ok(ringFill(fill) < 1);
  assert.deepEqual(progressRing(), [fill]);
  assert.equal(renderer.root.findAllByType('requirements').length, 0);
  await waitFor(() => renderer.root.findAllByType('requirements').length === 1);
  assert.equal(progressRing().length, 0);
  assert.equal(network.requests.length, 1);
});

test('leaving while the ring shows text extraction cancels the import', async () => {
  const { routes } = await mount(UploadScreen);
  await choosePdf('Cancelled text reading');
  let uploadSignal;
  network.respond = async (_url, init) => {
    uploadSignal = init.signal;
    return new Promise((_resolve, reject) => uploadSignal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
  };
  await click('Choose a PDF to upload');
  await waitFor(() => !!uploadSignal && textShown('Found 7 slides'));
  assert.equal(progressRing().length, 1);
  await act(async () => assert.equal(pressBack(), true));
  assert.equal(uploadSignal.aborted, true);
  await waitFor(async () => !(await getImportedPdfs()).some(pdf => pdf.title === 'Cancelled text reading'));
  assert.deepEqual(routes, [['home', { nav: null }]]);
  assert.equal(renderer.root.findAllByType('requirements').length, 0);
  assert.deepEqual(visibleDecks(), []);
});

test('leaving during time planning cancels the queued setup and discards the imported PDF', async () => {
  const { routes } = await mount(UploadScreen);
  await choosePdf('Abandoned time planning');
  network.respond = async (_url, init) => extractedText(init.method);
  await click('Choose a PDF to upload');
  await waitFor(() => progressRing().some(ring => ringFill(ring) > 0.67 && ringFill(ring) < 1));
  assert.equal(visibleDecks().length, 1);
  await act(async () => assert.equal(pressBack(), true));
  await waitFor(async () => !(await getImportedPdfs()).some(pdf => pdf.title === 'Abandoned time planning'));
  await act(async () => delay(400));
  assert.deepEqual(routes, [['home', { nav: null }]]);
  assert.equal(renderer.root.findAllByType('requirements').length, 0);
  assert.deepEqual(visibleDecks(), []);
});

// OpenAI Codex, 2026-11-21: an offline POST with an unknown outcome needs an explicit refresh before upload replay.
test('upload saves an offline deck and refresh explicitly recovers slide text when the API returns', async () => {
  const { routes, home } = await mount(UploadScreen);
  await click('Choose a PDF to upload');
  assert.equal(textShown('Tap the icon to upload · PDF · up to 50 MB'), true);
  await choosePdf('Offline talk');
  network.respond = async () => { throw new Error('Offline fixture'); };
  await click('Choose a PDF to upload');
  await waitFor(() => renderer.root.findAllByType('requirements').length === 1);
  assert.equal(progressRing().length, 0);
  const backdrop = flat(renderer.root.findByProps({ testID: 'upload-timing-surface' }).props.style);
  assert.equal(backdrop.backgroundColor, DARK_PALETTE.bg, 'the setup covers the Home and import layers');
  const saved = visibleDecks()[0];
  assert.equal(saved.text, 'pending');
  assert.equal(saved.pages.length, 7);
  assert.equal(defaultRequirementsPending(saved.id, API_URL), true);
  await act(async () => renderer.root.findByType('requirements').props.onSaved());
  assert.deepEqual(routes, [['rehearse', { nav: 'fade', deckId: saved.id, slide: 0 }]]);
  assert.equal(home.uploadBlur.value, 0);
  network.respond = async (_url, init) => extractedText(init.method);
  const before = network.requests.length;
  await ensureSlideText(saved.id);
  assert.equal(serverPdfUnconfirmed(saved.id, API_URL), true);
  assert.equal(network.requests.length, before, 'automatic recovery cannot repeat an unconfirmed upload');
  await serverSlides({ id: saved.id, title: saved.title, uri: saved.uri, pageCount: saved.pageCount }, API_URL, undefined, 300000, true);
  await ensureSlideText(saved.id);
  assert.equal(deckById(saved.id).slides[0].text, 'Recovered slide title');
  assert.equal(deckById(saved.id).text, 'ready');
});

test('slow PDF confirmation survives the import wait and links the saved deck without another upload', async t => {
  await choosePdf('Slow online deck');
  const pdf = await pickPdf();
  const setTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) =>
    setTimeout(callback, ms === SLIDE_TEXT_WAIT_MS ? 0 : ms, ...args));
  let finish, uploadSignal;
  network.respond = async (_url, init) => {
    assert.equal(init.method, 'POST');
    uploadSignal = init.signal;
    return new Promise((resolve, reject) => {
      uploadSignal.addEventListener('abort', () => reject(new Error('Upload aborted')), { once: true });
      finish = () => resolve(extractedText('POST'));
    });
  };

  const locallySaved = await analyzePdf(pdf, () => {}, new AbortController().signal);
  try {
    assert.equal(locallySaved.text, 'pending');
    assert.equal(uploadSignal.aborted, false, 'waiting for setup must not cancel the upload');
    assert.equal(serverPdfUnconfirmed(pdf.id), false, 'the upload is still active');
    const awaiting = serverSlides(locallySaved);
    const mismatch = assert.rejects(serverSlides({ ...locallySaved, pageCount: 8 }), /different presentation/);
    finish();
    assert.equal((await awaiting).deckId, serverId);
    await mismatch;
    await waitFor(() => deckById(pdf.id)?.text === 'ready');
    assert.equal(deckById(pdf.id).slides[0].text, 'Recovered slide title');
    assert.equal(network.requests.length, 1);
  } finally {
    finish?.();
  }
});

test('upload reports a failed render and lets the user leave without a saved deck', async () => {
  const { routes } = await mount(UploadScreen);
  assert.ok(textShown('New'));
  assert.equal(textShown('New presentation'), false);
  await choosePdf('Damaged talk');
  demoNative.failRender = true;
  await click('Choose a PDF to upload');
  await waitFor(() => textShown('This PDF could not be opened. It may be damaged.'));
  await waitFor(async () => !(await getImportedPdfs()).some(pdf => pdf.title === 'Damaged talk'));
  assert.deepEqual(visibleDecks(), []);
  assert.equal((await getImportedPdfs()).some(pdf => pdf.title === 'Damaged talk'), false);
  await act(async () => assert.equal(pressBack(), true));
  assert.deepEqual(routes, [['home', { nav: null }]]);
});

test('legacy deck page recovery renders once and updates page count and timing together', async () => {
  await choosePdf('Legacy talk');
  const { pickPdf } = await import('../src/features/presentations/importer.ts');
  const pdf = await pickPdf();
  savePresentation({ ...deck(pdf.id, 1), ...pdf });
  await ensurePages(pdf.id);
  const recovered = deckById(pdf.id);
  assert.equal(recovered.pageCount, 7);
  assert.equal(recovered.slides.length, 7);
  assert.equal(recovered.targets.reduce((sum, seconds) => sum + seconds, 0), recovered.target);
  await ensurePages(pdf.id);
  assert.equal(deckById(pdf.id), recovered);
});

// OpenAI Codex integrated supplied regression: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const hostParent = node => { let p = node.parent; while (p && typeof p.type !== 'string') p = p.parent; return p; };

test('opening Add leaves a seated carousel quiet and dims the backdrop continuously', async () => {
  savePresentation(deck('Existing talk', 1));
  const { home, routes, rerender } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  runtime.timingCallbacks = [];
  try {
    await action('add');
    assert.deepEqual(routes, [['upload', { nav: 'fade' }]]);
    assert.equal(home.gap.value, 1);
    assert.equal(runtime.timingCallbacks.length, 0, 'an already seated deck does not start a carousel spin');
  } finally {
    delete runtime.timingCallbacks;
  }

  const backdrop = () => flat(renderer.root.findByProps({ accessibilityRole: 'adjustable' }).props.style);
  const sample = async (coverage, pull, position = 0) => {
    home.uploadBlur.set(coverage);
    home.vy.set(pull);
    home.p.set(position);
    await rerender({ mode: 'upload', uploadLook: null, onFrontDeckChange() {} });
  };
  for (const [coverage, pull, position] of [[0, -90], [0.5, -20], [1, -2], [1, 0, 0.23]]) {
    await sample(coverage, pull, position);
    assert.equal(backdrop().filter, undefined);
    assert.equal(backdrop().opacity, 1 - 0.69 * coverage);
  }
  await sample(1, 0);
  assert.equal(backdrop().opacity, 1 - 0.69);
  assert.equal(backdrop().filter, undefined, 'the backdrop cannot snap into a new filter at the last frame');
  await sample(0.75, 0);
  assert.equal(backdrop().opacity, 1 - 0.69 * 0.75);
});

test('the Add glow stays selected through entry and blends out with the return gesture', async () => {
  const { uploadGlowReturn } = await import('../src/screens/homeGeometry.ts');
  assert.deepEqual([0, 0.25, 0.5, 1].map(uploadGlowReturn), [0, 65 / 220, 130 / 220, 1]);
});

test('the Add icon stays in place while the opening swipe settles', async () => {
  savePresentation(deck('Existing talk', 1));
  const home = Object.fromEntries(['p', 'vy', 'gap', 'hold', 'uploadBlur', 'uploadReturn', 'analyzing', 'setup', 'press', 'picker', 'titleReturn']
    .map(key => [key, box(['press', 'titleReturn'].includes(key) ? 1 : 0)]));
  const ctx = { home, go: () => {}, nav: { nav: null } };
  const view = mode => h(HomeContext.Provider, { value: ctx },
    h(HomeScreen, { mode, uploadLook: null, onFrontDeckChange: () => {} }),
    mode === 'upload' && h(ShellContext.Provider, { value: ctx }, h(UploadScreen, { hue: 'violet' })));
  await act(async () => { renderer = create(view('home')); });
  const assertSeated = () => {
    const ghost = renderer.root.find(n => typeof n.type === 'string' && flat(n.props.style).zIndex === 300);
    const { transform: [{ translateY }, { scale }], opacity } = flat(ghost.props.style);
    assert.equal(Math.abs(translateY), 0);
    assert.equal(scale, 1);
    assert.equal(opacity, 1);
    assert.equal(renderer.root.findAllByType('text').filter(n => n.children.join('') === 'OutLoud').length, 1);
  };
  home.vy.set(-90);
  await act(async () => renderer.update(view('home')));
  assertSeated();

  home.gap.set(1);
  for (const remainingPull of [-90, -45, 0]) {
    home.vy.set(remainingPull);
    await act(async () => renderer.update(view('upload')));
    assertSeated();
    assert.ok(renderer.root.findByProps({ testID: 'upload-artwork' }));
  }
});

test('Add opens sideways without a vertical drag offset and preserves the neighbors’ floating height', async () => {
  const talks = ['First talk', 'Neighbor talk', 'Last talk'].map((title, index) => deck(title, index + 1));
  talks.forEach(savePresentation);
  const { home, routes, rerender } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  const slot = talk => renderer.root.find(node => node.props.deck?.id === talk.id && node.props.floatPhase);
  const layout = talk => {
    const [{ translateY: y }, { translateX: x }, { scale }] = flat(slot(talk).findAllByType('animated')[0].props.style).transform;
    const [{ translateY: floatY }] = flat(slot(talk).findByProps({ renderToHardwareTextureAndroid: true }).props.style).transform;
    return { y, x, scale, floatY: Math.round(floatY * 1e6) / 1e6 };
  };
  const phase = slot(talks[0]).props.floatPhase;
  const redraw = () => talks.forEach(talk => savePresentation({ ...talk }));
  const pan = renderer.root.findByType('gesture').props.gesture[0];
  const pull = y => pan.onUpdate({ translationX: 0, translationY: y });
  const begin = () => { pan.onBegin(); pan.onActivate(); };
  const finish = canceled => pan.onDeactivate({ canceled, velocityX: 0 });
  phase.set(Math.PI / 2);
  await act(async () => redraw());
  const atRest = talks.map(layout);
  await act(async () => { begin(); pull(-135); redraw(); });
  const expanded = talks.map(layout);
  assert.deepEqual(expanded[1], atRest[1], 'the right neighbor stays still at its floating height');
  assert.ok(expanded[0].x < atRest[0].x, 'the carousel still separates horizontally');
  assert.ok(expanded[0].scale < atRest[0].scale, 'the selected card still scales with depth');
  await act(async () => { finish(true); redraw(); });
  assert.deepEqual(routes, []);
  assert.deepEqual(talks.map(layout), atRest, 'cancel returns both sides to their resting layout');

  await act(async () => { begin(); pull(-135); finish(false); redraw(); });
  assert.deepEqual(routes, [['upload', { nav: 'fade' }]]);
  await rerender({ mode: 'upload', uploadLook: null });
  assert.equal(slot(talks[0]).props.floatEnabled, true);
  assert.deepEqual(talks.map(layout), expanded, 'the entire layout is continuous at the Add handoff');

  home.gap.set(0);
  await rerender({ mode: 'home', uploadLook: null });
  await act(async () => { begin(); pull(30); redraw(); });
  const draggedDown = layout(talks[1]);
  assert.ok(draggedDown.y > atRest[1].y, 'downward Delete retains its vertical movement');
  await act(async () => finish(true));
});

test('a 31-slide PDF keeps its centered artwork through analysis and removes it before Timing fades in', async () => {
  const { analyzeRing } = await import('../src/screens/homeGeometry.ts');
  const ringAt = analyzeRing(false);
  const compactRing = analyzeRing(true);
  assert.ok(Math.abs(compactRing.cy - 352.16) < 0.01);
  assert.ok(Math.abs(compactRing.r - 60.8) < 0.01);
  assert.ok(Math.abs(compactRing.bottom - ringAt.bottom) < 0.01);
  const reading = [];
  const props = { hue: 'violet', onReadingPdf: value => reading.push(value) };
  const { home, rerender, routes } = await mount(UploadScreen, props);
  await choosePdf('Centred 31-slide talk');
  demoNative.pageCount = 31;
  let finishText;
  network.respond = async (_url, init) => new Promise(resolve => {
    finishText = () => resolve(extractedText(init.method, 31));
  });
  await click('Choose a PDF to upload');
  await waitFor(() => !!finishText && textShown('Found 31 slides'));
  home.gap.set(0);
  home.uploadBlur.set(0);
  home.setup.set(1);
  await rerender(props);
  assert.deepEqual(reading, [true]);
  assert.equal(flat(renderer.root.findByProps({ testID: 'upload-hints' }).props.style).opacity, 1);
  const upload = renderer.root.findByProps({ testID: 'upload-content' });
  const artwork = upload.findByProps({ testID: 'upload-artwork' });
  assert.equal(flat(upload.props.style).opacity, 1);
  assert.equal(artwork.findAllByType('text').filter(node => node.children.join('') === 'OutLoud').length, 1);
  const ghost = artwork.find(n => typeof n.type === 'string' && flat(n.props.style).zIndex === 300);
  const slot = flat(ghost.props.style), layer = flat(hostParent(ghost).props.style);
  const [{ translateY }, { scale }] = slot.transform;
  const item = ghost.find(n => typeof n.type === 'string' && flat(n.props.style).height === 223);
  const size = ghost.findAll(n => n.props.icon === 'present' && typeof n.props.size === 'number')[0].props.size;
  const top = layer.top + slot.top, mid = top + slot.height / 2;
  const drawn = mid + (top + flat(item.props.style).height - size / 2 - mid) * scale + translateY;
  assert.ok(Math.abs(drawn - ringAt.cy) < 0.01, `icon centre ${drawn} vs ring centre ${ringAt.cy}`);
  assert.equal(slot.opacity, 1);
  assert.equal(ghost.findAll(n => typeof n.type === 'string' && flat(n.props.style).opacity === 0).length > 0, true, 'floor shadow hidden');

  const arc = renderer.root.find(n => n.type === 'circle' && n.props.stroke === 'url(#gMultiUp)');
  const svg = renderer.root.find(n => n.type === 'svg' && n.findAll(c => c === arc).length === 1);
  assert.equal(arc.props.r, ringAt.r);
  assert.ok(Math.abs(flat(hostParent(svg).props.style).top + svg.props.height / 2 - ringAt.cy) < 0.01);
  const progress = renderer.root.findByProps({ accessibilityLiveRegion: 'polite' });
  const stages = flat(progress.props.style);
  assert.deepEqual([stages.top, stages.bottom, stages.paddingTop, stages.justifyContent, stages.alignItems], [ringAt.bottom, 0, 40, 'flex-start', 'center']);
  assert.ok(progress.findAllByType('view').some(node => flat(node.props.style).gap === 12));
  assert.equal(progress.props.pointerEvents, 'box-none');
  runtime.timingCallbacks = [];
  try {
    await act(async () => finishText());
    await waitFor(() => progressRing().some(ring => ringFill(ring) === 1));
    assert.equal(renderer.root.findAllByProps({ testID: 'upload-artwork' }).length, 1);
    assert.equal(renderer.root.findAllByType('requirements').length, 0);
    await waitFor(() => renderer.root.findAllByType('requirements').length === 1);
    assert.equal(runtime.timingCallbacks.length, 1, 'the Timing entry animation is still pending');
    const surface = renderer.root.findByProps({ testID: 'upload-timing-surface' });
    assert.equal(flat(surface.props.style).backgroundColor, DARK_PALETTE.bg);
    assert.equal(flat(renderer.root.findByProps({ testID: 'upload-hints' }).props.style).opacity, 1);
    assert.ok(surface.findByType('requirements'));
    assert.equal(renderer.root.findAllByProps({ testID: 'upload-artwork' }).length, 0);
    assert.equal(progressRing().length, 0);
    assert.equal(textShown('OutLoud'), false);
    assert.equal(textShown('Centred 31-slide talk.pdf'), false);
    await act(async () => runtime.timingCallbacks.shift()(true));
  } finally {
    delete runtime.timingCallbacks;
  }
  await act(async () => assert.equal(pressBack(), true));
  assert.deepEqual(routes, [['home', { nav: null }]]);
  assert.deepEqual(visibleDecks(), []);
});

// OpenAI Codex, Iteration 4 (2026-11-21): first-run prototype guide and its native swipe stay usable on the bilingual branch.
test('the guide opens once, walks eight pages and responds to native page swipes', async () => {
  removeStored(TUTORIAL_SEEN);
  savePresentation(deck('Tour talk', 1));
  await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.equal(TUTORIAL_PAGES.length, 8);
  assert.equal(textShown('1 of 8 · Gestures'), true);
  assert.ok(byLabel('Light mode'));
  const tutorialPan = () => renderer.root.findAllByType('gesture').find(node =>
    node.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length > 0).props.gesture;
  await act(async () => {
    const pan = tutorialPan();
    pan.onActivate();
    pan.onUpdate({ translationX: -65, translationY: 2 });
    pan.onDeactivate({ translationX: -65, translationY: 2, canceled: false });
  });
  assert.equal(textShown('2 of 8 · Add'), true);
  await click('App language: English');
  assert.equal(readStored('settings.languagePreference'), 'ko');
  const { koreanText } = await import('../src/design/koreanText.ts');
  assert.equal(textShown(`8개 중 2 · ${koreanText('Add')}`), true);
  assert.ok(byLabel(koreanText('Next page')));
  assert.ok(byLabel(koreanText('Light mode')));
  await click('앱 언어: 한국어');
  assert.equal(textShown('2 of 8 · Add'), true);
  await act(async () => {
    const pan = tutorialPan();
    pan.onActivate();
    pan.onUpdate({ translationX: 65, translationY: 2 });
    pan.onDeactivate({ translationX: 65, translationY: 2, canceled: false });
  });
  assert.equal(textShown('1 of 8 · Gestures'), true);
  for (let i = 1; i < TUTORIAL_PAGES.length; i++) {
    await click('Next page');
    assert.equal(textShown(`${i + 1} of 8 · ${TUTORIAL_PAGES[i].topic}`), true);
  }
  assert.equal(textShown('Swipe for more'), false);
  const description = renderer.root.findAllByType('text').find(node => node.children.join('') === TUTORIAL_PAGES.at(-1).body);
  const doneStyle = () => flat(byLabel('Got it').props.style);
  assert.equal(doneStyle().top, 655);
  await act(async () => hostParent(description).props.onLayout({ nativeEvent: { layout: { y: 528, height: 130 } } }));
  assert.equal(doneStyle().top, 666);
  assert.equal(doneStyle().width, 140);
  await click('Got it');
  assert.equal(readStored(TUTORIAL_SEEN), true);
  assert.ok(byLabel('App language: English'));
  assert.ok(byLabel('Light mode'));
  await click('How OutLoud works');
  assert.equal(renderer.root.findByProps({ testID: 'home-appearance' }).props.importantForAccessibility, 'no-hide-descendants');
  await act(async () => assert.equal(pressBack(), true));
  await act(async () => renderer.unmount()); renderer = undefined;
  await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
  await click('How OutLoud works');
  assert.equal(textShown('1 of 8 · Gestures'), true);
  assert.equal(renderer.root.findByProps({ testID: 'home-appearance' }).props.importantForAccessibility, 'no-hide-descendants');
  await act(async () => assert.equal(pressBack(), true));
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
});
