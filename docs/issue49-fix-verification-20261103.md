# Issue #49 repair and verification — November 3, 2026

Implementation branch: `codex/issue-49`, based on published v7 `64e6484e4496950d47b3999fb62522f122d09bab`, which contained live main `7b7ef3b` when work began. Earlier dirty checkouts were preserved. [The investigation](issue49-investigation-20261103.md) records the confirmed 119.3125 ms duration mismatch and independent per-slide recovery problem.

## Retained behavior

Audio admission and grading share ±1,000 ms tolerance. New private measurement v2 diagnostics validate source bounds, clip diagnostic intervals/signal statistics to the common window and discard empty spans. Original audio, transcript, capture duration, slide events and rate denominator are preserved. Exact legacy terminal results remain readable under the original source/provider/settings guards; explicit retries create fresh current-version generations without rewriting history. The scoring prompt, rubric and weights are unchanged.

Full Review links affected slides to their selected recordings. Existing details expose honest status and explicit targeted recovery, including unusable completed singleton results. Reads remain read-only; successful/partial/insufficient/unavailable states remain distinct. Confirmation and source/revision/cooldown guards remain in place.

## Agent-operated verification

All checks below are agent-operated. Automated provider calls are mocked and transport-blocked. No human acceptance or live-generation quality claim is made.

| Check | Final result |
| --- | --- |
| `python manage.py check --settings=config.test_settings` | Passed, no issues |
| `python manage.py makemigrations --check --dry-run --settings=config.test_settings` | Passed, no changes |
| `python manage.py test --settings=config.test_settings --noinput` | 630 tests, OK; 26 expected skips |
| Same full backend suite with `--settings=config.settings`, disposable PostgreSQL 16 | 630 tests, OK; one packaged-VAD dependency skip |
| Existing Docker backend image, read-only final source, `manage.py test rehearsals.test_speech_gate --settings=config.test_settings --noinput`, network disabled | 3/3 passed, including the host-skipped packaged VAD check; Linux amd64 image under host emulation |
| `npm run check` | Typecheck/lint passed; 617/617 tests passed. Existing `useSegmentPlayer.ts:125` exhaustive-deps warning remains; that file is unchanged |
| `npm run bundle:android` | Passed |
| Task-only real PostgreSQL/Redis/Celery probe | Passed after final review fix; 23 tests including one real-worker case and imported existing slide-review tests |
| Independent consolidated review | No unresolved findings; independently checked 37 backend tests, 37 mobile tests and the new projection regression |
| `git diff --check` | Passed |

Focused regressions cover original 271073 ms / 4335259 samples and both drift directions, inclusive ±1000 ms / one-sample overflow, clipping and empty millisecond intervals, invalid/missing/decode/VAD/silence states, v1 identity goldens, exact predecessor/tamper/source/provider/profile/settings guards and fresh explicit retries. New recovery tests include concurrent PostgreSQL retries admitting one generation. Mobile checks cover selected take/repeated visits, zero findings, partial/insufficient/unavailable/outdated states, modal lifecycle, read-only opening/refresh, stale uncertainty/profile confirmation and preflight interruption.

The review caught one P2 defect: a queued retry of a missing-summary assessment projected the malformed previous result. A RED→GREEN regression now checks both HTTP 202 and subsequent GET project `result:null`, while state, scope, source, stored result and receipt remain unchanged. The reviewer independently rechecked the fix; both complete backend suites and real-worker probe were rerun afterward.

The final 17-file production manifest matches the independent review (`2164a06c9b6b9857bc0b3ce28dbb0aa4ccc07e983eb6a2abcb40ec2f2c9de4c4`). Dependency manifests, lockfile, app configuration and scoring-core functions/classes outside measurement failure preparation match v7. Installed dependencies remain ignored. Disposable test containers were stopped after verifying their task labels; the existing local database was untouched.

## Android fixture

