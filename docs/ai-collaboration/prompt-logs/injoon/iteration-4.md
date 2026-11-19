# Injoon — Iteration 4

[AI collaboration index](../../README.md). Entries retain their recorded context and attribution.

<a id="record-200"></a>

## Reconcile PR #50 with the v8 main baseline — November 16, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6 (exact variant not recorded)

### Request — verbatim

```text
Can you resolve the conflicts in PR #50 against the updated main so we can use it for the documentation cleanup while we wait for Jaewon to upload the submitted files?
```

- Codex merged the published v8 main commit into the PR branch in an isolated checkout and resolved seven Markdown conflicts. It retained the consolidated log and compatibility index, updated the source references to distinguish v8 from the later backend repair, and retained the dated evidence and acceptance criteria.
- Verified the staged diff against v8 main. Only Markdown changes remain. The existing acceptance criteria and both compatibility indexes are byte-identical to the PR head. All 382 fenced blocks and the non-heading evidence lines in the v8 prompt files are present in the consolidated log. The changed documentation's relative links resolve.
- Jaewon's submitted exports are pending. This merge does not supply a submission snapshot or new device/provider evidence.

<a id="record-201"></a>

## Injoon: coverage tooling on main — November 16, 2026

- Tool: OpenAI Codex. Model: not recorded.
- Date received: November 16, 2026 (KST). Confirmed decision: port PR #33 coverage tooling and retire its source branch after integration. Keep strict CI thresholds and cover both mobile shortfalls before merging.

### Verbatim prompts

```text
PR#33 is closed so is branch testing-setup-documentation needed?
```

```text
What is the coverage tooling
```

```text
So you're saying this coverage tooling was not in main???
```

```text
Then let's bring the coverage tooling from PR #33 into main before deleting the testing-setup-documentation branch.
```

```text
Keep the coverage gate strict. Bring mobile coverage up to both targets before merging.
```

### Agent work and verification

- Adapted the existing c8 and coverage.py setup from PR #33 (`f0d7148`) to main (`4f0dd79`). Kept the original group targets and the checks that fail for missing or below-target coverage. Added source maps for the later bundled-PDF loader.
- Added eight tests using the actual Home, Upload, import and review-media logic with simulated Android and network boundaries. Covered navigation and delete/undo, offline import and retry, legacy page recovery, cache reuse, invalid media and stale focus callbacks.
- The initial mobile port passed all 617 tests but missed both line targets. The final strict run passed all 625 tests: logic 86.77% lines / 86.29% branches and screens 78.49% lines / 74.90% branches. Type checking, lint (one pre-existing warning), the collector self-check and Android JavaScript export passed. Three coverage-report tests passed, and the local SQLite backend run passed 605 tests with 25 PostgreSQL-only skips. GitHub CI runs the backend with PostgreSQL. These checks did not use a physical device.

<a id="record-202"></a>

## Injoon — retire tracked design PDF exports

- Date: 2026-11-16 (KST).
- Tool: OpenAI Codex. Model: not recorded.
- Decision: Keep `outputs/` as the sole tracked export folder. Defer the Iteration 1 submission documents.

### Input prompts (verbatim)

```text
We have seperate output/pdf and ouputs folders in our repo; how should we combine/delete
```

```text
Isn't the iteration 1 submission documents in output/pdf/
```

```text
acutally let's just defer iter 1 documents. I'll ask seoyeon later
```

```text
no i mean delete that  folder and keep outputs/ as the only racked output folder
```

### Agent work and verification

- Removed two tracked, byte-identical design PDFs. Pinned the named copy in Git history, removed their Git attributes, and documented the existing ignore rule for regenerated exports.
- Checked the old blob IDs, the staged file list, the ignore rule for future PDF exports and the unchanged archive tree. Export code was unchanged. No PDF regeneration or application tests were needed for these path-only changes.

<a id="record-203"></a>

## Repository design figure consolidation (2026-11-16)

- Contributor: Injoon. Tool: OpenAI Codex. Model: not recorded.
- Confirmed decision, received November 16, 2026 (KST): combine the two design figure folders in `docs/design/figures/` and update the documentation and exporter.

