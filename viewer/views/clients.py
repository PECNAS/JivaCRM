from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.db import transaction
from django.db.models import Count, Q
from django.core.paginator import Paginator
from django.contrib import messages
from django.db.models import ProtectedError
from ..models import Client, Agency, City, Order, Employee, Role


def phone_digits(value):
    return ''.join(filter(str.isdigit, value or ''))


def telegram_handle(value):
    return (value or '').strip().lstrip('@').strip().lower()


def split_words(value):
    return [word for word in (value or '').lower().replace('ё', 'е').split() if len(word) >= 3]


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
    city_names = parse_city_names(request)

    for city_id in parse_city_ids(request):
        city = City.objects.filter(id=city_id).first()
        if city and city.name.lower() not in [item.name.lower() for item in cities]:
            cities.append(city)

    for city_name in city_names:
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
        'client_type_key': client.client_type,
        'client_type_display': client.get_client_type_display(),
        'agency_id': client.agency.id if client.agency else None,
        'agency': client.agency.name if client.agency else None,
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
    'telegram': 'Телеграм',
    'full_name': 'ФИО',
    'agency': 'Агентство',
    'email': 'Email',
    'city': 'Город',
}


def find_client_matches(full_name, phone, telegram, email, city, agency, cities=None, exclude_id=None):
    candidates = Client.objects.prefetch_related('cities').select_related('agency', 'created_by__user')
    if exclude_id:
        candidates = candidates.exclude(id=exclude_id)

    candidates = list(candidates)
    matches = []

    digits = phone_digits(phone)
    handle = telegram_handle(telegram)
    name_key = ' '.join(split_words(full_name))
    name_words = set(split_words(full_name))
    email_value = (email or '').strip().lower()

    for client in candidates:
        fields = []

        client_digits = phone_digits(client.phone)
        if digits and len(digits) >= 10 and client_digits[-10:] == digits[-10:]:
            fields.append('phone')

        if handle and telegram_handle(client.telegram_username) == handle:
            fields.append('telegram')

        candidate_key = ' '.join(split_words(client.full_name))
        if name_key and candidate_key == name_key:
            fields.append('full_name')
        elif len(name_words) >= 2:
            candidate_words = set(split_words(client.full_name))
            if len(name_words & candidate_words) >= 2:
                fields.append('full_name')

        if agency and client.agency_id == agency.id:
            fields.append('agency')

        if email_value and (client.email or '').strip().lower() == email_value:
            fields.append('email')

        if cities:
            client_city_names = {city.name.lower() for city in client.cities.all()}
            requested_city_names = {name.lower() for name in cities}

            if client.city:
                client_city_names.add(client.city.lower())

            if client_city_names & requested_city_names:
                fields.append('city')

        if fields:
            matches.append(serialize_client_match(client, fields))

    matches.sort(key=lambda item: (len(item['matched_fields']), item['orders_count']), reverse=True)
    return matches


def collect_client_payload(request):
    client_type = request.POST.get('client_type', 'organizer')
    agency_id = request.POST.get('agency_id')

    client_cities = resolve_cities(request)

    payload = {
        'full_name': request.POST.get('full_name', '').strip(),
        'phone': request.POST.get('phone', '').strip(),
        'client_type': client_type,
        'agency_id': agency_id,
        'agency': None,
        'telegram': request.POST.get('telegram', '').strip(),
        'email': request.POST.get('email', '').strip(),
        'cities': client_cities,
        'city': client_cities[0].name if client_cities else '',
        'city_names': [city.name for city in client_cities],
        'comment': request.POST.get('comment', '').strip(),
        'rating': request.POST.get('rating', 'medium'),
    }

    if agency_id:
        payload['agency'] = Agency.objects.filter(id=agency_id).first()
    return payload


def validate_client_payload(payload):
    if not payload['full_name']:
        return 'ФИО обязательно для заполнения'
    if not payload['phone']:
        return 'Телефон обязателен для заполнения'
    if len(phone_digits(payload['phone'])) != 11:
        return 'Номер телефона должен содержать 11 цифр'
    if payload['client_type'] == 'agency' and not payload['agency']:
        return 'Для клиента типа "Агентство" необходимо выбрать агентство'
    return None


def create_client_from_payload(payload, employee_obj):
    client = Client.objects.create(
        full_name=payload['full_name'],
        phone=payload['phone'],
        client_type=payload['client_type'],
        agency=payload['agency'],
        telegram_username=payload['telegram'],
        email=payload['email'],
        city=payload['city'],
        comment=payload['comment'],
        rating=payload['rating'],
        created_by=employee_obj,
    )
    if payload['cities']:
        client.cities.set(payload['cities'])
    return client


def update_client_from_payload(client, payload):
    client.full_name = payload['full_name']
    client.phone = payload['phone']
    client.client_type = payload['client_type']
    client.agency = payload['agency']
    client.telegram_username = payload['telegram']
    client.email = payload['email']
    client.city = payload['city']
    client.comment = payload['comment']
    client.rating = payload['rating']
    client.save()
    client.cities.set(payload['cities'])
    return client


