"""Revisioned selected-run Q&A. GET never submits provider work."""
from django.db import transaction
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from .models import Attempt, Deck, FeedbackJob, QaAnswer
from .services import audience_qa, coaching, processing
from .services.feedback import FeedbackError, strict_json
from .services.feedback_config import Selection, selection_descriptor, validate_assertion
from .feedback_views import _error
from .serializers import ProcessSerializer


def body(request, limit=131072):
    if request.query_params or request.content_type!='application/json':raise FeedbackError('invalid_request')
    result=strict_json(request._request.read(limit+1),limit)
    if type(result) is not dict:raise FeedbackError('invalid_request')
    return result

def controls(payload):
    if type(payload) is not dict:raise FeedbackError('invalid_request')
    if set(payload)-{'feedback_revision','transcript_revision','expected_selection','acknowledge_uncertain'}:raise FeedbackError('invalid_request')
    for key in ('feedback_revision','transcript_revision'):
        if key in payload and (type(payload[key]) is not int or not 0<=payload[key]<2**31):raise FeedbackError('invalid_request')
    if 'acknowledge_uncertain' in payload and type(payload['acknowledge_uncertain']) is not bool:raise FeedbackError('invalid_request')
    validate_assertion(payload)
    return payload

def state_for(attempt,scope):
    state=coaching.read(attempt.pk,audience_qa.analysis_type(scope))
    if not state['feedback_revision']:
        try:state['selection']=selection_descriptor(Selection.profiles(),coaching=True);state['availability']=coaching._availability(Selection.profiles())
        except FeedbackError:state['selection']=None
    state.update(scope=scope,qa_version=audience_qa.VERSION)
    owner=attempt.analyses.filter(analysis_type=audience_qa.analysis_type(scope)).first()
    snapshot=owner.jobs.get(generation=state['feedback_revision']).source_snapshot['audience_qa'] if owner else None
    state['requirements']=snapshot['requirements'] if snapshot else audience_qa.slide_review.requirements(attempt,scope)
    state['source_revisions']={sid:s['revision'] for sid,s in snapshot['sources'].items()} if snapshot else {}
    return state

@api_view(['GET','POST'])
@parser_classes([])
def questions(request,attempt_id):
    try:
        attempt=Attempt.objects.select_related('deck').get(pk=attempt_id)
        if request.method=='GET':
            if set(request.query_params)!={'scope'}:raise FeedbackError('invalid_request')
            raw=strict_json(request.query_params['scope'].encode(),131072)
            scope=audience_qa.scope_for(attempt,raw)
        else:
            payload=body(request)
            scope=audience_qa.scope_for(attempt,payload.pop('scope',None))
            expected=payload.pop('source_revisions',None)
            controls(payload)
            with transaction.atomic():
                # Match coaching admission lock order: deck, then selected sources in UUID order.
                Deck.objects.select_for_update().get(pk=attempt.deck_id)
                sources=list(Attempt.objects.select_for_update().filter(pk__in={s['attempt_id'] for s in scope['slides']}).order_by('pk'))
                if expected is not None:
                    actual={str(a.pk):coaching.corrections.snapshot(a)['revision'] for a in sources}
                    if type(expected) is not dict or any(type(v) is not int for v in expected.values()) or expected!=actual:
                        raise coaching.Conflict('correction_conflict')
                coaching.generate(attempt.pk,payload,audience_qa.analysis_type(scope),scope)
        state=state_for(attempt,scope)
        return Response(state,status=202 if request.method=='POST' and state['state']!='completed' else 200)
    except processing.ProcessConflict as error:return Response({'error':{'code':error.code,'message':error.message}},status=409)
    except FeedbackJob.DoesNotExist:return Response({'error':{'code':'question_not_found','message':'Question set is unavailable.'}},status=404)
    except QaAnswer.DoesNotExist:return Response({'error':{'code':'answer_not_found','message':'Answer has not been submitted.'}},status=404)
    except Exception as error:return _error(error)

@api_view(['GET','POST'])
@parser_classes([])
def answer(request,attempt_id):
    try:
        attempt=Attempt.objects.select_related('deck').get(pk=attempt_id)
        if request.method=='POST':
            payload=body(request)
            if set(payload)-{'question_job_id','question_id','part','processing','feedback'}:raise FeedbackError('invalid_request')
            if type(payload.get('question_job_id')) is not int or type(payload.get('part')) is not int or payload['part'] not in (0,1) or not isinstance(payload.get('question_id'),str):raise FeedbackError('invalid_request')
            job=FeedbackJob.objects.select_related('analysis__attempt').get(pk=payload['question_job_id'])
            question=next((q for q in (job.result or {}).get('questions',[]) if q['id']==payload['question_id']),None)
            if (not question or job.state!='completed' or job.analysis.attempt.deck_id!=attempt.deck_id or
                attempt.duration_ms>300000 or attempt.slide_events!=[{'slide_index':question['slide_index'],'at_ms':0}]):raise FeedbackError('invalid_question')
            with transaction.atomic():
                Attempt.objects.select_for_update().get(pk=attempt.pk)
                binding,created=QaAnswer.objects.get_or_create(attempt=attempt,defaults={'question_job':job,'question_id':question['id'],'part':payload['part']})
                if (binding.question_job_id,binding.question_id,binding.part)!=(job.pk,question['id'],payload['part']):raise coaching.Conflict('source_changed')
            if 'processing' in payload:
                serializer=ProcessSerializer(data=payload['processing']);serializer.is_valid(raise_exception=True)
                processing.admit(attempt.pk,serializer.validated_data)
            if 'feedback' in payload:
                coaching.generate(attempt.pk,controls(payload['feedback']),'qa_answer')
            audience_qa.advance_answer(attempt.pk)
        elif request.query_params:raise FeedbackError('invalid_request')
        binding=QaAnswer.objects.get(attempt=attempt)
        attempt.refresh_from_db()
        state=coaching.read(attempt.pk,'qa_answer')
        too_short=attempt.status=='completed' and (attempt.duration_ms<8000 or len((attempt.transcript or {}).get('words',[]))<15)
        result=None
        if too_short:result={'verdict':'too_short','did':'','evidence':'','clarify':''}
        elif state['state']=='completed' and not state['stale']:result=(state['result'] or {}).get('answer')
        return Response({'attempt_id':str(attempt.pk),'question_job_id':binding.question_job_id,'question_id':binding.question_id,'part':binding.part,
            'processing':{'status':attempt.status,'processing_revision':attempt.processing_revision,'requires_confirmation':attempt.processing_state=='needs_confirmation',
                          'retry_available':attempt.status=='failed','error':attempt.error},'feedback':state,
            'result':{**result,'transcript':attempt.transcript,'duration_ms':attempt.duration_ms} if result else None},status=200)
    except processing.ProcessConflict as error:return Response({'error':{'code':error.code,'message':error.message}},status=409)
    except FeedbackJob.DoesNotExist:return Response({'error':{'code':'question_not_found','message':'Question set is unavailable.'}},status=404)
    except QaAnswer.DoesNotExist:return Response({'error':{'code':'answer_not_found','message':'Answer has not been submitted.'}},status=404)
    except Exception as error:return _error(error)
