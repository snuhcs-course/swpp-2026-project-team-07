# AI feedback reimplementation (feedback v3)

Branch `ai-feedback-reimplementation`, based on `codex/issue-49` (`1b094a2`), the code the Azure VM runs. Started November 14, 2026. AI-assisted with Claude Code, prompted by Seoyeon; prompts and results are in the [collaboration log](ai-collaboration-prompts.md).

## Problems and causes

| Problem | Causes found in the code |
| --- | --- |
| Feedback often fails | Scoring is one large all-or-nothing call. The model cites word positions inside each visit, and one bad citation withholds criteria or slides. Reasoning tokens and a 64 KB JSON cap (raised in the unpushed v2.4 patch) cut off long or Korean outputs. Nothing retries automatically. A failed slide profile blocks scoring until someone retries it. |
| About 60 s to get results | The production worker runs `--concurrency=1`, so Scribe, profiles, each slide review, scoring and Q&A all wait in one line. The audio is decoded and checked with VAD twice. One reasoning call writes up to 12–24k tokens. The app polls and then posts again before feedback even starts. |
| Feedback does not say what to do | The prompts are mostly prohibitions. Scores and slide findings come from separate jobs, so a score never explains itself. Findings whose quotes don't match exactly are dropped. |
| Scores differ across languages | Each criterion has four abstract levels, so one level is a 13-point jump on coverage. Speaking rate counts English words but Korean space-separated word groups, over total time including silence. |

