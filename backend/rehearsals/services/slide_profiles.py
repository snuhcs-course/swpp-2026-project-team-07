"""Profiles reuse description jobs, leases, receipts and quotas in a new scope."""
from ..models import Deck, DescriptionSet
from . import descriptions
from .feedback import FeedbackError
from .feedback_config import Selection, QuotaPolicy, enabled, selection_descriptor, assert_selection
from .slide_profile_schema import is_profile_schema, validate_profiles  # public validation seam


@descriptions._private_database_logging()
def ensure(deck_id, payload=None):
    payload = payload or {}
    if payload.get('description_set_id'):
        value = DescriptionSet.objects.get(pk=payload['description_set_id'], deck_id=deck_id)
        if not is_profile_schema(value.schema_version):
            raise FeedbackError('invalid_request')
        # Explicit retry retains the captured selection and revision contract.
        return descriptions.generate(deck_id, payload)
    selection = Selection.profiles()
    assert_selection(payload, selection_descriptor(selection))
    prepared, snapshot = descriptions.prepare_saved(deck_id)
    # dependency=True reuses failed/uncertain scopes without paid retries. The
    # deck lock and existing unique constraint deduplicate concurrent admissions.
    return descriptions.admit_prepared(selection, prepared, snapshot, dependency=True)


@descriptions._private_database_logging()
def read(deck_id, set_id=None):
    Deck.objects.get(pk=deck_id)
    selection = None
    try:
        selection = Selection.profiles()
    except FeedbackError:
        pass
    value = DescriptionSet.objects.get(pk=set_id, deck_id=deck_id) if set_id else None
    if value and not is_profile_schema(value.schema_version):
        raise FeedbackError('invalid_request')
    try:
        prepared, _ = descriptions.prepare_saved(deck_id)
        source = prepared.input_id
    except FeedbackError:
        source = None
    if not value and selection and source:
        value = DescriptionSet.objects.filter(deck_id=deck_id, source_fingerprint=source, **selection.scope()).first()
    if value:
        return descriptions.public_state(deck_id, value, source=source, current_selection=selection)
    try:
        enabled()
        if selection is None:
            raise FeedbackError('invalid_configuration')
        selection.credentials()
        QuotaPolicy.current(selection)
        state = 'absent' if source else 'source_unavailable'
    except FeedbackError as error:
        state = 'disabled' if error.code == 'disabled' else 'configuration_unavailable'
    result = descriptions.public_state(deck_id, absent=state)
    result['selection'] = selection_descriptor(selection) if selection else None
    return result


def after_upload(deck_id):
    """Import succeeds even when AI is disabled/unavailable; reads never enqueue."""
    try:
        ensure(deck_id)
    except Exception:
        # Fixed public status is available via GET; don't echo private source or
        # configuration failures and never turn successful PDF import into failure.
        pass
