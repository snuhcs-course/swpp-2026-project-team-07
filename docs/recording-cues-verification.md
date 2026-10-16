# Permanent recording cues — integration verification, October 16, 2026

Contributor: Seoyeon. Tool: OpenAI Codex desktop with implementation/test subagents
and a separate independent AI reviewer. Exact model variant not recorded.

## Implementation boundary

The isolated `it2/integration-ai-nakajima` branch starts at AI `ff8472c` and prepares
a merge of Nakajima `959025e`. The merge remains uncommitted for final inspection.
Nakajima supplies the screen/theme/navigation baseline; the amendment replaces the
recording transcript body with permanent Cues and retains selected-slide Play/Pause.
Both Must Cover and Go Deeper use the same scrollable panel with expandable details.
Rotated PDF view hides cues and restores the currently selected slide on return.

Profile generation, cache, request admission, prompts and backend wire contracts are
unchanged. Profiles remain slide-based and audience-independent. Requirements-sync
status is separate from cue content. Transcript correction controls moved into the
existing Review playback sheet behind Transcript & corrections. Full Review retains
selected-run transcript/audio navigation. Backend runtime retains the AI branch's
30-minute timeline and durable workflow contracts.

The discarded broad integration/setup plan is not implemented: Nakajima's import
setup continues saving local target/audience fields, separately from the AI backend
presentation context. This amendment does not claim those fields are synchronized.

## Automated evidence

- AI source baseline `npm test`: 295 passed.
- Initial integration runs found correction-component lint and two theme-aware test
  loader failures; these were repaired and rerun.
- Permanent panel tests first failed against the tabbed component, then passed after
  implementing both categories, Play/Pause, per-slide reset and theme support.
- Real profile-hook/client/cache lifecycle tests establish GET-only reopening and
  polling, cleanup/abort, no POST on navigation/theme/layout, and explicit generation
  after stale-state action. All fixtures are synthetic, never actual provider output.
- Mounted real RehearseScreen tests cover cues before/during capture, Play restrictions,
  repeated visits, backward capture checkpoints, rotation, theme, reopen and recovery.
  A failing recovery regression exposed selected-slide reset and passed after repair.
- Independent review found cross-source moved-line omission, loss of the untimed
  transcript fallback, and a boundary-line move affordance whose edit was ignored.
  All were repaired with targeted RED-to-GREEN regressions. Follow-up review also
  repaired shared-player cleanup, native Pause restarting playback and exact-word
  seeking reachability. Original word playback is explicitly available through the
  Original transcript disclosure, separate from confirmed corrected text.
- Mobile `npm run check`: final frozen-source run **331 tests passed**, no failures;
  typecheck and lint passed with one existing cleanup-ref warning in useSegmentPlayer.
  An earlier concurrent run caught the shared-source cleanup regression while its
  regression was being added; that result was superseded by the frozen-source run.
- Mobile `npm run bundle:android`: passed after all review repairs; final bundle
  `_expo/static/js/android/entry-df44877e65e1ab626fbb0789354ef7dc.hbc` (5.3 MB).
- Backend project environment `python manage.py check --settings=config.test_settings`:
  no issues. `python manage.py makemigrations --check --dry-run --settings=config.test_settings`:
  no changes. Full SQLite suite: 388 run, 363 passed, 25 infrastructure-specific skips.
  PostgreSQL/Redis/Celery and live-provider runs were not repeated for this UI amendment.

## Agent-operated Android observations

Used emulator-5554 with the existing development-client APK (hash matches the AI
worktree APK), which already includes gesture-handler 3.3.0 and native PDF support.
No APK/native-configuration rebuild is claimed. Metro served the integration checkout
on localhost:8091 with API `http://127.0.0.1:9/api`, preventing backend/provider work.

Temporarily isolated the emulator's SQLite/catalog using preserved in-place originals
and a parser-validated, clearly labelled SYNTHETIC CUE CHECK presentation. The original
database/catalog were restored afterward and the emulator app stopped. No operation
changed the connected physical phone. Synthetic cue text exercises UI/cache behavior;
it is not evidence of model quality or a real-provider generation.

Observed in screenshots and actual interaction:
- Normal layout has Cues and Play/Pause with no transcript body. Must Cover and
  Go Deeper content can be read by scrolling the same panel; Details remains available.
- Play changed to Pause while synthetic saved slide audio played; no audible sync
  quality judgment was made.
