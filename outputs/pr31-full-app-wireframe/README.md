# OutLoud - actual app screenshot diagrams from PR #31

Open [the screenshot board](index.html), [standalone SVG](actual-app-diagram.svg), or [20-page PDF](actual-app-diagram.pdf). The board enlarges each screenshot and links to related views.

The diagrams contain **47 unmodified screenshots from the connected Samsung Galaxy S23 Ultra**, covering **all seven implemented app routes**, with **90 navigation links**. They combine the earlier saved-data inspection with a later authorized synthetic demo. Every card labels its session. Images come from the actual installed app or its native PDF picker.

| Group | Actual captured states |
| --- | --- |
| Home & import | Existing Home presentations, icon picker, About, Add presentation, native PDF picker, successful new demo import/setup |
| Presentation & rehearsal | Saved PDFs, existing setup, rotation, cancelled redo dialogs |
| Live microphone rehearsal | New demo ready, countdown, live waveform and timer on all three slides, generated cues, second take countdown/capture |
| Review & playback | Saved-take processing, real transcript, audio playback with highlighted word, unavailable and pending assessment, completed slide/whole-presentation scores and findings, recording/PDF tools |
| Audience Q&A | Earlier unavailable state, real generated question, countdown, live spoken answer, transcription/evaluation processing, Answered review, follow-up and transcript |
| Compare takes | New redo processing and completed comparison, with Keep current selected |

## Authorized demo and results

The user first chose **“Use existing saved data only.”** The original 22 frames preserve that pass. The later instruction **“add live microphone capture qa uplaod and review. I give full access”** authorized a separate demo PDF, microphone recordings and real provider processing.

Codex created the clearly labelled synthetic three-slide refill-station proposal, imported it through the native picker, selected Students as its audience, and played synthetic speech through the Mac speaker into the physical phone microphone. It saved one 74,823 ms full rehearsal, a 57,306 ms Q&A answer, and a 24,887 ms redo. Actual Scribe transcripts contain 138, 86 and 47 words respectively. This is agent-operated runtime evidence, not a controlled speech-accuracy or human-usability result.

The app displayed actual generated cues, slide scores of 67, a whole-presentation score of 64, two verified findings, audience questions and an Answered evaluation with a follow-up. These are demonstration outputs from real services, not hand-written substitute results. The first pending/unavailable frames are retained alongside completed results.

The demo used **three successful Scribe requests and seven completed OpenAI requests**. All selected demo attempts and AI jobs completed; no manual job retry or direct provider request was made by the agents. Billing totals were not queried. See [live verification](live-demo-verification.json).

At the capture handoff, the agent confirmed **Keep current**, preserving the original complete demo run, and left the phone on its 1:15 Full Review. Existing presentations and saved recordings were retained. The isolated demo service was left running locally, with phone USB forwarding from port 58010 to 58011. This records capture-time state, not current service availability. See [phone-state verification](live-demo-device-check.json).

## Source and runtime provenance

