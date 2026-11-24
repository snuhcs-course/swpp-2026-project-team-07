"""Public AI spend in integer millionths of a US dollar. No calendar reset."""
import hashlib
import json
import logging
import os
import re
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, DecimalException, ROUND_CEILING

from django.conf import settings
from django.core.exceptions import AppRegistryNotReady, ImproperlyConfigured
from django.db import DatabaseError, transaction
from django.db.models import F

LIMIT_MICROUSD = 50_000_000
OPENROUTER_URL = 'https://openrouter.ai/api/v1/responses'
# A workspace can enforce one hosted search and up to three alignment retries.
# A successful plain-model receipt releases these conservative holds.
MAX_UPSTREAM_ATTEMPTS = 4
PLUGIN_HOLD_MICROUSD = 1_500_000
MESSAGES = {
    'public_budget_exhausted': 'The remaining public AI budget cannot cover this request.',
    'public_budget_unavailable': 'Public AI is unavailable until the server can verify its spending limit.',
}


class BudgetError(Exception):
    def __init__(self, code='public_budget_unavailable'):
        self.code = code
        super().__init__(MESSAGES[code])


def enabled():
    # Offline evaluation also imports these provider adapters without starting Django.
    if not settings.configured:
        return os.environ.get('OUTLOUD_PUBLIC_SERVICE') == '1'
    return settings.OUTLOUD_PUBLIC_SERVICE


def _price(name):
    # Bound precision and reject scientific notation, infinities, zero and negatives.
    value = os.environ.get('OUTLOUD_PUBLIC_' + name, '')
    if not re.fullmatch(r'[0-9]{1,5}(?:\.[0-9]{1,6})?', value) or Decimal(value) <= 0:
        raise BudgetError()
    return Decimal(value)


@contextmanager
def _ledger_transaction():
    connection = transaction.get_connection()
    opened_here = connection.connection is None
    try:
        # A caller's transaction could roll back after the HTTP request was sent.
        if not connection.get_autocommit():
            raise BudgetError()
        with transaction.atomic(durable=True):
            yield
    finally:
        # V3's short-lived per-slide threads have no Django request teardown.
        if opened_here:
            connection.close()


def _reserve(provider, key, amount):
    until = os.environ.get('OUTLOUD_PUBLIC_AI_UNTIL', '')
    try:
        deadline = datetime.fromisoformat(until)
    except ValueError:
        raise BudgetError() from None
    if deadline.tzinfo is None or datetime.now(timezone.utc) >= deadline:
        raise BudgetError()
    amount = int(amount.to_integral_value(rounding=ROUND_CEILING))
    if not key or amount <= 0:
        raise BudgetError()
    if amount > LIMIT_MICROUSD:
        raise BudgetError('public_budget_exhausted')
    try:
        from .models import LifetimeBudget, ProviderCharge
        # The conditional UPDATE serializes competing workers on one row.
        with _ledger_transaction():
            updated = LifetimeBudget.objects.filter(pk=1, halted=False,
                committed_microusd__lte=LIMIT_MICROUSD - amount).update(
                    committed_microusd=F('committed_microusd') + amount)
            if not updated:
                available = LifetimeBudget.objects.filter(pk=1, halted=False).exists()
                raise BudgetError('public_budget_exhausted' if available else 'public_budget_unavailable')
            return ProviderCharge.objects.create(provider=provider, reserved_microusd=amount,
                credential_sha256=hashlib.sha256(key.encode('utf-8')).hexdigest())
    except (AppRegistryNotReady, ImproperlyConfigured, DatabaseError, RuntimeError):
        raise BudgetError() from None


@dataclass(frozen=True)
class OpenRouterReservation:
    charge_id: int
    reserved_microusd: int
    input_rate: Decimal
    output_rate: Decimal


def authorize_openrouter(url, payload, key):
    """Pin a single priced route and reserve its full input context and output ceiling."""
    model = os.environ.get('OUTLOUD_PUBLIC_OPENROUTER_MODEL', '')
    context = os.environ.get('OUTLOUD_PUBLIC_OPENROUTER_CONTEXT_TOKENS', '')
    output = payload.get('max_output_tokens')
    allowed = {'model', 'instructions', 'input', 'text', 'max_output_tokens', 'store', 'temperature', 'reasoning'}
    if (url != OPENROUTER_URL or not re.fullmatch(r'openai/[a-z0-9.-]+', model)
            or payload.get('model') != model or set(payload) - allowed
            or not re.fullmatch(r'[1-9][0-9]{0,8}', context)
            or type(output) is not int or not 0 < output <= int(context)):
        raise BudgetError()
    prompt_rate = _price('OPENROUTER_INPUT_USD_PER_MTOK')
    completion_rate = _price('OPENROUTER_OUTPUT_USD_PER_MTOK')
    payload.update(service_tier='default', modalities=['text'], tools=[], tool_choice='none',
                   max_tool_calls=1, plugins=[{'id': 'web', 'enabled': False}],
                   prompt_cache_options={'mode': 'explicit'}, provider={
        'only': ['openai'], 'order': ['openai'], 'allow_fallbacks': False, 'require_parameters': True,
        'max_price': {'prompt': float(prompt_rate), 'completion': float(completion_rate),
                      'request': 0, 'image': 0},
    })
    # One USD per million tokens is one microdollar per token. Image input
    # consumes model context. Separate per-image/per-request fees are disallowed.
    per_attempt = int(context) * prompt_rate + output * completion_rate + PLUGIN_HOLD_MICROUSD
    charge = _reserve('openrouter', key, MAX_UPSTREAM_ATTEMPTS * per_attempt)
    return OpenRouterReservation(charge.pk, charge.reserved_microusd, prompt_rate, completion_rate)


