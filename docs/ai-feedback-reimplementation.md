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
Transcription completes
  └─ start(): reuse or create a FeedbackRun for these inputs
       └─ worker run():
            1. code: sentences, measurements, slide plan              (<1 s)
            2. LLM, in parallel: one call per gradable slide + one whole call
            3. each part is saved as it finishes (app shows progress)
            4. code: Rubric V2 points, overall score, point gains
```

| Decided by code | Decided by the model |
| --- | --- |
| Sentences and their timestamps; accepted corrections applied | Level for each criterion, with reason and evidence |
| Title/closing slides not graded (first or last slide with a title/closing profile, or 8 words of text or fewer) | Whether each Must Cover point was covered, partly covered or missed |
| Unvisited slides (`not_recorded`) and slides with fewer than 5 words (`insufficient_speech`) | What to do to reach the next level (`next_level`) |
| Measurements: time vs target, pace, pauses, fillers, repetition | Up to 3 improvements per slide: problem, action and an example to say |
| All points, rounding, overall score, withheld reasons | Whole-talk top 3 priorities and summary |
| Points each improvement would add (`gain_slide_points`, `gain_overall_points`) | |

**Reliability.** Each call retries timeouts, connection errors, 429/5xx responses and cut-off or invalid JSON up to twice. A cut-off retry doubles the output budget; a content-filter stop is not retried. No call starts or retries after 240 s, keeping the run inside the 300 s task limit. The whole-presentation call is submitted first because it is the largest. A failed part never discards finished parts, and a run is `failed` only when every model-graded part has failed. Retry re-runs only failed parts. The beat scheduler republishes lost queue messages after 120 s and requeues a run whose worker stops reporting for 330 s, up to 3 times. If the inputs change before the worker starts, the run becomes `stale` without any model call, and a replacement run is queued for the current inputs.

**Evidence.** The model cites sentence ids (`s12`); the server maps them to original timestamps for playback. A slide can cite only its own sentences. The whole call can also cite measurement ids (`m:pace`). Unknown ids are dropped without failing the part.

**Inputs.** Only text goes to the model: slide text, the cached slide profile when one exists, speech sentences and measurements. No images or audio. A missing profile never blocks feedback.

## Scoring (Rubric V2)

- Slide score = (40E + 35D + 25C) / 3, with E, D and C as level units 0–3.
- Whole score = 25 × (u1 + u2 + u3 + u4) / 3.
- Overall = 0.70 × mean of applicable slide scores + 0.30 × whole score. Exact fractions; one half-up rounding when published.
- The overall score is withheld when an applicable slide is unscored or a whole criterion has no level. `scores.withheld` gives the reason and the 0-based indexes of those slides.
- `insufficient_evidence` (the model judged there was too little speech) is final for those inputs; Retry does not re-run it. Re-recording the slide with more speech is the fix.

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

Run `status`: `queued`, `running`, `completed`, `failed`, `stale`. A completed run can still contain failed parts. Part `status`: `pending`, `scored`, `insufficient_evidence`, `not_applicable`, `not_recorded`, `insufficient_speech`, `failed`.

```text
{run_id, status, progress: {slides_total, slides_done, whole_done},
 scores: {overall, overall_level, slide_average, whole, withheld: [{reason, slides?}]},
 slides: [{slide_index, status, score, measurements,
           criteria: [{id, label, level, anchor, points, maximum_points, reason, next_level, evidence: [{id, start_ms, end_ms, text}]}],
           must_cover: [{point, status, evidence}], strength,
           improvements: [{criterion, problem, action, example, evidence, gain_slide_points, gain_overall_points}]}],
 whole: {status, score, criteria, top_priorities: [{title, action, why, slide_index}], summary},
 measurements, language, timings, error, enabled}
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FEEDBACK_V3_ENABLED` | `false` | Turns the pipeline on. Uses `OPENROUTER_API_KEY`. |
| `FEEDBACK_V3_AUTO_START` | `false` | Starts a run when transcription completes. Audience Q&A answer recordings are skipped. |
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

## Rollout

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Run `deploy/diagnose_feedback.py` on the VM; check CPU credits and memory | Waiting for VM output |
| 1 | Backend pipeline, API and tests | Done on this branch |
| 2 | Mobile: read `feedback-run` in Review and Full Review; show progress, next-level advice and point gains; stop starting v2 score and slide-review jobs | Next |
| 3 | Deploy with v3 off, enable it, run `deploy/smoke_feedback_v3.py`; time real rehearsals | Steps ready; not run |
| 4 | Calibration: 10–20 English and Korean recordings, each scored 5 times; targets: ≤ 3 points between runs, ≤ 5 points between languages for the same talk | Not started |

## Verification and limits

- 40 tests in `backend/rehearsals/test_feedback_v3.py` cover rubric arithmetic, sentence splitting, corrections, measurements, the retrying client (mocked HTTP, deadlines), the end-to-end pipeline with a fake model (English and Korean), retry, stale inputs, recovery, profile selection, cross-slide evidence, unexpected output shapes and auto-start. The full backend suite passes locally on SQLite: 670 tests, 26 skipped (torch/VAD packages not installed). An independent AI review found 6 substantive defects and several smaller ones; all are fixed and tested.
- No real provider call has been made. Model behavior, latency, consistency and advice quality are untested.
- Rate bands, the filler lists and the 5-word minimum are provisional.
- Migration `0012_feedback_run` was checked against the VM: the deployed plan ends at `0011`, and the deployed code has no unmigrated model changes. The v2.4 patch changed no schema.