- Rotating enlarged the PDF and removed Cues/Play. Navigating vertically to slide 2
  and returning restored slide-2 cues.
- Light and dark themes render the panel. A confirmed short retake showed the live
  microphone indicator, advancing timer, visible cues, disabled Play and Stop control.
  Stop opened Compare and Keep current preserved the synthetic original.
- Review exposes Transcript & corrections, including check/sync status in the sheet.
  Full Review still displays the saved English/Korean transcript and slide navigation.

The sheet's native audio validator rejected the synthetic WAV fixture while the
recording-screen player could play it; the source was retained and recovery UI shown.
Therefore native Review-audio validation and audible evidence synchronization are not
claimed passed by this device run. Automated source-timeline/evidence/correction tests
are recorded separately. Live correction generation, human usefulness, physical-phone
speech/playback, TalkBack and native process-kill recovery remain unverified here.

## Final review gate

Separate final reviewer found no remaining material code findings and independently
ran 45 focused tests successfully after the repairs. The reviewed staged diff SHA256
was `99314c99cbbb5680990f0cdc21029f7f6ca88aa36498c5edb5cd05154bbaefcf` before this
verification-only documentation update. No tracked unstaged changes remained at that
review. Source/tests/manifests staged-diff SHA256 is
`1a563a540eb912122c04105e905942c884700b9f927eddf12e7904034735608f`.

Whitespace checks pass except inherited trailing spaces inside verbatim Nakajima
prompt quotations, retained to preserve the requested prompt fidelity. No `.env`,
private recordings, dependencies or generated native projects are staged.
Emulator observations establish the unchanged cue/recording layout; final correction
edge-case repairs were rerun automatically rather than repeated on device.

No commit, push or PR publication performed. Human final inspection remains pending.

## Physical-phone preview correction — October 16, 2026

After the user reported not seeing the changes, traced the phone's port-8083 Metro
process to a separate temporary Nakajima checkout. Served this integration worktree
on localhost:8091 using IPv4-first DNS, USB-forwarded that port and opened the existing
development client on the new URL. The installed physical-phone APK hash matches
the temporary checkout's debug APK, and its app config, dependency versions and
native registries match the integration baseline. No native rebuild or reinstall
was needed to load these UI changes.

Actual phone screenshot verified Cues, Must Cover, Go Deeper, retained Play and Rotate
on the normal recording screen. Existing saved PDFs remained available (seven catalog
entries); app data was not cleared or replaced. The app was left on this screen with
the integration preview running. No recording or provider generation was initiated.

The backend was not listening on localhost:8000. The opened presentation displayed
AI cues are unavailable offline, so only physical-phone UI deployment is established;
cue generation, audible playback/synchronization, speech quality and recording flows
remain outside this follow-up's verification. The earlier automated/emulator evidence
and source-review results still apply to unchanged source.

<a id="complete-ai-feedback-integration-october-16-2026"></a>

## Complete AI feedback integration — October 16, 2026

This section supersedes the earlier statement that the import setup remains
separate from the backend presentation context. The later approved integration
connects that setup to saved presentation requirements and replaces heuristic
quality grades with the status and findings of the selected recordings' AI
feedback. The earlier 331-test, export and synthetic-emulator results describe
the permanent-Cues amendment; they do not establish this later integration's
final gate.

Contributor: Seoyeon. Tool: OpenAI Codex desktop with delegated implementation
agents and a separate independent AI reviewer. Human final inspection remains
pending. The work remains uncommitted; no push or PR publication is claimed.

### Implementation mapping

