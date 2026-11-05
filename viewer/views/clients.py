from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.db import transaction
from django.db.models import Count, Q
from django.contrib import messages
from django.db.models import ProtectedError
from django.utils import timezone
from django.conf import settings
from pathlib import Path
import json
import re
from ..models import Client, Agency, AgencyAlias, AgencyManager, City, Order, Employee, Role
from .helpers import format_date_short, match_score, search_key, similarity


CLIENTS_PAGE_SIZE = 50
MAX_CLIENTS_LIMIT = 500


def parse_int(value):
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None

    return result if result > 0 else None


def phone_digits(value):
    return ''.join(filter(str.isdigit, value or ''))


def phone_search_variants(value):
    digits = phone_digits(value)

    if len(digits) < 3:
        return []

    variants = {digits}

    if len(digits) == 10:
        variants.add('7' + digits)
        variants.add('8' + digits)
    elif len(digits) == 11:
        tail = digits[-10:]
        variants.add(tail)
        variants.add('7' + tail)
        variants.add('8' + tail)

    return [item for item in variants if item]


def phone_query(value):
    query = Q()

    for variant in phone_search_variants(value):
        query |= Q(phone_normalized__contains=variant)

    return query


def telegram_handle(value):
    text = (value or '').strip()

    if not text:
        return ''

    text = re.sub(r'^https?://', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(www\.)?(t\.me/|telegram\.me/|telegram\.dog/)', '', text, flags=re.IGNORECASE)
    text = text.split('?')[0].split('#')[0].strip('/').strip()

    return text.lstrip('@').strip().lower()


def telegram_search_terms(value):
    text = (value or '').strip().lower()

    if not text:
        return []

    text = re.sub(r'^https?://', '', text)
    text = re.sub(r'^(www\.|t\.me/|telegram\.me/|telegram\.dog/)', '', text)
    text = re.sub(r'^t\.me/', '', text)
    text = text.split('?')[0].split('#')[0]

    terms = {text.strip('@').strip()}

    if '/' in text:
        terms.add(text.split('/')[-1].strip('@').strip())

    cleaned = {term for term in terms if len(term) >= 2}

    if not cleaned:
        return []

    return sorted(cleaned)


def telegram_query(value):
    query = Q()

    for term in telegram_search_terms(value):
        query |= Q(telegram_username__icontains=term)

    return query


def normalize_name(value):
    return ' '.join((value or '').lower().replace('ё', 'е').split())


def name_keys(value):
    words = [word for word in normalize_name(value).split() if word]

    if len(words) < 2:
        return set()

    return {' '.join(sorted(words))}


def parse_city_ids(request):
    raw_values = request.POST.getlist('city_ids')
    if not raw_values:
        raw_values = request.POST.get('city_ids', '').split(',')

    city_ids = []

    for raw_value in raw_values:
        for part in str(raw_value).split(','):
            part = part.strip()
            if part.isdigit() and int(part) not in city_ids:
                city_ids.append(int(part))

    return city_ids


def parse_city_names(request):
    raw_values = request.POST.getlist('city_names')
    if not raw_values:
        raw_values = request.POST.get('city_names', '').split(',')

    city_names = []

    for raw_value in raw_values:
        for part in str(raw_value).split(','):
            part = ' '.join(part.split())
            if part and part.lower() not in [name.lower() for name in city_names]:
                city_names.append(part)

    return city_names


def resolve_cities(request):
    cities = []

    for city_id in parse_city_ids(request):
        city = City.objects.filter(id=city_id).first()
        if city and city.name.lower() not in [item.name.lower() for item in cities]:
            cities.append(city)

    for city_name in parse_city_names(request):
        city = City.objects.filter(name__iexact=city_name).first()
        if city is None:
            city = City.objects.create(name=city_name)
        if city.name.lower() not in [item.name.lower() for item in cities]:
            cities.append(city)

    return cities


def serialize_client_match(client, fields):
    city_names = [city.name for city in client.cities.all()]
    return {
        'id': client.id,
        'full_name': client.full_name,
        'phone': client.phone,
        'contact': client.get_contact_display(),
        'contact_type': client.contact_type,
        'client_type_key': client.client_type,
        'client_type_display': client.get_client_type_display(),
        'agency_id': client.agency.id if client.agency else None,
        'agency': client.agency.name if client.agency else None,
        'agency_manager': client.agency_manager.id if client.agency_manager else None,
        'agency_manager_name': client.agency_manager.name if client.agency_manager else None,
        'telegram': client.telegram_username or '',
        'email': client.email or '',
        'city': client.city or '',
        'cities': city_names,
        'comment': client.comment or '',
        'rating_key': client.rating,
        'rating_display': client.get_rating_display(),
        'requests_count': client.requests_count,
        'orders_count': client.orders.count(),
        'created_at': client.created_at.strftime('%d.%m.%Y'),
        'matched_fields': fields,
        'reasons': [CLIENT_MATCH_LABELS[field] for field in fields],
    }


CLIENT_MATCH_LABELS = {
    'phone': 'Телефон',
    'email': 'Email',
    'full_name': 'ФИО',
    'telegram': 'Телеграм',
}


def find_client_matches(full_name, phone, telegram, email, exclude_id=None):
    digits = phone_digits(phone)
    handle = telegram_handle(telegram)
    email_value = (email or '').strip().lower()
    requested_name_keys = name_keys(full_name)

    query = Q()

    if len(digits) >= 10:
        query |= Q(phone_normalized__endswith=digits[-10:])

    if email_value:
        query |= Q(email__iexact=email_value)

    for key in requested_name_keys:
        query |= Q(full_name_normalized=key)

    if handle:
        query |= Q(telegram_username__iexact=handle)
        query |= Q(telegram_username__iexact='@' + handle)

    if not query:
        return []

    candidates = Client.objects.filter(query).prefetch_related('cities').select_related('agency', 'created_by__user')

    if exclude_id:
        candidates = candidates.exclude(id=exclude_id)

    matches = []

    for client in candidates:
        fields = []

        client_digits = phone_digits(client.phone)
        if len(digits) >= 10 and len(client_digits) >= 10 and client_digits[-10:] == digits[-10:]:
            fields.append('phone')

        if email_value and (client.email or '').strip().lower() == email_value:
            fields.append('email')

        if requested_name_keys and name_keys(client.full_name) & requested_name_keys:
            fields.append('full_name')

        if handle and telegram_handle(client.telegram_username) == handle:
            fields.append('telegram')

        if fields:
            matches.append(serialize_client_match(client, fields))

    matches.sort(key=lambda item: (len(item['matched_fields']), item['orders_count']), reverse=True)
    return matches


def collect_client_payload(request):
    client_type = request.POST.get('client_type', 'organizer')
    agency_id = request.POST.get('agency_id')
    agency_manager_id = request.POST.get('agency_manager_id')
    agency_name_raw = ' '.join(request.POST.get('agency_name', '').split())

    client_cities = resolve_cities(request)

    contact_value = request.POST.get('contact', '').strip()
    contact_type = request.POST.get('contact_type', '').strip()
    phone = request.POST.get('phone', '').strip()
    telegram = request.POST.get('telegram', '').strip()

    if contact_value:
        detected = Client.detect_contact_type(contact_value)

        if detected == Client.CONTACT_TELEGRAM:
            telegram = contact_value
            phone = ''
        else:
            phone = contact_value
            telegram = ''

        contact_type = detected

    if not contact_type:
        contact_type = Client.detect_contact_type(phone or telegram)

    payload = {
        'full_name': request.POST.get('full_name', '').strip(),
        'phone': phone,
        'contact_type': contact_type,
        'client_type': client_type,
        'agency_id': agency_id,
        'agency_manager_id': agency_manager_id,
        'agency': None,
        'agency_manager': None,
        'telegram': telegram,
        'email': request.POST.get('email', '').strip(),
        'cities': client_cities,
        'city': client_cities[0].name if client_cities else '',
        'city_names': [city.name for city in client_cities],
        'comment': request.POST.get('comment', '').strip(),
        'rating': request.POST.get('rating', 'medium'),
    }

    if agency_id:
        payload['agency'] = Agency.objects.filter(id=agency_id).first()
    elif agency_name_raw:
        existing = None

        for agency in Agency.objects.prefetch_related('aliases'):
            if search_key(agency.name) == search_key(agency_name_raw):
                existing = agency
                break

            for alias in agency.aliases.all():
                if search_key(alias.name) == search_key(agency_name_raw):
                    existing = agency
                    break

            if existing:
                break

        if existing is None:
            existing = Agency.objects.create(name=agency_name_raw)

        payload['agency'] = existing

    if agency_manager_id:
        payload['agency_manager'] = AgencyManager.objects.filter(id=agency_manager_id).first()
    return payload


def apply_client_payload(client, payload):
    client.full_name = payload['full_name']
    client.phone = payload['phone']
    client.contact_type = payload['contact_type']
    client.client_type = payload['client_type']
    client.agency = payload['agency']
    client.telegram_username = telegram_handle(payload['telegram'])
    client.email = payload['email']
    client.city = payload['city']
    client.comment = payload['comment']
    client.rating = payload['rating']
    return client


def validate_client_payload(payload):
    if not payload['full_name']:
        return 'Имя клиента обязательно для заполнения'

    if payload['client_type'] == 'agency' and not payload['agency']:
        return 'Для клиента необходимо указать агентство'

    if not payload['phone'] and not payload['telegram']:
        return 'Укажите телефон или телеграм'

    if payload['phone'] and len(phone_digits(payload['phone'])) != 11:
        return 'Номер телефона должен содержать 11 цифр'

    return None


def create_client_from_payload(payload, employee_obj):
    client = Client(
        agency_manager=payload['agency_manager'],
        created_by=employee_obj,
    )
    apply_client_payload(client, payload)
    client.save()
    client.cities.set(payload['cities'])
    return client


def update_client_from_payload(client, payload):
    if payload['agency_manager_id']:
        client.agency_manager = payload['agency_manager']
    apply_client_payload(client, payload)
    client.save()
    client.cities.set(payload['cities'])
    return client


def serialize_new_client(client, agency):
    return {
        'id': client.id,
        'full_name': client.full_name,
        'phone': client.phone,
        'contact_type': client.contact_type,
        'contact': client.get_contact_display(),
        'client_type': client.client_type,
        'client_type_display': client.get_client_type_display(),
        'telegram': client.telegram_username,
        'email': client.email,
        'agency_id': agency.id if agency else None,
        'agency': agency.name if agency else None,
        'agency_manager': client.agency_manager.name if client.agency_manager else None,
        'city': client.city,
        'cities': [city.name for city in client.cities.all()],
        'comment': client.comment,
        'rating': client.rating,
        'orders_count': 0,
        'requests_count': client.requests_count,
    }


class ClientsView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                messages.error(request, 'У вас недостаточно прав для просмотра клиентов')
                return redirect('index')
        except:
            return redirect('logout')

        clients = Client.objects.filter(is_active=True).annotate(
            orders_count=Count('orders')
        ).prefetch_related('cities').select_related('agency', 'agency_manager', 'created_by__user').order_by('full_name')

        search_query = request.GET.get('search', '')
        rating_filter = request.GET.get('rating', 'all')
        city_filter = request.GET.get('city', 'all')
        agency_filter = request.GET.get('agency', 'all')
        group_by = request.GET.get('group', '')

        if search_query:
            search_filter = (
                Q(full_name__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(agency__name__icontains=search_query) |
                Q(agency__aliases__name__icontains=search_query) |
                Q(agency_manager__name__icontains=search_query) |
                Q(telegram_username__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(cities__name__icontains=search_query) |
                Q(city__icontains=search_query)
            )

            if len(phone_digits(search_query)) >= 3:
                search_filter |= phone_query(search_query)

            search_filter |= telegram_query(search_query)

            clients = clients.filter(search_filter).distinct()

        if rating_filter != 'all':
            clients = clients.filter(rating=rating_filter)

        if agency_filter != 'all' and agency_filter.isdigit():
            clients = clients.filter(agency_id=int(agency_filter))

        if city_filter != 'all' and city_filter.isdigit():
            city_name = City.objects.filter(id=int(city_filter)).values_list('name', flat=True).first()

            city_query = Q(cities__id=int(city_filter))

            if city_name:
                city_query |= Q(city__iexact=city_name)

            clients = clients.filter(city_query).distinct()

        grouped = []

        if group_by == 'agency':
            buckets = {}

            for client in clients[:CLIENTS_PAGE_SIZE]:
                key = client.agency.id if client.agency else 0

                if key not in buckets:
                    buckets[key] = {
                        'agency_id': client.agency.id if client.agency else None,
                        'agency_name': client.agency.name if client.agency else 'Без агентства',
                        'clients': [],
                        'orders_count': 0,
                    }

                buckets[key]['clients'].append(client)
                buckets[key]['orders_count'] += getattr(client, 'orders_count', 0)

            grouped = sorted(buckets.values(), key=lambda item: (-len(item['clients']), item['agency_name']))

        total = clients.count()

        context = {
            'clients': clients[:CLIENTS_PAGE_SIZE],
            'clients_total': total,
            'has_more': total > CLIENTS_PAGE_SIZE,
            'agencies': Agency.objects.all(),
            'agency_managers': AgencyManager.objects.filter(is_active=True).select_related('agency'),
            'cities': City.objects.all(),
            'search_query': search_query,
            'rating_filter': rating_filter,
            'city_filter': city_filter,
            'agency_filter': agency_filter,
            'group_by': group_by,
            'grouped': grouped,
        }
        return render(request, "clients.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            payload = collect_client_payload(request)
            error = validate_client_payload(payload)
            if error:
                return JsonResponse({'error': error}, status=400)

            try:
                employee_obj = Employee.objects.get(user=request.user)
            except Employee.DoesNotExist:
                return JsonResponse({'error': 'Профиль сотрудника не найден'}, status=400)

            force_create = request.POST.get('force_create') in ('1', 'true', 'True', 'on')

            matches = find_client_matches(
                payload['full_name'],
                payload['phone'],
                payload['telegram'],
                payload['email'],
            )

            if matches and not force_create:
                return JsonResponse({
                    'success': False,
                    'duplicate': True,
                    'matches': matches,
                }, status=409)

            client = create_client_from_payload(payload, employee_obj)

            return JsonResponse({
                'success': True,
                'client': serialize_new_client(client, payload['agency'])
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ClientDetailView(View):
    def get(self, request, client_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            client = Client.objects.annotate(
                orders_count=Count('orders')
            ).prefetch_related('cities').select_related('agency', 'agency_manager', 'created_by__user').get(id=client_id)

            orders = Order.objects.filter(client=client).select_related('manager__user')

            orders_list = []
            for order in orders:
                orders_list.append({
                    'id': order.id,
                    'name': order.name or '—',
                    'address': order.address,
                    'date': format_date_short(order.date),
                    'status': order.get_status_display(),
                    'status_key': order.status,
                    'cost': order.cost,
                    'manager': order.manager.display_name if order.manager else None,
                })

            client_cities = client.cities.all()

            return JsonResponse({
                'id': client.id,
                'full_name': client.full_name,
                'phone': client.phone,
                'contact': client.get_contact_display(),
                'contact_type': client.contact_type,
                'client_type_key': client.client_type,
                'client_type_display': client.get_client_type_display(),
                'agency_id': client.agency.id if client.agency else None,
                'agency': client.agency.name if client.agency else None,
                'agency_manager_id': client.agency_manager.id if client.agency_manager else None,
                'agency_manager': client.agency_manager.name if client.agency_manager else None,
                'telegram': client.telegram_username or '—',
                'rating': client.rating,
                'rating_key': client.rating,
                'rating_display': client.get_rating_display(),
                'email': client.email or '—',
                'city': client.get_cities_display() or '—',
                'city_ids': [city.id for city in client_cities],
                'cities': [city.name for city in client_cities],
                'comment': client.comment or '',
                'requests_count': client.requests_count,
                'orders_count': client.orders_count,
                'orders': orders_list,
                'created_by': client.created_by.display_name if client.created_by else None,
            })
        except Client.DoesNotExist:
            return JsonResponse({'error': 'Клиент не найден'}, status=404)


class ClientUpdateView(View):
    def post(self, request, client_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            client = get_object_or_404(Client, id=client_id)

            payload = collect_client_payload(request)
            error = validate_client_payload(payload)
            if error:
                return JsonResponse({'error': error}, status=400)

            agency = payload['agency']

            update_client_from_payload(client, payload)

            return JsonResponse({
                'success': True,
                'client': {
                    'id': client.id,
                    'full_name': client.full_name,
                    'phone': client.phone,
                    'contact': client.get_contact_display(),
                    'contact_type': client.contact_type,
                    'client_type': client.client_type,
                    'client_type_display': client.get_client_type_display(),
                    'telegram': client.telegram_username,
                    'email': client.email,
                    'agency': agency.name if agency else None,
                    'agency_manager': client.agency_manager.name if client.agency_manager else None,
                    'city': client.city,
                    'cities': [city.name for city in client.cities.all()],
                    'comment': client.comment,
                    'rating': client.rating,
                    'rating_display': client.get_rating_display(),
                    'orders_count': client.orders.count(),
                    'requests_count': client.requests_count
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ClientDeleteView(View):
    def post(self, request, client_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            client = get_object_or_404(Client, id=client_id)

            if client.orders.exists():
                client.is_active = False
                client.deactivated_at = timezone.now()
                client.save(update_fields=['is_active', 'deactivated_at', 'updated_at'])

                return JsonResponse({'success': True, 'deactivated': True})

            client.delete()
            return JsonResponse({'success': True, 'deactivated': False})
        except ProtectedError:
            client = Client.objects.filter(id=client_id).first()

            if client:
                client.is_active = False
                client.deactivated_at = timezone.now()
                client.save(update_fields=['is_active', 'deactivated_at', 'updated_at'])
                return JsonResponse({'success': True, 'deactivated': True})

            return JsonResponse({'error': 'Невозможно удалить клиента'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ClientListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        clients = Client.objects.filter(is_active=True).annotate(
            orders_count=Count('orders')
        ).prefetch_related('cities').select_related('agency', 'agency_manager').order_by('full_name')

        search = request.GET.get('search', '')
        rating = request.GET.get('rating', 'all')
        city = request.GET.get('city', 'all')
        agency = request.GET.get('agency', 'all')

        if search:
            search_filter = (
                Q(full_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(telegram_username__icontains=search) |
                Q(email__icontains=search) |
                Q(agency__name__icontains=search) |
                Q(agency__aliases__name__icontains=search) |
                Q(agency_manager__name__icontains=search)
            )

            if len(phone_digits(search)) >= 3:
                search_filter |= phone_query(search)

            search_filter |= telegram_query(search)

            clients = clients.filter(search_filter).distinct()

        if rating != 'all':
            clients = clients.filter(rating=rating)

        if agency != 'all' and agency.isdigit():
            clients = clients.filter(agency_id=int(agency))

        if city != 'all' and city.isdigit():
            clients = clients.filter(cities__id=int(city)).distinct()

        total = clients.count()
        offset = parse_int(request.GET.get('offset')) or 0
        limit = min(parse_int(request.GET.get('limit')) or CLIENTS_PAGE_SIZE, MAX_CLIENTS_LIMIT)

        clients_list = []
        for client in clients[offset:offset + limit]:
            clients_list.append({
                'id': client.id,
                'full_name': client.full_name,
                'phone': client.phone,
                'contact': client.get_contact_display(),
                'contact_type': client.contact_type,
                'client_type': client.client_type,
                'client_type_display': client.get_client_type_display(),
                'telegram': client.telegram_username,
                'agency': client.agency.name if client.agency else None,
                'agency_id': client.agency.id if client.agency else None,
                'agency_manager': client.agency_manager.name if client.agency_manager else None,
                'rating': client.rating,
                'rating_display': client.get_rating_display(),
                'requests_count': client.requests_count,
                'orders_count': client.orders_count,
                'email': client.email,
                'city': client.get_cities_display(),
                'cities': [city.name for city in client.cities.all()],
                'comment': client.comment,
            })

        return JsonResponse({
            'clients': clients_list,
            'total': total,
            'has_more': offset + len(clients_list) < total,
        })


class CityCatalogView(View):
    URL_NAME = 'client_cities'

    dataset = None
    dataset_by_name = None

    @classmethod
    def load_dataset(cls):
        if cls.dataset is not None:
            return cls.dataset

        path = Path(settings.BASE_DIR) / 'viewer' / 'data' / 'russian_cities.json'

        try:
            with open(path, encoding='utf-8') as handle:
                cls.dataset = json.load(handle)
        except (OSError, ValueError):
            cls.dataset = []

        cls.dataset_by_name = {}

        for item in cls.dataset:
            key = item['name'].strip().lower().replace('ё', 'е')
            cls.dataset_by_name.setdefault(key, item)

        return cls.dataset

    @staticmethod
    def rank(name, query):
        normalized_name = name.strip().lower().replace('ё', 'е')
        normalized_query = query.strip().lower().replace('ё', 'е')

        if not normalized_query:
            return (3, 0, name)

        if normalized_name == normalized_query:
            score = 0
        elif normalized_name.startswith(normalized_query):
            score = 1
        else:
            position = normalized_name.find(normalized_query)
            score = 2 if position >= 0 else 3

        return (score, len(normalized_name), name)

    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        query = request.GET.get('search', '').strip()
        limit = request.GET.get('limit', '40')

        try:
            limit = max(1, min(int(limit), 200))
        except (TypeError, ValueError):
            limit = 40

        dataset = self.load_dataset()

        if query:
            matches = [item for item in dataset if query.strip().lower().replace('ё', 'е') in item['name'].strip().lower().replace('ё', 'е')]
        else:
            matches = list(dataset)

        matches.sort(key=lambda item: self.rank(item['name'], query))
        matches = matches[:limit]

        return JsonResponse({
            'cities': [{'name': item['name'], 'subject': item['subject']} for item in matches],
        })

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            name = ' '.join(request.POST.get('name', '').split())

            if not name:
                return JsonResponse({'error': 'Название города обязательно для заполнения'}, status=400)

            city = City.objects.filter(name__iexact=name).first()

            if city:
                return JsonResponse({
                    'success': True,
                    'created': False,
                    'city': {'id': city.id, 'name': city.name}
                })

            city = City.objects.create(name=name)

            return JsonResponse({
                'success': True,
                'created': True,
                'city': {'id': city.id, 'name': city.name}
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class AgencyCatalogView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        query = request.GET.get('search', '').strip()

        agencies = list(Agency.objects.prefetch_related('aliases', 'managers'))

        if query:
            ranked = []

            for agency in agencies:
                best = match_score(query, agency.name)

                for alias in agency.aliases.all():
                    best = max(best, match_score(query, alias.name))

                if best < 55:
                    continue

                ranked.append((best, agency.name.lower(), agency))

            ranked.sort(key=lambda item: (-item[0], item[1]))
            agencies = [item[2] for item in ranked]
        else:
            agencies.sort(key=lambda item: item.name.lower())

        agencies = agencies[:40]

        return JsonResponse({
            'agencies': [
                {
                    'id': agency.id,
                    'name': agency.name,
                    'aliases': [alias.name for alias in agency.aliases.all()],
                    'managers': [
                        {'id': manager.id, 'name': manager.name, 'phone': manager.phone}
                        for manager in agency.managers.filter(is_active=True)
                    ],
                }
                for agency in agencies
            ],
        })


class ClientDeleteMatchedView(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            client_id = request.POST.get('client_id')

            try:
                client = Client.objects.get(id=client_id)
            except (Client.DoesNotExist, ValueError, TypeError):
                return JsonResponse({'error': 'Клиент не найден'}, status=404)

            orders_count = client.orders.count()

            if orders_count:
                client.is_active = False
                client.deactivated_at = timezone.now()
                client.save(update_fields=['is_active', 'deactivated_at', 'updated_at'])

                return JsonResponse({
                    'success': True,
                    'deactivated': True,
                    'deleted_id': client_id,
                    'deleted_orders': 0
                })

            client = Client.objects.get(id=client_id)
            client.delete()

            return JsonResponse({
                'success': True,
                'deleted_id': client_id,
                'deleted_orders': 0
            })
        except ProtectedError:
            return JsonResponse({
                'error': 'Невозможно удалить клиента: у него есть связанные записи.'
            }, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class AgencyCreateView(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            name = ' '.join(request.POST.get('name', '').split())
            alias = ' '.join(request.POST.get('alias', '').split())
            manager_name = ' '.join(request.POST.get('manager_name', '').split())
            manager_phone = request.POST.get('manager_phone', '').strip()

            if not name:
                return JsonResponse({'error': 'Название агентства обязательно для заполнения'}, status=400)

            normalized = search_key(name)
            existing = None

            for agency in Agency.objects.prefetch_related('aliases'):
                if search_key(agency.name) == normalized:
                    existing = agency
                    break

                for item in agency.aliases.all():
                    if search_key(item.name) == normalized:
                        existing = agency
                        break

                if existing:
                    break

            if existing is not None:
                return JsonResponse({
                    'success': True,
                    'created': False,
                    'agency': {
                        'id': existing.id,
                        'name': existing.name,
                        'aliases': [item.name for item in existing.aliases.all()],
                    }
                })

            agency = Agency.objects.create(name=name)

            if alias and search_key(alias) != normalized:
                AgencyAlias.objects.create(agency=agency, name=alias)

            manager = None

            if manager_name:
                manager = AgencyManager.objects.create(
                    agency=agency,
                    name=manager_name,
                    phone=manager_phone,
                )

            return JsonResponse({
                'success': True,
                'created': True,
                'agency': {
                    'id': agency.id,
                    'name': agency.name,
                    'aliases': [item.name for item in agency.aliases.all()],
                    'manager': {'id': manager.id, 'name': manager.name} if manager else None,
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class AgencyAliasView(View):
    def post(self, request, agency_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        agency = Agency.objects.filter(id=agency_id).first()

        if agency is None:
            return JsonResponse({'error': 'Агентство не найдено'}, status=404)

        name = ' '.join(request.POST.get('name', '').split())

        if not name:
            return JsonResponse({'error': 'Вариация названия обязательна'}, status=400)

        if search_key(name) == search_key(agency.name):
            return JsonResponse({'error': 'Вариация совпадает с названием агентства'}, status=400)

        exists = AgencyAlias.objects.filter(agency=agency, normalized_name=search_key(name)).exists()

        if exists:
            return JsonResponse({'error': 'Такая вариация уже добавлена'}, status=400)

        AgencyAlias.objects.create(agency=agency, name=name)

        return JsonResponse({
            'success': True,
            'aliases': [item.name for item in agency.aliases.all()],
        })

    def delete(self, request, agency_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        alias_id = request.GET.get('id') or request.POST.get('id')
        alias = AgencyAlias.objects.filter(id=alias_id, agency_id=agency_id).first()

        if alias is None:
            return JsonResponse({'error': 'Вариация не найдена'}, status=404)

        alias.delete()

        return JsonResponse({'success': True})


class AgencyManagerView(View):
    def post(self, request, agency_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        agency = Agency.objects.filter(id=agency_id).first()

        if agency is None:
            return JsonResponse({'error': 'Агентство не найдено'}, status=404)

        name = ' '.join(request.POST.get('name', '').split())

        if not name:
            return JsonResponse({'error': 'Имя менеджера обязательно'}, status=400)

        manager = AgencyManager.objects.create(
            agency=agency,
            name=name,
            phone=request.POST.get('phone', '').strip(),
            telegram_username=request.POST.get('telegram', '').strip(),
            comment=request.POST.get('comment', '').strip(),
        )

        return JsonResponse({
            'success': True,
            'manager': {'id': manager.id, 'name': manager.name, 'phone': manager.phone},
        })


class AgencyManagerListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        agency_id = request.GET.get('agency_id')
        query = request.GET.get('search', '').strip()

        managers = AgencyManager.objects.filter(is_active=True).select_related('agency')

        if agency_id and agency_id.isdigit():
            managers = managers.filter(agency_id=int(agency_id))

        if query:
            managers = managers.filter(name__icontains=query)

        return JsonResponse({
            'managers': [
                {'id': item.id, 'name': item.name, 'agency_id': item.agency_id, 'agency': item.agency.name}
                for item in managers[:50]
            ]
        })
