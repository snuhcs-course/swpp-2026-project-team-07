# Scribe-only application integration — October 17, 2026

## Sources and preservation

- Integration branch: `integration/ai-feedback-with-scribe`.
- Main parent: `5aed316179a7d093f7db02732e792d1fc7c98444`.
- Authoritative application: `e8f48693cc75f2a2bec9cd11eab3b00689dadb34`
  (`codex/presentation-score`), including `0658944` scoring and retained Step 1,
  navigation/layout, cue and singleton feedback reliability.
- Before integration, all 578 committed files matched the prior reviewed source
  manifest. The original tracked/index source was clean; its only untracked item
  was a local dependency symlink. No uncommitted feature dependency was omitted.
- Merge remains uncommitted for the requested final user inspection. Existing
  worktrees, staging backups, database records, media, secrets and services are
  untouched. No history rewrite, push, PR, deployment or paid inference is claimed.

## Runtime change boundary

Transcription uses main's Scribe HTTPX adapter, deterministic visited-slide hints
(maximum 100), private submitted request-option snapshots and PDF NUL removal.
The adapter emits the existing text/word-millisecond transcript contract. No
Whisper request, decoding, provider selection or fallback remains. OpenAI/Gemini
feedback, scoring and Q&A evaluation remain configured exactly as before.

The only mobile behavior changes are exact Scribe provenance validation, fresh
Scribe consent and necessary durable-answer consent recovery. Cancel retains the
answer; Continue reuses its UUID. Saved reads/polling and feedback-only retries
stay available without transcription consent. Q&A retains our durable implementation.

Migration0011 joins both committed histories and changes defaults only for new
request identities. No historical transcript/data migration is added. Historical
Step 2 schema is inert and unchanged; grouping runtime is not restored.

## Verification

All integration provider responses are synthetic/mocked. Backend command runs
blanked provider keys, disabled feedback by default, and used `guarded_manage.py`
to reject real HTTP transport. Tests explicitly enable only synthetic fixtures.
The existing Python environment was reused from the AI-feedback worktree; no
environment, secret or dependency lock was changed.

| Check | Actual result |
| --- | --- |
| Initial main transcription/keyterm baseline | 20 tests passed |
| New red checks before implementation | Default provider, two migration leaves, client provenance and missing durable-answer consent reproduced |
| Focused backend transcription/processing/keyterms/graph | 49 tests OK, 3 PostgreSQL-only skips |
| Full backend: guarded equivalent of `python manage.py test --settings=config.test_settings --noinput` | 554 tests OK, 24 PostgreSQL-only skips |
| Fresh disposable PostgreSQL full suite | 554 tests OK, zero skips |
| Fresh SQLite/PostgreSQL `migrate --noinput` | Passed through both histories and migration0011 |
| Django `check`, `makemigrations --check --dry-run`, graph leaf checks | Passed on both database engines; no drift, one leaf |
| Mobile `npm run check` | TypeScript passed; lint zero errors and one existing player-ref warning; all 549 tests passed |
| Mobile `npm run bundle:android -- --source-maps` | Passed; all 112 embedded production application sources byte-match integration |
| Independent read-only review | No introduced correctness findings; independently 32 mobile tests and 82 backend tests OK (6 PG-only skips), plus 3 actual-client consent-boundary assertions |
| Separate Android mock release APK | Offline JDK17/Gradle build passed; installed/launched only on emulator-5554 |
| Mock Android consent Cancel / Continue / reopening | Passed; Cancel zero uploads/POSTs, Continue one upload and one bound-answer POST, reopening after test consent revocation retained result and total POST count one |

PostgreSQL verification used the task-owned `outloud-scribe-test-pg-20261017`
container on localhost58931, with synthetic credentials, no shared volumes and
separate fresh/test databases. The test database was destroyed by Django; the
task-owned container was stopped after checks. Existing services/databases were
not restarted or migrated.

The actual Q&A screen regression uses validated review storage, the existing
dialog and durable client: Cancel retains the answer UUID/audio; Continue resumes
that UUID once. Additional consent checks cover pending/failed STT, completed
reads, active polling, profile recovery and feedback-only retry. Existing full
suites retain scoring arithmetic/evidence, compact singleton feedback, corrections,
staleness, limits, navigation, zero/repeated visits and malformed-response cases.

## Android evidence and limits

The clearly labeled synthetic package is `com.team07.outloud.scribemock`, separate
from the original app. Its manifest has no INTERNET permission; Expo fetch is
redirected only in the temporary harness to an in-memory mock. It contains no
keys or environment files. All 257 copied production files outside the documented
entry/config/AppShell overlay exceptions are byte-identical; 115 embedded harness
application sources match their temporary files, and packaged Hermes bytes match
the generated bundle. The real application controllers, cache validators, Q&A
screen and client were retained.

Screenshots and isolated-process request logs verified the disclosed ElevenLabs
provider and visited-slide vocabulary copy, cancellation with saved audio retained,
continuation of answer `77777777-7777-4777-8777-777777777777` once, and saved-result
navigation after revoking test consent. Home also rendered the retained verified
overall-score and findings display. The physical phone and original app package
were not installed, cleared or launched for these checks. UIAutomator idle dumps
were unavailable because of continuous animation; screenshots and request logs
were used without changing system animation settings.

No real Scribe acceptance/recognition/filler recall, billing/latency, new physical
phone, real microphone capture, audible synchronization, exhaustive OS interruption,
or real Celery/Redis process-kill integration check is claimed for this snapshot.
Worker receipt/interruption behavior is covered by the mocked/backend recovery
and PostgreSQL tests. The existing Q&A answer polling behavior aborts on unmount;
AppState/inactive-layer cancellation is unchanged and was not redesigned here.
Historical Whisper development records are intentionally unsupported; no records
were deleted and no historical upgrade/backfill was implemented.