| Area | Current implementation and user access |
| --- | --- |
| Saved time and audience | [requirementsDraft.ts](../mobile/src/features/presentations/requirementsDraft.ts) keeps confirmed local choices separate from server-accepted snapshots. [contextWriter.ts](../mobile/src/features/presentations/contextWriter.ts) serializes default initialization and user saves; synchronization retains the reserved context ID, reads after uncertain acknowledgements, and preserves newer edits. Conflicts offer Use server or Keep mine. |
| Setup and existing presentations | The shared `PresentationRequirementsEditor` in [PresentationSetup.tsx](../mobile/src/screens/PresentationSetup.tsx) opens after import and through the visible Edit time & audience action on idle Rehearse. It supports 1–30 minutes, an optional cleared duration, preset/custom/cleared audience and the existing 500-code-point audience limit. Reopening retains saved custom text and arbitrary integer seconds. |
| Shared AI status | [slideReviewStore.ts](../mobile/src/features/feedback/slideReviewStore.ts), [selectedSlideFeedback.ts](../mobile/src/features/feedback/selectedSlideFeedback.ts) and [useRunFeedbackStatus.ts](../mobile/src/features/feedback/useRunFeedbackStatus.ts) validate and reuse the existing API/attempt/context/slide/visit cache identities. Shared GET reads deduplicate requests and allow at most three concurrent reads. A visible overview has one timer for active jobs; navigation does not generate feedback. |
| Home, Review and Full Review | Home and Full Review show recorded slides assessed and verified finding counts. Review shows the selected slide's AI status or finding count. Partial, pending, outdated, insufficient-evidence and recovery states remain distinct. A partially verified result contributes its retained verified findings but does not count as a complete assessment. These views no longer present the prototype's numeric quality grades. Measured timing and delivery metrics remain separate. |
| Feedback and evidence | Review's AI feedback area keeps observations and suggestions visible, with expandable evidence/details per finding and optional Go Deeper content separate from findings. Listen opens [TakePlayback.tsx](../mobile/src/screens/TakePlayback.tsx) for the original source recording and exact saved interval. Playback uses validated media and the existing segment player; invalid intervals or unavailable media retain explicit failure/download controls. |
| Transcript and supporting tools | Transcript & corrections retains confirmed corrections, synchronization/conflict controls, source-specific moved speech, original word playback and untimed-text fallback. The same sheet retains media/download/PDF tools; its collapsed Recording tools disclosure contains older recording-wide suggestions and slide descriptions. Opening these tools does not generate feedback. |
| Initial generation and Q&A | Existing initial-feedback and Q&A hosts remain responsible for initial admission. Confirmed pending/conflicting requirements mark prior feedback/Q&A outdated and block generation until synchronization. Timing uses the last server-accepted duration while a save is pending. Missing audience settings in Q&A lead to the shared editor. Review's Audience Q&A and return hints are tappable as well as gesture-accessible. |
| Cues | The permanent Cues panel still shows both categories and saved selected-slide playback. Profiles remain slide-based and audience-independent. Requirements changes do not regenerate the cue profile. Rotation retains the established PDF/cue visibility behavior. |

### Automated checks and independent review repairs

Implementation agents observed failing regressions before the corresponding
repairs. Focused evidence includes:

- Requirements/default/setup tests cover durable confirmed saves, competing default
  initialization, uncertain acknowledgements, newer edits during old saves and
  conflict resolution. Q&A tests cover pending requirements and a covered page
  whose delayed preflight must not admit a provider request.
- The final focused feedback-status/parser/workflow run passed **35 tests**. It
  covers exact source/visit cache selection, requirement and correction freshness,
  request deduplication and the three-read bound, offline retention, active-only
  polling, untimed speech and existing admission/retry rules.
- The final focused evidence/corrections/segment-player run passed **28 tests**.
  It covers the validated media URI, original interval bounds, native-position
  cutoff, Pause/Resume without reseeking, player exclusion, source changes and
  delayed original-word audio setup.
- A separate reviewer reproduced three material integration defects. The repairs
  invalidate deferred original-word playback when a newer playback intent takes
  over; mark retained in-memory feedback outdated when its original transcript
  changes or disappears, including without a correction record; and unmount
  covered Review feedback/details so hidden controls cannot continue their
  page-scoped workflow. Targeted regressions cover the affected behavior.
- Metro cold reload exposed a requirements-module import cycle. Extracting
  default-intent state/read helpers removed that runtime cycle without changing
  API/storage keys or default values; focused requirements/default/setup tests
  passed **25/25** before and after the extraction.
- Native inspection exposed a keyboard-covered custom audience field. Setup now
  uses a keyboard-bounded scrolling viewport, visible Done control, and recovery
  actions/Save in the same content flow. Focused keyboard/setup/draft/default/cue
  tests passed **25/25**. The visible idle edit action has its own opening and
  recording/covered-page suppression tests.
- A cold physical Q&A Next check reproduced a fully invisible page despite the
  next question remaining mounted and entrance shared opacity reaching one. A
  temporary no-entrance-fade comparison retained visibility. Installed Reanimated
  code caches the initial React-facing animated style, including entrance opacity
  zero. The shared Enter now keeps its 220 ms fade, then renders static opacity
  one; cancellation guards cover stale completion, reduced motion and unmount.
  Four initial-style/lifecycle regressions and an actual-component three-question
  navigation regression passed. Temporary metadata diagnostics and the no-fade
  override were removed; the normal Q&A layout/data logic was restored.