**20/20 agent-operated native fixture checks passed** on the connected Samsung SM-S918N, using only the separate `com.team07.outloud.issue49qa` package. The native build passed; 15 mounted production modules and 16 mirrored modules match the final source exactly. The legacy summary component is mirror-only because compact Review mounts the new details/controls path.

Observed flows include affected-slide links selecting the exact take and repeated visits; opening/refreshing with zero automatic POSTs; explicit failed/invalid/model-error/missing-summary retries progressing through queued to completed zero findings; zero-finding details reopening and Close/Android Back; uncertain Cancel/Close/Back without submission and explicit Confirm sending one acknowledged request; honest unavailable/partial/outdated/cooldown displays; untimed prerequisites without mounting a controller or reading that take; and a distinct second selected recording.

This was a synthetic fixture with real Review/Full Review components, feedback controllers/parsers/stores, corrections, requirements and SQLite storage. Model/recordings, score reader, audio resolver, task-only navigation entry and in-process backend transport were substituted. Automatic generation hosts were absent. The unchanged Frame footer animation was disabled only in the fixture; phone animation settings were not changed. No live backend/provider, microphone, recording or sound check occurred. Full AppShell behavior, physical-phone profile-dependency recovery and the full network/race matrix were not established by these native checks; focused automated coverage remains separate.

Two native harness assumptions were corrected without application edits: disabled-button assertions now inspect the Button rather than its enabled text child, and partial feedback opens through its normal slide tile rather than a recovery link. Provenance/UID parsing was also corrected before final evidence. These were verification tooling errors, not observed application failures.

Cleanup verified the temporary package and shared snapshot were removed; production APK path/SHA-256 `24df70866369ef4af2a55513765f5daa364463896b97a848c29c2436c553f55b` stayed unchanged and its process remained stopped. Animation settings, launcher/notification shade/keyguard and original dozing state were restored. The production app was never updated or launched by this task. Detailed native proof is in `outputs/issue49-fix-20261103/android/` of the original workspace.

Implementation and scoped verification are complete locally. The original real rehearsal has not been retried against this fix: backend deployment and a production client release remain outside this task.

The task-only real-worker probe already passed using disposable PostgreSQL 16, Redis 7 and a real Celery solo worker thread. Real decoding of a synthetic WAV with 4,335,259 samples at 16 kHz and capture metadata 271,073 ms completed grading. A separate completed model-error slide assessment recovered through an explicit retry. There was one score stub call and two slide-review stub calls; duplicate score delivery/reads did not create another call, old receipt bytes remained identical and the attempt's audio path, duration, transcript and events were unchanged. VAD intervals were controlled; these are integration observations, not a live-provider or original-recording result.

Local evidence: `/Users/seoyeonpark/Documents/ChatGPT/OnLoud/outputs/issue49-fix-20261103/`.

## Rollout prerequisites — not performed

1. Temporarily reject new POST admissions to the presentation-score endpoint at the edge while retaining GET access. Keep the old API/workers, provider configuration and recovery scheduler available to finish already-admitted work; disabling feedback globally is not a substitute for admission maintenance.
2. Inspect current score generations only (`generation == analysis.feedback_revision`), including queued, dependency-waiting, preparing, submitted, normalizing and quota-waiting jobs. Do not mistake obsolete historical queued rows for current work or force quota retries.
3. Let old workers finish received receipts using their original protocol. Submitted requests without a durable receipt must reach genuine `needs_confirmation` through existing recovery. Never clear uncertainty, invent acknowledgement, replay a receipt through new normalizers or bulk-regenerate terminal results.
4. Defer deployment if current active work cannot safely drain. Once drained, deploy the tested backend and matching client through a separately authorized release, remove admission maintenance, and explicitly retry the reported rehearsal once. Preserve the original failed generations and record that live result separately.

No deployment, production database/job update, real provider request, commit, push or publication is included in this implementation task. Native fixture observations must remain separate from installed production-app behavior and human listening.
