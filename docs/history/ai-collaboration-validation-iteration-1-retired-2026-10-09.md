> **Archived review, October 9, 2026.** Retired in favor of the [human review checklist](../ai-collaboration-guidelines.md#human-review-before-submission). This snapshot preserves source notes and findings from before retirement. Its counts and status are historical; do not update it. Relative links were adjusted for this directory.

# Iteration 1 reporting validation

Internal checklist for the [report](../ai-collaboration-report-iteration-1.md) and [collaboration log](../ai-collaboration-prompts-iteration-1.md). Working branch: `codex/ai-collaboration-report`, [PR #22](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/22).

**Status:** content revised and reviewed against the [official guideline](https://myetl.snu.ac.kr/courses/305891/files/9386035), Section 2(a–f). The selected claims are supported within the limits below; full compliance remains open where contributor input, final code attribution or publication/export is unverified. This is an agent evidence review, not team sign-off.

<a id="compliance-checklist"></a>

## Content review

**Supported** means the report's stated claim is backed within its limits. **Partial** means a required detail or confirmation remains open. **Missing** means a required subject has no answer. These findings assess the current report, not just the presence of section headings.

| Course requirement / report section | Finding and evidence | Remaining action |
| --- | --- | --- |
| **2(a): Where AI was used and deliberately not used — §1** | **Partial.** Tasks are attributed to all four contributors, Codex and known models are named, and local key/private-data handling gives a reason for excluding that work from prompts. Human testing is distinguished from agent checks. Sources: contributor entries and requester testimony. | Confirm Jaewon/Jooyoung models if available, any other tools used, and each member's deliberate non-use. The privacy account is not four independent confirmations. |
| **2(b): Actual prompt history — §2 and §5** | **Supported.** §2 links to the full verbatim log. §5 retains four exact quotations from [I3](../ai-collaboration-prompts-iteration-1.md#i3-mobile-transcription-client-and-synchronized-transcript-september-29) and [J2](../ai-collaboration-prompts-iteration-1.md#j2-imported-pdf-in-practice-and-first-page-entry-october-4); three are labelled excerpts. The guideline allows a long log on a linked Wiki subpage. Using a link-only §2 with revision quotations in §5 is our interpretation of that instruction, not an explicitly prescribed format. | Keep the full log accessible from the published report and exported PDF. Contributor confirmations remain below; do not reconstruct quotations. |
| **2(c): What AI did well — §3** | **Supported.** [I1](../ai-collaboration-prompts-iteration-1.md#i1-standalone-word-to-slide-alignment-september-29) supports nine alignment tests and the boundary/visit rules; [S4](../ai-collaboration-prompts-iteration-1.md#s4-durable-recording-storage-and-retry-acceptance-october-8) supports 94 mobile tests, 19 PostgreSQL storage tests and preserved data through retry/restart. The report explains how timing rules made alignment checkable and how retry checks tested data preservation. It claims neither human-speech accuracy nor measured time savings. | No correction to these bounded examples; final test/deployment status is outside these historical claims. |
| **2(d): Hallucinations and their detection/cost — §4** | **Partial.** [I2](../ai-collaboration-prompts-iteration-1.md#i2-hosted-whisper-adapter-and-response-shape-repair-september-29) and [Y2](../ai-collaboration-prompts-iteration-1.md#y2-empty-android-timeline-after-stop-october-78) support the wrong response-shape/duration assumptions, AI versus human detection, Codex repairs and verification. They are classified as implementation defects. No confirmed hallucination is asserted; repair work is described and elapsed costs are explicitly unrecorded. | Each member should supply any specific hallucination incident and known cost, or confirm none. Do not relabel ordinary defects or invent a duration to fill this requirement. |
| **2(e): Revised prompts and why they helped — §5** | **Supported.** [I3](../ai-collaboration-prompts-iteration-1.md#i3-mobile-transcription-client-and-synchronized-transcript-september-29) pairs approval of the saved-result proposal with the exact highlighting correction; `92e542e` documents playback behavior and its test limits. [J2](../ai-collaboration-prompts-iteration-1.md#j2-imported-pdf-in-practice-and-first-page-entry-october-4) pairs imported-PDF navigation with the first-page rule; `9547f1d` implements `slide: 0` and records page-one entry. The explanations connect added constraints to observable behavior. | Keep the first Injoon quote labelled as approval of a proposal. Jaewon's follow-up adds a requirement; it does not establish that the earlier instruction was incorrect. No usability improvement is claimed. |
| **2(f): Manual fixes and why — §6** | **Partial.** The report states that no manual application-code fixes were reported and identifies the preference for asking Codex to repair code. Injoon's inspection, Jaewon's requirements and Jooyoung's retest are correctly described as human decisions/checks, not human-authored repairs. | Confirm direct edits and reasons with each member, including non-code artifacts where relevant. The current testimony cannot establish that nobody made any manual edit. |
| **Takeaway — §7 (optional in the course guideline; included in our format)** | **Supported.** Three lessons have named evidence in the report: §5 / I3 and J2 show why the first prompt should state expected behavior; §4 / I2 supports separate AI review and tests for discovered bugs; §4 / Y2 supports phone testing before declaring a feature complete. The storage/recovery example in §3 / S4 also supports testing recovery paths. Each lesson leads to a concrete next-iteration action. | Review these proposed practices with the team. The evidence supports the lessons; it does not establish that the next-iteration actions have already happened or that all members approved them. |

## Example selection

The report uses Jaewon's first-page rule, Injoon's alignment/playback work, Jooyoung's device defect and Seoyeon's storage/recovery work. These cover implementation boundaries, prompt refinement, debugging and verification. Selection is based on distinct lessons and available evidence; equal quotations per member are not a course requirement. Y1's unresolved requester attribution is not used to support a named example in the report.

## Format and submission status

| Check | Status |
| --- | --- |
| Report length and structure | **580 visible words**, six required sections in short bullets plus a separate §7 takeaway. §2 contains only the log link; §5 retains the revision quotations. One-page PDF layout remains unchecked. |
| Quotations | Four report quotations match logged messages; three are labelled excerpts. The log contains **75 fenced quotations** plus the separate revert quotation. |
| Every member's input; rotating writer | Contributor checks below and a human report writer/sign-off remain pending. |
| AI code comments | 34 baseline implementation modules annotated; inspect the final integrated revision. |
| Wiki and PDF | Main page, linked prompt subpage, sidebar, PDF layout and exported links need final checks/publication. |

## Contributors

Contributor references follow Injoon's October 9 correction: Injoon, Seoyeon and Jaewon are male; Jooyoung is female.

| Contributor | Pronouns | Confirmation needed |
| --- | --- | --- |
| Injoon | he/him | Prompt selection and any additional manual edits or personal checks; resolve Y1 authorship with Jooyoung. |
| Seoyeon | he/him | S0–S8 prompt selection, phone-test scope, manual edits/non-use and report writer. |
| Jaewon | he/him | Model if known, acceptance/edit decisions and personally performed checks. F1 supplies his three prompts; its October 4 date is the feature-record date. |
| Jooyoung | she/her | Model if known, Y1 requester name and Y2 retest details. Y1's old entry names Injoon, while Jooyoung supplied its prompts. |

An agent-operated test or AI-written repair does not establish a contributor's personal test or manual edit. Seoyeon's broader all-code-by-AI/no-hand-edit statements are requester testimony, not four individual attestations. F1/F2 are supplied quotations; their private chats were not independently retrieved. Missing information remains unconfirmed.

## Source register

The IDs match source locators in the collaboration log's Markdown comments. Private session identifiers are traceability references, not public transcript links. AI-written plans, opening excerpts and task-log quotations remain labelled.

<details>
<summary>Prompt and guideline sources</summary>

| ID | Original record | Locations used |
| --- | --- | --- |
| C1 | [Official course PDF](https://myetl.snu.ac.kr/courses/305891/files/9386035), pp. 1–3; downloaded and re-read October 9; SHA-256 `6fb2c958679cd309487c53a654924158989a8678129577eb8d79177cdf9664bd` | Official six items, length, every-member inputs, source markers and Wiki/sidebar requirements; long logs may use linked Wiki subpages while the main page keeps the analysis. The format and prompt-log title in the example are not mandatory. |
| S0 | Codex `01a0e661-f54a-7580-b004-7d7714418c30` | Sep 28 scaffold: user lines 9, 180, 212, 664, 890. |
| S1 | Codex `01a10ec2-c58c-79d1-8f6c-a7149bcc8d29` | Oct 6 initial UI request 12; assistant plan 90; approved copy 100. |
| S2 | Codex `01a10ef9-b667-7f50-aa24-cca3aaed889f` | Oct 6 clutter feedback 12; assistant plan 84; approved copy 94. |
| S3 | Codex `01a105e1-68ef-70a0-beb6-d23438e8c64d` | Oct 4 integration requests 12, 95; later playback context. |
| S4 | Codex `01a118b2-dd5e-7c03-b7fa-e0540257d5b1` | Oct 8 roadmap 163, provider choice 234; assistant/approved plan 296/306; checkpoint requests 1235, 1306; storage plan 1347/1357; Whisper request/plan 2198, 2261/2271; review request/plan 3739, 3790/3800; feedback request 5652, feedback 5717/5728, revised plan 5731, approval 5740; quota instruction 12339. |
| S5 | Codex `01a1165f-71dd-70a0-94ac-9ac5914d4cd5`, first segment | Oct 7 self-identification at 237: “My name is Seoyeon Park.” Identity is not inferred from the filesystem or Git alone. |
| S6 | Codex `01a111b4-3f83-7dd3-a376-6c543e8ba540` | Phone-test request 12; human result 199 (Oct 7 00:38 KST). |
| S7 | Codex `01a11be6-7fe4-7023-974e-b11306f9f9d2` | Oct 8 automatic-transcription request 118; Android test request 514. |
| S8 | Codex `01a11c82-e6c5-7e70-85eb-c57fb8e69c50` | Oct 9 contributor alias mapping 12. Previous post-revert-only scope at 1102/1129 is superseded by this task's whole-iteration instructions. |
| F1 | [Jaewon's supplied prompt file](jaewon-ai-collaboration-prompts-iteration-1.md); SHA-256 `6f937eacfccdc3466aab0018eaad6307f72be96bfa7f84d0438c0b9fdf344d1f` | Received Oct 9 with requester confirmation “This is jaewon's work”. J1 contains one full PDF-import request; J2 contains two full Practice follow-ups. Preserved byte-for-byte. Oct 4 is the feature-record date; exact prompt timestamps, message IDs and model/version are unavailable. |
| F2 | Jooyoung's current Codex conversation, supplied for this report update; no public transcript | Sep 30 scoped recording request and timeline/local-preview follow-ups; Oct 7 empty-timeline report. |
| R1 | [Retired AI-use record](ai-use-before-prompt-consolidation-2026-10-09.md) | Preserves the historical body and checks, with the later user-authorized pronoun correction noted in its header. A2 in the prompt appendix links each of 13 migrated secondary excerpts to its dated source entry; paraphrased requests and an artifact title were not converted into prompts. |
| R2 | Injoon's current reporting conversation, October 9; no public transcript | Twelve original messages in A3 cover the collection workflow, document style, contributor references and content-focused report validation. |

| ID | Original record | Locations used |
| --- | --- | --- |
| I-S1 | Codex `01a0e7ea-363f-7062-9324-358a2391840d`, **Review GitHub pull request**; segment `rollout-2026-09-29T14-04-51-01a0e7ea-363f-7062-9324-358a2391840d_01a0eb8d-2710-7213-9ec8-6b1eb275b7c1.jsonl` | Original user lines 22, 44, 113, 132, 142, 247, 489, 645, 846, 856. Assistant context at 27, 37, 125, 135, 638, 660, 839, 849; later user assent 667. Selected turns record `gpt-6-astra`; segment metadata records `cli_version: 0.153.4`. |
| I-S2 | Same Codex session, segment `rollout-2026-09-29T17-29-01-01a0e7ea-363f-7062-9324-358a2391840d_01a0ec48-1460-7052-834f-0bbb09f8ef64.jsonl` | Original user lines 37, 199, 398, 493, 560. Assistant context at 30, 192, 204, 391, 417, 553, 577; publication request 584. Selected turns record `gpt-6-astra`; segment metadata records `cli_version: 0.158.0-alpha.2.1`. |

The two Injoon segments belong to the same conversation. Their `cli_version` fields identify the runtime, not a verified desktop release. Source dates and verification results refer to their cited revisions; no raw private media or credentials are included.

</details>

## AI code markers

The existing audit covers **34 nonempty, non-test implementation modules** in this documentation baseline. [Alignment](../../backend/rehearsals/services/alignment.py#L1) and [transcription](../../backend/rehearsals/services/transcription.py#L1) name Injoon's recorded inspection; other comments make no named human-review claim. See the [file inventory and audit](ai-collaboration-validation-iteration-1-before-submission-cleanup.md#ai-code-markers).

At audited feature checkpoint `ce9f248` (PR #21), 60 of 72 non-test modules were absent or different from the documentation baseline. Recheck attribution on the final submitted revision, including tests, migrations and fixtures. Clarify `mobile/src/fixtures/demo.ts`'s “Hand-authored UI examples” label before assigning authorship. These counts describe the earlier checkpoint, not current remote state.

## Submission checks

1. Resolve the contributor inputs above, select the human writer and review the report together.
2. Check AI source-comment coverage on the exact submitted code revision.
3. Publish **AI Collaboration Report – Iteration 1** to the repository Wiki, link the full log on a subpage and add the report to the sidebar.
4. Verify PDF pagination and links. Include `team7-iter1-AI-collaboration-report.pdf` in the [required submission ZIP](https://myetl.snu.ac.kr/courses/305891/assignments/381929).

Guide and validation are internal working documents, not additional named eTL deliverables.

<a id="verification-of-this-revision"></a>

## Verification

Content review traced the selected examples to logged messages and task evidence. Local Git reads checked the adapter guard at `e71c3e0`, playback/review records at `92e542e`, and PDF entry code/device notes at `9547f1d`. Storage and recording-fix results use the existing cited task records; their Git objects were unavailable locally in this pass. No runtime checks were rerun.

Mechanical checks passed: four exact report quotations, all 74 prior log quotations preserved, 290 local links/anchors valid, 580 report words and clean diff whitespace. Word count excludes Markdown bullet markers. The bullet revision retains the six required subjects, named actors, error corrections and testing limits. §2 links to the full log; §5 supplies exact revision examples. The guide, report and validation share the seven-section outline. The three takeaways trace lessons to report examples and next-iteration actions; shared instructions require these documents to stay consistent. These checks support the content findings above; they do not replace contributor confirmation.

## Supporting evidence and contributor follow-ups

[Detailed task evidence](ai-collaboration-prompts-iteration-1-before-format-cleanup.md) and the [earlier review history](ai-collaboration-validation-iteration-1-before-submission-cleanup.md) preserve the full source explanations and previous check results. Editorial pronouns in two historical records were corrected at Injoon's request; their original prompt quotations and task facts are unchanged. Current requirements and open items are listed above.

<!-- Compatibility anchors for links in historical records. -->
<a id="appendix-format-check-october-9"></a>
<a id="before-submission"></a>
<a id="documentation-verification"></a>
<a id="earlier-audit-records"></a>
<a id="focused-editorial-review"></a>
<a id="git-and-pr-boundaries"></a>
<a id="historical-package-verification"></a>
<a id="initial-roadmap-prompt-recovery"></a>
<a id="injoon-prompt-recovery-verification"></a>
<a id="prompt-log-consolidation-and-shared-instructions-october-9"></a>
<a id="reflective-revision-evidence-search"></a>
<a id="restore-task-notes-beside-prompts-october-9"></a>
<a id="submission-facing-prose-october-9"></a>
