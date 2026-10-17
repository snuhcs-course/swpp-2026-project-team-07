"""Join both shared histories and default new requests to Scribe; no data rewrite.

AI-assisted by OpenAI Codex, October 17, 2026; see active collaboration log.
"""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('rehearsals', '0007_provider_request_options'),
        ('rehearsals', '0010_slide_review_membership'),
    ]
    operations = [
        migrations.AlterField(model_name='providerrequest', name='provider',
                              field=models.CharField(default='elevenlabs', max_length=32)),
        migrations.AlterField(model_name='providerrequest', name='model',
                              field=models.CharField(default='scribe_v2', max_length=32)),
    ]
