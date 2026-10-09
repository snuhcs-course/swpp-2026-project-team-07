> **Historical snapshot, superseded.** This preserves the pre-revision audit for traceability; its counts, selected scope and statuses are not current. Relative links were adjusted for this directory. See the [current validation](ai-collaboration-validation-iteration-1-retired-2026-10-09.md). Links to the retired review now point to its archive.

# Iteration 1 reporting validation

**Status: draft package; not ready for submission.** The main report contains all
six required sections. Structural coverage does not mean that every evidence
requirement has been satisfied.

The current-product revision contains **633 words** in the main report. Both
report and prompt appendix now cover the rebuild after PR #10 merged on October 7
at 21:30:30 KST. Earlier prototype examples remain in the master log and historical
validation below, outside the selected report/appendix. The requester’s statements
about human responsibilities are retained; other members’ confirmation, report
approval and source-code marker compliance remain pending.

Prepared October 9, 2026, Asia/Seoul. GitHub metadata was refreshed during this
implementation; the retrieval checkpoint was 02:39 KST (17:39 UTC on October 8).
The reporting window ends October 9, but this snapshot cannot cover later work
or establish an exact submission hour. Subsequent publication must refresh
statuses and the retrieval cutoff.

Additional historical-source retrieval for the reflective revision reached
03:15 KST on October 9 (18:15 UTC, October 8). Newly recovered prompt examples
date from October 6–7, inside the verified reporting window. This does not claim
coverage of work after retrieval or refresh all PR statuses in the table below.

## Source register