- Native inspection also exposed scrolled recording details beneath the fixed
  sheet header. The repair bounds and clips the actual scroll viewport below
  that header; its mounted regression failed before the repair and passed after.

These focused counts overlap and must not be added together. Implementation-agent
ESLint/typecheck checks passed for their final owned changes. Mid-edit runs also
caught missing imports, an outdated test action name, and concurrent intentionally
failing regressions; those snapshots do not establish the combined result.

Final frozen-source gates from `mobile/`:
- `npm run check`: passed TypeScript, lint (zero errors, one existing
  `useSegmentPlayer` cleanup-ref warning), and **392 tests passed, zero failed**.
- `npm run bundle:android`: passed; final 5.3 MB Hermes bundle is
  `_expo/static/js/android/entry-5aade6e3a24d620ac40e544ae1c73b6b.hbc`.
- Backend runtime source/contracts were unchanged by this follow-up. The temporary
  phone API passed Django system checks, had all existing migrations applied, and
  database/broker readiness plus worker response were confirmed. The earlier
  full backend suite above was not repeated for these mobile changes.

The separate reviewer rechecked each repaired scope and the final staged mobile source/test amendment
SHA256 `c9862746ed6fa08e8f505ba6976c7ee5aa7a58eb9c80ec9eb88775b6ede9dd5a`
from the binary cached diff restricted to mobile/src and mobile/tests
against baseline tree `004c4a64b1b030618bcf69d86f7a8f47f7b45b0f`, with no
unstaged source/test differences. Final scoped rechecks passed 13 evidence, 14
setup/rehearsal and 17 Q&A workflow/navigation tests followed by 7 navigation tests for the final Back action; these overlap the combined
suite. The separate final review also passed 12 entrance/Q&A tests after inspecting
  the shared transition repair. No remaining actionable findings were reported. This documentation append
does not change the reviewed source snapshot.

### Agent-operated physical phone and real-provider observations

The agent used the integration Metro session on port **8091** and the saved
catalog/cache API on port **58000**. Runtime readiness checks confirmed database,
broker and worker availability. The session reused existing saved caches,
presentation catalog and media. It did not clear app data, rewrite the catalog or
install an APK for this verification.

On the physical phone, the agent opened the existing-presentation requirements
editor and confirmed that it loaded the saved custom audience and cleared time.
The keyboard, custom input, Done and Save controls were visible after the layout
repair. The agent canceled the editor; this observation does not claim that a
new requirements save or conflict-resolution flow ran on the phone.

The agent explicitly requested Update feedback for saved input. The real OpenAI
request for **job 14, generation 2** completed with **one verified finding**; this
was not fixture output. A runtime broker-port misconfiguration initially prevented
queued work from reaching the worker. The agent corrected the temporary runtime
configuration and republished the same already-admitted queued generation.
No backend source edit or additional generation admission is claimed for that
transport recovery. Validation established the stored finding's supported evidence
shape and source references; human assessment of its usefulness remains pending.

Physical interaction established:

- Selected saved-slide playback advanced on screen.
- The bounded evidence player showed the original **1.300–8.840 second** interval;
  native position advanced to **0:03** and the control displayed Pause evidence.
  This establishes native playback progress, not audible quality or sample-exact
  cutoff on the phone.
- Review displayed the real finding and its details. Full Review displayed
  **1/6 recorded slides assessed**, status/counts and the selected-run transcript.
  Transcript correction controls remained reachable.

Additional current-phone observations:
- Home, Review and Full Review consistently showed one verified finding and one
  of six recorded slides assessed; unfinished and outdated sources remained separate.
- Light and dark themes, long Review findings/advice, page scrolling and Full Review
  tiles/transcripts were inspected. A temporary system font scale of 1.3 exercised
  larger text; the existing design's `Txt` scaling cap remains unchanged.
- The recording-details body now clips below its fixed header during native scrolling.
- Review's tappable Q&A action opened the existing screen. A rejected GET exposed
  an incorrect audience fallback. The repair shows accepted saved requirements
  without requiring a successful question-state read, distinguishes HTTP rejection
  from connectivity failure, and stops covered-screen polling timers. Saved question
  batches keep their own audience. Automated regressions cover all these cases.
