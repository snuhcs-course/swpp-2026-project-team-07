# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
from pathlib import Path
from io import BytesIO
from threading import Lock

import pypdfium2 as pdfium
from pypdf import PdfReader
from rehearsals.limits import MAX_PDF_BYTES

_render_lock = Lock()  # PDFium is not thread safe.


def prepare_slides(pdf_path: Path) -> list[dict]:
    if pdf_path.stat().st_size > MAX_PDF_BYTES:
        raise ValueError("PDFs must be at most 50 MiB.")
    try:
        reader = PdfReader(pdf_path)
        if reader.is_encrypted:
            raise ValueError("Use an unencrypted PDF.")
        if not reader.pages:
            raise ValueError("PDFs must have at least one slide.")
        slides = []
        with _render_lock, pdfium.PdfDocument(str(pdf_path)) as doc:
            for index, page_text in enumerate(reader.pages):
                page = doc[index]
                try:
                    bitmap = page.render(scale=min(1.5, 1600 / max(page.get_size())))
                    try:
                        output = BytesIO()
                        bitmap.to_pil().convert("RGB").save(output, format="PNG")
                    finally:
                        bitmap.close()
                finally:
                    page.close()
                slides.append({"slide_index": index, "image": output.getvalue(),
                               "extracted_text": page_text.extract_text() or ""})
        return slides
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("This PDF could not be prepared. Use a valid, unencrypted PDF.") from exc
