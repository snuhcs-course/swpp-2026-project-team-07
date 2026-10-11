# Hosted Whisper adapter

`backend/rehearsals/services/transcription.py` implements `transcribe(Path)` using
OpenAI's Python SDK and hosted `whisper-1`. It requests `verbose_json` with
`timestamp_granularities=["word"]`, as described in the
[official speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text)
(checked 2026-09-29).

## Behavior and integration boundary

- Input: an existing audio file. The adapter checks the extension and a conservative
  decimal 25 MB size cap (25,000,000 bytes), not the actual codec; provider decoding
  errors remain failures. Accepted extensions: mp3, mp4, mpeg, mpga, m4a, wav, webm.
- Output: `{text, words: [{text, start_ms, end_ms}], raw_response}`. Original text
  and parsed provider response are retained. Seconds become integer milliseconds
  using nearest rounding, with half milliseconds rounded upward.
- `raw_response` is an internal backend-only result, not a public API addition.
  The processing worker persists it privately in `ProviderRequest` before normalization and exposes only the agreed public transcript fields. The standalone adapter itself does not save database results.
- `align_words(result["words"], slide_events, duration_ms)` provides the next step.
  Alignment checks words against actual recording duration. No timestamps are
  silently clamped to make a recording fit.
- Missing/malformed timestamps fail explicitly; an empty text and empty word list
  are accepted. This is not a guarantee of silence detection or recognition quality.
- Provider requests use a 120-second timeout and no SDK retries. The worker must
  reuse saved successful transcription and guard duplicate processing requests;
  calling this adapter again sends another request.
- Errors use `TranscriptionError.code` and a safe message: missing_api_key,
  unsupported_audio, audio_unavailable, invalid_audio_size, invalid_response,
  provider_auth, provider_rate_limit, provider_timeout, provider_connection,
  provider_error. Source audio is never deleted or rewritten.

## Real-audio check

1. Install `backend/requirements.txt` in the backend virtual environment as in README.
2. Set `OPENAI_API_KEY` in ignored `backend/.env`; never paste the key into a chat
   or put it in mobile configuration. Django loads this file on startup.
3. Place a short recording you are permitted to send to OpenAI in `backend/media/`
   (ignored by Git), for example `media/whisper-test.m4a`.
4. From `backend/`, run the following. This sends the recording to OpenAI and
   incurs API usage. Output contains your transcript; keep it private.

```sh
.venv/bin/python manage.py shell --settings=config.test_settings -c \
  'from pathlib import Path; from pprint import pprint; from rehearsals.services.transcription import transcribe; result = transcribe(Path("media/whisper-test.m4a")); pprint({"text": result["text"], "words": result["words"]})'
```

Listen to the audio and compare the full transcript and several word start/end
positions, including slide transitions. Record actual results and any inaccuracies;
mocked tests are not recognition-quality evidence. No server/worker needs to run
for this direct adapter check, and it does not save an attempt to the database.

## Automated checks

From `backend/` with dependencies installed:

```sh
python manage.py test rehearsals.test_transcription rehearsals.test_alignment --settings=config.test_settings
```

Tests use the real SDK with a mocked HTTP transport, inspect multipart parameters,
verify millisecond conversion and alignment, and cover silence, missing/invalid
word data, file validation, missing credentials, HTTP failures, and network failures.
They neither upload recordings nor incur provider usage.

The current worker uses `prepare_request` → durable submitted marker → `request_raw` → private raw save → normalization → transcript save → alignment. Standalone `transcribe` remains compatible and bypasses the worker's VAD/duplicate protection; use the saved-attempt flow for the coordinated pilot. A packaged Silero CPU gate prevents calls for detected no-speech, and saved raw/transcripts resume without provider work. See [api-contract.md](api-contract.md) for retry/uncertainty rules. No live check of this newly integrated pipeline is claimed here.

No-speech also runs alignment and timing metrics after durably saving the empty transcript and gate outcome. Visits keep empty word lists, repeated/backward/zero-duration visits and the original recording end; rate components are empty and language is `und`. Completion, manual retry after alignment failure and recovery after a worker exit perform no provider call for this saved gate outcome.

## Packaged gate dependency assessment (2026-10-08)

The coordinator-provided baseline, candidate and patched audit reports contain 0, 8 and 2 advisories respectively. Updating the matched Torch/Torchaudio pair from 2.8.0 to 2.10.0 removes six reported advisories. `uv pip compile` regenerated the repository lock with all unrelated pins preserved. This does **not** establish an audit-clean dependency set: [PYSEC-2026-139](https://github.com/pypa/advisory-database/blob/main/vulns/torch/PYSEC-2026-139.yaml) concerns PT2 loading and [PYSEC-2025-194](https://github.com/pypa/advisory-database/blob/main/vulns/torch/PYSEC-2025-194.yaml) concerns `torch.jit.script`. The patched audit lists no fixed version for the former and 2.13.0 for the latter; the coordinator reports that a matching Torchaudio 2.13.0 pair is unavailable.

Source-path assessment: `backend/rehearsals/services/speech_gate.py` calls `load_silero_vad(onnx=True)`. Installed Silero 6.2.0's `model.py` selects the bundled `silero_vad.data/silero_vad.onnx` through package resources and constructs `utils_vad.OnnxWrapper(..., force_onnx_cpu=True)`, which uses ONNX Runtime's CPU execution provider. Torch supplies tensors/state operations to `get_speech_timestamps`; the app decodes uploaded audio through PyAV. The current path does not load PT2/pickle or JIT models, compile user code with `torch.jit.script`, or accept an uploaded model path. Silero's alternate JIT loader and downloading `Validator` helper exist in the dependency but are not called by this gate. This source inspection supports limited exposure through the current gate, not removal of the vulnerabilities from the installed package.

Residual risk remains if later code enables affected loading/scripting paths or the local dependency/model environment is compromised. Keep the gate on its packaged CPU ONNX path; reassess the advisories and compatible pins before adding model-loading behavior. The synthetic-silence regression checks a fresh CPU model load with network, PT2/pickle/JIT loading and JIT compilation forbidden during inference. The coordinator installed the exact regenerated lock and verified the packaged gate in Linux arm64 Python 3.12, plus the host PostgreSQL/Redis/Celery workflow. The final audit still reports these two advisories; see [coordinator evidence](ai-use.md#2026-10-08--hosted-processing-coordinator-verification-and-publication).

## Live synthetic-audio result (2026-09-29)

A real whisper-1 call on the 23.902-second Korean TTS fixture succeeded with
38 word records. Transcript content matches the script ignoring whitespace and
punctuation. All normalized word times passed alignment duration validation.
Synthetic slide transitions at 0/8/16 seconds produced 12/13/13 words per visit.
One word had equal start/end times from the provider; perceptual timing accuracy
and human recordings still need evaluation. Raw results remain in ignored media/.
