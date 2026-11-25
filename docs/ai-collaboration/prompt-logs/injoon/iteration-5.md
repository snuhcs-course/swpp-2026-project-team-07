# Injoon — Iteration 5

[AI collaboration index](../../README.md).

## Integrate the ONE Store build 40 changes into main — November 23, 2026

**Contributor:** Injoon · **Iteration:** 5 · **Tool:** OpenAI Codex desktop (GPT-6) with Git and GitHub CLI.

```text
I want to merge our release changes (seoul deck, etc) to the current main which just had pr 64 merged. but in the branch it said some commits are behind.
```

- Codex verified that `main` at `b052f75` already included PR #64. The release branch was one ahead and three behind. Codex applied release commit `bf2c616` to the current `main` on an integration branch, then verified that the five changed files exactly matched the published release source.
- Git initially reported a working-tree warning during the cherry-pick. A fresh status and file-hash check confirmed the checkout was clean, and the retry succeeded. All five bundled-demo tests passed, including the exact PDF digest check.
- Codex opened [PR #69](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/69), waited for GitHub’s mobile and backend checks, and merged after they passed. A fresh fetch confirmed `main` at `feeffa6` and the revised Seoul PDF digest. The change reuses the build 40 device verification and involved no new device test.

## Approve the tutorial spacing and release build 41 — November 23, 2026

**Contributor:** Injoon · **Iteration:** 5 · **Tool:** OpenAI Codex desktop (GPT-6).

```text
I checked changes, looks fine can you update PR and then release this version as v41\
```

- Injoon reported checking the separate phone build and approved the spacing change. Codex cherry-picked the tested commit `4c72a11` into [PR #68](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/68) as `f2ec181` and verified the resulting source trees match.
- Codex built and signed OutLoud 0.1.0 (build 41) from `997ae9c` and published a [GitHub prerelease](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-onestore-v41-20261123) with the APK and SHA-256 file. Type checking, lint, all 777 mobile tests and Android bundling passed. The signed APK upgraded build 40 on an emulator, preserved Korean and tutorial completion, and passed a fresh first run including demo-code focus and the Add card. GitHub asset digests and the tag matched the tested artifacts and source.

## Connect Home and Add presentation in both directions — November 25, 2026

- Contributor: Injoon.
- Tool and model: OpenAI Codex, GPT-6, with a read-only Codex transition subagent.
- Prompt (verbatim):

```text
the transitioins between add presentation page and home page should be smoother. it should connect
```

- The code and Android recordings showed that Home removed its labels when the route changed, while Add started a separate entrance. On return the center icon simply faded while the carousel closed around it. Codex kept the wordmark aligned, used the picker progress for both sets of controls, and linked the icon scale and opacity to the carousel gap on the way back. Existing deck depth supplies the background blur while the carousel dims continuously.
- The first emulator build showed Home controls behind PDF progress after closing Android's file picker. Codex excluded Home controls and captions while the PDF progress or Timing screen is active and restored the independent import footer. Build 85 remained an emulator comparison.
- On signed Build 86, Android recordings verified opening Add, returning Home with a steady wordmark and shrinking Add icon, and releasing an incomplete swipe to stay on Add. A synthetic 31-slide PDF reached Timing with the import footer and without Home controls behind it. Type checking, lint, and all 872 mobile tests passed. The Samsung updated at 16:42:45 KST over the existing installation. Codex matched the APK checksum and verified the launch.

## Hide neighboring presentation icons during PDF progress — November 25, 2026

- Contributor: Injoon.
- Tool and model: OpenAI Codex, GPT-6.
- Prompt (verbatim):

```text
After i add the presentation and in the presentation uploading page I can see the other icons in the background, which doens't raelly make sense?
```

- Codex traced the icons to Home's dimmed carousel behind the PDF progress screen. The app now hides the carousel when the selected PDF begins processing. Add still uses the neighboring cards to connect with Home. The upload icon and progress ring keep their existing positions.
- A dark-mode Android replay with a synthetic 31-slide PDF verified all progress steps, the Timing handoff, and the return of the library carousel when backing out to Home. Type checking, lint, and all 872 mobile tests passed. Signed Build 87 updated the Samsung in place at 16:49:26 KST. The installed checksum matched and the app launched.

## Resolve the Build 87 ONE Store findings — November 25, 2026

- Contributor: Injoon.
- Tool and model: OpenAI Codex, GPT-6, with independent subagents for Android, backend preparation and verification, and the store metadata.
- Prompts and replies (verbatim):

```text
Ok can you resolve these problems
```

```text
I’ve signed in
```

```text
what does committed mean. does that mean used
```

```text
did you fix the other things
```

```text
Through December 31, 2026
```

- Codex replaced the scrolling native consent prompt with a themed modal that pins both decision buttons and the privacy link. The signed Build 88 removes the overlay permission and contains the licensed Seoul sample. Type checking, lint, and 872 mobile tests passed. Codex verified the controls on a fresh 320 × 640 Android emulator and updated the Samsung in place with the signed APK.
- Codex deployed the selected-take scoring route and worker with the compatible database migration. A public synthetic rehearsal assembled from two kept recordings received live 88/100 feedback citing both sources. A separate fresh slide received live cues. Codex set the approved December 31 KST cutoff on the public services, preserved the US$50 lifetime cap and ledger, and verified service health.
- Codex published the updated bilingual privacy policy and verified the saved Korean and English ONEconsole descriptions, privacy URL, and installation ID disclosure. Reviewer instructions were prepared in the release handoff.

## Publish Build 88 source and APK on GitHub — November 25, 2026

- Contributor: Injoon.
- Tool and model: OpenAI Codex, GPT-6, with an independent Codex release review.
- Prompts (verbatim):

```text
upload the code changes to a new PR
```

```text
and also release the build on github
```

- Codex ported the Build 88 changes onto the current PR #70 branch, kept its durable cue processing, and matched the selected-score migration to the production schema. Codex compared 360 mobile files with the signed build input and pinned Android build code 88.
- Mobile type checking, lint, 872 tests, and the Android bundle passed. Django checks and PostgreSQL migrations passed. The Django suite ran 837 tests with one skip.
- Codex opened [PR #71](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/71) and published the [Build 88 GitHub prerelease](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-onestore-v88-20261125). The release tag matches the PR head, and GitHub reported the same SHA-256 values as the submitted signed APK and checksum file.

## Prevent the Add card from flashing during startup — November 25, 2026

- Contributor: Injoon.
- Tool and model: OpenAI Codex, GPT-6, with an independent Codex review.
- Prompt (verbatim):

```text
When I close the app and reopen it, for a short period amount of time, shows a single presentation called new presentation then goes back to show normal library
```

- Codex reproduced the flash with the saved catalog still unread. Home treated the initial empty array as an empty library. The carousel, Add card and hints, and library glow now wait until the catalog finishes loading. The tutorial and appearance controls can render independently.
- The regression failed on Build 88 source, then passed with the fix for both a saved presentation and a confirmed empty library. The independent review reproduced the existing consent fixture’s missing load and Codex added that startup step. Type checking, lint, and all 873 mobile tests passed.
- Codex captured the placeholder on a cold launch of Build 88 on the Android emulator. Signed Build 89 updated the emulator in place, and the cold-launch replay showed the same saved library without the placeholder. Android Debug Bridge listed only the emulator at install time.

## Remove the Home Add swipe caption — November 25, 2026

- Contributor: Injoon.
- Tool and model: OpenAI Codex, GPT-6.
- Prompts (verbatim):

```text
When we try to add new page by swiping on home page, let's remove the title above the icon
```

```text
Do a fresh reinstall after
```

```text
In the review page after recording there's lots of useless text like overall feedback just now and full run
```

```text
run another subagent to fix this problem: the +13.3 looks misfit in the field
```

```text
Switching between the different cards in slide feedback seems a bit choppy: can you investigate why
```

```text
that's not slide feeback that's home page
```

```text
individual slide feedback page
```

- Codex removed the caption above the Add icon during the upward swipe with saved decks and faded the empty library caption at the start of its swipe. The existing swipe regression checks the early movement and normal Add handoff.
- Codex removed the redundant run subtitles from Overall Review, its loading screen, and the slide title fallback. A separate Codex subagent fixed the wrapping point-gain badge and extended the compact layout test. All 873 mobile tests passed. Codex signed Build 91 and checked its package, signature, and checksum.
- The Android emulator recording of the Home Add swipe verified the caption removal. A separate trace and Android replay on the individual slide page confirmed that the current card exits before the next scroll view mounts and measures. The replay showed several blank frames between a timing card and the feedback summary. The Samsung refresh was held while awaiting confirmation to erase the on-device data.
