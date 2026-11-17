# Evidence-validation audit — October 16, 2026

Contributor: Seoyeon. Isolated branch `it2/feature/ai_feedback`; no commit, push or merge.
This patch extends the previously staged defaults/cue/Q&A/expression follow-ups; it
does not discard them or change generation prompts. No schema migration, new screen,
requirements sheet, incremental recording, or unrestricted transcript editing.

## Changes and architecture

- Shared conservative quotation policy in backend `services/evidence.py` and mobile
  `features/feedback/evidence.ts`, exercised by one JSON corpus. The reported final
  period mismatch is accepted; changed words/order, negation, 1.5/15, C++/C, operators,
  acronyms, dotted identifiers, and quantity/unit case changes are rejected.
- Review and legacy coaching validate findings independently. Correct peers survive
  malformed metadata, quote failures, overlapping spans, and overlong source quotes.
  Stable original word indexes, original visits/times, source IDs, transcript identity
  and synchronized correction revisions remain the grounding anchors. Internal
  40-word segments no longer truncate a same-visit evidence passage.
- Contiguous slide-fact excerpts accept normalized whitespace. Published findings
  retain the full authoritative fact, preserving negations and qualifications.
- Review distinguishes successful, partial, invalid evidence, malformed model data,
  and insufficient speech/model-declined assessment. Fixed reason codes/counts are
  observable without logging quotations. Existing Review displays these distinctions.
- Q&A names accept up to 64 characters; historical requests reconstruct their original
  eight-character schema to preserve request hash/receipt recovery. Object property
  order no longer changes scope/provenance equality; array order remains meaningful.
- Generation prompts and the provider generation output schema are unchanged; the
  API result adds statuses and validation metadata. Normalization
  has its own `evidence-v1` marker. Explicit saved-receipt revalidation is local,
  defaults to dry run, locks the description/analysis/job/request rows, rechecks
  source/revision/generation freshness, and never calls a provider.

## Automated verification

Commands ran from this checkout, using the project's existing Python environment.
Provider calls in tests were mocked; no fresh real-provider request was made.

| Check | Result |
| --- | --- |
| `mobile/`: `npm run check` | 295 tests passed; TypeScript/lint passed; existing unrelated playback cleanup-ref warning remains |
| `mobile/`: `npm run bundle:android` | Passed; bundle `entry-6a0f2665d7b2be37ca6dd02a83c8e9ae.hbc` |
| `backend/`: `python manage.py check --settings=config.test_settings` | Passed |
| `python manage.py test --settings=config.test_settings` | 388 run; passed with 25 PostgreSQL-only skips |
| `python manage.py makemigrations --check --dry-run --settings=config.test_settings` | No changes detected |
| PostgreSQL focused suite below | 139 passed against isolated test database |

```sh
PYTHONPATH=/private/tmp:. python manage.py test \
  rehearsals.test_review_evidence rehearsals.test_evidence rehearsals.test_feedback \
  rehearsals.test_slide_review rehearsals.test_durable_qa rehearsals.test_coaching \
  rehearsals.test_cue_guidance --settings=phase2_runtime_settings --noinput
```

Regression coverage includes the reported quotation, Python/JS Unicode parity,
NFC expansion/length bounds, valid peers beside malformed findings, overlapping
findings, conservative deduplication, same-visit chunk crossing versus return-visit
rejection, source/revision mismatches, optional malformed metadata, visible status
messages and Listen callback, 64/65-character names, historical Q&A schema hashes,
structural equality, and stale/idempotent saved-receipt repair with no provider work.
Logs: `/private/tmp/evidence-mobile-final.log`, `evidence-bundle-final.log`,
`evidence-backend-final.log`, and `evidence-postgres-final.log`.

## Independent AI review and saved-result verification

A separate reviewer inspected normalization, source boundaries, output isolation,
client parity, request compatibility and the saved-receipt path. Its identified
unit/operator, Unicode parity, full-fact context and source-quote length defects
were fixed and regression-tested. Final independent focused checks: 45 backend
tests (one skip), 20 mobile tests passed; no remaining concrete findings. This is
AI review, not teammate/human approval.

The reported slide's existing receipt (job 56) was dry-run revalidated, then applied
with one accepted finding and zero rejected findings. Generation remains 2. Repeating
the apply returned `already_current=true`; no AI call was made. The connected
physical Samsung fetched the saved result via HTTP 200 and the production parser
accepted one current finding as “Focus on these,” validation revision `evidence-v1`.
The API and isolated worker were reloaded. The phone remained on its current Q&A
screen: this proves the device GET/parser path, not a new visual Review or playback
interaction. No new recording or fresh end-to-end provider generation was tested.

Administrative repair (run from backend with the intended runtime settings):

```sh
python manage.py revalidate_review_evidence --job 56 --settings=phase2_runtime_settings
python manage.py revalidate_review_evidence --job 56 --apply --settings=phase2_runtime_settings
```

Do not bulk replay stale receipts. The command rejects noncurrent sources, revisions,
generations, incomplete receipts and hash mismatches; GET never mutates cached output.

## Deliberate limits

- `!`/`?` and ambiguous symbols/case remain strict. Without semantic context an
  arbitrary unmarked word can also be an identifier; obvious code, all-caps, camelCase,
  single-letter and quantity/unit forms are protected, but text matching alone cannot
  prove every domain's case semantics.
- Deduplication handles normalized identical advice, not all semantic paraphrases;
  conservative retention avoids discarding distinct findings sharing evidence.
- Malformed envelopes, unrelated source identities and invalid timestamps/ranges
  remain hard failures. Structural validation proves evidence existence, not that
  every AI interpretation or coaching recommendation is correct.
- Historical receipts are not automatically backfilled; only the reported current
  job was explicitly repaired. No database migration or external provider test needed.

## Files in this evidence patch

Backend: `services/evidence.py`, `slide_review.py`, `feedback.py`, `coaching.py`,
`slide_profile_schema.py`, `qa.py`, `audience_qa.py`; management command
`revalidate_review_evidence.py`; `test_evidence.py`, `test_review_evidence.py`,
`test_feedback.py`, `test_slide_review.py`, `test_durable_qa.py`, and shared
`testdata/evidence_quotes.json`. Mobile: `feedback/evidence.ts`, `slideReview.ts`,
`validation.ts`, `SlideReviewSummary.tsx`, `presentations/slideProfiles.ts`,
`qa/client.ts`, `qa/state.ts`; evidence/Review UI tests and helper, updated
slide-review/Q&A tests. Docs: this ledger, API contract, phase ledger and AI-use logs.
