"""Slide-aligned speech as numbered sentences the model can cite.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
The model cites sentence ids ("s12"), never word positions; the server maps ids
back to original timestamps so the app can play the evidence.
"""
from bisect import bisect_right
from dataclasses import dataclass, field
import re

SENTENCE_END = re.compile(r'[.?!。？！…]["\'”’)\]]*$')
SENTENCE_GAP_MS = 1200     # A silence this long also ends a sentence.
SENTENCE_MAX_WORDS = 40
HANGUL = re.compile(r'[가-힣]')
LATIN_WORD = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*")


@dataclass(frozen=True)
class Word:
    index: int          # Original Scribe word index (corrections refer to it).
    text: str           # Effective text after accepted corrections ('' if merged away).
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class Sentence:
    id: str
    slide_index: int
    visit: int
    start_ms: int
    end_ms: int
    text: str


@dataclass
class SlideSpeech:
    slide_index: int
    visit_ms: list[tuple[int, int]] = field(default_factory=list)
    words: list[Word] = field(default_factory=list)
    sentences: list[Sentence] = field(default_factory=list)

    @property
    def seconds(self) -> float:
        return sum(end - start for start, end in self.visit_ms) / 1000

    @property
    def text(self) -> str:
        return ' '.join(s.text for s in self.sentences)


@dataclass
class Speech:
    language: str                    # 'ko', 'en' or 'und'
    slides: dict[int, SlideSpeech]
    sentences: list[Sentence]        # Chronological; ids are unique per attempt.

    def by_id(self) -> dict[str, Sentence]:
        return {s.id: s for s in self.sentences}


def effective_words(words: list[dict], edits: list[dict]) -> list[Word]:
    """Apply accepted recognition corrections without moving original timestamps.

    An edit replaces an inclusive original range: its text goes on the first word
    and the rest of the range becomes empty, so timing evidence stays original.
    """
    replacement = {}
    for edit in edits:
        start, end = edit['word_start'], edit['word_end']
        for index in range(start, end + 1):
            replacement[index] = edit['text'] if index == start else ''
    return [Word(i, replacement.get(i, w['text']), w['start_ms'], w['end_ms']) for i, w in enumerate(words)]


def visits(slide_events: list[dict], duration_ms: int) -> list[tuple[int, int, int]]:
    """(slide_index, start_ms, end_ms) per chronological visit, including revisits."""
    rows = []
    for i, event in enumerate(slide_events):
        end = slide_events[i + 1]['at_ms'] if i + 1 < len(slide_events) else duration_ms
        rows.append((event['slide_index'], event['at_ms'], end))
    return rows


def detect_language(text: str) -> str:
    hangul = len(HANGUL.findall(text))
    latin = sum(len(w) for w in LATIN_WORD.findall(text))
    if hangul == 0 and latin == 0:
        return 'und'
    # Korean talks often contain English terms; one Hangul syllable carries
    # roughly two to three Latin letters of content.
    return 'ko' if hangul * 2.5 >= latin else 'en'


def build(words: list[dict], slide_events: list[dict], duration_ms: int, edits: list[dict]) -> Speech:
    rows = visits(slide_events, duration_ms)
    starts = [start for _, start, _ in rows]
    per_visit: list[list[Word]] = [[] for _ in rows]
    for word in effective_words(words, edits):
        position = bisect_right(starts, word.start_ms) - 1
        if position >= 0:
            per_visit[position].append(word)

    slides: dict[int, SlideSpeech] = {}
    sentences: list[Sentence] = []
    for visit_number, ((slide_index, start, end), visit_words) in enumerate(zip(rows, per_visit)):
        slide = slides.setdefault(slide_index, SlideSpeech(slide_index))
        slide.visit_ms.append((start, end))
        slide.words.extend(visit_words)
        for group in _split(visit_words):
            text = ' '.join(w.text for w in group if w.text).strip()
            if not text:
                continue
            sentence = Sentence(f's{len(sentences)}', slide_index, visit_number,
                                group[0].start_ms, max(w.end_ms for w in group), text)
            sentences.append(sentence)
            slide.sentences.append(sentence)
    language = detect_language(' '.join(s.text for s in sentences))
    return Speech(language, slides, sentences)


def _split(words: list[Word]) -> list[list[Word]]:
    groups, current = [], []
    for i, word in enumerate(words):
        current.append(word)
        following = words[i + 1] if i + 1 < len(words) else None
        if (following is None or SENTENCE_END.search(word.text)
                or following.start_ms - word.end_ms >= SENTENCE_GAP_MS
                or len(current) >= SENTENCE_MAX_WORDS):
            groups.append(current)
            current = []
    return groups
