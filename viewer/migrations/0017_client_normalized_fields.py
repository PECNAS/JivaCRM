from django.db import migrations, models


def fill_normalized_fields(apps, schema_editor):
    Client = apps.get_model('viewer', 'Client')

    for client in Client.objects.all().iterator():
        phone_digits = ''.join(filter(str.isdigit, client.phone or ''))
        name_words = [word for word in (client.full_name or '').lower().replace('ё', 'е').split() if word]

        Client.objects.filter(pk=client.pk).update(
            phone_normalized=phone_digits,
            full_name_normalized=' '.join(sorted(name_words)),
        )


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0016_client_cities_client_comment'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='full_name_normalized',
            field=models.CharField(blank=True, db_index=True, editable=False, max_length=200, verbose_name='ФИО (нормализованное)'),
        ),
        migrations.AddField(
            model_name='client',
            name='phone_normalized',
            field=models.CharField(blank=True, db_index=True, editable=False, max_length=20, verbose_name='Телефон (нормализованный)'),
        ),
        migrations.RunPython(fill_normalized_fields, migrations.RunPython.noop),
    ]
