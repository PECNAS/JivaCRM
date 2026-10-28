import json
from datetime import date, datetime
from pathlib import Path

from django.conf import settings

from viewer.models import (
    City, Client, Employee, Order, OrderEmployee, OrderEstimate, Service,
)

DATASET_PATH = Path(settings.BASE_DIR) / 'viewer' / 'data' / 'orders_import.json'

STATUS_ALIASES = {
    'запрос': 'request',
    'request': 'request',
    'подтвержденный': 'confirmed',
    'подтверждённый': 'confirmed',
    'confirmed': 'confirmed',
    'выполненный': 'completed',
    'completed': 'completed',
}

PAYMENT_ALIASES = {
    'самозанятость': 'self',
    'self': 'self',
    'ип': 'ip',
    'ip': 'ip',
    'наличные': 'cash',
    'cash': 'cash',
}


def load_dataset():
    if not DATASET_PATH.exists():
        return []

    with open(DATASET_PATH, encoding='utf-8') as handle:
        data = json.load(handle)

    if isinstance(data, dict):
        return data.get('orders', [])

    return data


def parse_date(value):
    if not value:
        return None

    if isinstance(value, date):
        return value

    for fmt in ('%Y-%m-%d', '%d.%m.%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue

    return None


def pick_manager():
    return (
        Employee.objects.filter(role='sales_manager', is_active=True).first()
        or Employee.objects.filter(role='senior_admin', is_active=True).first()
        or Employee.objects.first()
    )


def resolve_client(item):
    client = None
    name = (item.get('client') or item.get('client_name') or '').strip()
    phone = ''.join(filter(str.isdigit, item.get('client_phone') or ''))

    if phone:
        digits = phone[-10:]
        client = Client.objects.filter(phone_normalized__endswith=digits).first()

    if client is None and name:
        client = Client.objects.filter(full_name__iexact=name).first()

    if client is None and name:
        client = Client.objects.create(
            full_name=name,
            phone=phone,
            created_by=pick_manager(),
        )

    return client


def resolve_city(item, order):
    city_name = (item.get('city') or '').strip()

    if city_name:
        city = City.objects.filter(name__iexact=city_name).first()

        if city is None:
            city = City.objects.create(name=city_name)

        return city

    return order.city


def employee_payment_rate(item, service_names):
    rates = [
        float(service.artist_rate)
        for service in Service.objects.filter(name__in=service_names)
        if service.artist_rate
    ]

    return max(rates) if rates else 0


def import_orders():
    dataset = load_dataset()

    if not dataset:
        return {'created': 0, 'skipped': 0, 'message': 'Файл с заказами не найден'}

    manager = pick_manager()

    if manager is None:
        return {'created': 0, 'skipped': 0, 'message': 'Сначала создайте сотрудников — заказу нужен менеджер'}

    created = 0
    skipped = 0

    for item in dataset:
        name = ' '.join((item.get('name') or '').split())
        event_date = parse_date(item.get('date'))
        client = resolve_client(item)

        if not name or client is None:
            skipped += 1
            continue

        if Order.objects.filter(name=name, date=event_date, client=client).exists():
            skipped += 1
            continue

        order = Order.objects.create(
            name=name,
            client=client,
            date=event_date,
            address=(item.get('address') or '').strip(),
            contact_phone=(item.get('contact_phone') or client.phone or '').strip(),
            contact_telegram=(item.get('contact_telegram') or client.telegram_username or '').strip(),
            setup_time=(item.get('setup_time') or '').strip(),
            concept=(item.get('concept') or '').strip(),
            manager=manager,
            status=STATUS_ALIASES.get(str(item.get('status') or '').strip().lower(), 'request'),
            payment_method=PAYMENT_ALIASES.get(str(item.get('payment_method') or '').strip().lower(), ''),
            duration=int(item.get('duration') or 1),
            cost=(str(item.get('cost') or '').strip() or '—'),
        )

        order.city = resolve_city(item, order)
        order.save()

        service_names = []
        total_cost = 0.0

        for entry in item.get('services', []):
            if isinstance(entry, str):
                entry = {'name': entry}

            service_name = ' '.join((entry.get('name') or '').split())

            if not service_name:
                continue

            service = Service.objects.filter(name=service_name, type='service').first()
            people_count = int(entry.get('people_count') or entry.get('count') or 0)
            price = entry.get('price')
            coefficient = entry.get('coefficient') or 1

            if price is None and service is not None:
                rows = list(service.staff_rows.order_by('artist_count', 'id'))

                for row in rows:
                    if people_count and row.artist_count >= people_count:
                        price = row.cost
                        break

                if price is None and rows:
                    price = rows[-1].cost

            if price is None:
                price = 0

            OrderEstimate.objects.create(
                order=order,
                service=service,
                service_name=service_name,
                people_count=people_count,
                coefficient=coefficient,
                price=price,
                comment=(entry.get('comment') or '').strip(),
            )

            service_names.append(service_name)
            total_cost += float(price) * float(coefficient)

        if not item.get('cost') and total_cost:
            order.cost = str(int(total_cost))
            order.save(update_fields=['cost'])

        default_rate = employee_payment_rate(item, service_names)

        for entry in item.get('employees', []):
            if isinstance(entry, str):
                entry = {'name': entry}

            full_name = (entry.get('name') or entry.get('full_name') or '').strip()
            employee = Employee.objects.filter(full_name__iexact=full_name).first() if full_name else None

            if employee is None and entry.get('employee_id'):
                employee = Employee.objects.filter(id=entry['employee_id']).first()

            if employee is None:
                continue

            OrderEmployee.objects.create(
                order=order,
                employee=employee,
                employee_name=employee.full_name,
                employee_role=employee.get_role_display(),
                payment=entry.get('payment') or default_rate,
                comment=(entry.get('comment') or '').strip(),
            )

        order.content_hash = order.compute_content_hash()
        order.save(update_fields=['content_hash'])

        created += 1

    return {
        'created': created,
        'skipped': skipped,
        'message': f'Заказов импортировано: {created}, пропущено: {skipped}',
    }