- With selected transcripts pending, the physical screen now shows the saved audience,
  an explicit preparation dependency, read-only Refresh and Review selected recordings.
  That recovery action opened slide 3, the first unready selected source. The opaque
  HTTP 400 does not establish its exact server cause.

The final-source phone check rotated the enlarged PDF, selected slide 2 with a
vertical swipe, and returned to normal with slide 2 and its cached cue preserved.
The rotated view hid Cues, Play and the idle setup action; normal view restored them.
Light-theme Home and Full Review showed the same assessment counts as Review.
The system font scale was restored to its original 1.0 after the larger-text check.
A previously saved three-question batch also loaded in the existing Q&A screen;
the production entrance repair then passed the original cold-open reproduction.
Tappable Next changed question 1 to question 2 while retaining the header/background/
controls. The preserved horizontal gesture reached question 3 and its intentional
last-question state. Saved Q&A opened a historical batch with its own different audience
and disabled answer recording. Tappable Back returned the historical batch to its selected Review. No question-generation request was made by these actions.

The current phone run did not create a new recording, accept/restore a transcript
correction, submit a Q&A answer, or exercise requirements save/offline/conflict recovery.
Those behaviors have automated coverage; the earlier emulator capture observations
remain separate evidence. TalkBack, native process-kill recovery, audible synchronization
and human feedback usefulness remain unverified. No private speech quotations or phone
screenshots were copied into the repository.

Automated fixtures, the real provider result, and agent-operated phone interaction
provide different evidence. Human final inspection, audible synchronization
judgment and feedback-usefulness acceptance remain pending. No commit, push,
merge or publication was performed for this integration.

## Inline Review transcript October 16, 2026

The user requested removal of Review's separate black transcript window and a
synchronized transcript directly below Play and above AI feedback. The amendment
continues on `it2/integration-ai-nakajima` from the already staged integration tree
`1d999b130259a2da6cfc82f2e944c71fbb6ad4e8`; the pending merge remains uncommitted.

### Implementation

Review now renders the existing source-owned transcript/corrections in its normal
page scroll. Its selected-slide Play, sentence playback, original-word playback
and bounded evidence share one segment player and native source URI/time.
Repeated visits keep their source intervals and visit headings. Inline mode
removes duplicate whole-slide Play controls and nested transcript scrolling;
untimed text has an explicit timing warning. Selected-source changes and covered
Review screens unmount the transcript controller and stop playback. Corrections,
restore, conflicts, synchronization and stale-feedback fences reuse the existing
controller. Original transcript, older suggestions, descriptions, transcription
retries and PDF tools remain under Recording tools. Download/error controls stay
on the same page. Rehearsal's interrupted-recording recovery sheet remains intact.
No backend contract, provider prompt, generation scope or native dependency changed.

### Automated checks and independent review

- Regression tests first reproduced the missing inline placement/remaining modal.
  Coverage includes selected source and repeated visits, source URI/time matching,
  silence/exact interval ends, evidence, correction pending/conflicts, unavailable
  and untimed transcripts, both themes, one page scroll and covered-screen cleanup.
- Final `npm run check` from `mobile/`: TypeScript passed; lint had zero errors and
  the one pre-existing `useSegmentPlayer` cleanup-ref warning; **405 tests passed,
  zero failed**. Tests mock native/provider boundaries and use labelled synthetic
  speech. This supersedes the initial mid-edit run's obsolete sheet expectation.
- Final `npm run bundle:android`: passed; 5.3 MB Hermes output
  `_expo/static/js/android/entry-31d89d50c2a2031097aa22f23e13154c.hbc`.
- A separate AI reviewer inspected the exact staged amendment and ran 34 focused
  tests. It found that opening another/same evidence without a layout change could
  leave its controls offscreen. A regression reproduced this; each selection now
  carries a request sequence, with a stable scroll callback that does not resnap
  during player updates. The reviewer reran all nine affected Review tests and
  reported no remaining actionable findings. These focused counts overlap the full
  suite and must not be added together.
- Final reviewed source/test patch SHA256:
  `e7655596380ce316c59e0eb5a494c3d8e68fcab09f99b9cb957ef659cf9074f4`, from
  `git diff --cached 1d999b130259a2da6cfc82f2e944c71fbb6ad4e8 -- mobile/src mobile/tests`.
  Working source/tests matched that staged snapshot. Backend source was unchanged
  by this amendment; backend suite results above were not rerun for this UI work.

