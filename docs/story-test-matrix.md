# Story-to-Test Matrix

Reported bugs are scheduled for Iteration 3 follow-up. Numerical performance, recognition, feedback-quality and cost targets will come from Iteration 3 pilot measurements; owners, exact dates and target values remain unset.

Updated October 23, 2026 · Acceptance-criteria baseline: repository v2.0 (October 9); current requirements: v3.0 (October 23). PR31 case links point to `f1af9dd`; merged-main CI ran `c4a3f48`.

[CI](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984) passed 548 mobile and 554 PostgreSQL backend tests. The rows below distinguish automated evidence from remaining acceptance checks. The final-product requirements do not mean every feature is due in Iteration 2. The team has not recorded acceptance from these automated results.

Use this page to choose increment scope and record manual/quality results. [Teammate findings](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings) add device observations and proposals; exact builds, complete case evidence and final retests remain incomplete. See [Testing Documentation](testing.md) for execution records.

## B09 Follow-up (Tested October 20; Published October 21)

Published October 21: [fix/retry-recording](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/fix/retry-recording), code/evidence commit `3ae9d16`; original device/test evidence below remains dated October 20. No new CI or acceptance result is inferred.

B09 adds five regressions for first Redo, repeated retakes/timer wiring, cancellation, duplicate taps and full-presentation Redo. All five passed; the separate local mobile run passed 553 tests. The automated tests use native audio/UI fixtures. Codex's Galaxy S25 check passed three consecutive retakes, Keep/Overwrite selection and selected-audio playback. The seven-second timer freeze remains unreproduced. SQLite tests cover file/ID retention; human acceptance remains pending. See [Testing Documentation](testing.md) and the [B09 spec](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/3ae9d162d53088a129bffaf15a915400480a6483/docs/b09-retry-recording.md).

## Acceptance criteria

### AC-01a: Import a valid PDF (Positive)

- Existing tests: PDF import, storage and page preparation.
- Remaining: On the phone, import three numbered pages and confirm their order after reopening.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L104)

<details>
<summary>Linked tests</summary>

