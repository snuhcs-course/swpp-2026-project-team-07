# Feedback controlled evaluation — interim checkpoint 5 record

**Final evaluation pending.** This bounded run repairs Gemini schema compatibility
and records only the coordinator-supplied summary below. No allowlisted evaluation
JSON files were present in this workspace. The writer made no provider call and
has not inspected private bodies/media or independently verified these live results.
A follow-up documentation run will incorporate sanitized coordinator evidence after
independent review and controlled generation on the repaired snapshot.

## Reported live evidence before repair

| Exact configured model | Availability / stage outcome | Output, counts and usage available to this writer |
| --- | --- | --- |
| `gemini-3.1-flash-lite` | Model metadata GET succeeded. First actual baseline description request returned complete HTTP 400 `INVALID_ARGUMENT` with a generic invalid-argument message. App durably stored `rejected`; no coaching or automatic retry. | One reported rejected description call; no accepted description/coaching output. Token usage not supplied, not assumed zero. |
| `gpt-6-luna` | Descriptions and coaching passed on the same saved baseline, per coordinator summary. | Actual outputs, accepted/discarded counts and reported usage not yet supplied. No semantic-quality conclusion. |

The shared saved baseline was reused without a new Whisper call. Exact fixture
IDs/hashes, baseline-attempt metadata and equivalence assertions are pending
sanitized evidence; no identities are invented. Baseline placeholder slides are
weak usefulness evidence. Adversarial output/injection observations and the
agent-authored grounding/actionability rubric are not yet available. A hand-authored
adversarial transcript would not prove speech alignment.

## Contracts and repair boundary

Source at checkpoint 4 (`64ec596`) uses description prompt `description-v2`, coaching
prompt `coaching-v1`, and schemas `description-v1` / `coaching-v1` for both providers.
These are source-derived contracts, not an independent per-run metadata audit.
New Gemini selections in this repair use `description-gemini-v2` /
`coaching-gemini-v2`; prompts remain unchanged. OpenAI and saved Gemini v1 requests
retain their original schemas and exact payload identities. Explicit legacy retries
do not adopt the new projection. [Repair details and primary references](ai-feedback.md#checkpoint-5-gemini-schema-compatibility)
explain why this remains a compatibility hypothesis until controlled generation
succeeds; metadata availability alone is not generation proof.

Defaults remain exactly the two models above, configurable with feedback disabled
until configured. There is no substitution/fallback. Local schema/evidence checks
remain mandatory after every output. The final report will keep model availability
and rejection, structure/evidence validity, description accuracy/uncertainty,
semantic usefulness, observed injection behavior and reported usage separate.

## Verification and remaining evidence

The new compatibility assertion failed on both Gemini stages before repair.
Post-repair local checks passed: 243 SQLite tests (18 PostgreSQL-only skips), Django
system and migration-drift checks. Legacy/current snapshot and receipt tests use
synthetic fixtures and mocked providers. Independent review, real PostgreSQL/worker
verification and repaired Gemini live generation remain pending. Prior checkpoint-4
review, 270 mobile tests/export, 229/229 PostgreSQL tests and agent-operated emulator
flows are [historical evidence](ai-use.md#2026-10-08--checkpoint-4-coordinator-verification),
not verification of this patch.

Observed description accuracy/uncertainty and agent grounding/actionability
assessment are **pending output evidence**. The final rubric must inspect whether
each observation follows from the quoted facts and speech and whether its action
is specific and useful; structural acceptance alone is insufficient. The
[hand-authored experience examples](ai-feedback.md#illustrative-feedback-experience)
are explanatory prose, not measured outputs. No injection immunity, monetary cap,
audit-clean dependencies, human approval or physical-phone correctness is claimed.
Human review/listening, TalkBack and extended keyboard/long-text usability remain
pending. Existing prototype attribution and dependency advisory assessment are
retained in the feedback notes and README.

Only allowlisted sanitized evidence belongs in the follow-up report: exact run
model/prompt/schema versions, fixture identities/equivalence, small public-safe
output excerpts, stage outcomes/counts/usage and labeled agent assessments. Private
raw bodies, credentials, private user material, media and local generated artifacts
must remain outside Git. Publication is coordinator-owned, on the same eventual
`feature/ai-feedback` PR stacked on `feature/rehearsal-review` while unmerged.
