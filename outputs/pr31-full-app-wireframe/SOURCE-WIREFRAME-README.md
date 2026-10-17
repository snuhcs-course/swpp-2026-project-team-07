# OutLoud — complete app wireframe from PR #31

This document records the initial source-derived pass, before the later actual-phone captures and branch-publication request. Its phone/source limits and no-publication statements describe that initial pass. See [the current artifact README](README.md) for the final screenshot package and verification.

Open [the source-derived wireframe board](source-wireframe-board.html), [the single-sheet SVG diagram](outloud-pr31-wireframe.svg), or [the 10-page PDF](outloud-pr31-wireframe.pdf). The newer [actual screenshot board](index.html) is the main diagram.

The diagram covers **all seven implemented app screens**, with **54 numbered wireframes**, **153 action/return links**, and **174 pinned source references**. Bracketed text is placeholder content; bar heights, waveforms, icons and phone outlines are schematic. Frames labelled `VARIANTS` group conditional messages or controls that do not all appear together.

| Group | Coverage |
| --- | --- |
| A | Home/library, empty state, icon picker, credits, delete/Undo, PDF entry |
| B | PDF progress/failure, duration/audience setup, custom input, sync conflict, rehearsal ready |
| C | Cue details/recovery, rotated PDF, countdown, recording, stop/completion |
| D | Redo choices, interrupted capture, recovery inspector, Scribe permission/retry |
| E | Full and slide review, missing audio, inline playback, correction choices/conflict |
| F | Numeric scoring, selected-slide feedback, evidence, recording/offline tools, unavailable states |
| G | Compare, recording-wide suggestions, slide descriptions/editor, AI permission/retry |
| H | Question preparation, question/TTS, countdown, answer capture, consent, saved answer processing |
| I | Answer evaluation, follow-up capture/review, archived Q&A, prerequisite/error/retry |

The interactive board keeps every frame visible and opens a larger inspection view when a phone is selected. Each view links to exact source lines and to its destination frames. The PDF uses one navigation page and nine groups of six wireframes; the SVG combines them into one zoomable diagram.

## Source

[PR #31](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31), head [`f1af9dd9737e2ac9adbe8a45186f0e2722863e60`](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/f1af9dd9737e2ac9adbe8a45186f0e2722863e60), checked October 17, 2026, Asia/Seoul. GitHub reported the PR open and unmerged when the source was selected. The authoritative screen union is `mobile/src/screens/shared.ts:12`.

The source was read from an isolated archive of that revision. The primary checkout's Home experiments were excluded. Home itself serves as the library; statistics and playback sit inside Home/Review/Full Review. All seven screen names are `home`, `upload`, `rehearse`, `review`, `full`, `compare`, and `qa`.

[Entry/capture inventory](source-entry-inventory.md) and [review/Q&A inventory](source-review-inventory.md) retain the implementation references and less common state variants. [frames.json](frames.json) is the editable diagram content. [build_wireframe.py](build_wireframe.py) generates the board and SVG; [render_and_check.cjs](render_and_check.cjs) checks the viewer and exports the PDF using the bundled Playwright package and installed Chrome.

## Verification and limits

- `python3 outputs/pr31-full-app-wireframe/build_wireframe.py` validated all 54 unique frame IDs, all seven screens, all 153 transition destinations, and all 174 source paths/one-based line references against the pinned archive. See [validation.json](validation.json).
- `node outputs/pr31-full-app-wireframe/render_and_check.cjs` checked frame inspection, source-note toggles, transition navigation and layouts at 1440, 1024, 736 and 375 px. No browser errors, horizontal overflow or phone-text overflow remained. See [browser-verification.json](browser-verification.json).
- The exported PDF was reopened with `pypdf`: 10 pages and all 54 frame IDs were present. All ten pages were rendered with Poppler and inspected as a contact sheet; setup, review and Q&A pages were also inspected at larger resolution. The SVG was parsed as XML and rendered with Sharp.
- A separate AI reviewer checked the diagram against source. Corrections include contextual Back paths, rotating without ending a capture, original-word playback remaining inside recording tools, correction choices closing before saved notices, score-evidence behavior by review screen, and retained Q&A audio on consent/retry errors. Final review of the affected scope reported no remaining concrete findings. This is AI review, not human approval.
- The connected Samsung Galaxy S23 Ultra was already displaying `com.team07.outloud` on Slide Review. An agent observed its layout without navigating, installing, recording, or submitting provider work. Its exact source revision was not established, so this is supporting layout evidence only. Private transcript/screenshot content is excluded from these deliverables.
- This is an implementation-derived wireframe, not proof of all-flow runtime behavior. No application code, backend service, installed build, recording, remote PR, or deployment was changed. Application builds and suites were not run for the diagram/documentation work.

The active Iteration 2 collaboration log contains the actual prompts, AI contribution and checks. No commit, push, merge or publication was performed.
