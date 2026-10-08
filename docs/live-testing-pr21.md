# PR #21 physical-phone live test

Target: PR [#21](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/21), feature/ai-feedback, a850424492843bf1ef19ddebd2643acefff2b9d6. Verified open and unmerged on 2026-10-08; includes its stacked prerequisites through PR #20. This is the functional restoration/review UI; the old After Hours theme and Feedback/Playback tabs are outside this PR.

The current local session additionally includes the uncommitted image-admission repair on `codex/pr21-feedback-image-size`: feedback creates bounded copies of oversized slide renders and reports source failures clearly. See the latest entry in [AI-use](ai-use.md) for the completed live feedback check.

## Session setup

- Galaxy S23 Ultra (SM-S918N), development client updated without clearing app storage. Metro serves PR #21 plus the local repair described above. The reused native APK has the same app configuration and production dependency lock as PR #21.
- Keep USB connected and the Mac awake. App API is http://127.0.0.1:8011/api. Old recordings remain on the phone; this is a fresh isolated server database. Start with a freshly imported PDF and new recording.
- OpenAI feedback uses gpt-6-luna. At the user's later testing request, the daily cap was removed and local allowances raised to 1,000 requests/minute and 1,000,000,000 app reservation units/minute. Provider limits still apply. These are test configuration values, not verified account allowances or a monetary cap. A new deck normally needs a description call and a coaching call.
- Hosted Whisper transcription remains a separate explicit action.
- Choose non-confidential test material. Analyze sends audio to OpenAI after its disclosure. Generate feedback separately discloses its provider and evidence data. No provider request was initiated during setup.

## First pass: one 60–90 second rehearsal

Use a 3–5 page PDF with ordinary text, a numeric/chart slide and an image-heavy slide. Include one deliberate factual mismatch, for example the slide says 20% but you say 50%, and one accurately explained statement as a control. Say a short distinctive phrase whenever you change slides. Navigate 1 → 2 → 1 → 3.

| Step | What to do | What to check |
| --- | --- | --- |
| 1. PDF | Import a PDF, open every page, try first/last-page navigation. Cancel the picker once. | Actual pages in correct order, readable images/text, correct page count, no sample substitution, cancellation creates no entry. |
| 2. Starting page | Open slide 2 before starting a separate short recording. | The initial recorded visit is slide 2; it does not silently reset to slide 1. |
| 3. Capture | Start, speak normally, use 1 → 2 → 1 → 3, then Stop. | Microphone indicator/timer match capture; audio is audible with complete beginning/end; duration is plausible; backward/repeated visits survive. Stop saves locally. |
| 4. Playback before analysis | Listen immediately, then leave and reopen the saved rehearsal. | Real audio and PDF remain usable before upload/transcription. New captures are separate history entries. |
| 5. Upload | Choose Upload recording. Refresh/reopen afterward. | Status reaches awaiting analysis; upload alone does not transcribe or generate feedback. No duplicate rehearsal appears after refresh/retry. |
| 6. Transcription consent | Choose Analyze recording; Cancel first if first-use disclosure appears, then choose it again and Continue. | Cancel keeps local audio and does not start analysis. Continue shows genuine queued/processing/completed or actionable failure state. Existing consent may already be retained on this phone. |
| 7. Transcript quality | Compare the transcript with what you actually said and heard. | Numbers, names, pauses, sentence endings and language switches are accurate enough; no invented speech. Note omissions and incorrect words separately from timing errors. |
| 8. Alignment and seeking | Play across each transition. Tap a word and each visit; try previous/next visit, ±5 seconds and end-of-audio. Repeat while paused and while playing. | Audio, PDF page and word highlighting agree. Visits stay 1 → 2 → 1 → 3. Seeks preserve playing/paused intent. Repeated slide visits remain separate. |
| 9. Feedback consent | Choose Generate feedback, inspect the OpenAI disclosure and Cancel once; then Generate and Continue. | Cancel submits nothing. Upload/Analyze/replay/Refresh never generate coaching implicitly. Expect describing slides, coaching, or a genuine quota/failure message. |
| 10. Feedback usefulness | Read every accepted card and expand supporting quotes. | At most three suggestions; the deliberate mismatch is assessed correctly; the accurate statement is not falsely criticized; descriptions do not invent facts. A structurally accepted card can still be wrong. |
| 11. Feedback evidence | Tap Review evidence for each card, both paused and playing. | Correct visit/page/time and corresponding spoken phrase; playback intent is retained. Slide quotes refer to the displayed saved description, not necessarily literal PDF text. |
| 12. Description correction | Expand a slide description, edit one incorrect fact and Save. | Other slides stay unchanged; the correction survives reopening; affected feedback becomes stale and stale evidence is disabled. Explicit Regenerate uses the saved transcript, without another transcription. |

## Second pass: recovery, limits and phone usability

- [ ] Record brief English, Korean and mixed-language takes. Listen for omissions near language switches, numbers and names; compare language/rate labels. Rate estimates use total rehearsal duration including silence.
- [ ] Record a silent take. Check a truthful no-speech outcome with retained audio/timing and no fabricated transcript or coaching.
- [ ] Deny microphone permission on a disposable test if it is not already granted; confirm a useful error and a successful retry after granting permission. Avoid clearing app data.
- [ ] During a short recording, separately try Android Back, Home and screen lock. Capture should stop and preserve playable audio/checkpoints. Back may retain the screen so you can listen before leaving.
- [ ] Reopen after normal app close. For an additional disposable take, force-stop during capture; recovery must be explicit and must not pretend an unfinalized/unplayable file was repaired.
- [ ] Background while playing. Playback pauses and stays paused on return. Repeat while a seek or result refresh is in progress.
- [ ] Test failed upload and retry with the API unavailable. Saved audio remains playable, error stays visible, and retry uses the same recording instead of creating a duplicate.
- [ ] Review cached media with the API unavailable, then force-stop/reopen while Metro is still available. PDF/audio/transcript/feedback should remain readable when cached; Refresh failure should retain prior results with a notice.
- [ ] Airplane mode alone does not disconnect this USB-forwarded API. For the offline tests, ask Codex to temporarily remove only the API forwarding or stop the isolated API, then restore it; keep Metro available.
- [ ] If a server-only entry is available, test Download audio for offline review and Download PDF for offline review independently, then reopen offline. Failed downloads must preserve valid existing media. This needs a suitable server-only setup; do not delete private media to manufacture one.
- [ ] Try a corrupt/encrypted/non-PDF file, an 11-slide PDF and a PDF above 20 MiB; rejection should explain the problem without adding a broken import. Use disposable files.
- [ ] After shorter tests pass, do a full-length rehearsal approaching ten minutes. Capture should stop around 9:59 before the ten-minute boundary, save, replay and upload. Check drift and missing ending audio. Audio upload limit is 25,000,000 bytes.
- [ ] Check long Korean/English text, small/large font settings, keyboard visibility during description edits, scrolling and TalkBack focus/labels. Confirm controls remain reachable.
- [ ] If a provider failure occurs, retain source audio and existing results; inspect Retry/Refresh/cooldown/uncertain-charge confirmation. Do not repeatedly press Retry merely to generate a failure case.

## Backend-assisted checks

These need request/job evidence as well as the phone UI; ask Codex to inspect after your run.

- Refresh/replay/download/cancel produce zero provider work.
- Upload retries retain attempt UUID and source hashes.
- Feedback regeneration reuses the stored transcript and cached descriptions where applicable.
- Local testing limits are relaxed; provider rate limits may still stop a request. Generation and retry remain explicit.
- Gemini-specific terminal quota-stop/retry behavior needs a separately configured Gemini session. It is not covered by this OpenAI session.
- Worker/API restart, duplicate jobs and uncertain outcomes preserve durable results without silent extra calls.

## Record each failure

Date/time (KST), deck name, rehearsal duration/history entry, steps, expected result, observed result, and approximate audio timestamp. For AI feedback, label each card helpful / incorrect / too vague and note its quoted evidence. A screenshot or short screen recording helps; omit private material and credentials.

## Setup evidence, not acceptance results

On 2026-10-08 the setup verified the remote PR head, native dependency/config match, adb install -r success, actual phone rendering, phone-originated API health HTTP 200, API readiness, real PostgreSQL migrations/system check, worker ping and successful Redis/worker recovery tasks including Beat delivery. npm run check passed TypeScript, lint and all 275 mobile tests.

The first local prefork worker failed with a Celery child-initialization ValueError; the isolated macOS worker was relaunched with --pool=solo, matching prior successful local validation, and queued tasks then completed. This runtime workaround does not validate process time-limit behavior. Metro logged manifest-asset timeout warnings; the actual app screen rendered.

No new microphone, listening, transcript-quality, live-provider, offline-recovery or human acceptance result is claimed by this setup. Product source remains unchanged.
