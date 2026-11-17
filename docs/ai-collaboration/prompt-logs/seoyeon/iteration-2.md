# Seoyeon — Iteration 2

[AI collaboration index](../../README.md). Entries retain their recorded context and attribution.

<a id="record-055"></a>

<a id="i2-phase-1-ai-feedback-foundation--october-15-2026"></a>

### Phase 1 AI-feedback foundation — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Context:** Codex desktop (GPT-6; exact model identifier not recorded), with a separate reviewer agent. Isolated branch `it2/feature/ai_feedback` from `eeb3307a431e62d80b2b2d261420963193da22c3`. The user approved the phased plan and authorized Phase 1 only; no UI, Phase 2, commit, push or merge is authorized.
- **Retained AI material:** Requirements/context model and strict API, additive migration, separate mobile requirements persistence and API client, canonical selected-run analysis-scope helper, tests and contract/phase documentation. Existing screens, runs, attempts, workers and provider paths remain unchanged.
- **Verification:** Baseline: 168 mobile tests; 286 SQLite backend tests (19 skips). Final Phase 1 after review fix: `npm run check` passed typecheck/lint and 178 mobile tests; `npm run bundle:android` passed. Backend `manage.py check`, `test`, and `makemigrations --check --dry-run` with `config.test_settings` passed (297 tests, 20 skips). Disposable PostgreSQL 16: 297 tests passed (1 packaged-VAD dependency skip), including row-lock concurrency; migration drift check passed. Migration 0006→0007→0006→0007 preserved all synthetic deck/slide/attempt fields and did not backfill requirements. No live-provider calls, Redis/worker runtime checks, or device-flow claims; no worker behavior changed.
- **Independent review:** Initial staged snapshot SHA256 `039c7f24ef3ade7883d1bde21b93a89b869461d92ff8e3a5690d15ff9142914c`: one P3 malformed-Unicode finding. Agent added backend/mobile failing regression tests, then rejected unpaired surrogates while preserving valid emoji/code-point limits. Fix snapshot `2733b9e0c82ad07557acedfb22013810e2ff480a41f9361348abef852081d849`: reviewer independently passed 11 backend context tests (1 PostgreSQL-only skip), 10 mobile requirements tests and whitespace check, and found no additional actionable issues. Reviewer did not independently rerun full suites, PostgreSQL migration/concurrency or Android export. Final documentation-only evidence updates receive a separate accuracy/diff review; staged runtime content is unchanged from the fix snapshot. Human inspection remains pending.
- **Errors/corrections:** Initial worktree creation lacked the approved Git object; fetched JJ and recreated at the exact revision. Sandbox blocked migration generation; reran with approved access to the isolated checkout. First PostgreSQL preservation-script invocation lacked the backend import path; corrected PYTHONPATH and verified successfully. New tests failed before feature implementation and passed afterward.
- **Human decisions:** Keep JJ's selected run, use 30-minute support in Phase 3, audience-aware feedback without rewriting, automatic generation without separate consent prompts in later phases, and hold new UI. User approved starting Docker Desktop and a disposable localhost-only PostgreSQL test container; no shared database/volume was used. No human code edits or final acceptance recorded.
- **Outstanding:** All Phases 2–7, new UI designs, allocation, long capture, correction synchronization, automatic provider scheduling, per-slide findings and Q&A durability. Helpers are API/module level only; no complete user-facing flow is claimed. Docker Desktop was started with user approval. Temporary test-container cleanup is recorded in the inspection evidence; shared project databases/volumes were not used.

#### Original feature request — verbatim wording (line-ending spaces omitted)

```text
Let's plan to implement the following features by making a branch from JJ's frontend code. A lot of the frontend code is there but they have deafult values. Name the branch it2/feature/ai_feedback

Features to implement
1) Slide/speech differences, especially graphs;
2) per-slide time allocation using the required presentation duration": Prompt the user to give requirements for the presentation: time limit(UI for it might be needed)
3)manual grammar checking: For words that do not exist or seem wrong highlight them so the user can select which word they would've want to say. For example, if it transcribed ChatGPTN but i wanted to say ChatGPT and it allows me to fix this .
4)audience transcript adaptation: Allow the user to add who their main audience is, and base feedback on this particular audience.
5) repeated terms and filler words analysis
6)cues: For each slide presentation have the AI give the top 4 things the user must talk about. It could be less than 4 if there anre not much such as title page or last page etc.
7)four-line problem summary: After each recording at a per slide basis give out at most the top 4 problems from the presentation things that the user should focus on. If there are none then it could be blank or say Looks good!
8) audience Q&A: Based on the inputted audience generate questions that the audience might have.

First name any issues that should be fixed ask me.
ALso if a feature is not clear enough ask me
Also I was thinking when we first scan the presentation for cues we could maintain more data about each slide which we could use later to implement saved slide feedback but if you have better ideas implement your way.
Do tell me if a new screen is needed to be implemented
```

#### Meaningful follow-ups — verbatim

```text
Also hold on implementations where new ui has to be made
```

```text
Treat the full Iteration 2 specification as the implementation contract, but do not implement all features in one pass.
First, inspect the existing front-end-design-JJ frontend, selected-run model, backend API, persistence layer, and worker infrastructure.
Prepare an implementation plan divided into independently verifiable phases. Identify:
- Existing components and endpoints to reuse.
- Required schema and API changes.
- Dependencies between features.
- Output invalidation and job deduplication rules.
- Features blocked by unapproved UI designs.
- Tests and acceptance criteria for each phase.
Prioritize compatibility with JJ's existing functionality.
Start implementation with Phase 1 only. After each phase:
1. Run the relevant checks and tests.
2. Document completed functionality and outstanding issues.
3. Review the diff for regressions and unintended changes.
4. Present the results for inspection before advancing.
Keep all work in the isolated it2/feature/ai_feedback checkout. Preserve unrelated local work.
Do not implement any held UI designs. Do not commit, push, or merge without explicit authorization.
Do not simplify or remove requirements from the original specification merely to make implementation easier.
```

```text
Approve this phased implementation plan.
Proceed with Phase 1 only, following the specified revision and isolated checkout requirements.
Before implementing, verify the baseline and inspect JJ's existing persistence, selected-run model, and backend contracts. Keep the Phase 1 data models and revisions as simple as possible while supporting all downstream requirements.
Explicitly distinguish missing presentation requirements from legacy defaults.
Complete the Phase 1 implementation, run the specified tests and migration verification, obtain independent review, and present the exact staged diff and verification evidence for my inspection.
Do not begin Phase 2, implement new UI, commit, push, or merge without my authorization.
```

```text
Proceed with Phase 1 of the approved plan in execution mode.
Create the isolated checkout from the verified JJ revision, implement Phase 1, run the required verification, and obtain independent review.
Stop after presenting the exact staged diff and verification evidence. Do not proceed to Phase 2, implement new UI, commit, push, or merge.
```

```text
Start Docker and run isolated verification
```

<a id="record-057"></a>

<a id="i2-phase-1-local-commit--october-15-2026"></a>

### Phase 1 local commit — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Request — verbatim:** `commit phase 1`
- **Tool:** Codex desktop, GPT-6 (exact model identifier not recorded).
- **Action and verification:** Verified the staged patch SHA256 still matched independently reviewed snapshot `b0310a45634be80b6f3b98cb1cf89351604774e95d969955a80dafe3e29ce46f`. Reused unchanged-content test/review evidence, checked the staged diff and committed exactly those 13 files as `2bd6cd2ad7128bb30d59da8dae818b5bdb01d66c` (`feat(ai-feedback): add phase 1 requirements`). The committed parent-to-commit binary patch has the same SHA256; the index is empty afterward. User authorization covers this local commit, not a push or merge.
- **Remaining:** Later UI-scope/phase-status documentation updates and this commit record remain unstaged. No Phase 2 code, new UI, push or merge. Git used its existing automatically inferred committer identity; configuration was not changed. No additional tests were run because reviewed/tested runtime content was unchanged.

<a id="record-058"></a>

<a id="i2-phase-2-cached-slide-profiles-and-cues--october-15-2026"></a>

### Phase 2 cached slide profiles and cues — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Context:** Codex desktop, GPT-6 (exact model identifier not recorded). Continuing the isolated `it2/feature/ai_feedback` checkout at Phase 1 commit `2bd6cd2`. The only pre-existing unstaged changes were the approved UI-scope/commit-status documentation; preserved and incorporated into this phase ledger. User authorized Phase 2 only, with inspection gates and no commit/push/merge.
- **Actual prompt:**

```text
start phase 2
```

- **Generated/retained work:** Independent immutable profile schemas reuse the existing image-aware description jobs, locks, quotas, receipts and recovery. Added profile API/automatic admission after PDF POST, strict zero-to-four grounded cues and profile cache/client/hook integration into JJ's existing Rehearse cue control. Historical description/coaching schemas and prompt digests remain unchanged. Added synthetic backend/API/receipt/concurrency and mobile validation/cache/order tests.
- **Rulings:** Graph structure is retained in existing uncertain visual facts (axes/units/values/trends), rather than introducing redundant graph tables. Profiles are stored in existing DescriptionSet JSON under separate versioned scope identities; no migration. Only PDF POST auto-admits; reopening/GET/polling/retakes never generate. Legacy/configuration-delayed imports can explicitly generate from the existing cue status. Initial generation has no consent dialog; uncertain charged retries reuse the existing Dialog and revision contract. No requirements sheet or other new screen is implemented.
- **Development verification:** New module tests first failed because the profile functionality did not exist. A reversed-response regression failed before cache request fencing and passed afterward. TypeScript and React hook lint errors were corrected before running the complete mobile gate. A receipt-recovery test was corrected to invoke the existing Beat recovery step before reclaiming its expired lease; direct duplicate task delivery does not release a live claim.
- **Automated verification:** `mobile/npm run check` passed TypeScript, lint and 185 tests; `npm run bundle:android` passed. Backend project Python: `manage.py check --settings=config.test_settings`, `makemigrations --check --dry-run --settings=config.test_settings`, and full `test --settings=config.test_settings --noinput` passed (306 tests, 21 skips). Disposable PostgreSQL 16 full suite passed (306 tests, one existing packaged-VAD dependency skip); PostgreSQL migration drift check reported no changes. All six historical description schema/prompt hash pairs matched the pre-change baseline. New tests cover unsupported/uncertain cue evidence, bounded/sparse output, immutability, API validation, import resilience, source invalidation, PostgreSQL admission race, receipt recovery and mobile cache/hook behavior.
- **Real worker verification:** Temporary PostgreSQL 16 and Redis 7, separate localhost API/Celery worker, synthetic three-page graph PDF and explicitly fake provider. The worker exited 75 after saving its receipt. After aging its claim and invoking the existing recovery mechanism, a restarted real worker with generation disabled and no provider key normalized that saved receipt to completed revision 1, cue counts `[0,3,0]`. Repeated PDF POST, reads, requirement contexts with different audience/duration, and duplicate Celery task delivery retained one profile set/job/request and exactly one synthetic provider call. No attempts/audio/Whisper records were created; PDF bytes were preserved. Temporary API/worker/Metro processes and containers/anonymous volumes were removed after verification. Original Metro/worktree and phone were not changed.
- **Android verification (agent-operated):** The emulator's previously installed client lacked JJ's existing ExpoSpeech native module. Generated an ignored native project and built with the documented provisioned JDK 17: `./gradlew :app:assembleDebug -PreactNativeDevServerPort=8082 -PreactNativeArchitectures=arm64-v8a` succeeded (537 tasks); `adb install -r` preserved existing app data. From isolated Metro/API, imported only the synthetic PDF via the real document picker; verified title zero-cue state, graph's three grounded cues, existing slide selector and cue toggle. Removed API forwarding, force-stopped/reopened the app and verified persisted graph cues with the explicit offline refresh error. No recording, private media upload, phone test, TalkBack or human cue-quality assessment. Synthetic PDF remains labeled in the emulator for inspection.
- **Independent AI review:** Separate fresh-context reviewer checked immutable staged snapshot `ef006cb09676ef8e40218dc4512855ca88be15c5cc85d5b883523c4b168e8f48` against contracts/source; no production defect found. Independently ran 9 backend profile tests (one PostgreSQL skip) and initial four mobile profile tests. Review of three added mobile tests found a test-isolation defect: the confirmation test depended on a previous test's deck mapping. Author reproduced its isolated failure, added a unique mapping inside that test, and reran the complete mobile gate. Reviewer independently verified the corrected name-filtered test (1/1) and complete profile test file (7/7), with no further actionable finding. The full PostgreSQL/worker/native results above are author-operated evidence, not independent or human testing.
- **Outstanding limits:** No live-provider call; graph interpretation/usefulness and mixed-language quality need later controlled/human evaluation. JJ's existing explicit coaching still uses a separate legacy description scope and may make its own image scan; the Phase 5 feedback pipeline will consume profiles. The one-call result above verifies this profile scope, not all existing provider features. Android checks used synthetic successful/empty/offline states; failed/uncertain retry, stale responses and confirmation generations have automated validation/hook tests, not full rendered Android acceptance. Existing selected-run regression suites pass; no new recorded retake/device microphone test was performed. Requirement-entry UI and all later phases remain held behind their existing approval gates. No commit/push/merge or Phase 3 advancement.

<a id="record-059"></a>

<a id="i2-phase-2-physical-phone-launch--october-15-2026"></a>

### Phase 2 physical-phone launch — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Context:** Codex desktop, GPT-6 (exact model identifier not recorded). User requested physical-phone launch and a testing checklist. No product-code changes, commit, push, merge or later-phase work. This new device-evidence entry is unstaged; the independently reviewed Phase 2 staged snapshot remains unchanged.
- **Actual prompt (trailing whitespace omitted):**

```text
What should i test for on physical phone and run the new changes in the physical phone
```

- **Environment/decision:** Connected Galaxy S23 Ultra (`SM_S918N`) was authorized for USB debugging. Existing backend feedback was disabled and lacked project/quota settings; checked credential presence only, without exposing values. Asked whether to use a synthetic demo, real configured AI, or disabled AI. No answer had arrived before launch; proceeded with the stated temporary synthetic assumption. Did not modify the existing `.env`, enable real-provider credentials, or fabricate real AI results. Temporary API and worker adapters accept only the SHA-matching labeled synthetic PDF and profile schema; other AI inputs are rejected. Transcription is not configured for this temporary demo.
- **Performed:** Reused the previously verified ARM64 development APK (`f8c2f0f479d483cecf78e07cfa899bd9daf67bd1c6bbb5df9c9e4878d7824ae5`), installed with `adb install -r`, preserving existing app data. Started separate Metro 8082, local API 58000, disposable PostgreSQL/Redis and worker; added USB forwards for the phone. Imported `phase2-synthetic.pdf` through the physical phone's real picker and opened slide 2's Cues panel. Observed all three graph cues and existing slide/record controls. API readiness reported reachable database/broker; completed job proves actual worker processing beyond readiness alone. One profile job/request/synthetic call, cue counts `[0,3,0]`, no existing recordings uploaded (`Attempt` count 0 at verification).
- **Handoff:** Phone left on the synthetic graph cue screen with services running for human tests. Checklist in `/private/tmp/phase2-phone-test-checklist.md`; screenshot `/private/tmp/phase2-phone-graph-cues.png`. Human cue toggle/navigation/readability/scrolling, cold reopening, controlled offline refresh and local recording/playback tests remain pending. This session does not establish real AI graph quality, physical-phone offline persistence, long-cue usability, TalkBack, retake/transcription integration or human acceptance.

<a id="record-060"></a>

<a id="i2-phase-2-real-provider-phone-switch--october-15-2026"></a>

### Phase 2 real-provider phone switch — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Actual user answers:** `Use real AI; I’ll provide project ID and RPM/TPM limits`; supplied project ID (redacted from this log); `5 rpm 20,000 tpm`.
- **Scope:** Runtime setup and bounded physical-phone verification only, using the verify-and-stop skill. No product implementation, quota increase, commit, push, merge or later-phase work. This new evidence is unstaged; the reviewed staged patch remains unchanged.
- **Configuration:** Replaced the temporary synthetic adapters with unmocked API/worker/Beat processes on the same isolated PostgreSQL/Redis services. Runtime reads the existing backend OpenAI key directly into process memory and uses the provided nonsecret project identity, 5 RPM, 20,000 TPM and configured/default `gpt-6-luna`. Did not change or copy the original `.env`, expose credentials, alter product code or increase limits. Services remain running for user testing.
- **Preflight limitation:** The existing quota policy reserves UTF-8 JSON/image bytes plus output allowance, not actual provider tokens. The three-slide synthetic deck requires 66,044 units; the six-slide deck present in this isolated phone database requires 3,513,825. Both exceed 20,000 and cannot pass the guard at the supplied setting. Did not submit them to OpenAI or silently retry uncertain prior synthetic outcomes.
- **Real verification:** Created a labeled small one-slide synthetic chart fitting the guard (14,259 reserved units). One unmocked OpenAI profile request returned HTTP 200 and completed revision 1 with one grounded cue comparing 2025:20 and 2026:40. Persisted usage: 828 input tokens, 458 output tokens, 1,286 total. Imported that PDF via the real physical-phone picker; existing scope/cache reused the same one paid request. The actual cue is visible on the Galaxy S23 Ultra. Screenshot `/private/tmp/phase2-real-phone-cue.png`, safe receipt metadata `/private/tmp/phase2-real-verification.json`; raw response/credentials are not recorded here.
- **Remaining limits:** This verifies real transport, durable normalization/cache and phone display for one bounded synthetic chart, not broad graph/mixed-language quality or human acceptance. Larger presentations remain blocked by the conservative quota estimator at 20,000; no product fix or larger application allowance has been authorized. Local API/worker/Beat/Metro and USB forwarding remain active for the phone session.

