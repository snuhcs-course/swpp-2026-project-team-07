"""Source-scoped large-deck profile tests. All images, model output and receipts are synthetic."""
import base64
from copy import deepcopy
from dataclasses import replace
import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from .models import Deck, DescriptionJob, DescriptionSet, Installation, ProfilePart
from .ownership import installation_scope
from .services import feedback_provider as provider, profile_parts as parts
from .services.feedback import FeedbackError, MAX_OUTPUT_BYTES, json_bytes, prepare_analysis, prepare_deck
from .services.slide_profile_schema import validate_profiles
from .test_feedback import DECK, fixture, image_bytes
from .test_feedback_provider import envelope


CONFIG = provider.ProviderConfig('openrouter', 'openai/gpt-6-luna', '')


def deck_of(count, deck_id=DECK):
    slides = [{'deck_id': deck_id, 'slide_index': i, 'source_language': 'en',
               'extracted_text': f'Synthetic report on slide {i}.'} for i in range(count)]
    return prepare_deck({'deck_id': deck_id, 'content_hash': 'a' * 64, 'preparation_version': 'synthetic',
                         'slides': slides}, tuple(image_bytes((12 + i, 8)) for i in range(count)))


def fact(text):
    return {'text': text, 'uncertain': False, 'uncertainty': ''}


def fact_row(i):
    return {'slide_index': i, 'slide_kind': 'content',
            'summary': fact(f'Participation in reporting period {i}.'),
            'key_ideas': [fact(f'The second period in comparison {i} shows higher participation.')],
            'visual_facts': [fact(f'Chart {i} compares the two reporting periods.')],
            'must_cover': [{'text': 'Highlight how participation changed between the two reporting periods.',
                            'evidence_refs': ['key_ideas/0']}]}


def enrichment_row(i, other):
    return {'slide_index': i, 'go_deeper': [
        {'text': 'Which evidence could explain the participation differences across reporting periods?',
         'kind': 'question', 'information_needed': 'Evidence about the reasons for the change.',
         'evidence_refs': [{'slide_index': other, 'fact_ref': 'key_ideas/0'}]}]}


def receipt(request, rows):
    return provider.RawReceipt('openrouter', CONFIG.model, 'descriptions', request.input_hash, 200,
                               json_bytes(envelope('openai', {'slides': rows})), True, None, None, ())


def freeze_facts(deck):
    results = []
    for offset in range(0, len(deck.source.slides), parts.PART_SLIDES):
        request = parts.prepare_part(deck, CONFIG, parts.FACTS, offset)
        rows = [fact_row(i) for i in range(offset, min(offset + parts.PART_SLIDES, len(deck.source.slides)))]
        results.append(parts.normalize_part(request, receipt(request, rows), parts.FACTS, offset))
    return results


