# Phase 2 category guidance — live comparison, October 15, 2026

This is an agent assessment of two presentations (seven slides), not human
acceptance or a statistical quality benchmark. OpenAI `gpt-6-luna` ran through
the isolated PostgreSQL/Redis/full-dependency Celery worker. No recordings were
submitted for this cue evaluation. The same model and saved source snapshots
were used for historical v1 and revised categories; both source fingerprints and
snapshot objects matched exactly. Historical results were reused, not regenerated.

The first category prompt (v2) improved numerical interpretation but still
produced descriptive restatements. Its food-slide Must Cover asked the presenter
to describe a dish and ingredients. The final v3 prompt rejects such objectives,
allows descriptive slides to have no essential points, and asks for specific
investigations when an enrichment needs evidence the deck lacks. v2 remains a
supported immutable historical scope, with its original prompt bytes retained.

## Results by slide

| Input | v1 behavior | Final v3 behavior | Assessment |
| --- | --- | --- | --- |
| Small chart, 20 → 40 units | Compare the two visible labeled values | Must Cover explains +20 units, doubling and 100% rather than 20%; Go Deeper asks which factors account for it and explicitly requests evidence | Specific, nonredundant, useful interpretation; supported arithmetic; cause remains unknown and optional |
| Guatemala title | Introduce the deck's topic | Both collections empty | No padded speaking objective |
| Guatemala overview | Summarize capital/language/currency; identify neighbors | Both empty | Removes bullet restatement; conservative, possibly misses useful enrichment |
| Heritage/history | Contrast two site descriptions, repeat dates and UNESCO designation | Both empty | Removes visible-fact checklist; historical-date interpretation from v2 is lost, worth human assessment |
| Culture | Describe languages, textiles and processions | Both empty | No fabricated cultural context; conservative omission |
| Landscape/elevation chart | Introduce pool image, summarize landscapes, name highest/lowest volcano | Must Cover identifies an elevation comparison and quantifies the highest–lowest difference as 1,634 m; no Go Deeper | Difference adds meaning beyond chart reading; essential interpretation is specific and numerically supported |
| Food/coffee | Repeat familiar foods, stew ingredients and coffee regions | No Must Cover; optional question asks how preparation methods shape the dish's flavor/texture, with explicit research needed | Specific preparation opportunity beyond the visible ingredient list; no invented answer or established causal effect |

Across the final two inputs there are two Must Cover points and two Go Deeper
questions. The six-slide deck is deliberately sparse (one of each). No supported
cross-slide connection was emitted by v3 in this sample. v2 did emit connections
between overview/language and opening/landscape slides. Cross-slide structure and
certainty validation are additionally exercised by synthetic tests; those tests
do not establish the final prompt's tendency to find useful connections.

## Five evaluation dimensions

- **Specificity:** All four final nonempty points refer to the actual values,
  elevation comparison or named dish. v1 mostly identified items to repeat.
- **Non-redundancy:** Both numerical objectives add derived meaning. Both optional
  questions require explanations absent from the deck. v2's ingredient objective
  failed this criterion and prompted the versioned refinement.
- **Usefulness:** Arithmetic distinctions help prepare an explanation; missing
  evidence is actionable. Empty descriptive categories avoid busywork, but the
  final prompt may be overly conservative. Presenter judgment remains pending.
- **Grounding:** References, source IDs, certainty and exact premise quotes pass
  validation. The chart differences match the supplied values. The provider may
  still misread images or make semantic leaps despite valid references; this
  small review cannot prove universal factual correctness.
- **Category correctness:** Essential points interpret current-slide comparisons.
  Enrichments are optional questions with `information_needed`; neither is
  treated as mandatory feedback. No Phase 5 behavior was implemented.

## Reproducible local evidence

Temporary evidence is outside Git and may disappear when local scratch storage
is cleaned. It contains presentation profiles, no credentials or recordings.

- `/private/tmp/phase2-guidance-comparison.json`: original v1 versus v2 pilot.
- `/private/tmp/phase2-guidance-v3-comparison.json`: v1 versus final v3, complete
  profile outputs, immutable IDs, source equality, receipt status and usage.
