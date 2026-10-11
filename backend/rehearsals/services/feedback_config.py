"""Nonsecret durable selection, separated from late backend credential resolution."""
from dataclasses import dataclass
import hashlib
import os
import re

from . import feedback_provider as provider
from .feedback import FeedbackError, json_bytes


def prompt_digest(name='gemini', schema_version=None):
    return hashlib.sha256(json_bytes([provider.DESCRIPTION_RULES, provider.response_schema(name, 'descriptions', schema_version),
                                     provider.OUTPUT_TOKENS['descriptions']])).hexdigest()


def coaching_digest(name='gemini', schema_version=None):
    return hashlib.sha256(json_bytes([provider.COACHING_RULES, provider.response_schema(name, 'coaching', schema_version),
                                     provider.OUTPUT_TOKENS['coaching']])).hexdigest()


def check_coaching_versions(job):
    if (job.prompt_version != provider.COACHING_PROMPT_VERSION or
            job.prompt_digest != coaching_digest(job.description_set.provider, job.schema_version)):
        raise FeedbackError('snapshot_unavailable')


@dataclass(frozen=True)
class Selection:
    provider: str
    project_id: str
    model: str
    prompt_version: str
    schema_version: str

    @classmethod
    def current(cls, env=None):
        env = os.environ if env is None else env
        name = env.get('FEEDBACK_PROVIDER', 'openai')
        if name not in {'gemini', 'openai'}:
            raise FeedbackError('invalid_configuration')
        prefix = 'FEEDBACK_' + name.upper() + '_'
        project = env.get(prefix + 'PROJECT_ID', '')
        model = env.get(prefix + 'MODEL', 'gemini-3.1-flash-lite' if name == 'gemini' else 'gpt-6-luna')
        if (not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}', project)
                or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}', model)):
            raise FeedbackError('invalid_configuration')
        return cls(name, project, model, provider.DESCRIPTION_PROMPT_VERSION,
                   provider.current_schema_version(name, 'descriptions'))

    @classmethod
    def saved(cls, value):
        return cls(value.provider, value.project_id, value.model, value.prompt_version, value.schema_version)

    def scope(self):
        return dict(provider=self.provider, project_id=self.project_id, model=self.model,
                    prompt_version=self.prompt_version, schema_version=self.schema_version)

    def adapter(self, *, coaching_schema_version=None):
        # Preparation/validation is independent of key availability and enabled state.
        return provider.FeedbackAdapter(provider.ProviderConfig(self.provider, self.model, ''), preparation_only=True,
            description_schema_version=self.schema_version, coaching_schema_version=coaching_schema_version)

    def check_versions(self, digest):
        if (self.prompt_version != provider.DESCRIPTION_PROMPT_VERSION
                or digest != prompt_digest(self.provider, self.schema_version)):
            raise FeedbackError('snapshot_unavailable')

    def credentials(self, env=None):
        env = os.environ if env is None else env
        enabled(env)
        # Saved retries keep provider/model, even when the current selection moves.
        # Only keys explicitly configured for the original project may be used.
        if env.get('FEEDBACK_' + self.provider.upper() + '_PROJECT_ID') != self.project_id:
            raise FeedbackError('project_changed')
        config = provider.ProviderConfig(self.provider, self.model,
            env.get('GEMINI_API_KEY' if self.provider == 'gemini' else 'OPENAI_API_KEY', ''))
        config.validate()
        return config


def enabled(env=None):
    value = (os.environ if env is None else env).get('FEEDBACK_ENABLED', 'false')
    if value != 'true':
        raise FeedbackError('disabled' if value == 'false' else 'invalid_configuration')


@dataclass(frozen=True)
class QuotaPolicy:
    rpm: int
    tpm: int
    daily: int | None

    @classmethod
    def current(cls, selection, env=None):
        env = os.environ if env is None else env
        prefix = 'FEEDBACK_' + selection.provider.upper() + '_'
        def positive(name, optional=False):
            value = env.get(prefix + name, '')
            if optional and value == '':
                return None
            if not re.fullmatch(r'[0-9]{1,12}', value) or int(value) <= 0:
                raise FeedbackError('quota_configuration')
            return int(value)
        return cls(positive('RPM'), positive('TPM'), positive('DAILY_REQUEST_LIMIT', True))


DISCLOSURE_VERSION = 'feedback-v1'


def selection_descriptor(selection=None, *, value=None, job=None, coaching=False):
    """Public comparison identity only: no key, source, audience or input hash."""
    try:
        selection = selection or (Selection.saved(value) if value else Selection.current())
    except FeedbackError:
        return None
    descriptor = {**selection.scope(), 'stage': 'coaching' if coaching else 'descriptions',
        'disclosure_version': DISCLOSURE_VERSION,
        'prompt_digest': value.prompt_digest if value else prompt_digest(selection.provider, selection.schema_version)}
    if coaching:
        descriptor.update(coaching_prompt_version=job.prompt_version if job else provider.COACHING_PROMPT_VERSION,
            coaching_schema_version=job.schema_version if job else provider.current_schema_version(selection.provider, 'coaching'),
            coaching_prompt_digest=job.prompt_digest if job else coaching_digest(selection.provider))
    return {**descriptor, 'token': hashlib.sha256(json_bytes(descriptor)).hexdigest()}


def validate_assertion(payload):
    if 'expected_selection' in payload and (type(payload['expected_selection']) is not str or
            not re.fullmatch(r'[0-9a-f]{64}', payload['expected_selection'])):
        raise FeedbackError('invalid_request')


def assert_selection(payload, descriptor):
    validate_assertion(payload)
    if 'expected_selection' in payload and (descriptor is None or payload['expected_selection'] != descriptor['token']):
        # Local import keeps the existing service conflict response semantics.
        from .descriptions import Conflict
        raise Conflict('selection_mismatch')