### Input prompts (verbatim)

```text
Should we keep assets/outloud-design in root folder or docs folder
```

```text
What does diagram-review do
```

```text
but regardless they both contain figures needed for docs right
```

```text
so how can we combine htem
```

```text
but diagram-review does not sound appropriate. we are not reviewing anything
```

```text
Let's combine both folders into docs/design/figures/ and update the docs and exporter to use the new path.
```

```text
Commit and push the figure consolidation, then open a PR.
```

### Agent work and verification

- Consolidated 53 editable sources and renders in the selected folder. The retired export copies matched by bytes (43) or decoded pixels (10). Updated the document links, HTML preview, figure manifest, PDF/Wiki exporter, checker and A4 SVG generator in an isolated checkout.
- The clean Iteration 1 build and checker passed. Verified all 53 files in each export bundle, all eight preview figure links, 12 PDF panels, and pixel equality across all 24 PDF pages against the baseline. The reflow script reproduced the three expected SVGs and panel metadata byte for byte. Earlier check records and prompt quotations retain their original paths. No application testing or Wiki publication. The follow-up requested a commit, push and repository PR.

## Folder restructuring — November 17, 2026

Contributor: Injoon. Tool: OpenAI Codex. Model: not recorded.

### Request

```text
Looks good. Let's apply the folder restructuring in a separate local checkout and run the verification checks. No PR yet.
```

### Work and evidence

Created an isolated checkout from main at 42c2154 and applied the approved path mapping. Verified 66 move destinations and 70 archival dispositions, checked paths and anchors across 80 Markdown files, matched 744 historic fenced blocks byte for byte, and compared six migrated meetings with Wiki revision 2e2444b. Both submission ZIPs matched their original hashes and passed integrity checks. Preserved earlier attribution paths and the Wiki’s cited AI feedback line range. Two source comments cite prompt records that were unavailable in the baseline. Draft PR #52 overlaps the README, requirements and prompt log. Its unmerged edits remain on that PR.

### On-disk folder audit follow-up

```text
Can you do one more check of the entire folder structure on disk against the plan and fix anything else that doesn't match? No PR yet.
```

Compared the checkout on disk with the migration table, including empty and untracked directories. Repointed source comments to the moved API contract, dated Scribe verification and pinned historical attribution. Kept the Wiki’s AI feedback citation and two prompt attribution indexes at their original paths.

### Follow-up migration application

```text
Looks good. Let's apply the updated follow-up plan in the local checkout. No PR or Wiki changes yet.
```

Applied 31 planned moves and renames and split the contributor logs into 14 iteration files. Preserved 204 numbered records and 744 original fenced blocks. Updated prompt attribution and removed the two retired prompt indexes. Kept the AI feedback copy for the published meeting citation. Verified the on-disk layout, moved artifact bytes, relative links, source citations and both submitted ZIPs. No PR or Wiki edits were made.

### Archive the duplicate AI feedback guide

```text
Can you do that
```

The request follows the recommendation to pin the Wiki citation and retire the duplicate. Updated the Iteration 2 kickoff citation in Wiki commit `27cec4f`. Verified the published target against the exact cited lines and mirrored the citation in the local meeting record. Staged removal of the legacy copy while retaining the maintained reference guide.

### Add iteration reports and submission references

```text
Let's do that in the local checkout. Add the Iteration 2 AI report, the schedule and HE links, and pinned links for the older snapshots. Get the iteration 3 report from the submitted version (change pdf to md). No PR
```

Imported the published Iteration 2 Wiki Markdown from Wiki revision `27cec4f`. Transcribed the Iteration 3 report from the original eTL ZIP, preserving its body text and both hyperlinks. Added the workbook, archive and pinned snapshot links to the relevant indexes. Checked archive integrity and original hashes, local links and pinned Git objects. The historical report claims were retained as submitted. No PR or Wiki edit was made.

### Correct the Iteration 3 prompt log

```text
No need to keep the old label. Make it simple and clear.
```

Filed 35 records about the Iteration 3 demo, evaluation and deliverables under Iteration 3. Used the named contributor when the entry explicitly identified one. Removed obsolete filing notes and preserved verbatim prompts and citation anchors. Updated the report index and affected references.


