from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0017_client_normalized_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='date',
            field=models.DateField(blank=True, null=True, verbose_name='Дата проведения'),
        ),
        migrations.AddField(
            model_name='order',
            name='content_hash',
            field=models.CharField(blank=True, default='', max_length=40, verbose_name='Отпечаток данных'),
        ),
        migrations.AddField(
            model_name='order',
            name='content_changed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Данные изменены'),
        ),
    ]
