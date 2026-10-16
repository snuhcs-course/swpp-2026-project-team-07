# Phase 4 recognition-only amendment

This is the current Phase 4 behavior, superseding manual/custom editing in the
[original Phase 4 ledger](phase-4-verification.md). The isolated branch remains
`it2/feature/ai_feedback`, HEAD `ee6233be2875739c6c9f8d2c62e9878e4ab759b7`.
The preceding uncommitted staged Phase 4 patch was SHA256
`5863eb5af5e51ae95bc9b8ee5191337e11e413e494dce78affe463fa5b4d785d`.
No commit, push, merge, new screen, Phase 5 or requirements-sheet work is authorized.

## Inspection and smallest responsible changes

| Dedicated to unrestricted editing: removed | Shared correction functionality: preserved |
| --- | --- |
| Sentence draft/TextInput, Save/Cancel, custom option, long-press/accessibility editor activation, arbitrary sentence replacement handlers/styles | Transcript viewing, sentence/header playback, native-position highlights, slide movement/navigation, first/return visits, existing rerecord/Compare workflow |
| `legacyCorrections`/`legacyCorrectionEvidence` adoption and slide-text spelling/phrase heuristics | Indexed overlays, original STT/audio/visits/attempt identity, revisions, no-op saves, SQLite offline state, sync/conflict controls, stale-response fences, explicit feedback updates and deduplication |

