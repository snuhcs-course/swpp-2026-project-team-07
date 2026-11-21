# Iteration 4 · Seoyeon

## Bilingual nitoryu UI and Galaxy installation

- **Date** November 21, 2026
- **Contributor** Seoyeon
- **Tool and model** OpenAI Codex, GPT-6

User request, verbatim

```text
Install this branch on phone  [https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/nitoryu](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/nitoryu)
this is the new ui we have to apply the langauge changes to. First let's check whats change and apply accordingly
```

Codex fetched `nitoryu` at `bdf3117` and compared its three commits to `90b4ce7`, the shared ancestor of the version 35 bilingual app. The port uses a separate local checkout. At the start of verification the connected Galaxy S23 Ultra had version 32 installed.

User follow-up, verbatim, in response to the shared Azure deployment scope question

```text
Also deploy nitoryu’s new feedback format to Azure
```

**Implementation.** Codex integrated the English/Korean flag and saved-result display cache with the redesigned Home carousel, landscape rehearsal controls, Feedback, Q&A and word-tappable Listen Back. The compact feedback view translates the headline, explanation bullets and next steps. Exact transcript quotations, suggested speaking lines and evidence times keep their saved values. Q&A keeps the question ID, panelist, answer recording and transcript through a language switch. The ignored mobile environment file points at the shared HTTPS demo API and requires its existing demo code.

**Review and revisions.** An independent Codex review reproduced a grading POST when a saved stale assessment had lost its phone-side start marker. Codex fixed the background host and tested both completed and stale assessments. Each mounted English → Korean → English check issued one initial status GET and zero grading requests. Review also checked that a localized Listen Back control can share its literal text with a spoken word such as “Open” without changing the recorded word or its seek time.

**Backend and rollout.** The user authorized activating the new format for team-wide future feedback. Codex deployed the five affected server modules over the existing bilingual image, checked the backup and recovery scheduler, verified there were no outstanding migrations, and confirmed all seven Azure services were healthy. A new invented Korean slide with an English recording produced six coaching cards and a score of 42. All 30 generated coaching fields displayed in each language. The six speaking examples, three evidence quotations and their times stayed exact, and the switches added zero transcription, grading or question-generation calls. The existing saved test assessment retained its hash.

**Automated checks.** Codex ran the mobile typecheck, lint, tests, Android export and signed Gradle release build. The Django system and migration-drift checks passed. The Django SQLite suite ran 743 tests with 29 skips. All 98 affected tests passed on PostgreSQL 16. A Celery worker backed by Redis 7 completed the mock-provider caching and deduplication check. The separate Azure rehearsal used real providers. These were agent-operated checks.

**Galaxy.** The final Android build passed all 764 mobile tests and both coverage gates. Codex installed version 36 (`0.1.0-nitoryu.1`) in place of version 32 on the Galaxy S23 Ultra. The installed APK matched SHA-256 `2d4327ef05304002ea4facbc6288e98ad693b3c4f946c42eae38b1e58948c6e8`. Android retained its original install date. The physical phone displayed Open → 열기 and all four neighboring hints in the selected language, restored English on the round trip and after a cold restart, and responded correctly to two successive quick taps. Codex left Korean selected. The check used cropped images of the app controls.

**Saved Q&A on Azure.** Codex opened the invented Study Room rehearsal through both the selected-context and recovery routes. They returned the same two question IDs and follow-ups. Four strings returned to their exact English wording after switching to Korean. Repeating the lookup reused the cached wording. The question-generation, transcription and grading counts stayed unchanged. This particular server fixture had no recorded answer.

**Android rehearsal and correction.** On an isolated Android emulator, Codex upgraded a version 35 test installation with an invented rehearsal. The app reopened saved whole and slide feedback, presented its cues and Q&A in Korean, and restored the original English. Listen Back replayed a selected English transcript word. Android started the read-aloud player for the question in each selected language. A separate phone-only answer recording played under question 2 in both languages. An offline restart also reopened the translated questions.

The emulator exposed a misleading banner on a fully translated whole-feedback card. The screen was also requesting two missing translations of slide-detail fields that it never showed. Codex restricted this view to its priority and improvement card fields while retaining the original cache keys for older assessments. The per-slide review continues to request its own rubric and coverage details.

