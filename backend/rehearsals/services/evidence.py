"""Conservative presentation-evidence comparison; never fuzzy text recovery."""
import re
import unicodedata

VALIDATION_REVISION = 'evidence-v1'

# Same explicit whitespace union on mobile; NFC, not compatibility normalization.
SPACE = re.compile(r'[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+')
UNIT = re.compile(r'(?:[yzafpnumcdhkMGTPEZYµμ]?)(?:m|g|s|A|K|mol|cd|Hz|N|Pa|J|W|C|V|F|S|Wb|T|H|L|B|b|eV)',re.IGNORECASE)
NUMBER_WORDS = {'zero','one','two','three','four','five','six','seven','eight','nine','ten','hundred','thousand','million','billion','trillion','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety','half','quarter','dozen'}
SHORT_PROSE = {'it','so','as','in','no','we','he','my','by','to','on','or','of','if','an','be','up','do','us','me','at','am'}


def words(text):
    return [x for x in SPACE.split(unicodedata.normalize('NFC',text).strip()) if x]


def _token(token,previous=''):
    token=''.join("'" if c in '‘’ʼ' and i>0 and i+1<len(token) and token[i-1].isalpha() and token[i+1].isalpha() else c for i,c in enumerate(token))
    quantity=any(c.isdecimal() for c in previous) or bool(previous) and all(p in NUMBER_WORDS for p in previous.lower().split('-'))
    raw=token[:-1] if token.endswith('.') and not token.endswith('..') else token
    letters=all(c.isalpha() or c=="'" for c in raw)
    camel=any(a.islower() and b.isupper() for a,b in zip(raw,raw[1:]))
    acronym=len(raw)>1 and raw.isupper()
    # Preserve ambiguous code/unit syntax; only an ordinary word or complete
    # number may lose an added final sentence stop. ! and ? remain operators.
    if raw != token and ((letters and len(raw)>1 and not camel and not acronym)
                         or re.fullmatch(r'[+-]?\d+(?:[.,]\d+)?',raw)):
        token=raw
    stem=token.rstrip(',;:!?');suffix=token[len(stem):]
    ordinary_preposition=stem.lower() in {'at','as','am'} and not quantity
    if quantity or UNIT.fullmatch(stem) and not ordinary_preposition:return token
    # Unknown short title-case strings can be units (Rg) or identifiers. Keep
    # them exact unless they are ordinary short prose; don't guess semantics.
    ambiguous_short=len(stem)==2 and stem[0].isupper() and stem[1].islower() and stem.lower() not in SHORT_PROSE
    if len(stem)>1 and all(c.isalpha() or c=="'" for c in stem):
        camel=any(a.islower() and b.isupper() for a,b in zip(stem,stem[1:]))
        if not camel and not stem.isupper() and not ambiguous_short:token=stem.lower()+suffix
    return token


def quote_tokens(text):
    parts=words(text)
    return tuple(_token(t,parts[i-1] if i else '') for i,t in enumerate(parts))


def quotes_equal(actual, authoritative):
    a,b = quote_tokens(actual),quote_tokens(authoritative)
    return bool(a) and a == b


def verified_excerpt(actual, authoritative):
    """Return original contiguous words, not model text or a guessed substring."""
    original = words(authoritative)
    candidate = quote_tokens(actual)
    if not candidate:
        return None
    source = quote_tokens(authoritative)
    for start in range(len(source) - len(candidate) + 1):
        if source[start:start+len(candidate)] == candidate:
            return ' '.join(original[start:start+len(candidate)])
    return None


def authoritative_quote(text):
    # This is canonical Unicode/whitespace from the authoritative source, never
    # copied model wording. Keep the existing public quote cap without truncation.
    value=' '.join(words(text))
    return value if len(value)<=1000 else None


def same_advice(card):
    # Only collapse demonstrably equivalent statements/advice. Shared evidence,
    # category alone or a fuzzy bag-of-words score never establishes redundancy.
    return (card.slide_index,quote_tokens(card.observation),quote_tokens(card.suggestion))


def span_in_visit(analysis, card):
    segment = next((s for s in analysis.segments if s.segment_id == card.segment_id),None)
    if (not segment or segment.slide_index != card.slide_index or segment.visit_id != card.visit_id
            or card.visit_id >= len(analysis.source.visits) or card.word_end < card.word_start):
        return False
    visit = analysis.source.visits[card.visit_id]
    return (visit.slide_index == card.slide_index and card.word_start in segment.word_indexes
            and set(range(card.word_start,card.word_end+1)).issubset(visit.word_indexes))
