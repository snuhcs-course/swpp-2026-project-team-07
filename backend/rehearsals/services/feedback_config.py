"""Nonsecret durable selection, separated from late backend credential resolution."""
from dataclasses import dataclass
import hashlib
import os
import re

from . import feedback_provider as provider
from .feedback import FeedbackError, Descriptions, json_bytes


def prompt_digest():
    return hashlib.sha256(json_bytes([provider.DESCRIPTION_RULES, Descriptions.model_json_schema(),
                                     provider.OUTPUT_TOKENS['descriptions']])).hexdigest()


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
        name = env.get('FEEDBACK_PROVIDER', 'gemini')
        if name not in {'gemini', 'openai'}:
            raise FeedbackError('invalid_configuration')
        prefix = 'FEEDBACK_' + name.upper() + '_'
        project = env.get(prefix + 'PROJECT_ID', '')
        model = env.get(prefix + 'MODEL', 'gemini-3.1-flash-lite' if name == 'gemini' else 'gpt-6-luna')
        if (not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}', project)
                or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}', model)):
            raise FeedbackError('invalid_configuration')
        return cls(name, project, model, provider.DESCRIPTION_PROMPT_VERSION, provider.DESCRIPTION_SCHEMA_VERSION)

    @classmethod
    def saved(cls, value):
        return cls(value.provider, value.project_id, value.model, value.prompt_version, value.schema_version)

    def scope(self):
        return dict(provider=self.provider, project_id=self.project_id, model=self.model,
                    prompt_version=self.prompt_version, schema_version=self.schema_version)

    def adapter(self):
        # Preparation/validation is independent of key availability and enabled state.
        return provider.FeedbackAdapter(provider.ProviderConfig(self.provider, self.model, ''), preparation_only=True)

    def check_versions(self, digest):
        if (self.prompt_version != provider.DESCRIPTION_PROMPT_VERSION
                or self.schema_version != provider.DESCRIPTION_SCHEMA_VERSION or digest != prompt_digest()):
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