def _unique_json_keys(pairs):
    values = dict(pairs)
    if len(values) != len(pairs):
        raise ValueError()
    return values


def _unexpected_receipt(body, usage, details):
    metadata = body.get('openrouter_metadata') or {}
    if (usage.get('is_byok') or body.get('is_byok') or metadata.get('is_byok')
            or (body.get('alignment') or {}).get('calls')
            or usage.get('server_tool_cost') or details.get('server_tool_cost')
            or (usage.get('server_tool_use') or {}).get('web_search_requests')):
        return True
    for part in body.get('output') or []:
        if part.get('type') not in ('reasoning', 'message'):
            return True
        for content in part.get('content') or []:
            if any(a.get('type') == 'url_citation' for a in content.get('annotations') or []):
                return True
    return False


def settle_openrouter(reservation, raw):
    """Release excess only for a completed provider receipt with billed cost."""
    try:
        from .models import LifetimeBudget, ProviderCharge
        body = json.loads(raw, parse_float=Decimal, object_pairs_hook=_unique_json_keys)
        if not isinstance(body, dict):
            return
        usage = body.get('usage') or {}
        details = usage.get('cost_details') or {}
        unexpected = _unexpected_receipt(body, usage, details)
        if unexpected:
            # Stop even when this receipt has no trustworthy bill. Its hold is already durable.
            with _ledger_transaction():
                LifetimeBudget.objects.filter(pk=1).update(halted=True)
        if body.get('status') != 'completed' or body.get('error'):
            return
        cost = usage.get('cost')
        upstream = details.get('upstream_inference_cost')
        flags = (usage.get('is_byok'), body.get('is_byok'), (body.get('openrouter_metadata') or {}).get('is_byok'))
        confirmed_route = any(flag is False for flag in flags) and upstream is not None
        if upstream is None:
            upstream = 0
        if any(type(value) not in (int, Decimal) or not Decimal(value).is_finite() or value < 0
               for value in (cost, upstream)):
            return
        # An unexpected route may bill an upstream account separately.
        cost = cost + upstream if unexpected else max(cost, upstream)
        if cost == 0:
            return
        if cost > 1_000_000:
            with _ledger_transaction():
                LifetimeBudget.objects.filter(pk=1).update(halted=True)
            return
        billed = Decimal(cost) * 1_000_000
        inputs, outputs = usage.get('input_tokens'), usage.get('output_tokens')
        if all(type(value) is int and 0 <= value <= 1_000_000_000 for value in (inputs, outputs)):
            # Preserve funding/surcharge margins in the verified rates.
            billed = max(billed, inputs * reservation.input_rate + outputs * reservation.output_rate)
        elif billed <= reservation.reserved_microusd:
            return  # An incomplete receipt cannot release capacity.
        actual = max(1, int(billed.to_integral_value(rounding=ROUND_CEILING)))
        if not confirmed_route and not unexpected and actual <= reservation.reserved_microusd:
            return  # A summary price alone cannot rule out a separately billed upstream key.
        if unexpected:
            actual = max(actual, reservation.reserved_microusd)
        with _ledger_transaction():
            # Delivery of the same receipt twice must never release two reservations.
            changed = ProviderCharge.objects.filter(pk=reservation.charge_id, confirmed_microusd__isnull=True).update(
                confirmed_microusd=actual)
            if changed:
                updates = {'committed_microusd': F('committed_microusd') + actual - reservation.reserved_microusd}
                if actual > reservation.reserved_microusd:
                    updates['halted'] = True  # Stop if the operator's verified tariff bound is violated.
                LifetimeBudget.objects.filter(pk=1).update(**updates)
    except (AttributeError, TypeError, ValueError, DecimalException, RecursionError):
        return
    except (BudgetError, DatabaseError, RuntimeError):
        # The original reservation is committed. Never resend a successful request here.
        logging.getLogger(__name__).warning('Public AI receipt settlement unavailable.')


def authorize_scribe(key, pcm_frames):
    if type(pcm_frames) is not int or pcm_frames <= 0:
        raise BudgetError()
    # Public submission is server-generated single-channel 16 kHz PCM. Round
    # every clip up to a full minute, including short answers and segment retries.
    minutes = (pcm_frames + 960_000 - 1) // 960_000
    _reserve('elevenlabs', key, _price('SCRIBE_USD_PER_HOUR') * minutes * 1_000_000 / 60)
