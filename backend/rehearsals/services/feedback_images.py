"""Bounded provider copies of stored slide renders; never modify saved media."""
import io
from PIL import Image

from .feedback import (FeedbackError, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES,
                       MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, _private_image_logging)

# A 1600 x 1600 RGB PNG can legitimately exceed the provider's 1 MiB limit.
MAX_STORED_IMAGE_BYTES = 8 * 1024 * 1024


@_private_image_logging()
def _bounded_image(data, budget):
    if not 0 < len(data) <= MAX_STORED_IMAGE_BYTES:
        raise FeedbackError('invalid_image')
    # Preserve source IDs and cached results for already-compatible decks.
    # prepare_deck still verifies/decodes these unchanged bytes afterward.
    if len(data) <= budget:
        return data
    try:
        with Image.open(io.BytesIO(data), formats=('PNG', 'JPEG')) as image:
            width, height = image.size
            if (getattr(image, 'n_frames', 1) != 1 or
                    not 0 < width <= MAX_IMAGE_EDGE or not 0 < height <= MAX_IMAGE_EDGE or
                    width * height > MAX_IMAGE_PIXELS):
                raise ValueError()
            image.verify()
        with Image.open(io.BytesIO(data), formats=('PNG', 'JPEG')) as image:
            image.load()
            # A fresh canvas strips metadata; transparent PNGs get a white background.
            rgb = Image.new('RGB', image.size, 'white')
            rgba = image.convert('RGBA')
            rgb.paste(rgba, mask=rgba.getchannel('A'))
        for _ in range(8):
            output = io.BytesIO()
            rgb.save(output, format='JPEG', quality=90, optimize=True)
            encoded = output.getvalue()
            if len(encoded) <= budget:
                return encoded
            rgb = rgb.resize((max(1, rgb.width * 4 // 5), max(1, rgb.height * 4 // 5)),
                             Image.Resampling.LANCZOS)
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise FeedbackError('invalid_image') from None
    raise FeedbackError('invalid_image')


def saved_feedback_images(images):
    budget = MAX_IMAGE_BYTES
    if sum(map(len, images)) > MAX_TOTAL_IMAGE_BYTES:
        budget = min(budget, MAX_TOTAL_IMAGE_BYTES // len(images))
    return tuple(_bounded_image(data, budget) for data in images)
