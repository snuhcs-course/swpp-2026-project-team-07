# Iteration 2 Implementation Review (Zoom)

2026-10-16 · Iteration 2 · [Published entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Daily-Standup-Meeting-Log#2026-10-16--iteration-2-implementation-review-zoom)

**Created:** 2026-10-17
**Updated:** 2026-10-17

#### Participants and objective

- **Time / location:** 10:00 PM (Asia/Seoul), Zoom.
- **Participants:** Everybody attended.
- **Objective:** Review implementation progress and agree on follow-up work before Monday's presentation.

#### Agenda

- Transcription and UI progress.
- Presentation feedback, scoring and review flow.
- Documentation and presentation readiness.

#### Notes

Each member's update combines the meeting notes with PR/source checks made October 17. Later additions are dated inline. Contributions include AI assistance recorded in the project's collaboration log.

**Injoon — audio transcription · [PR #30](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/30), merged October 16 at 11:27 PM KST**

- Compared Whisper-1, Scribe v2 and Gemini (recorded as “Gemini 3.5”; model name to confirm). In the reported trials, Whisper omitted fillers and Scribe captured them best at the lowest cost. Test conditions and measured costs were not recorded.
- Integrated Scribe v2 for rehearsal and Q&A-answer transcription, with word timestamps, filler-preservation settings and up to 100 vocabulary hints extracted from visited slides. Code-switching support was reported at the meeting; its recognition quality was not measured in this check.
- Added renewed audio/slide-hint consent, saved request options and recovery support, retained old Whisper transcripts, and fixed PDF imports containing NUL characters in extracted text.

**Jaewon — UI · [PR #29](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/29), merged October 16 at 11:07 PM KST**

- Implemented the Home carousel and presentation management, import-time duration/audience setup, light/dark themes, Full Review and slide Review, synchronized audio/transcript playback, and retakes with Keep/Overwrite comparison.
- Added the original audience Q&A flow: question generation, recorded answers and evaluation.
- Added rendering optimizations and PDF rotation within a portrait app. Smoothness and layouts across screen sizes were not revalidated.
- Remaining in this merged baseline: Back and previous-slide navigation are blocked during recording; Stop opens slide Review; presentation icons and the slide fold remain. Replacing icons with presentation title screens and removing the fold were requested changes.

**Seoyeon — AI feedback · [PR #28](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/28) and [PR #31](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31), open/unmerged as checked October 17**

- Added grounded Must Cover/Go Deeper cues, presentation requirements and timing targets, recognition-only transcript corrections, evidence-linked slide feedback, and durable Q&A with saved identities and retry recovery.
- Integrated these features with Jaewon's UI before the meeting. The newer PR #31 combines that work with Injoon's Scribe implementation, preserving their respective contributions.
- Meeting discussion proposed overall presentation feedback and a small model to score it against a rating rubric.
- **October 17 additions:** automatic whole-presentation/per-slide rubric scoring, compact feedback and recovery improvements, and editing an existing presentation's time and audience.
- PR #31 also implements the requested first-attempt flow: the first saved take opens Full Review, where individual slides can be selected; later takes open slide Review, with retake comparison handled separately. [Routing source](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/src/domain/run.ts#L143).
- “Slides assessed” counts recorded slides with completed, current, verified feedback. Rubric scores are a separate measure. [Count definition](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/mobile/src/features/feedback/selectedSlideFeedback.ts#L17).

**Jooyoung — documentation**

- Raised whether the many archives and validation documents should be kept. Retention remains unresolved; PR #31's collaboration-log consolidation does not settle that question.

The PR merges occurred after the meeting's 10:00 PM start. This documentation check inspected source and delivery status; it did not rerun application tests, device checks or provider benchmarks.

#### Decisions

- All follow-up work is due **October 17–18** for the presentation due **Monday, October 19**.
- Final agreement on the scoring rubric and documentation-retention policy was not recorded.

#### Actions

Updated October 17 using the user's corrections and repository checks. Individual task assignments were not recorded.

| Follow-up | Due date |
| --- | --- |
| Resolve recording navigation and review the remaining title-screen, fold and screen-size changes. | 2026-10-17–18 |
| Validate PR #31's scoring, editable settings and first-attempt review flow. | 2026-10-17–18 |
| Investigate delayed transcripts, AI feedback, audience Q&A and cues; results should appear promptly. | 2026-10-17–18 |
| Decide which archives and validation documents to retain. | 2026-10-17–18 |
| Prepare Monday's presentation. | 2026-10-17–18 |

#### Next check-in

- **Next meeting:** Not recorded.
- **Presentation due:** Monday, October 19, 2026.
- **Source:** User-supplied meeting notes and corrections, supplemented by the October 17 PR/source check.
