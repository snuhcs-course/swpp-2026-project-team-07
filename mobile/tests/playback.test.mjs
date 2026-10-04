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

test('trimmed Whisper transcript still gives every timestamped word a seek target', () => {
  const transcript = { text: 'Hello world.', words: [{ text: ' Hello', start_ms: 0, end_ms: 500 }, { text: ' world.', start_ms: 500, end_ms: 900 }] };
  const result = transcriptSpans(transcript);
  assert.equal(result.map(s => s.text).join(''), transcript.text);
  assert.deepEqual(result.filter(s => s.wordIndex !== null).map(s => s.wordIndex), [0, 1]);
});
