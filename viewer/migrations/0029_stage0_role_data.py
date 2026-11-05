from django.db import migrations


SYSTEM_ROLES = [
    ('artist', 'Артист'),
    ('technician', 'Техник'),
    ('art_tech', 'Арт/Тех'),
    ('choreographer', 'Хореограф'),
    ('manager', 'Управляющий'),
    ('sales_manager', 'Менеджер'),
    ('production', 'Выпускающий'),
    ('boss', 'Босс'),
    ('senior_admin', 'Старший администратор'),
]


def normalize_text(value):
    return ' '.join((value or '').lower().replace('ё', 'е').split())


def forwards(apps, schema_editor):
    Role = apps.get_model('viewer', 'Role')
    Employee = apps.get_model('viewer', 'Employee')
    Agency = apps.get_model('viewer', 'Agency')
    Order = apps.get_model('viewer', 'Order')

    for code, name in SYSTEM_ROLES:
        role_obj = Role.objects.filter(name=name).first()

        if role_obj is None:
            role_obj = Role.objects.create(name=name, code=code, is_system=True)
        else:
            role_obj.code = code
            role_obj.is_system = True
            role_obj.save(update_fields=['code', 'is_system'])

    for employee in Employee.objects.all():
        role_name = employee.full_name.strip()

        if not role_name:
            continue

        role_obj = Role.objects.filter(name__iexact=role_name).first()

        if role_obj is None:
            role_obj = Role.objects.create(name=role_name, is_system=False)

        employee.roles.add(role_obj)

    for agency in Agency.objects.all():
        agency.normalized_name = normalize_text(agency.name)
        agency.save(update_fields=['normalized_name'])

    for order in Order.objects.all():
        order.name_is_manual = bool((order.name or '').strip())
        order.auto_name = (order.name or '').strip() or ''
        order.save(update_fields=['name_is_manual', 'auto_name'])


def backwards(apps, schema_editor):
    Role = apps.get_model('viewer', 'Role')

    Role.objects.filter(is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0028_stage0_foundation'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
