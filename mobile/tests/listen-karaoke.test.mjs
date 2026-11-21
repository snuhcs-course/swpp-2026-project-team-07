// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-21): Listen back word-by-word karaoke.
// Synthetic transcript and run data; only the native player and rendering boundaries are stubbed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/ai-overview-screen-loader.mjs';
registerHooks({ resolve, load });
const k = await import('../src/domain/karaoke.ts');
const { listenTimeline } = await import('../src/domain/listenTimeline.ts');
const { ListenBackKaraokeScreen } = await import('../src/screens/ListenBackKaraokeScreen.tsx');
const { DARK_PALETTE, LIGHT_PALETTE } = await import('../src/design/tokens.ts');
const { runtime } = await import('./helpers/ai-overview-screen-native.mjs');
const React = await import('react');
const { act, create } = await import('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
runtime.palettes = { dark: DARK_PALETTE, light: LIGHT_PALETTE };
const c = DARK_PALETTE;

const w = (text, start, end) => ({ text, start_ms: start, end_ms: end });
const SHORT = { text: 'So, um, the river divides the city.', words: [w('So', 500, 700), w('um', 800, 1000), w('the', 1300, 1450),
  w('river', 1450, 1800), w('divides', 1800, 2300), w('the', 2300, 2400), w('city', 2400, 2900)] };
const LONG_WORDS = 'and in this case we can see a coffee shop in a former warehouse where they often keep the exposed brick and the steel beams as part of the interior today'.split(' ');
const LONG = { text: LONG_WORDS.join(' ') + '.', words: LONG_WORDS.map((text, i) => w(text, 6100 + i * 180, 6100 + i * 180 + 150)) };
const line = (slide, value) => ({ key: `a#${value.words[0].start_ms}`, slide, t: value.words[0].start_ms / 1000, rel: 0, text: value.text, flags: [],
  words: value.words, audio: { attemptId: 'a', startMs: value.words[0].start_ms, endMs: value.words.at(-1).end_ms } });
const part = (attemptId, ...ranges) => ({ attemptId, segments: ranges.map(([startMs, endMs]) => ({ startMs, endMs })) });
const run = { id: 'run', parts: [part('a', [0, 6000]), part('a', [6000, 12000])] };

test('tokens keep the spoken punctuation with the word before it, and fillers are marked', () => {
  const tokens = k.lineTokens(SHORT);
  assert.deepEqual(tokens.map(t => t.text), ['So, ', 'um, ', 'the ', 'river ', 'divides ', 'the ', 'city.']);
  assert.deepEqual(tokens.map(t => t.filler), [false, true, false, false, false, false, false]);
  // Text that no longer matches the timed words falls back to the words themselves.
  assert.deepEqual(k.lineTokens({ text: 'Something else entirely', words: [w('you', 0, 100), w('know', 100, 200), w(',', 200, 200)] }).map(t => [t.text, t.filler]),
    [['you ', true], ['know', true], [',', false]]);
});

test('pages split a long line into about equal parts that each fit four rows; short lines stay whole', () => {
  const short = k.pageTokens(k.lineTokens(SHORT));
  assert.equal(short.length, 1);
  const pages = k.pageTokens(k.lineTokens(LONG));
  assert.ok(pages.length >= 2);
  const widths = pages.map(p => k.textEm(p.map(t => t.text).join('')));
  for (const width of widths) assert.ok(width <= k.PAGE_EM, `page of ${width} em`);
  assert.ok(Math.max(...widths) - Math.min(...widths) < 8, 'pages are balanced, not one full page and a stub');
  assert.equal(pages.flat().length, LONG_WORDS.length, 'no word is lost or repeated');
  assert.ok(Math.abs(k.textEm('가나다라') - 4 * 0.989) < 1e-9, 'Hangul counts about 1 em a character');
  const giant = k.pageTokens([{ text: 'x'.repeat(80), word: w('x', 0, 1), filler: false }, { text: 'y', word: w('y', 1, 2), filler: false }]);
  assert.deepEqual(giant.map(p => p.length), [1, 1], 'a word wider than a page gets a page of its own');
});

test('the lit word is the last one that has started, held through pauses; untimed words never light', () => {
  const tokens = k.lineTokens(SHORT);
  assert.equal(k.activeWord(tokens, 499), -1);
  assert.equal(k.activeWord(tokens, 500), 0);
  assert.equal(k.activeWord(tokens, 1000), 1, 'end of "um"');
  assert.equal(k.activeWord(tokens, 1299), 1, 'the pause before "the" keeps "um" lit');
  assert.equal(k.activeWord(tokens, 1450), 3, 'a word starting where another ends takes over at its start');
  assert.equal(k.activeWord(tokens, 99999), 6, 'the last word stays lit until the next page starts');
  const odd = [{ text: 'a ', word: w('a', 100, 100), filler: false }, { text: 'b ', word: w('b', Number.NaN, 300), filler: false }, { text: 'c', word: w('c', 400, 500), filler: false }];
  assert.equal(k.activeWord(odd, 350), 0, 'a zero-length word lights; a word without a start is skipped');
  assert.deepEqual([0, 1, 2].map(i => k.wordState(i, 1)), ['spoken', 'current', 'upcoming']);
  assert.deepEqual([0, 1].map(i => k.wordState(i, -1)), ['upcoming', 'upcoming']);
  assert.equal(k.wordState(0, null), 'plain');
});

test('one clock: run seconds map to a take and back, and pages are picked inside the playing visit', () => {
  const lines = [line(0, SHORT), line(1, LONG)];
  const { visits } = listenTimeline(run, [6, 6], lines);
  assert.deepEqual(k.sourceAt(1.6, visits), { attemptId: 'a', ms: 1600, visit: visits[0] });
  assert.equal(k.runSecondsAt('a', 6100, visits), 6.1);
  assert.equal(k.runSecondsAt('a', 12000, visits), null, 'the end of the last visit is outside it');
  const pages = k.karaokePages(lines);
  assert.deepEqual(k.pageAt(k.sourceAt(0.2, visits), pages), { index: 0, word: -1 }, 'before the first word: its page, nothing lit');
  assert.deepEqual(k.pageAt(k.sourceAt(1.6, visits), pages), { index: 0, word: 3 });
  assert.equal(k.pageAt(k.sourceAt(5.9, visits), pages).index, 0, 'the pause after a line keeps it on screen');
  const last = k.pageAt(k.sourceAt(11.9, visits), pages);
  assert.equal(last.index, pages.length - 1);
  assert.equal(last.word, pages.at(-1).tokens.length - 1);
  const silent = listenTimeline({ parts: [part('a', [0, 6000]), part('a', [20000, 26000])] }, [6, 6], lines).visits;
  assert.equal(k.pageAt(k.sourceAt(7, silent), pages), null, 'a visit with no words has no page');
  assert.equal(k.wordSeekMs(w('x', 1800, 2000), { startMs: 0, endMs: 6000 }), 1680);
  assert.equal(k.wordSeekMs(w('x', 6050, 6100), { startMs: 6000, endMs: 12000 }), 6000, 'pre-roll never reaches into the previous visit');
});

function setup() {
  runtime.theme = 'dark'; runtime.frameHeight = 844; runtime.frameCompact = false;
  runtime.nav = { deckId: 'deck', sel: 0, from: 'full', nav: null };
  runtime.routes = []; runtime.players = []; runtime.plays = []; runtime.audio = new Map([['a', 'file:///run.m4a']]);
  runtime.model = { deck: { id: 'deck', hue: 'lilac', slides: [{ title: 'River' }, { title: 'Warehouse' }] },
    state: { run }, times: [6, 6], total: 12, lines: [line(0, SHORT), line(1, LONG)], pending: false };
}
async function render(work) {
  let r;
  try { await act(async () => { r = create(React.createElement(ListenBackKaraokeScreen)); }); await work(r); }
  finally { if (r) await act(async () => r.unmount()); }
}
const button = (r, label) => r.root.findAllByType('pressable').find(node => node.props.accessibilityLabel === label);
const karaoke = r => r.root.findAll(node => node.type === 'text' && node.props.accessibilityHint === 'Tap a word to play from it')[0];
const words = r => karaoke(r).findAll(node => node.type === 'text' && node !== karaoke(r));
const word = (r, text) => words(r).find(node => node.props.children === text);
async function at(r, milliseconds) {
  runtime.players[0].elapsedMs = milliseconds;
  await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
}

test('playing lights words one by one: spoken in text colour, the current word in accent, the rest dimmed; size never changes', async () => {
  setup(); await render(async r => {
    assert.ok(words(r).every(n => n.props.style.color === c.text || n.props.style.color === c.warn), 'before Play every word is plain');
    await act(async () => button(r, 'Play whole run').props.onPress());
    await at(r, 1600);
    assert.deepEqual(words(r).map(n => n.props.style.color), [c.text, c.warn, c.text, c.accent, c.ink45, c.ink45, c.ink45]);
    assert.equal(word(r, 'um,').props.style.textDecorationLine, 'underline');
    assert.ok(words(r).every(n => n.props.style.fontFamily === undefined && n.props.style.fontSize === undefined), 'only colour changes per word');
    await at(r, 1200);
    assert.equal(word(r, 'um,').props.style.backgroundColor, `${c.warn}2E`, 'a current filler keeps amber and gets a tint');
    await at(r, 300);
    assert.equal(word(r, 'um,').props.style.color, `${c.warn}8C`, 'an upcoming filler is dimmed amber');
    await act(async () => button(r, 'Pause whole run').props.onPress());
    await at(r, 1600);
    assert.equal(word(r, 'river').props.style.color, c.accent, 'paused keeps the highlight where it stopped');
  });
});

test('a long line turns its page when the lit word reaches the next page; context shows the neighbouring pages', async () => {
  setup(); await render(async r => {
    const pages = k.karaokePages(runtime.model.lines);
    await act(async () => button(r, 'Play whole run').props.onPress());
    await at(r, 6100);
    assert.equal(karaoke(r).props.accessibilityLabel, pages[1].text);
    assert.ok(r.root.findAllByType('text').some(n => n.props.children === SHORT.text), 'previous line above');
    assert.ok(r.root.findAllByType('text').some(n => n.props.children === pages[2].text), 'next page below');
    await at(r, pages[2].startMs);
    assert.equal(karaoke(r).props.accessibilityLabel, pages[2].text);
    assert.equal(words(r)[0].props.style.color, c.accent);
    assert.ok(r.root.findAllByType('text').some(n => n.props.children === pages[1].text), 'the page just played moves up as context');
    assert.match(JSON.stringify(r.toJSON()), /Slide 2 · Warehouse/);
  });
});

test('tapping a word plays from 120 ms before it; scrubbing previews the highlight; Play after the end restarts', async () => {
  setup(); await render(async r => {
    await act(async () => word(r, 'divides').props.onPress());
    assert.equal(Math.round(runtime.plays.at(-1).elapsedMs), 1680);
    assert.equal(runtime.plays.at(-1).paused, false);
  });
  setup(); await render(async r => {
    const scrubber = r.root.findByProps({ accessibilityLabel: 'Run audio position' });
    await act(async () => scrubber.props.onGrant({ nativeEvent: { pageX: 24 + 342 * 1.6 / 12 } }));
    assert.equal(word(r, 'river').props.style.color, c.accent, 'the lit word follows the finger before playback starts');
    await act(async () => r.root.findByProps({ accessibilityLabel: 'Run audio position' }).props.onRelease());
    assert.equal(Math.round(runtime.plays.at(-1).elapsedMs), 1600);
  });
  setup(); await render(async r => {
    await act(async () => button(r, 'Play whole run').props.onPress());
    await at(r, 11900);
    Object.assign(runtime.players[0], { playingKey: null, ends: 1 });
    await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
    const pages = k.karaokePages(runtime.model.lines);
    assert.equal(karaoke(r).props.accessibilityLabel, pages.at(-1).text, 'the last words stay on screen after the run ends');
    assert.equal(r.root.findByProps({ accessibilityLabel: 'Run audio position' }).props.accessibilityValue.now, 12);
    await act(async () => button(r, 'Play whole run').props.onPress());
    assert.equal(runtime.plays.at(-1).elapsedMs, 0, 'Play at the end starts again from the beginning');
  });
  // OpenAI Codex, 2026-11-21: exact-end seeks retain an at-end player key, unlike natural completion.
  setup(); await render(async r => {
    const scrubber = r.root.findByProps({ accessibilityLabel: 'Run audio position' });
    await act(async () => scrubber.props.onGrant({ nativeEvent: { pageX: 366 } }));
    await act(async () => scrubber.props.onRelease());
    assert.equal(runtime.plays.at(-1).elapsedMs, 12000);
    runtime.players[0].paused = true; // The real player marks an exact-end seek paused.
    await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
    await act(async () => button(r, 'Play whole run').props.onPress());
    assert.equal(runtime.plays.at(-1).elapsedMs, 0, 'Play after an exact-end scrub restarts the run');
  });
});

test('natural completion does not mark a missing final take as heard', async () => {
  setup();
  const second = line(1, LONG);
  second.audio = { ...second.audio, attemptId: 'b' };
  runtime.model.state.run = { id: 'run', parts: [part('a', [0, 6000]), part('b', [6000, 12000])] };
  runtime.model.lines = [line(0, SHORT), second];
  runtime.audio.delete('b');
  await render(async r => {
    await act(async () => button(r, 'Play whole run').props.onPress());
    assert.equal(runtime.plays[0].segments.length, 1);
    Object.assign(runtime.players[0], { playingKey: null, ends: 1 });
    await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
    assert.equal(karaoke(r).props.accessibilityLabel, SHORT.text, 'last heard words stay on screen');
    assert.ok(r.root.findByProps({ accessibilityLabel: 'Run audio position' }).props.accessibilityValue.now < 6.01,
      'the missing final slide is not shown as played');
    await act(async () => button(r, 'Play whole run').props.onPress());
    assert.equal(runtime.plays.at(-1).elapsedMs, 0, 'Play restarts the available audio');
  });
});

test('Play after an exact-end seek restarts at the first available take when the opening audio is missing', async () => {
  setup();
  const second = line(1, LONG);
  second.audio = { ...second.audio, attemptId: 'b' };
  runtime.model.state.run = { id: 'run', parts: [part('a', [0, 6000]), part('b', [6000, 12000])] };
  runtime.model.lines = [line(0, SHORT), second];
  runtime.audio = new Map([['b', 'file:///second.m4a']]);
  await render(async r => {
    const scrubber = r.root.findByProps({ accessibilityLabel: 'Run audio position' });
    await act(async () => scrubber.props.onGrant({ nativeEvent: { pageX: 366 } }));
    await act(async () => scrubber.props.onRelease());
    runtime.players[0].paused = true;
    await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
    await act(async () => button(r, 'Play whole run').props.onPress());
    assert.equal(runtime.plays.at(-1).elapsedMs, 0);
    assert.match(JSON.stringify(r.toJSON()), /Slide 2 · Warehouse/);
  });
});

// OpenAI Codex, 2026-11-21: vertical transcript browsing is a stable preview; slide arrows alone skip slides.
test('vertical transcript swipes browse without playback, word tap plays, and outside swipe still returns to review', async () => {
  setup(); await render(async r => {
    const pages = k.karaokePages(runtime.model.lines);
    const area = () => r.root.findByProps({ testID: 'listenTranscriptTouchArea' });
    const screenPan = r.root.findAllByType('pan')[0];
    assert.equal(screenPan.props.onMoveShouldCapture({}, { y0: 300, dy: 100, dx: 0 }), false,
      'a transcript drag stays in the transcript');
    assert.equal(screenPan.props.onMoveShouldCapture({}, { y0: 550, dy: 100, dx: 0 }), true,
      'a downward drag outside the transcript can leave even if a control holds the touch');
    await act(async () => { area().props.onTouchStart({ nativeEvent: { pageX: 180, pageY: 300 } });
      area().props.onTouchEnd({ nativeEvent: { pageX: 180, pageY: 210 } }); });
    assert.equal(karaoke(r).props.accessibilityLabel, pages[1].text);
    assert.equal(runtime.plays.length, 0, 'browsing never starts audio');
    await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
    assert.equal(karaoke(r).props.accessibilityLabel, pages[1].text, 'the chosen section stays put');
    await act(async () => { area().props.onTouchStart({ nativeEvent: { pageX: 180, pageY: 300 } });
      area().props.onTouchEnd({ nativeEvent: { pageX: 180, pageY: 390 } }); });
    assert.equal(karaoke(r).props.accessibilityLabel, pages[0].text, 'swipe down browses the previous section');
    assert.equal(runtime.routes.length, 0, 'browsing does not navigate away');
    await act(async () => word(r, 'divides').props.onPress());
    assert.equal(Math.round(runtime.plays.at(-1).elapsedMs), 1680, 'tapping the chosen word starts its replay');
    await act(async () => { area().props.onTouchStart({ nativeEvent: { pageX: 180, pageY: 550 } });
      area().props.onTouchEnd({ nativeEvent: { pageX: 90, pageY: 550 } }); });
    assert.equal(runtime.routes.length, 0, 'horizontal swipe cannot skip slides or leave the screen');
    await act(async () => { area().props.onTouchStart({ nativeEvent: { pageX: 180, pageY: 550 } });
      area().props.onTouchMove({ nativeEvent: { pageX: 180, pageY: 660 } });
      area().props.onTouchEnd({ nativeEvent: { pageX: 180, pageY: 670 } }); });
    assert.equal(runtime.routes.at(-1)[0], 'full', 'downward swipe outside transcript keeps the back route');
  });
});
