# Swappable UI layouts

The current navy/coral layout is **Refactor Design**, registry ID `refactor`, on `codex/refactor-design`. Its functional dependency is PR #21 commit `ce9f248`, including the normal #19 → #20 → #21 dependency merges. No backend endpoints, wire types, databases or recording formats change for layout selection.

## Select at startup

`EXPO_PUBLIC_UI_LAYOUT=refactor` selects Refactor Design. Omitting the setting does the same. Unknown values, including an empty string, throw a configuration error. Restart Metro/development app after changing `.env`; production builds select their layout when built. There is no in-app picker or session-time switching.

`EXPO_PUBLIC_UI_LAYOUT=contract-test` is allowed only with Expo's `__DEV__` flag (or Node's test environment). Production rejects it. This test layout replaces bottom Home/Practice tabs with stack-header navigation, puts review transport above content, and places review tabs at the bottom. Other screens delegate to Refactor Design. Registration is pure: importing/selecting a layout never processes audio or generates feedback.

## Ownership

| Shared host/controller | Responsibility | Layout surface |
| --- | --- | --- |
| `LibraryScreen` / `useLibraryController` / `usePracticeLibrary` | Import, focused refresh, history reconciliation, API-scoped offline summaries, guarded routes | Home, Practice and complete library cards |
| `ViewerScreen` / `useSetupController` | Confirmed native PDF page, deck identity and start eligibility | Setup and audience input |
| `RehearsalScreen` / `useRecordingController` | Native recorder lifetime, permissions, interruptions, audio-relative checkpoints, durable save and one-use review handoff | Recording and saved completion |
| `SavedAttemptScreen` / `useSavedReviewController` | Single native player, media validators, seek/recovery, analysis consent/retries and lifecycle | Review panels and transport |
| `FeedbackPanel` / `useFeedbackController` | Revision-aware generation/editing, drafts, conflicts, validated evidence callbacks | Feedback and description editor |
| `UtilitiesScreen` / `useUtilitiesController` | Connection check and sample navigation | Utilities |
| `ResultsScreen` / `usePreviewController` | Legacy labelled sample playback and fixture-only preview state | Sample review |

Expo Router files remain route adapters. Existing `/viewer`, `/rehearsal`, `/results?attemptId=…`, sample parameters, `/library` and `/utilities` links remain valid. Review panels are presentation state, not routes. Layout navigation shells use Expo Router primitives; screen actions come from the shared controllers and preserve their parameters and eligibility checks.

`mobile/src/layouts/contracts.ts` is the public type-only facade. Models project deliberately selected display state, capabilities, guarded callbacks and opaque native React surfaces from the controllers. They expose no raw recorder/player, storage service or API client. Type-only projections track the shared model without importing integration code at runtime. Native PDF callbacks stay inside hosts; mounting a slide surface never gives a layout permission to invent a confirmed page. A layout must render each stage once and keep its stage mounted while capture/playback is active.

The review host owns media validators outside the layout and keeps one feedback controller above all panels. Layouts arrange views without owning processing/draft lifetimes. `bindSlideReveal` registers the layout's slide-reveal callback; evidence uses it and the shared validated seek path. Register it in an effect and return its cleanup. Drafts and player intent survive panel changes. Blur/background still pause through the shared playback controller.

## Add another design

1. Add a directory under `mobile/src/layouts/` containing pure views, tokens and navigation shells. Import model types from `../contracts` with `import type`.
2. Implement the `Layout` interface. Supply root/main navigation, Library, Setup, Recording, Review, Feedback, Utilities, Preview, Message and surface views. A view receives a `model`; invoke its callbacks and use its capability fields to disable unavailable controls. Do not make network requests or recreate native controllers. See `refactor/` and `contract-test/` for complete examples.
3. Register the implementation in `registry.ts`, extend `selection.ts` with the new ID, and give it an explicit production/development policy. Selection is evaluated once at JS launch. Do not add route changes that discard attempt IDs or PDF parameters.
4. Run `npm run check`, `npm run test:layouts`, and `npm run bundle:android` in `mobile/`. Add a test-mode run for the new ID. `lint` runs the import-boundary audit, blocking services, feature internals, raw native modules, dynamic integration imports and network calls inside layouts. Only the type-only public contract facade can reference controller types.
5. Check Android separately: import → confirmed page → record → durable save → automatic upload/disclosure → review; repeat backwards/instantaneous slide visits, panel changes, evidence seeks, edits/conflicts, offline/missing-media recovery and cancellation/retry. Device/provider evidence is separate from test doubles and JS export.

Browsing and selection never authorize provider generation. Only the durable, API-pinned new-capture intent can begin initial transcription automatically, after consent; cancellation and old/failed/uncertain work retain explicit controls. Feedback generation always remains explicit. Keep unsupported prototype controls out of every production layout.
