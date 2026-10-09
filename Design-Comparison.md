# OutLoud Design Comparison

**Team 07 | 9 October 2026 | Draft review companion**

**Historical benchmark:** Sections 1–6 record the Rev.3.0 comparison and checks. They are not a new evaluation of the merged Iteration 1 draft. The current design is in [Design-Documentation.md](Design-Documentation.md); current document checks are in [docs/design-document-checks.json](docs/design-document-checks.json).

This report compares the current course guidance, four previous-year examples, the existing OutLoud wiki, and the proposed replacement. It evaluates documentation quality, not the correctness or performance of the example applications. All four example pages were accessible. Their text and representative rendered architecture, class, database and workflow diagrams were inspected on 9 October 2026.

## 1. Course reference benchmark

| Example | Organization and depth | Strong practices to adopt | Weaknesses to avoid |
| --- | --- | --- | --- |
| [Team 16 - FitQuest](https://github.com/snuhcs-course/swpp-2025-project-team-16/wiki/Design-Documentation) | Revision history, architecture, class/data models, implementation details, then testing. | Component/responsibility and feature-flow tables; concrete session-state rules; database keys, relationships and domain invariants. | Small diagram labels at wiki width; sparse backend class-diagram explanation; some generic response descriptions; contents/heading numbering drift. |
| [Team 07](https://github.com/snuhcs-course/swpp-2025-project-team-07/wiki/Design-Documentation) | Architecture/sequences, frontend, API server, vector database and CI/CD; extensive API reference. | Explicit subsystem boundaries; component/service paths and responsibilities; state-ownership tables; sequences for important workflows. | Dense ERD; several diagrams have little surrounding explanation; long endpoint catalogue needs a concise overview and worked payload examples. |
| [Team 09 - StoryBridge](https://github.com/snuhcs-course/swpp-2025-project-team-09/wiki/Design-Document) | Linked contents, architecture/classes, detailed database model, API summary and expanded specifications. | Types, nullability, cardinality, deletion and compatibility notes; API-to-screen mapping; response/error examples; links to deeper class pages. | Summary says POST for cover upload while detail says GET; storage prose mentions both EC2 disk and S3. Some examples mix schema notation with JSON. Compact ERD depends on supporting tables. |
| [Team 04 - LingoFit](https://github.com/snuhcs-course/swpp-2025-project-team-04/wiki/Design-Documentation) | Revision/branching overview, architecture, frontend/services/ERD, pipeline and collapsible API details. | Consistent visual style; numbered sequence messages and stage annotations; domain service decomposition; standard error envelope and catalogue. | Frontend diagram is too dense at normal wiki width; architecture arrows omit payloads; sequence/API route and input labels differ. Collapsed details require expansion in PDF export. |

The examples' implementation descriptions are generally more explicit than their comparisons of alternatives. OutLoud should explain important tradeoffs instead of merely naming technologies. This is an editorial conclusion from the documents, not a claim about undocumented team decisions.

### Practices applied to OutLoud

| Dimension | Applied standard |
| --- | --- |
| Hierarchy and depth | One navigable design page with a short architecture overview, focused details, planned extensions and source references. |
| Architecture/data flow | Label payloads and runtime/storage boundaries; explain each component and interaction below the figure. |
| ER/class diagrams | Separate core persistence from processing records. Use component diagrams for React hooks/controllers instead of inventing object-oriented classes. Explain cardinalities and JSON storage explicitly. |
| APIs | Concise endpoint groups and one upload request/response example. Link the full contract for field, revision and error details; keep route names consistent with the sequences. |
| Sequences | Explain capture-to-review and explicit feedback/editing. Show meaningful recovery branches and point to full state rules in prose. |
| Decisions | State the problem, chosen approach, benefit and relevant alternative; label rationale inferred from code as current design reasoning. |
| Frontend | Identify the owner of recorder/player lifetime, state, drafts, routing, persistence and presentation layout. |
| Readability | Focused diagrams, labeled edges, legible type, repeated table headers, working links and PDF parity. No diagram-count target. |

All four examples include testing content. The current course guideline explicitly separates Testing Documentation, so application test plans/results are excluded from the OutLoud design draft. Detailed design patterns remain an Iteration 5 requirement; naming a pattern is not evidence that its required code example and explanation exist.

## 2. Existing-wiki comparison

The [live design page](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Design-Documentation) remains Version 1.0 dated 28 September 2026. Its two page-history commits are the initial design and an architecture readability adjustment. They do not establish later document revisions.

| Topic | Existing wiki | Replacement draft |
| --- | --- | --- |
| Implementation status | Mostly proposed; initial repository template described. | Establish merged, unmerged, local and planned scope once; keep exact revisions in the supporting snapshot. |
| Architecture | Worker, renderer and several libraries unresolved. | Name the actual client modules, Django/Celery/Beat, PostgreSQL/Redis, local files, PDF preparation and external adapters. |
| Data model | Proposed Owner, AttemptSlide, AnalysisRun and separate word/visit/evidence entities. | Actual Django models, relations, JSON fields and SQLite key/value records; future selection/ownership additions remain planned. |
| Public API | Hypothetical `/api/v1` resource routes. | Implemented `/api/` routes and actual payload/error conventions. |
| Alignment | Proposed midpoint assignment. | Start-time assignment; exact boundaries, simultaneous events and repeated visits. |
| AI workflow | One combined transcription/Gemini pipeline. | Hosted Whisper and independent explicit feedback; backend-configured OpenAI/Gemini selection, cached descriptions, revisions and evidence validation. |
| Recovery | Broad retry and asynchronous-job proposal. | Durable admission, generation/token claims, private receipts, partial results and explicit uncertain-request acknowledgement. |
| Frontend | Proposed library/setup/review/comparison screens. | Current feature controllers plus labeled local Home/Practice and Overview/Slides/Transcript redesign. |
| Remaining requirements | Iteration 2 items all described as future. | Recognize existing history/review/recovery; retain speech summaries, selected-slide retry, comparison, deletion and private access as planned. |
| Learning/testing | Prototype outcome table largely pending. | Explain resulting design choices and limits; link revision-specific testing evidence separately. |

The replacement does not alter the Requirements & Specifications page. Automatic initial transcription follows first-use consent, while coaching remains explicit. That difference from the older combined-processing narrative is documented as a design/requirement reconciliation item, not silently rewritten into an approved product requirement. The draft also flags NFR-05: app-backend upload currently precedes the transcription disclosure, whereas the requirement asks for disclosure before upload.

## 3. Revision history and primary source

Rev.1.0 (2026-09-28) and Rev.2.0 draft (2026-10-09) remain in the document history. Rev.3.0 review draft (2026-10-09) records this major diagram integration and prose revision. Excluded PRs are not document revisions. PR #13 is acknowledged only as recording work incorporated by #17.

`Design-Documentation.md` is authoritative. The PDF and HTML preview are built from its parsed blocks. The Wiki export changes only asset URLs to their intended publication location. Exact revisions remain in `docs/design-source-snapshot.json`; the approved Phase 1 package remains unchanged.

## 4. Before/after assessment

| Area | Previous Rev.2.0 draft | Rev.3.0 review draft |
| --- | --- | --- |
| Visual foundation | Six earlier Mermaid definitions and a separate PDF diagram renderer. | Approved Phase 1 SVGs: six figures, with 4 and 5 split into A/B panels. No architecture or diagram redesign. |
| Organization | Nine sections, with implementation qualifications and compact figure descriptions. | Same nine sections; figures introduce each design, followed by responsibilities, interactions and tradeoffs. |
| Architecture | PDF work grouped with workers; Beat described as the recovery actor. | Synchronous deck preparation belongs to the API; Beat schedules work and workers scan durable state. |
| Persistence | Model summary and revision inventory. | Core identities, JSON timeline storage, cache scope and revision dependencies explained as design choices. |
| API | Endpoint groups and one upload example. | Same focused contract overview, with one request/response example; detailed errors remain in the linked contract. |
| Workflows | Short sequences with compressed branching. | Approved permission/consent, upload, polling, recovery and feedback-edit branches integrated with explanations. |
| Frontend | Local design described alongside implementation detail. | Controller/state ownership and type-only layout boundary explain how views can be replaced without duplicating integrations. |
| Length and export | 12 A4 pages; approximately 2,917 non-diagram words. | 11 mixed-size pages; approximately 3,177 non-diagram words. Extra captions and rationale explain eight panels. Page counts are not equivalent measures of text reduction. |

The original 19-page audit-heavy draft had already been simplified to Rev.2.0 before this phase. This revision builds on that source rather than claiming to have removed another seven pages of prose. It keeps the technical depth needed to trace the system and avoids an exhaustive endpoint/error catalogue.

## 5. Unresolved discrepancies and proposed resolutions

| Issue | Verified implementation / document mismatch | Proposed resolution, not yet agreed |
| --- | --- | --- |
| NFR-05 disclosure timing | Requirements ask for external-processing disclosure before upload. Current recording flow uploads to the backend before transcription disclosure; cancellation leaves the server upload saved. | Add disclosure before the first backend transfer while retaining provider-specific consent. Requires an approved product/code change. |
| Automatic processing scope | Requirements describe automatic post-rehearsal processing. New-capture transcription can start after consent; coaching requires an explicit request and defaults to disabled. | Confirm automatic transcription with optional explicit coaching, or authorize an orchestration change. |
| Privacy and deletion readiness | NFR-05 requires owner-private rehearsals and deletion before beta. Current Compose design has no implemented ownership/authentication or complete deletion workflow. | Complete the planned access and lifecycle work before beta/deployment; this is an outstanding requirement, not an implemented feature. |
| Older supporting scope map | `docs/source-alignment.md` at the integration revision still calls saved-attempt/retry UI deferred, while PRs #19-20 implement saved review and recovery. | Update that supporting scope map in a separate documentation change; requirements and testing documents were not altered here. |

The older live Wiki also proposes `/api/v1`, midpoint alignment and hypothetical tables. Rev.3.0 replaces those proposals with actual routes, word-start alignment and model relationships. The live page remains unchanged until publication is authorized.

No technical contradiction requiring a Phase 1 diagram change was found. Figure 5B's brief quota note is qualified by the prose: OpenAI local waits may resume; Gemini local exhaustion requires an explicit retry. Diagram and application sources remain unchanged.

## 6. Final document review

| Criterion | Disposition | Evidence |
| --- | --- | --- |
| Completeness | Pass | Nine requested sections cover architecture, libraries, persistence, interfaces, algorithms, feedback and frontend boundaries. Iteration 5's two-pattern analysis is reserved for that iteration. |
| Technical specificity | Pass | Real models, service modules, endpoint groups, controller names, timing rules, cache scope, revision checks and failure recovery are explained and linked. |
| Consistency | Pass | 22 distinct source paths (24 occurrences) verified at the linked revision; both JSON examples parse. All eight embedded SVGs match Phase 1 bytes. |
| Rationale | Pass | Local/backend split, polling, database job state, JSON timelines, reusable descriptions and replaceable layouts explain benefits and tradeoffs without invented team discussions. |
| Readability | Pass | Plain Arial, concise tables, linked contents, descriptive captions and working local full-size image links. All 11 PDF pages visually inspected. |
| Diagram quality | Pass for local artifacts | All SVGs load in the Markdown-derived browser preview. PDF images match the approved browser-rendered pixels. A3/A2 figure pages preserve labels without redesigning the baseline. |
| Developer usefulness | Pass | Recording-to-review and feedback/edit/retry flows can be followed through state owners, persisted data and linked modules. |
| Evidence integrity | Pass | Main and open PR revisions rechecked; local state labeled. No application tests, deployments, human approvals or completed planned features invented. |
| Wiki delivery | Needs publication check | Local paths and generated Wiki URLs/package structure checked. Assets are not online; live GitHub rendering cannot be verified before authorized publication. |

Checks are documentation self-review only. `build_design_pdf.py` leaves Markdown unchanged. `check_design.py` validates text parity, pixel parity, source paths, anchors, links, font and bounds. All 27 unique public source/reference URLs returned HTTP 200. Poppler renders were inspected page by page. Application/device/provider testing was not performed.

## 7. Delivery and remaining submission work

- Primary source: `Design-Documentation.md`; preview: `Design-Documentation.html`.
- Approved SVGs, normalized PNG copies and editable sources: `assets/outloud-design/`.
- Current Iteration 1 Rev.2.0 PDFs (merged from the short and long drafts): [documentation](output/pdf/OutLoud_Design_Documentation.pdf) and [submission copy](output/pdf/team7-iter1-design.pdf). The obsolete root PDF is removed. Rebuilding also creates the local HTML preview and Wiki bundle.
- Wiki-ready derivative and assets: `output/wiki/`. It differs from the primary Markdown only in expanded asset URLs.
- The current export uses A4 portrait throughout, with 11-point Arial body text, tables and captions. Eight figures span twelve panels so larger diagrams remain readable. Earlier mixed-size exports remain in local archives.
- SVG rendering is confirmed locally. GitHub's [Wiki image guidance](https://docs.github.com/en/communities/documenting-your-project-with-wikis/editing-wiki-content) explicitly lists raster formats; PNG fallbacks are included in case its live renderer suppresses SVG.
- The user requested a PR for a proposed Wiki update. A brief Wiki publication was reverted after the user clarified PR-only delivery; the live Wiki tree matches its prior state. The repository PR contains the authoritative Markdown and review artifacts. Future Wiki publication, eTL upload and human technical approval remain outstanding.