def serialize_new_client(client, agency):
    return {
        'id': client.id,
        'full_name': client.full_name,
        'phone': client.phone,
        'client_type': client.client_type,
        'client_type_display': client.get_client_type_display(),
        'telegram': client.telegram_username,
        'email': client.email,
        'agency': agency.name if agency else None,
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

        clients = Client.objects.annotate(
            orders_count=Count('orders')
        ).prefetch_related('cities').select_related('agency', 'created_by__user').order_by('full_name')

        search_query = request.GET.get('search', '')
        rating_filter = request.GET.get('rating', 'all')
        city_filter = request.GET.get('city', 'all')

        if search_query:
            clients = clients.filter(
                Q(full_name__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(agency__name__icontains=search_query) |
                Q(cities__name__icontains=search_query) |
                Q(city__icontains=search_query)
            ).distinct()

        if rating_filter != 'all':
            clients = clients.filter(rating=rating_filter)

        if city_filter != 'all' and city_filter.isdigit():
            city_name = City.objects.filter(id=int(city_filter)).values_list('name', flat=True).first()

            city_query = Q(cities__id=int(city_filter))

            if city_name:
                city_query |= Q(city__iexact=city_name)

            clients = clients.filter(city_query).distinct()

        paginator = Paginator(clients, 20)
        page_obj = paginator.get_page(request.GET.get('page', 1))

        agencies = Agency.objects.all()
        cities = City.objects.all()

        context = {
            'clients': page_obj,
            'agencies': agencies,
            'cities': cities,
            'search_query': search_query,
            'rating_filter': rating_filter,
            'city_filter': city_filter,
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
                payload['city'],
                payload['agency'],
                cities=payload['city_names'],
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
            ).prefetch_related('cities').select_related('agency', 'created_by__user').get(id=client_id)

            orders = Order.objects.filter(client=client).select_related('manager__user')

            orders_list = []
            for order in orders:
                orders_list.append({
                    'id': order.id,
                    'address': order.address,
                    'date': order.date.strftime('%d.%m.%Y'),
                    'status': order.get_status_display(),
                    'status_key': order.status,
                    'cost': order.cost,
                    'manager': order.manager.full_name if order.manager else None,
                })

            client_cities = client.cities.all()

            return JsonResponse({
                'id': client.id,
                'full_name': client.full_name,
                'phone': client.phone,
                'client_type_key': client.client_type,
                'client_type_display': client.get_client_type_display(),
                'agency_id': client.agency.id if client.agency else None,
                'agency': client.agency.name if client.agency else None,
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
                'created_by': client.created_by.full_name if client.created_by else None,
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
                    'client_type': client.client_type,
                    'client_type_display': client.get_client_type_display(),
                    'telegram': client.telegram_username,
                    'email': client.email,
                    'agency': agency.name if agency else None,
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
            client.delete()
            return JsonResponse({'success': True})
        except ProtectedError:
            return JsonResponse({
                'error': 'Невозможно удалить клиента: у него есть связанные заказы. Удалите сначала заказы.'
            }, status=400)
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

        clients = Client.objects.annotate(
            orders_count=Count('orders')
        ).prefetch_related('cities').select_related('agency').order_by('full_name')

        search = request.GET.get('search', '')
        rating = request.GET.get('rating', 'all')
        city = request.GET.get('city', 'all')

        if search:
            clients = clients.filter(
                Q(full_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(agency__name__icontains=search)
            )

        if rating != 'all':
            clients = clients.filter(rating=rating)

        if city != 'all' and city.isdigit():
            clients = clients.filter(cities__id=int(city)).distinct()

        clients_list = []
        for client in clients:
            clients_list.append({
                'id': client.id,
                'full_name': client.full_name,
                'phone': client.phone,
                'client_type': client.client_type,
                'client_type_display': client.get_client_type_display(),
                'telegram': client.telegram_username,
                'agency': client.agency.name if client.agency else None,
                'rating': client.rating,
                'rating_display': client.get_rating_display(),
                'requests_count': client.requests_count,
                'orders_count': client.orders_count,
                'email': client.email,
                'city': client.get_cities_display(),
                'cities': [city.name for city in client.cities.all()],
                'comment': client.comment,
            })

        return JsonResponse({'clients': clients_list})


class CityCreateView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        search = request.GET.get('search', '').strip()

        cities = City.objects.all().order_by('name')

        if search:
            cities = cities.filter(name__icontains=search)

        return JsonResponse({
            'cities': [{'id': city.id, 'name': city.name} for city in cities[:50]]
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
            name = request.POST.get('name', '').strip()

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

            with transaction.atomic():
                Order.objects.filter(client=client).delete()
                client.delete()

            return JsonResponse({
                'success': True,
                'deleted_id': client_id,
                'deleted_orders': orders_count
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
            name = request.POST.get('name', '').strip()

            if not name:
                return JsonResponse({'error': 'Название агентства обязательно для заполнения'}, status=400)

            agency, created = Agency.objects.get_or_create(name=name)

            if not created:
                return JsonResponse({'error': 'Агентство с таким названием уже существует'}, status=400)

            return JsonResponse({
                'success': True,
                'agency': {
                    'id': agency.id,
                    'name': agency.name
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)