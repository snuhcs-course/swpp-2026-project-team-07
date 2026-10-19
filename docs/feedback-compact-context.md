# Step 1 compact selected-slide feedback context

New independent selected-slide review snapshots freeze
`request_context_version=selected-review-context-v1`; the public review contract
remains `slide-review-v3`.

The request includes full-deck authoritative facts and cue guidance once, indexed
original selected-visit words as compact column rows, at most twenty neighboring
words per side of each nonempty selected visit as context, the full corrected
transcript once as background, and confirmed correction ranges/revisions. Selected
word identities/timestamps and original-quote authority are preserved across
repeated/backward visits. Nearby/background text cannot become finding evidence.

The versioned layout instructions explain those roles. Deterministic validation,
model selection, output limits and generation/retry rules are unchanged. No
summarization or extra inference is introduced. Old singleton snapshots without
the marker retain their original reconstruction/hashes; unknown markers and the
discontinued grouped format are rejected. Existing active/current singleton work
is reused rather than regenerated on navigation.

Tests cover payload identity, explicit columns, context bounds, selected/repeated
visits, corrections, distant background, old request hashes, request-size limits,
invented quotes and saved-job reuse/update. Full-suite results are recorded in
[retained-feature verification](retained-features-verification.md).

Smaller JSON does not establish model usefulness, billed cost or latency. No paid
inference or provider comparison was run for this integration. Discontinued
benchmark/pilot runners are removed; this runtime optimization and its direct
synthetic regression tests are retained.
