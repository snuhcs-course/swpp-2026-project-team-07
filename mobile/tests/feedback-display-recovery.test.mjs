import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { resolve, load } from './helpers/qa-screen-runtime-loader.mjs';

registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { setAppLanguage } = await import('../src/design/language.ts');
const { useDisplayTranslation, displayTranslations } = await import('../src/features/localization/useDisplayTranslation.ts');
const { translatedV3, translatedProfile } = await import('../src/features/localization/generatedProse.ts');
const { parseFeedbackRun } = await import('../src/features/feedback/feedbackRun.ts');
const { koreanText } = await import('../src/design/koreanText.ts');
const { rubricWording } = await import('../src/features/localization/rubricWording.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('a cold offline result withholds foreign coaching, then renders a prepared pair without a flag request', async () => {
  const title = 'Compare the baseline rates for these groups';
  const cue = 'Show the baseline for both groups.';
  const feedback = { kind: 'feedback', resource_id: 'c4570eab-1483-423f-a942-77c2ee578b29', fields: { 'whole.top_priorities.0.title': title } };
  const cues = { kind: 'profiles', resource_id: 'e2f59cb6-e3a4-4250-991e-fe00c09cd413', revision: '1', fields: { 'slides.1.must_cover.0.text': cue } };
  const korean = ['두 집단의 기준 비율을 비교하세요', '두 집단의 기준값을 보여 주세요.'];
  const whole = { language: 'en', top_priorities: [{ title }] };
  const profile = { slide_index: 1, must_cover: [{ text: cue }], go_deeper: [] };
  function SavedResult() {
    const { value } = useDisplayTranslation(true, scope => ({
      feedback: translatedV3(whole, scope('feedback', feedback.resource_id), 'whole'),
      cues: translatedProfile(profile, scope('profiles', cues.resource_id, cues.revision)),
    }));
    return React.createElement('card', { title: value.feedback.top_priorities[0].title, cue: value.cues.must_cover[0].text });
  }

  const originalFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); throw Error('offline'); };
  let renderer;
  const content = () => {
    const { title, cue } = renderer.root.findByType('card').props;
    return [title, cue];
  };
  try {
    setAppLanguage('ko');
    await act(async () => { renderer = create(React.createElement(SavedResult)); });
    assert.deepEqual(content(), ['한국어 피드백 동기화 대기 중', '한국어 도움말 동기화 대기 중']);
    await act(async () => displayTranslations.block({ ...cues, language: 'ko' }, cues.fields));
    assert.deepEqual(content(), ['한국어 피드백 동기화 대기 중', '이 도움말의 한국어 버전을 불러올 수 없어요.']);
    await act(async () => {
      for (const [index, result] of [feedback, cues].entries()) {
        const [[path, source]] = Object.entries(result.fields);
        displayTranslations.install(result, { [path]: { source, en: source, ko: korean[index] } }, 'ko');
      }
    });
    assert.deepEqual(content(), korean);
    const afterSync = calls.length;
    await act(async () => setAppLanguage('en'));
    assert.deepEqual(content(), [title, cue]);
    await act(async () => setAppLanguage('ko'));
    assert.deepEqual(content(), korean);
    assert.equal(calls.length, afterSync);
    assert.ok(calls.every(url => url.endsWith('/localization/')));
    assert.equal(whole.top_priorities[0].title, title);
    assert.equal(profile.must_cover[0].text, cue);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    setAppLanguage('en');
    globalThis.fetch = originalFetch;
  }
});

test('slide review facts and fixed rubric wording are available offline on the first render', () => {
  assert.equal(koreanText('0:16 of 1:31 planned'), '목표 1:31 중 0:16');
  assert.equal(koreanText('1 of 1 points said'), '핵심 1개 중 1개 언급');
  assert.equal(koreanText('— of 3 points said'), '핵심 3개 중 —개 언급');
  assert.equal(koreanText('— fillers'), '습관어 —회');
  assert.equal(koreanText('EXPLANATION DEPTH'), '설명의 깊이');
  const anchor = 'Important relationships remain unclear';
  assert.equal(rubricWording('feedback', 'slides.1.criteria.0.anchor', anchor, 'ko'), '중요한 내용들이 서로 어떻게 연결되는지 분명하지 않아요.');
  assert.equal(rubricWording('feedback', 'slides.1.criteria.0.anchor', anchor, 'en'), anchor);
  assert.equal(rubricWording('feedback', 'slides.1.criteria.0.reason', anchor, 'ko'), null);
  assert.equal(rubricWording('feedback', 'slides.1.criteria.0.anchor', 'A future rubric anchor', 'ko'), null);
});

test('a mixed-language capture uses the saved language for each graded part and the rubric language for its labels', () => {
  const capture = parseFeedbackRun({ status: 'completed', slides: [{ slide_index: 0, status: 'scored', language: 'ko',
    criteria: [{ id: 'clarity', label: 'Clarity', reason: '비교 결과', next_level: '기준 설명' }] }],
    whole: { status: 'scored', language: 'en', summary: 'Baseline comparison' } });
  const hints = new Map();
  const field = (_path, value, language) => { hints.set(value, language); return value; };
  translatedV3(capture.slides[0], field, 'slides.0');
  translatedV3(capture.whole, field, 'whole');
  assert.equal(hints.get('Baseline comparison'), 'en');
  assert.equal(hints.get('비교 결과'), 'ko');
  assert.equal(hints.get('Clarity'), 'en');
  const old = parseFeedbackRun({ status: 'completed', whole: { status: 'scored', language: 'invalid' } });
  assert.equal(old.whole.language, undefined);
});
