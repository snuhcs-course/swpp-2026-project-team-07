# Design Documentation production

`Design-Documentation.md` is authoritative. Edit it first; the PDF, HTML preview and Wiki package derive from it.

```sh
python docs/design-tools/build_design_pdf.py
python docs/design-tools/check_design.py --source-repo /path/to/OutLoud-with-reviewed-commits
```

Use Python with ReportLab, Pillow, pypdf and pdfplumber, plus the installed macOS Arial fonts. The bundled Codex Python runtime supplies these libraries. These commands do not modify application code, call AI providers or publish anything.

## Diagram inputs

`docs/design-tools/figure-manifest.json` lists the panels in document order, editable sources, paper sizes and reviewed source/render hashes. It replaces the former fixed eight-panel assumption. Rev.4.3 has eleven panels. Figures 2–3 retain the Rev.4.2 schema and graphics unchanged; Figure 3A is a separate proposed extension.

Edit `.drawio` sources in diagrams.net and `.mmd` sources in Mermaid Live Editor. Current-schema `.dbml` companions are retained. Inspect the result before saving matching SVG and PNG files under `docs/diagram-review/`. Rev.4.3 uses diagrams.net SVG exports and Mermaid's rendered SVG, with editor pan/zoom transforms removed and bounds set around the drawing. The PNGs are full-size browser renders cropped only to the SVG's bounds. Do not change prose embedded in a render without updating its editable source and rerendering.

After reviewing a new source/render pair, update its manifest hashes. The builder rejects stale or missing files. It copies the canonical SVGs and sources into `assets/outloud-design/`, normalizes PNG encoding without changing pixels, and embeds those PNGs in the PDF. The manifest records the revision; document headers and metadata derive from the Markdown revision.

## Outputs and verification

- `Design-Documentation.html`: local browser preview.
- `output/pdf/OutLoud_Design_Documentation.pdf`: full document export.
- `output/pdf/team7-iter1-design.pdf`: byte-identical submission copy.
- `output/wiki/Design-Documentation.md` and its assets: local Wiki-ready package. Only asset URL prefixes differ from the primary Markdown. The intended raw URLs will not be live until publication is separately authorized.
- `output/pdf/build-manifest.json` and `document-checks.json`: content hashes, pagination and document-only checks.
- `output/archive/Rev.4.2/`: local-only backup of Markdown, PDF, diagram sources/renders and build tools from before this edit. The committed manifest retains the current-schema baseline hashes, so checks do not require this local backup.

A4 text pages, A3 architecture/data/API pages and A2 sequence pages preserve the established mixed-page approach and readable diagrams. Arial text, white tables and thin gray table grids retain the submission style. The pre-existing deletion of the obsolete root PDF is preserved; the two current PDFs are in `output/pdf/`.

Checks cover required-story coverage, revision agreement, editable-source/render hashes, local assets, anchors, source paths at linked Git revisions, Wiki/Markdown text parity, complete PDF text parity, pixel-identical embedded graphics, PDF links, Arial typography, page bounds, submission-copy identity and unchanged current-schema diagrams. Render every PDF page with Poppler and inspect it after a final build. Automated checks complement visual inspection; neither is application testing.

No tool in this directory commits, pushes or publishes the Wiki. Keep testing plans and results in separate documentation. The historical comparison report and earlier review galleries are not evidence of a new evaluation.
