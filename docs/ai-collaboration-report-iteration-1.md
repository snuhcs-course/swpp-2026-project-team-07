# AI Collaboration Report – Iteration 1

September 26–October 9, 2026. **Draft for team review.**
Draft assembled by Codex for Seoyeon Park; human writer/sign-off pending.
Contributors documented: Injoon, Jaewon, Jooyoung and Seoyeon.
Full [prompt appendix](ai-collaboration-prompts-iteration-1.md) and [validation](ai-collaboration-validation-iteration-1.md).

## 1. Where AI was used and deliberately not used

AI wrote all application code and Codex was our preferred coding agent. Injoon's records cover alignment, Whisper and transcript playback; Jaewon's commit covers PDF import/viewing; Jooyoung's covers recording; Seoyeon's covers integration and interface revisions. Individual prompts are included in the appendix.

AI was not used when handling API keys and sensitive data to keep secrets out of prompts, physically tested phones, and reviewed AI plans. Codex also prepared environments and ran automated/emulator checks. These roles are different; individual confirmations remain pending.

## 2. Actual prompt history

The [appendix](ai-collaboration-prompts-iteration-1.md) preserves development requests, typos and approved AI plans, alongside explicit gaps for teammates' unavailable conversations. Seoyeon's rebuild request began “I would like to implement the remaining work in this order:” and specified PDF/recording integration, storage, processing, review and feedback. Her follow-up was “I would like to implement whisper api and i would like to give gemini or openai feedback” ([S3](ai-collaboration-prompts-iteration-1.md#s3-rebuilding-the-current-feature-flow-october-8)). That changed the roadmap's local-Whisper choice before implementation.

## 3. What AI did well

Injoon asked for incremental alignment work. Codex generated `align_words` and nine tests for exact boundaries, repeated/backward visits, silence and invalid timestamps. The [PR #3 evidence](ai-collaboration-prompts-iteration-1.md#i1-standalone-word-to-slide-alignment-september-29) records passing synthetic checks and his later staged-code inspection. Explicit rules made the output reviewable: a boundary word belongs to the new slide, while revisiting a slide creates another visit. These checks did not establish human-speech accuracy.

For [storage, PR #18](ai-collaboration-prompts-iteration-1.md#s4-durable-recording-storage-and-retry-acceptance-october-8), Codex implemented restart recovery and retry protection. Its historical checks included 94 mobile tests, 19 PostgreSQL storage tests and agent-operated failure/retry checks retaining UUID, media hashes and timeline. Asking for preservation through failure gave us stronger acceptance evidence than checking a successful upload alone. No time-saving estimate was measured.

## 4. Hallucinations and errors

We recovered implementation errors, but no complete verified coding-assistant hallucination. The [Whisper adapter](ai-collaboration-prompts-iteration-1.md#i2-hosted-whisper-adapter-and-response-shape-repair-september-29) assumed a successful response supported `model_dump()`. An independent Codex reviewer found non-object responses escaped as `AttributeError`. Codex added a type guard and regression cases; the final historical backend suite passed 23 tests.

[Jooyoung reported an empty Android timeline](ai-collaboration-prompts-iteration-1.md#y2-empty-android-timeline-after-stop-october-78): Stop reset native duration before the code read it. Codex preserved duration before stopping; Jooyoung confirmed the timeline appeared. Rework included a helper, caller change and retesting; elapsed cost was not recorded. PR #10's revert restored separate feature review, while #14–#16 were consolidated into #17 with code retained. Those were workflow decisions, not evidence of hallucination.

## 5. Prompt revisions

The [October 6 sequence](ai-collaboration-prompts-iteration-1.md#s2-playback-transcript-and-navigation-revision-october-6) began with a request for presentations, library and home tabs. After implementation, the user wrote: “I feel like the ui is too cluttered right now how could we change it”. Codex proposed Home plus Presentations and Feedback/Playback review; the user approved that agent-written plan. Commit `54078a3` implements the revision. Naming the primary actions constrained the redesign; passing tests established behavior, not improved usability.

## 6. Manual fixes and why

No manual application-code edits were reported; the requester says fixes generally returned to Codex because it was preferred. Humans diagnosed symptoms, challenged scope and accepted or rejected plans. We did not invent a hand-written repair. Authorship comments in [alignment.py](../backend/rehearsals/services/alignment.py#L1) and [33 other baseline modules](ai-collaboration-validation-iteration-1.md#ai-code-markers) record verified scope; coverage remains incomplete. Next iteration, each member should retain exact prompts, decisions and verification together so accountability survives integration.
