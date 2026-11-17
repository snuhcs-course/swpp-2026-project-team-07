# Phase 3 — required timing and longer recordings

Scope: `it2/feature/ai_feedback`, starting from local commit
`fb616d6cc80f3f9ec9561c7b89a827a399d24867`. Phase 4 and the presentation
requirements sheet remain held. No commit, push or merge is authorized by this task.

## Implementation

- Reuse the Phase 1 context API/client/cache. A confirmed duration is 60–1,800
  integer seconds; audience may still be missing for timing alone. Match the
  API-scoped local PDF/server deck before using its context. Missing, malformed
  or mismatched context retains JJ's legacy suggestion, never a confirmed requirement.
- Allocate using JJ's existing bounded text weights (`1 + min(80, keyword count)/40`)
  and largest fractional remainder, breaking ties by slide order. Every slide gets
  a nonnegative integer second count summing exactly to the supplied duration.
  Empty/image-only pages receive the base weight; no invented graph complexity or
  AI-generated estimate. When there are more slides than available seconds, some
  targets must be zero. An empty deck has no allocation.
- Derive timing on read without rewriting `pres:v1`, `deck:v1`, original attempts,
  selected segments or Compare snapshots. A changed duration changes current targets;
  clearing it restores saved suggestions. Audience-only changes do not change the
  allocation. Current required totals follow JJ's full/partial selected-run policy.
  Requirement writes notify model subscribers; older responses remain fenced by
  the existing revision checks. No allocation job or extra API route is needed.
- Extend existing Rehearse/Compare/Review timing consumers. The existing idle
  readout identifies `required` versus `suggested` timing. No entry control,
  requirements sheet, new screen or Review redesign is added.
- New presentation recordings use mono AAC/MPEG-4 at 64,000 bits/s in the existing durable
  document directory. Thirty minutes is approximately 14.4 MB before container
  overhead; the exact upload cap stays **25,000,000 bytes**. Existing files are
  never recompressed or deleted. Oversized legacy audio remains locally playable.
- Increase the authoritative timeline cap to 1,800,000 ms across capture,
  recovery, upload validation, VAD decoding, result/review and feedback evidence.
  Retain the existing one-second early-stop margin (request finalization at
  1,799,000 ms), codec-tail allowance, foreground interruption policy, actual
  recorder clock and repeated/backward slide visits. No chunking or audio trimming.
- Reuse the existing Whisper request/receipt/recovery pipeline, provider timeout
  and job leases. No model/migration or provider prompt/schema identity changes.
  Only private timeline bounds and derived verified playback times expand;
  original description/cue/coaching wire schemas are unchanged.

## Verification record — October 15, 2026

Baseline: `npm run check` passed (194 tests); Django SQLite suite passed
(316 tests, 21 skips). The worktree was clean before Phase 3 edits.

Tests were first observed failing for missing required-allocation helpers,
thirty-minute recording persistence, metadata/upload acceptance and VAD bounds.
They passed after implementation. A separate failing regression covered current
required totals versus saved run snapshots before its fix.

Final verification before user inspection:

| Check | Evidence |
| --- | --- |
| `npm run check` | Passed: TypeScript, lint, 202 mobile tests |
| `npm run bundle:android` | Passed: Android JS export; does not establish native capture |
| SQLite backend | Passed: 321 tests, 21 PostgreSQL-only/host-dependency skips |
| PostgreSQL backend | Passed: 321 tests, one host VAD dependency skip |
| Focused decoder/processing/evidence suite | 50 tests passed, three PostgreSQL-only skips |
| Full worker image | Seven decoder/VAD/processing tests passed, including packaged model load |
| Django system/migration checks | Passed; no model changes or planned PostgreSQL migration operations |
| Independent staged review | One P2 clearing-duration issue fixed; targeted independent re-review passed |
| Android long capture | Auto-stopped at 1,799,061 ms; mono AAC, 15,269,369 bytes; upload, no-speech processing, cold reopen and playback state verified |
| Physical phone | Seoyeon confirmed short-recording playback and transcription work; separate visits were not distinguishable in the current UI |

Transient logs are under `/private/tmp/phase3-*`; they are not repository artifacts
and may expire. No generated audio, private recordings, credentials or native build
outputs are included in Git.

### Real worker and Whisper — separate generated fixture

A locally generated, labeled synthetic English speech phrase repeats every thirty
seconds in a 1,800-second mono AAC file. This is **not** microphone-capture evidence.
Its size is 6,969,422 bytes; SHA-256
`8d7bb6cc0fea707c74f71f2be897848f24621950012b16dce7b5947627e4b85f`.

The isolated PostgreSQL/Redis/full-dependency Celery worker accepted its upload and
identical retry (both HTTP 201), then processed attempt
`826771b1-7bab-4d83-acfb-ec268d986677` at generation 1 through packaged Silero and
real `whisper-1`. Completed with 1,860 words; last word ends at 1,782,360 ms.
The visits retain `[0, 1, 0, 5]` at `[0, 600001, 1200000, 1790000]` ms;
summed per-slide time is exactly 1,800,000 ms. This verifies long upload/transcription
and late timestamps for this fixture, not ordinary speech accuracy or all devices.
Repeated process/GET calls retained generation 1, exactly one provider request and
one saved receipt, with the original audio hash unchanged. The actual result was
also accepted by the mobile result and Review parsers (1,860 words, four visits).

### Remaining boundaries

