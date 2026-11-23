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
