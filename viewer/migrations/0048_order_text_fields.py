from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0047_order_payment_method_multiple'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='setup_time',
            field=models.TextField(blank=True, verbose_name='Время чека'),
        ),
        migrations.AlterField(
            model_name='order',
            name='importance',
            field=models.TextField(blank=True, verbose_name='Важность'),
        ),
        migrations.AlterField(
            model_name='order',
            name='payment_due_comment',
            field=models.TextField(blank=True, verbose_name='Заметка к оплате'),
        ),
    ]
