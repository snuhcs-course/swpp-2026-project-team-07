# Issues #44–46 verification — November 3, 2026

**Implementation-stage record before publication.** See [combined v7 verification](demo-v7-combined-verification-20261103.md) for the subsequently prepared release.

Implemented in the existing demo checkout on `codex/demo-feedback-details-20261102`, preserving the earlier #35 and #36/#43 changes. No commit, push, GitHub issue update, deployment or paid evaluation was performed.

## Result

- **#44:** Full Review keeps its existing equal-width slide sections. The marker previews exact positions within slides, and release seeks through the complete selected-source queue. Idle/paused playback stays paused; playing resumes. Retakes, repeated visits, missing audio, cancelled/stale gestures, backgrounding and five-second accessibility adjustments are covered.
- **#45:** Scoring prompt v2.3 requests a specific supported issue, its communication consequence and a practical next step through the existing advice text/evidence fields. Strengths remain positive and the summary remains brief. No schema, rubric, scoring arithmetic or evidence-validator change. Historical results/receipts remain immutable; exact earlier protocols permit fresh generations through the existing workflow.
- **#46:** Per-slide labels and bar colors share an inclusive ±15% allocation rule. The reported 17/28-second slide shows Under time. Fillers are a count, unavailable text remains a dash, and assessed content/delivery without findings says No issue flagged. Existing feedback details retain all verified observations and suggestions, including timing/filler advice.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run check` from `mobile/` | Typecheck, lint and **607/607 tests passed**; one existing cleanup-ref warning |
| `npm run bundle:android -- --max-workers 2` | Passed |
| `python manage.py check --settings=config.test_settings` | Passed |
| `python manage.py test --settings=config.test_settings --noinput` | **601 tests**, passed with **25 PostgreSQL-only skips** |
| `python manage.py makemigrations --check --dry-run --settings=config.test_settings` | No changes detected |
| Independent AI review | No concrete findings; independently ran **59 focused mobile** and **40 backend** tests |
| Task whitespace/source checks | Passed; reviewed application/test hashes unchanged and unrelated tracked diffs preserved |

Backend commands used the project's existing root `backend/.venv` against this demo source; no environment installation was needed. Mobile checks reused an installed dependency tree with a byte-identical package lock through a temporary link.

New regressions were observed failing before fixes. They include within-slide seeking, retained old callbacks after a source change, misleading metric verdicts, and exact previous-protocol handling. Synthetic advice round-trips retain original quote/timestamp evidence and reject forged optional advice without changing valid scores. These checks establish implementation behavior, not real-model adherence.

## Android verification

**10/10 native checks passed** on an isolated Android 16/API 36 arm64 emulator, using the actual changed screens and native player with explicitly synthetic model/cache data and silent PCM WAV sources. Checks covered arbitrary seeking, stable paused position, resume within a repeated visit, cross-slide coordinates, playing seek intent, Under/On/Over timing, filler labels, existing actionable-advice/citation display and cited-source playback. The coordinator visually inspected the compact labels and actionable-feedback screenshots.

All six changed production mobile files matched the APK packager source map exactly. No automatic-generation host or network provider was mounted. This was a task-only QA package, not a rebuilt distributable demo APK or full-app/backend acceptance run. Retakes/missing audio, rapid/cancelled races, exact boundary/EOF cases and accessibility actions were unit-tested, not exercised natively.

The QA harness initially needed package/provider isolation corrections and reduced-motion automation settings; these were confined to its generated copy and disposable emulator. Settings were restored, the emulator stopped, and all eight original AVD disk/config files checked retained their SHA-256 and size. Detailed evidence is in `/private/tmp/outloud-issues44-46-20261103-eibm8xyq/android-qa/native-summary.json`.

## Evidence and limits

Actual prompts and task decisions are in the [Iteration 2 collaboration log](ai-collaboration-prompts-iteration-2.md). The frozen task patch, initial snapshots, source hashes, raw check logs and independent review are retained at `/private/tmp/outloud-issues44-46-20261103-eibm8xyq/`.

No physical-phone acceptance or new generated-feedback usefulness result is claimed. No real transcription, microphone capture, sound generation or customer/provider request is part of verification. PostgreSQL/Redis worker integration was not rerun for these prompt/constant-only backend changes.