class ProfilePartsTests(SimpleTestCase):
    def test_requests_bind_only_the_target_images_and_keep_wire_schema_compact(self):
        deck = deck_of(12)
        request = parts.prepare_part(deck, CONFIG, parts.FACTS, 10)
        body = json.loads(request.payload)
        content = body['input'][0]['content']
        context = json.loads(content[0]['text'])
        self.assertEqual(context['targets'], [10, 11])
        self.assertEqual(context['slides'][0]['extracted_text'], deck.source.slides[10].extracted_text)
        self.assertEqual([base64.b64decode(p['image_url'].split(',')[1]) for p in content[1:]],
                         [image.data for image in deck.images[10:]])
        self.assertEqual(body['max_output_tokens'], 6000)
        self.assertFalse(body['store'])
        self.assertTrue(body['text']['format']['strict'])
        self.assertNotIn('source_id', json.dumps(body['text']['format']['schema']))
        self.assertNotIn('deck_id', json.dumps(body['text']['format']['schema']))
        self.assertNotEqual(request.input_hash, parts.prepare_part(deck, CONFIG, parts.FACTS, 5).input_hash)
        other = deck_of(12, '22222222-2222-4222-8222-222222222222')
        self.assertNotEqual(request.input_hash, parts.prepare_part(other, CONFIG, parts.FACTS, 10).input_hash)
        for offset in (-1, 2, 15, True):
            with self.subTest(offset=offset), self.assertRaisesRegex(FeedbackError, 'invalid_request'):
                parts.prepare_part(deck, CONFIG, parts.FACTS, offset)
        with self.assertRaisesRegex(FeedbackError, 'invalid_request'):
            parts.prepare_part(deck, replace(CONFIG, provider='openai'), parts.FACTS, 0)
        with patch.object(provider, 'MAX_REQUEST_BYTES', 100), self.assertRaisesRegex(FeedbackError, 'request_too_large'):
            parts.prepare_part(deck, CONFIG, parts.FACTS, 0)

    def test_fact_receipt_requires_exact_absolute_targets_and_v5_grounding(self):
        deck = deck_of(12)
        request = parts.prepare_part(deck, CONFIG, parts.FACTS, 10)
        # Receipt recovery uses only the original source snapshot and saved request identity.
        recovered = replace(request, payload=b'', analysis=replace(deck, images=()))
        rows = [fact_row(11), fact_row(10)]
        result = parts.normalize_part(recovered, receipt(request, rows), parts.FACTS, 10)
        self.assertEqual([s['slide_index'] for s in result['slides']], [10, 11])
        self.assertEqual(result['slides'][0]['source_id'], deck.source_ids[10])
        for mutate in (lambda r: r.pop(), lambda r: r[0].update(slide_index=10),
                       lambda r: r[0].update(slide_index=0), lambda r: r[0].update(source_id='f' * 64),
                       lambda r: r[0]['must_cover'][0].update(evidence_refs=['visual_facts/4']),
                       lambda r: r[0]['key_ideas'][0].update(uncertain=True, uncertainty='Scale unclear'),
                       lambda r: r[0]['must_cover'][0].update(text=' '.join(['word'] * 26))):
            bad = deepcopy(rows)
            mutate(bad)
            with self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
                parts.normalize_part(recovered, receipt(request, bad), parts.FACTS, 10)
        saved = receipt(request, rows)
        with self.assertRaisesRegex(FeedbackError, 'receipt_mismatch'):
            parts.normalize_part(recovered, replace(saved, input_hash='b' * 64), parts.FACTS, 10)
        with self.assertRaisesRegex(FeedbackError, 'provider_incomplete'):
            parts.normalize_part(recovered, replace(saved, body=b'{"status":"incomplete"}'), parts.FACTS, 10)

    def test_enrichment_binds_the_whole_deck_and_resolves_the_exact_selected_fact(self):
        deck = deck_of(12)
        frozen = freeze_facts(deck)
        frozen[0]['slides'][0]['visual_facts'][0] = {'text': 'Unreadable figure.', 'uncertain': True,
                                                       'uncertainty': 'Scale is unreadable.'}
        request = parts.prepare_part(deck, CONFIG, parts.ENRICHMENT, 10, fact_parts=frozen)
        content = json.loads(request.payload)['input'][0]['content']
        self.assertEqual(len(content), 1)
        source = json.loads(content[0]['text'])
        self.assertEqual([s['slide_index'] for s in source['deck']], list(range(12)))
        self.assertNotIn('visual_facts/0', source['deck'][0]['certain_facts'])
        rows = [enrichment_row(10, 0), {'slide_index': 11, 'go_deeper': []}]
        saved = receipt(request, rows)
        recovered = replace(request, analysis=replace(deck, images=()), payload=b'')
        result = parts.normalize_part(recovered, saved, parts.ENRICHMENT, 10, fact_parts=list(reversed(frozen)))
        ref = result['slides'][0]['go_deeper'][0]['evidence_refs'][0]
        self.assertEqual((ref['source_id'], ref['quote']), (deck.source_ids[0], fact_row(0)['key_ideas'][0]['text']))
        for mutate in (lambda r: r.update(slide_index=12), lambda r: r.update(fact_ref='visual_facts/0'),
                       lambda r: r.update(fact_ref='key_ideas/4'), lambda r: r.update(quote='Unverified content')):
            bad = deepcopy(rows)
            mutate(bad[0]['go_deeper'][0]['evidence_refs'][0])
            with self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
                parts.normalize_part(request, receipt(request, bad), parts.ENRICHMENT, 10, fact_parts=frozen)
        for mutate in (lambda c: c.update(information_needed=''),
                       lambda c: c.update(evidence_refs=c['evidence_refs'] * 2),
                       lambda c: c.update(text=fact_row(10)['must_cover'][0]['text'])):
            bad = deepcopy(rows)
            mutate(bad[0]['go_deeper'][0])
            with self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
                parts.normalize_part(request, receipt(request, bad), parts.ENRICHMENT, 10, fact_parts=frozen)
        changed = deepcopy(frozen)
        changed[0]['slides'][0]['key_ideas'][0] = fact('A different fact occupies this selector.')
        with self.assertRaisesRegex(FeedbackError, 'receipt_mismatch'):
            parts.normalize_part(recovered, saved, parts.ENRICHMENT, 10, fact_parts=changed)

    def test_91_slide_result_keeps_cross_group_evidence_and_rejects_missing_or_foreign_parts(self):
        deck = deck_of(91)
        frozen = freeze_facts(deck)
        enrichments = []
        for offset in range(0, 91, parts.PART_SLIDES):
            request = parts.prepare_part(deck, CONFIG, parts.ENRICHMENT, offset, fact_parts=frozen)
            rows = [enrichment_row(i, (i + 17) % 91) for i in range(offset, min(offset + parts.PART_SLIDES, 91))]
            enrichments.append(parts.normalize_part(request, receipt(request, rows), parts.ENRICHMENT, offset,
                                                     fact_parts=frozen))
        result = parts.assemble_profiles(deck, list(reversed(frozen)), list(reversed(enrichments)))
        value = result.model_dump(mode='json')
        self.assertEqual([s.slide_index for s in result.slides], list(range(91)))
        self.assertEqual(result.slides[90].go_deeper[0].evidence_refs[0].source_id, deck.source_ids[16])
        self.assertGreater(len(json_bytes(value)), MAX_OUTPUT_BYTES)
        with self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
            validate_profiles(value, deck, parts.V5)
        for mutate in (lambda groups: groups.pop(), lambda groups: groups.append(groups[0]),
                       lambda groups: groups[0]['slides'][0].update(deck_id='22222222-2222-4222-8222-222222222222'),
                       lambda groups: groups[0]['slides'][0].update(source_id='f' * 64),
                       lambda groups: groups[0]['slides'][0]['go_deeper'][0]['evidence_refs'][0].update(quote='Unrelated')):
            bad = deepcopy(enrichments)
            mutate(bad)
            with self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
                parts.assemble_profiles(deck, frozen, bad)


