# Continuous Android recorder

The local Expo module autolinks from `mobile/modules`; rebuild the Android app after adding it. `index.ts` reports `available() === false` on an older APK so capture can select the existing Expo recorder before opening the microphone.

One `AudioRecord` reads PCM16 mono at 16 kHz into a native ring buffer. A 20 ms read block feeds the full WAV and the current segment WAV. `transition()` changes only the writer and slide journal; it does not pause, stop, release or replace the microphone. Every timestamp comes from captured sample counts. Long visits rotate every 60 seconds without adding slide events. Full audio is bounded at 30 minutes (57,600,044 bytes); each segment is at most 1,920,044 bytes.

`status()` returns the complete manifest, including sealed segments, the current slide, audio time, metering and any capture error. A visit can span several segments. A slide becomes eligible for feedback only when it is no longer active and its relevant segments are ready; the caller owns that policy. Earlier visits stay in order when a slide is revisited.

The app-private `outloud-recordings/<uuid>/` directory retains full audio, segments and boundary journals. Each boundary is fsynced before new samples use it. WAV headers and a small state file are checkpointed once per audio second. Recovery rebuilds an incomplete segment from the full PCM file and persisted boundaries; it never reopens the microphone. The recovery API accepts only that app's own recording directory and refuses recovery during active capture. Audio files are not automatically deleted.

`start()` requires the existing microphone permission prompt to have completed. `stop()` waits for the capture thread to finish, writes the final headers and returns a finalized manifest. Capture errors retain the audio and report an error. App teardown finalizes the active recorder.

Run the executable file/timeline checks with JDK 17:

```sh
modules/outloud-recorder/tests/run.sh
```

The five checks exercise sample identity across transitions/revisits, early segment availability, long-visit splitting, zero-duration changes, process-death/tail recovery, and the thirty-minute bound. They use generated samples and do not prove physical microphone continuity; the phone test must still listen across slide transitions and inspect the full audio.
