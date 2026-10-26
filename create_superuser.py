import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
django.setup()

from django.contrib.auth.models import User
from viewer.models import Employee, Role, ArtistCard, CalendarColor, Skill


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


DEFAULT_CALENDAR_COLORS = [
    {
        'type': 'order',
        'status': 'request',
        'background_color': '#2164c8',
        'border_color': '#2164c8',
        'text_color': '#90caf9',
    },
    {
        'type': 'order',
        'status': 'confirmed',
        'background_color': '#2e7d32',
        'border_color': '#2e7d32',
        'text_color': '#a5d6a7',
    },
    {
        'type': 'order',
        'status': 'completed',
        'background_color': '#dcc8a0',
        'border_color': '#dcc8a0',
        'text_color': '#e8d9b8',
    },
    {
        'type': 'training',
        'status': '',
        'background_color': '#966ebe',
        'border_color': '#966ebe',
        'text_color': '#d8c2ec',
    },
    {
        'type': 'event',
        'status': '',
        'background_color': '#c8963c',
        'border_color': '#c8963c',
        'text_color': '#f0d9a8',
    },
]


DEFAULT_ARTISTS = [
    {
        'username': 'robert',
        'full_name': 'Роберт',
        'telegram_username': 'robbertay',
        'phone': '',
        'skills_text': 'Танцор - студент, ведёт свой танц коллектив',
        'comment': '',
    },
    {
        'username': 'alexandr',
        'full_name': 'Александр',
        'telegram_username': '',
        'phone': '89872381014',
        'skills_text': 'Акробатика, жонглирование',
        'comment': '',
    },
    {
        'username': 'ilgizar',
        'full_name': 'Ильгизар',
        'telegram_username': '',
        'phone': '89509474056',
        'skills_text': 'Ремнист, баланс, воздушное полотно',
        'comment': 'VK: https://vk.com/i.akbashev',
    },
    {
        'username': 'ruslan',
        'full_name': 'Руслан',
        'telegram_username': 'VariousMan',
        'phone': '',
        'skills_text': 'Акробатика, жонглирование, тренер (есть ученики акробаты), сира',
        'comment': '',
    },
    {
        'username': 'viktoria',
        'full_name': 'Виктория',
        'telegram_username': 'Ice_vivi',
        'phone': '89522213570',
        'skills_text': 'Ходулист, аниматор, мим, танцор, фаершоу, живые статуи, гироскутер',
        'comment': 'Адекватная по работе, очень приятная, близкая подруга Бойки, цирковая с 16-17 лет',
    },
    {
        'username': 'sveta',
        'full_name': 'Света',
        'telegram_username': '',
        'phone': '79033261819',
        'skills_text': 'Танцы, барабан, аниматор, пои',
        'comment': 'Ездила на контракт по танцам, на контракт по малым барабанам, аниматором. Отлично могу вписаться в любой движ, быстро учусь. Начала учиться крутить пои',
    },
    {
        'username': 'aleksandra',
        'full_name': 'Александра',
        'telegram_username': 'suvorova_aleksandraa',
        'phone': '',
        'skills_text': 'Музыка, танцы',
        'comment': 'Казань',
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


def create_default_calendar_colors():
    print('Создание цветов календаря по умолчанию...')

    for color_data in DEFAULT_CALENDAR_COLORS:
        obj, created = CalendarColor.objects.get_or_create(
            type=color_data['type'],
            status=color_data['status'],
            defaults={
                'background_color': color_data['background_color'],
                'border_color': color_data['border_color'],
                'text_color': color_data['text_color'],
                'is_active': True,
            },
        )
        if created:
            label = color_data['status'] or color_data['type']
            print(f'  Создан цвет для "{label}".')
        else:
            print(f'  Цвет для "{color_data["status"] or color_data["type"]}" уже существует. Пропускаем.')

    print('Готово.')


def create_default_artists():
    print('Создание артистов по умолчанию...')

    for artist_data in DEFAULT_ARTISTS:
        username = artist_data['username']

        if User.objects.filter(username=username).exists():
            print(f'  Артист "{username}" уже существует. Пропускаем.')
            continue

        user = User.objects.create_user(
            username=username,
            password='artist',
            first_name=artist_data['full_name'],
            is_active=True,
            is_staff=True,
        )

        role, _ = Role.objects.get_or_create(name='Артист')

        employee = Employee.objects.create(
            user=user,
            full_name=artist_data['full_name'],
            role='artist',
            phone=artist_data['phone'],
            telegram_username=artist_data['telegram_username'],
            is_active=True,
        )

        card, _ = ArtistCard.objects.get_or_create(employee=employee)
        card.skills_text = artist_data['skills_text']
        card.comment = artist_data['comment']
        card.save()

        print(f'  Создан артист "{artist_data["full_name"]}" (логин: {username}).')

    print('Готово.')


if __name__ == '__main__':
    create_default_users()
    create_default_calendar_colors()
    create_default_artists()