For the before-and-after check, Codex kept those same two entries absent in the emulator's SQLite cache and turned networking off. The earlier APK showed the banner. The final signed APK displayed the cached Korean card without a banner and returned the exact English wording. The two unrelated entries were still absent after the switch.

**Follow-up from Seoyeon, November 21, 2026. OpenAI Codex, GPT-6.**

```text
INstall the nitoryu branch as well on the phone i want to compare the two both on the phone
```

Codex fetched the original branch at `bdf3117` and created a separate comparison checkout. Its Android package, launcher label, and URI schemes distinguish it from the bilingual installation. Both use the same Azure demo API.

The original branch passed `npm run check` (730 tests), `npm run bundle:android`, and the signed ARM64 release build. On the Galaxy S23 Ultra, Codex installed the comparison APK as `com.team07.outloud.nitoryu`, version 30. The existing bilingual package retained its version 36, install times, UID, and APK hash. Codex launched both app entries and checked that Android showed two distinct tasks in Recents. OutLoud Nitoryu opened at its own demo-code prompt. Each installation has its own local storage.

### November 21 follow-up on instant Korean and English coaching

Seoyeon reported two states on the bilingual Galaxy app. Korean rehearsal cues
and slide feedback showed English coaching underneath Korean labels during a
translation request or after it failed. OpenAI Codex, GPT-6, worked on this
follow-up. The two phone screenshots were supplied by the user.

User request, verbatim

```text
Can we make the translations instant? LIke if the app setting is in korean then there should be now waiting for englihs, or retries for translations. Because there are cases where translations fail hence user who chose korean is left with english cues.
```

Codex asked (private rehearsal name redacted), “May I prefill Korean for the saved [rehearsal name redacted] rehearsal now, so I can verify the exact slides you reported? This sends its saved AI coaching text to the app’s existing translation provider. Slides and audio are excluded.”

User decision, verbatim

```text
Yes, prefill and check my rehearsal
```

Codex matched the failed Korean slide-three cue batch to a numeric validation
error in the Azure worker. An invented case reproduced the discarded sibling
fields. The revised worker keeps the accepted fields and corrects the offending
one. The bilingual client now enrolls display results for the selected rehearsal,
takes both wordings into its local cache, and reads the selected one when the flag
changes. A short localized status covers a first unsynced or unavailable field.
The fixed rubric and slide-review facts use bundled copy. The phone’s recordings,
quoted evidence and suggested practice sentences retain their original wording
and identities. Codex checked all 35 bundled rubric entries against the scoring
rubric. Seoyeon authorized a one-rehearsal provider check. The other recording of
the same deck and the separate nitoryu comparison installation are outside that
check.

Codex built the signed version 37 APK and installed it over version 36 on the
Galaxy S23 Ultra. The installed bytes matched the verified build, Android
retained the original install date, and the separately installed comparison APK
retained its version 30 hash. On the selected rehearsal, the app showed the
same slide-two headline, explanation and improvement step in Korean, English
and Korean again. The suggested sentence remained English. The measured time,
coverage count and rubric heading displayed in Korean. Codex repeated the
feedback check with Wi-Fi and mobile data off, then restored both settings.
The two visible slide-three cues and the saved first audience question also
matched their prepared wordings through both switches. This saved rehearsal
had no answer bindings. On an offline Android emulator, an invented rehearsal
played the same archived WAV under question two in both languages and Android
TTS started in both en-US and ko-KR.

The first full hosted verification exposed five Korean fields whose original
coaching contained a named English calendar month. The validator treated the
conventional Korean numeric month as a new quantity. This included one cue and
one follow-up. The first round of agent-operated device checks covered the
visible cards while those fields were being corrected.

The general calendar fix protects a dated expression as a unit. Preparation
keeps the day, month and year in both languages and keeps same-language source
wording byte for byte. Tests cover month/year expressions, a modal use of
“May”, an imperative use of “March”, and dates inside an exact quotation.
The final full Django run completed 766 tests with 29 skips and zero failures.
All 138 focused PostgreSQL tests passed. A Redis/Celery round trip used an
invented result and a synthetic provider. The final mobile check passed
TypeScript, lint and all 775 tests. Both coverage gates, the Android export and
the signed ARM64 build passed. The Galaxy also restored the whole-presentation
card after two quick flag taps. These were agent-operated checks.