<a id="record-061"></a>

<a id="i2-phase-2-phone-runtime-recovery-and-full-deck-test--october-15-2026"></a>

### Phase 2 phone runtime recovery and full-deck test — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Actual prompts:**

```text
Transcript and Ai cues dont work and how do you replay your recroding
raise limits so that we can run afull tests
```

- **Actual approval reply:** `Approve full worker and recording retry`, to the question explicitly naming the full-dependency Docker worker, access to the stored backend key and isolated media/database, and retry of the saved 53-second recording through Whisper with possible charges.
- **Diagnosis:** Host worker was missing Torch and Silero VAD. Persisted `audio_check_failed` at `checking_audio`, with zero prior transcription provider submissions. Full-deck cues failed `request_exceeds_quota`. Existing slide-header playback is independent of a successful transcript; transcript-word sentence playback requires transcript text. Used investigate-first/systematic-debugging workflows and safe state/count queries rather than logging source audio/transcript.
- **Authorization boundary:** Automatic approval review initially rejected the worker replacement because credential/media mounts could submit existing recordings and incur charges. No workaround was used. Asked for the exact runtime/recording action and continued only after the explicit approval above.
- **Runtime repair:** Used the existing `onloud-whisper-deps:validation` image with current backend source read-only, credential file read-only, isolated recording/media read-only, and existing isolated PostgreSQL/Redis. Packaged ONNX gate loads offline; Torch 2.10.0, Silero 6.2.0, ONNX Runtime 1.23.2, Django 5.2.17, Celery 5.6.3, Pydantic 2.13.5 and OpenAI 2.54.0 match the current locked requirements. Did not install into/change the shared host Python environment or original `.env`.
- **Authorized limit change:** Raised only temporary application quota allowance to 4,000,000 byte-based reservation units/minute, keeping 5 RPM. OpenAI's project quota was not changed. Provider cooldown/error handling and durable receipts remain active; this is a runtime allowance change, not a product quota-estimator repair.
- **Verified recovery:** One authorized revision-fenced recording retry completed with 105 transcript words and one actual Whisper submission. The current six-slide profile completed with cue counts `[1,2,3,3,3,3]`; one actual OpenAI submission for that full-deck profile, prior local quota failures had none. Phone visibly showed the recovered slide transcript. Focused `rehearsals.test_speech_gate` in the repaired container passed all 3 tests including the packaged model test. Safe final receipt/count evidence: `/private/tmp/phase2-full-phone-recovery.json`.
- **Playback/handoff:** Explained Review swipe-down → slides → Cues off → triangle beside transcript heading, and transcript-word sentence playback. Phone navigation changed to Review during the attempted playback check, and Android package UID parsing failed; no successful native/audible playback is claimed. Left human navigation alone and playback listening confirmation pending. No product code/new UI/later phase changes, commits, pushes or merges. Runtime services remain active for the user's tests; this evidence is unstaged and the reviewed staged implementation remains unchanged.

#### Human phone confirmation — October 15, 2026

Actual prompt:

```text
Cues work, transcript works what other things to check to finish phase 2
```

The user confirms working cues and transcript on the physical phone. This establishes those flows only, not cue factual quality, audible playback, offline/cold-reopen persistence, long-text usability or accepted/rejected retake regressions. Remaining human checklist and final inspection are pending; no advancement or commit is authorized by this confirmation.

<a id="record-062"></a>

<a id="i2-phase-2-must-cover--go-deeper-revision--october-15-2026"></a>

### Phase 2 Must Cover / Go Deeper revision — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Context:** User explicitly requests implementation and permits an in-panel category selector. This authorization covers the bounded schema/UI choices below; no additional design gate, Phase 3, held requirements sheet, commit/push/merge or new screen. Existing staged Phase 2 and unstaged device evidence are preserved.
- **Actual pasted request (verbatim):**

```text
# OutLoud Iteration 2 — Improve AI Cues: Must Cover & Go Deeper

## Objective

Revise the existing Phase 2 AI cue system to provide two distinct categories of presentation guidance:

1. **Must Cover:** Essential explanations that the presenter should communicate for the audience to understand the current slide.
2. **Go Deeper:** Optional additional explanations that enrich the presentation beyond what is explicitly shown on the slide.

The current implementation often generates cues that merely restate slide content. The objective is to make AI cues genuinely useful for preparing what to say, not simply summarizing the presentation.

Implement this as a focused Phase 2 improvement. Do not advance to Phase 3.

## 1. Must Cover — Essential explanations

**Definition:** The minimum essential information that a presenter should verbally communicate for the audience to understand the slide's main message.

Requirements:

- Generate 0–3 Must Cover points per slide.
- Every point must be directly grounded in the current slide's text, charts, diagrams, or other visual evidence.
- Focus on understanding and interpretation, not simply repeating the visible content.
- Prioritize the main argument, essential comparisons, numerical interpretations, and conclusions.
- Do not generate a cue for every bullet point.
- Avoid generic instructions such as "Explain this slide."
- Do not invent missing facts or interpretations.
- A slide may have zero Must Cover points if no meaningful verbal explanation is necessary.

Example:

Slide: Accuracy increased from 80% to 92%.

Bad:
- "Accuracy increased from 80% to 92%."
- "The model has higher accuracy."

Good:
- "Clarify that the improvement is 12 percentage points, rather than a 12% relative improvement."
- "Explain what the comparison establishes about the proposed model."

Must Cover points should express essential speaking objectives rather than a script the presenter must repeat word for word.

## 2. Go Deeper — Additional enriching explanations

**Definition:** Optional explanations, insights, connections, or perspectives that could make the presentation more informative, convincing, or engaging.

Requirements:

- Generate 0–3 Go Deeper suggestions per slide.
- Use the full presentation as context, not only the current slide.
- Suggestions may go beyond information explicitly written on the slide.
- Identify opportunities to explain reasoning, implications, background, limitations, practical examples, or relationships between slides.
- Prioritize insights that add meaningful value beyond reading the slide.
- Make suggestions specific to the presentation's actual content.
- Avoid repeating Must Cover points.
- Avoid generic advice such as "Provide more details" or "Discuss implications."
- Do not fabricate external facts, causal explanations, experimental results, or research findings.
- If a useful explanation requires information that is unavailable, frame it as a question or suggestion for the presenter to investigate or clarify.
- Generate fewer suggestions when a slide does not offer meaningful opportunities for enrichment.

Example:

Slide: Accuracy increased from 80% to 92%.

Good:
- "Discuss which model changes contributed to the improvement, if supported by your experiments."
- "Explain whether this accuracy improvement has meaningful practical consequences."
- "Connect this improvement to the limitations of the baseline discussed earlier."

The additional points are optional and must not automatically be treated as missing explanations during post-rehearsal feedback.

## 3. Grounding and source references

Preserve the evidence-grounding guarantees from Phase 2, while supporting the different requirements of both categories.

**Must Cover:**
- Must reference supported facts from the current slide.
- Must not rely on uncertain visual evidence for factual claims.
- Must not introduce unsupported conclusions.

**Go Deeper:**
- May reference the current slide or other slides in the same deck.
- Should retain appropriate source references for factual premises.
- May suggest questions or explanatory opportunities whose answers aren't present in the slides.
- Must distinguish supported statements from questions requiring additional information.
- Must not present unsupported explanations as established facts.

Inspect the existing evidence-reference format and extend it as necessary for cross-slide grounding.

Do not weaken validation simply to accommodate more creative suggestions.

## 4. Backend and schema changes

Extend the existing immutable slide-profile system.

Requirements:

- Introduce separate structured collections for `must_cover` and `go_deeper`.
- Each collection supports 0–3 items.
- Preserve slide identity, source identity, extracted facts, uncertainty, and other existing profile fields.
- Use a new prompt version and schema version so historical cached outputs aren't silently treated as equivalent.
- Preserve existing historical profile/description schemas and their compatibility.
- Reuse existing `DescriptionSet` persistence, jobs, quotas, provider receipts, retry handling, and Celery recovery.
- Do not create another independent AI-job infrastructure.
- Do not rescan slides unnecessarily when the current profile scope is already valid.
- Ensure the full-deck context needed by Go Deeper is available to generation.
- Invalidate and regenerate profiles when relevant slide content, prompt, schema, or model identity changes.
- Prevent duplicate generation for the same scope.

Inspect the existing architecture before determining the exact schema changes.

Document any API changes in `docs/api-contract.md`.

## 5. Frontend UI changes

Reuse JJ's existing Rehearse screen and Cues control.

Within the existing cue area, distinguish the two categories:

**Must Cover**
- Clearly labeled as essential speaking points.
- Presented as concise, readable guidance.

**Go Deeper**
- Clearly labeled as optional suggestions.
- Visually distinguishable from Must Cover.
- Focused on enriching the presentation rather than repeating its main content.

Choose a compact interaction that fits JJ's existing design language. A two-category toggle or segmented control within the existing cue area is acceptable.

Do not add a standalone screen or unrelated UI redesign.

Retain:
- Scrolling for longer content.
- Offline caching.
- Explicit pending, failed, uncertain, stale, and unavailable states.
- Existing retry behavior.
- Slide navigation.
- Selected-run and recording behavior.

Ensure empty categories are handled naturally without placeholder or fabricated cues.

## 6. Future feedback compatibility

Design the categories so Phase 5 can eventually evaluate them differently.

**Must Cover:**
May inform future content-coverage analysis, but missing a cue must not automatically count as a presentation problem.

Future analysis should consider paraphrasing, audience context, adjacent-slide explanations, and whether the essential meaning was actually communicated.

**Go Deeper:**
Should inform optional improvement suggestions rather than mandatory coverage requirements.

Do not implement Phase 5 feedback behavior now. Only preserve the information needed for it.

## 7. Evaluation and testing

Add automated tests for:

- Slides with many bullet points.
- Image-only graphs.
- Numerical comparisons.
- Sparse title and closing slides.
- Ambiguous or unreadable graphs.
- Slides with no worthwhile additional suggestions.
- Connections between multiple slides.
- Unsupported causal explanations.
- Duplicate or redundant cues.
- Category boundaries of 0–3 items.
- Unsupported source references.
- Cache invalidation following schema/prompt changes.
- Historical profile compatibility.
- Duplicate job admission and stale responses.
- Offline caching and reopening.
- Correct category display and navigation.

Also evaluate cue quality using representative presentation slides.

Compare the original Phase 2 cue behavior against the revised categories using the same input slides.

Evaluate:
1. **Specificity:** Is the suggestion relevant to this particular slide?
2. **Non-redundancy:** Does it provide more than a paraphrase of visible text?
3. **Usefulness:** Would this help someone prepare what to say?
4. **Grounding:** Are factual premises supported?
5. **Category correctness:** Is it appropriately classified as Must Cover or Go Deeper?

Do not claim real-model quality is verified based only on mocked provider outputs. If live-provider testing is unavailable, report that limitation explicitly.

## 8. Verification and handoff

- Run `mobile/npm run check`.
- Run `mobile/npm run bundle:android`.
- Run backend checks and tests with `config.test_settings`.
- Check migrations and ensure historical data remains compatible.
- Verify new worker behavior with PostgreSQL/Redis where appropriate.
- Test the updated cue interface on Android.
- Obtain an independent review of the staged implementation.
- Fix confirmed issues and rerun affected tests.
- Record AI-use and actual verification evidence.

Preserve unrelated changes.

Stage only the intended modifications and present the exact staged diff, verification results, quality-evaluation evidence, and unresolved limitations for inspection.

**Do not commit, push, merge, implement Phase 3, or modify the held presentation requirements sheet without explicit authorization.**

## Success criterion

After this change, OutLoud should no longer behave like an AI slide summarizer.

The Must Cover category should help presenters identify **what they need to communicate for the slide to be understood**.

The Go Deeper category should help presenters discover **what additional explanations could make the presentation stronger**.

Both categories must be specific, useful, non-redundant, and appropriately grounded in the presentation.
```

- **Design:** New immutable v2 profile scope retains all existing grounded facts and identities. Must Cover: 0–3 local certain-fact objectives. Go Deeper: 0–3 optional deck-grounded suggestions, exact quoted factual premises, explicit connection/question distinction and information still needed. Strong local/cross-slide reference validation; duplicate and verbatim-fact repetition checks. Preserve v1 schemas/prompts/receipts/retries exactly, rather than reinterpreting historical cues. Existing in-panel compact selector and scrolling; no analysis/recording/requirements changes.
- **Execution plan:** (1) Red/green schema/prompt/reference/history tests; (2) version-aware mobile validation/cache/status and category selector with renderer interactions; (3) full mobile/backend/PostgreSQL checks and real receipt/job recovery; (4) same-slide live v1/v2 evaluation and Android checks; (5) stage only intended changes, independent review, repairs/retests, exact diff/evidence handoff.
- **Limits:** Source references prove supported premises, not arbitrary natural-language semantic truth. Real-model evaluation assesses specificity, redundancy, usefulness, grounding and category correctness; mocks alone do not prove quality.

#### Implementation and verification of the category revision

