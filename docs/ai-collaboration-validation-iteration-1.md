# Iteration 1 reporting validation

**Draft for team review; not ready for submission.** Audited October 9, 2026 (Asia/Seoul), against all three pages of *5 - AI Collaboration Report Guidelines.pdf*. Reporting period: September 26–October 9. The documentation/comment package was committed at `3ca1e02` on `codex/ai-collaboration-report`, existing [PR #22](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/22). This follow-up adds Jaewon's supplied prompts; the requester authorized committing and pushing it to PR #22. Merge, Wiki publication and eTL submission remain outside this task.

## Compliance checklist

| Requirement | Finding |
| --- | --- |
| Six subjects; 500–700 words | **Met structurally:** six sections; **572 visible words**, including title, metadata, headings and link labels. One-page target is approximate; final Wiki/export pagination has not been checked. |
| AI use/non-use and tools | **Covered with attribution:** requester confirms all application code by AI, preferred Codex, human key/sensitive-data handling, phone testing and plan review. Recovered sessions record `gpt-6-astra`; other members' models/client versions are unknown. Four individual confirmations remain pending. |
| Verbatim development prompts | **Substantially improved, incomplete team coverage:** 28 recovered user-role messages (25 complete, three labelled opening excerpts), plus three complete contributor-supplied original quotations from Jaewon and four original Jooyoung messages supplied in the current reporting conversation. Feature requests/feedback dominate; one original consolidation prompt plus one secondary revert quotation remain administrative. Original Injoon feature conversations remain missing; Y1's sender label remains unresolved. Jaewon's quotations were checked against his supplied file, not an independently retrieved raw chat. |
| Success, evidence and reflection | **Covered:** alignment boundaries and storage failure/recovery, linked to immutable code/logs and PRs. Historical agent checks are identified; no fresh runtime or measured productivity claim. |
| Hallucinations/errors | **Honest bounded coverage:** verified SDK/native-duration defects, PDF tool-operation mistake, planning mismatch and cancellation race; no complete verified coding-assistant hallucination. Detector, correction and limits documented. Elapsed costs unknown. Members still need to supply their incidents or confirm none. |
| Genuine prompt revisions | **Covered:** PDF viewer→imported PDF in Practice with first-page entry; three-tab→two-tab UI; local→hosted Whisper choice; five implementation parts/five PRs→one PR; explicit→automatic transcription. AI-drafted approved plans are identified. No usability benefit inferred from tests. |
| Manual fixes and reasons | **Covered as requester testimony:** no manual application-code edits reported; repairs went back to Codex, the preferred agent. Humans supplied observations and decisions. Individual confirmation remains pending; no hand-written repair invented. |
| Every member's prompts/edit notes; writer | **Incomplete:** original prompts remain missing for Injoon; Y1's sender conflict remains unresolved. Jaewon's three supplied prompts and “Teammate A” attribution, plus Jooyoung's four representative recording messages, are now documented; Seoyeon's recovered selection and all members' edit/test notes need sign-off. Human report writer is not assigned by the agent. |
| AI source comments | **Partial:** 34 non-test baseline implementation modules receive verified Codex comments. Later source revisions, tests, migration and fixture attribution remain below. Human review named only for the two exact PR #3 modules whose final inspection is logged. |
| Wiki main page, linked subpage and sidebar | **Not performed, as requested.** After team review and separate publication authorization, publish “AI Collaboration Report – Iteration 1,” a linked prompt-log subpage and sidebar entry. This revision does not claim to inspect or update any existing live Wiki. |

## Source register

Primary retrieval read original Codex `response_item` user messages and assistant antecedents in project-scoped local/archived sessions; applicable Git history; named source logs; and live GitHub metadata/discussions. Available project Claude records concern documentation, not missing teammate development chats. A bounded app history listing did not supply those chats. Failure to recover them here does not establish they do not exist elsewhere.

The appendix contains the selected exact text. The source IDs below identify local original records for follow-up; they are not public conversation links. No raw private logs, recordings, credentials or unrelated conversations are included. Team-accessible original exports still need a privacy check and contributor handoff.

| ID | Original record | Locations used |
| --- | --- | --- |
| C1 | Course PDF, pp. 1–3; SHA-256 `6fb2c958679cd309487c53a654924158989a8678129577eb8d79177cdf9664bd` | Official six items, length, every-member inputs, source markers and Wiki/sidebar requirements. Template examples are not team facts. |
| S0 | Codex `01a0e661-f54a-7580-b004-7d7714418c30` | Sep 28 scaffold: user lines 9, 180, 212, 664, 890. |
| S1 | Codex `01a10ec2-c58c-79d1-8f6c-a7149bcc8d29` | Oct 6 initial UI request 12; assistant plan 90; approved copy 100. |
| S2 | Codex `01a10ef9-b667-7f50-aa24-cca3aaed889f` | Oct 6 clutter feedback 12; assistant plan 84; approved copy 94. |
| S3 | Codex `01a105e1-68ef-70a0-beb6-d23438e8c64d` | Oct 4 integration requests 12, 95; later playback context. |
| S4 | Codex `01a118b2-dd5e-7c03-b7fa-e0540257d5b1` | Oct 8 roadmap 163, provider choice 234; assistant/approved plan 296/306; checkpoint requests 1235, 1306; storage plan 1347/1357; Whisper request/plan 2198, 2261/2271; review request/plan 3739, 3790/3800; feedback request 5652, feedback 5717/5728, revised plan 5731, approval 5740; quota instruction 12339. |
| S5 | Codex `01a1165f-71dd-70a0-94ac-9ac5914d4cd5`, first segment | Oct 7 self-identification at 237: “My name is Seoyeon Park.” Identity is not inferred from the filesystem or Git alone. |
| S6 | Codex `01a111b4-3f83-7dd3-a376-6c543e8ba540` | Phone-test request 12; human result 199 (Oct 7 00:38 KST). |
| S7 | Codex `01a11be6-7fe4-7023-974e-b11306f9f9d2` | Oct 8 automatic-transcription request 118; Android test request 514. |
| S8 | Codex `01a11c82-e6c5-7e70-85eb-c57fb8e69c50` | Oct 9 contributor alias mapping 12. Previous post-revert-only scope at 1102/1129 is superseded by this task's whole-iteration instructions. |
| F1 | [Jaewon's supplied prompt file](history/jaewon-ai-collaboration-prompts-iteration-1.md); SHA-256 `6f937eacfccdc3466aab0018eaad6307f72be96bfa7f84d0438c0b9fdf344d1f` | Received Oct 9 with requester confirmation “This is jaewon's work”. J1 contains one full PDF-import request; J2 contains two full Practice follow-ups. Preserved byte-for-byte. Oct 4 is the feature-record date; exact prompt timestamps, message IDs and model/version are unavailable. |
| F2 | Jooyoung's current Codex conversation, supplied for this report update; no public transcript | Sep 30 scoped recording request and timeline/local-preview follow-ups; Oct 7 empty-timeline report. |

Legacy source labels C2/C3 (course period handouts), L1 (the preserved local AI-use snapshot), U1 (the prior report request) and the earlier S1 schedule evidence remain in the [historical source register](history/ai-collaboration-validation-iteration-1-before-feature-audit.md#source-register). The new S0–S8 table above names session sources; historical log labels retain their original meaning.

Requester statements in the current task establish the all-code-by-AI, preferred-agent, key/privacy, phone-testing, plan-review and no-reported-hand-edit claims. Earlier Claude Code report-preparation messages corroborate the reasons; they are not evidence that Claude generated the application. Historical exact source citations are embedded beside each appendix claim. Directly recovered original quotations, contributor-supplied original quotations, secondary quotations and summaries are distinguished. F1 resolves Jaewon's requester identity using the current user's confirmation and the supplied text; F2 records Jooyoung's current conversation without resolving the Y1 requester-label conflict. Git authorship alone is not the basis.

## Git and PR boundaries

Live metadata checked on October 9: #1/#3/#4/#5/#10 merged; #13 and #17–#22 open; #14–#16 closed without merge. #5 was reverted through #10 for separate feature-owner review. #15 and #17 share head `b60c3571a481cd60160ea79a3ab44bd5a86f2856`; consolidation retained the code. Relevant discussion fetches contained no additional comments, so they do not establish unnamed approvals or motives.

The draft uses immutable checkpoints: alignment `e71c3e0`, client/playback `92e542e`, original PDF `9547f1d`, recording `04857fb` and `040880f`, UI `54078a3`, rebuild `b60c357`, storage `06fe340`, processing `c7733d8`/`a0ee475`, review `1305917`/`3abcf4b`, feedback `ce9f248`. Earlier prototype behavior is not claimed to exist on current `main`. Open PR implementation is not merged functionality or human approval.

## AI code markers

**Applied scope:** 34 nonempty, non-test Python/TypeScript implementation modules present in this documentation baseline. The scaffold request/session, scaffold commit `e80e813`, PR #3/#4 disclosures and exact post-revert file contents establish Codex generation/modification. Comments name the iteration date interval, not an invented per-file generation day or model. Examples: [alignment](../backend/rehearsals/services/alignment.py#L1), [Whisper adapter](../backend/rehearsals/services/transcription.py#L1), [client](../mobile/src/features/transcription/client.ts#L1), [results screen](../mobile/src/features/transcription/ResultsScreen.tsx#L1), [PDF scaffold](../mobile/src/features/pdf/service.ts#L1).

`alignment.py` and `transcription.py` match the PR #3 source byte-for-byte before these comments. Its dated log records Injoon's final restaged inspection; only those two comments name him. This is logged human inspection, not a new teammate review or approval of later branches. Other comments make no named-review assertion. The PDF/recording modules here are restored scaffold placeholders; their comments do not attribute Jaewon's/Jooyoung's later implementations to Seoyeon.

| Marked group | Files |
| --- | --- |
| Backend configuration (6) | `backend/config/__init__.py`, `backend/config/celery.py`, `backend/config/settings.py`, `backend/config/urls.py`, `backend/config/wsgi.py`, `backend/manage.py` |
| Backend rehearsal implementation (9) | `backend/rehearsals/models.py`, `backend/rehearsals/serializers.py`, `backend/rehearsals/services/alignment.py`, `backend/rehearsals/services/feedback.py`, `backend/rehearsals/services/pdf.py`, `backend/rehearsals/services/transcription.py`, `backend/rehearsals/tasks.py`, `backend/rehearsals/urls.py`, `backend/rehearsals/views.py` |
| Mobile routes/contracts (6) | `mobile/src/app/_layout.tsx`, `mobile/src/app/index.tsx`, `mobile/src/app/rehearsal.tsx`, `mobile/src/app/results.tsx`, `mobile/src/app/viewer.tsx`, `mobile/src/contracts/index.ts` |
| Mobile feature/UI/services (13) | `mobile/src/features/pdf/LibraryScreen.tsx`, `mobile/src/features/pdf/SlidePreview.tsx`, `mobile/src/features/pdf/ViewerScreen.tsx`, `mobile/src/features/pdf/service.ts`, `mobile/src/features/recording/RehearsalScreen.tsx`, `mobile/src/features/recording/service.ts`, `mobile/src/features/transcription/ResultsScreen.tsx`, `mobile/src/features/transcription/client.ts`, `mobile/src/features/transcription/playback.ts`, `mobile/src/features/transcription/service.ts`, `mobile/src/services/api.ts`, `mobile/src/services/notImplemented.ts`, `mobile/src/ui/components.tsx` |

**Remaining scope:** comparing the implementation at PR #21 head `ce9f248` against this documentation baseline identifies **72 non-test implementation modules, 60 absent or different**. Those 60 need their final tool/scope/review attribution assessed on the active feature branches; the 12 unchanged modules can carry their verified comments forward through normal integration. Do not overwrite active feature worktrees merely to add this draft's comments. This audit uses the combined #21 snapshot, not an assertion that every open branch has identical contents. Earlier UI-only prototype modules at `54078a3` also require markers if reused.

Key outstanding groups: real PDF/catalog/rendering and recording helpers in #13/#17; local persistence/upload and backend storage in #18; queue/provider orchestration and automatic-transcription hooks in #19; player/PDF/recovery review modules in #20; provider/description/coaching services and feedback UI in #21. Each owning member must confirm source reuse and review scope before publication.

Tests and migrations are unchanged under this task's scope: `backend/config/test_settings.py`, `backend/rehearsals/test_alignment.py`, `test_transcription.py`, `tests.py`, `migrations/0001_initial.py`, and `mobile/tests/` still need any required authorship annotations in an authorized follow-up. Empty Python package files need no generated-code attribution. `mobile/src/fixtures/whisperTranscript.ts` is disclosed saved Whisper output, not coding-model-authored transcript; retain that distinction. `mobile/src/fixtures/demo.ts` says “Hand-authored UI examples,” which needs clarification against the requester's all-code-by-AI statement before assigning an individual author. Non-code JSON/manifests/locks cannot receive ordinary comments safely; use adjacent supported source comments and an attribution record rather than alter their formats.

## Verification of this revision

The committed package passed checks for **28 recovered original messages**, **34 comment-only source reconstructions**, **15 unchanged Python ASTs** and **19 unchanged TypeScript token streams**. Its source files are unchanged in this follow-up.

Jaewon follow-up checks: all **three supplied quotations** match F1 verbatim, and the archived file matches the attachment byte-for-byte. Jooyoung follow-up: four messages are transcribed from the current reporting conversation as F2; that private conversation has no public transcript. The existing 28 recovered quotations and main report remain unchanged. Fresh checks passed for **143 local links** (including anchors), **92 Git reference occurrences**, the existing 28 original-message matches, source ranges, sensitive content and diff whitespace. The main report still has six sections and 572 visible words.

Validation checks: exact quotation matching against original user messages (full text or explicitly labelled prefix); assistant antecedents for both UI plans; six headings and visible word count; local Markdown target/anchor resolution; immutable Git objects, paths and referenced line bounds; code-marker allowlist and reconstruction of every original byte after removing only inserted comments; Python AST/TypeScript token comparisons; changed-scope credential/private-path scan; `git diff --check`.

These are documentation/comment checks, not reruns of the historical test suites. No runtime behavior, tests, dependencies, migrations, architecture or API contracts changed. No new Android/device, backend, provider or usability check was performed. Documentation self-review is not an independent reviewer or teammate approval. Existing uncommitted documentation was snapshotted before revision; the previous validation content is retained in the linked historical snapshot (only relative links rebased); `docs/ai-use.md` retains its existing contents, including historical evidence gaps, and receives appended task entries. The Jaewon follow-up resolves the earlier gap in the current appendix/checklist without rewriting historical log entries. Unrelated main-worktree edits remain untouched.

## Before submission

Obtain the four members' inputs and resolve the named gaps in [the contributor checklist](ai-collaboration-prompts-iteration-1.md#8-missing-contributor-evidence-and-confirmation-checklist). Choose the human writer, secure final team review, finish source-marker coverage on the integrated revision, and provide accessible prompt sources. Then, only after authorization, publish and verify the Wiki report, prompt subpage and sidebar, and check the course submission requirement. Word count and six headings alone do not make this draft submission-ready.

## Earlier audit records

The prior validation document is preserved as a [historical snapshot](history/ai-collaboration-validation-iteration-1-before-feature-audit.md). These compatibility anchors keep the append-only AI-use history navigable; they do not reassert its superseded counts, scope or statuses.

<a id="initial-roadmap-prompt-recovery"></a>
<a id="documentation-verification"></a>
<a id="reflective-revision-evidence-search"></a>
<a id="focused-editorial-review"></a>

Historical details: [roadmap recovery](history/ai-collaboration-validation-iteration-1-before-feature-audit.md#initial-roadmap-prompt-recovery), [earlier documentation verification](history/ai-collaboration-validation-iteration-1-before-feature-audit.md#documentation-verification), [earlier prompt retrieval](history/ai-collaboration-validation-iteration-1-before-feature-audit.md#reflective-revision-evidence-search), and [editorial review](history/ai-collaboration-validation-iteration-1-before-feature-audit.md#focused-editorial-review). Current findings are in the checklist above.
