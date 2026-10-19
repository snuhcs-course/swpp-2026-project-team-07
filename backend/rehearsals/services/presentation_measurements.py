"""AI-assisted local diagnostic evidence, never delivery grades. No provider calls."""
import hashlib
import math
from pathlib import Path

import numpy as np

from .metrics import timing_metrics
from .speech_gate import SAMPLE_RATE, MAX_SAMPLES

VERSION = 'presentation-measurements-v1'


def _empty(status, attempt_id, audio_hash, duration_ms, reason):
    return {'version': VERSION, 'status': status, 'attempt_id': attempt_id, 'audio_hash': audio_hash,
            'duration_ms': duration_ms, 'items': [], 'limitations': [reason]}


def measure_waveform(waveform, speech_samples, *, attempt_id, audio_hash, duration_ms, text, language):
    """speech_samples are Silero sample intervals on the unchanged 16 kHz waveform."""
    unavailable = lambda reason: _empty('unavailable', attempt_id, audio_hash, duration_ms, reason)
    values = np.asarray(waveform, dtype=np.float32)
    expected = duration_ms * SAMPLE_RATE // 1000
    if (type(duration_ms) is not int or duration_ms <= 0 or values.ndim != 1 or not len(values)
            or len(values) > MAX_SAMPLES or not np.isfinite(values).all()
            or abs(len(values) - expected) > SAMPLE_RATE // 10):
        return unavailable('Audio is invalid or its duration does not match the capture (100 ms tolerance).')
    spans, cursor = [], 0
    for span in speech_samples:
        start, end = span.get('start'), span.get('end')
        if (type(start) is not int or type(end) is not int or not cursor <= start < end <= len(values)):
            return unavailable('Speech intervals do not match decoded audio.')
        spans.append((start, end)); cursor = end
    if not spans or not np.any(values):
        return _empty('insufficient_evidence', attempt_id, audio_hash, duration_ms, 'No usable speech intervals.')
    items = []
    def add(kind, start, end, value, unit):
        items.append({'id': f'{kind}_{sum(i["kind"] == kind for i in items)}', 'kind': kind,
                      'start_ms': min(duration_ms, start * 1000 // SAMPLE_RATE),
                      'end_ms': min(duration_ms, end * 1000 // SAMPLE_RATE), 'value': value, 'unit': unit})
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
            'duration_ms': duration_ms, 'items': items, 'limitations': [
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
        waveform = decode_waveform(path)
        with _model_lock:
            model, detect = load_gate()
            spans = detect(waveform, model, sampling_rate=SAMPLE_RATE,
                           min_speech_duration_ms=100, speech_pad_ms=30, threshold=.5)
        return measure_waveform(waveform, spans, attempt_id=attempt_id, audio_hash=audio_hash,
                                duration_ms=duration_ms, text=text, language=language)
    except Exception:
        return _empty('unavailable', attempt_id, audio_hash, duration_ms, 'Audio decoding or speech measurement failed.')
