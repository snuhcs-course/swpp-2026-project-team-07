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
const { serverSlides, serverPdfUnconfirmed } = await import('../src/features/presentations/serverDeck.ts');
const { defaultRequirementsPending } = await import('../src/features/presentations/defaultRequirements.ts');
const { API_URL } = await import('../src/services/api.ts');
const { readStored, writeStored, removeStored } = await import('../src/services/storage.ts');
// Claude prototype guide integrated by OpenAI Codex, Iteration 4 (2026-11-21): skip first-run overlay in older Home tests.
const { TUTORIAL_SEEN, TUTORIAL_PAGES } = await import('../src/screens/HomeTutorial.tsx');
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
function extractedText(method) {
  const deckFields = { id: serverId, page_count: 7 };
  const slides = [{ slide_index: 0, extracted_text: 'Recovered slide title' }];
  return method === 'POST' ? response(201, { deck: deckFields, slides }) : response(200, { ...deckFields, slides });
}

// OpenAI Codex, 2026-11-21: an offline POST with an unknown outcome needs an explicit refresh before upload replay.
test('upload saves an offline deck and refresh explicitly recovers slide text when the API returns', async () => {
  const { routes, home } = await mount(UploadScreen);
  await click('Choose a PDF to upload');
  assert.equal(textShown('Tap the icon to upload · PDF · up to 50 MB'), true);
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
  const before = network.requests.length;
  await ensureSlideText(saved.id);
  assert.equal(serverPdfUnconfirmed(saved.id, API_URL), true);
  assert.equal(network.requests.length, before, 'automatic recovery cannot repeat an unconfirmed upload');
  await serverSlides({ id: saved.id, title: saved.title, uri: saved.uri, pageCount: saved.pageCount }, API_URL, undefined, 300000, true);
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

// OpenAI Codex integrated supplied regression: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const hostParent = node => { let p = node.parent; while (p && typeof p.type !== 'string') p = p.parent; return p; };

test('analysis ring is centred on the shrunk New presentation icon and the stages are centred below it', async () => {
  const { analyzeRing } = await import('../src/screens/homeGeometry.ts');
  const ringAt = analyzeRing(false);
  const compactRing = analyzeRing(true);
  assert.ok(Math.abs(compactRing.cy - 352.16) < 0.01);
  assert.ok(Math.abs(compactRing.r - 60.8) < 0.01);
  assert.ok(Math.abs(compactRing.bottom - ringAt.bottom) < 0.01);
  // Where Home actually draws the icon while a PDF is analysed.
  const home = Object.fromEntries(['p', 'vy', 'gap', 'hold', 'uploadBlur', 'analyzing', 'setup', 'press', 'picker']
    .map(key => [key, box(['press', 'uploadBlur', 'analyzing'].includes(key) ? 1 : 0)]));
  await act(async () => { renderer = create(h(HomeContext.Provider, { value: { home, go: () => {}, nav: { nav: null } } },
    h(HomeScreen, { mode: 'upload', uploadLook: { hue: 'violet', order: 1 } }))); });
  const ghost = renderer.root.find(n => typeof n.type === 'string' && flat(n.props.style).zIndex === 300);
  const slot = flat(ghost.props.style), layer = flat(hostParent(ghost).props.style);
  const [{ translateY }, { scale }] = slot.transform;
  const item = ghost.find(n => typeof n.type === 'string' && flat(n.props.style).height === 223);
  const size = ghost.findAll(n => n.props.icon === 'present' && typeof n.props.size === 'number')[0].props.size;
  const top = layer.top + slot.top, mid = top + slot.height / 2;
  const drawn = mid + (top + flat(item.props.style).height - size / 2 - mid) * scale + translateY;
  assert.ok(Math.abs(drawn - ringAt.cy) < 0.01, `icon centre ${drawn} vs ring centre ${ringAt.cy}`);
  assert.equal(ghost.findAll(n => typeof n.type === 'string' && flat(n.props.style).opacity === 0).length > 0, true, 'floor shadow hidden');
  await act(async () => renderer.unmount());

  await mount(UploadScreen);
  await choosePdf('Centred talk');
  network.respond = async () => { throw new Error('Offline fixture'); };
  await click('Choose a PDF to upload');
  await waitFor(() => renderer.root.findAllByType('requirements').length === 1);
  const arc = renderer.root.find(n => n.type === 'circle' && n.props.stroke === 'url(#gMultiUp)');
  const svg = renderer.root.find(n => n.type === 'svg' && n.findAll(c => c === arc).length === 1);
  assert.equal(arc.props.r, ringAt.r);
  assert.ok(Math.abs(flat(hostParent(svg).props.style).top + svg.props.height / 2 - ringAt.cy) < 0.01);
  const stages = flat(renderer.root.findByProps({ accessibilityLiveRegion: 'polite' }).props.style);
  assert.deepEqual([stages.top, stages.bottom, stages.justifyContent, stages.alignItems], [ringAt.bottom, 0, 'center', 'center']);
  assert.equal(renderer.root.findByProps({ accessibilityLiveRegion: 'polite' }).props.pointerEvents, 'box-none');
});

// OpenAI Codex, Iteration 4 (2026-11-21): first-run prototype guide and its native swipe stay usable on the bilingual branch.
test('the guide opens once, walks eight pages and responds to native page swipes', async () => {
  removeStored(TUTORIAL_SEEN);
  savePresentation(deck('Tour talk', 1));
  await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.equal(TUTORIAL_PAGES.length, 8);
  assert.equal(textShown('1 of 8 · Gestures'), true);
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
  await click('Got it');
  assert.equal(readStored(TUTORIAL_SEEN), true);
  await act(async () => renderer.unmount()); renderer = undefined;
  await mount(HomeScreen, { mode: 'home', uploadLook: null });
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
  await click('How OutLoud works');
  assert.equal(textShown('1 of 8 · Gestures'), true);
  await act(async () => assert.equal(pressBack(), true));
  assert.equal(renderer.root.findAllByProps({ accessibilityLabel: 'Close tutorial' }).length, 0);
});
