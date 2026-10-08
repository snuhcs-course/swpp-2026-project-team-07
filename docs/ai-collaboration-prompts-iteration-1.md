# Iteration 1 prompt appendix

Supporting document for the [main report](ai-collaboration-report-iteration-1.md);
excluded from its 500–700-word limit. Retrieval: October 9, 2026, Asia/Seoul.
This is a partial evidence collection, not a complete team prompt history.

## Provenance rules

- **Original-message verified:** wording is visible in the original user message.
- **Log quotation verified:** wording matches the cited task log exactly; original
  message/transcript and sender identity have not necessarily been verified.
- **Summary only:** a task description or paraphrase, never an original prompt.
- **Missing:** original prompt not available in the inspected evidence.

Quotes retain spelling and capitalization. Do not infer a sender from Git author,
PR publisher, file owner or account identity. Before final submission, each member
must confirm their own quotations or supply their original messages. A later task
instruction is not automatically a revised version of an earlier prompt.

## P1: Revert request

- Work date recorded: October 7; within Iteration 1.
- Wording status: log quotation verified; original-message verification pending.
- Sender: source says “user”; PR author is Injoon, but that alone does not prove
  who entered this prompt.
- Tool: OpenAI Codex; development-model version not recorded.
- Source: [revert record at f6f6e76](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f6f6e76605632296a802aecef25ac10c6d0fd0cd/docs/ai-use.md#L309-L317);
  [PR #10](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/10).
- Recorded outcome: inverse of #5 prepared for separate feature reviews, with
  preserved history; subsequent PR metadata confirms merge.

> Okay I want to revert #5 through new PR.

## P2: Publication and review instructions

- Work date recorded: October 8; within Iteration 1.
- Wording status: two successive log quotations verified; original messages and
  sender confirmation pending. Do not label these a verified prompt-revision pair.
- Sender: unnamed user in source; Seoyeon is the publication author.
- Tool: OpenAI Codex; development-model version not recorded.
- Source: [stage-1 final review at b60c357](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/b60c3571a481cd60160ea79a3ab44bd5a86f2856/docs/ai-use.md#L329-L337).
- Recorded outcome: publication for human review and continuing other authorized
  work, without claiming teammate approval or authority to merge.

> just post it as a pr so another person can check the code but continue implementing other features,

> implement everything and then wait for others to merge.

The first quotation includes the comma and the second includes the period
preserved inside the source quotation. Original-chat punctuation remains unverified.

## P3: Backup and branch-cleanup request

- Work date recorded: October 7; within Iteration 1.
- Wording status: matches a local unpublished log quotation; original message
  verification pending. This is weaker provenance than a committed source.
- Sender: that entry explicitly identifies Seoyeon Park.
- Tool: OpenAI Codex with GitHub/browser and local verification tools.
- Source: [backup and branch-restoration task](ai-use.md#2026-10-07--preserve-prototype-and-restore-original-github-branch-layout), originally titled “Seoyeon Park:
  preserve prototype and restore original GitHub branch layout”; source-file
  fingerprint is recorded in [validation](ai-collaboration-validation-iteration-1.md#source-register).
- Recorded outcome: backup/restore verification and approved remote branch
  housekeeping. Do not interpret the word “delete” as repository deletion.

> yes back up everything so we have a view and then delete the branches so my teammates can reupload like before

## P4: Current report request

- Date: October 9; within the reporting window at retrieval.
- Wording status: original-message verified in this report-preparation conversation.
- Sender: current report requester; personal identity not assigned from account
  metadata. This request is evidence of report preparation, not a substitute for
  each feature contributor's original prompts.
- Tool: OpenAI Codex. The exact underlying model/version was not independently
  verified for this record.
- Source: original user message in the current conversation; team members need an
  accessible source or contributor attestation before treating it as shared evidence.
- Outcome: this documentation package; no publication or submission.

> Make ai collaboration report guideline for our project. take into consideration ai_use document. It might be best to first update ai_use.md it by adding who added which and how they used it. (Seoyeon = Seoyeon; Injoon = Injoon; zoo or joo or zoo_zero = Jooyoung and justaoj = Jaewon)
>
> For hallucinations or errors add the reason why we had to revert codebase or the deleted repors in pr 14 ~ 16 because of aui. errorss.

Trailing Markdown whitespace is omitted; wording, punctuation and spelling are
retained. The requester later required strict evidence categories and preservation
safeguards. Those are scope corrections, not evidence that a prompt revision improved
generated code.

## P5: Interface prompt revision

- Date: October 6, within Iteration 1. Original local agent records were inspected
  during the reflective-report revision on October 9; source fingerprints and
  message locations are in [validation](ai-collaboration-validation-iteration-1.md#reflective-revision-evidence-search).
- Sender: the requester in those records; a named contributor has not confirmed
  ownership of these messages. Do not infer the sender from the commit author.
- Tool: OpenAI Codex; development model/version not established by the excerpt.
- Quotation status: exact textual excerpts from user-role messages, retaining
  spelling and Markdown. Terminal message whitespace is outside the excerpts.

Before, October 6 at 10:13:44 KST:

> I want to make it so transcript goes along with playback highlighting the current word it is t. Also place transcript inside the playback area. Also I would like the main screen to be divided into sdifferent tabas of presentations, librabry, home screen

Feedback, October 6 at 11:10:26 KST:

> I feel like the ui is too cluttered right now how could we change it

After, an excerpt from the implementation plan the requester explicitly sent
for implementation at 11:12:33 KST:

> Use **Home + Presentations** as the two main tabs. Home prioritizes practicing your latest deck; saved rehearsals open **Feedback first**, with Playback one tap away. Keep the blue accent and reduce repeated headings, bordered cards, explanatory text, and large secondary buttons.

This is a user-approved, agent-drafted refinement of the earlier request. It is
not evidence that the requester personally composed every sentence of the plan,
nor a controlled prompt experiment. The earlier approved plan specified three
tabs, matching the initial request; the revised plan merged Library into
Presentations and made practice/Feedback the primary actions.

[54078a3, source log lines 467–480](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L467-L480)
records the resulting implementation, 52 passing mobile tests, Android export,
separate AI review and agent-operated emulator checks. The checks exercised
Home/Presentations navigation, the Library redirect and Feedback/Playback behavior.
They establish the requested navigation change, not a measured usability gain or
human acceptance. The development lesson is an inference: specifying priorities
and removals made the requested change concrete enough to implement and inspect.

## P6: Deliberate manual demo import

- Date: October 7 at 19:27:03 KST; within Iteration 1.
- Sender: unnamed requester; contributor identity awaits confirmation.
- Source: original user-role question reply in local record R3, identified in
  [validation](ai-collaboration-validation-iteration-1.md#reflective-revision-evidence-search).
- Context: the agent reported that desktop control could not access the emulator
  window and asked whether it could use ADB to open OutLoud and import the PDF.
- Exact answer:

> I’ll import it manually

Codex prepared the emulator, file and server access, then handed over the final
import. The [task entry](ai-use.md#2026-10-07--mac-emulator-pdf-import-demo-preparation)
records that no import/navigation was performed or verified in that run. This
supports an explicit choice not to delegate that UI operation to AI. It does not
establish AI-free code development, a completed manual import or a manual code fix.
The tool-access difficulty is recorded context; a broader personal reason was not
provided and should not be invented.

## Summary-only records

| Task | Available record | Exact prompt still needed |
| --- | --- | --- |
| Injoon: alignment and Whisper | [e71c3e0](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md#L69-L108) describes incremental alignment → adapter → screen work | Original messages, date, tool/model and contributor confirmation |
| Injoon: client/playback | [92e542e](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/92e542e6f4cfe558bda39fa090826f539b3ae728/docs/ai-use.md) records scope and UI corrections | Original request and any claimed revision pair; do not back-translate summaries |
| Jaewon: original PDF contribution | [9547f1d](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L218-L267) gives a summarized request from “Teammate A” | Identify prompt sender independently of commit author; original message and date |
| Jooyoung: recording | [04857fb](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/04857fb93d0a64784feb8bfb1d4b61f4b47bf251) and [040880f](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/docs/ai-use.md) record tasks and correction | Original recording/reintroduction prompts and role confirmation; human bug report is not a manual code patch |
| Seoyeon: prototype, restoration and later publications | [prototype log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/33907d35fd7a52ef3b3fcbd56990af41b50d7cfd/docs/ai-use.md), [rebuild log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/ce9f248256b1bbfc0d66f139886503261cc25953/docs/ai-use.md) | Confirm which requests Seoyeon personally sent; original prompts and model versions where known |

## Contributor submission form

Copy once per task. Do not fill unknown fields by guessing.

- Person and role:
- Work date and iteration:
- Tool/model/version, or “not recorded”:
- Exact original prompt:
- Source available to the team:
- Generated material incorporated, modified or rejected:
- Stable commit/PR and relevant files/lines:
- Verification, person/agent performing it and outcome:
- If revised: exact before and after prompts, reason, changed output and check:
- If edited by hand: actual editor, diff, reason for stopping prompting and check:
- If deliberately no AI: task, explicit decision, reason and person confirming:
- If a hallucination: exact assertion, contradictory source, detector, correction,
  consequence and measured cost if available:
- Permission to include the redacted evidence in the shared report:

Exclude credentials and private recordings/transcripts. When a prompt contains
sensitive content, mark omissions explicitly and disclose that the shared quotation
is redacted rather than fully verbatim. Do not manufacture a failure example or
infer that silence means “no AI used.”
