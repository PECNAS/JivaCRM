import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
django.setup()

from django.contrib.auth.models import User
from viewer.models import Employee, Role


def create_superuser():
    username = 'PECNAS'
    email = 'busovrm4@gmail.com'
    password = 'admin'
    full_name = 'Главный администратор'
    
    # Создаем суперпользователя
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'email': email,
            'is_superuser': True,
            'is_staff': True,
            'is_active': True
        }
    )
    
    if created:
        user.set_password(password)
        user.save()
        print(f"Суперпользователь {username} создан")
    else:
        print(f"Суперпользователь {username} уже существует")
    
    # Создаем или получаем роль "Старший администратор"
    role, role_created = Role.objects.get_or_create(
        name='Старший администратор',
        defaults={'name': 'Старший администратор'}
    )
    if role_created:
        print("Роль 'Старший администратор' создана")
    else:
        print("Роль 'Старший администратор' уже существует")
    
    # Создаем остальные роли
    roles_to_create = ['Администратор', 'Менеджер', 'Тренер', 'Артист']
    for role_name in roles_to_create:
        role_obj, created = Role.objects.get_or_create(name=role_name)
        if created:
            print(f"Роль '{role_name}' создана")
        else:
            print(f"Роль '{role_name}' уже существует")
    
    # Создаем сотрудника, привязанного к пользователю
    employee, emp_created = Employee.objects.get_or_create(
        user=user,
        defaults={
            'full_name': full_name,
            'role': 'senior_admin',
            'is_active': True
        }
    )
    
    if emp_created:
        print(f"Сотрудник {full_name} создан с ролью 'Старший администратор'")
    else:
        # Обновляем существующего сотрудника
        employee.full_name = full_name
        employee.role = 'senior_admin'
        employee.is_active = True
        employee.save()
        print(f"Сотрудник {full_name} обновлен")


if __name__ == '__main__':
    create_superuser()