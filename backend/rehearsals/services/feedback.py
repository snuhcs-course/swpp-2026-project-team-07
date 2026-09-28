def analyze_slide(
    slide_image_path: str, extracted_text: str, transcript: dict, audience: str = ""
) -> list[dict]:
    """Integration/AI owner: Gemini image + text + aligned speech + bounded context.

    Return observations with slide/audio evidence. Validate references before
    display. Keep key-ideas summaries separate from the original transcript.
    Do not externally fact-check or claim validated disfluency detection.
    """
    raise NotImplementedError("Implement the Gemini slide-image feedback adapter.")
