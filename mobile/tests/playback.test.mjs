import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeWordIndex, transcriptSpans } from '../src/features/transcription/playback.ts';
import { savedWhisperTranscript } from '../src/fixtures/whisperTranscript.ts';
const words = [{ text: 'a', start_ms: 100, end_ms: 200 }, { text: 'b', start_ms: 200, end_ms: 300 }, { text: 'c', start_ms: 400, end_ms: 400 }];
test('highlight follows half-open word intervals, gaps and end', () => {
  assert.deepEqual([0,100,199,200,299,300,400,500].map(t => activeWordIndex(words,t)), [-1,0,0,1,1,-1,-1,-1]);
  assert.equal(activeWordIndex(words, NaN), -1);
});
test('seeking backwards recomputes the active word without a ticking timer', () => {
  assert.equal(activeWordIndex(words,250),1); assert.equal(activeWordIndex(words,150),0);
});
test('saved transcript spans retain every character and map all 38 words', () => {
  const spans=transcriptSpans(savedWhisperTranscript);
  assert.equal(spans.map(s=>s.text).join(''),savedWhisperTranscript.text);
  assert.equal(spans.filter(s=>s.wordIndex!==null).length,38);
  for(const span of spans.filter(s=>s.wordIndex!==null)) assert.equal(span.text,savedWhisperTranscript.words[span.wordIndex].text);
});
test('repeated tokens map sequentially and unmatched text stays readable', () => {
  assert.deepEqual(transcriptSpans({text:'Hi, Hi!',words:[{text:'Hi'},{text:'Hi'}]}).map(s=>s.text),['Hi',', ','Hi','!']);
  assert.deepEqual(transcriptSpans({text:'Original.',words:[{text:'mismatch'}]}),[{text:'Original.',wordIndex:null}]);
});
for (const [text, tokens] of [
  ['We restart.', ['We', 'start']],
  ['We restarted.', ['We', 'restart']],
  ['We really restart.', ['We', 'restart']],
  ['First we restart.', ['we', 'restart']],
  ['We restart again.', ['We', 'restart']],
  ['Echo Echo', ['Echo']],
  ['발표를 시작합니다.', ['발표', '시작합니다']],
]) {
  test(`mismatched or omitted transcript tokens stay entirely plain: ${text}`, () => {
    assert.deepEqual(transcriptSpans({ text, words: tokens.map(text => ({ text })) }), [{ text, wordIndex: null }]);
  });
}
test('exact English/Korean tokens preserve punctuation, repeated words and whitespace', () => {
  for (const [text, tokens] of [
    [' \t“We, we can’t restart!”\n', ['We', 'we', 'can’t', 'restart']],
    ['안녕하세요?\n 발표를\t시작합니다.  ', ['안녕하세요', '발표를', '시작합니다']],
    ['Hello,\n안녕! ', [' Hello,', '안녕! ']],
  ]) {
    const spans = transcriptSpans({ text, words: tokens.map(text => ({ text })) });
    assert.equal(spans.map(s => s.text).join(''), text);
    assert.deepEqual(spans.filter(s => s.wordIndex !== null).map(s => s.wordIndex), tokens.map((_, i) => i));
  }
});
test('a newer pause/source change/navigation cancels pending replay', async () => {
  const { resumeAfterSeek } = await import('../src/features/transcription/playback.ts');
  let finishSeek;
  let current = true;
  let plays = 0;
  const done = resumeAfterSeek(() => new Promise(resolve => { finishSeek = resolve; }), () => current, () => plays++);
  current = false;
  finishSeek();
  await done;
  assert.equal(plays, 0);
});
test('replay starts only after successful seek; failed seek never plays', async () => {
  const { resumeAfterSeek } = await import('../src/features/transcription/playback.ts');
  const events = [];
  await resumeAfterSeek(async () => { events.push('seek'); }, () => true, () => events.push('play'));
  assert.deepEqual(events, ['seek', 'play']);
  await assert.rejects(resumeAfterSeek(async () => { throw Error('seek failed'); }, () => true, () => events.push('bad play')));
  assert.deepEqual(events, ['seek', 'play']);
});

