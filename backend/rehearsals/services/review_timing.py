"""Phase 3 text-weighted integer allocation, mirrored for evidence-based review."""
import math
import re
import unicodedata
STOP = set('this that with your from have they them what which when were will into about there their than then also only just each does 그리고 그래서 하지만 그러나 또한 이것 그것 저것 우리 여러분 있습니다 합니다 입니다'.split())

def targets(slides, total):
    if total is None:
        return None
    counts = []
    for slide in slides:
        # Same text retained by mobile parseSlideText: nonempty letter-bearing
        # lines, excluding standalone page numbers. Keywords ignore punctuation.
        text = ' '.join(line.strip() for line in slide['extracted_text'].replace('\r', '').split('\n')
                        if any(unicodedata.category(c).startswith('L') for c in line))
        text = ''.join(c if unicodedata.category(c)[0] in 'LN' or c == '%' or c.isspace() else ' ' for c in text.lower())
        words = [w for w in text.split() if w not in STOP and
                 (len(w) >= 2 if re.search('[가-힣]', w) else bool(re.fullmatch(r'\d+%?', w)) or len(w.encode('utf-16-le')) // 2 >= 4)]
        counts.append(1 + min(80, len(words)) / 40)
    # JS reduce uses sequential doubles; Python 3.12 sum compensates rounding.
    weights = 0
    for weight in counts:
        weights += weight
    raw = [total * w for w in counts]
    raw = [v / weights for v in raw]
    allocation = [math.floor(v) for v in raw]
    order = sorted(range(len(slides)), key=lambda i: (-(raw[i] - math.floor(raw[i])), i))
    for i in order[:total - sum(allocation)]: allocation[i] += 1
    return allocation

def finding(index, selection, source, total_targets):
    if total_targets is None:
        return None
    actual = sum(s['end_ms'] - s['start_ms'] for s in selection['segments'])
    target = total_targets[index] * 1000
    if actual <= target + max(15000, target * .25):
        return None
    return {'category': 'timing', 'priority': 1 if actual > target * 1.5 else 2,
            'slide_index': index, 'source_id': '', 'transcript_id': '', 'visit_id': -1, 'segment_id': '',
            'word_start': -1, 'word_end': -1, 'speech_quote': '', 'description_ref': '', 'slide_quote': '',
            'observation': f'{actual / 1000:g}s spent against a {target / 1000:g}s allocation.',
            'suggestion': 'Shorten this slide or redistribute time within the required presentation duration.',
            'start_ms': selection['segments'][0]['start_ms'], 'end_ms': selection['segments'][0]['end_ms']}
