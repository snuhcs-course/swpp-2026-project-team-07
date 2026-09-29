from pathlib import Path


def prepare_slides(pdf_path: Path) -> list[dict]:
    """PDF owner: produce an ordered image and extracted text for each PDF page."""
    raise NotImplementedError("Implement PDF page rendering and text extraction.")