<!-- Preserved from retired cleanup b52b651190cfa848b91bc9b84f523aa90540c2a2; original dates, prompts and outcomes below. -->

## Start the Iteration 4 documentation cleanup — November 16, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6 (exact variant not recorded)

### Request — verbatim

```text
Can you start the documentation cleanup on PR #50 now? Start with the README so it’s clear which APK to use and how to run the repo, while we wait for Jaewon’s submitted files.
```

### Follow-ups — verbatim

```text
Actually do it on another PR
```

```text
No not a standalone read me pr but documentaion cleanup pr
```

- Codex opened a separate documentation cleanup branch based on the reconciled PR #50. The README starts with installation of the published v10 APK and gives separate local setup instructions for the v8 repository baseline. Submitted Iteration 3 exports remain pending.
- Checked v10 release metadata and INSTALL.txt, repository scripts and endpoint definitions, README internal links and retained anchors, shell syntax, and a Compose configuration render using the example environment. This documentation pass did not install a new APK or rerun the app.

### Scope correction — verbatim

```text
i mean we should do a cleanup for iteration 3. iteration 4 is still in progress. you know how we looked at all the class lectures, other groups' repo to see how our repo stands? 
```

- The requester clarified that PR #52 cleans up the published Iteration 3 snapshot. Codex corrected the README to point to v8 for Iteration 3 and revised the PR scope using the course and peer documentation audit. Iteration 4 work and later releases retain their own evidence and scope.

## Clean up the Iteration 3 requirements on PR #52 — November 16, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6 (exact variant not recorded)

### Request — verbatim excerpts

```text
Sounds good, go ahead with the Requirements & Specifications pass on PR #52.
```

```text
Make sure for every pass you refer to the course requirements and review of all 18 peer teams. Don't just rely on the summary but actually look into full detail if needed.
```