- **Integration**: [import copies the source and persists the selected PDF for later reads](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/pdf-import.test.mjs#L31)
- **Integration**: [test_pdf_is_prepared_locally_and_reused](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_storage.py#L46)

</details>

### AC-01b: Reject an unusable file (Negative)

- Existing tests: Empty, oversized, disguised files and invalid uploads.
- Remaining: Check encrypted/corrupt PDFs and the Android error/retry path.
- Acceptance status: Partial evidence; reported device failure JY01 needs a fix/retest.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L108)

- Device evidence: JY01 records two malformed-PDF upload HTTP 500 responses on Galaxy Tab S7 FE. Raw log/input and controlled-error regression/retest remain missing. [Record](testing-evidence/iteration-2-supporting-records.md#jooyoung-pdf-upload-failure).

<details>
<summary>Linked tests</summary>

- **Integration**: [empty and disguised non-PDF input fail without saving an entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/pdf-import.test.mjs#L41)
- **Integration**: [test_invalid_and_oversized_decks](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_storage.py#L79)

</details>

### AC-01c: Cancel file selection (Negative)

- Existing tests: Picker cancellation without a new presentation.
- Remaining: Confirm cancellation in the Android file picker.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L112)

<details>
<summary>Linked tests</summary>

- **Integration**: [cancelled picker does not create a catalog or substitute sample data](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/pdf-import.test.mjs#L25)

</details>

### AC-02a: Record repeated slide visits (Positive)

- Existing tests: Repeated/backward visits and word-to-slide alignment.
- Remaining: Record slides 1, 2, then 1 on the phone. Check timing and spoken content.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L123)

- Device evidence: JJ02 raises backward-visit alignment concerns; SY01 records indistinguishable first/return visits. Retest recorded timestamps and displayed visits. Disabling backward navigation remains a proposal. [Record](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings).

<details>
<summary>Linked tests</summary>

- **Unit**: [native audio time retains initial, forward, backward and simultaneous visits](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/recording-timeline.test.mjs#L21)
- **Unit**: [test_boundaries_crossing_words_and_backward_visit](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_alignment.py#L19)
- **Component/UI**: [countdown/capture keep Cues visible, disable Play and update both slide directions against capture](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/recording-cues-runtime.test.mjs#L50)

</details>

### AC-02b: Microphone permission denied (Negative)

- Existing tests: Denied permission blocks recording setup.
- Remaining: Deny/revoke microphone access on Android and check recovery instructions.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L127)

<details>
<summary>Linked tests</summary>

- **Unit**: [permission denial prevents capture preparation and does not create a timeline](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/recording-timeline.test.mjs#L63)

</details>

### AC-02c: Recording interrupted (Negative)

- Existing tests: Saved checkpoints and interruption recovery with fixtures.
- Remaining: Check calls, lock/background and process termination. Play the recovered audio.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L131)

<details>
<summary>Linked tests</summary>

- **Integration**: [SQLite persists checkpoint/audio and interrupted uploads through a new process](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/attempt-storage.test.mjs#L46)
- **Integration**: [checkpoint and finalization failures preserve the last durable URI and timeline](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/storage-failures.test.mjs#L34)
- **Component/UI**: [interrupted recovery preserves the current slide cues through the existing recovery interface](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/recording-cues-runtime.test.mjs#L72)

</details>

### AC-02d: Leave while recording (Negative)

- Existing tests: The app blocks Back during recording.
- Remaining: Implement and test stop/save/discard confirmation in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L135)

<details>
<summary>Linked tests</summary>


</details>

### AC-03a: Play a transcript segment (Positive)

- Existing tests: Evidence ranges and ordered playback seeks.
- Remaining: Listen on the phone and check slide/audio timing and seeking.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L146)

- Device evidence: SY02 records inconsistent Play controls; SY04 records intermittent audio with a blank screen, not reproduced in the later investigation. [Record](testing-evidence/iteration-2-supporting-records.md#seoyeon-phone-observations).

<details>
<summary>Linked tests</summary>

- **Component/UI**: [slide playback sequences visits; pause/resume and sentence tap-again still work](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/segment-player.test.mjs#L102)
- **Component/UI**: [evidence displays its finding and original interval, plays only that validated source range, and pauses/resumes without seeking again](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/take-evidence-playback.test.mjs#L24)

</details>

### AC-03b: Slide without recognized speech (Negative)

- Existing tests: No-speech states preserve audio.
- Remaining: Implement and test the spoken-summary no-speech state in Iteration 3.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L150)

<details>
<summary>Linked tests</summary>

- **Integration**: [test_no_speech_completes_without_provider_and_keeps_audio_events](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_processing.py#L131)
- **Unit**: [test_missing_and_empty_transcript_are_explicit_preflight](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_feedback.py#L204)

</details>

### AC-03c: Repeated visits to one slide (Positive)

- Existing tests: Repeated visits and exact playback boundaries.
- Remaining: Confirm the phone plays the requested visit, including silent transitions.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L154)

- Device evidence: SY01 records indistinguishable first/return visits in the transcript view. A final-build personal retest is not retained. [Record](testing-evidence/iteration-2-supporting-records.md#seoyeon-phone-observations).

<details>
<summary>Linked tests</summary>

- **Unit**: [sentences retain their first or return visit and exact-boundary source playback](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/transcript-visits.test.mjs#L20)
- **Component/UI**: [playback skips empty visits while retaining repeated positive-duration visits in order](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/segment-player.test.mjs#L130)

</details>

### AC-03d: Separate key ideas (Positive)

- Existing tests: Original transcript words and slide-derived key ideas.
- Remaining: Implement and test a separate summary of what the presenter said in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L158)

<details>
<summary>Linked tests</summary>

- **Unit**: [silent first visits still count; moving a sentence preserves provenance and ignores archived text rewrites](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/transcript-visits.test.mjs#L36)

</details>

### AC-03e: Summary could not be generated (Negative)

- Existing tests: Audio and transcript survive later failures.
- Remaining: Implement and test the speech-summary failure path in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L162)

<details>
<summary>Linked tests</summary>

- **Integration**: [PDF failure is independent of successful audio; invalid page bounds and unsafe URLs never fetch](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/review-media.test.mjs#L139)

</details>

### AC-05a: Feedback for a selected slide, with evidence (Positive)

- Existing tests: Evidence bounds, quoted speech and feedback actions.
- Remaining: Check that feedback explains a real slide/speech contradiction, such as increase versus decrease.
- Acceptance status: Needs quality pilot.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L173)

<details>
<summary>Linked tests</summary>

- **Unit**: [test_exact_span_and_boundary_crossing_derive_times](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_feedback.py#L92)
- **Integration**: [test_excerpt_retains_full_fact_and_its_negation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_review_evidence.py#L52)
- **Component/UI**: [evidence displays its finding and original interval, plays only that validated source range, and pauses/resumes without seeking again](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/take-evidence-playback.test.mjs#L24)

</details>

### AC-05b: Reject invalid evidence (Negative)

- Existing tests: Foreign/out-of-range evidence rejection and disabled invalid playback.
- Remaining: Reuse passing CI. Record a valid peer finding beside invalid evidence if claiming that UI behavior.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L177)

<details>
<summary>Linked tests</summary>

- **Unit**: [test_input_types_unknown_fields_timestamps_and_bounds_fail_closed](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_feedback.py#L176)
- **Unit**: [reject responses for other takes, visit selections and oversized summaries](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/slide-review.test.mjs#L23)
- **Component/UI**: [invalid evidence is explicit and cannot start playback](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/review-recording-tools.test.mjs#L62)

</details>

### AC-05c: Respect the practiced slides (Negative)

- Existing tests: Selected-visit scope and partial-attempt score rules.
- Remaining: Check how the provider treats unpracticed slides and decorative content.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L181)

<details>
<summary>Linked tests</summary>

- **Unit**: [scope preserves first/return visits and ignores run labels](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/slide-review.test.mjs#L9)
- **Unit**: [test_partial_attempt_keeps_recorded_slides_without_overall](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_score_v2.py#L118)

</details>

### AC-07a: Plain wording for nontechnical clients (Positive)

- Existing tests: Audience context and audience-feedback validation.
- Remaining: Have a human judge the nontechnical-client explanation, including the p95 example.
- Acceptance status: Needs quality pilot.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L190)

<details>
<summary>Linked tests</summary>

- **Integration**: [requirements persist separately per presentation and API address](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/presentation-requirements.test.mjs#L32)
- **Unit**: [test_optional_audience_only_and_bounded_actionable_fields](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_feedback.py#L306)

</details>

### AC-07b: No audience described (Negative)

- Existing tests: Cleared audience settings and rejected absent-audience findings.
- Remaining: Clear the default General audience; check the resulting provider output and UI.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L194)

<details>
<summary>Linked tests</summary>

- **Integration**: [test_no_audience_cannot_create_audience_finding](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_slide_review.py#L93)
- **Integration**: [missing, partial, and explicitly provided requirements remain distinct](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/presentation-requirements.test.mjs#L56)

</details>

### AC-07c: Simpler explanation for students (Positive)

- Existing tests: Saved audience settings reach feedback generation.
- Remaining: Have a human judge whether the explanation fits the chosen student level.
- Acceptance status: Needs quality pilot.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L198)

<details>
<summary>Linked tests</summary>

- **Integration**: [test_context_change_invalidates_without_new_jobs](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_slide_review.py#L60)
- **Integration**: [client checks response identity and saves only successful validated updates](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/presentation-requirements.test.mjs#L105)

</details>

### AC-06a: Pace and duration for one slide (Positive)

- Existing tests: Pace arithmetic, timing summaries and source measurements.
- Remaining: Add/check the exact per-slide example: 60 words in 30 seconds gives 120 WPM.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L209)

<details>
<summary>Linked tests</summary>

- **Unit**: [home stats and compare rows come from the merged transcript](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-domain.test.mjs#L147)
- **Integration**: [test_waveform_measurements_keep_pause_and_signal_times_without_quality_grade](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_score.py#L358)

</details>

### AC-06b: Pace or pauses unavailable (Negative)

- Existing tests: Silent/invalid audio and zero-duration evidence handling.
- Remaining: Check pause rules and unavailable labels in the phone UI.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L213)

<details>
<summary>Linked tests</summary>

- **Component/UI**: [zero-duration evidence never creates a native seek or fabricated playback interval](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/segment-player.test.mjs#L122)
- **Integration**: [test_invalid_silent_or_short_audio_never_fabricates_measurements](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_score.py#L383)

</details>

### AC-06c: Filler results unavailable (Negative)

- Existing tests: Pending/failed results and text-based filler counts.
- Remaining: Check that unavailable filler results do not appear as zero or Spot On.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L217)

<details>
<summary>Linked tests</summary>

- **Integration**: [current successful and partial findings replace quality scores; failures never count as clean](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/feedback-status.test.mjs#L18)
- **Unit**: [fillers are whole words, including Korean hesitation sounds](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-domain.test.mjs#L28)

</details>

### AC-06d: Total time for a revisited slide (Positive)

- Existing tests: Repeated slide intervals and timing summaries.
- Remaining: Add/check the displayed example: two visits of 10 and 20 seconds total 30 seconds.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L221)

- Device evidence: JJ02 concerns slide/transcript alignment during backward visits; no measured per-slide duration failure was supplied. Keep the timing check open. [Record](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings).

<details>
<summary>Linked tests</summary>

- **Unit**: [test_boundaries_crossing_words_and_backward_visit](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_alignment.py#L19)
- **Unit**: [native audio time retains initial, forward, backward and simultaneous visits](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/recording-timeline.test.mjs#L21)

</details>

### AC-06e: Flag filler words and pauses (Positive)

- Existing tests: Whole-word filler matching, Scribe filler tokens and internal pause measurements.
- Remaining: Check visible filler/pause flags and detector accuracy against human audio.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L225)

<details>
<summary>Linked tests</summary>

- **Unit**: [fillers are whole words, including Korean hesitation sounds](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-domain.test.mjs#L28)
- **Unit**: [test_scribe_keeps_fillers_and_ignores_spacing_and_audio_event_tokens](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_transcription.py#L189)
- **Integration**: [test_waveform_measurements_keep_pause_and_signal_times_without_quality_grade](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_score.py#L358)

</details>

### AC-08a: Retry one slide (Positive)

- Existing tests: New retake identity and restoration of the previous run.
- Follow-up: B09’s agent-operated Galaxy S25 check verified consecutive retakes, Keep/Overwrite UI selection and selected-audio playback on the separate fix. Automated SQLite tests cover original-file/ID retention.
- Remaining: Integrate/retest the fix and check original transcript/feedback access; the full criterion remains unaccepted.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L238)

- Device evidence: JY04 records Rerecord playing audio on a valid PDF. Its relation to B09 is unconfirmed; keep separate until reproduced. [Record](testing-evidence/iteration-2-supporting-records.md#jooyoung-pdf-upload-failure).

<details>
<summary>Linked tests</summary>

- **Integration**: [each capture owns one UUID, distinct from local deck identity; finalization preserves visits](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/attempt-storage.test.mjs#L14)
- **Unit**: [redoing one slide replaces only that slide, and keeping the old take restores the run exactly](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-takes.test.mjs#L30)

</details>

### AC-08b: No slide selected (Negative)

- Existing tests: Retry starts from a selected slide or whole rehearsal.
- Remaining: Implement and test the required empty-selection checklist in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L242)

<details>
<summary>Linked tests</summary>


</details>

### AC-08c: Compare slide 2 in two attempts (Positive)

- Existing tests: Comparison navigation and Keep/Overwrite decisions.
- Remaining: Implement and test the full two-attempt audio/transcript/feedback viewer in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L246)

<details>
<summary>Linked tests</summary>

- **Component/UI**: [comparison confirmation reviews the selected slide; Back keeps old audio and returns to rehearsal](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/ai-overview-screens.test.mjs#L95)
- **Unit**: [keeping the new take leaves the merged run and clears the comparison](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-takes.test.mjs#L50)

</details>

### AC-08d: No shared slide (Negative)

- Existing tests: Run parts stay bound to their presentation.
- Remaining: Implement the attempt picker and test the no-shared-slide error in Iteration 3.
- Acceptance status: No direct test found.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L250)

<details>
<summary>Linked tests</summary>

- **Unit**: [a whole redo replaces every slide and compares all of them](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-takes.test.mjs#L59)

</details>

### AC-08e: Feedback missing for one attempt (Negative)

- Existing tests: Pending comparison states and original-run selection.
- Remaining: Check missing-feedback labels and access to both attempts with the Iteration 3 comparison work.
- Acceptance status: Partial evidence.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L254)

<details>
<summary>Linked tests</summary>

- **Unit**: [home stats and compare rows come from the merged transcript](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/redesign-domain.test.mjs#L147)

</details>

### AC-10a: Reopen a saved attempt (Positive)

- Existing tests: SQLite reopening, review history and retained media.
- Remaining: Terminate/relaunch the phone app and check offline restoration.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L265)

<details>
<summary>Linked tests</summary>

- **Integration**: [API-scoped history, deck, analysis and media metadata survive a fresh process without creating a local capture](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/review-history.test.mjs#L98)
- **Integration**: [SQLite persists checkpoint/audio and interrupted uploads through a new process](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/attempt-storage.test.mjs#L46)

</details>

### AC-10b: Retry failed analysis (Positive)

- Existing tests: Same-recording retries, lost acknowledgements and uncertain-request controls.
- Remaining: Check real worker recovery and close the recorded scoring-retry findings.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L269)

<details>
<summary>Linked tests</summary>

- **Integration**: [lost audio acknowledgement retries the exact UUID/audio/visits and reuses the persisted PDF mapping](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/attempt-upload.test.mjs#L34)
- **Integration**: [test_manual_retry_revision_and_uncertainty_acknowledgement](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_processing.py#L270)
- **Integration**: [test_retries_are_single_consumption_and_uncertainty_requires_ack](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_coaching.py#L505)

</details>

### AC-10c: Later stage fails (Negative)

- Existing tests: Earlier results survive offline and late responses.
- Remaining: Check the phone recovery action for each failed stage the demo claims.
- Acceptance status: Evidence present.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L273)

<details>
<summary>Linked tests</summary>

- **Integration**: [offline failures preserve cached history, and late aborted responses cannot publish](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/review-history.test.mjs#L34)
- **Integration**: [test_failed_reanalysis_exposes_prior_suggestions_and_current_invalid_counts](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_coaching.py#L456)
- **Integration**: [a replacement validator failure preserves the previous good PDF and cleans the owned download](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/review-media.test.mjs#L97)

</details>

### AC-11a: Cancel or confirm deletion (Positive)

- Existing tests: PDF service removal only. Presentation Hide/Undo tests are pending ([H04–H05](mobile-zero-coverage-test-specs.md#h-home-screen)).
- Remaining: Implement and test full attempt/audio/result deletion in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L282)

- Device evidence: JJ04 records stale display numbering after deletion. This report does not establish complete data removal or identity corruption. [Record](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings).

<details>
<summary>Linked tests</summary>

- **Integration**: [removing an imported PDF deletes only its app copy and catalog entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/pdf-import.test.mjs#L58)

</details>

### AC-11b: Delete a deck with several attempts (Positive)

- Existing tests: PDF service removal only. Presentation Hide/Undo tests are pending ([H04–H05](mobile-zero-coverage-test-specs.md#h-home-screen)).
- Remaining: Implement and test full presentation deletion, including its attempts and media, in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L286)

<details>
<summary>Linked tests</summary>

- **Integration**: [removing an imported PDF deletes only its app copy and catalog entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/pdf-import.test.mjs#L58)

</details>

### AC-11c: Deletion cannot finish (Negative)

- Existing tests: PDF service removal only. Presentation Hide/Undo tests are pending ([H04–H05](mobile-zero-coverage-test-specs.md#h-home-screen)).
- Remaining: Implement and test recovery from incomplete data deletion in Iteration 3.
- Acceptance status: Implementation/spec gap.
- [Requirement source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/requirements-and-specifications.md#L290)

<details>
<summary>Linked tests</summary>

- **Integration**: [removing an imported PDF deletes only its app copy and catalog entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/pdf-import.test.mjs#L58)

</details>

## Additional implemented flows

### PR31-SETUP: Presentation audience and time settings

- Existing tests: Offline settings, validation and exact time allocation.
- Remaining: Check Save/clear/conflicts on the phone and stale-result handling.
- Acceptance status: Partial evidence.

- Device evidence: JJ03 raises visibility/optionality concerns for duration and audience controls. Existing persistence tests do not verify phone discoverability. [Record](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings).

<details>
<summary>Linked tests</summary>

- **Integration**: [server changes require explicit keep-mine or use-server](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/requirements-draft.test.mjs#L19)
- **Unit**: [required allocation uses exact integer seconds with stable slide-order tie breaks](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/required-timing.test.mjs#L14)

</details>

### PR31-CUES: Reusable slide cues

- Existing tests: Cue categories, evidence, length limits and cached reads.
- Remaining: Check graph/image-only slides and access to long cues on the phone.
- Acceptance status: Partial evidence.

- Device evidence: Seoyeon observed cues working after initial failures on October 15. This confirms limited display behavior, not cue usefulness or an all-flow pass. [Record](testing-evidence/iteration-2-supporting-records.md#seoyeon-phone-observations).

<details>
<summary>Linked tests</summary>

- **Component/UI**: [v5 accepts up to 25 words in either category and rejects 26 without truncation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/slide-profiles.test.mjs#L229)
- **Component/UI**: [current cached cues remain visible through a failed read and successful same-screen reconnect](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/slide-profiles-lifecycle.test.mjs#L129)

</details>

### PR31-CORRECTIONS: Recognition corrections

- Existing tests: Recognition edits, conflicts, original words and stale results.
- Remaining: Check correction, sync and refreshed advice/scores; resolve the recorded admission race.
- Acceptance status: Partial evidence.

- Device evidence: SY03 records inaccessible recognition choices for “Tajumulco”; exact installed build and final personal retest are missing. [Record](testing-evidence/iteration-2-supporting-records.md#seoyeon-phone-observations).

<details>
<summary>Linked tests</summary>

- **Integration**: [test_save_revision_noop_conflict_and_original_preservation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_corrections.py#L39)
- **Integration**: [only offered AI replacements are accepted locally; acceptance/restoration keep source timing and offline state](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/correction-sync.test.mjs#L190)
- **Component/UI**: [local correction invalidates cached score immediately, synchronizes before explicit update, and fences edits during preflight](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/presentation-score-workflow.test.mjs#L100)

</details>

### PR31-SCORING: Automatic scores and per-slide results

- Existing tests: Score arithmetic, evidence rules, request admission and UI states.
- Remaining: Verify fixes for provider/model-switch recovery and the correction-revision race. Review the separate local phone-demo fixes.
- Acceptance status: Partial evidence.

<details>
<summary>Linked tests</summary>

- **Integration**: [test_uncertain_submission_requires_explicit_revision_and_acknowledgement](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_scoring_lifecycle.py#L148)
- **Component/UI**: [first eligible transcript starts once automatically and persisted queued state survives remount](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/presentation-score-automatic.test.mjs#L31)
- **Unit**: [test_all_competent_is_67_with_exact_arithmetic](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_score_v2.py#L65)

</details>

### US-17 (repository optional): Audience Q&A

- Existing tests: Saved Q&A identity, consent, retries and screen navigation.
- Remaining: Check a spoken answer, reopening and provider failures. Have a human judge question/follow-up relevance.
- Acceptance status: Partial evidence.

- Device evidence: SY06 records offline/unavailable Q&A; SY07 records a blank screen when swiping to an unfinished question. Service conditions and recovery need retest. [Record](testing-evidence/iteration-2-supporting-records.md#seoyeon-phone-observations).

<details>
<summary>Linked tests</summary>

- **Integration**: [test_answer_binding_preserves_question_generation_and_duplicate_evaluation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_durable_qa.py#L108)
- **Integration**: [durable answer consent blocks a new upload and preserves its identity for continuation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/durable-qa-client.test.mjs#L69)
- **Component/UI**: [opening and reopening read only; concurrent explicit requests reuse one admitted job](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/durable-qa-workflow.test.mjs#L21)

</details>

## Quality requirements

### NFR-01: Data integrity

- Existing tests: Recording identity and invalid-source rejection.
- Remaining: Check preservation through retakes, corrections, failures and restart on the phone.
- Acceptance status: Check needed.

- Device evidence: JJ02/SY01 concern visit association/display; JJ04 concerns display numbering. The reports do not establish lost saved data or changed presentation identity. [Record](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings).

<details>
<summary>Linked tests</summary>

- **Integration**: [test_valid_audio_deck_or_timeline_conflicts_never_change_winner](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_storage.py#L141)
- **Unit**: [test_binding_cannot_move_valid_indices_to_another_attempt](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_presentation_evidence_selection.py#L70)

</details>

### NFR-02: Responsiveness

- Existing tests: Pending/offline UI states.
- Remaining: Set response-time targets from Iteration 3 pilot measurements on the target devices.
- Acceptance status: Check needed.

- Device evidence: JJ01 records Home/transition stutter; JY02/JY05 record lag and unresponsive controls around the upload error. No latency/FPS threshold measurement or causal isolation was supplied. [Record](testing-evidence/iteration-2-supporting-records.md#jooyoung-pdf-upload-failure).

<details>
<summary>Linked tests</summary>

- **Integration**: [audio timeout aborts transport and a later retry retains exactly the submitted metadata](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/attempt-upload.test.mjs#L257)
- **Integration**: [all feedback surfaces explain active stages and long waits using server time](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/feedback-status.test.mjs#L108)

</details>

### NFR-03: AI quality and transparency

- Existing tests: Grounding rules, malformed-result rejection and ungraded UI.
- Remaining: Evaluate correctness, false positives, audience usefulness and score calibration with humans.
- Acceptance status: Check needed.

<details>
<summary>Linked tests</summary>

- **Unit**: [test_uncertain_or_inexact_slide_evidence_is_discarded](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_feedback.py#L300)
- **Component/UI**: [Review keeps findings separate from ungraded performance, page scroll, selected-source evidence and tappable navigation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/ai-overview-screens.test.mjs#L21)

</details>

### NFR-04: Recovery

- Existing tests: PostgreSQL tests and simulated queue/receipt recovery.
- Remaining: Check real worker termination and Android interruptions.
- Acceptance status: Check needed.

- Device evidence: JY01 records unhandled upload errors; JY03–JY05 record later upload/retry/input symptoms. A shared cause and recovery pass remain unconfirmed. [Record](testing-evidence/iteration-2-supporting-records.md#jooyoung-pdf-upload-failure).

<details>
<summary>Linked tests</summary>

- **Integration**: [test_missed_publish_is_durable_and_scheduler_republishes](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_processing.py#L315)
- **Integration**: [test_lost_broker_claim_expiry_and_duplicate_delivery](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_coaching.py#L749)

</details>

### NFR-05: Privacy

- Existing tests: Scribe audio/hint consent and Q&A consent recovery.
- Remaining: Implement full deletion and pre-upload rehearsal disclosure in Iteration 3; test cancellation and review consent for the claimed provider actions.
- Acceptance status: Check needed.

<details>
<summary>Linked tests</summary>

- **Unit**: [old OpenAI and audio-only Scribe consent do not authorize slide-keyterm submission](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/transcription.test.mjs#L222)
- **Integration**: [durable answer consent blocks a new upload and preserves its identity for continuation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/durable-qa-client.test.mjs#L69)

</details>

### NFR-06: Compatibility, usability and accessibility

- Existing tests: Component labels, reduced motion and layout fixtures.
- Remaining: Record target-device checks with large text and TalkBack. Prior agent phone checks have a narrower scope.
- Acceptance status: Check needed.

- Device evidence: JJ05 proposes a UI consistency pass; JJ06 proposes tutorial/help onboarding. SY02/SY05 report control/navigation issues. Proposals do not change the current acceptance criteria. [Record](testing-evidence/iteration-2-supporting-records.md#jaewon-galaxy-s22-findings).

<details>
<summary>Linked tests</summary>

- **Component/UI**: [reduced motion settles the entrance and keeps it opaque after motion is restored](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/frame-entrance-runtime.test.mjs#L40)
- **Component/UI**: [rotation removes Cues and Play from accessibility/interactions, retains PDF navigation and restores the selected slide](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/tests/recording-cues-runtime.test.mjs#L59)

</details>

### NFR-07: Cost and maintainability

- Existing tests: Cached reads, duplicate-request guards, receipts and quotas.
- Remaining: Record costs, response times and provider-call counts for the tested flows.
- Acceptance status: Check needed.

<details>
<summary>Linked tests</summary>

- **Integration**: [test_cache_hit_only_coaching_and_read_current_post_do_no_work](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_coaching.py#L108)
- **Integration**: [test_raw_saved_crash_resumes_without_provider](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/backend/rehearsals/test_processing.py#L348)

</details>
