"""Frozen v2 ordinal rubric and exact provisional points, independent of v1."""
from fractions import Fraction

from .feedback import FeedbackError

VERSION = 'presentation-score-v2'
LEVELS = ('beginning', 'emerging', 'competent', 'advanced')
# ID, maximum points, and approved anchors in LEVELS order. A change needs a new version.
_SLIDE_CRITERIA = (
    ('essential_coverage', 40, (
        'Essential meaning missing or obscured',
        'Partial meaning with consequential gaps',
        'Essential meaning communicated appropriately',
        'Essential meaning communicated with effective prioritization')),
    ('explanation_depth', 35, (
        'Essential meaning remains unexplained',
        'Important relationships remain unclear',
        'Suitable explanations or examples establish meaning',
        'Explanations connect relationships and implications effectively')),
    ('clarity_relevance', 25, (
        'Ambiguity or digression obstructs understanding',
        'Recurring friction obscures the message',
        'Clear, relevant expression supports understanding',
        'Precise, economical expression consistently aids understanding')),
)
_WHOLE_CRITERIA = (
    ('structure', 25, (
        'Purpose or ending leaves the message unresolved',
        'Opening or conclusion provides weak orientation',
        'Purpose, organization and takeaway are clear',
        'Opening and conclusion form an effective framework')),
    ('coherence', 25, (
        'Disconnected sequencing obstructs understanding',
        'Unexplained jumps interrupt connections',
        'Ideas and transitions form a logical sequence',
        'Relationships and transitions build a coherent whole')),
    ('audience_suitability', 25, (
        'Framing substantially obstructs the supplied audience',
        'Consequential assumptions remain unexplained',
        'Context and terminology suit the supplied audience',
        'Framing consistently anticipates audience needs')),
    ('delivery', 25, (
        'Supported continuity or timing problems materially obstruct communication',
        'Supported disruptions sometimes impede understanding',
        'Continuity and time allocation support understanding',
        'Intentional continuity and pacing consistently aid processing and emphasis')),
)
SLIDE_IDS = tuple(row[0] for row in _SLIDE_CRITERIA)
WHOLE_IDS = tuple(row[0] for row in _WHOLE_CRITERIA)
_LEVEL_MINIMA = (Fraction(0), Fraction(100, 6), Fraction(50), Fraction(250, 3))


def descriptor() -> dict:
    """Return fresh canonical JSON data used to freeze prompts and source identity."""
    def criteria(rows):
        return [{'id': key, 'maximum': maximum, 'anchors': dict(zip(LEVELS, anchors))}
                for key, maximum, anchors in rows]

    return {
        'version': VERSION,
        'level_units': dict(zip(LEVELS, range(4))),
        'slide_criteria': criteria(_SLIDE_CRITERIA),
        'whole_criteria': criteria(_WHOLE_CRITERIA),
        'aggregation': {
            'slide_weight': {'numerator': 7, 'denominator': 10},
            'whole_weight': {'numerator': 3, 'denominator': 10},
            'slide_denominator': 3, 'whole_denominator': 3,
            'slide_reduction': 'arithmetic_mean',
            'rounding': 'ROUND_HALF_UP', 'rounding_stage': 'published_integer_only',
            'level_boundaries': [
                {'level': level, 'minimum': {'numerator': minimum.numerator,
                                            'denominator': minimum.denominator}}
                for level, minimum in zip(LEVELS, _LEVEL_MINIMA)],
            'boundary_ties': 'higher',
        },
    }


def _weighted_points(selections, criteria) -> Fraction:
    ids = {row[0] for row in criteria}
    # Accepting pairs would silently erase duplicate criteria; callers validate their
    # original rows before constructing this exact dict of assessed selections.
    if (type(selections) is not dict or set(selections) != ids
            or any(type(key) is not str for key in selections)
            or any(type(level) is not str or level not in LEVELS for level in selections.values())):
        raise FeedbackError('invalid_rubric_selection')
    return Fraction(sum(maximum * LEVELS.index(selections[key])
                        for key, maximum, _ in criteria), 3)


def slide_points(selections: dict[str, str]) -> Fraction:
    """Compute a slide's 40/35/25 weighted points without rounding."""
    return _weighted_points(selections, _SLIDE_CRITERIA)


def whole_points(selections: dict[str, str]) -> Fraction:
    """Compute whole-presentation points with four equally weighted criteria."""
    return _weighted_points(selections, _WHOLE_CRITERIA)


def _valid_points(points) -> Fraction:
    # These APIs consume exact rubric points, not published integers or approximate
    # numbers. Strict typing also rejects bool, NaN and infinity before comparison.
    if type(points) is not Fraction or not 0 <= points <= 100:
        raise FeedbackError('invalid_rubric_points')
    return points


def overall_points(slides: list[Fraction], whole: Fraction) -> Fraction:
    """Combine the exact applicable-slide mean (70%) and whole component (30%)."""
    if type(slides) is not list or not slides:
        raise FeedbackError('invalid_rubric_points')
    slide_mean = sum((_valid_points(points) for points in slides), Fraction(0)) / len(slides)
    return Fraction(7, 10) * slide_mean + Fraction(3, 10) * _valid_points(whole)


def round_half_up(points: Fraction) -> int:
    """Round exact nonnegative rubric points once for a published integer."""
    points = _valid_points(points)
    integer, remainder = divmod(points.numerator, points.denominator)
    return integer + int(2 * remainder >= points.denominator)


def overall_level(points: Fraction) -> str:
    """Select a descriptor from unrounded points, assigning boundary ties higher."""
    points = _valid_points(points)
    for level, next_minimum in zip(LEVELS, _LEVEL_MINIMA[1:]):
        if points < next_minimum:
            return level
    return LEVELS[-1]
