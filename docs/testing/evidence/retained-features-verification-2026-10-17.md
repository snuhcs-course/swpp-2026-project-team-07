# Retained features and discontinued-code cleanup — October 17, 2026

This integration preserves automatic presentation scoring from `0658944` and applies
the existing compact feedback, navigation/layout and cue/feedback reliability work.
The user authorized committing retained features and discontinuing Step 2 and old
scoring experiments. Ordinary commits preserve existing Git history.

## Applied behavior

- Step 1: versioned compact selected-visit JSON, one copy of facts/corrected speech,
  explicit column rows, bounded neighboring context and original evidence identity.
  Existing singleton snapshot hashes and saved receipts remain reproducible.
- Navigation/layout: first saved recording opens Full Review; later takes use slide
  review; Keep/Overwrite and return routes retain selected-slide identity. The Full
  Review button stays above the Review scroll area with header-aware scrolling.
- Cues/feedback: GET-only reconnect with cached results, capped backoff, foreground
  and visibility fences, clearer stage/quota/failure messages and Further Insight
  labels. Independent feedback retains initial claims, preflight, duplicate locks,
  correction/cooldown checks and uncertain-outcome confirmation.
- Active v2 scoring, zero/repeated-visit validation, evidence playback, saved reviews
  and score displays remain intact.

## Discontinued code

Removed old model-comparison/evaluation/consensus/recovery runners and tests,
benchmark harnesses, grouped-feedback admission/builders/budgets/ownership metadata,
legacy grouped projection/handoff code and obsolete Step 2 documents/review archive.
Five earlier shared evidence/measurement modules remain because active v2 scoring
imports them; they are not the discontinued experiment runners.

Read-only checks found zero grouped review snapshots in either known local phone
dataset (60 and 54 saved reviews), and zero membership rows. Migration0010 is
already applied in the current phone database. Its migration and inert model remain
for schema consistency; application code never reads/writes membership rows.
No database records, receipts, schema or media were deleted. Old singleton payloads
still work; grouped/unknown protocols and multi-slide scopes fail before inference,
even at the locked submit boundary. Hypothetical old group receipts are retained
privately and never reinterpreted under the singleton protocol.

## Verification

The exact isolated candidate passed `npm run check`:543 tests, TypeScript and lint
with zero errors and one existing `useSegmentPlayer.ts:108` warning. Android export
passed with isolated Metro cache;112embedded application sources match candidate
bytes. Full SQLite and PostgreSQL suites pass542tests (24expected PostgreSQL-only
skips on SQLite), plus Django system and migration checks. Network/provider calls
were blocked or mocked. A real API regression reproduced a lost initial-request recovery gap; confirmed
recovery now admits one singleton while supplied selection/transcript assertions,
duplicate, source, revision, cooldown and legacy-coaching controls remain intact.
Assertion fields retain their existing optionality for legacy callers. Five new real API
regressions and the mocked client recovery cases pass. Independent review is bound
to the final temporary staged snapshot before commit. No device install, service restart, live-provider test or deployment
was performed for this source task. Earlier physical-device records remain dated
historical evidence, not acceptance of this exact snapshot.

Original index/staged/unstaged snapshots and every pre-task source file are backed
up at `/private/tmp/outloud-retained-features-20261017/`. Discontinued staged entries
are deliberately dropped; retained feature entries are consumed by this commit.
No push, merge, branch/worktree removal or history rewrite is performed.
