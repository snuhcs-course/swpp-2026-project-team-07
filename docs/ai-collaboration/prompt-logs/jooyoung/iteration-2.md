# Jooyoung — Iteration 2

[AI collaboration index](../../README.md). Entries retain their recorded context and attribution.

<a id="record-196"></a>

<a id="i2-jooyoung--recovered-iteration-2-evidence-october-1623-2026"></a>

### Jooyoung — recovered Iteration 2 evidence (October 16–23, 2026)

**Source coverage:** Reviewed all available local and remote-tracking branches. Jooyoung-authored Iteration 2 collaboration-log/report work was found on it2/documentation/cleanup (e4263cd, de6c8c1, 1b69db0); the codex/ai-development-sessions report itself marked Jooyoung’s coverage pending. The report draft in the documentation branch was generated with Codex; the prompts and decisions below establish Jooyoung’s requested work, not manual authorship of the generated prose.

<a id="record-197"></a>

<a id="i2-documentation-reorganization-and-iteration-2-refresh-october-16-2026"></a>

### Documentation reorganization and Iteration 2 refresh (October 16, 2026)

**Contributor:** Jooyoung · **Tool:** OpenAI Codex · **Model:** GPT-6 Luna (confirmed by Jooyoung)

#### Documentation-review notes — verbatim

