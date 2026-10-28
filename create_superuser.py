import os
from datetime import date

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
django.setup()

from django.contrib.auth.models import User
from viewer.models import CalendarColor, City, CityGroup, Employee, PriceRisePeriod, Role


SUPERUSER = {
    'username': 'PECNAS',
    'password': 'admin',
    'full_name': 'Старший администратор',
    'email': 'admin@jiva.ru',
    'phone': '+7 (917) 265-41-08',
    'telegram_username': 'jiva_senior',
}


DEFAULT_ROLES = [
    'Старший администратор',
    'Управляющий',
    'Менеджер',
    'Выпускающий',
    'Хореограф',
    'Артист',
    'Техник',
]


DEFAULT_CALENDAR_COLORS = [
    {'type': 'order', 'status': 'request', 'background_color': '#2164c8', 'border_color': '#2164c8', 'text_color': '#90caf9'},
    {'type': 'order', 'status': 'confirmed', 'background_color': '#2e7d32', 'border_color': '#2e7d32', 'text_color': '#a5d6a7'},
    {'type': 'order', 'status': 'completed', 'background_color': '#dcc8a0', 'border_color': '#dcc8a0', 'text_color': '#e8d9b8'},
    {'type': 'training', 'status': '', 'background_color': '#966ebe', 'border_color': '#966ebe', 'text_color': '#d8c2ec'},
    {'type': 'event', 'status': '', 'background_color': '#c8963c', 'border_color': '#c8963c', 'text_color': '#f0d9a8'},
]


DEFAULT_CITY_GROUPS = [
    {'name': 'Казань', 'salary_bonus': 0},
    {'name': 'Республика', 'salary_bonus': 500},
    {'name': 'Другие регионы', 'salary_bonus': 1500},
]


DEFAULT_CITIES = [
    {'name': 'Казань', 'group': 'Казань', 'transport_costs': {'4': 0, '8': 0}},
    {'name': 'Зеленодольск', 'group': 'Республика', 'transport_costs': {'4': 3000, '8': 4500}},
    {'name': 'Набережные Челны', 'group': 'Республика', 'transport_costs': {'4': 8000, '8': 12000}},
    {'name': 'Нижнекамск', 'group': 'Республика', 'transport_costs': {'4': 9000, '8': 14000}},
    {'name': 'Альметьевск', 'group': 'Республика', 'transport_costs': {'4': 9000, '8': 14000}},
    {'name': 'Арск', 'group': 'Республика', 'transport_costs': {'4': 3500, '8': 5000}},
    {'name': 'Чистополь', 'group': 'Республика', 'transport_costs': {'4': 7000, '8': 10000}},
    {'name': 'Пестрецы', 'group': 'Республика', 'transport_costs': {'4': 2500, '8': 3500}},
    {'name': 'Москва', 'group': 'Другие регионы', 'transport_costs': {'4': 25000, '8': 35000}},
    {'name': 'Самара', 'group': 'Другие регионы', 'transport_costs': {'4': 18000, '8': 26000}},
    {'name': 'Ульяновск', 'group': 'Другие регионы', 'transport_costs': {'4': 14000, '8': 20000}},
    {'name': 'Ижевск', 'group': 'Другие регионы', 'transport_costs': {'4': 15000, '8': 21000}},
    {'name': 'Чебоксары', 'group': 'Другие регионы', 'transport_costs': {'4': 17000, '8': 24000}},
    {'name': 'Киров', 'group': 'Другие регионы', 'transport_costs': {'4': 19000, '8': 27000}},
    {'name': 'Нижний Новгород', 'group': 'Другие регионы', 'transport_costs': {'4': 20000, '8': 28000}},
    {'name': 'Саранск', 'group': 'Другие регионы', 'transport_costs': {'4': 16000, '8': 23000}},
]


DEFAULT_PRICE_PERIODS = [
    {'start_date': date(2026, 12, 1), 'end_date': date(2026, 12, 31), 'percent': 20, 'comment': 'Декабрьское повышение'},
    {'start_date': date(2026, 5, 1), 'end_date': date(2026, 5, 31), 'percent': 10, 'comment': 'Майские праздники'},
]


def create_roles():
    print('Создание ролей...')

    for name in DEFAULT_ROLES:
        Role.objects.get_or_create(name=name)

    print('Готово.')


def create_calendar_colors():
    print('Создание цветов календаря...')

    for color_data in DEFAULT_CALENDAR_COLORS:
        CalendarColor.objects.get_or_create(
            type=color_data['type'],
            status=color_data['status'],
            defaults={
                'background_color': color_data['background_color'],
                'border_color': color_data['border_color'],
                'text_color': color_data['text_color'],
                'is_active': True,
            },
        )

    print('Готово.')


def create_cities():
    print('Создание групп городов и городов...')

    groups = {}

    for group_data in DEFAULT_CITY_GROUPS:
        group, _ = CityGroup.objects.get_or_create(
            name=group_data['name'],
            defaults={'salary_bonus': group_data['salary_bonus']},
        )
        groups[group.name] = group

    for city_data in DEFAULT_CITIES:
        City.objects.get_or_create(
            name=city_data['name'],
            defaults={
                'group': groups.get(city_data['group']),
                'transport_costs': city_data['transport_costs'],
            },
        )

    print('Готово.')


def create_price_periods():
    print('Создание периодов повышения цен...')

    for period_data in DEFAULT_PRICE_PERIODS:
        PriceRisePeriod.objects.get_or_create(
            start_date=period_data['start_date'],
            end_date=period_data['end_date'],
            defaults={
                'percent': period_data['percent'],
                'comment': period_data['comment'],
                'is_active': True,
            },
        )

    print('Готово.')


def create_superuser():
    print('Создание суперпользователя...')

    username = SUPERUSER['username']
    user = User.objects.filter(username=username).first()

    if user is None:
        user = User.objects.create_superuser(
            username=username,
            email=SUPERUSER['email'],
            password=SUPERUSER['password'],
            first_name=SUPERUSER['full_name'],
        )
        print(f'  Пользователь "{username}" создан.')
    else:
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(SUPERUSER['password'])
        user.save(update_fields=['is_staff', 'is_superuser', 'is_active', 'password'])
        print(f'  Пользователь "{username}" уже существует. Права и пароль обновлены.')

    employee, created = Employee.objects.get_or_create(
        user=user,
        defaults={
            'full_name': SUPERUSER['full_name'],
            'role': 'senior_admin',
            'phone': SUPERUSER['phone'],
            'telegram_username': SUPERUSER['telegram_username'],
            'is_active': True,
        },
    )

    if created:
        print(f'  Создан профиль сотрудника "{employee.full_name}" с ролью старшего администратора.')
    else:
        employee.role = 'senior_admin'
        employee.is_active = True
        employee.save(update_fields=['role', 'is_active', 'updated_at'])
        print('  Профиль сотрудника уже существует. Роль и активность проверены.')

    print('  Готово. Вход: ' + username + ' / ' + SUPERUSER['password'])
    print('  Остальные данные создаются на странице /fill-data/')


if __name__ == '__main__':
    create_roles()
    create_calendar_colors()
    create_cities()
    create_price_periods()
    create_superuser()
