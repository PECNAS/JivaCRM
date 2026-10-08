import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
django.setup()

from django.contrib.auth.models import User
from viewer.models import Employee, Role, ArtistCard


DEFAULT_USERS = [
    {
        'username': 'PECNAS',
        'password': 'admin',
        'full_name': 'Старший администратор',
        'role': 'senior_admin',
        'is_superuser': True,
        'is_staff': True,
    },
    {
        'username': 'manager',
        'password': 'manager',
        'full_name': 'Управляющий',
        'role': 'manager',
        'is_superuser': False,
        'is_staff': True,
    },
    {
        'username': 'sales_manager',
        'password': 'sales_manager',
        'full_name': 'Менеджер',
        'role': 'sales_manager',
        'is_superuser': False,
        'is_staff': True,
    },
    {
        'username': 'choreographer',
        'password': 'choreographer',
        'full_name': 'Хореограф',
        'role': 'choreographer',
        'is_superuser': False,
        'is_staff': True,
    },
    {
        'username': 'production',
        'password': 'production',
        'full_name': 'Выпускающий',
        'role': 'production',
        'is_superuser': False,
        'is_staff': True,
    },
    {
        'username': 'artist',
        'password': 'artist',
        'full_name': 'Артист',
        'role': 'artist',
        'is_superuser': False,
        'is_staff': True,
    },
    {
        'username': 'technician',
        'password': 'technician',
        'full_name': 'Техник',
        'role': 'technician',
        'is_superuser': False,
        'is_staff': True,
    },
]


def create_default_users():
    senior_admin_exists = User.objects.filter(
        username='PECNAS', is_superuser=True
    ).exists()

    # if senior_admin_exists:
    #     print('Старший администратор уже существует. Пропускаем создание.')
    #     # return

    print('Создание пользователей по умолчанию...')

    for user_data in DEFAULT_USERS:
        username = user_data['username']
        password = user_data['password']

        if User.objects.filter(username=username).exists():
            print(f'  Пользователь "{username}" уже существует. Пропускаем.')
            continue

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=user_data['full_name'],
            is_active=True,
            is_staff=user_data['is_staff'],
            is_superuser=user_data['is_superuser'],
        )

        role, _ = Role.objects.get_or_create(name=user_data['full_name'])

        employee = Employee.objects.create(
            user=user,
            full_name=user_data['full_name'],
            role=user_data['role'],
            is_active=True,
        )

        if user_data['role'] == 'artist':
            ArtistCard.objects.get_or_create(employee=employee)

        print(f'  Создан пользователь "{username}" с ролью "{user_data["full_name"]}".')

    print('Готово.')


if __name__ == '__main__':
    create_default_users()