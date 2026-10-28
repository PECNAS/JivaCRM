import json
from pathlib import Path

from django.conf import settings

from viewer.models import Agency, City, Client, Employee

DATASET_PATH = Path(settings.BASE_DIR) / 'viewer' / 'data' / 'clients_import.json'


def normalize_phone(value):
    digits = ''.join(filter(str.isdigit, value or ''))

    if len(digits) == 11 and digits[0] == '8':
        return '7' + digits[1:]

    if len(digits) == 10:
        return '7' + digits

    return digits


def normalize_telegram(value):
    return (value or '').strip().lstrip('@').strip()


def pick_creator():
    return (
        Employee.objects.filter(role='senior_admin', is_active=True).first()
        or Employee.objects.filter(role='manager', is_active=True).first()
        or Employee.objects.first()
    )


def load_dataset():
    if not DATASET_PATH.exists():
        return []

    with open(DATASET_PATH, encoding='utf-8') as handle:
        return json.load(handle)


def resolve_city(name):
    clean = ' '.join((name or '').split())

    if not clean:
        return None

    city = City.objects.filter(name__iexact=clean).first()

    if city is None:
        city = City.objects.create(name=clean)

    return city


def create_agency(name):
    clean = ' '.join((name or '').split())

    if not clean:
        return None

    agency, _ = Agency.objects.get_or_create(name=clean)

    return agency


def find_existing_client(full_name, phone, telegram, agency):
    if phone:
        found = Client.objects.filter(phone_normalized=phone).first()

        if found:
            return found

    if telegram:
        found = Client.objects.filter(telegram_username__iexact=telegram).first()

        if found:
            return found

    if full_name and agency:
        found = Client.objects.filter(full_name__iexact=full_name, agency=agency).first()

        if found:
            return found

    if full_name and not phone and not telegram:
        found = Client.objects.filter(
            full_name__iexact=full_name,
            agency__isnull=True,
            telegram_username='',
        ).first()

        if found:
            return found

    return None


def import_clients():
    dataset = load_dataset()

    if not dataset:
        return {'created': 0, 'skipped': 0, 'message': 'Файл с клиентами не найден'}

    creator = pick_creator()

    if creator is None:
        return {'created': 0, 'skipped': 0, 'message': 'Сначала создайте сотрудников — клиенту нужен автор'}

    created = 0
    skipped = 0

    for group in dataset:
        agency = create_agency(group.get('agency'))

        for item in group.get('clients', []):
            full_name = ' '.join((item.get('full_name') or '').split())
            phone = normalize_phone(item.get('phone'))
            telegram = normalize_telegram(item.get('telegram'))

            if not full_name and not phone and not telegram:
                skipped += 1
                continue

            if find_existing_client(full_name, phone, telegram, agency):
                skipped += 1
                continue

            client_type = item.get('client_type') or ('agency' if agency else 'organizer')
            city = resolve_city(item.get('city'))

            client = Client.objects.create(
                full_name=full_name or 'Без имени',
                phone=phone,
                client_type=client_type if client_type in ('agency', 'organizer') else 'organizer',
                agency=agency if client_type == 'agency' else None,
                telegram_username=telegram,
                email=(item.get('email') or '').strip(),
                city=city.name if city else '',
                rating=item.get('rating') if item.get('rating') in ('high', 'medium', 'low') else 'medium',
                comment=(item.get('comment') or '').strip(),
                created_by=creator,
            )

            if city:
                client.cities.set([city])

            created += 1

    return {
        'created': created,
        'skipped': skipped,
        'message': f'Клиентов импортировано: {created}, пропущено: {skipped}',
    }
