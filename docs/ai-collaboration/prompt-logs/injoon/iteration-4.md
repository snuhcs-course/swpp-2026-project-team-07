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
