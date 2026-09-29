from copy import deepcopy
from unittest import TestCase

from .services.alignment import align_words


def word(text, start, end):
    return {"text": text, "start_ms": start, "end_ms": end}


class AlignmentTests(TestCase):
    def setUp(self):
        self.events = [
            {"slide_index": 0, "at_ms": 0},
            {"slide_index": 1, "at_ms": 4000},
            {"slide_index": 0, "at_ms": 9000},
        ]

    def test_boundaries_crossing_words_and_backward_visit(self):
        words = [word("first", 0, 100), word("crossing", 3999, 4200),
                 word("next", 4000, 4400), word("return", 9000, 12000)]
        self.assertEqual(align_words(words, self.events, 12000), [
            {"slide_index": 0, "start_ms": 0, "end_ms": 4000, "words": words[:2]},
            {"slide_index": 1, "start_ms": 4000, "end_ms": 9000, "words": words[2:3]},
            {"slide_index": 0, "start_ms": 9000, "end_ms": 12000, "words": words[3:]},
        ])

    def test_simultaneous_events_last_wins_including_at_zero(self):
        events = [{"slide_index": slide, "at_ms": time}
                  for slide, time in [(0, 0), (1, 0), (2, 1000), (3, 1000)]]
        words = [word("start", 0, 100), word("boundary", 1000, 1100)]
        visits = align_words(words, events, 2000)
        self.assertEqual([v["words"] for v in visits], [[], words[:1], [], words[1:]])
        self.assertEqual([v["end_ms"] for v in visits], [0, 1000, 1000, 2000])

    def test_silence_keeps_every_visit(self):
        visits = align_words([], self.events, 12000)
        self.assertEqual([v["slide_index"] for v in visits], [0, 1, 0])
        self.assertEqual([v["words"] for v in visits], [[], [], []])

    def test_unsorted_words_are_assigned_without_rewriting_input_order(self):
        words = [word("late", 9500, 9600), word("early", 100, 200),
                 word("middle", 5000, 5100)]
        visits = align_words(words, self.events, 12000)
        self.assertEqual([v["words"] for v in visits], [words[1:2], words[2:], words[:1]])

    def test_inputs_are_not_mutated_and_output_words_are_copied(self):
        words = [word("안녕하세요", 0, 100)]
        original = deepcopy((words, self.events))
        visits = align_words(words, self.events, 12000)
        self.assertEqual((words, self.events), original)
        visits[0]["words"][0]["text"] = "changed"
        visits[0]["slide_index"] = 99
        self.assertEqual((words, self.events), original)

    def test_zero_length_word_inside_audio_is_preserved(self):
        words = [word("rounded", 4000, 4000)]
        self.assertEqual(align_words(words, self.events, 12000)[1]["words"], words)

    def test_invalid_durations(self):
        for duration in [0, -1, True, 12000.0, "12000", None]:
            with self.subTest(duration=duration), self.assertRaises(ValueError):
                align_words([], self.events, duration)

    def test_invalid_events_even_without_words(self):
        invalid = [[], [{"slide_index": 0, "at_ms": 1}],
                   self.events + [{"slide_index": 1, "at_ms": 8000}]]
        for field, values in [("at_ms", [-1, 12000, 0.0, True, None]),
                              ("slide_index", [-1, 0.0, True, None])]:
            for value in values:
                event = {"slide_index": 0, "at_ms": 0}
                event[field] = value
                invalid.append([event])
        invalid.extend([[{}], [{"at_ms": 0}], [{"slide_index": 0}]])
        for events in invalid:
            with self.subTest(events=events), self.assertRaises(ValueError):
                align_words([], events, 12000)

    def test_invalid_words_are_rejected_instead_of_clamped(self):
        invalid = [word("bad", -1, 100), word("bad", 100, 99),
                   word("bad", 12000, 12000), word("bad", 0, 12001),
                   word("bad", 0.5, 100), word("bad", 0, 100.5),
                   word("bad", True, 100), word("bad", 0, False),
                   word("bad", None, 100), word(None, 0, 100), {}]
        for item in invalid:
            with self.subTest(word=item), self.assertRaises(ValueError):
                align_words([item], self.events, 12000)
