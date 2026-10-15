"""Read-only cached profiles and explicit revisioned recovery."""
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from .description_views import _body, _error, _uuid
from .services import slide_profiles
from .services.feedback import FeedbackError


@api_view(['GET'])
@parser_classes([])
def profiles(request, deck_id):
    try:
        if set(request.query_params) - {'description_set_id'} or len(request.query_params.getlist('description_set_id')) > 1:
            raise FeedbackError('invalid_request')
        set_id = request.query_params.get('description_set_id')
        if set_id is not None:
            _uuid(set_id)
        return Response(slide_profiles.read(deck_id, set_id))
    except Exception as error:
        return _error(error)


@api_view(['POST'])
@parser_classes([])
def generate(request, deck_id):
    try:
        value = slide_profiles.ensure(deck_id, _body(request))
        state = slide_profiles.read(deck_id, value.pk)
        return Response(state, status=200 if state['state'] == 'completed' else 202)
    except Exception as error:
        return _error(error)