## Final diff and review

The explicit allowlist has 18 source/config/migration paths: the adapter/worker,
model defaults/request options, vocabulary/PDF helpers, existing standalone Q&A
adapter, client identity/consent and provider disclosure. Three of those source
files change provider-name comments only. Scoring formulas, scoring/feedback
prompts, compact review logic, corrections, layout/navigation, limits and evidence
playback source outside this allowlist are byte-identical to `e8f4869`. Every
already committed migration in both histories is byte-identical to its source.
`source-preservation.json` lists every allowed path and its justification.

Independent review is bound to `review-source-v1.patch`, SHA256
`3497f6def49dd2c121aedf635552eaefc77d4ef197cd330b57460cc22beec28c`.
After review, the only runtime-file changes were seven attribution comments;
`post-review-source-proof.json` proves their remaining bytes are identical to the
reviewed staged source. Final tests/export use those comment-inclusive files.
Documentation was checked separately for accuracy, links and current/historical
distinctions. No actionable findings remain. Earlier immutable review `.patch`
artifacts contain literal whitespace in context lines; they are unchanged evidence,
not application whitespace defects.

Detailed logs, reviewed patch, final backend/mobile patches, integration-vs-main
diff, source proofs, Android screenshots/APK, review report and inspection manifest
are retained under `/private/tmp/outloud-scribe-integration-20261017/`. The original
578-file scoring source and clean original index were verified unchanged again.

## Delivery gate

The complete intended integration is staged in the isolated worktree and remains
an **uncommitted merge** for the user's requested final inspection. Commit, push and
PR creation have not occurred. After approval, retain both parents in the merge
commit, push `integration/ai-feedback-with-scribe`, and open the PR against `main`
with title **Integrate complete OutLoud application with ElevenLabs Scribe v2 transcription**.
Do not merge or deploy it. No unrelated work, dependency symlink, native build,
private media, environment file or test harness belongs in that commit.


## Subsequent authorized live Scribe and physical-phone check — October 17, 2026

After the mocked integration review above, the user explicitly requested live
Scribe/physical-phone testing and entered the ElevenLabs key in the existing ignored
backend `.env`. Codex checked only key presence; no credential was printed or copied
into a build, artifact, or repository file. The earlier no-paid-call statements
describe the implementation/review gate, before this separate authorization.

A separate integration API/solo worker/recovery scheduler uses port **58010**, its
own disposable PostgreSQL/Redis and media directory. Existing services, databases,
worktrees and phone app data remain intact. Other inference is disabled in this
test runtime: no feedback, scoring or Q&A evaluation provider call was made.

- One 17.086-second synthetic recording completed through the real speech gate,
  Celery and Scribe. It returned 45 timed words including “Um” and “Uh”; integer
  audio timestamps, repeated visits and an 8-second zero-duration visit were
  preserved. The current Android parser accepted the real response and rejected
  tampered provenance/negative/reversed intervals.
- The saved transcript/completed processing replay reused the single durable
  receipt. Its 40 private vocabulary hints excluded unvisited-slide terms, and
  stored audio matched the original SHA256. No private provider fields leaked
  into the public response.
- A standalone production-source release APK was installed with `adb install -r`
  on Samsung **SM-S918N (Galaxy S23 Ultra)**. All 112 embedded application source
  files match the integration; the signing certificate matches the previous app.
  The pulled installed APK matches SHA256
  `4f6b922e2cee4d977cc0f9f6340d80ae50ec8ecd96e6c8824f8f6ecafcb46bec`.
  An initial build with stale Metro preview output was rejected before installation;
  an isolated cache produced the verified final APK. No application source changed.
- On the physical phone, Codex imported a synthetic three-slide PDF, captured
  33.921 seconds with slide 1→2 navigation, observed/accepted fresh Scribe consent,
  and verified upload/polling/completed transcription, transcript rendering,
  advancing audio playback and transcript highlighting. Restarting the app retained
  the recording statistics. It used one receipt; reopening did not add a request.
- Exactly **two** Scribe provider submissions occurred across these checks; billing
  totals were not queried. No automatic retry/fallback or other inference occurred.

The physical microphone picked up surrounding audio more strongly than the Mac's
synthetic phrase. This is native pipeline/playback evidence, **not** a controlled
recognition-accuracy result. Quiet human speech, usefulness, exhaustive OS recovery,
and live feedback/scoring/Q&A evaluation remain unverified. The phone and isolated
backend are left available for manual Scribe testing over USB.

Local evidence is under `/private/tmp/outloud-scribe-live-phone-20261017/`; physical
audio/transcript/screenshots stay private outside Git. The original staged tree
`afc9fbf6941661e2554bb65921fbbfbbe167acbb` and its patch remain unchanged. These
additional documentation notes are **unstaged** for inspection; no commit/push/PR
was performed, and the existing final-review gate remains in force.


## Subsequent approved cleanup and PR authorization

The user approved audit groups A/B/D/E's seven PNGs and requested the integration
PR. The original staged snapshot remains backed up; the approved final candidate
now includes these deletions, their test-stub cleanup, current README wording,
live-test notes and the requested implementation handoff. This is an explicit
cleanup exception to the earlier transcription-only preservation allowlist.
See [cleanup verification](scribe-integration-cleanup-verification.md) for exact
files, current tests, independent review and the publication checkpoint. Earlier
uncommitted/no-publication statements above describe their dated inspection gates.
