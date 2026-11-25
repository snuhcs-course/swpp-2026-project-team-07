# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
# PDF NUL normalization: OpenAI Codex, Iteration 2 (2026-10-16); see active collaboration log.
from pathlib import Path
from io import BytesIO
from threading import Lock

import pypdfium2 as pdfium
from django.conf import settings
from pypdf import PdfReader
from rehearsals.limits import MAX_PDF_BYTES

_render_lock = Lock()  # PDFium is not thread safe.
PUBLIC_MAX_PAGES = 100
PUBLIC_MAX_PREPARED_BYTES = 48 * 1024 * 1024


def prepare_slides(pdf_path: Path) -> list[dict]:
    if pdf_path.stat().st_size > MAX_PDF_BYTES:
        raise ValueError("PDFs must be at most 50 MiB.")
    try:
        reader = PdfReader(pdf_path)
        if reader.is_encrypted:
            raise ValueError("Use an unencrypted PDF.")
        slides = []
        with _render_lock, pdfium.PdfDocument(str(pdf_path)) as doc:
            if not len(doc):
                raise ValueError("PDFs must have at least one slide.")
            if settings.OUTLOUD_PUBLIC_SERVICE and len(doc) > PUBLIC_MAX_PAGES:
                raise ValueError("Online coaching accepts up to 100 PDF pages. Split this deck for coaching.")
            prepared_bytes = 0
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
                image = output.getvalue()
                extracted = (page_text.extract_text() or "").replace("\x00", "")
                if settings.OUTLOUD_PUBLIC_SERVICE:
                    prepared_bytes += len(image) + len(extracted.encode('utf-8'))
                    if prepared_bytes > PUBLIC_MAX_PREPARED_BYTES:
                        raise ValueError("This deck's prepared slides are too large for online coaching. Split the PDF.")
                slides.append({"slide_index": index, "image": image, "extracted_text": extracted})
        return slides
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("This PDF could not be prepared. Use a valid, unencrypted PDF.") from exc
