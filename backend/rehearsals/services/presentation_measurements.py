"""AI-assisted local diagnostic evidence, never delivery grades. No provider calls."""
import hashlib
import math
from pathlib import Path

import numpy as np

from rehearsals.limits import MAX_DURATION_MS, AUDIO_DURATION_TOLERANCE_MS
from .metrics import timing_metrics
from .speech_gate import SAMPLE_RATE, MAX_SAMPLES

VERSION = 'presentation-measurements-v2'


def _empty(status, attempt_id, audio_hash, duration_ms, reason, limitation):
    return {'version': VERSION, 'status': status, 'attempt_id': attempt_id, 'audio_hash': audio_hash,
            'duration_ms': duration_ms, 'items': [], 'reason': reason, 'limitations': [limitation]}


def measure_waveform(waveform, speech_samples, *, attempt_id, audio_hash, duration_ms, text, language):
    """speech_samples are Silero sample intervals on the unchanged 16 kHz waveform."""
    # AI-assisted #49 repair; decisions/evidence: docs/ai-collaboration-prompts-iteration-2.md.
    unavailable = lambda reason, limitation: _empty('unavailable', attempt_id, audio_hash, duration_ms, reason, limitation)
    try:
        values = np.asarray(waveform, dtype=np.float32)
    except (TypeError, ValueError):
        return unavailable('audio_invalid', 'Audio samples are invalid.')
    if (type(duration_ms) is not int or not 0 < duration_ms <= MAX_DURATION_MS
            or values.ndim != 1 or not len(values) or len(values) > MAX_SAMPLES or not np.isfinite(values).all()):
        return unavailable('audio_invalid', 'Audio samples or capture duration are invalid.')
    expected = duration_ms * SAMPLE_RATE // 1000
    if abs(len(values) - expected) > AUDIO_DURATION_TOLERANCE_MS * SAMPLE_RATE // 1000:
        return unavailable('audio_duration_mismatch',
                           f'Audio duration does not match the capture ({AUDIO_DURATION_TOLERANCE_MS} ms tolerance).')
    spans, cursor = [], 0
    if not isinstance(speech_samples, (list, tuple)):
        return unavailable('audio_invalid', 'Speech intervals do not match decoded audio.')
    for span in speech_samples:
        if not isinstance(span, dict):
            return unavailable('audio_invalid', 'Speech intervals do not match decoded audio.')
        start, end = span.get('start'), span.get('end')
        if (type(start) is not int or type(end) is not int or not cursor <= start < end <= len(values)):
            return unavailable('audio_invalid', 'Speech intervals do not match decoded audio.')
        spans.append((start, end)); cursor = end
    # Diagnostics share only real audio within the unchanged capture timeline.
    window_end = min(expected, len(values))
    values = values[:window_end]
    spans = [(start, min(end, window_end)) for start, end in spans
             if start * 1000 // SAMPLE_RATE < min(end, window_end) * 1000 // SAMPLE_RATE]
    if not spans or not np.any(values):
        return _empty('insufficient_evidence', attempt_id, audio_hash, duration_ms,
                      'insufficient_audio_evidence', 'No usable speech intervals within the capture.')
    items = []
    def add(kind, start, end, value, unit):
        start_ms, end_ms = start * 1000 // SAMPLE_RATE, min(end, window_end) * 1000 // SAMPLE_RATE
        if start_ms >= end_ms:
            return
        items.append({'id': f'{kind}_{sum(i["kind"] == kind for i in items)}', 'kind': kind,
                      'start_ms': start_ms, 'end_ms': end_ms, 'value': value, 'unit': unit})
    for start, end in spans:
        add('speech', start, end, (end-start)*1000//SAMPLE_RATE, 'ms')
    for (_, end), (start, _) in zip(spans, spans[1:]):
        if start > end: add('pause', end, start, (start-end)*1000//SAMPLE_RATE, 'ms')
    for rate in timing_metrics([], duration_ms, text, language)['speaking_rates']:
        add('rate', 0, expected, rate['per_minute'], rate['unit'])
    # RMS relative to digital full scale, not physical loudness. Never a grading threshold.
    rms = math.sqrt(float(np.mean(values.astype(np.float64)**2)))
    add('signal_rms', 0, expected, round(20*math.log10(max(rms, 1e-12)), 3), 'dBFS')
    frames = [math.sqrt(float(np.mean(values[i:i+SAMPLE_RATE].astype(np.float64)**2)))
              for i in range(0, len(values), SAMPLE_RATE)]
    db = 20*np.log10(np.maximum(frames, 1e-12))
    add('signal_variation', 0, expected, round(float(np.percentile(db, 90)-np.percentile(db, 10)), 3), 'dB p90-p10 of 1s RMS')
    return {'version': VERSION, 'status': 'available', 'attempt_id': attempt_id, 'audio_hash': audio_hash,
            'duration_ms': duration_ms, 'items': items, 'reason': None, 'limitations': [
                'VAD is approximate; pauses and speaking rates are not quality penalties.',
                'Rates use whole capture time. English words and Korean Hangul runs are different units; other languages have no rate estimate.',
                'Signal statistics reflect gain, microphone and noise; they do not establish confidence, emotion, pronunciation or vocal expressiveness.']}


def measure_audio(path, *, attempt_id, duration_ms, text, language):
    """Bounded source hashing and decoding; errors never expose paths or source text."""
    from .speech_gate import decode_waveform, load_gate, _model_lock
    audio_hash = None
    try:
        digest = hashlib.sha256()
        with Path(path).open('rb') as stream:
            while chunk := stream.read(65536): digest.update(chunk)
        audio_hash = digest.hexdigest()
    except Exception:
        return _empty('unavailable', attempt_id, audio_hash, duration_ms,
                      'audio_missing', 'Audio could not be read.')
    try:
        waveform = decode_waveform(path)
    except Exception:
        return _empty('unavailable', attempt_id, audio_hash, duration_ms,
                      'audio_decode_failed', 'Audio decoding failed.')
    try:
        with _model_lock:
            model, detect = load_gate()
            spans = detect(waveform, model, sampling_rate=SAMPLE_RATE,
                           min_speech_duration_ms=100, speech_pad_ms=30, threshold=.5)
    except Exception:
        return _empty('unavailable', attempt_id, audio_hash, duration_ms,
                      'audio_measurement_failed', 'Speech measurement failed.')
    return measure_waveform(waveform, spans, attempt_id=attempt_id, audio_hash=audio_hash,
                            duration_ms=duration_ms, text=text, language=language)