- Injoon approved the requirements pass on November 16 and directed Codex to keep the existing acceptance-criteria wording and IDs. The submitted Iteration 3 UAT selection remains pending verification.
- Codex checked the course's Requirements & Specifications Guidelines and the acceptance-testing section of the Testing Documentation Guidelines. It reviewed the audit of all 18 peers and consulted source documents, including [Team 11's compact story index](https://github.com/snuhcs-course/swpp-2026-project-team-11/wiki/Requirements-%26-Specifications#51-key-user-stories-for-uat), [Team 19's criterion-to-test mapping](https://github.com/snuhcs-course/swpp-2026-project-team-19/wiki/Testing-Documentation#5-acceptance-testing-from-iteration-3), and [Team 03's build-specific requirements status](https://github.com/snuhcs-course/swpp-2026-project-team-03/wiki/Requirements-and-Specifications#51-iteration-3-implementation-status).
- Codex shortened the v8 status, linked dated evidence, and linked each mandatory story and its criteria from the existing functional index. Verified the story, criterion and NFR text against the previous PR head and checked the new links and diff. This pass adds documentation checks only.

### Follow-up — verbatim excerpt

```text
There is some relevant information that you cut out
```

- Injoon flagged missing context in the Iteration 3 status and change summary. Codex restored the Iteration 2 comparison, the exact v8 source and main date, carried-over capabilities, release changes, and the distinction between APK evidence, later backend recovery and unreleased candidates.
- Codex checked the official requirements guideline, revisited the 18-team review and Team 03's original implementation-status section, and verified the GitHub v8 tag, main, and pinned release reports. The patch preserves the acceptance criteria and existing evidence. No application rerun was performed.

## Review README content removed in PR #52 — November 16, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6 (exact variant not recorded)

### Request — verbatim

```text
You probably cut out too much in all the sections. I thought that read me was good but now seeing this I'm worried you cut out too much. I want you check the previous readme and make sure you didn't cut necessary information. From now on make sure to read the whole document from top to bottom and from that cut
```

- Injoon instructed Codex to read the full document before shortening it in future passes. Codex read the PR #50 baseline and PR #52 README end to end. It checked the Project Overview's working-increment slide, the Iteration 3 assignment, the 18-team review, and the original demo and limitations sections of Teams 04 and 19.
- Restored the demo steps and expected behavior, known gaps, input caps, offline behavior, and links for detailed review, provider setup, verification and contribution records. Checked them against the v8 release, pinned source and dated evidence. No v8-matched demo video was verified in either README or the v8 release.

## Apply the approved README outline on PR #52 — November 16, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6 (exact variant not recorded)

### Request — verbatim

```text
Looks good. Go ahead and update the README on PR #52 with this outline. First determine which skills to use to write this readme file. The v10 was made during iteration 4 btw
```

- Injoon approved the README order and identified v10 as Iteration 4. Codex used Stop Slop to edit the prose after reading the existing README end to end. The Project Overview's working-increment slide, the 18-team documentation review, and [Team 19's original README](https://github.com/snuhcs-course/swpp-2026-project-team-19/blob/a14d08696428159ab8e2b11f30f2e6472b8980cc/README.md) informed the order and demo environment table.
- Codex added the Iteration 3 summary, demo checkpoints and environment, and dated verification. It kept the setup commands, the known gaps and input limits, and linked Jaewon's submitted archive. It moved v10 under Project documentation as the Iteration 4 demo. Verified internal links, existing heading anchors, and preserved shell commands. No matching v8 demo video was verified and no app checks were rerun.

### Follow-up — verbatim excerpt

```text
Like this, when you write documents it should sound "factual" and not "third-persepctive". Your writing is like from the third perspective. And if you find inconsistencies like having coverage for iteration 2, then you have to tell me so we can fix it.
```

- Injoon asked for direct project prose and for Codex to surface inconsistencies. Codex stated the v8 baseline directly in the README and checked that the deployment and smoke-test descriptions retained their dated facts.
- The README places October 22 Iteration 2 coverage beneath the Iteration 3 verification heading. The v8 build and smoke-test records do not provide a v8 coverage measurement. Codex left the coverage entry for a separate decision.

### Follow-up — verbatim

```text
Yeah, move the Iteration 2 coverage out of the README and keep it in the testing docs. For Iteration 3, only include what we actually verified on v8. Update PR #52. CAn you rewrite so that even for a reader who is reading the repo for the first time they understand what is happening
```

- Codex clarified what the app does, how to choose the hosted demo or local development, and what to expect on the first rehearsal. It used the working-increment guidance, the 18-team peer review, and Team 19's demo walkthrough. The section order and command blocks follow the approved README.
- Codex removed the October 22 coverage bullet from the README and verified that the existing testing record still holds the Iteration 2 results. The README verification section covers the v8 release and limited v8 phone check. No new runtime test was performed.

### README rollback — verbatim

```text
can we revert the read me to the baseline. It became so bad. Find skills we can use to write the documentation on the internet
```

- Injoon requested the baseline README. Codex applied a checked patch to the clean README and verified that it matches the PR #52 base, PR #50 at `7c9dd8c`, byte for byte. The Requirements changes remain in PR #52.

## Edit the baseline README after reader review — November 16, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6 (exact variant not recorded)

### Request — verbatim

```text
Looks good. Use both skills and make those targeted README edits on PR #52. Keep the baseline detail, leave Iteration 2 coverage in Testing, and do another fresh-reader check before pushing.
```

- Codex used GitHub's documentation-writer and Anthropic's doc-coauthoring. It checked the full baseline, the course working-increment requirements, the 18-team review and the original Team 04 and Team 19 README examples. It retained the detailed rehearsal flow, local setup, limits and phase history, and added the APK, reviewer handoff, and submitted archive.
- An independent README-only reader could follow the APK, USB setup, retake, consent, evidence and history paths. It flagged that the walkthrough could obscure upload-before-consent and omitted the control that starts a retake. Codex clarified both steps against the specification and v8 source. The reader confirmed the fixes before push.
- Verified 40 internal links, existing anchors, shell syntax, unchanged shell commands, and the v8-only verification section. Iteration 2 coverage remains in Testing Documentation. No matching demo video was verified and no runtime tests were rerun.


## Restart the Iteration 4 documentation update — November 19, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** not recorded.

### Request — verbatim

```text
I want to delete the current iteration-4-cleanup and then start a new one. I need to update the repo so that all the readme files, design, testing, requirements, etc represent the state of the app at iteration 4
```

### Decisions and work

- The request supersedes the preceding README-only draft. Created fresh local branch `docs/iteration-4-docs` from main `ffe1d3a`; the prior local README remake remains separate.
- Preserved the retired cleanup tip `b52b651` in a complete verified local Git bundle, then deleted remote `docs/iteration-4-cleanup` as authorized. Transferred its five missing task groups here without changing their verbatim prompts, dates, attribution or outcomes. Those groups describe earlier edits, not changes incorporated by this restart.
- Iteration 4 v10 tag resolves to `57455028739ad2d1aeb7f1d04723a01f6fb7190e`. PR #51 remains open against `ai-feedback-reimplementation`; current main is still the v8 application baseline plus later documentation and coverage tooling. Documentation must identify both until integration is separately authorized and verified.


### Later scope confirmation — November 19, 2026

Codex asked whether the task should also integrate the Iteration 4 application code into main. Injoon answered, verbatim:

```text
Documentation only, based on v10
```

Confirmed decision: use released v10 as the documentation baseline and leave application integration outside this task. The local draft already follows this scope; no app merge or new publication occurred.

### Verification record

- Used Stop Slop for current prose and the Google Sheets skill for bounded read-only UAT ranges. Read the original course Requirements, Design and Testing guidelines; retained each required document structure and distinguished proposed thresholds from measured outcomes.
- Updated all nine repository READMEs, Requirements v5.0, Design Rev.5.0, Testing, story/test inventory, setup/hosting and all six technical reference guides to released Iteration 4 v10. Main/app/deployment identities remain explicit. No application integration is claimed or performed.
- Read the User Story tab and `A1:M120` of the draft, TA and Group 5 UAT tabs. Counted populated Requirement+Step rows only: draft 55 Not Tested; TA 25 Accepted/30 Not Tested; Group 5 37 Accepted/18 Not Tested. Kept metadata gaps, original comments, proposed quality thresholds and incomplete AI checks explicit. Created a source summary without modifying the workbook.
- Preserved the two v10 Seoyeon task groups in the Iteration 4 log. Preserved the unmerged November 14 planning entry as unattributed because its contributor/model are unrecorded; left `ai-use-seoyeon` untouched. The old cleanup's five groups and both original submission ZIPs match their sources exactly. Existing story/acceptance blocks are byte-identical.
- Documentation checks verified 380 local references with no new failures and 30 new pinned GitHub source paths. Thirty-two existing historical references remain unavailable. Restored the old October 22 coverage anchor and its original result/screenshots after the first link check found two references to the moved section. New prose whitespace passes; one trailing space is intentionally retained inside a verbatim historical prompt. Mermaid fences/declarations were checked; no renderer was available.
- A documentation-writing script initially called `Path.write` instead of `write_text` and stopped before changing any reference guide; corrected the script and reran it. No application defect or test result is inferred from this tool-operation error.
- Verified the deleted remote cleanup ref absent and the complete local bundle restorable. The fresh branch and all documentation changes remain local and uncommitted. No push of the new branch, PR, Wiki publication, export/submission, provider call, VM/device check or application test run. Current v10 coverage, full UAT, contributor confirmation for an Iteration 4 team AI report and missing meeting records remain open.


## Separate Injoon's prompt log changes — November 19, 2026

**Contributor:** Injoon · **Iteration:** 4 · **Tool:** OpenAI Codex desktop · **Model:** GPT-6.2-Sol.

### Requests — verbatim

```text
Let's put all my prompts in a separate branch; is that recommended and possible?
```

```text
Yes, split my prompt-log changes into `docs/injoon-prompt-logs` and keep them separate from the Iteration 4 documentation changes. Keep it local for now.
```

### Decision and verification

- Injoon confirmed a local branch for the Injoon prompt-log changes from the Iteration 4 documentation draft. The branch starts at the same base, `ffe1d3a`.
- Codex transferred the existing log byte for byte before appending these requests. The contributor log is the only file in the branch diff. No application tests were needed for the split.
