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
registerHooks({ resolve, load });

const { HomeScreen } = await import('../src/screens/HomeScreen.tsx');
const { UploadScreen } = await import('../src/screens/UploadScreen.tsx');
const { HomeContext, ShellContext } = await import('../src/screens/shared.ts');
const { deckById, savePresentation, saveDeckState, getDeckState, forgetPresentation, visibleDecks } =
  await import('../src/features/presentations/store.ts');
const { getImportedPdfs } = await import('../src/features/pdf/service.ts');
const { ensureSlideText, ensurePages } = await import('../src/features/presentations/importer.ts');
const { defaultRequirementsPending } = await import('../src/features/presentations/defaultRequirements.ts');
const { API_URL } = await import('../src/services/api.ts');

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
  select({ canceled: true, assets: null });
});
after(() => fs.rm(root, { recursive: true, force: true }));

async function mount(Screen, props) {
  const home = Object.fromEntries(['p', 'vy', 'gap', 'hold', 'uploadBlur', 'analyzing', 'setup', 'press', 'picker']
    .map(key => [key, box(key === 'press' ? 1 : 0)]));
  const routes = [];
  const ctx = { home, go: (...args) => routes.push(args), nav: { nav: null } };
  const Context = Screen === HomeScreen ? HomeContext : ShellContext;
  await act(async () => { renderer = create(h(Context.Provider, { value: ctx }, h(Screen, props))); });
  return { home, routes };
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
  await click('Full review and AI assessment of First talk');
  assert.deepEqual(routes.pop(), ['full', { nav: 'fade', deckId: 'First talk', from: 'home' }]);
  await action('increment');
  assert.equal(home.p.value, 1);
  await action('activate');
  assert.deepEqual(routes.pop(), ['rehearse', { nav: 'fade', deckId: 'Second talk', slide: 0 }]);
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

test('home opens the icon picker and About, and leaves the last presentation in the library', async () => {
  savePresentation(deck('Only talk', 1));
  const { routes } = await mount(HomeScreen, { mode: 'home', uploadLook: null });
  await action('delete');
  assert.equal(visibleDecks().length, 1);
  await action('longpress');
  assert.equal(textShown('Choose an icon'), true);
  await click('Literature');
  assert.equal(deckById('Only talk').icon, 'book');
  assert.equal(textShown('Choose an icon'), false);
  await click('About OutLoud');
  await act(async () => assert.equal(pressBack(), true));
  assert.equal(routes.length, 0);
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
function extractedText(method) {
  const deckFields = { id: serverId, page_count: 7 };
  const slides = [{ slide_index: 0, extracted_text: 'Recovered slide title' }];
  return method === 'POST' ? response(201, { deck: deckFields, slides }) : response(200, { ...deckFields, slides });
}

test('upload saves an offline deck, opens rehearsal, and recovers slide text when the API returns', async () => {
  const { routes, home } = await mount(UploadScreen);
  await click('Choose a PDF to upload');
  assert.equal(textShown('Tap the icon to upload'), true);
  await choosePdf('Offline talk');
  network.respond = async () => { throw new Error('Offline fixture'); };
  await click('Choose a PDF to upload');
  await waitFor(() => renderer.root.findAllByType('requirements').length === 1);
  const saved = visibleDecks()[0];
  assert.equal(saved.text, 'pending');
  assert.equal(saved.pages.length, 7);
  assert.equal(defaultRequirementsPending(saved.id, API_URL), true);
  await act(async () => renderer.root.findByType('requirements').props.onSaved());
  assert.deepEqual(routes, [['rehearse', { nav: 'fade', deckId: saved.id, slide: 0 }]]);
  assert.equal(home.uploadBlur.value, 0);
  network.respond = async (_url, init) => extractedText(init.method);
  await ensureSlideText(saved.id);
  assert.equal(deckById(saved.id).slides[0].text, 'Recovered slide title');
  assert.equal(deckById(saved.id).text, 'ready');
});

test('upload reports a failed render and lets the user leave without a saved deck', async () => {
  const { routes } = await mount(UploadScreen);
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
