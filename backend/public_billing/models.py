from django.db import models


class LifetimeBudget(models.Model):
    """One row shared by every installation, worker, provider and credential."""

    id = models.PositiveSmallIntegerField(primary_key=True)
    committed_microusd = models.PositiveBigIntegerField(default=0)
    halted = models.BooleanField(default=False)


class ProviderCharge(models.Model):
    provider = models.CharField(max_length=16)
    credential_sha256 = models.CharField(max_length=64)
    reserved_microusd = models.PositiveBigIntegerField()
    # Conservative charge from the provider's completed receipt, including any tariff margin.
    confirmed_microusd = models.PositiveBigIntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