const { activeVisitIndex, recordedVisits, seekableWord, createPlaybackController } = await import('../src/features/transcription/playback.ts');
test('chronological repeated/backward and zero-duration visits retain half-open boundaries and final page', () => {
  const visits = recordedVisits([{ slide_index: 0, at_ms: 0 }, { slide_index: 2, at_ms: 100 }, { slide_index: 1, at_ms: 100 }, { slide_index: 0, at_ms: 300 }], 500);
  assert.equal(visits.length, 4); assert.equal(visits[1].start_ms, visits[1].end_ms);
  assert.deepEqual([0, 99, 100, 299, 300, 500, 499, 10].map(ms => activeVisitIndex(visits, ms)), [0, 0, 2, 2, 3, 3, 3, 0]);
  assert.deepEqual(visits.map(v => v.words), [[], [], [], []]);
});
test('out-of-range and zero-length words remain readable but cannot highlight or seek', () => {
  const words = [{ text: 'past', start_ms: 99, end_ms: 201 }, { text: 'zero', start_ms: 50, end_ms: 50 }];
  assert.equal(activeWordIndex(words, 100, 200), -1);
  assert.ok(words.every(w => !seekableWord(w, 200)));
  assert.equal(transcriptSpans({ text: 'past, zero!\n', words }).map(x => x.text).join(''), 'past, zero!\n');
});
function controllerFixture() {
  const events = [], pending = [];
  const control = createPlaybackController({ pause() { events.push('pause'); }, play() { events.push('play'); },
    seekTo(t) { events.push(t); return new Promise((resolve, reject) => pending.push({ resolve, reject })); },
  }, () => {}, () => events.push('error'));
  control.activate(); return { control, events, pending };
}
const flush = () => new Promise(setImmediate);
test('rapid newer seeks supersede queued targets, preserve playing intent, and paused seeks stay paused', async () => {
  const { control, events, pending } = controllerFixture();
  control.play(0, 10000); control.seek(1000, 10000); control.seek(2000, 10000); control.seek(3000, 10000);
  assert.equal(pending.length, 1); pending[0].resolve(); await flush();
  assert.deepEqual(events.filter(x => typeof x === 'number'), [1, 3]); assert.equal(events.filter(x => x === 'play').length, 1);
  pending[1].resolve(); await flush(); assert.equal(events.at(-1), 'play');
  control.pause(); control.seek(5000, 10000); pending[2].resolve(); await flush();
  assert.equal(events.filter(x => x === 'play').length, 2);
});
test('pause while native seek is pending and background/return invalidate resume', async () => {
  const { control, events, pending } = controllerFixture();
  control.play(0, 10000); control.seek(4000, 10000); control.pause(); pending[0].resolve(); await flush();
  assert.equal(events.filter(x => x === 'play').length, 1);
  control.play(4000, 10000); control.seek(6000, 10000); control.deactivate(); control.activate(); pending[1].resolve(); await flush();
  assert.equal(events.filter(x => x === 'play').length, 2);
  assert.equal(control.isPlaying(), false);
});
test('foreground reasserts pause if the Android host resumed before the JS lifecycle callback', () => {
  let nativePlaying = false;
  const control = createPlaybackController({ play() { nativePlaying = true; }, pause() { nativePlaying = false; }, async seekTo() {} }, () => {}, () => {});
  control.activate(); control.play(1000, 10000); control.deactivate();
  nativePlaying = true; // Expo Android's host-foreground callback can resume before AppState.
  control.activate();
  assert.equal(nativePlaying, false); assert.equal(control.isPlaying(), false);
});
test('failed or disposed seeks cannot resume old native players', async () => {
  const { control, events, pending } = controllerFixture();
  control.play(10000, 10000); pending[0].reject(Error('native failure')); await flush();
  assert.equal(events.filter(x => x === 'play').length, 0); assert.ok(events.includes('error'));
  control.play(10000, 10000); control.dispose(); pending[1].resolve(); await flush();
  assert.equal(events.filter(x => x === 'play').length, 0);
});

test('resuming during a pending seek preserves its target instead of rewinding from the old EOF position', async () => {
  const { control, events, pending } = controllerFixture();
  control.seek(3000, 10000); control.play(10000, 10000); pending[0].resolve(); await flush();
  assert.deepEqual(events.filter(x => typeof x === 'number'), [3]); assert.equal(events.at(-1), 'play');
});
test('previous transport can leave a simultaneous boundary; instantaneous visits remain explicitly selectable', async () => {
  const { adjacentVisit } = await import('../src/features/transcription/playback.ts');
  const visits = recordedVisits([{ slide_index: 0, at_ms: 0 }, { slide_index: 2, at_ms: 100 }, { slide_index: 1, at_ms: 100 }], 200);
  assert.equal(adjacentVisit(visits, 2, -1), 0); assert.equal(adjacentVisit(visits, 0, 1), 2);
  assert.equal(activeVisitIndex(visits, visits[1].start_ms), 2); assert.equal(visits.length, 3);
});

test('EOF notifications cannot override queued or running newer seeks, but natural EOF still pauses', async () => {
  const { control, events, pending } = controllerFixture();
  control.play(0, 10000); control.seek(10000, 10000); control.seek(3000, 10000);
  control.finished(10000, 10000); assert.equal(control.isPlaying(), true);
  pending[0].resolve(); await flush();
  control.finished(10000, 10000); assert.equal(control.isPlaying(), true);
  pending[1].resolve(); await flush();
  control.finished(3000, 10000); // Late notification, fresh native position at the new target.
  assert.equal(control.isPlaying(), true); assert.equal(events.filter(x => x === 'play').length, 2);
  control.finished(10000, 10000);
  assert.equal(control.isPlaying(), false); assert.equal(events.at(-1), 'pause');
});

test('an unsuperseded seek to EOF settles paused even if its EOF event preceded seek completion', async () => {
  const { control, events, pending } = controllerFixture();
  control.play(0, 10000); control.seek(10000, 10000);
  control.finished(10000, 10000); pending[0].resolve(); await flush();
  assert.equal(control.isPlaying(), false); assert.equal(events.filter(x => x === 'play').length, 1);
  control.play(10000, 10000); pending[1].resolve(); await flush();
  assert.deepEqual(events.filter(x => typeof x === 'number'), [10, 0]);
  assert.equal(control.isPlaying(), true); assert.equal(events.filter(x => x === 'play').length, 2);
});

test('Pause between superseded EOF and newer seek completion retains the user pause', async () => {
  const { control, events, pending } = controllerFixture();
  control.play(0, 10000); control.seek(10000, 10000); control.seek(3000, 10000);
  control.finished(10000, 10000); control.pause();
  pending[0].resolve(); await flush(); pending[1].resolve(); await flush();
  assert.deepEqual(events.filter(x => typeof x === 'number'), [10, 3]);
  assert.equal(control.isPlaying(), false); assert.equal(events.filter(x => x === 'play').length, 1);
});
