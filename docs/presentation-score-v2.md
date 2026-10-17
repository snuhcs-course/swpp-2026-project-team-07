# Unified presentation and slide scoring — presentation-score-v2

Implementation contract approved October 17, 2026. This extends the existing feedback transport; v1 and all experiment receipts remain historical. No live grading reliability is claimed.

## Frozen scoring

Levels `beginning`, `emerging`, `competent`, `advanced` have units 0, 1, 2, 3. Slide criteria: `essential_coverage` (40), `explanation_depth` (35), `clarity_relevance` (25). Whole criteria: `structure`, `coherence`, `audience_suitability`, `delivery`, equally weighted within 30 overall points.

S_i=(40*u1+35*u2+25*u3)/3. W=100*sum(whole units)/12. Overall=7/10*mean(S_i)+3/10*W. Use Fraction/exact integer arithmetic and ROUND_HALF_UP once for the published integer. Never average displayed integers. Save numerator/denominator and selections. Descriptors use unrounded boundaries 100/6, 50, 250/3, ties higher. All competent displays 67. These are provisional rubric points, not calibrated grades or percentiles.

Evaluate communicated meaning, not resemblance to slide text. Reading bullets, length, optional elaboration and detail earn no automatic credit. Apply requirements, genre, audience and slide role; missing requirements remain unspecified. Slides are not factual authority. Unsupported reasoning and unverifiable factual accuracy are different limitations. Only recognition-error corrections may change interpretation; original words remain citation authority.

| ID | Beginning | Emerging | Competent | Advanced |
| --- | --- | --- | --- | --- |
| essential_coverage | Essential meaning missing or obscured | Partial meaning with consequential gaps | Essential meaning communicated appropriately | Essential meaning communicated with effective prioritization |
| explanation_depth | Essential meaning remains unexplained | Important relationships remain unclear | Suitable explanations or examples establish meaning | Explanations connect relationships and implications effectively |
| clarity_relevance | Ambiguity or digression obstructs understanding | Recurring friction obscures the message | Clear, relevant expression supports understanding | Precise, economical expression consistently aids understanding |
| structure | Purpose or ending leaves the message unresolved | Opening or conclusion provides weak orientation | Purpose, organization and takeaway are clear | Opening and conclusion form an effective framework |
| coherence | Disconnected sequencing obstructs understanding | Unexplained jumps interrupt connections | Ideas and transitions form a logical sequence | Relationships and transitions build a coherent whole |
| audience_suitability | Framing substantially obstructs the supplied audience | Consequential assumptions remain unexplained | Context and terminology suit the supplied audience | Framing consistently anticipates audience needs |
| delivery | Supported continuity or timing problems materially obstruct communication | Supported disruptions sometimes impede understanding | Continuity and time allocation support understanding | Intentional continuity and pacing consistently aid processing and emphasis |

## Eligibility and validation

All deck slides are represented exactly once. Default applicable. Only first/last slide may be `not_applicable`, with explicit evidence and justification that no essential communication is required. Unvisited applicable slides are `not_recorded`; no overall total. All positive-duration visits to a slide are reviewed chronologically, including backwards/repeated visits. Do not use the legacy 1000ms eligibility threshold to reject concise sufficient speech. Its report remains diagnostic for v1.

Each applicable slide needs all three criteria; whole needs all four. Criteria select `assessed` with a valid level, justification, usable references, limitations, deductions; or `insufficient_evidence` with null level and explicit limitations. Invalid score evidence suppresses that slide/whole component and overall, but other valid slides survive. Unknown/duplicate criteria or slide identities fail closed. Insufficient evidence is different from demonstrated missing essential meaning; omissions require full-attempt review and an identified essential fact or requirement.

Prompt `presentation-score-prompt-v2.1` explicitly requires assessed delivery and its weaknesses/deductions to cite supporting speech alongside an eligible non-signal measurement; duration requirements or measurements alone cannot establish it.

Audio unavailable/corrupted/insufficient suppresses overall; do not invent measurements or renormalize away delivery. Pauses/rate/fillers/repetitions need explained communication consequences for deductions. Relative signal levels describe recording context. No confidence, emotion, pronunciation, vocal expressiveness, gestures, eye contact or Q&A grading.

