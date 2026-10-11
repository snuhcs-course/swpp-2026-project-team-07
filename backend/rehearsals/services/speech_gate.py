"""Speech presence only. Packaged Silero CPU model; no downloads or transcription.

Adapted policy from prototype 33907d3: gate only recordings with no speech;
never trim or concatenate the uploaded audio sent to hosted Whisper.
"""
from array import array
from math import isfinite
from functools import lru_cache
from threading import Lock
import av
from .transcription import TranscriptionError

_model_lock = Lock()  # Silero keeps stream state; serialize inference within a process.
SAMPLE_RATE = 16000
MAX_SAMPLES = 601 * SAMPLE_RATE  # accepted codec tail, never an extended API timeline


@lru_cache(maxsize=1)
def load_gate():
    import torch
    from silero_vad import load_silero_vad, get_speech_timestamps
    torch.set_num_threads(1)
    return load_silero_vad(onnx=True), lambda audio, model, **options: get_speech_timestamps(torch.tensor(audio), model, **options)


def decode_waveform(path):
    waveform = array('f')
    with av.open(str(path)) as container:
        if not container.streams.audio:
            raise ValueError('No audio track')
        resampler = av.AudioResampler(format='flt', layout='mono', rate=SAMPLE_RATE)
        def collect(frames):
            for frame in frames:
                # Plane padding is not audio. Copy only the decoded mono float samples.
                waveform.frombytes(bytes(frame.planes[0])[:frame.samples * 4])
                if len(waveform) > MAX_SAMPLES:
                    raise ValueError('Audio exceeds limit')
        for frame in container.decode(audio=0):
            collect(resampler.resample(frame))
        collect(resampler.resample(None))
    if not waveform or not all(isfinite(value) for value in waveform):
        raise ValueError('Empty or invalid waveform')
    return waveform


def has_speech(path):
    try:
        waveform = decode_waveform(path)
        with _model_lock:
            model, detect = load_gate()
            # Short/quiet speech quality requires the coordinator's approved audio pilot.
            return bool(detect(waveform, model, sampling_rate=SAMPLE_RATE,
                min_speech_duration_ms=100, speech_pad_ms=30, threshold=0.5))
    except Exception:
        raise TranscriptionError('audio_check_failed',
            'Could not check this audio for speech. Verify the packaged VAD dependencies and audio, then retry. No audio was sent.') from None
