"""Synthetic display translations with received numeric errors. No external providers."""
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from .feedback_v3 import llm
from .services import display_translator as translator
from .services.feedback import FeedbackError


def reply(**fields):
    return SimpleNamespace(data={'translations': [
        {'key': key, 'source_language': 'en', 'text': text} for key, text in fields.items()
    ]})


class NumericCorrectionTests(SimpleTestCase):
    config = llm.Config('fixture', 'fixture')
    years = 'Compare the orchard counts from 2014 to 2019.'
    lamps = 'The lamps used 12 watts for two days.'
    quote = 'Repeat the note “We used 8 lamps.”'
    valid_years = '⟦N0:2014⟧년부터 ⟦N1:2019⟧년까지 과수원 집계치를 비교하세요.'
    extra_years = '⟦N0:2014⟧년부터 ⟦N1:2019⟧년까지 6년간의 과수원 집계치를 비교하세요.'
    valid_lamps = '램프는 이틀 동안 ⟦N0:12⟧와트를 사용했습니다.'
    extra_lamps = '램프는 9일 동안 ⟦N0:12⟧와트를 사용했습니다.'
    valid_quote = '메모의 ⟦OL0⟧ 구절을 되풀이하세요.'

    def test_repair_only_numeric_field_and_keep_exact_quote_and_spoken_quantity(self):
        rows = [reply(years=self.extra_years, lamps=self.valid_lamps, quote=self.valid_quote),
                reply(years=self.valid_years)]
        with patch.object(llm, 'complete_json', side_effect=rows) as provider:
            texts, languages = translator.translate('feedback', 'ko',
                {'years':self.years, 'lamps':self.lamps, 'quote':self.quote}, self.config, None)
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(set(provider.call_args.kwargs['user']['fields']), {'years'})
        self.assertEqual(texts, {'years':'2014년부터 2019년까지 과수원 집계치를 비교하세요.',
                                 'lamps':'램프는 이틀 동안 12와트를 사용했습니다.',
                                 'quote':'메모의 “We used 8 lamps.” 구절을 되풀이하세요.'})
        self.assertEqual(languages, dict.fromkeys(texts, 'en'))

    def test_second_invalid_number_does_not_drop_successful_initial_or_repaired_siblings(self):
        rows = [reply(lamps=self.extra_lamps, years=self.extra_years, quote=self.valid_quote),
                reply(lamps=self.extra_lamps, years=self.valid_years)]
        with patch.object(llm, 'complete_json', side_effect=rows) as provider, self.assertRaises(FeedbackError) as raised:
            translator.translate('feedback', 'ko', {'lamps':self.lamps, 'years':self.years, 'quote':self.quote},
                                 self.config, None)
        error = raised.exception
        self.assertEqual(error.code, 'invalid_translation_numbers')
        self.assertEqual(set(error.translations), {'quote','years'})
        self.assertEqual(set(error.source_languages), set(error.translations))
        self.assertEqual(set(error.failed_fields), {'lamps'})
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(set(provider.call_args.kwargs['user']['fields']), {'lamps','years'})

    def test_lost_source_number_or_example_marker_is_never_published(self):
        fields = {'watts':self.lamps, 'example':'Try saying: Use 8 lamps.'}
        rows = [reply(watts='램프는 이틀 동안 사용됐어요.', example='이렇게 말해 보세요: 잘하세요.')] * 2
        with patch.object(llm, 'complete_json', side_effect=rows) as provider, self.assertRaises(FeedbackError) as raised:
            translator.translate('feedback','ko',fields,self.config,None)
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(raised.exception.code, 'invalid_translation_markers')
        self.assertEqual(raised.exception.translations, {})
        self.assertEqual(set(raised.exception.failed_fields),set(fields))

    def test_number_words_inside_exact_quotation_cannot_authorize_extra_coaching_numbers(self):
        source = 'Explain the note “two weeks”.'
        rows = [reply(note='⟦OL0⟧ 메모를 2번 반복해 설명하세요.'),
                reply(note='⟦OL0⟧ 메모를 설명하세요.')]
        with patch.object(llm, 'complete_json', side_effect=rows) as provider:
            texts, _ = translator.translate('feedback', 'ko', {'note':source}, self.config, None)
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(texts['note'], '“two weeks” 메모를 설명하세요.')

    def test_correction_timeout_keeps_only_confirmed_sibling_without_another_submission(self):
        rows = [reply(years=self.extra_years, quote=self.valid_quote), llm.LLMError('timeout', retryable=True)]
        with patch.object(llm, 'complete_json', side_effect=rows) as provider, self.assertRaises(FeedbackError) as raised:
            translator.translate('feedback','ko',{'years':self.years,'quote':self.quote},self.config,None)
        self.assertEqual(provider.call_count, 2)
        self.assertEqual(raised.exception.code, 'timeout')
        self.assertTrue(raised.exception.uncertain)
        self.assertFalse(raised.exception.pre_submission)
        self.assertEqual(set(raised.exception.translations), {'quote'})
        self.assertEqual(set(raised.exception.failed_fields), {'years'})

    def test_correction_preconnect_failure_retains_sibling_and_safe_retry_delay(self):
        failure = llm.LLMError('connection_error', retryable=True)
        failure.pre_submission = True
        failure.retry_after = 70
        responses = [reply(years=self.extra_years, quote=self.valid_quote), failure]
        with patch.object(llm, 'complete_json', side_effect=responses) as provider, self.assertRaises(FeedbackError) as raised:
            translator.translate('feedback','ko',{'years':self.years,'quote':self.quote},self.config,None)
        error = raised.exception
        self.assertEqual(provider.call_count, 2)
        self.assertFalse(error.uncertain)
        self.assertTrue(error.pre_submission)
        self.assertEqual(error.retry_after, 70)
        self.assertEqual(set(error.translations), {'quote'})
        self.assertEqual(set(error.failed_fields), {'years'})


