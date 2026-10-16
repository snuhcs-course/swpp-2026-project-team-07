"""Frozen v2 rubric contracts using synthetic selections; no provider calls."""
from decimal import Decimal
from fractions import Fraction
from unittest import TestCase

from .services.feedback import FeedbackError
from .services import presentation_rubric_v2 as rubric

SLIDE_IDS = ('essential_coverage', 'explanation_depth', 'clarity_relevance')
WHOLE_IDS = ('structure', 'coherence', 'audience_suitability', 'delivery')
LEVELS = ('beginning', 'emerging', 'competent', 'advanced')
APPROVED_ANCHORS = {
    'essential_coverage': (
        'Essential meaning missing or obscured',
        'Partial meaning with consequential gaps',
        'Essential meaning communicated appropriately',
        'Essential meaning communicated with effective prioritization'),
    'explanation_depth': (
        'Essential meaning remains unexplained',
        'Important relationships remain unclear',
        'Suitable explanations or examples establish meaning',
        'Explanations connect relationships and implications effectively'),
    'clarity_relevance': (
        'Ambiguity or digression obstructs understanding',
        'Recurring friction obscures the message',
        'Clear, relevant expression supports understanding',
        'Precise, economical expression consistently aids understanding'),
    'structure': (
        'Purpose or ending leaves the message unresolved',
        'Opening or conclusion provides weak orientation',
        'Purpose, organization and takeaway are clear',
        'Opening and conclusion form an effective framework'),
    'coherence': (
        'Disconnected sequencing obstructs understanding',
        'Unexplained jumps interrupt connections',
        'Ideas and transitions form a logical sequence',
        'Relationships and transitions build a coherent whole'),
    'audience_suitability': (
        'Framing substantially obstructs the supplied audience',
        'Consequential assumptions remain unexplained',
        'Context and terminology suit the supplied audience',
        'Framing consistently anticipates audience needs'),
    'delivery': (
        'Supported continuity or timing problems materially obstruct communication',
        'Supported disruptions sometimes impede understanding',
        'Continuity and time allocation support understanding',
        'Intentional continuity and pacing consistently aid processing and emphasis'),
}


