# AI Collaboration Report – Iteration 2

**Team 07 · OutLoud · October 10–23, 2026 (Asia/Seoul)**

**Provisional draft as of October 20.** Rotating writer, remaining contributor details and report review are pending. The available records do not establish review of every member’s full history. Refresh this report after October 23 before final review or publication; see the [current evidence and coverage record](ai-collaboration/iteration-2/README.md).

## 1. Where AI was used and deliberately not used

We used AI for implementation, tests, review and documentation. [Injoon’s Scribe work](ai-collaboration-prompts-iteration-2.md#scribe-v2-transcription--october-16-2026) used OpenAI Codex, GPT-6 family; the exact variant was not recorded. [Jaewon’s UI rebuild](ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026) used Claude with configured `claude-opus-5-5`; the serving model was not separately recorded. His [recording refinements](ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026) used Codex, model not recorded. Seoyeon used Codex `gpt-6.1-sol` for [saved-recording Review/Full Review navigation](ai-collaboration-prompts-iteration-2.md#review-navigation-after-saved-recordings--historical-supplement-october-1617-2026). These development assistants differ from the app’s ElevenLabs `scribe_v2` provider.

[Seoyeon reports](ai-collaboration/iteration-2/members/seoyeon.md#contributor-account) avoiding AI for API keys and actual human testing. He supplied no further reasons; other contributors’ deliberate non-use remains unconfirmed.

## 2. Prompt history

The [Iteration 2 log](ai-collaboration-prompts-iteration-2.md) holds actual prompts, task outcomes and known limits. Section 5 quotes exact revision excerpts. Full-history and owner privacy review remain pending; missing metadata does not mean no AI use.

## 3. What AI did well

Codex coordinated the Scribe adapter, provider-specific consent, historical-result compatibility and slide-derived vocabulary hints in [commit `9779e5a`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/9779e5a6236a3c951085d6e007be5570f5f2c9ba). The [integration record](ai-collaboration-prompts-iteration-2.md#scribe-v2-integration-onto-merged-main--october-16-2026) reports 296 backend tests passing against disposable PostgreSQL with zero skips, plus 180 mobile tests and Android JavaScript export. Coordinating the provider, stored evidence and client consent made the migration checkable across its boundaries. These were agent-operated checks, not human acceptance.

The [phone evidence](evidence/scribe-full-flow-20261016/README.md#physical-phone-recovery-and-completed-flow--later-october-16) documents one user-made 16.83-second recording. After restoring USB forwarding, the agent retried the saved take: one Scribe request returned 26 timed words across three slide visits, preserving `Uh,` and `Um,`. The phone cache matched the server. This demonstrates one recovery path; no listening audit establishes accuracy or filler recall. These sources record no development time savings.

## 4. Hallucinations and errors

The agent first reported five fillers in the public-audio precheck. Its punctuation filter excluded `uh--`, so that count was wrong. Codex checked the raw receipt, corrected the count to six and reran the mobile parser assertion. The [evidence table](evidence/scribe-full-flow-20261016/README.md#confirmed-live-backend-path) makes the correction inspectable. This was an analysis error, not an app parser defect.

A separate Codex reviewer also found that Q&A could bypass the new Scribe consent. Codex added the gate and upgrade/cancel/retry tests; [the second review](ai-collaboration-prompts-iteration-2.md#scribe-v2-transcription--october-16-2026) reported no further actionable issue. Repair time and token cost were not recorded. These examples do not establish a hallucination-free iteration.

## 5. Prompt revisions

Jaewon first requested: “change the record/redo so that you have to press 3 seconds to redo. its too fast right now”. He then clarified: “Whole presentation only”. The [recorded effect](ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026) was a 3000-ms whole-presentation hold while single-slide redo retained tap and confirmation. The clarification narrowed an ambiguous control requirement. Agent checks confirmed the build and visible hint; the full gesture was not exercised on device.

## 6. Manual fixes and why

Seoyeon reports no manual application-code edits. He reports personal end-to-end physical-phone checks for whether AI cues appeared and whether simulator-tested behavior held on hardware. His reply gives no dates, phone model, detailed coverage or pass/fail results. Other contributors’ manual edits and reasons for stopping prompting remain unconfirmed. Codex authored the consent repair; we cannot count it as a manual fix. Source comments identify AI work in [transcription](../backend/rehearsals/services/transcription.py#L4) and [recording state](../mobile/src/features/presentations/store.ts#L4); final submitted-revision attribution still needs review.

## 7. Takeaway for the next iteration

We will specify the affected control and expected behavior in the first prompt, retain independent review for consent paths, and check reported counts against saved evidence. Before finalizing this iteration, remaining contributor details and model metadata need confirmation; the team must distinguish successful recovery from accuracy and human approval.
