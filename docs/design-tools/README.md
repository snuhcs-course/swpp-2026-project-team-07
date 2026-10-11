# Design Documentation production

`Design-Documentation.md` is the primary source. Edit it first; the PDF, HTML preview and Wiki-ready package derive from it. The document now uses two major revision entries: 1.0 (initial design) and 2.0 (Iteration 1 design). Earlier Rev.4.x drafts remain in Git history and local archives.

```sh
python docs/design-tools/build_design_pdf.py
python docs/design-tools/check_design.py --source-repo /path/to/OutLoud-with-reviewed-commits
```

Use Python with ReportLab, Pillow, pypdf and pdfplumber, plus installed macOS Arial fonts. The bundled Codex runtime supplies these dependencies. These commands do not change application code, call AI providers or publish anything.

## Figures

`figure-manifest.json` lists the eight figures in document order, their sources, A4 panel boundaries and reviewed hashes. Figures 1-5 preserve the supplied short PDF's labels and structure as editable SVG paths and positioned Arial text; Figure 4 places lifelines behind its notes. Their `-short.svg` source files are canonical. The source PDF identity is recorded in the manifest. Figures 6, 3A and 8 retain the long draft's design content in A4-width panels; Figure 6 labels the controller/layout architecture Planned. Their original draw.io/Mermaid sources are retained; paired SVG sources and `reflow_a4_figures.py` define the current layout. Figure 7 is omitted from the document; its historical assets remain available.

Sources and reviewed SVG/PNG pairs live under `docs/diagram-review/`. SVG labels use portable text instead of HTML foreign objects. Review each changed diagram in a browser, then save a matching PNG and update its manifest hashes. All active figures render at 3 pixels per SVG unit. The three reflowed figures use 11-point Arial labels at their natural 500-point export width. This keeps text sharp without excessive raster size. Old core/feedback assets remain checked against their saved Rev.4.2 hashes; that preservation check does not claim that the active short-version figures are byte-identical to the old figures.

## Outputs

- `Design-Documentation.html`: Markdown-derived local preview.
- `output/pdf/OutLoud_Design_Documentation.pdf`: complete export.
- `output/pdf/team7-iter1-design.pdf`: identical submission-named copy.
- `output/wiki/Design-Documentation.md` and assets: Wiki-ready derivative. Only image URL prefixes differ. These URLs require separately authorized Wiki publication.
- `output/pdf/build-manifest.json` and `document-checks.json`: source hashes and checks.
- `output/archive/before-merged-iteration1/`: local backup of the long draft, supplied short PDF and production inputs.

The export uses A4 portrait throughout (210 x 297 mm), with 44-point side margins, black text, white tables and thin gray boundaries. Body text, tables, captions and code all use 11-point Arial. Headings use a consistent 21/15/12-point hierarchy; headers and footers use 8 points. Content flows continuously without paper-size transitions. Feature bullet groups stay together when they fit. The current export has 24 pages. Figures 6 and 3A each use two consecutive panels; Figure 8 uses three. The Wiki SVGs contain those same panels stacked vertically. The PDF embeds exact, gap-free crops of their canonical PNGs, keeping labels readable without changing the primary Markdown.

Checks cover the eight-section outline, major revision history, required-story roadmap, source/render hashes, assets, anchors, pinned source paths, Wiki/PDF text parity, pixel-identical PDF panels and lossless diagram reconstruction, link destinations, Arial text sizes, uniform A4 page boxes, page bounds and submission-copy identity. Render the final PDF with Poppler and inspect every page. Document checks are separate from application tests; testing plans and outcomes stay out of the design document.

The previous mixed-size export and its inputs are preserved in `output/archive/before-uniform-a4/`.

Nothing here commits, pushes or publishes the Wiki.