class PresentationRubricV2Tests(TestCase):
    def test_uniform_levels_have_exact_points_for_both_components(self):
        for level, expected in [('beginning', Fraction(0)), ('emerging', Fraction(100, 3)),
                                ('competent', Fraction(200, 3)), ('advanced', Fraction(100))]:
            with self.subTest(level=level):
                self.assertEqual(rubric.slide_points(dict.fromkeys(SLIDE_IDS, level)), expected)
                self.assertEqual(rubric.whole_points(dict.fromkeys(WHOLE_IDS, level)), expected)

    def test_slide_weights_apply_to_their_named_criteria(self):
        for criterion, expected in [('essential_coverage', Fraction(40)),
                                    ('explanation_depth', Fraction(35)),
                                    ('clarity_relevance', Fraction(25))]:
            selections = dict.fromkeys(reversed(SLIDE_IDS), 'beginning')
            selections[criterion] = 'advanced'
            with self.subTest(criterion=criterion):
                self.assertEqual(rubric.slide_points(selections), expected)
        self.assertEqual(rubric.slide_points(dict(zip(SLIDE_IDS, ('beginning', 'emerging', 'advanced')))),
                         Fraction(110, 3))

    def test_whole_criteria_are_equally_weighted(self):
        for criterion in WHOLE_IDS:
            selections = dict.fromkeys(WHOLE_IDS, 'beginning')
            selections[criterion] = 'advanced'
            with self.subTest(criterion=criterion):
                self.assertEqual(rubric.whole_points(selections), Fraction(25))
        self.assertEqual(rubric.whole_points(dict(zip(WHOLE_IDS, LEVELS))), Fraction(50))

    def test_overall_uses_slide_mean_and_seventy_thirty_weights(self):
        self.assertEqual(rubric.overall_points([Fraction(110, 3), Fraction(100)], Fraction(50)),
                         Fraction(377, 6))
        self.assertEqual(rubric.overall_points([Fraction(100)] * 3, Fraction(0)), Fraction(70))
        self.assertEqual(rubric.overall_points([Fraction(0)] * 3, Fraction(100)), Fraction(30))

    def test_components_are_not_rounded_before_aggregation(self):
        points = rubric.overall_points([Fraction(200, 3)] * 3, Fraction(200, 3))
        self.assertIs(type(points), Fraction)
        self.assertEqual(points, Fraction(200, 3))
        self.assertEqual(rubric.round_half_up(points), 67)

    def test_half_up_rounds_exact_ties_without_float_conversion(self):
        for points, expected in [(Fraction(0), 0), (Fraction(1, 2), 1), (Fraction(5, 2), 3),
                                 (Fraction(133, 2), 67), (Fraction(134999, 2000), 67),
                                 (Fraction(135001, 2000), 68), (Fraction(100), 100)]:
            with self.subTest(points=points):
                self.assertEqual(rubric.round_half_up(points), expected)

    def test_level_boundaries_use_unrounded_values_and_ties_go_higher(self):
        epsilon = Fraction(1, 10**30)
        for boundary, below, at in [(Fraction(100, 6), 'beginning', 'emerging'),
                                   (Fraction(50), 'emerging', 'competent'),
                                   (Fraction(250, 3), 'competent', 'advanced')]:
            with self.subTest(boundary=boundary):
                self.assertEqual(rubric.overall_level(boundary - epsilon), below)
                self.assertEqual(rubric.overall_level(boundary), at)
                self.assertEqual(rubric.overall_level(boundary + epsilon), at)
        self.assertEqual(rubric.overall_level(Fraction(0)), 'beginning')
        self.assertEqual(rubric.overall_level(Fraction(100)), 'advanced')

    def test_selection_requires_exactly_the_expected_criteria(self):
        for score, ids in [(rubric.slide_points, SLIDE_IDS), (rubric.whole_points, WHOLE_IDS)]:
            good = dict.fromkeys(ids, 'competent')
            missing = dict(good)
            missing.pop(ids[0])
            for invalid in [None, [], list(good.items()), list(good.items()) + [(ids[0], 'advanced')],
                            missing, {**good, 'invented': 'advanced'}]:
                with self.subTest(function=score.__name__, invalid=invalid), self.assertRaises(FeedbackError):
                    score(invalid)

    def test_invalid_level_values_fail_instead_of_becoming_numbers(self):
        for score, ids in [(rubric.slide_points, SLIDE_IDS), (rubric.whole_points, WHOLE_IDS)]:
            for value in [None, True, 0, 3, 2.0, float('nan'), 'Competent', 'competent ', 'unassessed']:
                with self.subTest(function=score.__name__, value=value), self.assertRaises(FeedbackError):
                    score({**dict.fromkeys(ids, 'competent'), ids[0]: value})

    def test_point_inputs_require_exact_fractions_in_zero_to_one_hundred(self):
        invalid_points = [None, True, 0, 100, 50.0, float('nan'), float('inf'), Decimal('50'),
                          Fraction(-1, 1000), Fraction(100001, 1000)]
        for points in invalid_points:
            for operation in [rubric.round_half_up, rubric.overall_level,
                              lambda value: rubric.overall_points([value], Fraction(50)),
                              lambda value: rubric.overall_points([Fraction(50)], value)]:
                with self.subTest(points=points, operation=operation), self.assertRaises(FeedbackError):
                    operation(points)

    def test_overall_requires_nonempty_list_without_renormalizing_missing_points(self):
        for slides in [None, [], (), (Fraction(50),), [Fraction(50), None], [Fraction(50), True]]:
            with self.subTest(slides=slides), self.assertRaises(FeedbackError):
                rubric.overall_points(slides, Fraction(50))

    def test_descriptor_contains_frozen_anchors_weights_and_arithmetic_identity(self):
        descriptor = rubric.descriptor()
        self.assertEqual(descriptor['version'], 'presentation-score-v2')
        self.assertEqual(descriptor['level_units'], {'beginning': 0, 'emerging': 1, 'competent': 2, 'advanced': 3})
        for collection, ids, maxima in [('slide_criteria', SLIDE_IDS, (40, 35, 25)),
                                       ('whole_criteria', WHOLE_IDS, (25, 25, 25, 25))]:
            criteria = descriptor[collection]
            self.assertEqual([row['id'] for row in criteria], list(ids))
            self.assertEqual([row['maximum'] for row in criteria], list(maxima))
            for row in criteria:
                self.assertEqual(row['anchors'], dict(zip(LEVELS, APPROVED_ANCHORS[row['id']])))
        self.assertEqual(descriptor['aggregation'], {
            'slide_weight': {'numerator': 7, 'denominator': 10},
            'whole_weight': {'numerator': 3, 'denominator': 10},
            'slide_denominator': 3, 'whole_denominator': 3,
            'slide_reduction': 'arithmetic_mean',
            'rounding': 'ROUND_HALF_UP', 'rounding_stage': 'published_integer_only',
            'level_boundaries': [
                {'level': 'beginning', 'minimum': {'numerator': 0, 'denominator': 1}},
                {'level': 'emerging', 'minimum': {'numerator': 50, 'denominator': 3}},
                {'level': 'competent', 'minimum': {'numerator': 50, 'denominator': 1}},
                {'level': 'advanced', 'minimum': {'numerator': 250, 'denominator': 3}}],
            'boundary_ties': 'higher',
        })

    def test_mutating_descriptor_cannot_change_later_requests(self):
        descriptor = rubric.descriptor()
        descriptor['level_units']['competent'] = 3
        descriptor['slide_criteria'][0]['anchors']['competent'] = 'Mutated test text.'
        descriptor['aggregation']['slide_weight']['numerator'] = 0
        fresh = rubric.descriptor()
        self.assertEqual(fresh['level_units']['competent'], 2)
        self.assertEqual(fresh['slide_criteria'][0]['anchors']['competent'],
                         'Essential meaning communicated appropriately')
        self.assertEqual(fresh['aggregation']['slide_weight']['numerator'], 7)
        self.assertEqual(rubric.slide_points(dict.fromkeys(SLIDE_IDS, 'competent')), Fraction(200, 3))
