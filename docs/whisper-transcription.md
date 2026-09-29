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
  The integration owner must persist it privately for evaluation and expose only
  the agreed public transcript fields. No database persistence is implemented here.
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

The dependency manifests now include the official SDK; coordinate these shared-file
changes with the integration owner before merge. Upload endpoints, successful-attempt
reuse, worker orchestration, raw-response persistence, and mobile UI remain separate work.

## Live synthetic-audio result (2026-09-29)

A real whisper-1 call on the 23.902-second Korean TTS fixture succeeded with
38 word records. Transcript content matches the script ignoring whitespace and
punctuation. All normalized word times passed alignment duration validation.
Synthetic slide transitions at 0/8/16 seconds produced 12/13/13 words per visit.
One word had equal start/end times from the provider; perceptual timing accuracy
and human recordings still need evaluation. Raw results remain in ignored media/.
