"""Minimal JSON-output client for OpenRouter's Responses endpoint, with retries.

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
Transient failures (timeouts, connection errors, 429, 5xx, cut-off or invalid
JSON output) are retried automatically. Nothing here touches the database or
logs request/response content.
"""
from dataclasses import dataclass
import json
import logging
import os
import time

import httpx

logger = logging.getLogger(__name__)
RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class LLMError(Exception):
    def __init__(self, code: str, retryable: bool = False):
        super().__init__(code)
        self.code, self.retryable = code, retryable


@dataclass(frozen=True)
class Config:
    api_key: str
    model: str
    base_url: str = 'https://openrouter.ai/api/v1'
    reasoning_effort: str | None = 'low'
    temperature: float | None = None
    timeout_seconds: float = 60.0
    retries: int = 2
    max_parallel: int = 8

    @classmethod
    def from_env(cls, env=None) -> 'Config':
        env = os.environ if env is None else env
        if env.get('FEEDBACK_V3_ENABLED', 'false') != 'true':
            raise LLMError('feedback_disabled')
        key = env.get('OPENROUTER_API_KEY', '').strip()
        if not key:
            raise LLMError('missing_api_key')
        temperature = env.get('FEEDBACK_V3_TEMPERATURE', '').strip()
        return cls(
            api_key=key,
            model=env.get('FEEDBACK_V3_MODEL') or env.get('FEEDBACK_OPENROUTER_MODEL') or 'openai/gpt-6-luna',
            base_url=env.get('FEEDBACK_V3_BASE_URL', cls.base_url).rstrip('/'),
            reasoning_effort=env.get('FEEDBACK_V3_REASONING_EFFORT', 'low').strip() or None,
            temperature=float(temperature) if temperature else None,
            timeout_seconds=float(env.get('FEEDBACK_V3_TIMEOUT_SECONDS', '60')),
            retries=int(env.get('FEEDBACK_V3_RETRIES', '2')),
            max_parallel=max(1, int(env.get('FEEDBACK_V3_MAX_PARALLEL', '8'))),
        )


@dataclass(frozen=True)
class Result:
    data: dict
    input_tokens: int
    output_tokens: int
    seconds: float
    tries: int


def complete_json(http: httpx.Client, config: Config, *, name: str, system: str, user: dict,
                  schema: dict, max_output_tokens: int, deadline: float | None = None,
                  sleep=time.sleep, clock=time.monotonic) -> Result:
    """One structured call; retries transient failures, raises LLMError otherwise.

    deadline is a clock() time after which no new attempt starts, so a run stays
    inside its Celery time limit; the last attempt's timeout is shortened to fit.
    """
    started, budget, tries = clock(), max_output_tokens, 0
    while True:
        tries += 1
        timeout = config.timeout_seconds
        if deadline is not None:
            remaining = deadline - clock()
            if remaining < 5:
                raise LLMError('run_deadline')
            timeout = min(timeout, remaining)
        try:
            data, usage = _call(http, config, name, system, user, schema, budget, timeout)
            return Result(data, usage.get('input_tokens', 0), usage.get('output_tokens', 0),
                          round(clock() - started, 2), tries)
        except LLMError as error:
            if not error.retryable or tries > config.retries:
                logger.warning('feedback_v3 call failed: name=%s code=%s tries=%s', name, error.code, tries)
                raise
            if error.code == 'output_cut_off':
                budget *= 2  # Reasoning used the budget; give the retry more room.
            delay = getattr(error, 'retry_after', None) or min(8.0, 1.5 * 2 ** (tries - 1))
            if deadline is not None and clock() + delay > deadline - 5:
                raise
            logger.info('feedback_v3 retrying: name=%s code=%s try=%s', name, error.code, tries)
            sleep(delay)


def _call(http, config, name, system, user, schema, max_output_tokens, timeout):
    payload = {
        'model': config.model,
        'instructions': system,
        'input': [{'role': 'user', 'content': [{'type': 'input_text',
                                                 'text': json.dumps(user, ensure_ascii=False)}]}],
        'text': {'format': {'type': 'json_schema', 'name': name, 'strict': True, 'schema': schema}},
        'max_output_tokens': max_output_tokens,
        'store': False,
    }
    if config.reasoning_effort:
        payload['reasoning'] = {'effort': config.reasoning_effort}
    if config.temperature is not None:
        payload['temperature'] = config.temperature
    try:
        response = http.post(f'{config.base_url}/responses', json=payload, timeout=timeout,
                             headers={'Authorization': f'Bearer {config.api_key}'})
    except httpx.TimeoutException:
        raise LLMError('timeout', retryable=True) from None
    except httpx.RequestError:  # Transport, protocol and body-decoding failures.
        raise LLMError('connection_error', retryable=True) from None
    if response.status_code != 200:
        error = LLMError(_status_code(response.status_code), retryable=response.status_code in RETRYABLE_STATUS)
        error.retry_after = _retry_after(response.headers.get('retry-after'))
        raise error
    try:
        body = response.json()
    except ValueError:
        raise LLMError('invalid_response', retryable=True) from None
    if not isinstance(body, dict):
        raise LLMError('invalid_response', retryable=True)
    if body.get('status') == 'incomplete':
        details = body.get('incomplete_details')
        reason = details.get('reason') if isinstance(details, dict) else None
        if reason == 'content_filter':
            raise LLMError('provider_refusal')
        raise LLMError('output_cut_off', retryable=True)
    if body.get('error') or body.get('status') not in (None, 'completed'):
        raise LLMError('provider_error', retryable=True)
    text = _output_text(body)
    try:
        data = json.loads(text)
    except (TypeError, ValueError):
        raise LLMError('invalid_json', retryable=True) from None
    if not isinstance(data, dict):
        raise LLMError('invalid_json', retryable=True)
    usage = body.get('usage') if isinstance(body.get('usage'), dict) else {}
    return data, {k: v for k, v in usage.items() if k in ('input_tokens', 'output_tokens') and isinstance(v, int)}


def _output_text(body: dict) -> str | None:
    parts = []
    for item in body.get('output') or []:
        if not isinstance(item, dict) or item.get('type') != 'message':
            continue  # Reasoning summaries are never used as output.
        for part in item.get('content') or []:
            if isinstance(part, dict) and part.get('type') == 'refusal':
                raise LLMError('provider_refusal')
            if isinstance(part, dict) and part.get('type') == 'output_text' and isinstance(part.get('text'), str):
                parts.append(part['text'])
    if not parts:
        raise LLMError('empty_output', retryable=True)
    return ''.join(parts)


def _status_code(status: int) -> str:
    return {401: 'provider_auth', 402: 'provider_credits', 403: 'provider_auth',
            429: 'provider_rate_limit'}.get(status, 'provider_error' if status >= 500 else 'provider_rejected')


def _retry_after(value: str | None) -> float | None:
    try:
        return min(10.0, max(0.5, float(value))) if value else None
    except ValueError:
        return None