- **Generated material incorporated:** version-aware immutable category schemas and prompts, strict local/deck fact validation, cross-slide source IDs and exact premise quotes, connection/question distinction and missing-information field; mobile parser/cache/version handling and compact essential/optional selector in existing Rehearse; synthetic schema/job/cache/renderer regression tests; API contract, phase ledger and quality evidence. No new database models, migrations, dependencies, screens, Phase 3/5 behavior or held requirements UI.
- **Live-driven refinement:** v2's first real-model results still included descriptive restatements. Tightened speaking-objective and investigation instructions in a separate immutable v3 prompt/schema scope. Preserved v1 and v2 schemas/prompt rules for saved receipt normalization and historical compatibility. The full-deck request, quotas, leases, receipts, deduplication and explicit retry infrastructure are reused. Current scope is v3; each category is 0–3.
- **Independent AI review:** separate fresh-context reviewer `/root/cue_categories_review` reviewed staged patch `cdf0fba4892b7fa7f48ff382c124993c0e6493f31a8a607fc373720fbc8b5ff7` and found unavailable reads could erase offline payloads and historical v2 caches could appear current. Fixed both; its follow-up on `f29f6a1220e86d8d6776b045f7305932bccfc5c1444f1dbb7972efac79fc8f2b` found a retained payload also needed a persisted stale marker after known source/selection invalidation. Fixed that with regression tests. Final code/test patch `fa54fc4dd0cdddf876cd0460680cf900b89b0e7ef50dd28723dbb5617e4d4fa4`: reviewer confirmed all three defects closed and no remaining concrete defect in changed cache/version paths. Independently ran 17 focused backend tests (one PG-only skip) and final 14 mobile profile/panel tests. This is AI review; human inspection remains pending. Reviewer did not independently operate Android or run full suites/providers/PG.
- **Automated checks on final runtime code:** `npm run check` passed TypeScript/lint and 192 mobile tests; `npm run bundle:android` exported Android successfully. Backend `python manage.py check --settings=config.test_settings` passed; `python manage.py test --settings=config.test_settings --noinput` ran 314 tests, passed with 21 environment/PG skips; `python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Full suite using isolated `phase2_runtime_settings` ran 314 PostgreSQL tests, passed with one host-VAD dependency skip, using Django's separate disposable test database. `python manage.py migrate --plan --settings=phase2_runtime_settings` reported no planned operations; no live-data migration required. Full worker image `python manage.py test rehearsals.test_cue_guidance rehearsals.test_speech_gate --settings=config.test_settings --noinput` ran 11 tests, all passed, including actual installed VAD dependencies and mocked-provider category receipt recovery. Initial exploratory command mistakenly named nonexistent `rehearsals.test_vad`; corrected to existing `test_speech_gate` before reporting the successful run.
- **Worker and historical verification:** actual PostgreSQL/Redis/Celery v2/v3 provider jobs completed on both evaluation PDFs. Saved v1/v2/v3 prompt digests still validate; original profile JSON hashes remain unchanged. Repeated final-scope POSTs and Android reimport of exact evaluated sources retained the same v3 set IDs, processing revision 1, one job and one received receipt each. Receipt-normalization crash recovery is also tested with mocked providers under SQLite/PostgreSQL/full worker dependencies. No private recording was reprocessed for this cue task.
- **Real-model quality:** [same-input comparison](../../../testing/evidence/cue-quality-evaluation-2026-10-15.md) records actual v1/v2/v3 outputs and five quality dimensions on two presentations/seven slides. Final real `gpt-6-luna` receipts: HTTP 200; small chart usage 1432 input/763 output/2195 total tokens, six-slide deck 10631/3589/14220. Same source fingerprints/snapshots as historical v1. Actual numerical comparisons and optional research questions improve on v1's visible-fact lists. Final full deck is conservative: only one essential and one optional point; useful cross-slide opportunities may be omitted. Human usefulness/semantic accuracy acceptance remains pending; structural references do not prove all wording true.
- **Local verification artifacts:** `/private/tmp/phase2-guidance-mobile-check.log`, `phase2-guidance-android-bundle.log`, `phase2-guidance-backend-check.log`, `phase2-guidance-postgres-tests.log`, `phase2-guidance-pg-migrations.log`, `phase2-guidance-full-worker-tests.log`, `phase2-guidance-review-fix-tests.log`, `phase2-guidance-history-dedup.json`, `phase2-guidance-v3-comparison.json`. These are local scratch evidence, may expire, and are not committed. Credentials, original .env, installed dependencies and private recordings remain outside the staged patch.
- **Scope and approval:** all implementation remains isolated on `it2/feature/ai_feedback`, HEAD `2bd6cd2ad7128bb30d59da8dae818b5bdb01d66c`; original checkout's unrelated local changes preserved. Review and verification do not authorize commit, push, merge or advancing phases.
- **Android verification:** agent-operated existing development build on emulator `emulator-5554`, task Metro 8082 and isolated API 58000. Imported the labeled small chart and exact previously evaluated six-slide PDF through JJ's existing picker; confirmed the expected completed backend scope was reused. Tested Essential/Optional selection, explicit missing-information wording, empty title category, slide-strip navigation from title to chart to food, no previous-slide guidance leaking, and layout clear of the clock/record control. Force-stopped and freshly reopened with emulator API reverse removed (physical phone unaffected); cached chart guidance remained readable with explicit “Could not refresh AI cues. Saved cues are retained.” No recording, transcript, selected-run or audio data was modified. Screenshots are local `/private/tmp/phase2-guidance-{must-cover,go-deeper,empty-title,chart-navigation,food-optional,offline-chart}.png`. Physical-phone and human usefulness acceptance of the new category selector remain pending; earlier human confirmations of v1 cues/transcripts do not prove acceptance of this update.
- **Observed runtime limit:** another existing Downloads `Guatemala.pdf` is a different source from the evaluated six-slide PDF. Its successful import admitted a new profile scope but generation failed locally with `request_exceeds_quota`; no provider submission occurred. Its failed status remains visible and its data was not replaced. The exact already-evaluated PDF was then imported as a separate labeled test, reusing its successful v3 scope. The application admission quota still bounds serialized image requests; large-input quota calibration/provider-limit estimation is an existing limitation, not established as solved by these category changes. Configuration was not raised again to conceal this failure.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- **Generated material incorporated:** version-aware immutable category schemas and prompts, strict local/deck fact validation, cross-slide source IDs and exact premise quotes, connection/question distinction and missing-information field; mobile parser/cache/version handling and compact essential/optional selector in existing Rehearse; synthetic schema/job/cache/renderer regression tests; API contract, phase ledger and quality evidence. No new database models, migrations, dependencies, screens, Phase 3/5 behavior or held requirements UI.
- **Live-driven refinement:** v2's first real-model results still included descriptive restatements. Tightened speaking-objective and investigation instructions in a separate immutable v3 prompt/schema scope. Preserved v1 and v2 schemas/prompt rules for saved receipt normalization and historical compatibility. The full-deck request, quotas, leases, receipts, deduplication and explicit retry infrastructure are reused. Current scope is v3; each category is 0–3.
- **Independent AI review:** separate fresh-context reviewer `/root/cue_categories_review` reviewed staged patch `cdf0fba4892b7fa7f48ff382c124993c0e6493f31a8a607fc373720fbc8b5ff7` and found unavailable reads could erase offline payloads and historical v2 caches could appear current. Fixed both; its follow-up on `f29f6a1220e86d8d6776b045f7305932bccfc5c1444f1dbb7972efac79fc8f2b` found a retained payload also needed a persisted stale marker after known source/selection invalidation. Fixed that with regression tests. Final code/test patch `fa54fc4dd0cdddf876cd0460680cf900b89b0e7ef50dd28723dbb5617e4d4fa4`: reviewer confirmed all three defects closed and no remaining concrete defect in changed cache/version paths. Independently ran 17 focused backend tests (one PG-only skip) and final 14 mobile profile/panel tests. This is AI review; human inspection remains pending. Reviewer did not independently operate Android or run full suites/providers/PG.
- **Automated checks on final runtime code:** `npm run check` passed TypeScript/lint and 192 mobile tests; `npm run bundle:android` exported Android successfully. Backend `python manage.py check --settings=config.test_settings` passed; `python manage.py test --settings=config.test_settings --noinput` ran 314 tests, passed with 21 environment/PG skips; `python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Full suite using isolated `phase2_runtime_settings` ran 314 PostgreSQL tests, passed with one host-VAD dependency skip, using Django's separate disposable test database. `python manage.py migrate --plan --settings=phase2_runtime_settings` reported no planned operations; no live-data migration required. Full worker image `python manage.py test rehearsals.test_cue_guidance rehearsals.test_speech_gate --settings=config.test_settings --noinput` ran 11 tests, all passed, including actual installed VAD dependencies and mocked-provider category receipt recovery. Initial exploratory command mistakenly named nonexistent `rehearsals.test_vad`; corrected to existing `test_speech_gate` before reporting the successful run.
- **Worker and historical verification:** actual PostgreSQL/Redis/Celery v2/v3 provider jobs completed on both evaluation PDFs. Saved v1/v2/v3 prompt digests still validate; original profile JSON hashes remain unchanged. Repeated final-scope POSTs and Android reimport of exact evaluated sources retained the same v3 set IDs, processing revision 1, one job and one received receipt each. Receipt-normalization crash recovery is also tested with mocked providers under SQLite/PostgreSQL/full worker dependencies. No private recording was reprocessed for this cue task.
- **Real-model quality:** [same-input comparison](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-2-cue-quality.md) records actual v1/v2/v3 outputs and five quality dimensions on two presentations/seven slides. Final real `gpt-6-luna` receipts: HTTP 200; small chart usage 1432 input/763 output/2195 total tokens, six-slide deck 10631/3589/14220. Same source fingerprints/snapshots as historical v1. Actual numerical comparisons and optional research questions improve on v1's visible-fact lists. Final full deck is conservative: only one essential and one optional point; useful cross-slide opportunities may be omitted. Human usefulness/semantic accuracy acceptance remains pending; structural references do not prove all wording true.
- **Local verification artifacts:** `/private/tmp/phase2-guidance-mobile-check.log`, `phase2-guidance-android-bundle.log`, `phase2-guidance-backend-check.log`, `phase2-guidance-postgres-tests.log`, `phase2-guidance-pg-migrations.log`, `phase2-guidance-full-worker-tests.log`, `phase2-guidance-review-fix-tests.log`, `phase2-guidance-history-dedup.json`, `phase2-guidance-v3-comparison.json`. These are local scratch evidence, may expire, and are not committed. Credentials, original .env, installed dependencies and private recordings remain outside the staged patch.
- **Scope and approval:** all implementation remains isolated on `it2/feature/ai_feedback`, HEAD `2bd6cd2ad7128bb30d59da8dae818b5bdb01d66c`; original checkout's unrelated local changes preserved. Review and verification do not authorize commit, push, merge or advancing phases.
- **Android verification:** agent-operated existing development build on emulator `emulator-5554`, task Metro 8082 and isolated API 58000. Imported the labeled small chart and exact previously evaluated six-slide PDF through JJ's existing picker; confirmed the expected completed backend scope was reused. Tested Essential/Optional selection, explicit missing-information wording, empty title category, slide-strip navigation from title to chart to food, no previous-slide guidance leaking, and layout clear of the clock/record control. Force-stopped and freshly reopened with emulator API reverse removed (physical phone unaffected); cached chart guidance remained readable with explicit “Could not refresh AI cues. Saved cues are retained.” No recording, transcript, selected-run or audio data was modified. Screenshots are local `/private/tmp/phase2-guidance-{must-cover,go-deeper,empty-title,chart-navigation,food-optional,offline-chart}.png`. Physical-phone and human usefulness acceptance of the new category selector remain pending; earlier human confirmations of v1 cues/transcripts do not prove acceptance of this update.
- **Observed runtime limit:** another existing Downloads `Guatemala.pdf` is a different source from the evaluated six-slide PDF. Its successful import admitted a new profile scope but generation failed locally with `request_exceeds_quota`; no provider submission occurred. Its failed status remains visible and its data was not replaced. The exact already-evaluated PDF was then imported as a separate labeled test, reusing its successful v3 scope. The application admission quota still bounds serialized image requests; large-input quota calibration/provider-limit estimation is an existing limitation, not established as solved by these category changes. Configuration was not raised again to conceal this failure.

<a id="record-063"></a>

<a id="i2-phase-2-short-cues-and-expandable-details--october-15-2026"></a>

### Phase 2 short cues and expandable details — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

**User request:**

```text
Make the overall cues shorter

example

CURRENT

Distinguish the two sites’ descriptions—Maya city and temples at Tikal, former capital and Spanish colonial architecture at Antigua—while noting that both are identified as UNESCO World Heritage Sites.

BETTER

Contrast Tikal’s Maya heritage with Antigua’s colonial history. Both are UNESCO sites.

Also dont add why linking is needed

## Rules I'd enforce in AI generation

1. Maximum 15 words per cue, preferably fewer.
2. One speaking objective per cue. Split unrelated ideas.
3. Remove unnecessary instructions like "Explain the relationship between" or "Make sure to mention."
4. Use keywords and contrasts rather than complete explanatory paragraphs.
5. Don't simply paraphrase the slide. State what the presenter needs to communicate.
6. Keep detailed reasoning expandable, rather than displaying it during recording.

Aslo now some slides have no cues at all
```

- **Implemented:** Current immutable v4 prompt/schema scopes supersede v3. Both backend and mobile reject cue text exceeding 15 words, with identical explicit Unicode whitespace separators. Prior v1–v3 limits and exact schemas/prompt rules remain readable/recoverable and are not truncated. v4 removes the blanket discouragement of descriptive slides and seeks supported central messages/contrasts before returning an empty content category; sparse/unreadable exceptions remain valid. Prompt requests one objective, shorter keywords/contrasts, no instruction padding or linking rationale. Existing cue cards show short text and a Details control, collapsed by default; explicit expansion reveals stored premises and missing-information details. Keys reset expansion on slide/category/profile changes. No new screen, held requirements UI or later-phase behavior was added.
- **Independent AI review:** `/root/cue_categories_review` reviewed staged `0c2100a13f4047df984ec434f1f8b65adb17d75b5dbd513c2ffd232713f9aa64` and reproduced a word-count discrepancy between Python and ECMAScript for U+FEFF. Fixed it using a shared explicit separator policy, also covering NEL, U+001C, em space and NBSP in regression tests. Reviewer closed the defect on snapshot `ea443f9724f2cc09cf6fb40cefcfb940c7f72cdc7c5c56b701de350282ac75f6`, independently passing 10 backend guidance tests and 16 mobile profile/panel tests. No remaining concrete defect found in the reviewed delta. This is AI review, not human acceptance.
- **Final checks:** `npm run check` passed TypeScript/lint and 194 tests; `npm run bundle:android` exported successfully. Backend full SQLite suite: 316 tests, passed with 21 environment/PG skips. Isolated PostgreSQL full suite: 316 tests, passed with one host VAD dependency skip. Django check passed and migration dry-run reported no changes; no model migration was added. Full-dependency worker guidance tests also passed before the separator-only repair; final PostgreSQL/SQLite tests exercise that repair. Logs: `/private/tmp/phase2-concise-{mobile-check,android-bundle,backend-tests,pg-tests,full-worker-tests}.log`.
- **Real-provider evidence:** same two saved source inputs evaluated under v4. Small chart completed with an eight-word numerical objective. First six-slide response had one 16-word food cue and was rejected rather than silently truncated; one explicit revisioned retry completed. All five readable content slides now have one or two Must Cover points (8–15 words across the two sources), with a 12-word optional cross-slide connection and no linking rationale. Title remains empty. Details/evidence remain separate from the short text. [Quality evaluation](../../../testing/evidence/cue-quality-evaluation-2026-10-15.md) records outputs, counts, paid retry and limits. Several descriptive cues still summarize visible content; semantic non-redundancy and usefulness remain for human assessment.
- **Android evidence:** existing emulator build read the successful v4 scope. Verified short heritage cue, collapsed Details by default, explicit expansion into grounded evidence and scroll containment within the cue area; recording controls remained visible. Renderer tests verify expansion and reset on navigation. Local screenshots: `/private/tmp/phase2-concise-current.png` (collapsed) and `phase2-concise-details-expanded.png`. No recording or transcript was modified. Physical-phone/human acceptance remains pending; existing Metro/API remain available for testing.
- **Boundary:** staged only on the isolated `it2/feature/ai_feedback` checkout. No commit, push, merge, Phase 3 work or held UI design. Prior Phase 2 observations and receipts are retained as historical evidence; v4 is the current implementation.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- **Implemented:** Current immutable v4 prompt/schema scopes supersede v3. Both backend and mobile reject cue text exceeding 15 words, with identical explicit Unicode whitespace separators. Prior v1–v3 limits and exact schemas/prompt rules remain readable/recoverable and are not truncated. v4 removes the blanket discouragement of descriptive slides and seeks supported central messages/contrasts before returning an empty content category; sparse/unreadable exceptions remain valid. Prompt requests one objective, shorter keywords/contrasts, no instruction padding or linking rationale. Existing cue cards show short text and a Details control, collapsed by default; explicit expansion reveals stored premises and missing-information details. Keys reset expansion on slide/category/profile changes. No new screen, held requirements UI or later-phase behavior was added.
- **Independent AI review:** `/root/cue_categories_review` reviewed staged `0c2100a13f4047df984ec434f1f8b65adb17d75b5dbd513c2ffd232713f9aa64` and reproduced a word-count discrepancy between Python and ECMAScript for U+FEFF. Fixed it using a shared explicit separator policy, also covering NEL, U+001C, em space and NBSP in regression tests. Reviewer closed the defect on snapshot `ea443f9724f2cc09cf6fb40cefcfb940c7f72cdc7c5c56b701de350282ac75f6`, independently passing 10 backend guidance tests and 16 mobile profile/panel tests. No remaining concrete defect found in the reviewed delta. This is AI review, not human acceptance.
- **Final checks:** `npm run check` passed TypeScript/lint and 194 tests; `npm run bundle:android` exported successfully. Backend full SQLite suite: 316 tests, passed with 21 environment/PG skips. Isolated PostgreSQL full suite: 316 tests, passed with one host VAD dependency skip. Django check passed and migration dry-run reported no changes; no model migration was added. Full-dependency worker guidance tests also passed before the separator-only repair; final PostgreSQL/SQLite tests exercise that repair. Logs: `/private/tmp/phase2-concise-{mobile-check,android-bundle,backend-tests,pg-tests,full-worker-tests}.log`.
- **Real-provider evidence:** same two saved source inputs evaluated under v4. Small chart completed with an eight-word numerical objective. First six-slide response had one 16-word food cue and was rejected rather than silently truncated; one explicit revisioned retry completed. All five readable content slides now have one or two Must Cover points (8–15 words across the two sources), with a 12-word optional cross-slide connection and no linking rationale. Title remains empty. Details/evidence remain separate from the short text. [Quality evaluation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-2-cue-quality.md) records outputs, counts, paid retry and limits. Several descriptive cues still summarize visible content; semantic non-redundancy and usefulness remain for human assessment.
- **Android evidence:** existing emulator build read the successful v4 scope. Verified short heritage cue, collapsed Details by default, explicit expansion into grounded evidence and scroll containment within the cue area; recording controls remained visible. Renderer tests verify expansion and reset on navigation. Local screenshots: `/private/tmp/phase2-concise-current.png` (collapsed) and `phase2-concise-details-expanded.png`. No recording or transcript was modified. Physical-phone/human acceptance remains pending; existing Metro/API remain available for testing.
- **Boundary:** staged only on the isolated `it2/feature/ai_feedback` checkout. No commit, push, merge, Phase 3 work or held UI design. Prior Phase 2 observations and receipts are retained as historical evidence; v4 is the current implementation.

<a id="record-064"></a>

<a id="i2-phase-2-local-commit-and-contributor-correction--october-15-2026"></a>

### Phase 2 local commit and contributor correction — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

- **Output and use:** On the user's `commit` instruction, committed the exact reviewed Phase 2 patch as `67a240a1c74ff8dbeb793394f21aa320c46e522d` (`feat(it2): add grounded presentation cue categories`). Added Seoyeon's confirmed attribution to this task's eight Phase 1/2 entries and the AI-use index. Following the subsequent name-format correction, contributor fields use exactly `Seoyeon`; twelve contributor fields between Injoon's README task and Seoyeon's Phase 1 task use the user-confirmed `Jaewon`. Saved the future-iteration naming rule in `AGENTS.md` and the reporting guide. Existing prompts and task evidence remain unchanged.
- **Verification:** Before and after commit, the binary diff matched reviewed SHA-256 `fd02729365f6a19e9c3fba899b26d812f72afff74908b7066f080b55b18826e4`; the isolated checkout was clean afterward. Contributor/status corrections are documentation-only local edits, not part of that commit. Prior task prompts and earlier contributor records were checked for preservation; no application tests were needed for these attribution edits.
- **Errors and revisions:** Codex omitted the requester attribution when the person's name was unconfirmed. Seoyeon explicitly supplied the name, so only the name was previously unknown; the human contribution was not unconfirmed. The AI-use index's stale “staged” status was also corrected without rewriting historical verification records.
- **Human decisions:** Seoyeon requested the feature scope, revisions, tests and commit, supplied the contributor name, and specified the exact future naming rule and Jaewon's intervening entries. This attribution identifies the human contributor and decisions; it does not invent human code edits, teammate review or acceptance of untested flows. The subsequent `commit phase 2` instruction authorizes committing these remaining documentation corrections separately from the existing Phase 2 implementation commit; no push, merge or next-phase work is authorized.

#### Prompts and contributor confirmation — verbatim, in order

```text
commit
```

```text
is ai use being updated constantly?
```

```text
why are formats different between recrodings
```

```text
like our format is different from past ones
```

```text
on ai collabroation prompts
```

```text
Why arent u recording me as contributor?
```

Answer to “What name should I use for you in the contributor field of the Iteration 2 AI-feedback entries?”:

