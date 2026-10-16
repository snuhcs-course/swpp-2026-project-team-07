# Design document build tools

The canonical source is
[`docs/product/design-documentation.md`](../../product/design-documentation.md).
Canonical reviewed SVG/PNG pairs and editable provenance live under
[`docs/assets/design/`](../../assets/design/). Do not edit generated files to change
the document.

From the repository root:

```powershell
python docs/tools/design/build_design_pdf.py
python docs/tools/design/check_design.py
```

The build writes only generated artifacts:

- `output/pdf/OutLoud_Design_Documentation.pdf`
- `output/pdf/build-manifest.json` and `document-checks.json`
- `output/html/design-documentation.html`
- `output/wiki/Design-Documentation.md` and `output/wiki/assets/design/`

`figure-manifest.json` records active figure order, editable-source hashes, reviewed
render hashes and any panel boundaries. `reflow_a4_figures.py` and `a4-panels.json`
retain the older diagram-generation path, but should be used only when a diagram
itself is intentionally revised. After a revision, visually inspect SVG and PNG output
before updating hashes.

The Wiki bundle is a local mirror. Building or validating it does not publish to the
GitHub Wiki and does not authorize publication. Final submission-named PDFs must be
created only after team review and separate authorization.