Shared weaknesses use unique IDs and one primary criterion key (`slide:<index>:<id>` or `whole:<id>`). Secondary deductions require a distinct consequence and supporting evidence. Provenance validation cannot prove semantic support or detect all disguised duplicate penalties.

## Model selection and reconstruction

Root model output: `{rubric_version,source_id,full_attempt_reviewed,slides,whole,weaknesses,feedback}`. Root source_id is the v2 snapshot identity.

Slides: `{slide_index,status:"assessed"|"insufficient_evidence"|"not_applicable",justification,evidence,criteria,feedback}`. Criteria: `{id,status:"assessed"|"insufficient_evidence",level,justification,evidence,limitations,deductions}`. Whole is an array of four criteria. Each deduction: `{weakness_id,consequence,evidence}`. Shared weakness: `{id,primary_criterion,observation,evidence,omission_basis}` where omission_basis is null or `{kind:"essential_explanation"|"requirement",explanation}`.

Feedback: `{summary: Advice|null,strengths: Advice[],weaknesses: Advice[],improvements: Advice[],improvement_shortage: string|null}`. Advice: `{text,evidence}`. At most three improvements, no padding. Each optional item is validated independently (including malformed items); a bad optional item never invalidates scoring. Shared weakness records used by deductions are score-critical, unlike optional displayed weaknesses.

Speech selection ONLY `{kind:"speech",visit_id:"v3",visit_word_start:0,visit_word_end:12}`. Local positions zero-based inclusive. Supplied visit IDs are explicit enums. Source contains original per-visit rows with `visit_word_index`, not a second selectable global index. Canonical slide selection ONLY `{kind:"slide",fact_id:"s1:key_ideas/0"}` with enumerated certain fact handles. Other compact selections: `{kind:"measurement",measurement_id}`, `{kind:"requirement",field}`, `{kind:"full_attempt"}`.

Backend derives full original evidence via the frozen registry and calls unchanged v1 strict `_references`. Reject unknown visits/facts, bool/float indices, reversed/out-of-range bounds, gaps, ambiguous visits/segments and cross-visit selections. Never clip/split/fuzzy-match/repair. Multiple noncontiguous intervals are separate selections. Preserve raw selections and derived references separately in private job audit. Bind exact prepared request hash, attempt/transcript/source/correction/profile/requirements revisions and protocol. Never reinterpret prior failed provider receipts as v2 scores.

## Public response and transport seam

GET `/api/attempts/{id}/presentation-score/?context_id=<UUID>` (omit query for null context). POST same route accepts `{context_id: UUID|null,expected_selection?,transcript_revision?,feedback_revision?,acknowledge_uncertain?}`. No client-selected transcript, slides, intervals or scores. Reuse existing selection/revision/quota/uncertainty guards; repeated identical POST reuses current active/completed work. A completed invalid-evidence assessment permits a revision-fenced explicit Retry with existing cooldown and uncertainty checks. The exact recognized previous scoring protocol may start a fresh generation; old receipts are never reinterpreted under new instructions. GET never admits grading. The app-level automatic workflow may POST once eligible selected recording inputs are ready, and again after synchronized scoring inputs change; ordinary indicator reads remain GET-only. Unscored historical recordings are eligible only when selected in a presentation the user opens.

New analysis type is `score_` plus 24 hash characters of canonical context identity; one owner per attempt/context. Versions stay in frozen generations. Existing jobs/requests/JSON fields; no scoring table. Reuse current provider/model and adapter. One request yields slide and whole assessments and score explanations; do not request separate generated feedback to fill the score cards. Singleton feedback remains independent and its findings are never converted to rubric selections.

The response extends the existing durable feedback state envelope (`attempt_id`, `feedback_revision`, `transcript_revision`, `state`, `stale`, `selection`, `availability`, retry/dependency/error/times). Add `schema_version:"presentation-score-v2"`, `rubric_version`, `context_id`, `source_identity:string|null`, `assessment_status` and `result`.

Assessment status: `not_graded|pending|scored|partial|incomplete|insufficient_evidence|unavailable|invalid_evidence`. Provider failure/input limits/unknown outcomes remain distinguished by durable state and safe error codes. Staleness is orthogonal and suppresses current numeric display.

