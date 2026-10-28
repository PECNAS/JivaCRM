import json
from pathlib import Path

from django.conf import settings

from viewer.models import ArtistCard, Employee, Role, Skill, User

DATASET_PATH = Path(settings.BASE_DIR) / 'viewer' / 'data' / 'employees_import.json'


def load_dataset():
    if not DATASET_PATH.exists():
        return []

    with open(DATASET_PATH, encoding='utf-8') as handle:
        data = json.load(handle)

    if isinstance(data, dict):
        return data.get('employees', data.get('artists', []))

    return data


def to_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        return [item.strip() for item in value.split(',') if item.strip()]

    return []


def clean_name(value):
    return ' '.join((value or '').split())


def make_username(full_name, used):
    translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
        'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
        'я': 'ya', ' ': '_', '-': '_',
    }

    base = ''.join(translit.get(char, char) for char in full_name.lower())
    base = ''.join(char for char in base if char.isalnum() or char == '_').strip('_') or 'artist'

    candidate = base
    counter = 2

    while candidate in used or User.objects.filter(username=candidate).exists():
        candidate = f'{base}_{counter}'
        counter += 1

    used.add(candidate)

    return candidate


def import_employees():
    dataset = load_dataset()

    if not dataset:
        return {'created': 0, 'skipped': 0, 'message': 'Файл с сотрудниками не найден'}

    created = 0
    skipped = 0
    used_usernames = set()

    for item in dataset:
        if not isinstance(item, dict):
            skipped += 1
            continue

        full_name = clean_name(item.get('full_name'))

        if not full_name:
            skipped += 1
            continue

        role = item.get('role') if item.get('role') in dict(Employee.USER_ROLES) else 'artist'

        telegram = clean_name(item.get('telegram_username') or item.get('telegram'))
        phone_digits = ''.join(filter(str.isdigit, item.get('phone') or ''))

        exists = False

        if telegram:
            exists = Employee.objects.filter(telegram_username__iexact=telegram).exists()

        if not exists and phone_digits:
            exists = Employee.objects.filter(phone__regex=r'\D*'.join(phone_digits[-10:])).exists()

        if not exists:
            exists = Employee.objects.filter(
                full_name__iexact=full_name,
                phone='',
                telegram_username='',
            ).exists()

        if exists:
            skipped += 1
            continue

        username = clean_name(item.get('username')) or make_username(full_name, used_usernames)

        if User.objects.filter(username=username).exists():
            username = make_username(full_name, used_usernames)

        user = User.objects.create_user(
            username=username,
            password=item.get('password') or 'jiva1234',
            first_name=full_name,
            email=(item.get('email') or '').strip(),
            is_active=True,
            is_staff=role != 'artist',
        )

        Role.objects.get_or_create(name=item.get('role_name') or full_name)

        employee = Employee.objects.create(
            user=user,
            full_name=full_name,
            role=role,
            phone=(item.get('phone') or '').strip(),
            telegram_username=telegram,
            is_active=True,
        )

        skills = to_list(item.get('skills'))

        for skill_name in skills:
            skill, _ = Skill.objects.get_or_create(name=skill_name.lower())

            employee.skills.add(skill)

        if role == 'artist':
            card_data = item.get('artist_card') or {}

            card, _ = ArtistCard.objects.get_or_create(employee=employee)
            card.weight = (card_data.get('weight') or '').strip()
            card.height = (card_data.get('height') or '').strip()
            card.shoe_size = (card_data.get('shoe_size') or '').strip()
            card.skills_text = (card_data.get('skills_text') or '').strip()
            card.comment = (item.get('comment') or '').strip()
            card.save()

        created += 1

    return {
        'created': created,
        'skipped': skipped,
        'message': f'Сотрудников импортировано: {created}, пропущено: {skipped}',
    }
