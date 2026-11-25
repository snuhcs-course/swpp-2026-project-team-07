from django.db import migrations, models


def create_lifetime_budget(apps, schema_editor):
    apps.get_model('public_billing', 'LifetimeBudget').objects.using(schema_editor.connection.alias).create(id=1)


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='LifetimeBudget',
            fields=[
                ('id', models.PositiveSmallIntegerField(primary_key=True, serialize=False)),
                ('committed_microusd', models.PositiveBigIntegerField(default=0)),
                ('halted', models.BooleanField(default=False)),
            ],
        ),
        migrations.CreateModel(
            name='ProviderCharge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(max_length=16)),
                ('credential_sha256', models.CharField(max_length=64)),
                ('reserved_microusd', models.PositiveBigIntegerField()),
                ('confirmed_microusd', models.PositiveBigIntegerField(null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.RunPython(create_lifetime_budget, migrations.RunPython.noop),
    ]
