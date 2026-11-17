# Issue #49 investigation — November 3, 2026

**Confirmed cause: upload and grading disagree about acceptable audio-duration drift.** The reported recording exists and decodes. Grading rejects its 119 ms difference from the saved capture duration, then exposes the generic `audio_unavailable` error. Repeating grading preserves the same source and fails at the same validation step.

## Actual reported rehearsal

Matched the issue's 10-slide **Team 7 iteration1 progress report** deck and its full-run attempt on the existing Azure backend. Inspected metadata, frozen job diagnostics and audio length inside read-only PostgreSQL transactions; no audio/transcript content was exported.

| Measurement | Observed value |
| --- | --- |
| Saved capture duration | 271,073 ms / 271.073 seconds |
| Decoded audio | 4,335,259 samples at 16,000 Hz = 270,953.6875 ms |
| Difference | 119.3125 ms shorter than the capture metadata |
| Upload tolerance | ±1,000 ms |
| Grading measurement tolerance | ±100 ms |
| Recording file | Present, 2,223,020 bytes, M4A; finite/nonzero decoded waveform within the sample limit |
| Failed grading generations | Nine, all `audio_unavailable`; the actual file matches every frozen audio hash |
| Grading provider-request records | Zero |

The latest four grading snapshots explicitly retain: “Audio is invalid or its duration does not match the capture (100 ms tolerance).” This establishes the actual failure mechanism, rather than inferring missing audio from the public error. The live server still uses prompt v2.2; a prompt change cannot repair this pre-provider failure.

Source: `backend/rehearsals/services/storage.py:103–116` accepts a playable upload within 1 second; `presentation_measurements.py:23–27` instead rejects decoded length beyond 100 ms. `presentation_score_v2.prepare()` converts unavailable measurements to `audio_unavailable`. Fresh grading generations remeasure the unchanged recording/metadata and repeat the failure.

## Reproduction and independent checks

- **Backend: 2/2 focused tests passed.** A valid synthetic WAV lasting 271.120 seconds, declared as 271.000 seconds reproduced three failed grading generations with the exact public error and zero provider calls. Using its matching duration made measurements available. Separate boundary controls accepted ±100 ms and rejected ±101 ms. Nine completed slide reviews remained intact; a tenth review was deliberately failed independently to reproduce the reported aggregate state.
- **Mobile: 24/24 focused tests passed**, including two task-only reproductions. Three Retry grading clicks sent only presentation-score POSTs with revision fences 2, 3, 4. No audio upload, transcription or singleton-feedback repair occurred. A real-screen renderer reproduced 4:31, 9/10 assessed, 1 needs recovery and the error. This was a mocked renderer/API reproduction, not a new physical Galaxy S25 test.
- **Capture lifecycle: 8/8 existing tests passed.** Metadata freezes native recorder duration before stop and uploads it unchanged. Installed expo-audio 57.0.5 Android code derives that value from MediaRecorder wall-clock start/pause timing, rather than decoded samples. This explains a plausible drift source; the exact codec/device contribution to this capture's 119 ms discrepancy was not independently established.
- Relevant measurement, preparation, retry and decode function bodies match v5 commit `947715c` and current v7. V7's #44–46 changes do not fix this path.

## Separate feedback/recovery issue

The screenshot's 9/10 assessed count belongs to per-slide feedback, while whole-presentation grading separately requires acoustic measurements. The current ten per-slide job rows are completed; that alone does not prove all ten results are currently usable. Neither the historical count nor one failed slide establishes the whole-grade audio cause.

The selected UI makes recovery harder: Full Review shows the aggregate needs-recovery count, but a slide tile's detailed failure is exposed chiefly in its accessibility label. Opening that slide shows Analysis failed without a feedback retry control. A recovery control exists in `SlideReviewSummary`, but that component has no production caller. Grading Retry does not repair that separate feedback state.

## Future fix direction and limits

Align grading's duration policy with the established playable-upload contract, retaining finite-waveform, sample-limit, missing/corrupt-file and VAD/evidence-bound checks. Preserve original capture metadata, slide events, historical snapshots and receipts; explicit replacement grading must produce fresh diagnostics. If the measurement/protocol version changes, preserve exact predecessor compatibility for deliberate retries. Test drift in both directions, including a VAD interval wholly inside an accepted extra audio tail: clipping must drop empty intervals rather than create start=end evidence. Provide the precise validation reason and an appropriate recovery action instead of describing a readable recording as unavailable. No rerecording or metadata rewrite is indicated for this 119 ms case.

No fix was applied. No deployment, database/job update, new recording, issue comment, commit/push or provider request was performed by this investigation. The connected phone was only inventoried; it is a different model running v7, and the reporter's original Galaxy S25 capture was not recreated on hardware.

Local evidence: `outputs/issue49-investigation-20261103/`, including sanitized live inventory/diagnostics/hash comparisons, the exact read-only server scripts, backend reproduction and boundary controls, mobile request/screen traces and the capture-duration trace. Earlier source/local work remains preserved.