- `/private/tmp/phase2-guidance-v3-small-result.json` and
  `/private/tmp/phase2-guidance-v3-deck-result.json`: final API envelopes.

| Input | Original set | Final set | Final receipt usage (input/output/total) |
| --- | --- | --- | --- |
| Small chart | `e49be5b5-f392-4c5e-8969-1ea73386c473` | `77e07c89-9060-43f7-ac4a-e49bdc0a2bb4` | 1432 / 763 / 2195 |
| Six-slide deck | `dba3b38e-d410-4902-a590-dbe6e295475f` | `18ba5a59-9056-47ec-9532-ffceb1351c77` | 10631 / 3589 / 14220 |

Both final receipts are HTTP 200. Original profile JSON SHA-256 values are
`db0c5b16b569170d925bf8ee4011fe8d3b4b2258d3c813fa0c2f1135084c1a4c`
and `920df236b77cc074a2a291bc6bbaf2a2fad5c35c814894af70fe986a4681916e`.
The two v2 pilot jobs and two v3 jobs are separate intentional paid scopes,
not duplicate retries. Provider project limits were not changed; the previously
authorized application admission limit remained in use.

## Short-cue follow-up (current v4)

The user subsequently requested a hard 15-word maximum, one objective per cue,
keywords/contrasts, no linking rationale, expandable details, and more coverage
on readable slides. v4 supersedes v3's conservative prompt. It retains the
structure and all historical profiles while enforcing word counts in backend
and mobile with the same explicit Unicode-whitespace policy.

The same two input snapshots were evaluated again using the real provider.
The first full-deck receipt contained one 16-word food cue and was rejected in
full; its paid receipt remains saved. One explicit revisioned retry succeeded.
The implementation neither truncates nor relaxes the limit to rescue output.

| Input/slide | Current Must Cover | Words |
| --- | --- | --- |
| Small chart | 20 to 40 units: doubling, +20 units, +100%. | 8 |
| Title | Empty | 0 |
| Overview | Capital, official language, currency, and four neighbors situate Guatemala in Central America. | 12 |
| Heritage | Tikal’s Maya temples and Antigua’s colonial architecture represent distinct heritage; both are UNESCO sites. | 14 |
| Heritage | Independence from Spain dates to 1821; September 15 remains Independence Day. | 11 |
| Culture | Living culture spans linguistic diversity, continuing Maya weaving traditions, and communal Holy Week observances. | 14 |
| Landscape | Guatemala’s landscape includes forest pools, volcanic lakes, northern tropical forest, and two coastlines. | 13 |
| Elevation chart | Tajumulco leads Acatenango by 227 m and Pacaya by 1,634 m. | 11 |
| Food | Corn foods, pepián, and regional coffee production offer distinct examples of food and daily life. | 15 |

Go Deeper on the food slide: “Antigua appears as both a former colonial capital
and a coffee-producing region.” (12 words.) It keeps factual cross-slide premises
without adding why linking is needed. Other optional categories were empty.
Every readable content slide now has one or two essential points; the title
remains empty. Numerical and heritage contrasts are particularly useful. Several
descriptive cues remain close to summaries of visible facts, so brevity and
coverage are verified here, not universal non-redundancy or human acceptance.

Details are collapsed by default in the existing cue area. Expanding shows the
referenced factual premises and any missing-information field; navigating slides,
categories or profile scopes resets expansion. No Phase 5 analysis was added.

Real-worker evidence: `/private/tmp/phase2-concise-worker-evidence.json` and API
outputs `/private/tmp/phase2-concise-{deck,small}-result.json`. The full deck set
`a5a52aa7-85f7-450c-96bb-f05fc7d04384` completed at revision 2 (one known failed
generation followed by one successful retry; final usage 10710 input/3303 output/
14013 total). Small chart set `989193f4-5035-4730-a235-b316c96461f7` completed at
revision 1 (1511 input/473 output/1984 total). No automatic rescan on reads or
duplicate admission was introduced. Historical v1–v4 prompt identities were
checked against saved digests.