```text
Seoyeon
```

Additional attribution instruction — verbatim:

```text
make sure from now on on any iteration when u update ai use document u put as contributor my name for my prompts and just pu t Seoyeon not Seoyeon (requestor) also update the ones between Injoon and Seoyeon as Jaewon for contributor
```

```text
commit phase 2
```

<a id="record-065"></a>

<a id="i2-phase-3-required-timing-and-longer-recordings--october-15-2026"></a>

### Phase 3 required timing and longer recordings — October 15, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact identifier not recorded)

**Prompt:**

```text
implement phase 3
```

Follow-up:

```text
phone is connected
```

**Output and use:** Reused the explicit requirements context, JJ timing/selected-run
architecture and existing recording/Whisper pipeline. Added exact-sum allocation,
required/suggested labeling, thirty-minute validation/recovery and mono 64 kbps AAC.
No held requirements UI, new screen, new migration or later phase was implemented.

**Verification:** [Phase 3 evidence](../../../testing/evidence/recording-timing-verification-2026-10-15.md) records baseline,
regression checks and separate generated-speech real-Whisper results. Mobile
checks passed (202 tests), SQLite/PostgreSQL suites passed (321 tests), full worker
checks passed (seven tests), and independent review plus repair review passed.
Actual native capture auto-stopped at 29:59.061, uploaded and completed no-speech
processing; cold reopen/playback state, explicit timing, Keep current and clearing
were verified on the emulator. Seoyeon confirmed short phone playback/transcription;
visit identification and long physical-phone capture acceptance remain unverified.

**Errors and revisions:** Initial tests exposed the ten-minute limits; the new
upload test's response assertion was corrected to the existing `attempt_id` contract.
Current required totals replace stale display totals without rewriting saved runs.
Independent review found that clearing duration could retain the old required
Review total; full/partial regressions reproduced it and passed after the repair. The emulator dev launcher needed a fresh process after a stale React
context crash; no app data was cleared. A truncated emulator-only timing fixture
transfer was repaired from its complete backup and verified byte-for-byte before
reopening; all audio and unrelated database rows were preserved.

**Human decisions:** Seoyeon authorized Phase 3, confirmed the phone connection and
approved resuming the existing isolated Docker services. The real-AI test setup was
already authorized. Requirements-entry UI remains held. Human final inspection,
commit, push, merge and Phase 4 are not authorized by this implementation request.

Runtime clarification answers (verbatim):

```text
Unpause and use isolated services
```

```text
resumef
```

Physical-phone test feedback — verbatim:

```text
back and transcription both work but I can't diffeerentiate them whether they came from back and forth swaps or not
```

This confirms short phone playback/transcription only. JJ groups speech by slide
without labeling first/return visits in that view. The underlying timeline keeps
separate visits; their visual identification is an outstanding UI issue, not a
Phase 3 implementation or a passed human alignment test.

**Subsequent handoff:** Phase 3 was subsequently approved and committed as
`ee6233be2875739c6c9f8d2c62e9878e4ab759b7`. This supersedes the implementation
snapshot's pending-commit state; no additional approval prompt is recorded here.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification:** [Phase 3 evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-3-verification.md) records baseline,
regression checks and separate generated-speech real-Whisper results. Mobile
checks passed (202 tests), SQLite/PostgreSQL suites passed (321 tests), full worker
checks passed (seven tests), and independent review plus repair review passed.
Actual native capture auto-stopped at 29:59.061, uploaded and completed no-speech
processing; cold reopen/playback state, explicit timing, Keep current and clearing
were verified on the emulator. Seoyeon confirmed short phone playback/transcription;
visit identification and long physical-phone capture acceptance remain unverified.

<a id="record-066"></a>

<a id="i2-transcript-visit-labels--october-15-2026"></a>

### Transcript visit labels — October 15, 2026

**Contributor:** Seoyeon

**Tool:** OpenAI Codex desktop; separate independent AI reviewer.

**Model:** not recorded

**Requests (verbatim):**

```text
I think it would be nice if it shows if the recording came from one take or was it coming back from a previous slide.
```

```text
Can we implement it so it shows return visit first visit in transcript section
```

**Incorporated material:** Transient original-visit metadata in `domain/lines.ts`,
first/return visit dividers with source audio times in the existing Rehearse
transcript panel, three regression tests, and user-facing/evidence documentation.
No new screen, provider work, persistence revision or Phase 4 implementation.

**Verification:** Test-first failures reproduced missing visit metadata. Final
mobile check passed TypeScript/lint and 205 tests; Android export passed. Separate
AI reviewer found no concrete issues and independently ran 44 focused tests.
Connected-phone UI displayed the first-visit divider and header playback entered
playing state, then was paused. Native return-divider and edit-gesture acceptance
remain pending; automated tests cover return visits, silent visits, source
boundaries, moved/corrected lines and selected retakes. Automatic approval review
rejected a proposed phone database export due to private-content exposure; no
export ran, and UI verification continued without it. See
[verification details](../../../testing/evidence/transcript-visits-verification-2026-10-15.md).

**Human decisions/corrections:** Seoyeon authorized this narrow additional UI
scope after requesting visit identification. Existing phase gates and held
requirements-entry UI remain in force. Human inspection and commit/push/merge
are pending; independent AI review is not human teammate approval.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification:** Test-first failures reproduced missing visit metadata. Final
mobile check passed TypeScript/lint and 205 tests; Android export passed. Separate
AI reviewer found no concrete issues and independently ran 44 focused tests.
Connected-phone UI displayed the first-visit divider and header playback entered
playing state, then was paused. Native return-divider and edit-gesture acceptance
remain pending; automated tests cover return visits, silent visits, source
boundaries, moved/corrected lines and selected retakes. Automatic approval review
rejected a proposed phone database export due to private-content exposure; no
export ran, and UI verification continued without it. See
[verification details](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/transcript-visits-verification.md).

<a id="record-067"></a>

<a id="i2-transcript-playback-and-word-highlighting--october-15-2026"></a>

### Transcript playback and word highlighting — October 15, 2026

**Contributor:** Seoyeon

**Tool:** OpenAI Codex desktop; separate independent AI reviewer.

**Model:** not recorded

**Requests (verbatim):**

```text
When I press on the slide transcript it doesnt play recording
```

```text
1 and 2 and 3 is inconsistent. I would also want to know which word the audio is repeating so i know where to look at in the transcript.
```

The second answer referred to heading, sentence/words and triangle respectively.

**Incorporated material:** Serial native playback source/seek handling, cancellation
and end-check guards, retry feedback, tappable existing heading/timestamps, native
audio-position word highlighting and synthetic regression tests. Source transcript,
run selection and recording files remain unchanged. Flag correction controls remain;
rewritten text without reliable word mapping retains sentence-level feedback.

**Verification/corrections:** Test-first regressions reproduced stale-position,
stale-source and overlapping-seek failures. TypeScript/lint, 215 tests and Android
bundle passed. Independent review found a clipped-sentence capitalization mismatch
that disabled highlighting with an ignored older edit; reproduced with a failing
test and fixed. Reviewer confirmed the repair with 13 tests and no new findings.
Phone heading playback and native-position word highlighting were observed;
return/earlier sentence selection and heading pause were exercised. Human audible
sync/gesture stress remains pending. No provider calls or private recording export.
See [verification evidence](../../../testing/evidence/transcript-playback-verification-2026-10-15.md).

**Human decisions:** Seoyeon clarified all three playback entry points and requested
word highlighting. This authorizes the focused fix and inline feedback, not held
requirements-entry UI, Phase 4, commit, push or merge. Final inspection is pending.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification/corrections:** Test-first regressions reproduced stale-position,
stale-source and overlapping-seek failures. TypeScript/lint, 215 tests and Android
bundle passed. Independent review found a clipped-sentence capitalization mismatch
that disabled highlighting with an ignored older edit; reproduced with a failing
test and fixed. Reviewer confirmed the repair with 13 tests and no new findings.
Phone heading playback and native-position word highlighting were observed;
return/earlier sentence selection and heading pause were exercised. Human audible
sync/gesture stress remains pending. No provider calls or private recording export.
See [verification evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/transcript-playback-verification.md).

<a id="record-068"></a>

<a id="i2-phase-4-confirmed-transcript-corrections--october-15-2026"></a>

### Phase 4 confirmed transcript corrections — October 15, 2026

**Contributor:** Seoyeon

**Tool:** OpenAI Codex, with a separate AI reviewer. AI review is not human review.

**Model:** not recorded

**Representative user prompts (verbatim):**

> implement phase 4

> Core principle: Saving a transcript correction, invalidating dependent feedback, and regenerating feedback must be three separate operations.

> Do not automatically regenerate presentation feedback after each correction.

> Preserve JJ's existing editor functionality, including sentence editing, word highlighting, playback, and manual corrections.

**Retained material:** Implemented the approved Phase 4 amendment in the isolated
`it2/feature/ai_feedback` checkout based on `ee6233b`. Added revisioned source-word
correction overlays/API and separate API/attempt-scoped SQLite synchronization.
Extended JJ's existing transcript panel with explicit save/cancel, replacement,
custom correction, restore/keep-original, conflict choice and STT-check controls.
Reused durable feedback jobs/quotas/receipts/recovery with an independent STT
analysis type. Confirmed overlays inform explicit coaching requests while original
quotes, words, audio, timestamps and visits remain source evidence. Pending edits
invalidate cached feedback immediately; saves never generate presentation feedback.
Existing feedback controls expose an update action. No Phase 5 summary, new screen
or requirements sheet was implemented.

**Review and human corrections:** The user's amendment superseded the general
automatic-generation rule for correction-triggered feedback. Working-diff AI review
found conflict loss on repeated refresh, an equivalent-text save loop, a retry
dialog that could follow a different take, missing failed-context recovery and
lost dismissals after manual edits. Fixes include canonical save acknowledgement,
preserved conflicts, identity-bound retry prompts, explicit dependency retries and
source-range dismissals. Android inspection caught low-contrast controls and
excessive transcript chrome; controls were made readable and compact within JJ's
existing panel. Additional regressions cover JSONB key order, punctuation and
restoring boundary-spanning corrections. Final staged review also found legacy
edits bypassing feedback freshness and delayed suggestion responses clearing
staleness; read-only legacy inspection and correction-aware response fences have
reproducing regression coverage. Human usefulness/audible acceptance is
pending; no named human reviewer approval is inferred.

**Verification:** Baseline was 215 mobile/321 backend tests. Final mobile checks
passed 232 tests plus types/lint and Android export. SQLite and PostgreSQL suites
each ran 332 tests successfully (23 SQLite skips, one host PostgreSQL dependency
skip). Packaged-worker and migration evidence is recorded in the ledger.
A separate real Celery process consumed a dedicated Redis queue against a
temporary PostgreSQL database with a synthetic provider: duplicate deliveries
made one STT request and one feedback request, and correction persistence queued
no feedback. Runtime migration compared original-record counts/hashes and retained
them. Migration tests prove legacy roundtrip and guarded refusal of lossy downgrade.
Final counts, exact commands, staged patch and review status are in
[the verification ledger](../../../testing/evidence/transcript-correction-verification-2026-10-15.md).

**Android evidence:** Emulator checks used a newly labeled synthetic presentation,
mock STT/suggestions and synthetic speech audio; they do not establish live AI
quality or real STT accuracy. Verified replacement save/revision 1, custom
correction, cancellation without revision change, further edits/reopen persistence,
keep-original without revision change, visit labels and playback. Only new fixture
records/catalog alias/media were added; no phone database was read/exported. The
external emulator seeder initially needed read-only DEX and JSON string fixes;
those were test harness repairs, not production data repair. Removing an emulator
port-forward did not establish disconnection, so offline Android behavior is not
claimed; offline persistence/conflicts are exercised in SQLite tests.

**Limits/authorization:** Independent AI review found no actionable findings in
the staged implementation after repairs; 17 focused tests passed in review. Final
human inspection remains. Exact staged patch identity and review evidence are
provided in the handoff. No commit, push, merge or Phase 5 is authorized.
The temporary synthetic worker database/queue and verification artifacts are
separate from project media and private recordings. No credentials or private
transcripts are included in this entry.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification:** Baseline was 215 mobile/321 backend tests. Final mobile checks
passed 232 tests plus types/lint and Android export. SQLite and PostgreSQL suites
each ran 332 tests successfully (23 SQLite skips, one host PostgreSQL dependency
skip). Packaged-worker and migration evidence is recorded in the ledger.
A separate real Celery process consumed a dedicated Redis queue against a
temporary PostgreSQL database with a synthetic provider: duplicate deliveries
made one STT request and one feedback request, and correction persistence queued
no feedback. Runtime migration compared original-record counts/hashes and retained
them. Migration tests prove legacy roundtrip and guarded refusal of lossy downgrade.
Final counts, exact commands, staged patch and review status are in
[the verification ledger](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-4-verification.md).

<a id="record-069"></a>

<a id="i2-phase-4-recognition-only-amendment--october-15-2026"></a>

### Phase 4 recognition-only amendment — October 15, 2026

**Contributor:** Seoyeon

**Tool:** OpenAI Codex with a separate AI reviewer; this is not human review.

**Model:** not recorded

**Representative user requests (verbatim):**

> OutLoud must faithfully represent what the presenter actually said. Users must not be able to rewrite their transcript to improve their presentation without rerecording the audio.

> Remove the Custom correction option from AI suggestion controls.

> Remove manual sentence editing, arbitrary text replacement, and their associated Save/Cancel UI.

> Preserve feedback invalidation without automatic regeneration.

> Before changing code, inspect the current implementation and identify which components are dedicated to manual editing versus shared AI-correction functionality. Then implement the smallest safe change.

**Retained material:** Inspected manual editor/custom/long-press/accessibility paths,
legacy sentence adoption, slide-spelling heuristics, correction storage/API and
provider normalization. Removed manual controls/adoption and unsupported heuristic
rewrites, retaining viewing, playback, navigation, alignment and source evidence.
Only explicit AI recognition offers may be accepted; Keep original and Restore
original remain. The backend enforces exact offered replacements and saves internal
acceptance provenance in existing JSON. New v2 caches archive old free-text state
without deleting it. Tightened STT prompt/schema; policy/version fences invalidate
old output without automatic regeneration. No new screen, schema migration, Phase 5
summary, requirements-sheet edit, commit, push or merge.

**Review repairs:** Independent AI review found coincidental future offers could
activate old manual rows, historical suggestion schemas could block retry, and old
coaching could appear current offline. Added explicit accepted job/policy provenance,
read-only handling of old candidates, local policy staleness and reproducing tests.
Accepted corrections remain applied across analysis-version changes. Replacement
highlighting uses original source-range intervals, retaining original timed words.

**Verification and limits:** Automated checks mock providers; Android checks use
the existing labeled synthetic recording. Source error classification is not proof
of what was spoken; users must listen before accepting. Physical-phone/live-model
quality and human audible acceptance remain unverified. Commands, counts, Android
evidence, review and the updated physical-device checklist are recorded in
[the amendment ledger](../../../testing/evidence/recognition-only-correction-verification-2026-10-15.md).

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification and limits:** Automated checks mock providers; Android checks use
the existing labeled synthetic recording. Source error classification is not proof
of what was spoken; users must listen before accepting. Physical-phone/live-model
quality and human audible acceptance remain unverified. Commands, counts, Android
evidence, review and the updated physical-device checklist are recorded in
[the amendment ledger](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-4-recognition-only-verification.md).

<a id="record-070"></a>

<a id="i2-contextual-transcript-controls--october-16-2026"></a>

### Contextual transcript controls — October 16, 2026

**Contributor:** Seoyeon

**Tool:** OpenAI Codex with independent AI review.

**Model:** not recorded

**Representative requests (verbatim):**

> **Sync corrections:** Hide it when everything is synchronized. Show a status/action only for pending edits, failures, or conflicts.

> **Check transcription:** Keep an explicit action because it requests AI suggestions. It could be a small button beside the transcript heading.

> **Status messages:** Show them only when useful—checking, failed, outdated, or awaiting synchronization.

**Retained changes:** Made sync controls contextual, moved the explicit AI check to
the heading, hid persistent successful/absent/no-candidate notices, retained failure/
conflict/retry controls. Independent review found a successful AI-check preflight
could leave an old sync error visible; fixed clearing across check, acceptance and
restore with attempt-scoped safety and recovery tests. A later custom-editor request
was immediately retracted; no custom/manual editing was implemented.