Ordinary users cannot enter duration/audience until the separately approved
requirements-entry UI is implemented. Phase 1 client/API calls can save explicit
requirements for integration tests. Existing legacy timing defaults remain unchanged.
Allocation is a deterministic starting budget, not a validated optimal speaking plan.
Seoyeon confirmed short-recording playback and transcription on the physical phone.
Physical-phone thirty-minute capture, interruption and broad usefulness acceptance
remain unverified. The current slide transcript view groups repeated visits without
first/return visit labels; Seoyeon could not distinguish those visits. Saved events
and segments remain separate. No visit-label UI redesign is included in Phase 3.

## Review evidence

The initial independently reviewed staged patch was
`c358fa24a726d52f56895215a5adfcec11e2534966f3f6b7503277e4438a594b`.
The reviewer independently ran 43 focused mobile tests and found one P2 issue:
clearing a duration restored per-slide suggestions but could retain the saved
required total in Review. New full/partial regressions using actual `mergeTake`
were observed failing before the fix. Review now derives totals from current
budgets in both required and suggested modes, preserving the saved run exactly.
This also keeps legacy displays consistent if their slide budgets have changed.

The targeted follow-up reviewed the two-file repair in patch
`747cf4e50d596593670b720e1001c5e310b094cb2d2ae1ab3e3247e2bb1e2701`;
five independent timing tests passed, with no new concrete finding. Final mobile
check (202 tests) and Android export passed after the repair. Later evidence-only
updates receive a proportionate author accuracy/link/diff review. This is AI
review, not human teammate approval.

Provider response schemas were compared directly against HEAD: `Descriptions`
SHA-256 `30da99b417beed25d5ccc9ee126cd3ce53ba2c32bd4b424fdd79190540450a27`
and `Suggestions` SHA-256
`3d8e0d020c9ea4a7c0de1e51c75f4f33f509d233395ebf8aca3475fe3b8dad2b`
are unchanged (canonical sorted JSON). No prompt/scope versions were rewritten.

Commands actually run from `mobile/`: `npm run check`, `npm run bundle:android`,
and focused `node --test` runs for required timing, capture, attempt storage and
feedback contracts. From `backend/`, using the existing Python environment:
`python manage.py check --settings=config.test_settings`,
`python manage.py makemigrations --check --dry-run --settings=config.test_settings`,
`python manage.py test --settings=config.test_settings`, plus full tests and
`migrate --plan` under temporary `phase2_runtime_settings` pointing to isolated
PostgreSQL at localhost:55437 and Redis at localhost:56379. The full worker test
command used `config.test_settings` and mocked provider calls. The generated
thirty-minute fixture's Whisper call is the separate real-provider check above.

The reviewed/tested runtime and test patch (`git diff --cached --binary -- backend mobile`)
has SHA-256 `e6d5ee475e01c9bd1ab59342f0da6fc9d9fd156494f1e1e9732ee6e3672b203b`.

## Native Android and interaction evidence

The existing Android development client on `emulator-5554` recorded continuously
in the foreground, across the old ten-minute limit, and finalized automatically
at **1,799,061 ms (29:59.061)** with the retained one-second margin. Attempt
`eb2bb748-c5d3-4b14-8b33-06c160dfc680` uploaded through the normal app flow (HTTP
201). Its original audio is mono AAC, 44,100 Hz, reported stream rate 63,999 bits/s,
15,269,369 bytes. PyAV decoded 1,799,012.426 ms, within 49 ms of capture metadata.
Source SHA-256: `7a09a0d4cda7c2805d9148ccbf9e6cb3e425e1d4778e005ce1b32da4a8067633`.

Zero-based slide visits are `[0,1,0,1]` at `[0,605816,916056,1494071]` ms.
The real packaged VAD completed `no_speech` with zero Whisper requests; per-slide
sums are 1,183,831 and 615,230 ms, exactly the original duration. This validates
actual native capture/upload/no-speech processing; the separate generated fixture
above validates a full 1,800-second real Whisper request. They are distinct tests.

Cold reopening retained the presentation, local submitted attempt, selected run,
media and no-speech result. The existing triangle playback control entered playing
state, then paused normally; silence is not evidence of audible speech quality.

Because requirements-entry UI remains held, an external verification harness used
the production context API/parser/client/store to seed only this labeled test
presentation's cache on a complete, stopped-emulator database backup. Explicit
1,800-second allocation was `[213,272,317,322,345,331]`; Android Review correctly
used 485 seconds (8:05) for the two recorded slides and the recorder showed 3:33
for slide one. A short redo opened existing Compare; Keep current restored the
original selected run unchanged. Clearing duration through the production
client advanced context revision 1 to 2 and restored the 97-second (1:37)
partial-run suggestion in Android Review. All unrelated database rows were proved
identical when seeding/clearing; all original audio and backup files were retained.

The first external binary fixture transfer was truncated and rejected on reopen.
It was repaired from the complete valid backup using file push/app-UID copy;
byte equality and SQLite integrity were verified before continuing. This was a
verification-harness error, not an app migration or data-loss result. The physical
phone's database was never edited by this harness.

Transient screenshots include `phase3-before-capture.png`,
`phase3-after-ten-minute.png`, `phase3-after-autostop.png`,
`phase3-long-playback.png`, `phase3-required-review.png`,
`phase3-redo-target.png`, `phase3-compare.png` and `phase3-cleared-review.png`
under `/private/tmp/`. Human phone feedback is recorded verbatim in the task's
AI-use entry. Separate-visit UI labels and held requirements-entry UI remain
outstanding; no new screens or Phase 4 behavior were added.
