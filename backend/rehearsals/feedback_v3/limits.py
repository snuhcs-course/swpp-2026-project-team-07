"""Length limits for coaching text on the app's Feedback page, and the code that applies them.

Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-20).
The Feedback page draws every coaching field in a fixed box (headline: one line; explanation and
steps: bullets of up to two lines; example: up to three lines). The prompts quote these limits.
Normalisation never cuts text: anything over a limit is kept whole and listed in `over_limit`,
and the app shows it with "…" and opens the full text in a full-screen sheet.
"""
import re

# Most bullets kept per field. A whole-talk point has no quote, so its explanation may use three.
MAX_ITEMS = {'explanation': 2, 'priority_explanation': 3, 'steps': 2}
# English: (most words, most characters). Korean: most characters (spaces included).
EN = {'headline': (5, 24), 'explanation': (14, 85), 'example': (16, 100), 'steps': (12, 80)}
KO = {'headline': 11, 'explanation': 40, 'example': 48, 'steps': 36}

_QUOTES = '"\'“”‘’„‟«»「」『』'
_BULLET = re.compile(r'^\s*(?:[-*•·–—▪●]|\d+[.)])\s+')
_SPACES = re.compile(r'\s+')


def clean(value) -> str:
    """One line of plain text: whitespace collapsed, surrounding blanks removed."""
    return _SPACES.sub(' ', value).strip() if isinstance(value, str) else ''


def unquote(value) -> str:
    """Strip quotation marks wrapped around the whole text, however many layers (e.g. “"…"”)."""
    text = clean(value)
    while len(text) >= 2 and text[0] in _QUOTES and text[-1] in _QUOTES:
        text = text[1:-1].strip()
    return text


def bullets(value) -> list[str]:
    """A list of bullet strings from a list, or from one string with one bullet per line."""
    raw = value if isinstance(value, list) else value.splitlines() if isinstance(value, str) else []
    found = []
    for item in raw:
        text = _BULLET.sub('', clean(item)) if isinstance(item, str) else ''
        if text:
            found.append(text)
    return found


def over(field: str, text: str, language: str) -> bool:
    """True when `text` would not fit the box the app gives `field`."""
    if language == 'ko':
        return len(text) > KO[field]
    words, chars = EN[field]
    return len(text.split()) > words or len(text) > chars


def _sentence(text: str) -> str:
    return text + '.' if text and (text[-1].isascii() and text[-1].isalnum()) else text


def coaching(item: dict, language: str, *, explanation_items: int) -> dict:
    """Coaching fields of one improvement or priority, cleaned and checked against the limits.

    Older answers (prompt 2) had `problem` / `action` (slides) or `title` / `why` / `action`
    (whole talk); they are read as headline / explanation / steps so stored runs keep working.
    The legacy fields are also written back, joined, for screens that still read them.
    """
    headline = clean(item.get('headline')).rstrip('.。')
    explanation = bullets(item.get('explanation'))
    steps = bullets(item.get('steps'))
    legacy_problem = ''
    if not headline and not explanation and not steps:
        legacy_problem = clean(item.get('problem'))
        headline = clean(item.get('title')) or legacy_problem
        explanation = bullets(item.get('why')) if item.get('title') else []
        steps = bullets(clean(item.get('action')))
    example = unquote(item.get('example'))
    over_limit = []
    if headline and over('headline', headline, language):
        over_limit.append('headline')
    if len(explanation) > explanation_items:
        over_limit.append('explanation')
    over_limit += [f'explanation.{n}' for n, text in enumerate(explanation) if over('explanation', text, language)]
    if example and over('example', example, language):
        over_limit.append('example')
    if len(steps) > MAX_ITEMS['steps']:
        over_limit.append('steps')
    over_limit += [f'steps.{n}' for n, text in enumerate(steps) if over('steps', text, language)]
    return {'headline': headline, 'explanation': explanation, 'example': example, 'steps': steps,
            'over_limit': over_limit,
            'problem': legacy_problem or ' '.join(_sentence(t) for t in explanation),
            'action': ' '.join(_sentence(t) for t in steps)}


def prompt_rules(explanation_items: int) -> str:
    """The limits as the prompts state them; generated here so the numbers cannot drift."""
    def en(field):
        words, chars = EN[field]
        return f'at most {words} words and {chars} characters (Korean: {KO[field]} characters)'
    return (f'headline: one line naming the problem, {en("headline")}, no full stop; e.g. "Mountains left out", "Trim this slide".\n'
            f'explanation: 1 to {explanation_items} bullet points on why it is wrong, referring to what was said and '
            f'to the slide, each {en("explanation")}. When a point is on the slide but was not said, say exactly that.\n'
            f'example: one sentence the speaker could say next time, as natural speech for this audience, {en("example")}, '
            'without quotation marks.\n'
            f'steps: 1 to {MAX_ITEMS["steps"]} bullet points on what to do, each starting with a verb, {en("steps")}.\n'
            'The app shows these fields in fixed boxes on a phone: stay inside every limit; anything longer is cut off.')