[PR #31](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31), selected head [`f1af9dd9737e2ac9adbe8a45186f0e2722863e60`](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/f1af9dd9737e2ac9adbe8a45186f0e2722863e60), was checked October 17, 2026, Asia/Seoul. Capture package: `com.team07.outloud`; device serial: `R3CW20SNFXV`.

The pulled installed APK matches the retained Scribe release APK (`4f6b922e2cee4d977cc0f9f6340d80ae50ec8ecd96e6c8824f8f6ecafcb46bec`). All **112 imported application source modules** in its retained build source map match that PR head byte for byte. This is retained local build evidence, not a signed embedded Git identifier. See [installed-build provenance](build-provenance.json).

The first full take used the existing Scribe-only service. Its persistent HTTP connection survived the initial USB forwarding change. After saving/transcribing the take, the agent copied only the new demo deck/context/take and original receipt/media into a fresh isolated backend, with matching fields and media hashes. No historical user records or AI jobs were copied, and copying dispatched no inference. Restarting the app without clearing data closed the old connection. Subsequent AI results and new answer/redo processing used the isolated service. Its **110 backend Python source files** match the pinned PR; existing services were retained. See [transfer provenance](live-demo-copy-provenance.json) and [backend source proof](live-demo-backend-source-provenance.json).

## Capture evidence and scope

- [Screenshot manifest](screenshot-manifest.json): 47 selected PNG paths, IDs, SHA256 hashes, session labels, notes and navigation links.
- [Original capture evidence](capture-evidence.json) and [expanded capture evidence](expanded-capture-evidence.json): complete REA device-capture records, including serial, original path, dimensions and hashes. Some expanded trial/duplicate captures were deliberately excluded from the diagram.
- [Original integrity review](screenshot-integrity-review.json) and [expanded integrity review](expanded-screenshot-integrity-review.json): independent AI checks of original/manifest/evidence hashes, embedded PNGs, labels and links.
- The 47 selected originals remain in `captures/`; diagram layout resizes them without retouching their contents. Existing captures may contain saved presentation/transcript content. The authorized branch package includes these screenshots; raw audio, credentials, trial captures and preview-only images are excluded.

All seven routes are represented, but not every conditional state was exercised. The brief PDF-render/text/timing progress screen completed before a still capture; successful native import and setup are captured. No follow-up answer was recorded. Rare failure, consent, conflict and destructive recovery paths are not an exhaustive runtime matrix. The diagram lists these narrow gaps.

The [earlier source-derived wireframe board](source-wireframe-board.html), [wireframe SVG](outloud-pr31-wireframe.svg), [wireframe PDF](outloud-pr31-wireframe.pdf) and [original documentation](SOURCE-WIREFRAME-README.md) remain available. They inventory all seven routes with 54 schematic states, 153 links and 174 pinned references, separately from actual phone captures.

## Reproduce and verify

The saved HTML, SVG and PDF can be opened directly without installing dependencies. To regenerate:

```sh
python3 outputs/pr31-full-app-wireframe/prepare_screenshot_expansion.py --apply
python3 outputs/pr31-full-app-wireframe/build_screenshot_diagram.py
node outputs/pr31-full-app-wireframe/render_screenshot_diagram.cjs
```

The first command verifies the retained evidence hashes against the repository's selected `captures/` files. Historical absolute paths in evidence JSON describe capture-time locations and are not used to read the published PNGs. The generator writes `index.html`, identical `screenshot-board.html`, and the self-contained SVG.

PDF export requires Playwright available through Node's normal module search or `NODE_PATH`. The renderer uses `CHROME_BIN` when set, otherwise a common installed Chrome/Chromium location, then Playwright's bundled Chromium. The source-wireframe check/export uses `render_and_check.cjs` with the same requirements.

`python3 outputs/pr31-full-app-wireframe/build_wireframe.py` rebuilds the source board and validates all references against the pinned PR commit in local Git. If a fresh clone lacks that object, fetch the exact revision with `git fetch origin f1af9dd9737e2ac9adbe8a45186f0e2722863e60`, or supply an archive using `--source-root /path/to/PR31/archive` or `PR31_SOURCE_ROOT`. The generator does not fetch automatically.

All 47 original PNGs and embedded SVG images match their recorded SHA256 hashes. Browser checks cover image loading at 1080 x 2316, destination links, inspector navigation, widths 1440/1024/736/375 px, browser errors and print-sheet overflow. See [browser verification](screenshot-browser-verification.json). The final PDF is reopened, its capture IDs checked, and its pages rendered for visual inspection. Independent AI review is distinct from human acceptance.

No application source or installed APK was changed. Existing unrelated checkout edits were preserved. Application builds/suites were not run for this screenshot task. Publication is limited to the diagram package and its task entry in the active Iteration 2 collaboration log; no merge or deployment is part of this work.
