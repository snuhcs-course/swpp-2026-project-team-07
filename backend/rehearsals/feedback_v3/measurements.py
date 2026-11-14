"""Delivery measurements computed in code from Scribe word timestamps.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
No audio decoding: Scribe already timed every word. Rates use speaking time
(pauses of one second or more excluded) and language-appropriate units, so
Korean and English are compared against their own reference bands.
"""
import re

from ..services.review_timing import targets
from .transcript import HANGUL, LATIN_WORD, SlideSpeech, Speech, Word

PAUSE_MS = 1000          # Gaps at least this long are not counted as speaking time.
LONG_PAUSE_MS = 2000     # Reported to the model and the user.
# PROVISIONAL comfortable-rate bands; calibrate with the Phase 4 recordings.
RATE_BANDS = {
    'en': {'unit': 'words/min', 'slow_below': 110, 'fast_above': 180},
    'ko': {'unit': 'syllables/min', 'slow_below': 230, 'fast_above': 360},
}
FILLERS = {
    'en': {'um', 'uh', 'er', 'erm', 'uhm', 'umm', 'hmm', 'mm', 'ah'},
    'ko': {'음', '어', '으', '흠', '엄', '음음', '어어'},
}
_PUNCTUATION = re.compile(r'[^\w가-힣]+')


def _token(text: str) -> str:
    return _PUNCTUATION.sub('', text).casefold()


def _units(words: list[Word], language: str) -> int:
    text = ' '.join(w.text for w in words)
    if language == 'ko':
        # Hangul syllables, plus about two syllables per embedded English word.
        return len(HANGUL.findall(text)) + 2 * len(LATIN_WORD.findall(text))
    return sum(1 for w in words if _token(w.text))


def _speaking_ms(words: list[Word]) -> int:
    total = 0
    for i, word in enumerate(words):
        total += max(0, word.end_ms - word.start_ms)
        if i + 1 < len(words):
            gap = words[i + 1].start_ms - word.end_ms
            if 0 < gap < PAUSE_MS:
                total += gap
    return total


def _pauses(slide: SlideSpeech) -> list[int]:
    """Long silences between consecutive words inside one visit."""
    found = []
    for start, end in slide.visit_ms:
        inside = [w for w in slide.words if start <= w.start_ms < end and w.text]
        for a, b in zip(inside, inside[1:]):
            if b.start_ms - a.end_ms >= LONG_PAUSE_MS:
                found.append(b.start_ms - a.end_ms)
    return found


def _rate(words: list[Word], language: str) -> dict | None:
    band = RATE_BANDS.get(language)
    spoken = _speaking_ms(words)
    if not band or spoken < 5000:
        return None
    value = round(_units(words, language) / (spoken / 60000), 1)
    verdict = 'slow' if value < band['slow_below'] else 'fast' if value > band['fast_above'] else 'comfortable'
    return {'value': value, 'unit': band['unit'], 'band': verdict,
            'comfortable_range': [band['slow_below'], band['fast_above']]}


def slide_measurements(slide: SlideSpeech, language: str, target_seconds: int | None) -> dict:
    words = [w for w in slide.words if w.text]
    tokens = [_token(w.text) for w in words]
    fillers = FILLERS.get(language, set()) | FILLERS['en']
    repeats = sum(1 for a, b in zip(tokens, tokens[1:]) if a and a == b and a not in fillers)
    pauses = _pauses(slide)
    return {
        'seconds': round(slide.seconds, 1),
        'target_seconds': target_seconds,
        'visits': len(slide.visit_ms),
        'words': len(words),
        'rate': _rate(words, language),
        'filler_count': sum(1 for t in tokens if t in fillers),
        'repeated_words': repeats,
        'long_pauses': len(pauses),
        'longest_pause_seconds': round(max(pauses) / 1000, 1) if pauses else 0,
    }


def measure(speech: Speech, slide_texts: list[str], duration_ms: int, required_seconds: int | None) -> dict:
    """Per-slide and whole-talk measurements. Pure function of its inputs."""
    allocation = targets([{'extracted_text': t} for t in slide_texts], required_seconds) if required_seconds else None
    slides = {}
    for index in range(len(slide_texts)):
        speech_slide = speech.slides.get(index, SlideSpeech(index))
        slides[index] = slide_measurements(speech_slide, speech.language, allocation[index] if allocation else None)
    every_word = [w for s in speech.slides.values() for w in s.words if w.text]
    every_word.sort(key=lambda w: w.start_ms)
    minutes = duration_ms / 60000
    fillers = sum(m['filler_count'] for m in slides.values())
    pauses = [m['longest_pause_seconds'] for m in slides.values() if m['long_pauses']]
    total_seconds = round(duration_ms / 1000, 1)
    whole = {
        'language': speech.language,
        'total_seconds': total_seconds,
        'target_seconds': required_seconds,
        'time_ratio': round(total_seconds / required_seconds, 2) if required_seconds else None,
        'rate': _rate(every_word, speech.language),
        'filler_count': fillers,
        'fillers_per_minute': round(fillers / minutes, 1) if minutes else 0,
        'long_pauses': sum(m['long_pauses'] for m in slides.values()),
        'longest_pause_seconds': max(pauses) if pauses else 0,
        'repeated_words': sum(m['repeated_words'] for m in slides.values()),
    }
    return {'whole': whole, 'slides': slides}
