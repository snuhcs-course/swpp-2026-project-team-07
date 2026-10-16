"""AI-assisted, frozen OutLoud rubric v1. Ordinal selections, not model numbers."""
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction

from .feedback import FeedbackError

VERSION = 'presentation-score-v1'
LEVELS = ('beginning', 'emerging', 'competent', 'advanced')
CATEGORIES = (('framing_organization', 20), ('content', 50), ('delivery_language', 30))
# ID, category, maximum, and observable anchors in LEVELS order. Changes require a new version.
RUBRIC = (
    ('purpose_introduction', 'framing_organization', 8, (
        'Opening leaves the topic or purpose unclear.',
        'Topic is identifiable, but purpose or orientation is weak.',
        'Opening establishes purpose and gives useful orientation.',
        'Opening establishes a focused purpose, its significance and an effective framework for understanding.')),
    ('progression_transitions', 'framing_organization', 8, (
        'Disconnected ordering prevents following the message.',
        'Sequence is partly understandable; unexplained jumps disrupt connections.',
        'Ideas progress logically with adequate connections.',
        'Sequence and transitions make relationships explicit and build a coherent whole.')),
    ('audience_framing', 'framing_organization', 4, (
        'Assumed knowledge or framing substantially obstructs the intended audience.',
        'Some framing helps, but important assumptions remain unexplained.',
        'Terminology, context and emphasis suit the audience.',
        'Framing consistently anticipates audience needs without unnecessary explanation.')),
    ('relevance_coverage', 'content', 15, (
        'Essential message or required elements are missing or obscured.',
        'Some essential meaning is communicated, with consequential gaps or digressions.',
        'Essential message and requirements are communicated with appropriate emphasis.',
        'Selection and prioritization communicate the essential message efficiently and purposefully.')),
    ('explanation_depth', 'content', 15, (
        'Assertions or labels leave essential meaning unexplained.',
        'Explanations provide partial meaning but leave consequential relationships unclear.',
        'Explanations establish needed meaning and relationships through suitable detail or examples.',
        'Explanations connect ideas and implications with depth appropriate to the audience and purpose.')),
    ('support_reasoning', 'content', 10, (
        'Essential claims or explanations lack needed support or contain demonstrable logical breaks.',
        'Some support is relevant, but consequential connections or qualifications are weak.',
        'Relevant examples, evidence or reasoning adequately support the message.',
        'Support is well integrated; connections and necessary qualifications make the message convincing or illuminating.')),
    ('synthesis_conclusion', 'content', 10, (
        'Ending leaves the central message unresolved or unclear.',
        'Ending repeats points without adequately connecting them.',
        'Ending draws together the main message and appropriate takeaway.',
        'Ending integrates the presentation into a clear, meaningful takeaway or implication.')),
    ('language_clarity', 'delivery_language', 12, (
        'Persistent ambiguity or tangled expression obstructs understanding.',
        'Meaning is recoverable, but recurring unclear expression creates friction.',
        'Expression is understandable and appropriately precise.',
        'Precise, economical expression makes complex or unfamiliar ideas accessible.')),
    ('fluency_continuity', 'delivery_language', 10, (
        'Repeated breakdowns materially disrupt the message.',
        'Disruptions sometimes interrupt understanding or continuity.',
        'Speech maintains understandable continuity; hesitations and repetition generally serve or do not obstruct meaning.',
        'Continuity and intentional phrasing consistently help listeners follow the message.')),
    ('pacing_timing', 'delivery_language', 8, (
        'Supported timing problems materially prevent following or completing essential communication.',
        'Uneven allocation or pacing sometimes obstructs understanding.',
        'Pace and time allocation generally support understanding and supplied duration requirements.',
        'Time allocation and changes of pace effectively support emphasis, processing and completion.')),
)
IDS = tuple(row[0] for row in RUBRIC)


def descriptor():
    return {'version': VERSION, 'level_units': dict(zip(LEVELS, range(4))),
            'criteria': [{'id': key, 'category': category, 'maximum': maximum,
                          'anchors': dict(zip(LEVELS, anchors))} for key, category, maximum, anchors in RUBRIC]}


def display(numerator):
    return str((Decimal(numerator) / Decimal(3)).quantize(Decimal('.1'), rounding=ROUND_HALF_UP))


def overall_level(points):
    if points < Fraction(100, 6): return 'beginning'
    if points < 50: return 'emerging'
    if points < Fraction(250, 3): return 'competent'
    return 'advanced'


def score(selections):
    if (type(selections) is not dict or set(selections) != set(IDS)
            or any(type(v) is not str or v not in LEVELS for v in selections.values())):
        raise FeedbackError('invalid_rubric_selection')
    numerators = {category: 0 for category, _ in CATEGORIES}
    for key, category, maximum, _ in RUBRIC:
        numerators[category] += maximum * LEVELS.index(selections[key])
    total = sum(numerators.values())
    return {'rubric_version': VERSION, 'selections': {key: selections[key] for key in IDS},
            'denominator': 3, 'total_numerator': total, 'total_display': display(total),
            'overall_level': overall_level(Fraction(total, 3)),
            'categories': [{'id': category, 'maximum': maximum, 'numerator': numerators[category],
                            'display': display(numerators[category])} for category, maximum in CATEGORIES]}