class CalendarTranslationTests(SimpleTestCase):
    config = llm.Config('fixture','fixture')

    def run_provider(self, source, language, produce):
        def provider(_http,_config,**kwargs):
            field = kwargs['user']['fields']['note']
            value = produce(field)
            return SimpleNamespace(data={'translations':[{'key':'note','source_language':'en' if language=='ko' else 'ko','text':value}]})
        with patch.object(llm,'complete_json',side_effect=provider):
            return translator.translate('feedback',language,{'note':source},self.config,None)[0]['note']

    def test_named_date_is_a_single_locale_aware_marker_in_both_directions(self):
        raw = 'The lantern exhibit opened September 15, 1821.'
        def korean(field):
            self.assertEqual(field,'The lantern exhibit opened ⟦D0:1821-09-15⟧.')
            return '등불 전시는 ⟦D0:1821-09-15⟧에 개막했습니다.'
        ko = self.run_provider(raw,'ko',korean)
        self.assertEqual(ko,'등불 전시는 1821년 9월 15일에 개막했습니다.')
        def english(field):
            self.assertEqual(field,'등불 전시는 ⟦D0:1821-09-15⟧에 개막했습니다.')
            return 'The lantern exhibit opened ⟦D0:1821-09-15⟧.'
        self.assertEqual(self.run_provider(ko,'en',english),raw)

    def test_separate_year_keeps_numeric_marker_and_protected_source_quotes_return_verbatim(self):
        raw = 'Describe the 1830s exhibit on 15th of Sept. and quote “We opened July 4.”'
        def korean(field):
            self.assertIn('⟦OL0⟧',field)
            self.assertIn('⟦D1:09-15⟧',field)
            self.assertIn('⟦N2:1830⟧s',field)
            return '⟦N2:1830⟧년대 전시를 ⟦D1:09-15⟧에 설명하고 ⟦OL0⟧를 인용하세요.'
        self.assertEqual(self.run_provider(raw,'ko',korean),'1830년대 전시를 9월 15일에 설명하고 “We opened July 4.”를 인용하세요.')

    def test_date_cannot_authorize_an_unrelated_number_or_changed_day_or_year(self):
        raw = 'Describe the lantern exhibit on September 15, 1821.'
        for value,code in [('⟦D0:1821-09-15⟧에 9번 전시를 설명하세요.','invalid_translation_numbers'),
                           ('⟦D0:1821-09-14⟧에 전시를 설명하세요.','invalid_translation_markers'),
                           ('⟦D0:1822-09-15⟧에 전시를 설명하세요.','invalid_translation_markers')]:
            with self.subTest(value=value), self.assertRaises(FeedbackError) as raised:
                self.run_provider(raw,'ko',lambda _:value)
            self.assertEqual(raised.exception.code,code)
        for bad in ('1821년 8월 15일에 설명하세요.','1821년 9월 14일에 설명하세요.','9월 15일에 설명하세요.'):
            self.assertEqual(translator.display_issue('feedback','note',raw,bad,'ko','en'),'invalid_translation_date')

    def test_native_style_and_non_calendar_words_are_retained(self):
        source='We may march in the park. The show opens on Sept. 15th.'
        masked,_=translator._mask(source,True)
        self.assertEqual(masked,'We may march in the park. The show opens on ⟦D0:09-15⟧.')
        self.assertEqual(translator._mask('We open on 15 September.', True)[0],'We open on ⟦D0:09-15⟧.')
        with patch.object(llm,'complete_json',return_value=reply(note=None)):
            result,_=translator.translate('feedback','en',{'note':source},self.config,None)
        self.assertEqual(result['note'],source)
        mixed_date = 'The next rehearsal will take place on 11월 23일.'
        with patch.object(llm,'complete_json',return_value=reply(note=None)):
            result,_=translator.translate('feedback','en',{'note':mixed_date},self.config,None)
        self.assertEqual(result['note'],mixed_date)

    def test_month_year_and_temporal_month_render_in_both_languages(self):
        for raw, marker, ko, en in (
                ('The next exhibit opens in September 2026.', '⟦M0:2026-09⟧', '2026년 9월', 'September 2026'),
                ('The next exhibit opens in September.', '⟦M0:09⟧', '9월', 'September')):
            def korean(field):
                self.assertIn(marker,field)
                return '다음 전시가 '+marker+'에 열립니다.'
            def english(field):
                self.assertIn(marker,field)
                return 'The next exhibit opens in '+marker+'.'
            translated=self.run_provider(raw,'ko',korean)
            self.assertEqual(translated,'다음 전시가 '+ko+'에 열립니다.')
            self.assertEqual(self.run_provider(translated,'en',english),'The next exhibit opens in '+en+'.')
            with self.assertRaises(FeedbackError) as added:
                self.run_provider(raw,'ko',lambda _:marker+'에 9번 열립니다.')
            self.assertEqual(added.exception.code,'invalid_translation_numbers')

    def test_may_person_or_permission_and_march_instruction_keep_ordinary_words(self):
        for text,expected in (
                ('May I present?', 'May I present?'),
                ("The team met in May's office.", "The team met in May's office."),
                ('We trust in May.', 'We trust in May.'),
                ('May 15 volunteers share a slot?', 'May ⟦N0:15⟧ volunteers share a slot?'),
                ('March 10 steps, then pause.', 'March ⟦N0:10⟧ steps, then pause.')):
            with self.subTest(text=text):
                self.assertEqual(translator._mask(text,True)[0],expected)
        self.assertEqual(translator._mask('May 15 is the deadline.', True)[0],'⟦D0:05-15⟧ is the deadline.')