`LineEdit.text`, deck:v1 and old v1 caches remain stored for compatibility, but do
not replace spoken text. v2 caches isolate new recognition-only state. Unsupported
old server overlays remain in storage but are not applied. Only explicit PATCH
acceptance writes internal suggestion-job/policy provenance; merely generating a
matching offer never accepts an old manual edit. The external API still exchanges
three-field edits. No migration beyond the already reviewed Phase 4 migration is
needed. See the [updated API contract](../../../architecture/api-contract.md#phase-4-recognition-only-product-amendment).

The model receives text and slide context, not the source audio. Its instructions
and schema restrict candidates to recognition categories, preserve grammar, fillers,
repetitions and factual claims, and prefer no suggestion over unsupported changes.
Slide disagreement alone cannot justify changing speech. Users must review audio
before accepting. To change wording or substance, rerecord with the existing flow.
Model intent and schema validation do not establish acoustic correctness.

## Verification

Backend commands use the existing project Python environment. Automated/provider
integration tests are synthetic and make no live provider requests.

| Command / evidence | Actual outcome |
| --- | --- |
| `cd mobile && npm run check`; `/private/tmp/phase4-recognition-mobile.log` | 235 tests passed; typecheck/lint passed, with the existing `useSegmentPlayer` ref warning. |
| `cd mobile && npm run bundle:android`; `/private/tmp/phase4-recognition-android-bundle.log` | Android JavaScript export passed; no native dependency/configuration changes. |
| `python manage.py check --settings=config.test_settings` | No issues. |
| `python manage.py makemigrations --check --dry-run --settings=config.test_settings` | No changes detected. |
| `python manage.py test --settings=config.test_settings`; `/private/tmp/phase4-recognition-backend.log` | 338 tests ran successfully, 23 SQLite skips. |
| `PYTHONPATH=/private/tmp:. python manage.py test --settings=phase2_runtime_settings`; `/private/tmp/phase4-recognition-pg.log` | 338 tests ran successfully, one host dependency skip. PostgreSQL-only concurrency tests ran. |
| Full worker image, isolated PostgreSQL env, `python manage.py test rehearsals.test_corrections rehearsals.test_correction_migration --settings=config.settings`; `/private/tmp/phase4-recognition-worker-pg.log` | 17 tests passed, zero skips, including migration roundtrip/guarded downgrade and concurrency. |
| Separate Celery process + real isolated Redis/PostgreSQL; `/private/tmp/phase4-recognition-worker-integration.log` | Two deliveries per job produced one STT request and one coaching request; correction acceptance admitted no feedback job; explicit feedback used the corrected revision. Provider transport mocked. |

The dedicated worker-verification child is stopped and its database/private queue
are cleaned up after testing. Existing runtime media/database/normal queue remain.
No schema changes were added by this amendment; migration 0008 remains required.

Regression coverage includes unauthorized arbitrary text, negative grammar/filler/
repetition/factual rewrite cases, valid AI acceptance, restore, no auto-application,
multiple revisions, stale-offer rejection, cached/offline edits, synchronization
conflicts, original audio evidence and accepted-word display highlighting. Review
also reproduced and repaired future offers activating archived edits, historical
suggestion results blocking retry, and old rewrite-derived feedback appearing
current offline. Accepted corrections survive future analysis-version changes.

## Android evidence and limits

Agent-operated emulator checks use only the existing labeled
`Phase4-Synthetic-Corrections` recording, synthetic source speech and mocked AI
candidates. Acceptance of ChatGPTN → ChatGPT synchronized revision 4; cold reopening
retained it. Playback from the sentence highlighted ChatGPT at the original source
word interval. Restore original synchronized revision 5 and recovered the original
ChatGPTN. A fresh mocked candidate was kept original with revision 5 unchanged,
and no presentation-feedback job was admitted. Holding a transcript no longer opens an editor. Replacement, Keep original
and Play audio controls have no Custom option or sentence Save/Cancel controls.

Evidence outside Git: `/private/tmp/phase4-recognition-choices.png`,
`phase4-recognition-accepted.json`, `phase4-recognition-reopened.png`,
`phase4-recognition-highlight.png`, `phase4-recognition-no-editor.png`,
`phase4-recognition-restore-control.png`, `phase4-recognition-restored.json`,
`phase4-recognition-kept.png` and `phase4-recognition-kept.json`.
The original synthetic fixture's prior manual text is no longer displayed.

Physical-phone acceptance, human audible alignment and live-model suggestion
quality remain unverified. Offline persistence/conflicts are covered by SQLite
integration tests; the earlier failed network-disconnection experiment is not
claimed as offline Android evidence. Provider suggestions still require judgment.

## Physical-device checklist

1. Record natural speech containing a technical name, imperfect grammar, fillers,
   repetition and a deliberately inaccurate claim. Include a slide return visit.
2. Confirm transcript/header playback and word highlighting follow the selected
   source recording; first/return visit labels and slide navigation still work.
3. Tap Check transcription. Only plausible recognition errors should be offered.
   Grammar, fillers, repetitions and inaccurate explanations must remain as spoken.
   No candidates is a legitimate result; unexpected rewriting is a defect to report.
4. Tap a highlighted candidate. Listen with Play audio, then accept a suggested
   replacement or Keep original. There must be no custom field, sentence editor,
   manual Save/Cancel, or editor opened by holding/accessibility actions.
5. Accept a candidate, leave/cold-reopen, and verify persistence. Restore original
   and confirm the original STT returns with the same audio and visit identity.
6. Keep original on another candidate; its text and transcript revision must remain
   unchanged. Request a fresh check between revisions before accepting other offers.
7. Accept an available cached candidate offline; reopen and confirm it remains
   pending locally. Reconnect and Sync corrections. Resolve any conflict explicitly;
   if the offer has become invalid, restore the original and request a fresh check.
8. With existing feedback, accept/restore a correction: output should be retained
   but outdated, with no automatic generation. Use Update feedback explicitly.
9. Reopen screens and play audio repeatedly; these actions must not start AI work.
   To change substance or wording, use the existing rerecord/Keep-or-Overwrite flow.

## Review and inspection gate

Independent AI review identified and checked the repair of the three upgrade/
provenance defects above. Final staged-patch review and user inspection are required;
review evidence and exact patch hashes are supplied in the handoff. No AI review
is presented as human approval, and no commit/push/merge is authorized.


## Contextual transcript controls — October 16, 2026

Sync corrections is hidden when correction state is synchronized and error-free.
Pending edits, sync failures and conflicts expose only the appropriate recovery
controls. Check transcription remains an explicit, small action beside the
transcript heading. It is disabled during active work/conflicts; opening the screen
still never requests AI generation. Successful synchronization, absent checks and
completed/no-candidate checks leave no persistent status message. Pending/checking,
failures, outdated results and explicit recovery remain visible.

The user retracted a subsequent request for custom editing; no editor was added.
Correction APIs, accepted-offer enforcement, recording and feedback generation
rules are unchanged. Hook tests cover failure recovery through Sync and through
Check transcription, without extra provider work or clearing another take's error.
A reviewed fix also clears a prior sync failure after successful acceptance/restore.

`npm run check` passed 237 tests, types and lint (existing playback ref warning).
`npm run bundle:android` passed. Logs: `/private/tmp/phase4-quiet-controls-mobile.log`
and `/private/tmp/phase4-quiet-controls-bundle.log`. Agent-operated Android emulator
inspection shows the heading action and a clean synchronized transcript without
Sync/status clutter: `/private/tmp/phase4-quiet-controls.png`. No real AI request
was made for this UI follow-up. Backend checks above remain applicable to unchanged
backend code; they were not repeated for this presentation-only update. Physical
phone inspection is still pending. Independent review and exact staged artifacts
are provided with the handoff; no commit/push/merge is authorized.
