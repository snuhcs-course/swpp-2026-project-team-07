from django.db import migrations


def preserve_existing(apps, schema_editor):
    Attempt = apps.get_model('rehearsals', 'Attempt')
    # Revision zero predates admission to this pipeline. An interrupted upgrade
    # may already have current-generation rows; leave their state/results intact.
    legacy = Attempt.objects.using(schema_editor.connection.alias).filter(processing_revision=0)
    legacy.exclude(transcript=None).update(analysis_outcome='legacy', feedback_state='legacy')
    legacy.exclude(feedback=[]).update(analysis_outcome='legacy', feedback_state='legacy')
    legacy.filter(status='completed').update(processing_state='completed', analysis_outcome='legacy', feedback_state='legacy')
    legacy.filter(status='failed').update(processing_state='failed', analysis_outcome='legacy', feedback_state='legacy')
    # Never queue old work automatically or discard legacy results/media.
    legacy.filter(status='processing').update(status='pending', processing_state='awaiting_analysis', analysis_outcome='legacy', feedback_state='legacy')


class Migration(migrations.Migration):
    dependencies = [
        ('rehearsals', '0003_attempt_analysis_outcome_attempt_claim_token_and_more'),
    ]

    # Run after 0003's schema-editor exit/commit: PostgreSQL must finish deferred
    # indexes before data updates can create pending foreign-key trigger events.
    operations = [migrations.RunPython(preserve_existing, migrations.RunPython.noop)]