| ID | Inspected source | What it establishes / limit |
| --- | --- | --- |
| C1 | Course handout “5 - AI Collaboration Report Guidelines.pdf”, pp. 1–3; SHA-256 `6fb2c958679cd309487c53a654924158989a8678129577eb8d79177cdf9664bd` | Six subjects, approximately 500–700-word main report, verbatim prompts, team inputs, Wiki/sidebar, code markers. Example names/code are illustrative, not team history. |
| C2 | Course handout “Week 2-2. Project Overview.pdf”, p. 14 timeline; pp. 16–19 pre-iteration/deliverables; SHA-256 `154c1472dee291792bd0c47277a294b8ed410e9534cfb4e0522bc0d4a80d3c1d` | Iteration 1 follows September 25 and ends October 9; AI report is a deliverable. No exact Iteration 1 submission hour identified. |
| C3 | Course handout “Week 4-1. Team Exercises.pdf”, p. 11; SHA-256 `ff038d15b68fb4d45641490ec2778b89b9f73053dc65042d561dcec26da86477` | Later course timeline corroborates C2's boundaries. |
| S1 | [“Free edits of Team 07” schedule](https://docs.google.com/spreadsheets/d/1xpFF6HDp7Yg71O_VKgKQD7yxM8ptniUNu0Siw_2QCRI/edit#gid=1533464390), bounded Schedule A1:G22 and Overview/Config reads during this conversation | Team planning record, not an official period authority or proof of actual work. Sep 21 kickoff deadline / Sep 25 recorded end; requirements/design and schedule rows have Sep 25 recorded ends; Iteration 1 review deadline Oct 9; Iteration 2 kickoff Oct 10. Earlier rows remain outside this report pending clarification. |
| G1 | [main at f6f6e76](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/f6f6e76605632296a802aecef25ac10c6d0fd0cd), [baseline log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f6f6e76605632296a802aecef25ac10c6d0fd0cd/docs/ai-use.md), [PR #5 archive](../history/pr-5-ai-use.md) | Main baseline, original disclosures and revert preservation. Earlier “pending” statements are historical, not current PR status. |
| G2 | [e71c3e0 log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md), alignment implementation and nine test methods | Named Injoon requester, recorded Codex implementation and historical nine-test pass. Static inspection confirms test cases exist; it is not a fresh test run. |
| G3 | [9547f1d](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b), [04857fb](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/04857fb93d0a64784feb8bfb1d4b61f4b47bf251), [040880f](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/docs/ai-use.md) | Original Jaewon/Jooyoung contributions, ambiguous original requester labels, and explicitly named Jooyoung testing in the later recording entry. |
| G4 | [prototype log at 33907d3](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/33907d35fd7a52ef3b3fcbd56990af41b50d7cfd/docs/ai-use.md) | Historical integrated prototype records; not evidence that current main includes these features. |
| G5 | [rebuild log at ce9f248](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/ce9f248256b1bbfc0d66f139886503261cc25953/docs/ai-use.md), plus per-stage heads below | Rebuild, consolidation, reviews, verification and reused prototype sources. Inherited entries are deduplicated by task, not counted as new contributions. Development-model versions remain unspecified where source says “configured model.” |
| L1 | Initial local prototype AI-use snapshot: 74,074 bytes; SHA-256 `ff284aacfea5f8719f4d71249efebb5df9ee13b2814ccd16f912e83f03fdb677`; 95 added lines beyond 33907d3 | Read-only local unpublished evidence. Unique events now have template-based task entries in the master log. The entire snapshot remains an exact prefix of the source after a concurrent schedule entry was appended. Underlying chats, artifacts and historical runtime claims were not independently revalidated here. |
| U1 | Current report-preparation conversation, original request, safeguards, alias mapping, Jooyoung correction and implementation authorization | Direct user evidence for this documentation scope/correction. Does not prove every historical prompt sender, manual editor or reviewer. No public conversation link was supplied. |

The course PDFs were inspected locally; no stable course download URLs were supplied.
Use their exact course titles/pages and fingerprints to locate them through eTL.
They were not copied into the repository. Obtain accessible course/source references
before final handoff when readers cannot reach them. No local host paths are needed
in the Wiki text.

## Revision and PR snapshot

| PR | Retrieved status | Inspected head |
| --- | --- | --- |
| #1 | merged | `e80e81313d3c5faa775795fa97797b5507b17360` |
| #2 | merged | `bcb285966cd4f2362a48863ec3dc3b9d0ac94d32` |
| #3 | merged | `e71c3e06945517219b9a343e80f9680829c0bd58` |
| #4 | merged | `92e542e6f4cfe558bda39fa090826f539b3ae728` |
| #5 | merged, later reverted by #10 | `0d7fdb241403cab824d387d4b1e172f6a90ad6c8` |
| #10 | merged | `d54960cc314a362baacf362439ae21224292a905` |
| #13 | open, unmerged | `040880f8a21b2f866228984e9fb3c438fa6ee4bf` |
| #14 | closed, unmerged; superseded by #17 | `56e4bf638bd7fb0ed8af14ca331d6cfd64e22d29` |
| #15 | closed, unmerged; superseded by #17 | `b60c3571a481cd60160ea79a3ab44bd5a86f2856` |
| #16 | closed, unmerged; superseded by #17 | `d3ef0b9fa79b5eec32ce95e170dc8cf96e7036a5` |
| #17 | open, unmerged | `b60c3571a481cd60160ea79a3ab44bd5a86f2856` |
| #18 | open, unmerged | `06fe340a207639826143383364c13b4dd9636d31` |
| #19 | open, unmerged | `a0ee4755fb6f9a56c77fd967bdd83d1f7a37c400` |
| #20 | open, unmerged | `3abcf4b6c97bbd6ef2da6cfd6d40670b4dbfca88` |
| #21 | open, unmerged | `ce9f248256b1bbfc0d66f139886503261cc25953` |

These are source snapshots, not new code-review approvals. A PR author's identity
does not prove all prompting/editing roles. #15 and #17 share the exact head, which
supports preservation during consolidation; the source log records related reuse
and the backup before redundant branch removal.

## Submission blockers

| Requirement | Current state | Exact information needed / person to confirm |
| --- | --- | --- |
| Individual attribution | Original contribution and several roles supported; some prompt senders unresolved | Each member confirms which prompts they sent, edits they made, reviews they performed and checks they personally ran. Resolve PDF “Teammate A” separately from Jaewon's Git authorship. |
| Original prompts | Three selected requests in current P1–P3 match original user messages R4; requester supplied the roadmap again and confirmed scope. | Other members confirm their roles and supply any additional representative evidence needed; team-accessible source copies remain part of handoff. |
| Deliberate non-use | Requester confirmed local key handling and plan review on October 9. R4 line 2383 independently records choosing backend-only local key configuration during the post-revert Whisper stage. Codex also assisted setup and agent-operated checks. | Other members confirm their individual responsibilities; do not imply all setup/device work excluded AI. |
| Development-assistant hallucination | No complete verified example established | Exact incorrect model assertion, contradictory source, detector, correction, consequence and documented cost. Alternatively, members may explicitly confirm none for their work after review; do not infer this. |
| Prompt revisions | Current P1/P2 document local-Whisper roadmap wording followed by the hosted-Whisper/selectable-feedback request and the resulting PR #19/#21 implementation. | Team confirms its interpretation; no measured time-saving or controlled prompt experiment is claimed. |
| Manual fixes | Requester confirmed that application code was AI-written and Codex was the preferred coding agent. The current report labels the post-revert cancellation repair as AI-written. | Other members confirm no hand edits in their features. |
| Useful contribution / reflection | Post-revert storage/retry behavior and historical checks at 06fe340 support section 3. | Team confirms the personal reflection; historical agent checks are not fresh tests or human acceptance. No time-saving estimate. |
| Source-code markers | Awaiting compliance work | Audit final AI-assisted scope, add accurate tool/date/scope/reviewer comments through a separately authorized change, and link them. Do not fabricate human review. |
| Period discrepancy | Course boundaries verified; early team-sheet labels conflict | Team/TA clarification if September 21–25 work is proposed for inclusion; until then keep it outside report. |
| Team report approval | Pending | Confirm human writer; all members supply/approve their own evidence; writer checks final report. |
| Wiki/eTL delivery | Not performed | After separate authorization, publish report/prompt page/sidebar; confirm assignment destination/deadline, export and verify actual submission receipt. |

Missing evidence must remain visible. A six-section document can be a complete draft
while failing submission readiness.

## Documentation verification

The initial draft received the checks below. The later task-format revision is
recorded separately at the end of this section. The independent review covered
the initial draft and was an AI documentation review; human approval remains pending.

- Scope: one updated master log and four supporting Markdown files; no application,
  dependency, migration, source-comment or public-interface change.
- Historical-record preservation at initial review: baseline dated entries and
  PR #5 archive matched the exact base. The later user-requested formatting revision
  restructures task entries; the original checkout, stable source revisions and
  PR #5 archive preserve the original wording.
- Initial main report: **609 words**, counting visible whitespace-delimited text after
  removing Markdown link destinations and formatting markers, including title,
  headings and metadata. Supporting documents are excluded.
- Temporary read-only Python documentation checks passed: six required sections,
  local link/heading resolution, immutable Git object/file existence and line
  ranges, balanced fences, trailing whitespace and reference portability.
  That initial package contained 31 checked local links and 18 distinct Git targets.
- Authenticated GitHub readback also resolved all 18 stable commit/file targets:
  13 bounded file reads and five commit-object reads. This verifies source
  availability at checking time, not public access or permanent retention.
- Three P1/P2 log quotations match their source exactly, including punctuation.
  P3 was compared with the retained initial local log; P4 with the current message.
  This does not authenticate underlying historical chats; provenance limitations
  remain visible.
- Newly authored text has no host-absolute filesystem paths, temporary citation
  syntax or mutable branch-based code links. Original historical sources remain
  accessible even where the working log now uses the common entry template.
- `git diff --check` passed. The Python check also covered all four new files,
  which ordinary unstaged Git diff does not include.
- Original checkout branch/HEAD/index and schedule draft match the initial
  snapshot. The initial AI-use contents, including all 95 added lines, match an
  exact **74,074-byte prefix** after concurrent work appended an Excel-schedule entry.
  Initial whole-file/diff equality therefore correctly failed and was investigated,
  not suppressed or restored. Later AI-use SHA-256:
  `692ea94234bdcb1274df0d68f09462a50f4530f2e4238a50df99c9c7b6319e51`.
- Concurrent output drift: the revised workbook changed to SHA-256
  `bec23900b6d8da9cc1005d36ced8c7cf853f3ad65c0a3dc391ff647b5b851202`;
  its inspection sidecar was no longer present. This task did not modify either.
  Final readback matched those observed states. No stash/reset/clean or restoration
  of another task's work was performed.
- `git grep -n -i` for `AI-generated`, `AI-assisted`, `generated with` and
  `reviewed by` under `mobile/src` and `backend/rehearsals` returned no matches
  at both `f6f6e76` and `ce9f248` (exit 1, no matches). This bounded phrase
  search does not prove an exhaustive provenance audit or marker compliance.
- Independent Codex documentation review checked attribution, quotations,
  alignment source/tests, task-specific counts and incident classifications.
  It found three incorrect source-line ranges; all were corrected and the final
  link checks passed. It found no other actionable factual/attribution issue.
  The reviewer did not rerun app tests, authenticate original chats, refresh
  GitHub status or independently inspect the course PDFs. Parent source inspection
  and automated documentation checks cover the latter source/link work separately.
- Application builds/tests, native/device checks and provider calls: not rerun for
  this documentation-only task.
- Commit, push, Wiki publication and submission: not performed.

Task-format follow-up, October 9: at the user's request, the master log now
contains its unchanged entry template and 54 dated task entries, with no
standalone contributor index, task table or report-guidance section. Former
table-only tasks and free-form follow-ups now use the template. Roles, period
classification, source provenance and corrections sit within each entry. The
three early planning entries explicitly record missing AI-use evidence and remain
outside the report. The separate historical archive is unchanged.

The follow-up also updates supporting links and replaces this guide's competing
task-field list with a link to the master template. It does not expand the main
report's retrieval snapshot or resolve any submission blocker. Documentation
validation covers all 54 entries' fields, duplicate headings, relative links and
anchors, immutable source references, Markdown formatting, the then-609-word report
and preservation of the original checkout. These checks passed: 54 entries match
the unchanged 13-field template, 105 local links resolve, 17 distinct Git targets
exist, source line ranges are valid, three logged quotations match their sources,
and `git diff --check` reports no whitespace errors. This follow-up receives agent
self-review; it does not claim a new independent review, application test run,
commit or publication.

During this follow-up, another task appended “Feature-focused Excel schedule
revision v2” to the original checkout. The 76,926-byte file read at the start of
formatting remains an exact prefix of the observed 79,479-byte file (SHA-256
`5d0d4aad6a74af8599550c8e39d191df5da941ac085fff8a225ab0ee5d7e7d46`). This
later task record remains in the original source and is outside the task snapshot
normalized here. The original branch, HEAD, index and schedule draft remain
unchanged; this formatting task neither wrote nor restored the concurrent files.

## Reflective revision evidence search

The course handout was reread in full; its SHA-256 still matches C1. It requires
six subjects, actual prompts, concrete benefits/errors, prompt revisions and
manual-edit explanations, with honesty and verifiability taking priority over
polish. The revised report uses inferred developer lessons rather than inventing
the team's personal reflections. It gives the adapter defect its own account
and reduces the PR histories to one workflow paragraph. No realistic-but-fictional
project event, prompt, human edit, cost or approval was added.

The search covered the master log, historical log revisions, prompt appendix and
16 available project agent records containing 68 substantive user-role messages.
Relevant messages and neighboring task outcomes were inspected after searching
for manual editing, non-use, errors, revisions and UI/transcript feedback. This
was a bounded search of locally available project records, not access to every
member's private conversations. No verified human-written code patch or its
reason for ending prompting emerged. Existing examples still attribute repairs
to Codex and human detection/confirmation to the named contributor.

Live GitHub discussion reads returned empty timelines for PRs #3, #4, #5, #10,
#13, #14, #15, #16 and #17; #4 succeeded on retry after a connection timeout.
Commit-comment endpoints for e71c3e0 and 54078a3 also returned no comments. PR #3
and #13 descriptions corroborate the adapter review and Jooyoung's timeline
verification. Empty discussions do not prove that no human review happened;
Injoon's reported staged-code inspection comes from the source log and PR #3
description. No additional human-authored fix was inferred from Git authorship.

Original-message sources for the new appendix excerpts:

| ID | Local record identity and location within it | Evidence / fingerprint |
| --- | --- | --- |
| R1 | Session `01a10ec2-c58c-79d1-8f6c-a7149bcc8d29`, user message at record line 12, October 6 01:13:44.757 UTC | P5 original transcript/three-tab request. Record SHA-256 `8d77e6b7ae8a3f7aa52648ef855be96710ee06e40b08b3914044dfef6980e194`. |
| R2 | Session `01a10ef9-b667-7f50-aa24-cca3aaed889f`, user messages at lines 12 and 94, October 6 02:10:26.696 and 02:12:33.070 UTC | P5 clutter feedback and approved two-tab plan. The matching agent-authored plan is at line 84. Record SHA-256 `165b4f2f9e1f47ee6312f16b173a7cf5349a9518a4596baaaadd580062708187`. |
| R3 | Session `01a11571-a9e5-71b2-b902-6aa2aa137094`, user question reply at line 181, October 7 10:27:03.685 UTC | P6 exact answer “I’ll import it manually,” with the tool-access question as context. Record SHA-256 `7f425c9e17080f836b412f994da3cc6d2c89f5bd1b287dd67554442cd311c532`. |

These IDs/fingerprints locate local evidence without publishing host paths or
whole conversations. The appendix reproduces only task-relevant excerpts. The
identities of the human senders remain unconfirmed; no account-name or Git-author
inference was used. Contributor review and a team-accessible evidence copy remain
needed for submission. Terminal whitespace lies outside the quoted excerpts;
spelling, wording and Markdown inside them are unchanged.

Claim checks:

- **Alignment:** [historical implementation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/backend/rehearsals/services/alignment.py)
  and [nine tests](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/backend/rehearsals/test_alignment.py)
  support the 3,999/4,000-millisecond example, repeated/backward visits, silence
  and invalid-input checks. The [source log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md#L69-L90)
  records the initial nine/14 passes; [later human inspection](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md#L189-L200)
  concerns the final staged feature. The report does not assign agent-run tests
  to Injoon or treat the 14-test initial suite as the later 23-test suite.
- **Adapter defect:** live readback of [the repair entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md#L152-L176)
  confirms AI detection/repair and nine transcription/23 backend passes. It
  provides no specific false model assertion, human-authored fix or measured cost.
- **UI revision:** R1/R2 supply actual before/after instructions and the reported
  problem. [54078a3](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L467-L480)
  preserves implementation, 52-test/export and emulator evidence. Static inspection
  checked the tab definitions, Library redirect and Feedback default at this
  revision. Attribution is user-approved revision, not unaided human authorship
  of the implementation plan or proof of a measured usability gain.
- **Manual-code boundary:** live readback of [Jooyoung's entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/docs/ai-use.md#L319-L352)
  keeps human bug reporting and confirmation separate from the Codex-written
  repair. The manual import is a UI operation, not an alternative manual-code case.

Documentation validation checks the six report sections, the 500–700-word limit,
all relative links/anchors and immutable source targets, source-line bounds,
P5/P6 quote substrings against the original messages, and Markdown whitespace.
No application, device or provider test was rerun for this prose revision. The
master log retains its entry template; this task adds one dated entry. No commit,
push, Wiki publication or submission is authorized or claimed.

Reflective-revision result before the focused edit: **593 words**, six sections, 111 checked local links, 21 valid immutable
Git targets, eight new original-message excerpt checks and three existing
log-quotation checks; no validation errors. All 55 master-log tasks follow the
unchanged entry template. The reusable guide and historical archive are unchanged
by this revision. The word count includes the title, headings and metadata after
removing link destinations and formatting markers; supporting files are excluded.

Preservation check: the original checkout's branch/HEAD/index and schedule draft
remain unchanged. Its starting AI-use content remains an exact prefix after a
concurrent requirements-document entry was appended. During this work, 21 existing
files under `outputs/reqspec/` also changed; 209 other sampled original-checkout
files remained byte-identical. This task wrote only the four report-related
Markdown files in the isolated documentation worktree and did not overwrite,
restore or validate the concurrent requirements artifacts. No stash, reset, clean,
rebase or switch of the original checkout occurred.

## Focused editorial review

On October 9, the user requested a focused edit of the current draft, which had
added blanket claims of no AI use for physical-device testing and environment/API-key
setup, and no human code implementation or repair during the iteration. Neither
claim was treated as contributor confirmation merely because it appeared in the
draft. The course handout's checksum still matches C1; its six subjects and
500–700-word target remain the editorial criteria.

- **Physical-device work:** the [phone preparation](ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--physical-phone-test-preparation)
  and [demo-launch](ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-07--physical-phone-demo-launch) records describe
  Codex starting Metro, configuring USB forwarding, installing/launching the app
  and checking phone rendering. The original demo-request message in session
  `01a1156d-300e-7072-8121-dd2db02113f1`, line 12, asks the agent to run the app
  on a physical device. Human testing also occurred, but that does not establish
  an explicit decision to exclude AI from all physical-device work.
- **Environment/API-key setup:** [the PR #21 setup record at ce9f248](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/ce9f248256b1bbfc0d66f139886503261cc25953/docs/ai-use.md#L1368-L1376)
  identifies Codex and describes runtime setup, migrations, provider configuration
  and private loading of existing credentials. No credential values were inspected
  for this editorial check. The records do not identify who originally created
  or entered each key, or a deliberate AI-free setup step and reason. No named
  contributor confirms the broader claim. P6's manual-import choice remains a
  narrower example; its sender's identity is still pending.
- **Manual correction search:** the prior bounded project-record search remains
  applicable; two targeted phone/demo records were checked in this follow-up.
  Session `01a111b4-3f83-7dd3-a376-6c543e8ba540`, line 1013, records a requester
  saying they rebuilt the presentation themselves after disliking the AI-generated
  deck. Line 971 concerns completed schedule rows P8/P9. These are human artifact
  edits, not evidence of an application-code correction. The record's SHA-256 is
  `511b6f2cadce5a9339741b47f61d48621c205492f18b1481e20ee1096802c12b`.
  No verified human-authored code patch and reason for stopping prompting was
  found. The report states that bounded finding rather than declaring that no
  team member ever edited code manually.

The edit preserves `align_words`, the adapter defect, navigation revision and
all three original prompt excerpts. It shortens the PR discussion and repeated
qualifications, with detailed role/evidence limits retained here. Test counts
remain historical claims tied to e71c3e0 and 54078a3; no runtime checks were rerun.
Submission still requires the contributor evidence and review listed above.

Before the light follow-up, focused-edit checks passed: **585 words**, six sections, all three report prompt
quotations unchanged, 115 resolved local links and 21 valid immutable Git targets
with valid source-line ranges. Seven original-message excerpts and three existing
log quotations matched their sources; `git diff --check` passed. The prompt
appendix, reusable guide and historical archive are unchanged. All 56 task-log
entries use the unchanged template, and pre-existing task entries remain intact.
The original checkout's branch/HEAD/index/status and schedule draft match the
starting snapshot; its starting AI-use contents remain preserved. Application
code, commits, pushes and publication were outside this edit.

The October 9 light follow-up simplifies sentences and makes the practical lessons
clearer while retaining the examples, six sections and draft status. It restores
the navigation prompt's original spelling from P5 after the latest draft had
spell-corrected it, and repairs two Markdown section headings. The evidence gaps
and historical-test limits above remain unchanged.

Light-edit checks passed: **576 words**, six sections, all three report quotations
matched to their original messages, 115 resolved local links and 21 valid immutable
Git targets. The template and 56 task entries remain intact; only the current
editorial entry received a follow-up note. The prompt appendix, guide, historical
archive and original checkout were preserved. No application tests were rerun.

## Requester-confirmed revision

On October 9, the report requester said they disliked the previous report
wording and supplied these statements in a Claude Code conversation (model:
Claude Opus 5.5):

> As a team all our code was written by ai. Non ai portions were handling api keys and sensitive data, physical phone testing, and making good plans by reading plans and giving feedback on it

> After every feature was implemented before making branch it was tested locally on phone and after tests passed it was pushed into branch

These statements are the requester's confirmation of team practice. They replace
the earlier treatment of the blanket non-use and no-manual-edit claims as
unsupported. They are not yet confirmation from the other three members.

Report changes:

- **Section 1** states that AI wrote all application code. It lists API keys and
  sensitive data, physical phone testing and plan review as work the team kept
  for itself, and adds the test-on-phone-before-branching practice.
- **Section 2** adds the first P2 quotation. The P6 manual-import example was
  removed from the report and remains in the appendix.
- **Sections 3–5** keep the same examples, counts and links in shorter wording.
  Section 4 now gives the reasons for the #10 revert (separate feature review)
  and the #14–#16 consolidation (overlapping PRs), from P1 and the PR snapshot.
- **Section 6** states that no one edited application code by hand.
- The "Draft" status line was removed from the report body; status is tracked here.

Evidence consistency:

- The [phone preparation](ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--physical-phone-test-preparation)
  and [demo-launch](ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-07--physical-phone-demo-launch) records show
  Codex starting Metro, configuring USB forwarding and installing the app.
  Section 1 therefore says Codex installed builds and claims only hands-on
  testing as human work. The [human phone-test record](ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-07--human-phone-test-result-and-clearer-iteration-1-presentation)
  supports a human test: the user reported the phone flow worked overall, with
  transcription accuracy as the exception. The per-feature test-before-branch
  practice rests on the requester's statement; no per-feature test log exists.
- The PR #21 setup record shows Codex loading existing credentials privately.
  This is consistent with team members creating and entering keys. The report
  states the intent to keep secrets out of prompts, not a verified outcome.
- Three statements were initially agent-drafted: the key-handling reason, the
  section 6 reason, and the section 4 lesson that AI produces code faster than
  the team can review it. The requester resolved all three in the follow-up below.

Checks passed: **696 words** (same counting method as above), six sections, five
report quotations matched to the prompt appendix, one local link resolved and
`git diff --check` reported no whitespace errors. No application test was rerun.
Commit, push, Wiki publication and submission were not performed.

Reason follow-up, October 9: the requester replied to the three agent-drafted
statements. For key handling:

> had to make sure that keys werent submitted to the prompt which caould lead to securtiy breaches.

For routing every fix through Codex:

> preferred coding agent

The requester listed the section 4 lesson without changes; it remains as written.
Section 1 now gives the security-breach reason and section 6 states that Codex
was the preferred coding agent; the agent-drafted reasons were removed. Checks
passed: **699 words**, six sections, five report quotations matched and
`git diff --check` reported no whitespace errors.

## Initial roadmap prompt recovery

On October 9 the requester identified missing prompts for PRs #14 and #17–#20,
then included #21, supplied the initial roadmap again and requested representative
initial prompts instead of a full transcript. The requester explicitly limited
both report and appendix to the current product after the revert. This supersedes
the older example selection described in earlier sections; historical validation is retained as
history, not as the current appendix contents.

Readback of PR #10 establishes the boundary: merge at October 7, 12:30:30 UTC
(21:30:30 KST). PRs #14 and #17–#21 were read back on October 9 in this follow-up.
Their heads match the revision table above. #14 is closed and superseded by #17;
#17–#21 remain open at retrieval. This is not an assertion of merge or human approval.

R4 is original local session `01a118b2-dd5e-7c03-b7fa-e0540257d5b1`, initial retrieval SHA-256
`1efab8aa6ad4e0734a255824002952d87b8588c02593b6ba86d64397bc69d894`.
Its user-role messages supply:

| Current appendix | Record line | Original timestamp | Evidence |
| --- | --- | --- | --- |
| P1 | 163 | October 7 23:39:30.096 UTC / October 8 08:39:30 KST | Full initial six-stage roadmap; also supplied by the current requester on October 9. |
| P2 | 234 | October 7 23:45:56.910 UTC / October 8 08:45:56 KST | Hosted Whisper and Gemini/OpenAI feedback request. The agent-drafted plan at line 296 and user-approved copy at line 306 incorporated that choice. |
| P3 | 5652 | October 8 05:45:56.287 UTC / 14:45:56 KST | Initial feedback planning, output/display design and API-risk request. |

The active session record changed during this task; all three selected messages
were rechecked unchanged. SHA-256 fingerprints of their exact message text,
including terminal whitespace, are:

- P1: `1dea29618c0367d84fbe216750881c76a9f0be95c15dfcca735ef4723d9b49a2`.
- P2: `87dd6051d2037d565f206c1715b26dedc070352e5beb4007c4ee0998edb11568`.
- P3: `6e23d1078a3333a96cd8f293d78c250600f57b7da80f2f9096efa9d77d0e3b76`.

Selected quotations omit terminal whitespace only. Original spelling and Markdown
are retained. They establish requests, not unaided authorship of every planning
sentence. The appendix contains no source code or pre-revert prompt examples.
Stages 1–5 map to #14/#17, #18, #19, #20 and #21 respectively; stage 6 is retained
only inside the verbatim initial roadmap, not presented as completed UI work.

The previous search omitted this initial roadmap from its selected examples and
left later implementation in a summary-only row. The corrected selection removes
the earlier UI/alignment examples from the report. Master-log histories and original
feature credits are preserved, with links to the newly recovered requests added
inside the existing task template.

Current report claims were checked against these immutable records:

- [Storage at 06fe340](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/06fe340a207639826143383364c13b4dd9636d31/docs/ai-use.md#L375-L387):
  94 mobile tests, 19 PostgreSQL storage tests, emulator offline/retry preserving
  UUID/audio/visits, and database/API restart with matching media hashes.
- [Automatic transcription at a0ee475](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/a0ee4755fb6f9a56c77fd967bdd83d1f7a37c400/docs/ai-use.md#L503-L510):
  AI reviewer detected a delayed-status cancellation race; Codex repaired the pending
  intent and a failing regression. The recorded 125-test pass belongs to that update;
  native first-use cancellation remained unverified.
- [Hosted processing at a0ee475](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/a0ee4755fb6f9a56c77fd967bdd83d1f7a37c400/docs/ai-use.md#L490-L501)
  and [feedback at ce9f248](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/ce9f248256b1bbfc0d66f139886503261cc25953/docs/ai-use.md#L1274-L1285):
  outcomes of the provider-choice revision. No code from before the revert is used
  as a report example, even though the project reused earlier work with attribution.

R4 line 2383 records the requester’s explicit choice to configure a backend-only
key locally. Credential values were neither read nor copied. Earlier requester
attestations about manual responsibilities remain in earlier sections; other
contributors’ review is pending. Documentation checking does not revalidate the app.

Current-product documentation checks passed: **633 words**, six report sections,
three original appendix prompts and three report excerpts matched to R4, all dated
after the revert. Checked 124 local links and 19 immutable Git targets, including
source-line ranges. All 57 master-log entries follow the unchanged template.
The original checkout, schedule draft, guide and historical archive were preserved.
Only the report, appendix, task log and validation document changed; no application
tests, commits, pushes or publication were performed in this follow-up.

## Handoff

Review the [main report](../ai-collaboration-report-iteration-1.md), collect missing
member evidence through the [prompt form](../ai-collaboration-prompts-iteration-1.md#contributor-submission-form),
then apply the [guide](../ai-collaboration-guidelines.md). Refresh mutable statuses
before publication. Leave unknowns explicit instead of inventing complete answers.