These are code findings. The [diagnostic script](../deploy/diagnose_feedback.py) checks them against VM data (see [Phase 0](#rollout)).

## Decisions (Seoyeon, November 14, 2026)

- Rebuild instead of patching the existing pipeline. Build next to it; old results stay readable.
- Score with Rubric V2 (`presentation-score-v2`, the November 13 reference) for now. The rubric is data in `feedback_v3/rubric.py` so it can change later.
- Keep OpenRouter `openai/gpt-6-luna` as the default model. Model, reasoning effort and temperature are settings.

## Design

```text
Stop recording → upload one audio file → Scribe transcribes it
  └─ start() right away (server auto-start and/or the app's FeedbackV3Host): reuse or create a run
       └─ worker run():
            1. code: sentences, measurements, slide plan              (<1 s)
            2. reuse any part whose exact inputs were already graded  (no model call)
            3. LLM, in parallel: one call per remaining gradable slide;
               the whole-presentation call on its own thread, only for a take that covers every slide
            4. each part is saved as it finishes (screens show it immediately)
            5. code: Rubric V2 points, overall score, point gains
```

Slides are not uploaded or transcribed during the presentation: each take is one continuous recording that is uploaded and transcribed after Stop (checked November 15, 2026). Per-slide feedback therefore starts immediately after that transcription, not slide by slide during the talk. Transcript corrections are optional and never gate the first feedback.

| Decided by code | Decided by the model |
| --- | --- |
| Sentences and their timestamps; accepted corrections applied | Level for each criterion, with reason and evidence |
| Title/closing slides not graded (first or last slide with a title/closing profile, or 8 words of text or fewer) | Whether each Must Cover point was covered, partly covered or missed |
| Unvisited slides (`not_recorded`) and slides with fewer than 5 words (`insufficient_speech`) | What to do to reach the next level (`next_level`) |
| Measurements: time vs target, pace, pauses, fillers, repetition | Up to 3 improvements per slide: problem, action and an example to say |
| All points, rounding, overall score, withheld reasons | Whole-talk top 3 priorities and summary |
| Points each improvement would add (`gain_slide_points`, `gain_overall_points`) | |

**Reliability.** Each call retries timeouts, connection errors, 429/5xx responses and cut-off or invalid JSON up to twice. A cut-off retry doubles the output budget; a content-filter stop is not retried. No call starts or retries after 240 s, keeping the run inside the 300 s task limit. Slide calls run in their own pool and the whole call on its own thread, so per-slide results are never queued behind it. A failed part never discards finished parts, and a run is `failed` only when every model-graded part has failed. Retry re-runs only failed parts. The beat scheduler republishes lost queue messages after 120 s and requeues a run whose worker stops reporting for 330 s, up to 3 times. If the inputs change before the worker starts, the run becomes `stale` without any model call, and a replacement run is queued for the current inputs.

**No repeated model calls.** A run is reused while its inputs are unchanged. Each part also stores a hash of exactly what the model saw (payload, model, prompt and rubric version); a new run for the same recording copies any finished part with the same hash instead of calling the model (`usage.reused_parts`). Sentence ids are slide-scoped (`s3.2` = slide 3, sentence 2), so a transcript correction on slide 3 re-grades only slide 3 and the whole presentation; undoing it re-grades nothing. Changing the audience or required time changes every slide's input, so every slide is graded again.

**Evidence.** The model cites sentence ids (`s3.2`); the server maps them to original timestamps for playback. A slide can cite only its own sentences. The whole call can also cite measurement ids (`m:pace`). Unknown ids are dropped without failing the part.

**Inputs.** Only text goes to the model: slide text, the cached slide profile when one exists, speech sentences and measurements. No images or audio. A missing profile never blocks feedback.

## Scoring (Rubric V2)

- Slide score = (40E + 35D + 25C) / 3, with E, D and C as level units 0–3.
- Whole score = 25 × (u1 + u2 + u3 + u4) / 3.
- Overall = 0.70 × mean of applicable slide scores + 0.30 × whole score. Exact fractions; one half-up rounding when published.
- The overall score is withheld when an applicable slide is unscored or a whole criterion has no level. `scores.withheld` gives the reason and the 0-based indexes of those slides.
- `insufficient_evidence` (the model judged there was too little speech) is final for those inputs; Retry does not re-run it. Re-recording the slide with more speech is the fix.
- Whole-presentation feedback runs only for a take that covers every slide. A partial take (stopped early, or a single-slide redo) gets slide feedback only; `whole.reason` and `scores.withheld` say `presentation_incomplete`.

Differences from the v2 implementation:
- A bad citation drops that citation only; it never withholds a level. The model withholds a level (`null`) only when there is too little speech.
- Code, not the model, decides which slides are not applicable.
- Delivery is graded with the measurements in view, and the prompt asks for a sentence and a measurement citation. Missing citations do not void the level.

## Measurements

Computed from Scribe word timestamps without decoding audio. Speaking time excludes silences of 1 s or more. Rate is words per minute for English and syllables per minute for Korean (embedded English words count as two syllables). Long pauses are silences of 2 s or more inside a slide. Fillers: um, uh, er, hmm and similar; 음, 어, 으, 흠, 엄. Per-slide time targets use the existing `review_timing.targets` allocation.

Comfortable-rate bands are **provisional** until calibrated: English 110–180 words/min, Korean 230–360 syllables/min.

## API

`GET /api/attempts/{attempt_id}/feedback-run/?context_id=` returns the latest run for that attempt and context, or `{"status": "absent"}`. It never starts work.

`POST /api/attempts/{attempt_id}/feedback-run/` with JSON `{"context_id": "<uuid>|null", "retry": false}` starts a run, or returns the existing run when the inputs are unchanged. `"retry": true` re-queues only failed parts. Without `context_id`, the deck's only presentation context is used, if it has exactly one.

Run `status`: `queued`, `running`, `completed`, `failed`, `stale`. A completed run can still contain failed parts. Part `status`: `pending`, `scored`, `insufficient_evidence`, `not_applicable`, `not_recorded`, `insufficient_speech`, `failed`. Statuses decided in code carry a `reason`: `title_slide_profile`, `closing_slide_profile`, `short_slide_text`, `slide_not_visited` or `fewer_than_5_words`. Scored slides and the whole part carry `level`, banded from exact points rather than the rounded score. GET also returns `outdated: true` when the stored run no longer matches the current transcript corrections, settings or slide profile; the app then requests a new run.

```text
{run_id, status, progress: {slides_total, slides_done, whole_done},
 scores: {overall, overall_level, slide_average, whole, withheld: [{reason, slides?}]},
 slides: [{slide_index, status, reason?, score, level, measurements,
           criteria: [{id, label, level, anchor, points, maximum_points, reason, next_level, evidence: [{id, start_ms, end_ms, text}]}],
           must_cover: [{point, status, evidence}], strength,
           improvements: [{criterion, problem, action, example, evidence, gain_slide_points, gain_overall_points}]}],
 whole: {status, score, level, criteria, top_priorities: [{title, action, why, slide_index}], summary},
 measurements, language, timings, error, enabled, outdated}
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FEEDBACK_V3_ENABLED` | `false` | Turns the pipeline on. Uses `OPENROUTER_API_KEY`; GET reports `enabled: false` unless the configuration is complete. |
| `FEEDBACK_V3_AUTO_START` | `false` | Starts a run the moment transcription completes, ahead of other queued jobs such as Audience Q&A. Skips Audience Q&A answers and decks with more than one settings record (the app starts those with its own settings). |
| `FEEDBACK_V3_MODEL` | `FEEDBACK_OPENROUTER_MODEL`, then `openai/gpt-6-luna` | Model for every call. |
| `FEEDBACK_V3_REASONING_EFFORT` | `low` | Blank omits the setting. |
| `FEEDBACK_V3_TEMPERATURE` | blank | Blank omits it; some reasoning models reject temperature. |
| `FEEDBACK_V3_TIMEOUT_SECONDS`, `FEEDBACK_V3_RETRIES`, `FEEDBACK_V3_MAX_PARALLEL` | `60`, `2`, `8` | Per-call timeout, retries, parallel calls. |

## Deploy to the Azure VM

`/srv/outloud` is not a Git checkout, and the production image bakes in the backend source. This branch includes the deployed v2.4 scoring patch, recovered byte-for-byte from `outloud-backend:issue49-tokenfix-r2-20261103`, so a rebuilt image keeps it. Migration `0012_feedback_run` only adds a table, and the deployed database is at `0011`.

1. On a computer with the repository: `git archive --format=tar.gz -o outloud-feedback-v3.tgz origin/ai-feedback-reimplementation backend deploy/smoke_feedback_v3.py deploy/diagnose_feedback.py`. Copy the archive to the VM's `/tmp`.
2. On the VM, in `/srv/outloud`, with the `dc` helper from the [hosting guide](azure-hosting.md#deploy-and-maintain): run `sudo bash deploy/backup.sh`. Extract the archive to `/tmp/outloud-v3`. Move any existing `backend` directory to `backend.before-feedback-v3`, then copy `/tmp/outloud-v3/backend` to `backend`.
3. `export OUTLOUD_IMAGE_TAG=feedback-v3-r1`, then `dc build api`, `dc run -T --rm --no-deps api python manage.py migrate </dev/null`, and `dc up -d api worker scheduler`. Check `dc ps` and the worker ping. Feedback v3 is still off, so the app behaves as before.
4. Add `FEEDBACK_V3_ENABLED=true` and `FEEDBACK_V3_AUTO_START=false` to `deploy/.env`, run `dc up -d api worker scheduler` again, then run `deploy/smoke_feedback_v3.py` with `dc exec -T api python manage.py shell <`. This makes real paid calls: one per gradable slide plus one whole call.
5. Set `OUTLOUD_IMAGE_TAG=feedback-v3-r1` wherever the current tag is defined, so later `dc` commands do not recreate the old image.

Rollback: `export OUTLOUD_IMAGE_TAG=issue49-tokenfix-r2-20261103 && dc up -d api worker scheduler`, and restore the tag setting. The `0012` table can stay; the old code ignores it. Worker concurrency stays at 1 for now. Raise it only after the memory check, because each worker process can load the speech-detection model.

## App integration

When the server answers `enabled: true`, the app uses v3 for Review, Full Review, its Feedback page, Home's score and the post-recording Wait screen. When it answers `false`, these screens keep the v2 scores. The answer is saved per server address and checked again once per session.

- **Starting runs:** `FeedbackV3Host` starts feedback once for each new recording as soon as its transcription completes, on any screen. It waits only for unsynchronized presentation settings and for an open Keep/Overwrite comparison. A failed start is retried after 60 s. With `FEEDBACK_V3_AUTO_START=true` the server starts it even earlier; both paths return the same run.
- **Display only:** Review, Full Review and the other screens never start generation. They read saved runs, poll every 2 s while a run is in progress (3 s while an automatic start is on its way, 5 s after a connection error), and show each slide as soon as its part finishes. A saved copy is shown offline, and an older response never overwrites a newer one.
- **Changes after feedback:** after a transcript correction or settings change, the existing results stay visible, marked out of date, with an explicit **Update feedback** action. Older recordings that never had v3 feedback show **Get AI feedback**. Failed parts show **Retry**. All three are user actions.
- **Takes:** each slide reads the run of the recording selected for that slide. The overall score is shown only when every slide comes from one recording.
- **Review:** coaching cards come first (problem, action, "Try saying" example, quoted evidence with playback, and the points the change would add), then next-level advice for criteria without an improvement. Details show each criterion's level, points, reason and next-level advice, the Must Cover checklist and the strength. Title and closing slides, ungraded slides and slides not in the take explain their status.
- **Full Review:** the overall score and per-slide tiles come from v3. Its Feedback page lists the whole-talk top priorities first, then every slide improvement ordered by overall point gain.
- **v2 jobs:** the automatic v2 slide-review and scoring hosts run only once the server is known not to offer v3, so the two pipelines never both start paid work.

## Rollout

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Run `deploy/diagnose_feedback.py` on the VM; check CPU credits and memory | Waiting for VM output |
| 1 | Backend pipeline, API and tests | Done on this branch |
| 2 | Mobile: read `feedback-run` in Review and Full Review; show progress, next-level advice and point gains; stop starting v2 score and slide-review jobs | Implemented on this branch; no APK built or device-tested |
| 3 | Deploy with v3 off, enable it, run `deploy/smoke_feedback_v3.py`; time real rehearsals | Deployed and smoke-tested (6-slide recording, 10.9 s, 6 calls); server auto-start still off |
| 4 | Calibration: 10–20 English and Korean recordings, each scored 5 times; targets: ≤ 3 points between runs, ≤ 5 points between languages for the same talk | Not started |

## Verification and limits

- 40 tests in `backend/rehearsals/test_feedback_v3.py` cover rubric arithmetic, sentence splitting, corrections, measurements, the retrying client (mocked HTTP, deadlines), the end-to-end pipeline with a fake model (English and Korean), retry, stale inputs, recovery, profile selection, cross-slide evidence, unexpected output shapes and auto-start. The full backend suite passes locally on SQLite: 670 tests, 26 skipped (torch/VAD packages not installed). An independent AI review found 6 substantive defects and several smaller ones; all are fixed and tested.
- Mobile: 7 tests in `mobile/tests/feedback-v3.test.mjs` cover parsing, per-slide selection (progress, outdated, combined recordings, withheld overall, failures), coaching-card order and the client cache, capability and deduplication. Type-check, lint and an Android JavaScript export pass. The full mobile suite shows the same 62 failures as the unchanged base branch (existing tests not updated for the issue-49 UI) and no new ones. No APK build, device test or human usability test yet.
- One real smoke run on the VM: a six-slide recording finished in 10.9 s with six model calls and no errors. Advice quality and consistency are not yet assessed.
- Rate bands, the filler lists and the 5-word minimum are provisional.
- Migration `0012_feedback_run` was checked against the VM: the deployed plan ends at `0011`, and the deployed code has no unmigrated model changes. The v2.4 patch changed no schema.
