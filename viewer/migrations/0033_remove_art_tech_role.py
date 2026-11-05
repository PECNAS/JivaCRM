from django.db import migrations

ART_TECH = 'art_tech'
ARTIST = 'artist'


def remove_art_tech(apps, schema_editor):
    Employee = apps.get_model('viewer', 'Employee')
    Role = apps.get_model('viewer', 'Role')

    for employee in Employee.objects.filter(role=ART_TECH):
        employee.role = ARTIST
        employee.save(update_fields=['role'])

    Role.objects.filter(code=ART_TECH).delete()


def restore_art_tech(apps, schema_editor):
    Role = apps.get_model('viewer', 'Role')

    Role.objects.get_or_create(code=ART_TECH, defaults={'name': 'Арт/Тех', 'is_system': True})


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0032_ordershowtemplate_is_detached'),
    ]

    operations = [
        migrations.RunPython(remove_art_tech, restore_art_tech),
    ]
