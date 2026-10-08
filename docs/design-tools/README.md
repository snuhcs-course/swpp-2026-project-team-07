# Design Documentation production

`Design-Documentation.md` at the repository root is the primary source. Edit it first. The PDF, HTML preview and Wiki export are derivatives; do not maintain their prose separately.

```sh
python docs/design-tools/build_design_pdf.py
python docs/design-tools/check_design.py --source-repo /path/to/OutLoud-with-reviewed-commits
```

Use the bundled Python runtime with ReportLab, Pillow, pypdf and pdfplumber. The builder uses installed Arial fonts on macOS. It does not modify Markdown, call providers, rebuild the app or regenerate diagrams.

The repository includes `OutLoud_Design_Documentation.pdf` at its root as a byte-identical copy of the checked export. After rebuilding and checking, refresh it with `cp output/pdf/OutLoud_Design_Documentation.pdf OutLoud_Design_Documentation.pdf`. Its relative full-size links resolve against the root `assets/` directory.

Outputs:

- `Design-Documentation.html`: local browser preview using the primary Markdown's relative SVG assets.
- `output/pdf/OutLoud_Design_Documentation.pdf`: derived submission copy. A4 text pages, A3 figure pages and A2 pages for the long approved sequence panels preserve readable labels. Do not print the whole document with “fit to A4.”
- `output/pdf/assets/`: companions for the PDF's relative full-size figure links. Keep this directory beside the PDF for offline links; viewer support for relative URI links varies.
- `output/wiki/Design-Documentation.md` and `assets/`: Wiki package. The Markdown differs only by expansion of asset links to the intended Wiki raw URL.
- `output/pdf/build-manifest.json` and `document-checks.json`: source/asset hashes and document checks.

Phase 1 originals remain in `docs/diagram-review/`. The builder copies the SVGs and editable sources unchanged into `assets/outloud-design/`. Browser capture files supplied with a `.png` name but JPEG encoding are re-encoded as true PNG in the exported assets; decoded pixels stay identical. The PDF embeds these raster copies without redrawing the SVG. The superseded Rev.2.0 renderer and local review galleries are omitted from the PR; they are not build inputs.

The checks validate source paths at the linked Git revision, JSON examples, anchors, asset identity, Wiki text parity, PDF text/image parity, links, Arial typography and page bounds. Render the PDF with Poppler and inspect every page as a separate visual check. None of these checks is application testing.

## Wiki publication boundary

This PR proposes a Wiki update; it does not publish or merge one. GitHub Wikis have a separate Git repository without pull requests, so review happens in the application repository. No publication is performed by these scripts. Copy the generated Wiki page and its `assets/outloud-design/` directory into the Wiki checkout only after authorization. The raw asset URLs become live only when those files are published. GitHub's documentation explicitly lists PNG/JPEG/GIF support. The SVGs render locally; they also loaded during a short-lived Wiki publication that was reverted when the user clarified PR-only delivery. The live Wiki has been restored to its prior contents. PNG companions are included if GitHub suppresses an SVG. Keep the SVG full-size links and source files in either case.

Reference: [GitHub Wiki image guidance](https://docs.github.com/en/communities/documenting-your-project-with-wikis/editing-wiki-content).
