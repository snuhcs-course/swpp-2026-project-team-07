import { koreanCopy } from './koreanCopy';

const ignoreCase = new Map(Object.entries(koreanCopy).map(([english, korean]) => [english.toLowerCase(), korean]));

const measurementUnits: Record<string, string> = { second: '초', seconds: '초', ms: '밀리초', words: '단어', count: '회', minute: '분', minutes: '분' };

// Match complete app-owned messages. Captured filenames, quotes, and speaking examples keep their spelling.
const patterns: [RegExp, (...parts: string[]) => string][] = [
  // Home, playback and recording controls
  [/^· (.+)$/s, label => '· ' + koreanText(label)],
  [/^slide (\d+)$/i, n => '슬라이드 ' + n],
  [/^from slide (\d+)$/i, n => '슬라이드 ' + n + '에서'],
  [/^(?:slide (\d+)|slides ([\d–-]+)|(\d+) slides) redone$/i, (one, range, count) => '슬라이드 ' + (one ?? range ?? count + '장') + ' 다시 녹음'],
  [/^Retry available after (.+)$/s, time => time + ' 이후 다시 시도할 수 있어요'],
  [/^Retry scheduled (.+)$/s, time => '재시도 예정: ' + time],
  [/^Scheduled retry is overdue \((.+)\)$/s, time => '예정된 재시도 시간이 지났어요 (' + time + ')'],
  [/^Slide description \((edited|AI generated|origin unavailable); may differ from PDF text\): ([\s\S]*)$/, (origin, quote) => '슬라이드 설명 (' + koreanText(origin) + ', PDF 원문과 다를 수 있어요): ' + quote],
  [/^(Speech: “)(.*)”$/s, (prefix, quote) => koreanText(prefix) + quote + '”'],
  [/^(Slide:|Speech evidence:) (.*)$/s, (prefix, quote) => koreanText(prefix) + ' ' + quote],
  [/^(\d+) (strengths|weaknesses|improvements)$/i, (n, type) => koreanText(type) + ' ' + n + '개'],
  [/^(strengths|weaknesses|improvements) (\d+)$/i, (type, n) => koreanText(type) + ' ' + n],
  [/^([\d.]+) %$/, value => value + '%'],
  [/^([\d.]+) (seconds?|ms|words|count|minutes?)$/i, (value, unit) => value + measurementUnits[unit.toLowerCase()]],
  [/^(.+), ([\d—]+) slides$/s, (title, n) => title + ', 슬라이드 ' + n + '장'],
  [/^Deleted “(.+)”$/s, title => '“' + title + '” 삭제됨'],
  [/^([a-z]+) colour$/, name => koreanText(name) + '색'],
  [/^(.+), current icon$/, name => koreanText(name) + ', 현재 아이콘'],
  [/^Found (\d+) slides$/, n => '슬라이드 ' + n + '장을 찾았어요'],
  [/^Open full review, presentation score (\d+) percent$/, n => '전체 검토 열기, 발표 점수 ' + n + '%'],
  [/^([\d—]+) minutes?$/, n => n + '분'],
  [/^(Record|Redo) slide (\d+)(\. Hold 1\.5 seconds to redo the whole presentation)?$/, (action, n, hold) =>
    '슬라이드 ' + n + (action === 'Redo' ? ' 다시 녹음' : ' 녹음') + (hold ? koreanText(hold) : '')],
  [/^Full run · target ([\d:]+)$/, time => '전체 발표 · 목표 ' + time],
  [/^Recording interrupted(?: (\d+) of (\d+))? · tap to inspect$/, (n, total) =>
    '녹음이 중단됐어요' + (n ? ' (' + n + ' / ' + total + ')' : '') + ' · 눌러서 확인'],
  [/^Starting in (\d+)\. Tap to cancel$/, n => n + '초 후 시작해요. 누르면 취소돼요'],
  [/^(?:Slide|slide) (\d+) of (\d+): (.*)$/s, (n, total, title) => '슬라이드 ' + n + ' / ' + total + ': ' + title],
  [/^(Next|Previous) slide, (\d+): (.*)$/s, (way, n, title) => (way === 'Next' ? '다음' : '이전') + ' 슬라이드 ' + n + ': ' + title],
  [/^Go near slide (\d+)$/, n => '슬라이드 ' + n + ' 부근으로 이동'],
  [/^Redo slide (\d+)\?$/, n => '슬라이드 ' + n + '을 다시 녹음할까요?'],
  [/^Your recording and transcript for slide (\d+) will be replaced\. This can’t be undone\.$/, n => '슬라이드 ' + n + '의 녹음과 발표 원문을 교체해요. 이 작업은 되돌릴 수 없어요.'],
  [/^Play slide (\d+), ([\d:]+)$/, (n, time) => '슬라이드 ' + n + ' 재생, ' + time],
  [/^Play slide (\d+) audio$/, n => '슬라이드 ' + n + ' 오디오 재생'],
  [/^Pause slide (\d+)$/, n => '슬라이드 ' + n + ' 일시정지'],
  [/^Play the whole run, (.+)$/, time => '발표 전체 재생, ' + time],
  [/^([\d:]+) of ([\d:]+), slide (\d+) of (\d+)$/, (t, total, n, count) => t + ' / ' + total + ', 슬라이드 ' + n + ' / ' + count],
  [/^([\d:]+) of ([\d:]+)$/, (t, total) => t + ' / ' + total],
  [/^Slides (\d+)[–-](\d+)$/, (a, b) => '슬라이드 ' + a + '–' + b],
  [/^Audio for slides? ([\d, ]+) is not on this phone\. Play only the available recordings\?$/, list => '이 휴대폰에 슬라이드 ' + list + '의 오디오가 없어요. 보관된 녹음만 재생할까요?'],
  [/^Audio for slide (\d+) (?:isn’t|is not) on this phone\.?$/, n => '이 휴대폰에 슬라이드 ' + n + '의 오디오가 없어요.'],
  [/^(\d+) slides? missing$/, n => '슬라이드 ' + n + '장 누락'],
  [/^(\d+) slides? recorded$/, n => '슬라이드 ' + n + '장 녹음'],
  [/^attempt (\d+)$/i, n => n + '번째 연습'],
  [/^new take .*stopped at slide (\d+)$/i, n => '새 녹음 · 슬라이드 ' + n + '에서 종료'],
  [/^stopped at slide (\d+)$/i, n => '슬라이드 ' + n + '에서 종료'],
  [/^([\d:]+) with transcript$/, t => '발표 원문 ' + t],
  [/^([\d:]+) (over|under)(?: target)?$/, (t, how) => '목표보다 ' + t + (how === 'over' ? ' 초과' : ' 짧음')],
  [/^([\d:]+) (faster|slower|ahead|behind)$/, (t, how) => t + (how === 'faster' || how === 'ahead' ? ' 빠름' : ' 느림')],
  [/^(\d+) (fewer|more)$/, (n, how) => n + (how === 'fewer' ? '개 감소' : '개 증가')],
  [/^(\d+(?:\.\d+)?) wpm$/i, n => '분당 ' + n + '단어'],
  [/^(\d+|—) fillers?$/, n => '습관어 ' + n + '회'],
  [/^(\d+|—) of (\d+) points? said$/, (n, total) => '핵심 ' + total + '개 중 ' + n + '개 언급'],
  [/^([\d:]+) of ([\d:]+) planned$/, (t, target) => '목표 ' + target + ' 중 ' + t],
  [/^(\d+) (with findings|partial|analyzing|outdated|needs recovery|insufficient evidence|not analyzed)$/, (n, status) => koreanText(status) + ' ' + n + '장'],
  [/^(\d+) ways? to raise your score$/, n => '점수를 높이는 방법 ' + n + '가지'],
  [/^(\d+) verified points?$/, n => '확인된 항목 ' + n + '개'],
  [/^[+]([\d.]+) pts$/i, n => '+' + n + '점'],
  [/^([\d:]+) \/ ([\d:]+) planned$/, (t, target) => t + ' / 목표 ' + target],
  [/^(\d+) points?, (.+)$/, (n, level) => n + '점, ' + koreanText(level)],
  [/^(\d+) percent$/, n => n + '%'],
  [/^Slide (\d+), (not graded|\d+ percent)$/, (n, score) => '슬라이드 ' + n + ', ' + koreanText(score)],
  [/^Open (Must cover|Further insight) cues$/, name => koreanText(name) + ' 도움말 열기'],
  [/^Read slide (\d+) feedback: (.+)$/s, (n, s) => '슬라이드 ' + n + ' 피드백 읽기: ' + koreanText(s)],
  [/^Review slide (\d+): (.+)$/s, (n, s) => '슬라이드 ' + n + ' 검토: ' + koreanText(s)],
  [/^Show issue (\d+)$/, n => n + '번째 문제 보기'],
  [/^Play the cited audio at ([\d:]+)$/, t => t + ' 근거 음성 재생'],
  [/^Hear cited evidence at ([\d:]+)$/, t => t + ' 근거 음성 듣기'],
  [/^(Hear|Pause) (.+) at ([\d:]+)$/, (action, label, time) => koreanText(label) + ' ' + time + ' ' + (action === 'Hear' ? '듣기' : '일시정지')],
  [/^Listen at ([\d:]+)$/, t => t + '에서 듣기'],
  [/^improvement (\d+)$/i, n => '개선 사항 ' + n],
  [/^Play cited audio for (.+)$/, label => koreanText(label) + '의 근거 음성 재생'],
  [/^Listen to (\d+) cited intervals$/, n => '근거 구간 ' + n + '개 듣기'],
  [/^Listen to evidence (\d+) for (.+)$/, (n, label) => koreanText(label) + '의 근거 ' + n + ' 듣기'],
  [/^Show slide (\d+) evidence$/, n => '슬라이드 ' + n + '의 근거 보기'],
  [/^Open slide (\d+)$/, n => '슬라이드 ' + n + ' 열기'],
  [/^(Hide|Show) (\w+) feedback details$/, (verb, what) => koreanText(what) + ' 피드백 상세 ' + (verb === 'Show' ? '보기' : '닫기')],
  [/^Review (\w+) evidence at ([\d:]+)$/, (what, t) => t + '의 ' + koreanText(what) + ' 근거 검토'],
  [/^Overall needs slides? ([\d, ]+)$/, list => '전체 평가에 필요한 슬라이드: ' + list],
  [/^The AI could not grade slide (\d+) from what was said\. Record it again with a fuller explanation\.$/, n => '발표 내용만으로는 슬라이드 ' + n + '을 평가하기 어려워요. 좀 더 자세히 설명하며 다시 녹음해 주세요.'],
  [/^This slide ran ([\d:]+) over its ([\d:]+) allocation\.$/, (delta, goal) => '이 슬라이드는 배정 시간 ' + goal + '보다 ' + delta + ' 길었어요.'],
  [/^(Time|Fillers|Points) (.+)$/, (key, value) => koreanText(key) + ' ' + koreanText(value)],
  // Q&A labels use opaque question wording, panelist names and recorded answers.
  [/^Answer (.+)’s follow-up$/, name => name + '의 추가 질문에 답하기'],
  [/^Answer the follow-up from (.+)$/, name => name + '의 추가 질문에 답하기'],
  [/^(Hear the question:|Hear the follow-up:|Stop the question:|Stop the follow-up:|Back to the question:|Speech evidence:|Play sentence:) (.+)$/s, (prefix, value) => koreanText(prefix) + ' ' + value],
  [/^Asked after slide (\d+)$/, n => '슬라이드 ' + n + ' 발표 후 질문'],
  [/^after slide (\d+)$/i, n => '슬라이드 ' + n + ' 발표 후'],
  [/^([\w ]+) \(default\)$/, a => koreanText(a) + ' (기본 설정)'],
  [/^Play (old|new) take$/, kind => (kind === 'old' ? '기존' : '새') + ' 녹음 재생'],
  // Transcription, supporting facts and retry notices
  [/^Play sentence at ([\d:]+)$/, t => t + ' 문장 재생'],
  [/^(Play|Pause)\s+(moved speech on\s+)?slide (\d+) (?:transcript audio|recording)$/, (act, moved, n) => '슬라이드 ' + n + (moved ? '의 이동된 발언 ' : '의 녹음 ') + (act === 'Play' ? '재생' : '일시정지')],
  [/^(Play|Pause) moved speech on slide (\d+)$/, (act, n) => '슬라이드 ' + n + '의 이동된 발언 ' + (act === 'Play' ? '재생' : '일시정지')],
  [/^(?:Slide|slide) (\d+) (transcript|transcription)$/, n => '슬라이드 ' + n + ' 발표 원문'],
  [/^Possibly misheard: (.+)\. Show corrections$/s, word => '잘못 인식했을 수 있는 단어: ' + word + '. 교정 보기'],
  [/^Show replacements for (.+)$/s, word => '“' + word + '”의 대체 표현 보기'],
  [/^Replace “(.+)” with “(.+)”$/s, (word, alt) => '“' + word + '” → “' + alt + '” 교체'],
  [/^Keep “(.+)” as heard$/s, word => '듣기 그대로 “' + word + '” 유지'],
  [/^Did you say “(.+)”\?$/s, word => '“' + word + '”이라고 말씀하셨나요?'],
  [/^Correct “(.+)”$/s, word => '“' + word + '” 교정'],
  [/^(Hide|Show|Edit) slide (\d+) description$/, (act, n) => '슬라이드 ' + n + ' 설명 ' + koreanText(act)],
  [/^(Key idea|Visual fact) (\d+)$/, (label, n) => koreanText(label + ':').replace(/:$/, '') + ' ' + n],
  [/^(.+) (text|uncertainty explanation)$/, (label, field) => koreanText(label) + (field === 'text' ? ' 내용' : ' 불확실한 이유')],
  [/^(.+): (certain|uncertain) — toggle$/, (label, state) => koreanText(label) + ': ' + koreanText(state) + ' — 상태 변경'],
  [/^Slide (\d+) ([▴▾→])$/, (n, arrow) => '슬라이드 ' + n + ' ' + arrow],
  [/^← Slide (\d+)$/, n => '← 슬라이드 ' + n],
  [/^Uncertain: (.+)$/s, text => '불확실한 이유: ' + text],
  [/^(Said as the slide changed · swipe [←→] to move to slide) (\d+)$/, (label, n) => koreanText(label) + ' ' + n],
  [/^AI suggestions from (.+)\?$/, provider => provider + '의 AI 조언을 받을까요?'],
  [/^AI suggestions send slide images and text, slide descriptions, this take's transcript and audience context through your OutLoud server to (.+)\. No audio is sent\. OutLoud covers the cost\.$/s, provider => 'AI 조언을 위해 슬라이드 이미지와 텍스트, 슬라이드 설명, 발표 원문과 청중 정보를 OutLoud 서버를 통해 ' + provider + '에 보내요. 오디오는 보내지 않아요. 비용은 OutLoud가 부담해요.'],
  [/^AI suggestions send slide images and text, slide descriptions, this take's transcript and audience context through your OutLoud server to (.+)\. No audio is sent\. Requests may incur provider charges\.$/s, provider => 'AI 조언을 받으려면 슬라이드 이미지와 텍스트, 슬라이드 설명, 이 녹음의 발표 원문과 청중 정보를 OutLoud 서버를 통해 ' + provider + '에 보내요. 오디오는 보내지 않아요. 제공자의 요금이 발생할 수 있어요.'],
  [/^Server returned HTTP (\d+)\. Reconnecting…$/, code => '서버 응답 ' + code + '. 다시 연결하는 중…'],
  [/^(?:Backend|The server) returned HTTP (\d+)\.$/, code => '서버 응답 코드: ' + code],
  [/^Server readiness HTTP (\d+)$/, code => '서버 연결 확인 응답 코드: ' + code],
  [/^AI cues request failed \(HTTP (\d+)\)\.$/, code => 'AI 발표 도움말 요청에 실패했어요 (HTTP ' + code + ').'],
  [/^Could not check the saved presentation \(HTTP (\d+)\)\.$/, code => '저장된 발표 자료를 확인하지 못했어요 (HTTP ' + code + ').'],
  [/^The server could not read this PDF \(HTTP (\d+)\)\. Check the 50 MiB file limit\.$/, code => '서버가 PDF를 읽지 못했어요 (HTTP ' + code + '). 파일이 50 MiB 이하인지 확인해 주세요.'],
  [/^(\d+) of (\d+) recorded slides assessed$/, (done, total) => `녹음한 슬라이드 ${total}개 중 ${done}개 평가 완료`],
  [/^Improve (.+)$/, label => `${koreanText(label)} 개선`],
  [/^\+(\d+(?:\.\d+)?) PTS$/, points => `+${points}점`],
  [/^(\d+) slides$/, n => `슬라이드 ${n}장`],
  [/^of (\d+:\d+)$/, time => `목표 ${time}`],
  [/^(?:Slide|SLIDE) (\d+) (?:of|OF) (\d+)$/, (n, total) => `슬라이드 ${n} / ${total}`],
  [/^Question (\d+) of (\d+)$/, (n, total) => `질문 ${n} / ${total}`],
  [/^Slide (\d+) (feedback|cues)$/, (n, kind) => `슬라이드 ${n} ${kind === 'feedback' ? '피드백' : '발표 도움말'}`],
  [/^Record slide (\d+) again to get feedback based on your delivery\.$/, n => `실제 발표에 맞춘 피드백을 받으려면 슬라이드 ${n}을 다시 녹음해 주세요.`],
  [/^\+(\d+) more$/, n => `+${n}개 더 보기`],
  [/^General audience \(default\)$/, () => '일반 청중 (기본 설정)'],
  [/^(\d+) (?:of|OF) (\d+)$/, (a, b) => `${a} / ${b}`],
  [/^(\d+) days ago$/, n => `${n}일 전`], [/^(\d+) weeks ago$/, n => `${n}주 전`],
  [/^Slide score (\d+) · (.+)$/, (n, level) => `슬라이드 점수 ${n} · ${koreanText(level)}`],
  [/^\+(\d+(?:\.\d+)?) points on this slide$/, n => `이 슬라이드에서 +${n}점`],
  [/^Try saying: (.+)$/s, example => `이렇게 말해 보세요: ${example}`],
  [/^To reach the next level: (.+)$/s, text => `다음 단계로 발전하려면: ${text}`],
];

export function koreanText(value: string): string;
export function koreanText(value: string | undefined): string | undefined;
export function koreanText(value: string | undefined): string | undefined {
  if (value === undefined || !/[A-Za-z]/.test(value)) return value;
  if (Object.hasOwn(koreanCopy, value)) return koreanCopy[value];
  const known = ignoreCase.get(value.toLowerCase());
  if (known !== undefined) return known;
  const trimmed = value.trim();
  if (trimmed !== value && trimmed) return value.replace(trimmed, () => koreanText(trimmed));
  for (const [pattern, render] of patterns) {
    const match = value.match(pattern);
    if (match) return render(...match.slice(1));
  }
  if (value.includes('\n')) return value.split('\n').map(koreanText).join('\n');
  if (value.includes(' · ')) return value.split(' · ').map(koreanText).join(' · ');
  return value;
}