After the calendar correction, the development API returned both languages
for all 173 fields in the approved rehearsal. The 12 cue fields, 146 feedback
fields and 15 Q&A fields passed the Android display validator. All 173 English
fields exactly matched their original source strings. The corrected slide-three
detail sheet on the Galaxy showed the original date expressed in Korean. Both complete must-cover cue
texts matched the saved Korean strings by hash. Codex left that sheet open in
Korean. The comparison APK kept its separate launcher entry and original bytes.

The final post-device Azure snapshot matched the prefill baseline and the
post-preparation snapshot for the recording, grading and Q&A. The run retained
its three saved question identities. The switch and device checks added zero
transcription, grading or question-generation jobs. The seven services were
healthy on the calendar-corrected image. The local release verification folder
contains the Azure receipt, the signed APK hash, and the physical-device and
invented-emulator checks.

### November 21 follow-up on the pull request and Android download

**Contributor** Seoyeon. **Tool and model** OpenAI Codex, GPT-6.

User request, verbatim

```text
Update looks good make pr with the new language support changes on the new nitoryu ui.&#x20;
put reviewer as injoon jun so this can be merged to main. Also add this version apk onto the repo as well
```

Seoyeon approved the tested update for a pull request and named Injoon Jun as reviewer. Codex integrated the published nitoryu UI at `bdf3117` with the contributor-log changes on `main`, prepared the bilingual client and backend, and added the Galaxy-tested ARM64 version 37 APK under `output/`. Its SHA-256 is `01000d5f38cc7b65c8792e8c19dbcca7907237398ac0e631c2a921bcfc706fe2`. The README links the build and identifies the existing demo-code requirement.

Seoyeon added a default-presentation requirement before publication. The attachment was `Seoul.pdf`. User request, verbatim

```text
add on the apk as a default slide this seould presentation. This should be the sole presentation in the apk
```

Codex compared the supplied PDF, the source asset, and the only PDF entry in the signed APK. All three have seven pages and SHA-256 `48e673f2dce98c5b4a67a1ad52fcb68092bdc5d606c03d68892e6b187be1f9aa`. The existing seeding path registers it once. Five focused tests passed for offline initialization, repeated launches, and preservation of imported presentations and recordings. The Galaxy still had version 37 installed. Codex retained the signed build.

On a fresh Android 16 emulator in airplane mode, the Home library contained one presentation. Codex opened all seven slides, force-stopped the app and opened all seven again. All 14 screen captures matched their corresponding PDF pages. A read-only checksum on the Galaxy matched the staged APK.

During independent AI review, two completed legacy slide reviews on one recording exposed a defect. The prepared display endpoint kept returning an empty pending result, so the v37 app kept polling. Codex added backend regression tests, observed them fail, then fixed preparation for independent slide reviews and score contexts. Where two contexts give different wording for one field, the phone can request the exact saved source. The tests cover pending peers, conflicting contexts and preservation of the original results.

For publication, Codex reran mobile typechecking, lint, all 775 tests and the Android export. The Django system and migration-drift checks passed. The SQLite suite ran 768 tests with 30 skips and zero failures. All 140 focused PostgreSQL tests passed, and a Redis/Celery worker prepared both languages from a synthetic provider. The additive schema accepted an insert from the previous worker format. These checks used the PR checkout for the backend and the matching signed-release source for mobile.

A follow-up review exercised v37’s exact-field fallback after an uncertain provider timeout. The app’s automatic `retry: true` could submit the same failed translation again. Codex reproduced the duplicate requests and added a guard for enrolled results. The regression observed one provider invocation across four automatic retries, preserved the delay for safe retries, and exercised explicit recovery for the exact failed translation. The existing APK and its signing identity stayed the same. The final SQLite suite ran 770 tests with 30 skips and zero failures. All 142 focused PostgreSQL tests passed, followed by the Redis/Celery worker check.
