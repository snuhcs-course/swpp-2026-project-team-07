import type { Resource } from './translationCache';
import { keepsExplicitTimes } from './displayClocks';

// These checks catch recognizable wrong-language prose in old SQLite rows and completed replies.
// The translator still handles ambiguous names, technical terms and mixed-language inputs.
const englishGrammar = /\b(?:what|why|how|where|when|which|who)\s+(?:is|are|was|were|do|did|does|would|could|can|will|has|have)\b|\b(?:we|you|it|they|this|these|that|those)\s+(?:are|were|have|had|will|should|could|can|is|was|has|need)\b|\b(?:explain|describe|compare|clarify|show|give|mention|introduce|consider)\s+(?:the|a|an|your|how|why|both)\b|\b(?:why now|how soon|what next)\s*\?/iu;
const koreanGrammar = /[가-힣](?:세요|해요|이에요|예요|나요|가요|까요|죠|니다|니까|였다|었다|한다|된다|이다)(?=[\s.?!。？！…,:;]|$)|(?:무엇|어떻게|어떤|왜)\s+[가-힣]/u;
const englishWords = 'the your you with are is of between should could would were this these those which how does'.split(' ');
const otherLanguages = [
  'der die das dem den des dass sie sich sind eine einem einen wird werden ihre ihrem zwischen diese dieser welche wie nicht',
  'vous votre vos cette ces est sont une les des dans que pourquoi quelle quel avec entre pour elle',
  'usted ustedes cómo qué cuál para por una los las están esta este estos entre porque del son puede',
].map(group => group.split(' '));
const nameParticles = new Set(['the', 'of', 'de', 'la', 'and', 'van', 'von']);
const quoted = /“[^”\n]+”|‘(?:[^’\n]|’(?=\p{L}))+’|「[^」\n]+」|『[^』\n]+』|"[^"\n]+"/gu;
const singleQuoted = /(?:^|[^\p{L}\d_])('(?:[^'\n]|'(?=\p{L}))+'(?![\p{L}\d_]))/gu;
const practiceLine = /(?:\b(?:try saying(?: this)?|you (?:could|can|should) say|say this(?: instead)?|for example,? say|try this wording|rephrase (?:it |this )?as|instead,? say|say instead)\s*[:,]\s*|(?:이렇게 말해 보세요|이렇게 말해보세요|이렇게 말하세요)\s*[:：]\s*)([^\n“‘"「『]+?(?:[.!?。？！](?=\s|$)|(?=\n|$)))/giu;
const barePracticeLine = /(?:\b[Tt]ry saying|\b[Yy]ou (?:could|can|should) say)\s+([A-Z][^\n“‘"「『]*?(?:[.!?。？！](?=\s|$)|(?=\n|$)))/gu;

function withoutCopiedSpeech(resource: Resource, path: string, source: string, value: string) {
  const isQuestion = resource.kind === 'profiles' || resource.kind === 'questions' || /(?:^|\.)(?:question|follow_up)$/.test(path);
  let prose = value;
  for (const matches of [source.matchAll(quoted), source.matchAll(singleQuoted)]) {
    for (const match of matches) {
      const span = match[1] ?? match[0];
      if (!isQuestion || span !== source.trim()) prose = prose.split(span).join(' ');
    }
  }
  for (const pattern of [practiceLine, barePracticeLine]) {
    for (const match of source.matchAll(pattern)) prose = prose.split(match[1]).join(' ');
  }
  return prose.normalize('NFC').trim();
}

function obviousLanguage(prose: string, words: string[]) {
  const vocabulary = new Set(words.map(word => word.toLowerCase()));
  const english = englishGrammar.test(prose) || (words.length >= 5 && englishWords.filter(word => vocabulary.has(word)).length >= 3);
  const korean = koreanGrammar.test(prose);
  if (english !== korean) return english ? 'en' : 'ko';
  if (words.length >= 4 && otherLanguages.some(group => group.filter(word => vocabulary.has(word)).length >= 2)) return 'other';
  return null;
}

export function isDisplayWording(resource: Resource, path: string, source: string, value: string) {
  if (!value.trim()) return false;
  const prose = withoutCopiedSpeech(resource, path, source, value);
  const originalProse = value === source ? prose : withoutCopiedSpeech(resource, path, source, source);
  if (!keepsExplicitTimes(originalProse, prose)) return false;
  const words = prose.match(/\p{L}+/gu) ?? [];
  if (!words.length) return true;
  const detected = obviousLanguage(prose, words);
  if (detected && detected !== resource.language) return false;
  const latin = /\p{Script=Latin}/u.test(prose);
  if (latin && /\p{Script=Hangul}/u.test(prose)) {
    // A translated heading can precede a separate, untranslated sentence.
    for (const line of prose.split(/[\n.!?。！？]+/u).filter(Boolean)) {
      const part = obviousLanguage(line, line.match(/\p{L}+/gu) ?? []);
      if (part && part !== resource.language) return false;
    }
  }
  if (resource.language === 'ko' ? /\p{Script=Hangul}/u.test(prose) : latin) return true;
  if (prose !== originalProse) return false;
  // Unchanged short proper names, formulas and acronyms may be displayed in either language.
  const ordinary = words.some(word => /\p{Ll}/u.test(word) && word === word.toLowerCase() && word.length > 1 && !nameParticles.has(word));
  return !((words.length >= 3 && ordinary) || (words.length >= 2 && /[?？]$/u.test(prose)) || (!latin && words.join('').length >= 8));
}
