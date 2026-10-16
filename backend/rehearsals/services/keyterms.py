"""Slide-derived Scribe hints; no generated text or extra provider request.

OpenAI Codex, Iteration 2 (2026-10-16); see active collaboration log.
"""
from collections import Counter
import re
import unicodedata

MAX_KEYTERMS = 100  # Avoid the provider's >100-term minimum-duration billing rule.
STOP_WORDS = set("""
a an and are as at be been being but by can could did do does for from had has
have how i if in into is it its may more most not of on or our should so than
that the their them there these they this those to too up us was we were what
when where which who why will with would you your about also each other such
some all any using use used let's um uh er erm basically actually
overview introduction agenda slide slides presentation thank thanks contents
conclusion conclusions references example examples summary page figure
그리고 또는 위한 위해 있는 없는 것은 것을 에서 으로 합니다 입니다 감사합니다
""".split())
TOKEN = re.compile(r"[^\W_]+(?:[-’'][^\W_]+)*", re.UNICODE)


def valid_keyterm(term):
    return (isinstance(term, str) and 1 < len(term) < 50
            and not any(c in term for c in '<>{}[]\\')
            and 1 <= len(re.findall(r'[^\W_]+', unicodedata.normalize('NFKC', term))) <= 5)


def extract_keyterms(texts):
    """Rank repeated content words and short phrases; retain original spelling.

    shortcut: deterministic stopword heuristics can include ordinary content words;
    evaluate recognition gains before replacing this with a semantic extractor.
    """
    counts, spelling = Counter(), {}
    remaining = 100_000

    def add(term):
        if not valid_keyterm(term):
            return
        key = term.casefold()
        counts[key] += 1
        spelling.setdefault(key, term)

    for text in texts:
        text = unicodedata.normalize('NFKC', text or '')
        # Bound work even for unusually large extracted PDF text.
        if len(text) > remaining:
            text = text[:remaining].rsplit(' ', 1)[0]
        remaining -= len(text)
        for line in text.splitlines():
            run = []
            for word in [*TOKEN.findall(line), '']:
                content = (len(word) >= 2 and any(c.isalpha() for c in word)
                           and word.casefold() not in STOP_WORDS)
                if content:
                    add(word)
                    run.append(word)
                else:
                    if 2 <= len(run) <= 5:
                        add(' '.join(run))
                    run = []
        if remaining <= 0:
            break

    def score(key):
        term = spelling[key]
        acronym = any(w.isupper() and len(w) > 1 for w in term.split())
        return min(counts[key], 5) * 2 + min(len(term.split()), 3) + 3 * acronym

    return [spelling[k] for k in sorted(counts, key=lambda k: (-score(k), k))[:MAX_KEYTERMS]]


def for_recording(deck, slide_events):
    indices = {event['slide_index'] for event in slide_events}
    texts = deck.slides.filter(slide_index__in=indices).order_by('slide_index').values_list('extracted_text', flat=True)
    return extract_keyterms(texts.iterator())
