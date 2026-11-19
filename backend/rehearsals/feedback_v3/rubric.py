"""Rubric V2 (presentation-score-v2) as data, plus exact score arithmetic.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
The anchors, weights and formulas match docs/presentation-score-v2.md and the
November 13, 2026 rubric reference. To change the rubric, add a new Rubric
value with a new version; stored runs keep the version they were scored with.
"""
from dataclasses import dataclass
from fractions import Fraction

LEVELS = ('beginning', 'emerging', 'competent', 'advanced')


@dataclass(frozen=True)
class Criterion:
    id: str
    label: str
    maximum: int
    anchors: tuple[str, str, str, str]  # In LEVELS order.


@dataclass(frozen=True)
class Rubric:
    version: str
    slide: tuple[Criterion, ...]
    whole: tuple[Criterion, ...]
    slide_weight: Fraction
    whole_weight: Fraction


RUBRIC_V2 = Rubric(
    version='presentation-score-v2',
    slide=(
        Criterion('essential_coverage', 'Essential coverage', 40, (
            'Essential meaning missing or obscured',
            'Partial meaning with consequential gaps',
            'Essential meaning communicated appropriately',
            'Essential meaning communicated with effective prioritization')),
        Criterion('explanation_depth', 'Explanation depth', 35, (
            'Essential meaning remains unexplained',
            'Important relationships remain unclear',
            'Suitable explanations or examples establish meaning',
            'Explanations connect relationships and implications effectively')),
        Criterion('clarity_relevance', 'Clarity and relevance', 25, (
            'Ambiguity or digression obstructs understanding',
            'Recurring friction obscures the message',
            'Clear, relevant expression supports understanding',
            'Precise, economical expression consistently aids understanding')),
    ),
    whole=(
        Criterion('structure', 'Structure', 25, (
            'Purpose or ending leaves the message unresolved',
            'Opening or conclusion provides weak orientation',
            'Purpose, organization and takeaway are clear',
            'Opening and conclusion form an effective framework')),
        Criterion('coherence', 'Coherence', 25, (
            'Disconnected sequencing obstructs understanding',
            'Unexplained jumps interrupt connections',
            'Ideas and transitions form a logical sequence',
            'Relationships and transitions build a coherent whole')),
        Criterion('audience_suitability', 'Audience suitability', 25, (
            'Framing substantially obstructs the supplied audience',
            'Consequential assumptions remain unexplained',
            'Context and terminology suit the supplied audience',
            'Framing consistently anticipates audience needs')),
        Criterion('delivery', 'Delivery', 25, (
            'Supported continuity or timing problems materially obstruct communication',
            'Supported disruptions sometimes impede understanding',
            'Continuity and time allocation support understanding',
            'Intentional continuity and pacing consistently aid processing and emphasis')),
    ),
    slide_weight=Fraction(7, 10),
    whole_weight=Fraction(3, 10),
)
CURRENT = RUBRIC_V2


def criterion_points(criterion: Criterion, level: str) -> Fraction:
    """Maximum x level units / 3: Beginning 0, Emerging 1/3, Competent 2/3, Advanced full."""
    return Fraction(criterion.maximum * LEVELS.index(level), 3)


def component_points(criteria: tuple[Criterion, ...], levels: dict[str, str]) -> Fraction:
    """Exact points for one complete criterion set; every criterion needs a level."""
    if set(levels) != {c.id for c in criteria} or any(v not in LEVELS for v in levels.values()):
        raise ValueError('Every criterion needs exactly one valid level.')
    return sum((criterion_points(c, levels[c.id]) for c in criteria), Fraction(0))


def next_level_gain(criterion: Criterion, level: str) -> Fraction:
    """Points this criterion adds to its component when raised one level."""
    return Fraction(0) if level == LEVELS[-1] else Fraction(criterion.maximum, 3)


def overall_points(rubric: Rubric, slide_points: list[Fraction], whole_points: Fraction) -> Fraction:
    """0.70 x mean of applicable slide scores + 0.30 x whole score, unrounded."""
    if not slide_points:
        raise ValueError('At least one applicable slide is required.')
    mean = sum(slide_points, Fraction(0)) / len(slide_points)
    return rubric.slide_weight * mean + rubric.whole_weight * whole_points


def round_half_up(points: Fraction) -> int:
    """Round once, for publication; never average rounded values."""
    whole, remainder = divmod(points.numerator, points.denominator)
    return whole + int(2 * remainder >= points.denominator)


def overall_level(points: Fraction) -> str:
    """Level band for a 0-100 score; ties go to the higher band."""
    bands = (Fraction(100, 6), Fraction(50), Fraction(250, 3))
    for level, upper in zip(LEVELS, bands):
        if points < upper:
            return level
    return LEVELS[-1]


def describe(rubric: Rubric = CURRENT) -> dict:
    """JSON rubric for prompts and API responses."""
    def rows(criteria):
        return [{'id': c.id, 'label': c.label, 'maximum_points': c.maximum,
                 'levels': dict(zip(LEVELS, c.anchors))} for c in criteria]
    return {'version': rubric.version, 'slide_criteria': rows(rubric.slide), 'whole_criteria': rows(rubric.whole)}