**Verification:** 237 mobile tests, typecheck/lint and Android export passed; the
existing playback cleanup-ref warning remains. Agent-operated synthetic emulator
inspection confirmed the quiet synchronized state and heading action. No backend
code/provider contract changed and no live provider call was made. See the
[current ledger](../../../testing/evidence/recognition-only-correction-verification-2026-10-15.md#contextual-transcript-controls--october-16-2026).
Physical-phone/human acceptance remains pending. No commit/push/merge.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification:** 237 mobile tests, typecheck/lint and Android export passed; the
existing playback cleanup-ref warning remains. Agent-operated synthetic emulator
inspection confirmed the quiet synchronized state and heading action. No backend
code/provider contract changed and no live provider call was made. See the
[current ledger](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-4-recognition-only-verification.md#contextual-transcript-controls--october-16-2026).
Physical-phone/human acceptance remains pending. No commit/push/merge.

<a id="record-071"></a>

<a id="i2-phase-5-selected-slide-review-october-16-2026"></a>

### Phase 5 selected-slide review (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

User prompt (verbatim):

> implement phase 5

Generated material incorporated: scoped review API on existing durable workers,
image-aware profile reuse, revision-aware evidence normalization and explicit timing,
JJ Review summary and existing-sheet playback integration, regression/interaction
tests and API/verification documentation. Scope is the approved Phase 5 plan and
preceding product amendments; no custom editor, held requirements sheet or Phase 6.

Verification/review: see [Phase 5 ledger](../../../testing/evidence/selected-slide-feedback-verification-2026-10-16.md). Initial tests and
implementation do not establish human advice quality or physical-device acceptance.
No commit, push or merge is authorized by this request.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Verification/review: see [Phase 5 ledger](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-5-verification.md). Initial tests and
implementation do not establish human advice quality or physical-device acceptance.
No commit, push or merge is authorized by this request.

<a id="record-072"></a>

<a id="i2-automatic-first-feedback-and-middle-school-audience-preview-october-16-2026"></a>

### Automatic first feedback and middle-school audience preview (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

User prompts (verbatim):

> Currently it claims the side profile analysis failed, for the mean time set it as 14 year old middle school students so i can look at the type of feedback

> First set of feedback should be automatic, no analyze slide button needed

> Also make it so there s alimit to 1 analyze slide button if a analysis has been made just to avoid users consistently prompt apis

Incorporated: once-only initial selected-recording workflow, completed-result action
gating, automatic-work and correction regression tests; saved the current phone
presentation's audience through existing app/API functions. Diagnosed and corrected
the temporary isolated reservation budget, then made two explicit real profile
retries. Both returned invalid overlong cue text; no successful live feedback is
claimed. See [follow-up evidence](../../../testing/evidence/selected-slide-feedback-verification-2026-10-16.md#october-16-follow-up--automatic-first-feedback-and-audience-preview).
No custom editing, new screen, commit, push or merge.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Incorporated: once-only initial selected-recording workflow, completed-result action
gating, automatic-work and correction regression tests; saved the current phone
presentation's audience through existing app/API functions. Diagnosed and corrected
the temporary isolated reservation budget, then made two explicit real profile
retries. Both returned invalid overlong cue text; no successful live feedback is
claimed. See [follow-up evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-5-verification.md#october-16-follow-up--automatic-first-feedback-and-audience-preview).
No custom editing, new screen, commit, push or merge.

<a id="record-073"></a>

<a id="i2-purpose-aware-feedback-and-reachable-correction-choices-october-16-2026"></a>

### Purpose-aware feedback and reachable correction choices (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent; human review remains pending.

Representative user prompts/excerpts (verbatim):

> Issues: I ran a new recording in the Guatemal_with_graph
> screen goes blank when i want to hear recording, audio plays, cant go back to slides by sliding down from review page.
> Also, It does flag wrong transcription choices such as transcribing Tahumulco when I said Tajumulco, but there is no way to edit it or like an autocomplete option like the ones in apple devices were for mispelled words it gives suggestions of what you meant. Also, content feedback is very slides based, nothing that adds to the presentation. It would be nice if there are anecdotes, or information not present on slides but would enrich presentation.

> both

> A weak AI coach can always invent additional topics. A strong coach understands what the presentation is trying to accomplish and what doesn't need to be added.

> This doesn't necessarily mean you need two separate prompts or entirely different backend pipelines. A shared evaluator could first classify the presentation's purpose and select relevant evaluation criteria.

> it should do both

Incorporated: purpose selection in the shared evaluator (informative/descriptive,
analytical/persuasive, mixed/uncertain); meaningful, conditional missing-explanation
criteria; zero to two optional illustrative enrichments separate from problem
findings; cached expansion; review-v2 stale compatibility; Review scroll/gesture
ownership and tappable existing footer; recognition replacement popover outside
the clipped transcript area, sentence tap/play isolation and TalkBack actions.
No unrestricted transcript editing or new screen was added.

Investigation distinguished confirmed navigation/clipped-choice problems from the
unreproduced intermittent blank screen. Existing real recognition offers were
present; the agent did not accept, restore or rewrite the user's transcription.
External sourced enrichment was requested, but automatic approval review rejected
enabling OpenAI web search without explicit destination/data-sharing approval.
The pending approval question was left open; no search integration or workaround
was enabled. Verification and review repairs: [follow-up ledger](../../../testing/evidence/selected-slide-feedback-verification-2026-10-16.md#purpose-aware-feedback-and-interaction-repairs-october-16).
No commit, push, merge or later phase is authorized by these changes.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Investigation distinguished confirmed navigation/clipped-choice problems from the
unreproduced intermittent blank screen. Existing real recognition offers were
present; the agent did not accept, restore or rewrite the user's transcription.
External sourced enrichment was requested, but automatic approval review rejected
enabling OpenAI web search without explicit destination/data-sharing approval.
The pending approval question was left open; no search integration or workaround
was enabled. Verification and review repairs: [follow-up ledger](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-5-verification.md#purpose-aware-feedback-and-interaction-repairs-october-16).
No commit, push, merge or later phase is authorized by these changes.

<a id="record-074"></a>

<a id="i2-phase-6-durable-audience-qa-october-16-2026"></a>

### Phase 6 durable audience Q&A (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent. Human inspection is pending.
Representative user prompts (verbatim):

> plan for phase 6

> implment phase 6

Incorporated: validated selected-run manifests, audience/purpose-aware question
prompts, stable question generation IDs, reusable durable jobs, a small answer binding
migration, original answer audio/STT identity preservation, explicit invalidation and
recovery, one-time initial eligibility, existing-screen saved history/playback, tests,
API documentation and the verification ledger. No requirements sheet or new screen.

Independent review identified failed answer-profile recovery, ambiguous follow-up
context, stale-current history exclusion and same-job storage initialization. These
were repaired with client/state/workflow regressions and checked again. Evidence,
actual command outcomes, Android test limits and final staged review are recorded in
[Phase 6 verification](../../../testing/evidence/audience-qa-verification-2026-10-16.md). No human code review is fabricated;
no commit, push, merge, publication, Phase 7 or real-provider quality acceptance.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Independent review identified failed answer-profile recovery, ambiguous follow-up
context, stale-current history exclusion and same-job storage initialization. These
were repaired with client/state/workflow regressions and checked again. Evidence,
actual command outcomes, Android test limits and final staged review are recorded in
[Phase 6 verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-6-verification.md). No human code review is fabricated;
no commit, push, merge, publication, Phase 7 or real-provider quality acceptance.

<a id="record-075"></a>

<a id="i2-phase-6-phone-qa-availability-repair-october-16-2026"></a>

### Phase 6 phone Q&A availability repair (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent.
Representative prompt (verbatim):

> Im getting that Audience Q&A is offline or unavailable

Incorporated: structural selected-run scope comparison and regression coverage for
backend JSON field order. The old development API was migrated/restarted using its
existing isolated settings; worker and recovery scheduler resumed. No credentials or
original recordings changed. Verified three completed current questions through the
physical phone; usefulness and full answer submission remain pending. All 275 mobile
tests and Android export passed; independent review reran 15 focused tests with no
findings. [Evidence](../../../testing/evidence/audience-qa-verification-2026-10-16.md#phone-qa-availability-repair-october-16).
No commit, push or merge.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Incorporated: structural selected-run scope comparison and regression coverage for
backend JSON field order. The old development API was migrated/restarted using its
existing isolated settings; worker and recovery scheduler resumed. No credentials or
original recordings changed. Verified three completed current questions through the
physical phone; usefulness and full answer submission remain pending. All 275 mobile
tests and Android export passed; independent review reran 15 focused tests with no
findings. [Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/phase-6-verification.md#phone-qa-availability-repair-october-16).
No commit, push or merge.

<a id="record-076"></a>

<a id="i2-new-presentation-defaults-october-16-2026"></a>

### New-presentation defaults (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent.
Representative prompt (verbatim):

> Set default audience as general ppl. default duration 5 minutes

Incorporated: persisted new-import initialization using existing context APIs,
General audience/300-second defaults, stable retry identity and deduplication,
preference-conflict preservation, initial-feedback synchronization gate and default
labels within existing screens. No held requirements sheet or new screen. Automated
checks, independent review and synthetic native-import evidence are recorded in
[presentation defaults verification](../../../testing/evidence/presentation-defaults-verification-2026-10-16.md).
No commit, push or merge.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Incorporated: persisted new-import initialization using existing context APIs,
General audience/300-second defaults, stable retry identity and deduplication,
preference-conflict preservation, initial-feedback synchronization gate and default
labels within existing screens. No held requirements sheet or new screen. Automated
checks, independent review and synthetic native-import evidence are recorded in
[presentation defaults verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/presentation-defaults-verification.md).
No commit, push or merge.

<a id="record-077"></a>

<a id="i2-cue-policy-v5-october-16-2026"></a>

### Cue policy v5 (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent.
Representative prompts (verbatim):

> preparing ai cues not working

> I feel like 15 word limit is too harsh what should be a better limit. I just dont like when the text is too repetitive and bloated

> implement this

Incorporated: v5 generation target 8–16 words with maximum 25, concise distinct
objectives and expandable reasoning; preserved evidence validation and v4 cached
results/recovery. Updated backend/mobile validation, cache selection for Review/Q&A,
regression tests and API documentation. A failed real deck completed generation and
rendered cues on the physical phone. [Verification and limits](../../../testing/evidence/cue-policy-v5-verification-2026-10-16.md).
No commit, push or merge. Human usefulness acceptance remains pending.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Incorporated: v5 generation target 8–16 words with maximum 25, concise distinct
objectives and expandable reasoning; preserved evidence validation and v4 cached
results/recovery. Updated backend/mobile validation, cache selection for Review/Q&A,
regression tests and API documentation. A failed real deck completed generation and
rendered cues on the physical phone. [Verification and limits](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/cue-policy-v5-verification.md).
No commit, push or merge. Human usefulness acceptance remains pending.

<a id="record-078"></a>

<a id="i2-qa-navigation-and-clearer-expression-feedback-october-16-2026"></a>

### Q&A navigation and clearer-expression feedback (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent.
Representative prompts (verbatim):

> Audience Questions should be generated alongside feedback. I shouldn't have to be waiting for it. Also because not all were generated creates blank screens after on equestion. I had to go back so that it regenreated. Also could AI feedback critique on the structure of the transcript like how the individual articulated their ideas. And give more coherent ways to express that same idea

> Blank screen was caused after waiting for first question and then swiping for next question which was yet to be generated.

> Let's just hold on incremental recording work and focus on fixign Q&A/navigation repair and clearer-expression feedback

Incorporated: safe automatic Q&A preflight recovery, preserved one-time/uncertain
submission protection, complete-batch navigation, explicit last-question/pending
states, v3 meaning-preserving expression advice in existing Review suggestions,
and historical v2 request reconstruction. The reviewer caught a removed consumed
marker guard; it was restored and regression-tested before final review.
[Checks, Android evidence and limits](../../../testing/evidence/qa-navigation-expression-verification-2026-10-16.md).
Original speech/audio, correction rules and selected-take identity remain intact.
No incremental recording, requirements sheet, new screen, commit, push or merge.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Incorporated: safe automatic Q&A preflight recovery, preserved one-time/uncertain
submission protection, complete-batch navigation, explicit last-question/pending
states, v3 meaning-preserving expression advice in existing Review suggestions,
and historical v2 request reconstruction. The reviewer caught a removed consumed
marker guard; it was restored and regression-tested before final review.
[Checks, Android evidence and limits](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/qa-navigation-expression-verification.md).
Original speech/audio, correction rules and selected-take identity remain intact.
No incremental recording, requirements sheet, new screen, commit, push or merge.

<a id="record-079"></a>

<a id="i2-evidence-validation-audit-october-16-2026"></a>

### Evidence-validation audit (October 16, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

Independent AI review: separate reviewer agent.
Representative request excerpts (verbatim):

> Audit and revise OutLoud's AI feedback evidence-validation pipeline.

> Prevent valid AI feedback from being discarded due to harmless formatting differences or unnecessarily restrictive validation, without weakening factual grounding or allowing fabricated evidence.

> Validate each AI-generated finding independently.

> Do not commit, push, or merge changes.

Incorporated: shared Python/TypeScript safe quotation policy and corpus, independent
findings, truthful partial/error states, contiguous same-visit spans and slide
excerpts, 64-character panelist names with historical schema reconstruction,
structural object comparison, and explicit idempotent no-provider saved-receipt
repair. Review feedback led to conservative operator/unit handling, Unicode parity,
full authoritative fact context, and per-finding source-length isolation.
[Verification and limits](../../../testing/evidence/evidence-validation-verification-2026-10-16.md). Tests use mocked
providers; one current saved result was repaired and fetched by the actual phone.
Human usefulness/visual Review acceptance remains pending. No commit, push or merge.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Incorporated: shared Python/TypeScript safe quotation policy and corpus, independent
findings, truthful partial/error states, contiguous same-visit spans and slide
excerpts, 64-character panelist names with historical schema reconstruction,
structural object comparison, and explicit idempotent no-provider saved-receipt
repair. Review feedback led to conservative operator/unit handling, Unicode parity,
full authoritative fact context, and per-finding source-length isolation.
[Verification and limits](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/evidence-validation-verification.md). Tests use mocked
providers; one current saved result was repaired and fetched by the actual phone.
Human usefulness/visual Review acceptance remains pending. No commit, push or merge.

<a id="record-130"></a>

<a id="i2-permanent-recording-cues-with-play-preserved--october-16-2026"></a>

### Permanent recording cues with Play preserved — October 16, 2026

- Contributor: Seoyeon
- Tool: OpenAI Codex desktop, with implementation/test subagents and a separate final reviewer.
- Model: not recorded (exact variant was not recorded).
- Human decisions: permanent Cues replaces the recording transcript body; Play remains; Must Cover and Go Deeper share one scroll; slide-based audience-independent generation is retained. The broad setup integration plan was discarded.

#### Implementation request (verbatim)

```text
PLEASE IMPLEMENT THIS PLAN:
# Permanent Cues panel with Play preserved

## Recording layout

- Replace the normal recording screen’s transcript body with a permanent panel titled **Cues**, using Nakajima’s existing placement, typography, spacing and theme.
- **Keep the Play/Pause button beside the heading.** It continues playing the selected slide’s saved audio, including repeated visits. Preserve existing playback restrictions during recording and unavailable-audio states.
- Show **Must Cover** and **Go Deeper** as labelled sections in one scrollable panel. Neither requires opening a tab or switching screens.
- Keep cues visible before and during recording. Retain expandable evidence/details.

## Existing workflows and state

- Reuse `useSlideProfiles`, the profile client/cache, existing generated content and retry confirmation behavior. Change presentation components rather than creating another generation system.
- Bind displayed cues to the recording screen’s authoritative selected slide. Forward/backward navigation and revisits update content without generating new cues.
- Keep profile state outside the normal/rotated layout switch. Reset panel scrolling and expanded details when the selected slide changes, preventing previous-slide content from leaking.
- Preserve cached cues across reopening and recovery. Keep explicit loading, unavailable, empty-category, failed, stale and retry states.
- Preserve the confirmed **slide-based, audience-independent** cue model. Surface requirements synchronization separately; do not claim cues are personalized to audience/duration or invalidate valid slide profiles solely because those requirements change.
- Continue respecting existing profile freshness and revision checks. Navigation, theme changes, rotation and reopening may read status but must not admit generation.

## Rotation and preserved capabilities

- Keep Nakajima’s enlarged rotated PDF, timer, navigation and recording controls. Hide the Cues panel and its Play button from interaction/accessibility while rotated.
- Returning to normal restores Cues for the current slide, including a slide selected while rotated.
- Remove the old Cues/transcript visibility toggle; retain Rotate.
- Preserve transcript storage, word alignment, audio playback, corrections and evidence workflows.
- Because correction controls currently reside inside the removed transcript section, reuse them in the existing Review playback interface behind a **Transcript & corrections** action. Preserve confirmed suggestions, restore, synchronization, conflict handling and stale-feedback behavior.
- Full Review continues exposing transcripts/playback and reaches corrections through its existing selected-slide Review navigation. No separate recording-cues screen is added.

## Verification

- Update component tests to prove both categories render actual cached/generated content, with no transcript body and a functioning Play/Pause control.
- Cover visibility before/during recording; forward/backward navigation; revisits; reopening; recovery; rotation; both themes; long cues; and missing/stale/failure/retry states.
- Assert no generation requests occur from navigation, theme changes, rotation or reopening.
- Test selected-slide playback across repeated visits and retained correction → stale feedback → evidence playback flows.
- Run mobile `npm run check` and `npm run bundle:android`, then verify the changed flows on Android. Report device checks separately from automated results.

## Boundaries and handoff

- Limit implementation to recording/cue presentation, the necessary correction-access relocation and focused tests.
- Do not change backend contracts, cue prompts, generation scope or unrelated screens for this amendment.
- Record implementation and verification in `docs/ai-use.md`; follow repository review and final-inspection requirements before committing.
```

#### Work and evidence

- Prepared isolated `it2/integration-ai-nakajima` from AI `ff8472c` and uncommitted merge of Nakajima `959025e`, because no integrated checkout existed. Preserved source worktrees and backend runtime contracts.
- Reused immutable profile cache/client/hook; permanent themed Cues, retained selected-slide Play/Pause, normal/rotated layout handling, Review correction access and retained durable Q&A/feedback hosts.
- Verification and remaining limits are recorded in [the recording-cues verification record](../../../testing/evidence/recording-cues-verification-2026-10-16.md); initial integration check exposed correction-component lint and theme test-loader failures, repaired before the final run.
- No human testing or final inspection is inferred. No commit or push performed.

Final verification for permanent Cues: 331 mobile tests passed, typecheck and lint
passed (one existing cleanup-ref warning), Android export passed. Backend SQLite:
388 tests run, 363 passed and 25 skips; system/migration checks passed. Separate
review found and verified repairs for correction source ownership, untimed text,
unsupported clipped moves, shared playback cleanup, native Pause and original timed
word seeking. Its final 45 focused tests passed with no remaining material finding.
Emulator cue/recording/theme/rotation/Review observations and synthetic WAV validation
limitation are distinguished in recording-cues-verification.md. Original emulator
stores restored, phone untouched, no commit/push; final human inspection pending.

#### Physical-phone preview follow-up — October 16, 2026

Contributor: Seoyeon. Tool: OpenAI Codex desktop; exact model variant not recorded.

User request (verbatim):

```text
I dont see the changes on my physical phone
```

Codex inspected installed app/native configuration and the existing Metro process.
The phone's previous port 8083 served a separate temporary Nakajima checkout, not
this integration worktree. A separate integration Metro server now runs localhost
port 8091, with IPv4-first DNS and the existing USB-loopback backend address. USB
forwarding/development-client navigation changed; no reinstall, data reset, recording
or provider generation was performed. Installed native APK/dependency/configuration
compatibility was checked independently, so a native rebuild was unnecessary for
these UI changes.

Agent-operated phone screenshot confirmed the normal recording screen displays
Cues, Must Cover, Go Deeper, Play and Rotate for an existing saved presentation.
The existing PDF catalog still contains seven entries. Backend port 8000 was not
listening, so this presentation showed the explicit unavailable-offline cue state;
no claim of physical-phone cue generation or speech/audio quality is made. Source
code and the previously tested/staged implementation remain unchanged; evidence
updated in [recording-cues-verification.md](../../../testing/evidence/recording-cues-verification-2026-10-16.md#physical-phone-preview-correction--october-16-2026) and this task entry. No commit or push.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- Prepared isolated `it2/integration-ai-nakajima` from AI `ff8472c` and uncommitted merge of Nakajima `959025e`, because no integrated checkout existed. Preserved source worktrees and backend runtime contracts.
- Reused immutable profile cache/client/hook; permanent themed Cues, retained selected-slide Play/Pause, normal/rotated layout handling, Review correction access and retained durable Q&A/feedback hosts.
- Verification and remaining limits are recorded in [the recording-cues verification record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/recording-cues-verification.md); initial integration check exposed correction-component lint and theme test-loader failures, repaired before the final run.
- No human testing or final inspection is inferred. No commit or push performed.

Agent-operated phone screenshot confirmed the normal recording screen displays
Cues, Must Cover, Go Deeper, Play and Rotate for an existing saved presentation.
The existing PDF catalog still contains seven entries. Backend port 8000 was not
listening, so this presentation showed the explicit unavailable-offline cue state;
no claim of physical-phone cue generation or speech/audio quality is made. Source
code and the previously tested/staged implementation remain unchanged; evidence
updated in [recording-cues-verification.md](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/recording-cues-verification.md#physical-phone-preview-correction--october-16-2026) and this task entry. No commit or push.

<a id="record-131"></a>

<a id="i2-complete-ai-feedback-integration-into-nakajima-ui--october-16-2026"></a>

### Complete AI feedback integration into Nakajima UI — October 16, 2026

Contributor: Seoyeon. Tool: OpenAI Codex and delegated implementation/review agents. Main model: not recorded; independent reviewer: GPT-6 Astra.

#### Actual user prompts (verbatim)

````text
Evaluate the current integrated version, compare with what we had implemented in it2/aifeedback. Plan where each part should go so that ai feedback is implemented in the nakajima version of the ui

````

````text
PLEASE IMPLEMENT THIS PLAN:
# Complete AI feedback integration into Nakajima’s UI

## Evaluation

The integrated version retains most of `it2/feature/ai_feedback`’s generation, caching, corrections, evidence and Q&A workflows. The main gaps are how Nakajima’s UI connects to and represents those workflows.

Compared against AI baseline `ff8472c`; the locally named `origin/it2/ai-feedback` points to the same revision. The integration remains staged and uncommitted.

Confirmed gaps:

- **Setup is disconnected:** time/audience choices save locally, while AI can continue using General audience and five minutes. See [setup confirmation](/Users/seoyeonpark/.codex/worktrees/integration-ai-nakajima/OnLoud/mobile/src/screens/UploadScreen.tsx:98).
- **Scores contradict AI results:** prominent grades and issue counts use local heuristics and older coaching results, independently of current selected-slide findings. See [Review indicators](/Users/seoyeonpark/.codex/worktrees/integration-ai-nakajima/OnLoud/mobile/src/screens/ReviewScreen.tsx:114).
- **Feedback is buried:** substantive findings sit inside the remaining space of a fixed-height slide card.
- **Q&A accessibility regressed:** its Review entry retained the swipe gesture but lost the tappable action.
- **Full Review lacks an AI overview:** its colored tiles currently represent heuristic grades.

This audit’s 41 focused workflow tests passed. Earlier integration checks recorded 331 passing tests and a successful Android export. Physical-phone verification established the Cues layout; the backend was offline, so complete AI flows remain unverified there.

## Where each capability belongs

| Capability | Current integration | Intended placement |
|---|---|---|
| Time and audience requirements | Local setup and AI context disagree | Existing setup overlay, reused for editing |
| Must Cover / Go Deeper | Permanent recording panel implemented | Keep in normal recording layout beside Play |
| Selected-slide AI feedback | Retained but buried | Main content of Review |
| AI status and finding counts | Disconnected from prominent indicators | Shared indicators across Review, Full Review and Home |
| Transcript corrections and word playback | Retained in recording-details sheet | Review → **Transcript & corrections** |
| Finding evidence | Retained through playback sheet | Expandable finding details → existing evidence playback |
| Run transcripts and playback | Retained | Full Review |
| Audience questions, answers and history | Retained; entry requires gesture | Existing Q&A screen, with tappable Review entry |
| Older recording-wide coaching and descriptions | Retained alongside newer feedback | Clearly labelled, collapsed recording tools |
| Take comparison | Retained | Existing Compare; preserve Keep current / Overwrite |

## Implementation changes

### 1. Connect presentation setup to authoritative requirements

- Reuse the existing setup overlay after import and from an **Edit time & audience** action in the idle recording header. Stop playback while editing; disable opening during countdown or capture.
- Save through the existing revisioned context client. Initialize new imports to five minutes and General audience; existing presentations load their saved values.
- Support 1–30 minutes. Preserve existing exact durations until the user moves the slider; slider interaction uses 30-second increments.
- Keep audience presets, add **Other…** within the overlay for existing/custom values, and respect the existing 500-code-point validation. Allow explicitly clearing audience or duration.
- Persist confirmed offline choices separately from server-accepted requirements. Unsaved edits disappear on cancellation; confirmed pending choices survive reopening.
- Serialize default initialization and user saves through one writer. Defaults must never overwrite confirmed choices.
- Resolve lost acknowledgements through GET. Preserve conflicting local/server values and offer **Use server** or **Keep mine**, with revision checking.
- Show **Saved on phone · sync pending**, failure and conflict states. Pending changes immediately mark dependent feedback/Q&A outdated and block generation until synchronized.
- Restore default, required and suggested timing labels. Changing requirements must preserve valid slide-only cue profiles.

### 2. Share one source of AI status

Extract the existing validated cache, scope and freshness handling into a shared feedback reader used by Review, Full Review and Home.

- Preserve existing cache keys and exact selected attempt/slide/segment identities, including repeated visits.
- Read existing singleton slide scopes separately; combining slides would address a different backend analysis.
- Reuse current transcript, correction and requirement revision checks. Pending/conflicting corrections must invalidate displayed feedback immediately.
- Expose current status and verified finding counts; do not manufacture percentage grades.
- Distinguish successful, partial, insufficient evidence, invalid evidence, failed, unavailable, analyzing, outdated and not analyzed.
- Only successful current results with zero findings may show **No issues found**. Partial or unavailable results must never appear clean.
- Share and deduplicate GET requests, with at most three concurrent requests and one polling timer for active jobs. Stop polling covered screens.
- Keep provider admission in the existing initial-generation hosts and explicit update/retry actions.

### 3. Make Review the primary feedback interface

Preserve Nakajima’s typography, theme, ring, timing bars, slide preview and playback styling.

Use one page-level scroll in this order:

1. Selected-slide AI status ring and verified finding count.
2. Timing/filler metrics and slide navigation.
3. Slide preview and saved-audio playback.
4. **AI feedback**: up to four prioritized findings, with observation, advice and expandable evidence.
5. Optional **Go deeper** enrichment, visibly separate from problems.
6. **Transcript & corrections**, Full Review and Audience Q&A actions.

Replace the small nested feedback scroll. Keep Refresh, Update feedback, dependency recovery and uncertain-retry confirmation beside the relevant state.

The recording screen’s Review button should open the currently selected slide. After finishing a recording, retain the existing automatic choice of an initial review slide.

### 4. Connect Full Review and Home

- Replace Strong/Good/Needs work/Weak tiles with the shared AI statuses and finding counts.
- Full Review shows assessed slides, slides with findings, partial results, pending work, outdated results and recovery states.
- Its ring shows **N of M recorded slides assessed**, explicitly representing completion rather than presentation quality.
- Home uses the same compact assessment summary and continues opening Full Review.
- Keep duration, fillers and pace separately labelled as measured metrics.
- Preserve Full Review’s transcript and run/slide playback. Disclose missing source audio before playing a partial run.
- Selecting a tile opens that slide’s Review; corrections remain accessible from there.

### 5. Preserve supporting workflows

- Keep permanent Cues and Play unchanged, including rotation, recovery, caching and slide synchronization.
- Retain correction suggestions, confirmation, restore, synchronization, conflicts, original-word playback and source ownership.
- Evidence playback shows the selected quote and source interval and plays that bounded interval through existing playback controls.
- Label older coaching **Recording-wide suggestions** under collapsed recording tools; do not mix it into current selected-slide counts.
- Restore tappable Q&A/back actions while retaining gestures.
- Replace obsolete “requirements entry unavailable” messages with an action opening the shared setup overlay.
- Preserve Q&A preparation, explicit updates, saved generations, follow-ups, answer recording/transcription and retry identity.
- Keep Compare’s selection mechanics and measured comparisons; do not add a new AI comparison system.

## Verification and handoff

- Test setup synchronization, defaults races, offline reopening, lost acknowledgements, conflicts, concurrent edits, API isolation and duration/audience boundaries.
- Test consistent indicators across all three screens, including zero/four findings, partial, failed, insufficient, outdated and unavailable states.
- Assert navigation, reopening, theme, rotation, overview refresh and settings operations do not admit provider generation.
- Retain repeated/backward-visit, correction → stale feedback → explicit update → evidence playback tests.
- Verify long findings, both themes, larger text, scrolling and tappable accessibility routes.
- Run mobile `npm run check` and `npm run bundle:android`.
- On the physical phone, verify the integration checkout and backend readiness, then exercise setup, cues, recording, Review, corrections, evidence, Full Review and Q&A. Report actual device results separately from mocked tests and real-provider checks.
- Update `docs/ai-use.md` and the existing verification record. Stage intended changes, obtain independent review, fix/retest findings, and present the exact staged result for final inspection before any commit.

## Boundaries

Continue on `it2/integration-ai-nakajima`. Reuse existing backend contracts, prompts, generation scope and native dependencies. Add no standalone AI screen or historical-recording browser. Preserve saved media and caches. This plan incorporates your choices: authoritative AI status, connected setup and findings directly in Review.

````

#### Human decisions and AI work

The user selected AI status instead of heuristic quality grades, connected time/audience setup, and findings directly in Review, then requested implementation of the complete plan above. Reused the existing isolated integration branch and preserved its staged merge/Cues implementation. Generated requirements draft synchronization and shared writer, cache/status reader and UI bindings, Review layout, aggregate indicators, bounded evidence controls, focused tests and documentation. Existing backend routes, prompts, native dependencies and saved source media were retained.

#### Verification and review

Implementation and actual check/device evidence are recorded in [recording-cues-verification.md](../../../testing/evidence/recording-cues-verification-2026-10-16.md#complete-ai-feedback-integration-october-16-2026). Independent review reproduced and repaired delayed word-play overlap, covered Review polling and stale in-memory source feedback. Final user inspection remains pending; no commit, push or PR is implied. Native runtime additionally exposed a defaults/draft import cycle; extracted shared defaults state while preserving behavior. Physical checks also repaired custom-audience keyboard obstruction, sheet-header overlap, a missing visible setup action and Q&A unavailable-state audience/recovery presentation. A cold Next check then isolated an entrance-opacity failure; the shared fade now settles to static visible opacity, with regressions and a separate re-review. The final source passed 392 mobile tests and Android export, then separate scoped AI re-reviews. Real-provider feedback and native evidence progress are recorded separately from automated fixtures and untested capture/correction/answer flows.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Implementation and actual check/device evidence are recorded in [recording-cues-verification.md](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/recording-cues-verification.md#complete-ai-feedback-integration-october-16-2026). Independent review reproduced and repaired delayed word-play overlap, covered Review polling and stale in-memory source feedback. Final user inspection remains pending; no commit, push or PR is implied. Native runtime additionally exposed a defaults/draft import cycle; extracted shared defaults state while preserving behavior. Physical checks also repaired custom-audience keyboard obstruction, sheet-header overlap, a missing visible setup action and Q&A unavailable-state audience/recovery presentation. A cold Next check then isolated an entrance-opacity failure; the shared fade now settles to static visible opacity, with regressions and a separate re-review. The final source passed 392 mobile tests and Android export, then separate scoped AI re-reviews. Real-provider feedback and native evidence progress are recorded separately from automated fixtures and untested capture/correction/answer flows.

<a id="record-132"></a>

<a id="i2-inline-review-transcript--october-16-2026"></a>

### Inline Review transcript — October 16, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

#### Verbatim request

```text
Currently transcript in review is shown in seperate black window. Dleete that window, that is not part of aout screen. Add transcript which is synced with the audio below the play button on top of ai feedback section
```

#### Incorporated work

**Output and use:** Moved the selected-source transcript and existing correction controls into the normal Review page below its saved-audio Play button and above AI feedback. Removed Review's separate playback modal; retained rehearsal recovery's existing sheet. Reused the same segment player for slide/sentence/word/evidence audio, source URI and source-time highlighting, source-owned corrections, original-word playback, saved-media downloads and collapsed recording tools. No backend contract, provider prompt, generation scope or native dependency changed.

**Verification and limits:** Checks and final review are recorded in [the verification record](../../../testing/evidence/recording-cues-verification-2026-10-16.md#inline-review-transcript-october-16-2026). Human final inspection remained pending at this implementation handoff; no commit, push or PR was implied. The later [integration publication](#integration-publication--october-16-2026) supersedes that commit/push gate.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

**Verification and limits:** Checks and final review are recorded in [the verification record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/recording-cues-verification.md#inline-review-transcript-october-16-2026). Human final inspection remained pending at this implementation handoff; no commit, push or PR was implied. The later [integration publication](#integration-publication--october-16-2026) supersedes that commit/push gate.

<a id="record-133"></a>

<a id="i2-both-cue-categories-visible--october-16-2026"></a>

### Both cue categories visible — October 16, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact variant not recorded)

#### Verbatim request

```text
Go deeper is hidden beneath must cover
```

#### Incorporated work and verification

Replaced vertically stacked categories with equal-width Must Cover / Go Deeper columns within the existing shared recording-panel scroll. Kept category labels above the scroll, retained original content/details, and placed shared notices after category content so they cannot push both cue starts out of view. Panel bounds, Play, timer, recording controls and generation/cache workflows remain unchanged. Focused layout regression reproduced the defect before the fix. Final automated, phone and independent-review evidence is recorded in [the verification record](../../../testing/evidence/recording-cues-verification-2026-10-16.md#both-cue-categories-visible-october-16-2026). Human final inspection remained pending at this implementation handoff; no commit or push occurred then. The later [integration publication](#integration-publication--october-16-2026) supersedes that commit/push gate.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

Replaced vertically stacked categories with equal-width Must Cover / Go Deeper columns within the existing shared recording-panel scroll. Kept category labels above the scroll, retained original content/details, and placed shared notices after category content so they cannot push both cue starts out of view. Panel bounds, Play, timer, recording controls and generation/cache workflows remain unchanged. Focused layout regression reproduced the defect before the fix. Final automated, phone and independent-review evidence is recorded in [the verification record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/recording-cues-verification.md#both-cue-categories-visible-october-16-2026). Human final inspection remained pending at this implementation handoff; no commit or push occurred then. The later [integration publication](#integration-publication--october-16-2026) supersedes that commit/push gate.

<a id="record-134"></a>

<a id="i2-integration-publication--october-16-2026"></a>

### Integration publication — October 16, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** GPT-6 (exact variant not recorded)

#### Verbatim request

```text
commit and push
```

#### Authorized handoff

- **Human decision:** The user authorized committing and pushing `it2/integration-ai-nakajima` after the staged integration, inline Review transcript and cue-visibility handoffs. This supersedes those implementation snapshots' pending-inspection state for commit/push; it does not establish human functional acceptance or teammate approval. No PR creation or merge into another remote branch was requested in this October 16 request.
- **Output and verification:** Codex checked the branch, merge parents, exact staged source against recorded AI reviews, outgoing scope and live remote destination. Application source was unchanged from reviewed/tested tree `5e9306cc1bb950c3912765c1cce170c6e0715906`; only publication evidence was added. Prior 406-mobile-test, Android-export and physical-phone results apply to that unchanged snapshot. The commit retains the AI and Nakajima merge parents; these historical checks do not describe the later Scribe integration snapshot.

<a id="record-135"></a>

<a id="i2-complete-automatic-scoring-source-commit--october-17-2026"></a>

### Complete automatic scoring source commit — October 17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

User request:

> Prepare and commit the complete automatic presentation-scoring implementation, including its required earlier uncommitted scoring dependencies.
>
> Before committing: identify all scoring-related source files and dependencies; preserve unrelated changes and the original staging state; verify completeness and tests; commit only verified scoring and required dependencies; report the hash, included files, results and remaining changes. Do not push, merge, deploy, or modify unrelated work.

- **Output and use:** Codex selected the complete existing automatic scoring implementation and required earlier uncommitted runtime dependencies into an isolated source snapshot. Retained material includes the frozen v2 rubric/evidence reconstruction, deterministic scorer, existing-job API integration, Android validation/cache/controller, automatic selected-recording scoring, direct advice/evidence, shared score colors and Home statistics. Existing v1 evidence/measurement helpers remain runtime dependencies; experiment runners, grouped-feedback schemas and unrelated cue/navigation/reliability changes are excluded.
- **Errors and revisions:** Mixed source/test files include only reviewed scoring hunks. A candidate-test edit removed an unnecessary historical grouping-model assertion while retaining scoring/singleton independence checks. Independent AI review found a missing explicit Retry for rejected source assessments in slide/composed views; Codex added a narrow UI gate and regression, then passed final mobile checks with 494 tests. Repair cost was not recorded.
- **Verification:** The isolated snapshot was tested independently of unrelated local changes. Included files, exact checks, separate AI review and remaining limits are recorded in [the source-snapshot report](../../../testing/evidence/presentation-scoring-source-verification-2026-10-17.md).
- **Human decisions and preservation:** Seoyeon authorized committing the complete scoring implementation and dependencies. Original index/staged snapshots were saved locally before history changes; unrelated staged entries and working-tree content were preserved. This task made no live AI calls, push, merge, deployment or device update. Commit authorization does not establish teammate approval or real-provider usefulness; human code edits are not recorded.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- **Output and use:** Codex selected the complete existing automatic scoring implementation and required earlier uncommitted runtime dependencies into an isolated source snapshot. Retained material includes the frozen v2 rubric/evidence reconstruction, deterministic scorer, existing-job API integration, Android validation/cache/controller, automatic selected-recording scoring, direct advice/evidence, shared score colors and Home statistics. Existing v1 evidence/measurement helpers remain runtime dependencies; experiment runners, grouped-feedback schemas and unrelated cue/navigation/reliability changes are excluded.
- **Errors and revisions:** Mixed source/test files include only reviewed scoring hunks. A candidate-test edit removed an unnecessary historical grouping-model assertion while retaining scoring/singleton independence checks. Independent AI review found a missing explicit Retry for rejected source assessments in slide/composed views; Codex added a narrow UI gate and regression, then passed final mobile checks with 494 tests. Repair cost was not recorded.
- **Verification:** The isolated snapshot was tested independently of unrelated local changes. Included files, exact checks, separate AI review and remaining limits are recorded in [the source-snapshot report](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/presentation-scoring-source-verification.md).
- **Human decisions and preservation:** Seoyeon authorized committing the complete scoring implementation and dependencies. Original index/staged snapshots were saved locally before history changes; unrelated staged entries and working-tree content were preserved. This task made no live AI calls, push, merge, deployment or device update. Commit authorization does not establish teammate approval or real-provider usefulness; human code edits are not recorded.

<a id="record-136"></a>

<a id="i2-retained-features-integration-october-17-2026"></a>

### Retained features integration October 17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

User request:

> Step 2 and older scoring experiments are discontinued. No longer needed. Can even delete from history. Step 1, navigation and layout changes and cue and feedback reliability should be applied to app and committed as well.

- **Human decisions:** Seoyeon discontinued Step 2 and older scoring experiments, and authorized applying/committing Step 1 compact feedback context, navigation/layout and cue/feedback reliability. Human functional acceptance remains separate from commit authorization.
- **Output and use:** Codex preserved completed scoring, integrated the retained implementations, removed obsolete experiment runners, grouping runtime and superseded records, and used ordinary commits without rewriting history. Five earlier evidence/measurement helpers remain because active v2 scoring imports them. The applied membership migration remains inert for schema consistency.
- **Verification:** Codex checked actual saved-data dependencies read-only; no grouped snapshots or membership rows existed in the known local datasets. Focused/full mocked checks and separate AI review are recorded in [retained-features verification](../../../testing/evidence/retained-features-verification-2026-10-17.md). No architecture restart, paid inference, shared-data mutation, push, merge or live deployment occurred in this task; no new grouping or experiment was introduced.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- **Human decisions:** Seoyeon discontinued Step 2 and older scoring experiments, and authorized applying/committing Step 1 compact feedback context, navigation/layout and cue/feedback reliability. Human functional acceptance remains separate from commit authorization.
- **Output and use:** Codex preserved completed scoring, integrated the retained implementations, removed obsolete experiment runners, grouping runtime and superseded records, and used ordinary commits without rewriting history. Five earlier evidence/measurement helpers remain because active v2 scoring imports them. The applied membership migration remains inert for schema consistency.
- **Verification:** Codex checked actual saved-data dependencies read-only; no grouped snapshots or membership rows existed in the known local datasets. Focused/full mocked checks and separate AI review are recorded in [retained-features verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/retained-features-verification.md). No architecture restart, paid inference, shared-data mutation, push, merge or live deployment occurred in this task; no new grouping or experiment was introduced.

<a id="record-137"></a>

<a id="i2-first-recording-review-navigation-october-16-2026"></a>

### First-recording review navigation October 16, 2026

Retained behavior: the first saved take opens Full Review; subsequent takes use
slide review. Keep/Overwrite, selected-slide return routing, the persistent Full
Review button and header-aware scrolling preserve the existing recording source.
The navigation fixes and their regression tests are integrated in the retained
feature task above, rather than replaced by the scoring implementation.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

#### Review navigation after saved recordings — historical supplement, October 16–17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex, recorded `source=vscode`, with a nested AI reviewer · **Model:** `gpt-6.1-sol` in all three original turn-context records; serving variant not independently verified.

- **Scope/provenance:** The user confirmed this Mac contains only Seoyeon's project sessions; ownership is not inferred from session IDs. October 16, 23:45:53–October 17, 00:02:41, 2026, `Asia/Seoul`; extracted October 20. The source's filename/session-metadata ID disagreement remains unresolved and unmodified. This interactive task is distinct from Jaewon's [earlier redesign](../jaewon/iteration-2.md#i2-review-and-full-review-redesign-october-15-2026); that attribution is unchanged.
- **Generated/retained work:** The first saved take opens Full Review and later takes open slide Review; manual entry uses the durable counter and Stop/recovery uses the new count. The Full Review action stays beneath the title while the body scrolls. Back/Keep/Overwrite paths retain valid slide selection, including older audio and restored comparisons. Historical changes affect `mobile/src/screens/RehearseScreen.tsx`, `ReviewScreen.tsx`, `FullReviewScreen.tsx`, `CompareScreen.tsx` and navigation tests. No backend, native dependency or storage-schema change was part of this patch.
- **Errors/revisions:** Original focused regressions failed before routing/header/selection repairs. A separate AI reviewer found Back and mixed/restored-comparison selection defects; the agent reproduced and fixed them. Automatic approval review rejected an optional phone SQLite/WAL copy as excessive extraction; that command did not run (record 283). The historical verification note states no extraction workaround was used.
- **Original checks, not rerun now:** Tool-result record 370 shows 429 tests passed, zero failed/skipped, and Android JavaScript export successful, both exit 0. The check/export commands ran in record 349, were polled in 367 and returned their results in 370. Final `git diff --check` exited 0 (464). Records 395 and 418 are ADB/documentation results, not additional test/export runs. The original verification note records TypeScript passing, zero ESLint errors and the existing `useSegmentPlayer.ts:108` cleanup-ref warning. Capture/player boundaries were mocked; backend checks were not rerun.
- **Original device evidence/limits:** ADB taps/screenshots and the historical note document existing Galaxy S23 Ultra navigation: later-take slide Review, the fixed Full Review action during scrolling, and a slide-2 Full/slide Review/Back/rehearsal round trip retaining selection. No fresh recording, real Keep/Overwrite decision, transcript edit or generation request was made. Images were not copied/re-emitted for this extraction. These were agent checks, not human acceptance or microphone/provider proof.
- **Revision/retention:** Historical working tree `it2/integration-ai-nakajima`, base `b94d233553ffd7c0797836576c4af1abaaa94548`; tests: `mobile/tests/review-navigation.test.mjs`. Its verification note `docs/review-navigation-verification.md` remains untracked. The original session records no commit/push. The later [retained-features integration](#retained-features-integration-october-17-2026) and retained behavior above document subsequent integration; the recovered session alone does not establish final revision inclusion. The user later reported no manual code edits for Iteration 2; human acceptance of this specific patch remains unconfirmed.

##### Actual substantive inputs — verbatim and in source order

Four substantive input events follow. The structured-answer wrapper and two AI-plan replays are labelled; their text is not counted as independently human-authored.

**Initial task request — 2026-10-16 23:45:56 KST**

````text
First recording should route review button to full review screen. Subsequenct reviews should route to that slide's review screen. Also make the full revirew button on the slide review screen less hiddena /plan
````

**Structured clarification answer (UI-generated reply wrapper with user selections) — 2026-10-16 23:47:39 KST**

````text
<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_fc010aa71ea247cf80d34a42c5279072\",0]","question":"Should Full Review remain the Review button’s destination while a presentation has only its first saved recording?","answer":"Yes—first recording → Full Review; after another recording → slide review (Recommended)"},{"questionItemId":"[\"request_user_input_async\",\"call_fc010aa71ea247cf80d34a42c5279072\",1]","question":"Should the same rule also apply when Stop automatically opens review after saving a recording?","answer":"Yes—use the same destination after Stop (Recommended)"}]
</send_user_message_question_reply>
````

**User-role replay of the AI-authored proposed plan; not human-authored plan text — 2026-10-16 23:48:51 KST**

````text
\<proposed_plan> # Plan &#x20;

Make review navigation follow the recording sequence and make Full Review easy to find from slide review.

## Scope

- First saved recording per presentation: **Stop and Review → Full Review**, including recordings stopped early.
- After another recording: **Stop and Review → the relevant slide’s review**.
- Keep recording storage, AI processing and backend contracts unchanged.

## Action items

- Use the existing per-presentation saved-take counter for one shared routing rule. Reopening Review does not change the destination; keeping an older take does not reset the counter.
- Apply that rule after saving, when tapping Review, and when recovering an interrupted recording. Navigate without waiting for AI analysis.
- Preserve retake comparison: show Keep/Overwrite when required, then open the relevant slide review after confirmation. Cancel/Back keeps the existing recording and returns to rehearsal.
- Move **Full Review** into a prominent, fixed action below the slide-review title, outside the scrolling transcript and feedback. Use the existing theme, review icon and an accessible touch target; remove the buried duplicate.
- Preserve return navigation and slide selection: Full Review opened from rehearsal returns there; Full Review opened from slide review returns to that slide. Stop playback when switching.
- Add tests for first and subsequent recordings, partial recordings, reopening/restarting, Keep/Overwrite, rejected retakes, and whole-presentation redos.
- Verify the Full Review action stays visible with long transcripts and feedback. Run `npm run check`, `npm run bundle:android`, and Android navigation checks; record results and obtain independent review.

## Defaults

“First” means the first saved recording for that presentation, regardless of slide coverage. Later whole-presentation redos also follow the subsequent-recording rule. Preserve existing local documentation edits; commit and push remain separate actions.\
\</proposed_plan>
````

**Implementation request containing the user-approved AI-authored plan — 2026-10-16 23:51:36 KST**

````text
PLEASE IMPLEMENT THIS PLAN:
# Plan

Make review navigation follow the recording sequence and make Full Review easy to find from slide review.

## Scope

- First saved recording per presentation: **Stop and Review → Full Review**, including recordings stopped early.
- After another recording: **Stop and Review → the relevant slide’s review**.
- Keep recording storage, AI processing and backend contracts unchanged.

## Action items

- [ ] Use the existing per-presentation saved-take counter for one shared routing rule. Reopening Review does not change the destination; keeping an older take does not reset the counter.
- [ ] Apply that rule after saving, when tapping Review, and when recovering an interrupted recording. Navigate without waiting for AI analysis.
- [ ] Preserve retake comparison: show Keep/Overwrite when required, then open the relevant slide review after confirmation. Cancel/Back keeps the existing recording and returns to rehearsal.
- [ ] Move **Full Review** into a prominent, fixed action below the slide-review title, outside the scrolling transcript and feedback. Use the existing theme, review icon and an accessible touch target; remove the buried duplicate.
- [ ] Preserve return navigation and slide selection: Full Review opened from rehearsal returns there; Full Review opened from slide review returns to that slide. Stop playback when switching.
- [ ] Add tests for first and subsequent recordings, partial recordings, reopening/restarting, Keep/Overwrite, rejected retakes, and whole-presentation redos.
- [ ] Verify the Full Review action stays visible with long transcripts and feedback. Run `npm run check`, `npm run bundle:android`, and Android navigation checks; record results and obtain independent review.

## Defaults

“First” means the first saved recording for that presentation, regardless of slide coverage. Later whole-presentation redos also follow the subsequent-recording rule. Preserve existing local documentation edits; commit and push remain separate actions.

````

##### Retrospective extraction evidence

- Retained original input records: 8, 75, 111, 126. Automatic open-page/agent-environment messages (109, 363) and thirteen developer instructions are excluded.
- The historical verification note was located and compared with the original source. Execution claims retained above were checked against actual command/result records; a statement written into that note is not proof of another test run. Its inspected documentation copy has SHA-256 `838f13e7dbc4b5f2e9d2546d40397442c61663189893a44b39deb31364f43102`; this is not a raw-session hash or a committed artifact.
- Focused historical extraction only. Full-history coverage, owner privacy approval and contributor confirmation remain pending; no fresh app tests were run.

<a id="record-139"></a>

<a id="i2-scribe-only-application-integration-october-17-2026"></a>

### Scribe-only application integration (October 17, 2026)

**Contributor:** Seoyeon · **Tool:** OpenAI Codex desktop · **Model:** not recorded

**Initial context:** Integrate the complete reviewed scoring application with main's Scribe transcription, with final human inspection before commit. Provider calls were prohibited for this initial mocked implementation/review snapshot; later authorized live testing and publication are recorded below.

#### Actual requests and decisions

Initial request, verbatim:

> We should compare our current implementation we have to main, if im correc tmain has new transcription model that is not whispr. We should implement that feature and pr. All other things ui ai feedback should remain the way it is with our version not mains

Planning follow-up, verbatim:

> plan the scope

PR-scope selection, verbatim tool answer:

> Our full app → main (Recommended)

Detailed Scribe-only refinement, verbatim excerpts (not the complete long request):

> Integrate our complete current OutLoud implementation with `main`, replacing **OpenAI Whisper transcription with ElevenLabs Scribe v2 exclusively**.
>
> **This is a transcription-provider replacement, not an application redesign.**
>
> Our `codex/presentation-score` branch is the authoritative source for all application functionality, UI, scoring, feedback, navigation, Q&A, and reliability behavior.

> OutLoud has not been deployed. Historical development data and Whisper backward compatibility are unnecessary.

> The final deliverable is a fully tested, independently reviewed integration branch and PR targeting `main`, without merging or deploying it.

Branch-name selection resolving creation/push naming, verbatim tool answer:

> integration/ai-feedback-with-scribe (Recommended)

Approved execution request, verbatim:

```text
PLEASE IMPLEMENT THIS PLAN:
# Integrate our OutLoud app with Scribe-only transcription

## Summary

Deliver **our complete `codex/presentation-score` implementation with ElevenLabs Scribe v2 replacing Whisper exclusively**. Normalize transcription at the provider boundary so existing scoring, feedback, corrections, Q&A, playback, and navigation continue using their current contracts.

Use **`integration/ai-feedback-with-scribe`** consistently for the integration branch, push, and PR, as confirmed.

## 1. Branch integration and preservation

- Refresh `origin/main` and record both source revisions. Verify our branch contains the intended scoring, Step 1, navigation, layout, cue, and feedback reliability work before merging. Inspect staged, unstaged, and untracked source for missing dependencies; report any required unfinished work before including it.
- Create the isolated integration branch from `origin/main`, then merge `codex/presentation-score` into it, retaining both histories.
- Resolve application conflicts using our implementation. Retain main’s Scribe functionality and adapt it to our application rather than importing main’s older screens or workflows.
- Compare the integrated tree against our baseline. Establish a transcription compatibility allowlist; application source outside it must remain unchanged.
- Preserve existing worktrees, staging backups, unrelated changes, and historical migration files. Do not restore discontinued Step 2 or scoring experiments.

## 2. Scribe-only transcription boundary

- Use only `elevenlabs / scribe_v2`, configured through backend `ELEVENLABS_API_KEY`, with the existing HTTPX dependency.
- Remove Whisper request construction, historical receipt decoding, transcription provider selection, and fallback logic. Keep OpenAI dependencies and configuration required by existing feedback, scoring, and Q&A evaluation.
- Retain main’s deterministic vocabulary extraction from visited slides, capped at 100 hints, private submitted-option snapshots, and PDF extracted-text NUL handling.
- Normalize Scribe into the existing `{text, words: [{text, start_ms, end_ms}]}` transcript contract. Preserve recognized fillers, original audio, integer-millisecond timing, existing timestamp validation, and slide alignment.
- Preserve no-speech gating, repeated and zero-duration visits, saved Scribe transcript reuse, duplicate prevention, interruption recovery, cooldowns, and explicit uncertain-charge recovery. Make no automatic provider retries.
- Restrict public transcription provenance validation to the Scribe identity, retaining the existing null provenance states before a provider request. Reject unsupported identities without introducing Whisper compatibility paths.

## 3. Database and consent

- Preserve main’s `0007_provider_request_options` and our migration chain through `0010_slide_review_membership`.
- Add one minimal merge migration joining those histories. Set transcription request defaults to Scribe through additive migration-state changes; do not rewrite committed migrations or migrate historical transcripts.
- Verify one valid migration leaf and reliable fresh initialization. Do not reset development data, migrate shared databases, or add historical upgrade/recovery work.
- Use fresh Scribe-specific consent covering audio and vocabulary hints derived from visited slides. Do not migrate or accept old OpenAI transcription consent.
- Apply consent checks to our existing recording and durable Q&A transcription entry points. Saved-result reads and status polling remain available without consent.
- In Q&A, Cancel preserves the pending answer; Continue resumes the same answer identity. Keep existing dialogs, styling, retry confirmation, and workflow structure.

## 4. Verification and regression gates

- Test Scribe request construction, visited-slide-only hints, the 100-hint limit, fillers, timestamp normalization, malformed responses, no-speech results, provider failures, duplicate submissions, uncertainty, and worker interruption.
- Verify saved Scribe receipts/transcripts recover without another provider submission; verify no Whisper fallback exists.
- Run existing application regressions for automatic overall/per-slide scoring, rubric arithmetic, singleton feedback, compact context, corrections and staleness, durable Q&A, navigation, recording/playback, evidence links, zero-duration/repeated visits, and saved assessments.
- Run the full backend suite, Django system checks, migration consistency/drift checks, and fresh SQLite/PostgreSQL migration checks using disposable databases.
- Run mobile `npm run check`, Android export, and affected Android emulator flows with mocked inference.
- Use mocked providers throughout. Explicitly document unavailable checks; do not infer device or live-provider success from exports or unit tests.

## 5. Review and PR delivery

- Review the complete diff against our scoring baseline, confirming unchanged application behavior outside the approved transcription compatibility scope.
- Obtain independent code review, fix actionable findings, and rerun affected checks.
- Update API/setup documentation and AI-use evidence, clearly distinguishing current verification from historical results.
- Present the reviewed diff, test results, included dependencies, and remaining limitations for final inspection. **Stop before committing until review approval.**
- After approval, commit intended changes, push `integration/ai-feedback-with-scribe`, and open a PR targeting `main` titled **“Integrate complete OutLoud application with ElevenLabs Scribe v2 transcription.”**
- Do not merge the PR, deploy, alter shared databases, rewrite history, delete worktrees/backups, modify secrets or running services, or make paid provider calls.
```

#### Incorporated work and verification

- AI retained our complete reviewed application and adapted main's Scribe boundary to Scribe-only identity/normalization, joined both migration histories, and added necessary durable-Q&A consent checks and regression tests. Scoring formulas, feedback prompts, corrections, navigation and layouts were preserved. Final evidence is maintained in [the integration verification record](../../../testing/evidence/scribe-only-integration-verification-2026-10-17.md).
- Human decisions: current app takes precedence; historical Whisper compatibility explicitly rejected; integration branch name confirmed; final inspection required before commit. Human code edits or device testing for this integration: not recorded.
- Errors/revisions: initial mechanical indentation edit and consent effect lint error were corrected before full checks; a new renderer fixture initially populated an unused mock, then switched to the real validated review cache. These were implementation/test-fixture mistakes, not fabricated provider success.
- Provider calls in the initial review snapshot: prohibited and blocked/mocked throughout. Earlier dated Scribe provider checks remain historical evidence only. Commit, push and PR awaited the explicit final inspection gate; the subsequent authorized live validation and publication below supersede this dated restriction.

**Initial review snapshot, October 17, 2026:** 554 SQLite backend tests OK (24 expected PostgreSQL-only
skips), 554 disposable PostgreSQL tests OK (zero skips), fresh migrations/system/drift
checks passed, 549 mobile tests/typecheck/lint passed (one existing warning), Android
export passed with 112 exact embedded application sources. Independent review found
no introduced correctness defects. A separate Internet-disabled mock emulator APK
verified consent cancellation, one same-ID submission after continuation and saved
result restoration after test consent revocation. No paid calls or physical-phone
update occurred. Existing Q&A AppState polling limitations remain unchanged; native
microphone/live-provider/real worker-kill acceptance is unverified. Final human
inspection was pending at this snapshot; no commit, push, PR or merge into main
had occurred then. These 549-mobile-test/554-backend-test results belong to the
pre-cleanup snapshot; later cleanup and publication evidence is recorded below.

#### Authorized Scribe live phone test — October 17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

User request: “Lets test live scribe and physical phone behavior open .env for me
to input elven labs api key”, followed by “saved”.

- **Human decisions:** Seoyeon authorized live Scribe and physical-phone testing after the mocked review and saved the ElevenLabs key in the ignored backend environment. Codex checked presence without displaying the value; this approval superseded the initial task's prohibition for these Scribe tests only.
- **Output and verification:** In an isolated API/database/worker runtime, Codex verified a real normalized Scribe transcript, saved-receipt reuse, visited-slide hints, unchanged source audio and client validation. A separately built production-source-verified release was installed on the Galaxy S23 Ultra without clearing data. Agent-operated native checks observed PDF import, capture/slide navigation, Scribe consent/transcription, saved-audio playback/highlighting and restored statistics.
- **Costs and limits:** Exactly two paid Scribe submissions covered the synthetic backend case and physical-phone capture; other inference was disabled. Surrounding audio dominated the microphone check, so human recognition accuracy and live feedback/scoring/Q&A quality remain unverified. No real worker process-kill result is claimed.
- **Preservation and status:** No application source changed; original reviewed staging stayed intact and new evidence notes were unstaged at this handoff. No commit or push occurred in this test task. See [dated live/device evidence](../../../testing/evidence/scribe-only-integration-verification-2026-10-17.md#subsequent-authorized-live-scribe-and-physical-phone-check--october-17-2026).

#### Detailed implementation handoff — October 17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

User request: “Make a file describing in detail everything that was implemented.”

- **Output and use:** Codex created [the implementation handoff](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/outloud-implementation-handoff.md) covering the complete authoritative application, automatic scoring/Step 1/reliability, Scribe-only adaptation, source/API map, branch origins, verification and remaining delivery limits. It distinguishes committed scoring/retained features, the then-staged Scribe integration, actual live checks and unresolved limits.
- **Verification:** Facts were checked against current application source, Git ancestry, existing contracts and recorded review/test/device artifacts. Local links/anchors and documented file locations were checked. This documentation task ran no application builds/tests or provider calls and changed no runtime source.
- **Human decision and status:** Seoyeon requested the detailed handoff. Original staged implementation stayed unchanged; the handoff remained unstaged for user review at this snapshot. No commit or publication occurred in this documentation task; later publication below supersedes that delivery state. Human code edits or acceptance are not recorded.

#### Approved cleanup and Scribe integration PR delivery — October 17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex · **Model:** not recorded

- Actual prompt: “delete abd e and the make a pr of the integration”.
- Decision: remove audit groups A/B/D and E's seven unused PNGs; retain C, editable
  SVG originals, design duplicates/exports/history, shared scoring dependencies and
  committed migrations. The user authorized commit/push/PR delivery after review.
- Output and use: removed unused scaffold/UI files and the orphan ring's dedicated
  test, cleaned its test stubs, deleted unused raster artwork, corrected README's
  stale provider summary, and retained the requested implementation handoff.
  Remaining backend/mobile runtime source is byte-identical to the reviewed
  integration; prior unchanged-backend full-suite/database and dated device
  evidence are reused with their original limits.
- Verification: 548 mobile tests/typecheck/lint and Android export passed; current
  Django system/drift checks passed. Independent final staged review found no
  blocking findings and independently passed 73 focused mobile tests. Its source
  reconstruction and export checks matched 233 remaining source files and 112
  embedded application sources. Subsequent pre-publication changes only formatted
  Markdown metadata and recorded these outcomes; they did not change runtime source.
  Human teammate/usefulness review remains pending.
- Actual clarification: “no merge just pr”. Publication is limited to the
  integration branch and an unmerged PR; main remains unchanged.
- Preservation: pre-cleanup index/patch/files saved privately; no service,
  credential, database, unrelated checkout, worktree or history rewrite. No paid
  inference, new device/service operation, shared-data change or deployment occurred
  in cleanup/publication.
- Publication result: the reviewed integration was committed and pushed at
  `4c6ce95d95a6a3604efb96dbd188e381496153ec` on
  `integration/ai-feedback-with-scribe`. [PR #31](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31)
  targets `main` at base `5aed316` and remains open/unmerged as verified October 17,
  2026. This supersedes the earlier pending-commit/push/PR snapshots; it does not
  establish human functional acceptance, teammate approval or deployment. The
  user's no-merge instruction remains in force.

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- AI retained our complete reviewed application and adapted main's Scribe boundary to Scribe-only identity/normalization, joined both migration histories, and added necessary durable-Q&A consent checks and regression tests. Scoring formulas, feedback prompts, corrections, navigation and layouts were preserved. Final evidence is maintained in [the integration verification record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/scribe-only-integration-verification.md).
- Human decisions: current app takes precedence; historical Whisper compatibility explicitly rejected; integration branch name confirmed; final inspection required before commit. Human code edits or device testing for this integration: not recorded.
- Errors/revisions: initial mechanical indentation edit and consent effect lint error were corrected before full checks; a new renderer fixture initially populated an unused mock, then switched to the real validated review cache. These were implementation/test-fixture mistakes, not fabricated provider success.
- Provider calls in the initial review snapshot: prohibited and blocked/mocked throughout. Earlier dated Scribe provider checks remain historical evidence only. Commit, push and PR awaited the explicit final inspection gate; the subsequent authorized live validation and publication below supersede this dated restriction.

- **Human decisions:** Seoyeon authorized live Scribe and physical-phone testing after the mocked review and saved the ElevenLabs key in the ignored backend environment. Codex checked presence without displaying the value; this approval superseded the initial task's prohibition for these Scribe tests only.
- **Output and verification:** In an isolated API/database/worker runtime, Codex verified a real normalized Scribe transcript, saved-receipt reuse, visited-slide hints, unchanged source audio and client validation. A separately built production-source-verified release was installed on the Galaxy S23 Ultra without clearing data. Agent-operated native checks observed PDF import, capture/slide navigation, Scribe consent/transcription, saved-audio playback/highlighting and restored statistics.
- **Costs and limits:** Exactly two paid Scribe submissions covered the synthetic backend case and physical-phone capture; other inference was disabled. Surrounding audio dominated the microphone check, so human recognition accuracy and live feedback/scoring/Q&A quality remain unverified. No real worker process-kill result is claimed.
- **Preservation and status:** No application source changed; original reviewed staging stayed intact and new evidence notes were unstaged at this handoff. No commit or push occurred in this test task. See [dated live/device evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/scribe-only-integration-verification.md#subsequent-authorized-live-scribe-and-physical-phone-check--october-17-2026).

- **Output and use:** Codex created [the implementation handoff](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/outloud-implementation-handoff.md) covering the complete authoritative application, automatic scoring/Step 1/reliability, Scribe-only adaptation, source/API map, branch origins, verification and remaining delivery limits. It distinguishes committed scoring/retained features, the then-staged Scribe integration, actual live checks and unresolved limits.
- **Verification:** Facts were checked against current application source, Git ancestry, existing contracts and recorded review/test/device artifacts. Local links/anchors and documented file locations were checked. This documentation task ran no application builds/tests or provider calls and changed no runtime source.
- **Human decision and status:** Seoyeon requested the detailed handoff. Original staged implementation stayed unchanged; the handoff remained unstaged for user review at this snapshot. No commit or publication occurred in this documentation task; later publication below supersedes that delivery state. Human code edits or acceptance are not recorded.

<a id="record-140"></a>

<a id="i2-consolidate-ai-collaboration-records--october-17-2026"></a>

### Consolidate AI collaboration records — October 17, 2026

**Contributor:** Seoyeon · **Tool:** OpenAI Codex with documentation subagents · **Model:** not recorded

- **Human decisions:** Seoyeon requested consolidation into the collaboration logs, correction of `AGENTS.md`, and correction of the latest PR's AI-use records in the existing reporting format. Publication is limited to updating [PR #31](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31); the earlier no-merge instruction remains in force. Human code edits and teammate approval are not recorded.
- **Output and use:** Codex compared all 219 lines of the duplicate `docs/ai-use.md` at PR head `4c6ce95` with the active log and merged missing facts into the corresponding task entries. Existing requests stay verbatim. Added details include the Phase 3 commit, scoring Retry repair, retained-feature boundaries, authorized Scribe/device checks, handoff, cleanup review and actual PR publication. The duplicate file is removed; shared instructions and the reporting guide prohibit recreating it, including pointer-only files, and the implementation handoff links to this log. Historical references inside quoted plans remain quotations. The separate older prototype checkout receives its own local documentation consolidation while its app changes remain untouched.
- **Errors and revisions:** Agents continued using a retired log: the prototype carried older instructions, and the integration recreated a pointer file that accumulated task results. Seoyeon identified the inconsistency. Codex corrected the destinations and preserved dated pending/restricted states alongside the later authorization and publication that superseded them. Earlier implementation checks remain tied to their original snapshots.
- **Verification:** Coverage checks account for all 48 source blocks and 219 source lines. All 214 original fenced blocks, 65 blockquoted items and 28 curly-quoted strings remain unchanged; 133 relative file/heading links pass. The initial consolidation diff contained only five intended documentation paths, with mobile/backend source unchanged. A separate documentation reviewer initially reported no actionable findings; the subsequent audit below found four documentation issues. The quotation checker mishandled four-backtick fences and initially excluded indented fences from its count; Markdown-aware parsing now covers both. This correction runs no application builds/tests, provider calls, device operations or database changes; earlier runtime validation retains its original limits. Human functional acceptance remains pending.

#### Prompts — verbatim, in order

```text
why are we still using ai-use.md? i thought we decided on only recording on ai-collaboration
```

```text
then consolidate the extra entries into ai-collaboration and update AGENTS.md so we stop using ai-use.md
```

```text
our most recent pr only upadated ai _use not ai collaboration as it should have. update so all the data that was updated on ai use goes inot ai collaboration with the correct format
```

#### Follow-up verification — October 17, 2026

- **Scope and verification:** Seoyeon requested a second check of PR #31's original AI-use data against the collaboration log. Codex and two separate documentation reviewers checked published head `1f70dd6` against the 219-line source at `4c6ce95`. All 48 source blocks' task facts and 19 referenced paths remain; no consolidation-introduced duplicate task or prompt was found. A Markdown-aware check preserved all 214 original fenced blocks, 65 blockquoted items and 28 curly-quoted strings; 133 relative links passed. No application checks, provider calls or human acceptance test ran.
- **Findings and limits:** At the audited `1f70dd6` snapshot, source coverage passed but formatting/duplication needed correction. Landscape task metadata/request/output were split across unrelated sections, and Phase 4 repeated its publication restriction; both predated consolidation. The scoring Retry repair lacked explicit `not recorded` repair-cost metadata, and the verification note counted 189 original fenced blocks rather than 214. No repair cost was available and no missing prompt was reconstructed. These findings were pending at this audit snapshot; the authorized corrections are recorded below.
- **Status:** This audit was initially recorded locally without a commit or PR update. The subsequent request below authorizes publishing its documentation corrections to PR #31; no merge or application change is authorized.

Follow-up request, verbatim:

```text
Double check that all the ai-use data from PR #31 is in ai-collaboration in the correct format, with nothing missing or duplicated.
```

#### Four audit corrections — October 17, 2026

- **Human decision:** Seoyeon authorized fixing the four audit findings and updating PR #31, preserving original prompts and leaving the PR unmerged.
- **Output and use:** Codex reunited Landscape's metadata, actual request and implementation/verification notes under its existing task heading. Historical source identifies the two stranded phone-decision prompts with the earlier transcription/branch task; they now sit together under that task with its original unconfirmed contributor. Codex removed the repeated Phase 4 publication restriction, marked scoring repair cost as `not recorded`, and corrected the original fenced-block count from 189 to 214.
- **Verification:** Exact-byte checks preserved all 217 previously published fenced blocks and the local audit request, plus all 65 blockquoted items and 28 curly-quoted strings; the only added prompt is the authorized fix request below. The intact Landscape entry matches `5aed316`; all 48 source-coverage destinations and 133 relative links pass, with no duplicate task headings or newly duplicated substantive paragraphs. A separate documentation reviewer found no actionable findings; whitespace and one-file scope checks pass.
- **Limits:** This correction changes documentation only; no application checks/builds, provider calls, device operations or human acceptance test are performed. Repair cost is not recorded.

Request, verbatim:

```text
Fix those four issues and update PR #31. Keep the original prompts unchanged and don't merge it.
```

**Historical source supplement — `published-wiki-i2`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

The Injoon entries below were recovered from local Codex history on October 21. Automated browser context and attachment-path wrappers are omitted; structured replies retain the actual answer text. Prompts are listed in time order within each task, with their recorded timestamps. No missing wording was reconstructed.