Result core:
```
{
 rubric_version: "presentation-score-v2", source_identity: string,
 assessment_status: string,
 overall: {status: string, score: integer|null, level: string|null,
           exact: {numerator: integer,denominator: integer}|null,
           components: {slide_mean: Exact|null,whole: Exact|null}},
 slides: [{slide_index: integer,
           status: "scored"|"not_applicable"|"not_recorded"|"insufficient_evidence"|"invalid_evidence",
           score: integer|null,level: string|null,exact: Exact|null,
           justification: string,criteria: Criterion[],evidence: Evidence[],feedback: Feedback}],
 whole: Criterion[], feedback: Feedback,
 validation: {score_critical:{rejected_count:integer,reasons:string[]},
              optional:{rejected_count:integer,reasons:string[]}},
 evidence: <existing FeedbackEvidence authoritative source/visits/descriptions metadata>
}
```
`Criterion` retains model assessment fields and reconstructed evidence. Derived evidence uses existing full evidence shapes (`quote` for speech; original word range, attempt/transcript/slide/source/visit/segment identities and ms). Only validated feedback leaves the server. Raw provider responses, raw selections and private reconstruction audits do not enter public responses. Public earned/max details may be derived from frozen criterion weights/units and returned alongside criteria. Existing feedback routes/shapes remain unchanged.

Core service interfaces (owned by scorer workstream): `presentation_score_v2.prepare(bundle, config) -> PreparedRequest`; `normalize(bundle, prepared, receipt) -> result dict`; `validate_output(bundle, raw) -> result dict`; `source_identity(bundle) -> str`. Bundle is the existing trusted v1 Bundle; v1 capture/provenance remains unchanged. v2 identity adds its frozen rubric/prompt/schema/reconstruction versions. Integration constructs/restores the Bundle from trusted existing job snapshots. Source and publication fencing must include revisions even if displayed text is unchanged.

## Mobile behavior

Use versioned, API/attempt/context/source-aware validated cache and deduplicated GETs. The app-level host admits automatic initial scores and refreshed scores after synchronized corrections/settings (one-second debounce). Eligible sources come from new selected recordings or the selected run of an opened presentation; unused history is not backfilled. Normal Grade/Update controls are removed. Retry and uncertain-charge acknowledgement remain explicit, and failed or rejected current-protocol results do not automatically retry unchanged inputs. Preserve source-selection fences and saved results through offline reads; stale/uncertain responses cannot overwrite newer results. Unrecognized server schemas remain readable as legacy feedback but do not fabricate scores.

Full Review ring: integer, proportion 0–100, `Overall score`, derived performance label. Slide ring: `Slide score`. Tiles display each selected source's score. Not graded/loading/stale/unavailable/insufficient/recovery states use no fake number. Keep existing timing/fillers/WPM/audio/transcript/thumbnail/graph/coverage/recovery/navigation. Replace visible findings with feedback/feedback items. Show summaries, strengths, weaknesses and actionable improvements directly with supporting evidence playback. Hide criterion cards, weights, anchor descriptions and the explanations toggle. Use the validated unrounded backend level for colors: Beginning red, Emerging amber, Competent green, Advanced blue; unavailable states stay neutral.

A composed run may show per-slide scores from its original attempts but no overall total. Require one attempt with exact original visit selection and every applicable slide; `Run.full` alone is not proof. No old-attempt substitution. Home uses the same exact selected-run overall projection as Full Review, with no latest-old-attempt substitution. It displays total current verified findings once, selected-run duration and WPM. Home indicator reads do not grade.

## Gates and boundaries

No paid inference, commits, pushes, merges or deployment. Preserve the historical $2 ledger: recorded settled $0.10330350, unresolved $0.08667250. Do not modify/release reservations or rerun old experiments. All automated/Android checks use mocked providers. New live work needs an exact-request cost dry run and separate authorization. Reliability needs the independent human pilot (10–20 diverse recordings, two blind reviewers on a shared subset, repeat unchanged calls, citation/support/usefulness/fairness audits), separate from correctness tests.
