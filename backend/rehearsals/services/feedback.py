# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
def analyze_slide(
    slide_image_path: str, extracted_text: str, transcript: dict, audience: str = ""
) -> list[dict]:
    """Integration/AI owner: Gemini image + text + aligned speech + bounded context.

    Return observations with slide/audio evidence. Validate references before
    display. Keep key-ideas summaries separate from the original transcript.
    Do not externally fact-check or claim validated disfluency detection.
    """
    raise NotImplementedError("Implement the Gemini slide-image feedback adapter.")