> don't touch anything in folder yet. I have notes and questions for the documents...
>
> [Design-Comparison.md](http://design-comparison.md) → Looks at repos from last year, their organization, and what to adopt. Do we really need this?
>
> Design-Documentation.html → html version of design documentation
>
> [Design-Documentation.md](http://design-documentation.md) → Last updated October 9. Not synched with wiki (wiki last update - 9/28)
>
> [README.md](http://readme.md) → is this updated?
>
> [REDESIGN.md](http://redesign.md) → has new information about app features. should I delete after combining to ReadMe?
>
> /docs
>
> [ai-collaboration-guidelines.md](http://ai-collaboration-guidelines.md) → guideline for AI. not sure why the names are in there. maybe keep contributor references (pronouns), make sure to ask who is asking the prompt. 
>
> [ai-collaboration-prompts-iteration-1.md](http://ai-collaboration-prompts-iteration-1.md) → log of prompts used for iteration 1. (seems to follow guidelines?). maybe organize into folder of previous submissions?
>
> [ai-collaboration-report-iteration-1.md](http://ai-collaboration-report-iteration-1.md) → (seems to follow guidelines?). maybe organize into folder of previous submissions. or delete from docs and move it to wiki. 
>
> [ai-collaboration-prompts-iteration-2.md](http://ai-collaboration-prompts-iteration-2.md) → keep here, move when iter-3 begins
>
> [ai-feedback.md](http://ai-feedback.md) → is this about the feedback feature? maybe rename, keep in separate folder to distinguish
>
> [ai-use.md](http://ai-use.md) → 10/15 10/16 Seoyeon’s AI use log?? (why is it separate?)
>
> [api-contract.md](http://api-contract.md) → seems important. shouldn’t touch
>
> [cue-policy-v5-verification.md](http://cue-policy-v5-verification.md) → ask what this is
>
> [meeting-log-workflow.md](http://meeting-log-workflow.md) [daily-standup-meeting.md](http://daily-standup-meeting.md) → both guides for meeting notes, so delete one. [daily-standup-meeting.md](http://daily-standup-meeting.md) seems nicer, but maybe rename. or maybe move to wiki with “Meeting Log template”
>
> design-document-checks.json & design-source-snapshot.json → what is this?? do we keep it??
>
> [evidence-validation-verification.md](http://evidence-validation-verification.md) → is this for ai feedback feature? maybe keep in separate folder
>
> [feedback-evaluation.md](http://feedback-evaluation.md) → 10/08 feedback evaluation…maybe have things like this in one folder
>
> [iteration-1-handoff.md](http://iteration-1-handoff.md) → is this made for AI?? to know what’s going on? should we delete now that it’s done?
>
> [iteration-2-ai-feedback.md](http://iteration-2-ai-feedback.md) → feedback of frontend, defines Phases 1-7
>
> - phase-#-description .md → combine it or make a folder 
> -
>
> [live-testing-pr21.md](http://live-testing-pr21.md) → testing setup & requirements. doesn’t seem to say whether passed or not. maybe move to a testing folder, rename it iter1-testing (?) 
>
> [local-development.md](http://local-development.md) → this is already in [README.md](http://readme.md) (except for branch example?). It includes repository structure, how to run (with more detail)
>
> [mobile-transcription.md](http://mobile-transcription.md) → details on how transcription works..? and history of tests (9/29)
>
> [presentation-defaults-verification.md](http://presentation-defaults-verification.md) and [qa-navigation-expression-verification.md](http://qa-navigation-expression-verification.md) → 10/16 seoyeon… what is the point of these??
>
> [rehearsal-review.md](http://rehearsal-review.md) → explanation of 10/13 rehearsal steps?? do we need to keep this??
>
> [requirements-and-specification.md](http://requirements-and-specification.md) → IMPORTANT for submission
>
> - pdf version was already submitted. maybe keep it in archive or history?
>
> [review.md](http://review.md) → is this for Agents to read? 
>
> [setup-experiment.md](http://setup-experiment.md) → this was initial project setup explanation after the prompt I assume…I think we can delete this if outdated and information already in other docu
>
> [source-alignment.md](http://source-alignment.md) → is this outdated now?
>
> [team-work-division.md](http://team-work-division.md) → outdated. from iteration 1 and all the info is already in [iteration-1-handoff.md](http://iteration-1-handoff.md)
>
> [transcript-playback-verification.md](http://transcript-playback-verification.md) [transcripts-visits-verification.md](http://transcripts-visits-verification.md) → do we need this 10/15
>
> [verification.md](http://verification.md) → 10/13 verifications…why did it create a document…do we need this…can this be combined somewhere…
>
> [whisper-transcription.md](http://whisper-transcription.md) → explanation of initial 09/29 transcription stuff?
>
> [word-alignment.md](http://word-alignment.md) → explanation of how word to slide data is collected… is this up to date?

#### Reorganization request — verbatim

> create a README.md that has a documentation index, reorganize the docs folder based on this, make sure that the links within markdown link to the correct document, make sure that files meant for agents to read are up to date with the directory structure (for example, when an Agent writes evidence it creates file in docs/evidence/iteration-[current iteration] instead of docs file, and other similar cases) , then using the new structure follow the ai use guide so i can test if the new docs directory structure works correctly

#### Confirmed follow-up decisions — verbatim

> docs index + root docs (Recommended)

> Archive, minimal delete

> Jooyoung (and work in it2/documentation/cleanup branch)

> Full content refresh

> Plan Wiki mirror

> Yes all sources

> Log + verification

> Wait

> Keep it outside the mandatory core, an optional feature for iteration 3

> Do not document yet

> Exclude for now.

#### Final implementation request — verbatim excerpt

> PLEASE IMPLEMENT THIS PLAN:
> # Documentation Reorganization and Iteration 2 Refresh
>
> Reorganize all documentation on the existing `it2/documentation/cleanup` branch, with `docs/README.md` as the documentation index and `docs/AGENTS.md` as the directory-routing policy for future agents. Preserve historical evidence through Git moves, remove only reproducible generated duplicates, repair every Markdown link, and prepare—but do not publish—a Wiki mirror.
>
> No application code, API behavior, GitHub Wiki content, commit, or push is included. Preserve the unrelated untracked `sites/` directory.
>
> Create the target taxonomy under `product/`, `architecture/`, `features/`, `development/`, `process/`, `ai-collaboration/iteration-N/`, `evidence/iteration-N/<area>/`, `archive/iteration-N/`, `assets/design/`, and `tools/design/`; refresh Requirements, Design, feature references, agent instructions and the root README; create a pre-close AI report draft; reserve but do not create Testing Documentation; update design/Wiki tooling; add a documentation checker; log this work under Jooyoung; and create dated documentation evidence.
>
> Verify all Markdown links and retired paths, build and validate the relocated design source/assets and unpublished Wiki output, inspect the complete diff, and leave application tests unrun because this is documentation-only. Do not commit, push, publish the Wiki, create final submission files, modify the schedule, build the ZIP, or submit eTL.

The last quoted request is a faithful condensed excerpt of the supplied plan; the
complete plan remains in the originating task conversation. It is labeled as an
excerpt because the full taxonomy and verification bullets are represented by the
implemented files and the linked evidence record rather than reconstructed here.

#### Complete final implementation request — verbatim

> PLEASE IMPLEMENT THIS PLAN:
> # Documentation Reorganization and Iteration 2 Refresh
>
> ## Summary
>
> Reorganize all documentation on the existing `it2/documentation/cleanup` branch, with `docs/README.md` as the documentation index and `docs/AGENTS.md` as the directory-routing policy for future agents. Preserve historical evidence through Git moves, remove only reproducible generated duplicates, repair every Markdown link, and prepare—but do not publish—a Wiki mirror.
>
> No application code, API behavior, GitHub Wiki content, commit, or push is included. Preserve the unrelated untracked `sites/` directory.
>
> ## Target Structure and Content
>
> - Create `docs/README.md` with audience-based navigation, document status, canonical-source labels, current iteration, active AI log, evidence-writing path, archive policy, and submission-document status.
> - Create `docs/AGENTS.md` requiring agents to:
>   - Write new evidence under `docs/evidence/iteration-2/<area>/`.
>   - Write Iteration 2 prompts to `docs/ai-collaboration/iteration-2/prompt-log.md`.
>   - Put technical references under `architecture/`, `features/`, or `development/`.
>   - Put superseded material under `archive/iteration-N/`.
>   - Put generated artifacts under `output/`, never in the active documentation tree.
>   - Update `docs/README.md` when adding a canonical document.
> - Use this taxonomy:
>   - `docs/product/`: Requirements, Design, and current traceability.
>   - `docs/architecture/`: API contract.
>   - `docs/features/`: AI feedback, rehearsal review, mobile transcription, hosted Whisper, and the Iteration 2 AI-feedback phase contract.
>   - `docs/development/`: local development and verification guide.
>   - `docs/process/`: AI collaboration guide and one combined meeting-log workflow/template.
>   - `docs/ai-collaboration/iteration-N/`: prompt logs and iteration reports.
>   - `docs/evidence/iteration-N/<area>/`: dated test, provider, device, design, and documentation evidence.
>   - `docs/archive/iteration-N/`: scaffold reviews, handoffs, old ownership plans, superseded implementation descriptions, and raw historical AI records.
>   - `docs/assets/design/` and `docs/tools/design/`: canonical design assets and generation tools.
> - Move the canonical root Design source to `docs/product/design-documentation.md`.
> - Archive `Design-Comparison.md` and `REDESIGN.md`; first incorporate still-current content into Design, README, and feature references.
> - Stop tracking the root `Design-Documentation.html`; update the generator to write `output/html/design-documentation.html`.
> - Move Iteration 1 PDFs and design provenance into explicit Iteration 1 output/evidence archives.
> - Combine the meeting template into the meeting workflow, then remove the standalone template.
> - Convert `source-alignment.md` into a current product traceability document rather than preserving its scaffold-era claims.
> - Move phase, cue-policy, defaults, Q&A, evidence-validation, and transcript verification records into the corresponding Iteration 2 evidence subfolders.
> - Move Iteration 1 handoff, scaffold review, setup explanation, work division, and first word-alignment notes into the Iteration 1 archive.
> - Preserve prior prompt logs and reports as repository sources even when mirrored to the Wiki.
>
> ## Submission-Facing Refresh
>
> - Refresh the root README as the concise project entry point: current supported features, quick start, environment, checks, limits, demo preparation, and one link to the documentation index.
> - Refresh Requirements as the Iteration 2 canonical source:
>   - Keep Audience Q&A outside the mandatory core and label it as an optional Iteration 3 feature.
>   - Do not add General-audience/five-minute defaults or automatic-first-feedback behavior yet.
>   - Reconcile limits, implemented mandatory features, UI flows, and revision history with the current approved scope.
> - Refresh Design as the Iteration 2 implementation design, replacing planned Iteration 1 descriptions with current architecture, models, APIs, caching, concurrency, recovery, frontend organization, and rationale.
> - Refresh technical feature documents with clear `Current`, `Historical`, or `Experimental` status headers; retain detailed evidence outside those references.
> - Create `docs/ai-collaboration/iteration-2/report-draft.md` as a clearly labeled pre-close draft following the six required sections plus takeaway. Preserve unconfirmed contributor facts instead of inventing them.
> - Do not create Testing Documentation yet. Reserve its intended path in the index and state that named component owners and predeclared coverage targets are required from the team first.
> - Update design generation scripts, manifests, assets, Wiki-ready output paths, and documentation references for the new source locations.
> - Prepare a local Wiki mirror bundle under `output/wiki/`, but do not publish it. Record that Wiki synchronization requires later review and explicit authorization.
>
> ## Agent and AI-Use Workflow Test
>
> - Update root `AGENTS.md`, `mobile/AGENTS.md`, the relocated AI collaboration guide, and meeting workflow to the new paths and routing rules.
> - Remove instructions that make agents read Iteration 1 handoffs or ownership plans as current context; route them through `docs/README.md`, current traceability, the API contract, and relevant feature references.
> - Record this task under contributor `Jooyoung` in the relocated Iteration 2 prompt log:
>   - Preserve the documentation-review notes, reorganization request, and recorded follow-up decisions verbatim.
>   - Record OpenAI Codex as the tool and `not recorded` for model metadata unless verifiable metadata becomes available.
>   - Record generated work, retained/rejected files, human decisions, limitations, and actual verification.
> - Create `docs/evidence/iteration-2/documentation/2026-10-16-documentation-reorganization.md` containing:
>   - Previous and new directory maps.
>   - Files moved, merged, archived, or removed.
>   - Submission-document decisions.
>   - Link/design-build verification results.
>   - Confirmation that the Wiki was not published.
>   - Confirmation that Testing Documentation remains blocked on team ownership and target decisions.
>
> ## Verification
>
> - Add a repository documentation checker that scans tracked Markdown, resolves local files and heading anchors, ignores supported external schemes, and fails on broken links or references to retired paths.
> - Run the checker across root, mobile, and `docs/` Markdown.
> - Search for every old path and classify any remaining occurrence as either an intentional historical quotation or a defect.
> - Run the updated design build and design validation against the relocated source/assets; confirm PDF text parity, diagrams, A4 layout, manifest hashes, and Wiki-ready output.
> - Check `git diff --check`, inspect the complete diff, and confirm only documentation/tooling/output paths are affected.
> - Re-read the root README, documentation index, Requirements, Design, AI report draft, root/mobile/docs agent instructions, and the new evidence record.
> - Confirm the Iteration 2 log entry links to the new evidence path and that a future agent following only the updated instructions would place a new evidence file and prompt entry correctly.
> - Leave application tests unrun because this is documentation-only; report that limitation explicitly.
>
> ## Assumptions
>
> - The current branch `it2/documentation/cleanup` is the intended working branch.
> - Historical evidence is preserved through moves; only reproducible generated duplicates are removed.
> - Q&A remains optional Iteration 3 scope despite existing experimental implementation.
> - Defaults and automatic-first-feedback behavior remain outside submission-facing documentation pending approval, while dated internal evidence is preserved.
> - Testing Documentation is excluded until the team supplies responsible members and coverage targets.
> - Wiki publication, commits, pushes, merges, PDFs for final submission, XLSX work, ZIP creation, and eTL submission require separate authorization.

#### Work, decisions and verification

#### Main integration and scope correction — verbatim

> there are new updates in main. i want to pull it with my branch
> btw audience Q&A is actually something we already implemented. i've edited out stuff about it, but update any mention of it

- **Human correction:** The earlier decision that treated Audience Q&A as optional
  Iteration 3 scope is superseded. Audience Q&A is an implemented Iteration 2 feature.
  Historical prompts and dated records retain their original wording; current README,
  Requirements, Design and traceability sources are corrected rather than rewriting
  the earlier conversation.
- **Integration work:** Fetched `origin/main` at `5aed316` and merged it into
  `it2/documentation/cleanup`. Main's redesigned interface and Scribe v2 work were
  integrated while preserving this branch's documentation taxonomy and Q&A sources.
  Newly merged feature specifications, assets and transcription evidence were routed
  under `docs/features/`, `docs/assets/` and `docs/evidence/iteration-2/`.
- **Verification and revisions:** Merge conflicts initially exposed stale 30-minute
  fixtures, an OpenAI-format long-transcript fixture, moved documentation links and
  one React hook cleanup warning. Codex reconciled them to the current 20-minute,
  Scribe v2 and documentation-routing contracts. `npm run check` passed TypeScript,
  ESLint and 306/306 mobile tests. The backend SQLite suite passed 396 tests with 24
  PostgreSQL-specific skips; `makemigrations --check --dry-run` reported no changes.
  The documentation checker passed 509 links across 59 Markdown files, and diff and
  merge-marker checks passed. Detailed commands and limitations are in the
  [documentation-cleanup evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/1b69db0/docs/evidence/iteration-2/documentation/documentation-cleanup.md).
  No push, Wiki publication or eTL submission is implied by this local integration.

#### Evidence rename and publication authorization — verbatim

> rename evidence for this session to documentation-cleanup. commit and push changes to it2/documentation/cleanup branch

- **Human decision and authorization:** Rename this session's evidence record to
  `documentation-cleanup.md`, commit the tracked documentation update, and push the
  local branch to `origin/it2/documentation/cleanup`. Preserve the unrelated untracked
  `sites/` directory.
- **Result:** The rename was committed as `de6c8c1`. The authorized push succeeded
  and advanced `origin/it2/documentation/cleanup` from `79752a5` through the main
  integration commit to `de6c8c1`. The documentation checker passed 510 local links
  in 60 Markdown files before publication; `sites/` remained untracked and untouched.

- Created the documentation index and routing policy, moved current references,
  evidence, AI records, design assets/tools and historical material into the approved
  taxonomy, and repaired local Markdown links.
- Refreshed the root README, Requirements, Design, traceability, technical status
  labels and agent instructions. The later human correction identifies Audience Q&A
  as implemented Iteration 2 scope; unapproved defaults and automatic-first-feedback
  behavior remain excluded from submission-facing documents.
- Archived superseded sources and Iteration 1 submission snapshots. Removed only the
  tracked root HTML and duplicated root design assets after relocating the canonical
  sources. Preserved the untracked `sites/` directory.
- Created the pre-close report draft and a local unpublished Wiki mirror. Testing
  Documentation remains blocked on named component owners and predeclared coverage
  targets. No Wiki publication, commit, push, final export or submission occurred.
- Verification details and limitations are recorded in
  [the documentation reorganization evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/1b69db0/docs/evidence/iteration-2/documentation/documentation-cleanup.md).

<a id="record-198"></a>

<a id="i2-environment-key-lookup--october-23-2026"></a>

## Environment key lookup — October 23, 2026

**Contributor:** Jooyoung · **Tool:** OpenAI Codex · **Model:** GPT-6 Luna (confirmed by Jooyoung)

```text
[Pasted text: api-1 | UnicodeEncodeError: 'utf-8' codec can't encode characters in position 6…]
```

- **Result:** Reviewed the pasted API log and traced the failure to `POST /api/decks/` in `rehearsals.services.storage.store_deck`, while saving `Slide.extracted_text` from PDF extraction. The extracted text contains unpaired UTF-16 surrogate characters, which PostgreSQL/psycopg cannot encode as UTF-8; Django then also fails while rendering its debug 500 page. Existing GET requests and Celery tasks continued successfully. No source change was made; immediate workaround is to upload a PDF without malformed embedded text or sanitize extracted text before saving. No tests were run.

Follow-up prompt:

```text
does it count as a bug? the whole app was laggy because of  it i think
```

- **Result:** Classified the behavior as a backend robustness bug: malformed PDF text should be sanitized or rejected with a controlled 4xx response, rather than causing a database encoding exception and Django's secondary 500-rendering exception. The pasted log supports the failed upload and server error; it does not by itself prove that every UI lag symptom came from this request. No source change or performance test was performed.

Follow-up prompt:

```text
Each team member should personally use the app, run manual test cases and record what they observed.
For example, a member could test importing slides, recording, playback and retaking a recording. For each case, they should record:
- Their name, test date, device and app version.
- Steps followed and expected behavior.
- Actual behavior and whether the case passed or failed.
- A screenshot or video timestamp supporting the result.
We can divide cases among members using a shared checklist. My recommendation is that everyone tries the core rehearsal flow, then divides the remaining edge cases.
This describes responsibility for future testing; existing test records keep their actual testers and results.

including the lagginess becuz of malformed pdf (i think it might be because of an emoji?)--> one malformed pdf made the whole app laggy, even when opening and going back through slides of an ok pdf

home screen not optimized for tablet
pdf upload slide text showing at the same time as home screen text
how long is your presentation? showing at the same time as home screen icon
occasionally shows same data for different decks (might be part of laggy issue)
relistening to the recording: when i click on the text and audio plays, the play button wouldn't turn into a pause button
```

- **Retained manual findings:** Jooyoung supplied a future shared manual-testing responsibility and the following observed issues: malformed-PDF upload was followed by app-wide lag, including navigation through a different valid deck (the emoji cause is unconfirmed); the Home screen layout is not optimized for tablet; PDF-upload slide text and Home text appeared simultaneously; the presentation-duration prompt appeared over a Home icon; different decks occasionally showed the same data; and replaying audio from transcript text did not change the play button to pause.
- **Manual test record:** Jooyoung’s October 23 write-up identifies a Galaxy Tab S7 FE and labels the app version “PR #31.” Steps were to open the app, upload the malformed PDF, observe around 07:14 and retry or observe the response. Expected behavior was successful upload or a controlled validation error while the rest of the app stayed responsive; the test failed after two HTTP 500 responses. The write-up cites a Docker API log and a video screen recording, but neither media nor a video timestamp was independently inspected. Emoji causation and app-wide lag causation remain unconfirmed. No source change or application verification was performed.

Follow-up prompt:

```text
i uploaded the "malformed" pdf around 7:14. write up
```

- **Incident write-up:** The supplied log contains successful review, audience-Q&A and presentation-score GET requests immediately before the upload. At the log's 22:14:27 and 22:14:40 timestamps, repeated `POST /api/decks/` requests entered `rehearsals.views.decks` and `rehearsals.services.storage.store_deck`, then failed while saving `Slide.extracted_text`. Psycopg raised `UnicodeEncodeError: 'utf-8' codec can't encode characters ... surrogates not allowed`, followed by Django's debug 500 response renderer raising the same error. The requests ended as HTTP 500 responses. The log therefore confirms a repeatable malformed-PDF upload failure around the reported 7:14 local time (the container/Django timestamps are shown in a different timezone); it does not identify whether an emoji caused the malformed text or independently prove app-wide lag. No source change was made.

Follow-up prompt:

```text
it showed up multiple times right
```

- **Clarification:** Yes. The supplied 7:14 log shows two separate failed upload requests, at 22:14:27 and 22:14:40, both ending in HTTP 500. Each request also prints the error several times because the original database encoding failure triggers a second failure while Django renders the debug error page. An earlier supplied log showed the same failure pattern at 21:03:34.

Follow-up prompt:

```text
**Impact Jooyoung observed during manual testing**

Jooyoung reported that the app became laggy after this upload, including while opening and navigating through a different valid PDF. On the malformed PDF, the screen would glitch from the uploading slide. After recording on the malformed PDF, transcript page would say "Couldn't upload this take." On a valid PDF, after pressing rerecord, the app would play audio instead. Clicking buttons or swiping back would lead to nothing whenever docker logged "UnicodeEncodeError".

The log confirms the malformed PDF caused repeated server failures, but it does not by itself prove that the failed upload caused all of the subsequent app-wide lag.
```

- **Write-up revision:** Expanded the tester-impact section to include the malformed-PDF upload-slide glitch, the "Couldn't upload this take" transcript state after recording, the valid-PDF rerecord action playing audio instead, and buttons/swipe-back becoming unresponsive while the Docker `UnicodeEncodeError` entries appeared. These remain manual observations; the log confirms repeated backend failures but does not independently establish causation for every lag or UI symptom. No source change was made.

#### Malformed PDF incident and manual findings October 23

Prompts, verbatim and in order:

```text
[Pasted text: api-1 | UnicodeEncodeError: 'utf-8' codec can't encode characters in position 6…]
```

```text
is it because it's in korean?
```

```text
does it count as a bug? the whole app was laggy because of  it i think
```

```text
Each team member should personally use the app, run manual test cases and record what they observed.
For example, a member could test importing slides, recording, playback and retaking a recording. For each case, they should record:
- Their name, test date, device and app version.
- Steps followed and expected behavior.
- Actual behavior and whether the case passed or failed.
- A screenshot or video timestamp supporting the result.
We can divide cases among members using a shared checklist. My recommendation is that everyone tries the core rehearsal flow, then divides the remaining edge cases.
This describes responsibility for future testing; existing test records keep their actual testers and results.

including the lagginess becuz of malformed pdf (i think it might be because of an emoji?)--> one malformed pdf made the whole app laggy, even when opening and going back through slides of an ok pdf

home screen not optimized for tablet
pdf upload slide text showing at the same time as home screen text
how long is your presentation? showing at the same time as home screen icon
occasionally shows same data for different decks (might be part of laggy issue)
relistening to the recording: when i click on the text and audio plays, the play button wouldn't turn into a pause button
```

```text
i uploaded the "malformed" pdf around 7:14. write up
```

```text
it showed up multiple times right
```

```text
**Impact Jooyoung observed during manual testing**

Jooyoung reported that the app became laggy after this upload, including while opening and navigating through a different valid PDF. On the malformed PDF, the screen would glitch from the uploading slide. After recording on the malformed PDF, transcript page would say "Couldn't upload this take." On a valid PDF, after pressing rerecord, the app would play audio instead. Clicking buttons or swiping back would lead to nothing whenever docker logged "UnicodeEncodeError".

The log confirms the malformed PDF caused repeated server failures, but it does not by itself prove that the failed upload caused all of the subsequent app-wide lag.
```

- **Output and use:** Codex traced the pasted logs to `POST /api/decks/`, `rehearsals.services.storage.store_deck`, and `Slide.extracted_text`. It documented two failed upload attempts around the reported 07:14 local time, the psycopg surrogate-encoding failure, Django's secondary debug-response failure, the malformed-PDF and valid-PDF UI symptoms, and the tablet manual-testing findings. The write-up preserves the emoji explanation and app-wide lag as unconfirmed hypotheses while classifying malformed-input handling as a backend robustness bug.
- **Verification:** The supplied logs show successful GET requests before the failed upload and HTTP 500 responses at approximately 22:14:27 and 22:14:40 in the container/Django timestamps; an earlier supplied log showed the same pattern at 21:03:34. The evidence was inspected by Codex; no source fix, automated test, device replay, screenshot/video inspection or independent human review was performed. Tester/device/version metadata and media timestamps remain unrecorded except where the existing branch entry records them.
- **Human decisions and limits:** The user supplied the observations and requested the write-up. No application source, environment file, Docker state, commit, push or PR was changed during these documentation responses. The existing untracked `sites/` directory was preserved.
