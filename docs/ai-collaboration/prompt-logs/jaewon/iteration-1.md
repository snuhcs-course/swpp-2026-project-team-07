# Jaewon — Iteration 1

[AI collaboration index](../../README.md). Entries retain their recorded context and attribution.

<a id="record-007"></a>

<a id="3-jaewon-pdf-import-and-rendering"></a>

<a id="i1-jaewon-pdf-import-and-rendering"></a>

### Jaewon: PDF import and rendering

**Tool:** OpenAI Codex · **Model:** not recorded

<a id="record-008"></a>

<a id="i1-j1-local-pdf-import-persistent-catalog-and-page-viewer-october-4"></a>

#### J1. Local PDF import, persistent catalog and page viewer, October 4

- **Output and use:** Codex generated local PDF import, private file copies/catalog, Library/Viewer screens and native rendering at `9547f1d`. Server slide-image/text preparation was still absent.
- **Verification and error:** Codex checks included 21 existing mobile tests and an operated Samsung SM-S901N rendering a 14-page PDF. Codex tapped Remove instead of Open, deleted the app-private copy and reimported the original from Downloads. This was a tool-operation mistake, not a hallucination; time cost was not recorded. Cancellation and malformed files were not verified.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L218-L267).

<!-- F1 J1 -->

**Prompt**

```text
I am Team mate A and I have to implement the pdf import tool for the project.
instructions are - we have the main code - do not push to main but branch it off from the github ([https://github.com/snuhcs-course/swpp-2026-project-team-07](https://github.com/snuhcs-course/swpp-2026-project-team-07))
i want to work on it off line on my mac and test it out before i uplaod the branch like the others did- but I also want to test out the main code on the android device.
I want to first implement it so that you can upload the pdf (store it in your device, not server side) and be able to see it slide by slide like described.
```

<a id="record-009"></a>

<a id="j2-imported-pdf-in-practice-and-first-page-entry-october-4-feature-record"></a>

<a id="i1-j2-imported-pdf-in-practice-and-first-page-entry-october-4"></a>

#### J2. Imported PDF in Practice and first-page entry, October 4

- **Revision and use:** Jaewon extended PDF viewing to Practice, replacing sample slides with the imported PDF and requiring entry at page one. Codex implemented PDF-URI handoff with `slide: 0` and Practice navigation at `9547f1d`.
- **Verification:** The agent-operated phone check observed that PDF opening in Practice at page one; Practice's Next control was not tested on the device.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L246-L267).

<!-- F1 J2 -->

**Prompt**

```text
now implement after "preview rehearsal" - it leads to the practice tab. under rehearsal, currently there are sample slides. change them to the uplaoded pdf file and maintain the next slide feature in the same tab.
```

<!-- F1 J2 -->

**Prompt**

```text
also, when the app enters rehearsal/practice, make sure even if the slide was moved to a different slide in the your slides slide preview tab, when you press preview rehearsal and move to the practice slide, it always goes back to the first slide
```
