"""Adapted from prototype 33907d3 metrics; estimates include total rehearsal time."""
import re
from collections import defaultdict


def timing_metrics(visits, duration_ms, text, language):
    times = defaultdict(int)
    for visit in visits:
        times[visit['slide_index']] += visit['end_ms'] - visit['start_ms']
    minutes = duration_ms / 60_000
    english = re.findall(r"[A-Za-z]+(?:['’-][A-Za-z]+)*", text)
    korean = re.findall(r'[가-힣]+', text)
    rates = []
    for label, unit, items in [('en', 'English words/min', english), ('ko', 'Korean Hangul runs/min', korean)]:
        if items:
            rates.append({'language': label, 'unit': unit, 'count': len(items), 'per_minute': round(len(items) / minutes, 1)})
    return {'duration_ms': duration_ms,
        'time_per_slide': [{'slide_index': i, 'duration_ms': t} for i, t in sorted(times.items())],
        'detected_language': language, 'speaking_rates': rates,
        'rate_note': 'Estimates over total rehearsal time, including silence; mixed-language components are separate. Korean counts contiguous Hangul runs, not linguistic words.'}