@override_settings(OUTLOUD_PUBLIC_SERVICE=True)
class SavedLargeProfileTests(TestCase):
    def test_only_fulfilled_public_profile_facts_reach_qa_review_and_scoring(self):
        from .services import coaching, presentation_scoring, presentation_score_v2, slide_review
        from .services.feedback_config import Selection, coaching_digest, prompt_digest

        owner = Installation.objects.create(token_hash='a' * 64)
        self.enterContext(installation_scope(owner.pk))
        source, images = fixture(slides=82)
        analysis = prepare_analysis(source, images)
        deck = analysis.deck
        db_deck = Deck.objects.create(pk=DECK, installation=owner, page_count=82, title='Synthetic')
        # A valid generated fact table alone exceeds the old single-reply limit.
        rows = []
        for i in range(82):
            row = fact_row(i)
            row['key_ideas'].append(fact(f'Observation {i}. ' + 'One measurable difference. ' * 10))
            row['visual_facts'].append(fact(f'Figure {i}. ' + 'The displayed values are comparable. ' * 6))
            row.update(deck_id=DECK, source_id=deck.source_ids[i], go_deeper=[])
            rows.append(row)
        profiles = validate_profiles({'slides': rows}, deck, parts.V5, max_bytes=parts.MAX_ASSEMBLED_BYTES)
        value = DescriptionSet.objects.create(deck=db_deck, provider=CONFIG.provider, model=CONFIG.model,
            project_id='test-project', prompt_version=parts.V5, schema_version=parts.V5,
            prompt_digest=prompt_digest(CONFIG.provider, parts.V5), source_fingerprint=deck.input_id,
            source_snapshot={'source': deck.source.model_dump(mode='json'), 'source_ids': list(deck.source_ids)},
            processing_revision=1, description_revision=1, descriptions=profiles.model_dump(mode='json'))
        generation = DescriptionJob.objects.create(description_set=value, generation=1, description_revision=0,
                                                   state='completed', queued_at=timezone.now())
        ProfilePart.objects.bulk_create([ProfilePart(job=generation, phase=phase, offset=i, result={
            'slides': rows[i:i + parts.PART_SLIDES] if phase == parts.FACTS else
            [{k: row[k] for k in ('slide_index', 'deck_id', 'source_id', 'go_deeper')}
             for row in rows[i:i + parts.PART_SLIDES]]})
            for phase in (parts.FACTS, parts.ENRICHMENT) for i in range(0, len(rows), parts.PART_SLIDES)])
        projection = coaching._plain_profile_facts(value.descriptions)
        self.assertGreater(len(json_bytes(projection)), MAX_OUTPUT_BYTES)
        snapshot = {'source': source, 'transcript_id': analysis.transcript_id, 'analysis_id': analysis.input_id,
                    'review_profile': value.descriptions, 'description_origin': 'generated', 'transcript_revision': 0,
                    'effective_text': source['transcript']['text'], 'corrections': [], 'attempt_identity': 'c' * 64,
                    'audience_qa': {'question_schema': 'names-v1', 'selected_slides': [0]},
                    'slide_review': {'version': slide_review.VERSION, 'scope': {'slides': [{'slide_index': 0}]},
                                     'request_context_version': slide_review.REQUEST_CONTEXT_VERSION},
                    'presentation_score': {'slide_events': [{'slide_index': e['slide_index'], 'at_ms': e['start_ms']}
                                                             for e in source['visits']],
                                           'requirements': {'context_id': None, 'revision': None, 'audience': '',
                                                            'required_duration_seconds': None}}}
        schema = provider.current_schema_version('openrouter', 'coaching')
        job = SimpleNamespace(analysis=SimpleNamespace(analysis_type='qa_main'), source_snapshot=snapshot,
            description_set=value, description_set_id=value.pk, description_generation=1, description_revision=1,
            descriptions_snapshot=projection, schema_version=schema, prompt_version=provider.COACHING_PROMPT_VERSION,
            prompt_digest=coaching_digest('openrouter', schema), input_hash='')
        for kind in ('qa_main', 'review_slide'):
            job.analysis.analysis_type = kind
            request = coaching._prepared(value, job)
            text = json.loads(request.payload)['input'][0]['content'][0]['text']
            self.assertEqual(len(json.loads(text)['slide_profiles']['slides']), 82)
        job.analysis.analysis_type = 'score_main'
        measurements = {'version': 'presentation-measurements-v1', 'status': 'available', 'audio_hash': 'b' * 64,
                        'attempt_id': source['attempt_id'], 'duration_ms': source['duration_ms'], 'items': [
                            {'id': 'speech_0', 'kind': 'speech', 'start_ms': 100, 'end_ms': 500,
                             'value': 400, 'unit': 'ms'}], 'limitations': ['Synthetic measurement.']}
        bundle = presentation_scoring._bundle(value, job, measurements)
        score = presentation_score_v2.prepare(bundle, CONFIG)
        text = json.loads(score.payload)['input'][0]['content'][0]['text']
        self.assertEqual(len(json.loads(text)['profiles']['slides']), 82)

        adapter = Selection.saved(value).adapter()
        with self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
            adapter.edited_descriptions(analysis, projection)
        with override_settings(OUTLOUD_PUBLIC_SERVICE=False), self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
            coaching.saved_description_result(value, job, analysis, adapter)
        outsider = Installation.objects.create(token_hash='b' * 64)
        with installation_scope(outsider.pk), self.assertRaisesRegex(FeedbackError, 'invalid_descriptions'):
            coaching.saved_description_result(value, job, analysis, adapter)
        altered = deepcopy(projection)
        altered['slides'][0]['summary'] = fact('A different fact.')
        job.descriptions_snapshot = altered
        with self.assertRaisesRegex(FeedbackError, 'snapshot_unavailable'):
            coaching.saved_description_result(value, job, analysis, adapter)
