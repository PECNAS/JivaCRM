import json
from pathlib import Path

from django.conf import settings

from viewer.models import Employee, Service, ServiceStaffRow

DATASET_PATH = Path(settings.BASE_DIR) / 'viewer' / 'data' / 'services_import.json'


def load_dataset():
    if not DATASET_PATH.exists():
        return []

    with open(DATASET_PATH, encoding='utf-8') as handle:
        data = json.load(handle)

    if isinstance(data, dict):
        return data.get('catalogs', data.get('services', []))

    return data


def pick_owner():
    return (
        Employee.objects.filter(role='senior_admin', is_active=True).first()
        or Employee.objects.filter(role='manager', is_active=True).first()
        or Employee.objects.first()
    )


def clean_name(value):
    return ' '.join((value or '').split())


def to_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_rows(show):
    prices = show.get('prices') or show.get('rows') or show.get('staff_rows') or []
    result = []

    for position, row in enumerate(prices):
        if isinstance(row, dict):
            count = row.get('artists') or row.get('artist_count') or row.get('count')
            cost = row.get('cost') or row.get('price')
        elif isinstance(row, (list, tuple)) and len(row) >= 2:
            count, cost = row[0], row[1]
        else:
            continue

        count = to_number(count)
        cost = to_number(cost)

        if count is None or cost is None or count <= 0 or cost <= 0:
            continue

        result.append((int(count), cost, position))

    result.sort(key=lambda item: item[0])

    return result


def resolve_category(catalog, owner):
    name = clean_name(catalog.get('name'))

    if not name:
        return None, False

    category, created = Service.objects.get_or_create(
        name=name,
        parent=None,
        type='category',
        defaults={
            'created_by': owner,
            'description': 'Импорт из прайса',
            'is_active': True,
        },
    )

    return category, created


def import_services():
    dataset = load_dataset()

    if not dataset:
        return {'created': 0, 'skipped': 0, 'message': 'Файл с услугами не найден'}

    owner = pick_owner()

    if owner is None:
        return {'created': 0, 'skipped': 0, 'message': 'Сначала создайте сотрудников — услуге нужен автор'}

    created = 0
    skipped = 0
    orders_count = 0
    categories = 0

    for catalog in dataset:
        if not isinstance(catalog, dict):
            skipped += 1
            continue

        category, category_created = resolve_category(catalog, owner)

        if category_created:
            categories += 1

        shows = catalog.get('shows') or catalog.get('services') or []

        for index, show in enumerate(shows):
            if not isinstance(show, dict):
                skipped += 1
                continue

            name = clean_name(show.get('name') or show.get('show'))

            if not name:
                skipped += 1
                continue

            if Service.objects.filter(name=name, parent=category, type='service').exists():
                skipped += 1
                continue

            rows = normalize_rows(show)
            artist_rate = to_number(show.get('artist_rate')) or 0

            service = Service.objects.create(
                name=name,
                type='service',
                parent=category,
                description=clean_name(show.get('description')),
                duration=clean_name(show.get('duration')),
                artist_rate=artist_rate,
                order=index,
                created_by=owner,
                is_active=True,
            )

            if rows:
                ServiceStaffRow.objects.bulk_create([
                    ServiceStaffRow(service=service, artist_count=count, cost=cost, order=position)
                    for count, cost, position in rows
                ])

            created += 1
            orders_count += len(rows)

    return {
        'created': created,
        'skipped': skipped,
        'message': f'Каталогов: {categories}, услуг импортировано: {created}, ставок: {orders_count}, пропущено: {skipped}',
    }