A separate documentation reviewer checked the amendment links, exact prompt, contributor,
check logs, patch hash and stated device limits, with no actionable findings.

### Agent-operated physical phone checks

Used the connected physical Android phone with the integration dev bundle on
Metro 8091 and the existing API/cache namespace on 58000. Database and broker
readiness passed. No APK installation, app-data reset or saved-media replacement
was performed. The session used existing saved audio/transcripts/feedback; no new
AI generation action was selected for this amendment.

Observed on the phone:

- Normal Review displayed the transcript directly under Play; scrolling the long
  transcript reached AI feedback on the same page, without a separate black window.
- Selected-slide playback advanced from 0:01 to 0:03, showed Pause and highlighted
  the current timed word. Play/Pause and playback after returning to a slide worked.
- Forward/backward slide selection changed the preview and transcript to the
  selected slide. Closing and reopening Review restored saved transcript content.
- Light and dark modes rendered readable inline transcripts; the original dark
  theme was restored and Review was left open for user inspection.
- Details & evidence → Listen revealed a themed inline evidence card with the
  verified 16.840–20.320 second source interval. Play evidence changed to Pause
  evidence and was paused through the same control. This establishes the native
  action/state, not sample-exact cutoff or audible synchronization quality.
- Check transcription remained visible inline. No correction suggestion was
  generated/accepted/restored on the phone in this amendment; automated tests
  establish those retained state transitions, not a new physical correction run.

Native audible synchronization, TalkBack, process-kill recovery and new recording/
Q&A capture were not reverified for this UI amendment. Private phone screenshots
and speech remain outside the repository. Independent AI review is separate from
human review. Intended changes are staged for final user inspection; no commit,
push or PR was performed.

## Both cue categories visible October 16, 2026

The user reported: “Go deeper is hidden beneath must cover”. The phone reproduced
this: the fixed-height panel showed Must Cover while Go Deeper was below its
initial viewport. The narrow presentation fix uses two equal-width cue columns
in the existing single vertical scroll, with both category labels fixed above it.
Shared notices follow cue content. Full cue text and expandable details remain
scrollable; no text is truncated in the data or by a line limit. The original
142-unit panel bounds, timer, Play, capture controls and rotated view are retained.
Generation, caches, cue prompts, backend contracts and native dependencies did not change.

Verification against the previous staged tree
`db09203a52dee26859054f900b5a93e92f9630d9`:

- A new multi-item regression failed before the fix because the category labels
  were in separate stacked sections. It now checks the shared fixed heading row,
  sibling cue columns, actual content, one scroll and no tabs. Existing tests retain
  long content, details, Play restrictions, themes, stale/missing/retry states and
  navigation/cache behavior without provider generation.
- `npm run check`: TypeScript passed, lint zero errors/one pre-existing
  `useSegmentPlayer` cleanup-ref warning, **406 tests passed, zero failed**.
- `npm run bundle:android`: passed; 5.3 MB Hermes output
  `_expo/static/js/android/entry-41af1af37cc9648519626ee85a76e170.hbc`.
- A separate AI reviewer inspected the exact staged source/test patch and reran
  21 focused panel/runtime/lifecycle/integration tests, with no actionable findings.
  Counts overlap the full suite. Reviewed patch SHA256:
  `adf56670d7c5b2c01fa6f211bff7343a893b49f12084537dbbc28caf36411c2f`, from
  `git diff --cached db09203a52dee26859054f900b5a93e92f9630d9 -- mobile/src mobile/tests`.
- Agent-operated physical-phone checks used the existing integration Metro session
  and saved profile cache. Both real generated cue starts appeared side by side on
  slide 6 at scroll zero. Scrolling reached both Details actions while both category
  labels stayed visible. A slide with no optional content displayed its explicit
  Go Deeper empty-category message. No generation action was selected, no APK was
  installed and saved media were untouched. This native observation is separate
  from mocked tests; it does not establish every font size/device or TalkBack.

A temporary Android text scale of 1.3 also showed both category labels and real cue
starts at once after reopening the recreated app. Longer text still requires scrolling.
The initial recreation-to-Home captures were not counted as Cues verification. The
original text scale of 1.0 was restored and read back. TalkBack was not exercised.

Human final inspection remains pending. The fix is staged without a commit or push.
Private screenshots remain outside the repository.
