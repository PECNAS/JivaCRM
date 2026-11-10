from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q
from django.contrib import messages
from django.utils import timezone
from datetime import datetime
from decimal import Decimal, InvalidOperation
import json
from ..models import (
    Order, Client, Employee, OrderEstimate, OrderEmployee, Service, City,
    CityGroup, CalendarColor, PriceRisePeriod, OrderExpense,
    OrderPayment, ChecklistTemplate, ChecklistItem, OrderFeedback, OrderShowTemplate,
    ROLE_LABELS, ROLE_CHOICES, ARTIST_ROLES,
)
from .helpers import format_date_short, format_money, parse_money, role_label
from .money_service import sync_order_balance, refresh_employee_accrual
from .checklist_service import attach_for_order, attach_template, serialize_checklist


def format_date(date_value):
    if not date_value:
        return ''
    if hasattr(date_value, 'strftime'):
        return date_value.strftime('%Y-%m-%d')
    return str(date_value)


def format_datetime(date_value):
    if not date_value:
        return ''

    if timezone.is_aware(date_value):
        date_value = timezone.localtime(date_value)

    return date_value.strftime('%Y-%m-%dT%H:%M')


def parse_datetime(value):
    text = (value or '').strip()

    if not text:
        return None

    for template in ('%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S'):
        try:
            parsed = datetime.strptime(text, template)

            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)

            return parsed
        except ValueError:
            continue

    return None


def serialize_payment(payment):
    return {
        'id': payment.id,
        'amount': float(payment.amount),
        'amount_display': format_money(payment.amount),
        'paid_at': format_date(payment.paid_at),
        'paid_at_display': format_date_short(payment.paid_at),
        'comment': payment.comment or '',
        'is_cancelled': payment.is_cancelled,
        'created_by': payment.created_by.display_name if payment.created_by else '',
        'created_at': payment.created_at.strftime('%d.%m.%Y') if payment.created_at else '',
    }


def serialize_expense(expense):
    return {
        'id': expense.id,
        'order_id': expense.order_id,
        'payer_name': expense.payer_name,
        'amount': float(expense.amount),
        'comment': expense.comment or '',
        'status': expense.status,
        'status_display': expense.get_status_display(),
        'status_class': expense.get_status_class(),
        'period_date': expense.period_date.strftime('%Y-%m-%d') if expense.period_date else '',
        'period_date_display': expense.period_date.strftime('%d.%m.%Y') if expense.period_date else '',
        'created_by': expense.created_by.display_name if expense.created_by else '',
        'created_at': expense.created_at.strftime('%d.%m.%Y') if expense.created_at else '',
        'decided_by': expense.decided_by.display_name if expense.decided_by else '',
        'decided_at': expense.decided_at.strftime('%d.%m.%Y %H:%M') if expense.decided_at else '',
    }


def serialize_calendar_colors():
    colors = {}
    for c in CalendarColor.objects.filter(is_active=True):
        key = c.type if c.type != 'order' else f'order:{c.status}'
        colors[key] = {
            'background': c.background_color,
            'border': c.border_color,
            'text': c.text_color,
        }
    return colors


def order_common_fields(order):
    managers = [order.manager] if order.manager else []
    managers.extend(list(order.managers.all()))

    return {
        'id': order.id,
        'name': order.name or '—',
        'auto_name': order.auto_name or '',
        'name_is_manual': order.name_is_manual,
        'name_display': (order.name or '—').upper() if order.status == 'confirmed' else (order.name or '—'),
        'address': order.address or '',
        'date': format_date(order.date),
        'date_display': format_date_short(order.date),
        'has_date': bool(order.date),
        'start_datetime': format_datetime(order.start_datetime),
        'end_datetime': format_datetime(order.end_datetime),
        'client': order.client.full_name,
        'client_id': order.client.id,
        'city_id': order.city.id if order.city else None,
        'city_name': order.city.name if order.city else '',
        'chat_number': order.chat_number or '',
        'cost': order.cost or '—',
        'status': order.status,
        'status_display': order.get_status_display(),
        'manager': order.manager.display_name if order.manager else '',
        'manager_id': order.manager.id if order.manager else None,
        'managers': [
            {'id': item.id, 'name': item.display_name} for item in managers if item is not None
        ],
        'payment_due_date': format_date(order.payment_due_date),
        'payment_due_date_display': format_date_short(order.payment_due_date),
        'payment_due_comment': order.payment_due_comment or '',
        'total_paid': float(order.total_paid()),
        'is_paid': order.is_paid(),
        'updated_at': order.updated_at.isoformat() if order.updated_at else None,
        'content_changed': bool(order.content_changed_at),
        'content_changed_at': order.content_changed_at.isoformat() if order.content_changed_at else None,
        'is_incomplete': order.is_incomplete(),
        'missing_fields': order.get_missing_fields(),
    }


def rates_allowed(request):
    try:
        employee = request.user.employee_profile
    except Exception:
        return False

    return employee.can_see_rates()


def serialize_order_line(order):
    data = order_common_fields(order)
    data['services'] = [
        {
            'name': item.service_name,
            'people_count': item.people_count,
            'people_count_unknown': item.people_count_unknown,
            'is_main': item.is_main,
        }
        for item in order.estimate_items.all()
        if item.service_name
    ]
    data['services_text'] = ', '.join(
        f'{item.service_name} {item.people_count}' if item.people_count and not item.people_count_unknown else item.service_name
        for item in order.estimate_items.all()
        if item.service_name
    )
    data['comment'] = order.concept or order.venue_comment or ''
    data['contact_name'] = order.contact_name or ''
    data['contact_phone'] = order.contact_phone or ''
    data['contact_telegram'] = order.contact_telegram or ''
    data['setup_time'] = order.setup_time or ''
    data['dressing_room_comment'] = order.dressing_room_comment or ''
    data['meal_comment'] = order.meal_comment or ''
    data['tech_comment'] = order.tech_comment or ''
    data['venue_comment'] = order.venue_comment or ''
    return data


def get_city_salary_bonus(city):
    if city and city.group:
        return float(city.group.salary_bonus)
    return 0.0


def order_queryset():
    return Order.objects.prefetch_related('estimate_items').select_related('client', 'city', 'manager__user')


def parse_order_filters(request):
    search = request.GET.get('search', '')
    status = request.GET.get('status', 'all')

    return search, status


def parse_date_filter(value):
    if not value:
        return None

    try:
        return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def parse_int(value):
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None

    return result if result > 0 else None


def apply_order_filters(orders, search, status, date_from=None, date_to=None):
    if search:
        orders = orders.filter(
            Q(name__icontains=search) |
            Q(address__icontains=search) |
            Q(client__full_name__icontains=search) |
            Q(manager__full_name__icontains=search)
        )

    if status != 'all':
        orders = orders.filter(status=status)

    start = parse_date_filter(date_from)
    end = parse_date_filter(date_to)

    if start:
        orders = orders.filter(date__gte=start)

    if end:
        orders = orders.filter(date__lte=end)

    return orders


def order_list_response(orders, extra_keys=None, limit=None, can_see_cost=True, can_see_rates=True):
    def sort_key(order):
        if order.date:
            return (1, order.date.toordinal(), order.created_at.timestamp())
        return (0, 0, order.created_at.timestamp())

    ordered = sorted(list(orders), key=sort_key)
    total = len(ordered)

    if limit:
        ordered = ordered[:limit]

    result = []
    for order in ordered:
        item = serialize_order_line(order)
        if extra_keys:
            item.update(extra_keys(order))
        if not can_see_rates:
            item['my_payment'] = None
        if not can_see_cost:
            item.pop('cost', None)
            item['cost'] = ''
            item.pop('my_payment', None)
        result.append(item)

    undated = [item for item in result if not item['has_date']]
    dated = [item for item in result if item['has_date']]

    undated.sort(key=lambda item: item['id'], reverse=True)
    dated.reverse()

    return JsonResponse({
        'orders': undated + dated,
        'total': total,
        'has_more': total > len(result),
        'colors': serialize_calendar_colors(),
    })


class OrdersView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer', 'technician', 'choreographer', 'production']:
                messages.error(request, 'У вас недостаточно прав для просмотра заказов')
                return redirect('index')
        except:
            return redirect('logout')

        return redirect('schedule')

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для создания заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            name = request.POST.get('name', '').strip()
            client_id = request.POST.get('client_id')
            date_str = request.POST.get('date', '').strip()

            if not name:
                return JsonResponse({'error': 'Название заказа обязательно для заполнения'}, status=400)
            if not client_id:
                return JsonResponse({'error': 'Заказчик обязателен для заполнения'}, status=400)

            date_obj = None

            if date_str:
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'error': 'Неверный формат даты'}, status=400)

            client = get_object_or_404(Client, id=client_id)

            city_id = request.POST.get('city_id', '').strip()
            city_name_raw = ' '.join(request.POST.get('city_name', '').split())

            city_obj = None

            if city_id and city_id.isdigit():
                city_obj = City.objects.filter(id=int(city_id)).first()
            elif city_name_raw:
                city_obj = City.objects.filter(name__iexact=city_name_raw).first()

                if city_obj is None:
                    city_obj = City.objects.create(name=city_name_raw)

            if city_obj is None:
                city_obj = City.objects.filter(name__iexact='Казань').first()

            order = Order.objects.create(
                name=name,
                client=client,
                city=city_obj,
                date=date_obj,
                manager=employee,
                status='request',
                contact_name=client.full_name or '',
                contact_phone=client.phone or '',
                contact_telegram=client.telegram_username or '',
            )

            service_id = request.POST.get('service_id', '').strip()
            people_count_raw = request.POST.get('people_count', '').strip()

            if service_id.isdigit():
                service_obj = Service.objects.filter(id=int(service_id), type='service').first()

                if service_obj is not None:
                    people_count = int(people_count_raw) if people_count_raw.isdigit() else 0

                    price = 0
                    matched_row = None

                    rows = sorted(service_obj.staff_rows.all(), key=lambda r: r.artist_count)

                    if rows and people_count > 0:
                        matched_row = rows[-1]

                        for row in rows:
                            if row.artist_count >= people_count:
                                matched_row = row
                                break

                        price = float(matched_row.cost)
                    elif rows:
                        matched_row = rows[0]
                        price = float(matched_row.cost)
                        people_count = matched_row.artist_count

                    OrderEstimate.objects.create(
                        order=order,
                        service=service_obj,
                        service_name=service_obj.name,
                        people_count=people_count,
                        coefficient=1,
                        price=price,
                        is_main=True,
                    )

                    order.cost = f'{price:.2f}'
                    order.refresh_auto_name()
                    order.save(update_fields=['cost', 'name', 'auto_name'])

            concept = request.POST.get('concept', '').strip()

            if concept:
                order.concept = concept
                order.save(update_fields=['concept'])

            order.content_hash = order.compute_content_hash()
            order.save(update_fields=['content_hash'])

            attach_for_order(order, employee)

            return JsonResponse({
                'success': True,
                'order': {
                    'id': order.id,
                    'name': order.name,
                    'date': format_date(order.date),
                    'client': order.client.full_name,
                    'client_id': order.client.id,
                    'status': order.status,
                    'status_display': order.get_status_display(),
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderDetailView(View):
    def get(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer', 'technician', 'choreographer', 'production']:
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            order = Order.objects.select_related(
                'client', 'city', 'manager__user', 'story_manager__user',
            ).prefetch_related('managers', 'estimate_items', 'estimate_items__staff').get(id=order_id)

            if order.content_changed_at and not request.GET.get('peek'):
                order.content_changed_at = None
                order.save(update_fields=['content_changed_at'])

            estimate_items = []
            for item in order.estimate_items.all():
                estimate_items.append({
                    'id': item.id,
                    'service_id': item.service.id if item.service else None,
                    'name': item.service_name,
                    'people_count': item.people_count,
                    'people_count_unknown': item.people_count_unknown,
                    'coefficient': float(item.coefficient),
                    'price': float(item.price),
                    'comment': item.comment,
                    'overridden': item.is_overridden,
                    'is_main': item.is_main,
                })

            employee_items = []
            for item in order.employee_items.all():
                employee_items.append({
                    'employee_id': item.employee.id if item.employee else None,
                    'name': item.employee_name,
                    'role': item.employee_role,
                    'role_code': item.role_code,
                    'role_label': role_label(item.role_code) or item.employee_role,
                    'show_id': item.show_id,
                    'show_name': item.get_show_label(),
                    'payment': float(item.payment),
                    'overridden': item.is_overridden,
                    'is_story': item.is_story,
                    'is_responsible': item.is_responsible,
                    'comment': item.comment,
                })

            can_see_rates = employee.can_see_rates()
            can_view_cost = employee.can_see_costs()

            payload = {
                'id': order.id,
                'name': order.name or '',
                'auto_name': order.auto_name or '',
                'name_is_manual': order.name_is_manual,
                'client_id': order.client.id,
                'client_name': order.client.full_name,
                'client_contact': order.client.get_contact_display(),
                'city_id': order.city.id if order.city else None,
                'city_name': order.city.name if order.city else '',
                'date': format_date(order.date),
                'date_display': format_date_short(order.date),
                'start_datetime': format_datetime(order.start_datetime),
                'end_datetime': format_datetime(order.end_datetime),
                'address': order.address or '',
                'chat_number': order.chat_number or '',
                'contact_name': order.contact_name or '',
                'contact_phone': order.contact_phone or '',
                'contact_telegram': order.contact_telegram or '',
                'setup_time': order.setup_time or '',
                'dressing_room_comment': order.dressing_room_comment or '',
                'meal_comment': order.meal_comment or '',
                'concept': order.concept or '',
                'tech_lamps': order.tech_lamps,
                'tech_laser': order.tech_laser,
                'tech_hazer': order.tech_hazer,
                'tech_grid': order.tech_grid,
                'tech_projection': order.tech_projection,
                'tech_comment': order.tech_comment or '',
                'venue_comment': order.venue_comment or '',
                'props_comment': order.props_comment or '',
                'manager_id': order.manager.id if order.manager else None,
                'manager_name': order.manager.display_name if order.manager else '',
                'manager_ids': [item.id for item in order.managers.all()],
                'managers': [
                    {'id': item.id, 'name': item.display_name} for item in order.managers.all()
                ],
                'cost': order.cost or '—',
                'cost_is_manual': order.cost_is_manual,
                'payment_method': order.payment_method or '',
                'payment_method_display': order.get_payment_method_display() if order.payment_method else '',
                'payment_due_date': format_date(order.payment_due_date),
                'payment_due_date_display': format_date_short(order.payment_due_date),
                'payment_due_comment': order.payment_due_comment or '',
                'payments': [serialize_payment(item) for item in order.payments.select_related('created_by')],
                'total_paid': float(order.total_paid()),
                'status': order.status,
                'status_display': order.get_status_display(),
                'duration': order.duration,
                'story_manager_id': order.story_manager.id if order.story_manager else None,
                'story_manager_name': order.story_manager.display_name if order.story_manager else None,
                'estimate_items': estimate_items,
                'employee_items': employee_items,
                'expenses': [serialize_expense(item) for item in order.expenses.select_related('created_by', 'decided_by')],
                'checklist': serialize_checklist(order, employee.can_edit_checklists(), employee.can_build_checklists()),
                'can_see_rates': can_see_rates,
            }

            if not can_view_cost:
                payload.pop('cost', None)
                payload.pop('payments', None)
                payload.pop('total_paid', None)
                payload.pop('expenses', None)
                payload['employee_items'] = [
                    {
                        'employee_id': item.get('employee_id'),
                        'name': item.get('name'),
                        'role': item.get('role'),
                        'role_code': item.get('role_code'),
                        'role_label': item.get('role_label'),
                        'show_id': item.get('show_id'),
                        'show_name': item.get('show_name'),
                        'is_story': item.get('is_story'),
                        'is_responsible': item.get('is_responsible'),
                        'comment': item.get('comment'),
                    }
                    for item in payload.get('employee_items', [])
                ]

            if not can_see_rates:
                for item in payload.get('estimate_items', []):
                    item.pop('price', None)
                    item.pop('coefficient', None)

                for item in payload.get('employee_items', []):
                    item.pop('payment', None)
                    item.pop('overridden', None)

                for item in payload.get('expenses', []):
                    item.pop('amount', None)

                payload.pop('cost', None)
                payload.pop('payments', None)
                payload.pop('total_paid', None)

            return JsonResponse(payload)
        except Order.DoesNotExist:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)


class OrderUpdateView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для редактирования заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        allow_rates_post = employee.can_see_rates()

        try:
            order = get_object_or_404(Order, id=order_id)

            name = request.POST.get('name', '').strip()
            client_id = request.POST.get('client_id')
            date_str = request.POST.get('date', '').strip()
            city_id = request.POST.get('city_id')

            if not client_id:
                return JsonResponse({'error': 'Клиент обязателен для заполнения'}, status=400)
            if not name:
                return JsonResponse({'error': 'Название заказа обязательно для заполнения'}, status=400)

            if date_str:
                try:
                    order.date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'error': 'Неверный формат даты'}, status=400)
            else:
                order.date = None

            order.name_is_manual = True
            order.name = name
            order.client = get_object_or_404(Client, id=client_id)

            city_name_raw = request.POST.get('city_name', '').strip()

            if city_id:
                order.city = City.objects.filter(id=city_id).first()
            elif city_name_raw:
                order.city = City.objects.filter(name__iexact=city_name_raw).first()

                if order.city is None:
                    order.city = City.objects.create(name=city_name_raw)
            elif 'city_id' in request.POST:
                order.city = None

            order.address = request.POST.get('address', '').strip()
            order.chat_number = request.POST.get('chat_number', '').strip()
            order.contact_name = request.POST.get('contact_name', '').strip()
            order.contact_phone = request.POST.get('contact_phone', '').strip()
            order.contact_telegram = request.POST.get('contact_telegram', '').strip()
            order.setup_time = request.POST.get('setup_time', '').strip()
            order.dressing_room_comment = request.POST.get('dressing_room_comment', '').strip()
            order.meal_comment = request.POST.get('meal_comment', '').strip()
            order.concept = request.POST.get('concept', '').strip()
            order.tech_lamps = request.POST.get('tech_lamps') == 'on'
            order.tech_laser = request.POST.get('tech_laser') == 'on'
            order.tech_hazer = request.POST.get('tech_hazer') == 'on'
            order.tech_grid = request.POST.get('tech_grid') == 'on'
            order.tech_projection = request.POST.get('tech_projection') == 'on'
            order.tech_comment = request.POST.get('tech_comment', '').strip()
            order.venue_comment = request.POST.get('venue_comment', '').strip()
            order.props_comment = request.POST.get('props_comment', '').strip()

            if allow_rates_post:
                if 'cost' in request.POST:
                    cost_raw = request.POST.get('cost', '')
                    cost_number = parse_money(cost_raw)

                    if cost_number is not None and cost_number > 0:
                        order.cost = f'{cost_number:.2f}'
                    else:
                        order.cost = '0.00'

                if 'cost_is_manual' in request.POST:
                    order.cost_is_manual = request.POST.get('cost_is_manual') == '1'

            order.payment_method = request.POST.get('payment_method', '').strip()

            previous_status = order.status
            order.status = request.POST.get('status', 'request')

            start_raw = request.POST.get('start_datetime', '').strip()
            end_raw = request.POST.get('end_datetime', '').strip()

            if 'start_datetime' in request.POST:
                order.start_datetime = parse_datetime(start_raw)

            if 'end_datetime' in request.POST:
                order.end_datetime = parse_datetime(end_raw)

            payment_due_raw = request.POST.get('payment_due_date', '').strip()

            if 'payment_due_date' in request.POST:
                if payment_due_raw:
                    try:
                        order.payment_due_date = datetime.strptime(payment_due_raw, '%Y-%m-%d').date()
                    except ValueError:
                        order.payment_due_date = None
                else:
                    order.payment_due_date = None

            if 'payment_due_comment' in request.POST:
                order.payment_due_comment = request.POST.get('payment_due_comment', '').strip()

            try:
                order.duration = int(request.POST.get('duration', 1))
            except (ValueError, TypeError):
                order.duration = 1

            manager_id = request.POST.get('manager_id')
            if manager_id:
                order.manager = get_object_or_404(Employee, id=manager_id)

            story_manager_id = request.POST.get('story_manager_id')
            if story_manager_id:
                order.story_manager = get_object_or_404(Employee, id=story_manager_id)
            elif 'story_manager_id' in request.POST:
                order.story_manager = None

            order.save()

            managers_raw = request.POST.get('manager_ids', '')

            if managers_raw:
                manager_ids = [
                    int(part) for part in managers_raw.split(',')
                    if part.strip().isdigit()
                ]

                main_id = order.manager_id
                if main_id and main_id not in manager_ids:
                    manager_ids = [main_id] + manager_ids

                unique_ids = []

                for value in manager_ids:
                    if value not in unique_ids:
                        unique_ids.append(value)

                order.managers.set(Employee.objects.filter(id__in=unique_ids[:1]))
            elif 'manager_ids' in request.POST:
                order.managers.clear()

            if not order.manager_id:
                order.manager = employee
                order.save(update_fields=['manager'])

            estimate_items_str = request.POST.get('estimate_items', '')
            if estimate_items_str:
                try:
                    estimate_items = json.loads(estimate_items_str)

                    previous_estimates = {
                        item.id: item for item in order.estimate_items.all()
                    }

                    previous_by_service = {}

                    for item in previous_estimates.values():
                        if item.service_id and item.service_id not in previous_by_service:
                            previous_by_service[item.service_id] = item

                    order.estimate_items.all().delete()
                    created_items = []

                    for index, item in enumerate(estimate_items):
                        service_id = item.get('service_id')
                        service = None
                        if service_id:
                            service = Service.objects.filter(id=service_id).first()

                        item_id = item.get('id')
                        old_item = previous_estimates.get(item_id)

                        if old_item is None and service_id:
                            old_item = previous_by_service.get(service_id)

                        price_value = item.get('price')

                        if not allow_rates_post:
                            if old_item is not None:
                                price_value = float(old_item.price)
                                coefficient_value = float(old_item.coefficient)
                                overridden_value = old_item.is_overridden
                            else:
                                price_value = 0
                                coefficient_value = item.get('coefficient', 1)
                                overridden_value = False
                        elif price_value is None and old_item is not None:
                            price_value = float(old_item.price)
                            coefficient_value = float(old_item.coefficient)
                            overridden_value = old_item.is_overridden
                        else:
                            coefficient_value = item.get('coefficient', 1)
                            overridden_value = item.get('overridden', False)

                        if price_value is None:
                            price_value = 0

                        created_items.append(OrderEstimate.objects.create(
                            order=order,
                            service=service,
                            service_name=item.get('name', ''),
                            people_count=item.get('people_count') or 0,
                            people_count_unknown=bool(item.get('people_count_unknown', False)),
                            coefficient=coefficient_value,
                            price=price_value,
                            comment=item.get('comment', ''),
                            is_overridden=bool(overridden_value),
                            is_main=bool(item.get('is_main', False)) or index == 0,
                        ))
                except (json.JSONDecodeError, TypeError):
                    created_items = []
            else:
                created_items = []

            employee_items_str = request.POST.get('employee_items', '')
            if employee_items_str:
                try:
                    employee_items = json.loads(employee_items_str)

                    previous_staff = {}

                    for item in order.employee_items.select_related('employee').all():
                        key = (item.employee_id, item.employee_name, item.employee_role)
                        previous_staff.setdefault(key, item)

                    order.employee_items.all().delete()

                    for item in employee_items:
                        employee_id = item.get('employee_id')
                        emp = None
                        if employee_id:
                            emp = Employee.objects.filter(id=employee_id).first()

                        show_index = item.get('show_index')
                        show_obj = None

                        if show_index is not None and created_items:
                            try:
                                show_obj = created_items[int(show_index)]
                            except (IndexError, ValueError, TypeError):
                                show_obj = None

                        role_code = item.get('role_code', '')

                        payment_value = item.get('payment')

                        if not allow_rates_post:
                            old_staff = previous_staff.get((
                                emp.id if emp else None,
                                item.get('name', ''),
                                role_label(role_code) or item.get('role', ''),
                            ))

                            if old_staff is not None:
                                payment_value = float(old_staff.payment)
                                overridden_value = old_staff.is_overridden
                            else:
                                payment_value = 0
                                overridden_value = False
                        elif payment_value is None:
                            old_staff = previous_staff.get((
                                emp.id if emp else None,
                                item.get('name', ''),
                                role_label(role_code) or item.get('role', ''),
                            ))

                            if old_staff is not None:
                                payment_value = float(old_staff.payment)
                                overridden_value = old_staff.is_overridden
                            else:
                                payment_value = 0
                                overridden_value = False
                        else:
                            overridden_value = bool(item.get('overridden', False))

                        OrderEmployee.objects.create(
                            order=order,
                            employee=emp,
                            employee_name=item.get('name', ''),
                            employee_role=role_label(role_code) or item.get('role', ''),
                            role_code=role_code,
                            show=show_obj,
                            payment=payment_value,
                            is_overridden=overridden_value,
                            is_story=bool(item.get('is_story', False)),
                            is_responsible=bool(item.get('is_responsible', False)),
                            comment=item.get('comment', '')
                        )
                except (json.JSONDecodeError, TypeError):
                    pass

            if not order.name_is_manual or not order.name:
                order.refresh_auto_name()
                order.name_is_manual = False
            else:
                order.auto_name = order.build_auto_name()

            order.save(update_fields=['auto_name', 'name', 'name_is_manual'])

            if order.touch_content_change():
                order.save(update_fields=['content_hash', 'content_changed_at'])

            sync_order_balance(order, previous_status, employee)

            attach_for_order(order, employee)

            if order.status == 'completed':
                for staff_row in order.employee_items.select_related('employee').all():
                    if staff_row.employee_id:
                        refresh_employee_accrual(order, staff_row.employee, employee)

            return JsonResponse({
                'success': True,
                'order': {
                    'id': order.id,
                    'name': order.name,
                    'auto_name': order.auto_name,
                    'address': order.address,
                    'date': format_date(order.date),
                    'date_display': format_date_short(order.date),
                    'client': order.client.full_name,
                    'client_id': order.client.id,
                    'city_id': order.city.id if order.city else None,
                    'city_name': order.city.name if order.city else '',
                    'chat_number': order.chat_number,
                    'cost': order.cost,
                    'status': order.status,
                    'status_display': order.get_status_display(),
                    'manager': order.manager.display_name if order.manager else '',
                    'manager_id': order.manager.id if order.manager else None,
                    'content_changed': bool(order.content_changed_at),
                    'content_changed_at': order.content_changed_at.isoformat() if order.content_changed_at else None,
                    'is_incomplete': order.is_incomplete(),
                    'missing_fields': order.get_missing_fields(),
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderExpenseView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_manage_orders() and employee.role not in ['technician', 'artist', 'choreographer', 'production']:
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        order = Order.objects.filter(id=order_id).first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        payer_name = request.POST.get('payer_name', '').strip()
        comment = request.POST.get('comment', '').strip()
        amount_raw = request.POST.get('amount', '').replace(' ', '').replace(',', '.')

        if not payer_name:
            return JsonResponse({'error': 'Укажите, кто оплатил'}, status=400)

        try:
            amount = Decimal(amount_raw).quantize(Decimal('0.01'))
        except (InvalidOperation, ValueError):
            return JsonResponse({'error': 'Укажите корректную сумму'}, status=400)

        if amount <= 0:
            return JsonResponse({'error': 'Сумма должна быть больше нуля'}, status=400)

        expense_id = request.POST.get('id')
        expense = None

        if expense_id:
            expense = OrderExpense.objects.filter(id=expense_id, order=order).first()

            if expense is None:
                return JsonResponse({'error': 'Расход не найден'}, status=404)

        if expense is None:
            expense = OrderExpense(order=order, created_by=employee)

        expense.payer_name = payer_name
        expense.amount = amount
        expense.comment = comment

        if not expense.period_date:
            expense.period_date = order.date or timezone.localdate()

        expense.save()

        return JsonResponse({'success': True, 'expense': serialize_expense(expense)})

    def delete(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        order = Order.objects.filter(id=order_id).first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        expense_id = request.GET.get('id') or request.POST.get('id')
        expense = OrderExpense.objects.filter(id=expense_id, order=order).first()

        if expense is None:
            return JsonResponse({'error': 'Расход не найден'}, status=404)

        if expense.status != OrderExpense.STATUS_PENDING:
            return JsonResponse({'error': 'Нельзя удалить расход с принятым решением'}, status=400)

        expense.delete()

        return JsonResponse({'success': True})


class OrderDeleteView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для удаления заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            order = get_object_or_404(Order, id=order_id)
            order.delete()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer', 'technician', 'choreographer', 'production']:
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        orders = order_queryset().order_by('-date', '-created_at')

        search, status = parse_order_filters(request)
        orders = apply_order_filters(
            orders, search, status,
            request.GET.get('date_from'),
            request.GET.get('date_to'),
        )

        limit = parse_int(request.GET.get('limit'))

        return order_list_response(
            orders,
            limit=limit,
            can_see_cost=employee.can_see_costs(),
            can_see_rates=employee.can_see_rates(),
        )


class MyOrdersListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        orders = order_queryset().filter(
            employee_items__employee=employee
        ).distinct().order_by('-date', '-created_at')

        search, status = parse_order_filters(request)
        orders = apply_order_filters(
            orders, search, status,
            request.GET.get('date_from'),
            request.GET.get('date_to'),
        )

        def extra(order):
            payment = 0

            for item in order.employee_items.all():
                if item.employee_id == employee.id:
                    payment = float(item.payment)
                    break

            return {'my_payment': payment}

        return order_list_response(
            orders,
            extra,
            can_see_cost=employee.can_see_costs(),
            can_see_rates=employee.can_see_rates(),
        )


class OrderCopyView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для копирования заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            source = get_object_or_404(Order, id=order_id)

            date_str = request.POST.get('date', '').strip()
            copy_mode = request.POST.get('date_mode', 'set')
            new_date = None

            if copy_mode == 'keep':
                new_date = source.date
            elif date_str:
                try:
                    new_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'error': 'Неверный формат даты'}, status=400)

            with transaction.atomic():
                copy = Order.objects.create(
                    name=source.name,
                    auto_name=source.auto_name,
                    name_is_manual=source.name_is_manual,
                    client=source.client,
                    city=source.city,
                    date=new_date,
                    start_datetime=source.start_datetime,
                    end_datetime=source.end_datetime,
                    address=source.address,
                    chat_number=source.chat_number,
                    contact_name=source.contact_name,
                    contact_phone=source.contact_phone,
                    contact_telegram=source.contact_telegram,
                    setup_time=source.setup_time,
                    dressing_room_comment=source.dressing_room_comment,
                    meal_comment=source.meal_comment,
                    concept=source.concept,
                    tech_lamps=source.tech_lamps,
                    tech_laser=source.tech_laser,
                    tech_hazer=source.tech_hazer,
                    tech_grid=source.tech_grid,
                    tech_projection=source.tech_projection,
                    tech_comment=source.tech_comment,
                    venue_comment=source.venue_comment,
                    props_comment=source.props_comment,
                    manager=source.manager,
                    story_manager=source.story_manager,
                    cost=source.cost,
                    payment_method=source.payment_method,
                    payment_due_date=source.payment_due_date,
                    payment_due_comment=source.payment_due_comment,
                    status=source.status,
                    duration=source.duration,
                )

                copy.managers.set(source.managers.all())

                created_estimates = []

                for item in source.estimate_items.all():
                    created_estimates.append(OrderEstimate.objects.create(
                        order=copy,
                        service=item.service,
                        service_name=item.service_name,
                        people_count=item.people_count,
                        people_count_unknown=item.people_count_unknown,
                        coefficient=item.coefficient,
                        price=item.price,
                        comment=item.comment,
                        is_overridden=item.is_overridden,
                        is_main=item.is_main,
                    ))

                estimate_map = {}

                for index, item in enumerate(source.estimate_items.all().order_by('id')):
                    if index < len(created_estimates):
                        estimate_map[item.id] = created_estimates[index]

                for item in source.employee_items.all():
                    OrderEmployee.objects.create(
                        order=copy,
                        employee=item.employee,
                        employee_name=item.employee_name,
                        employee_role=item.employee_role,
                        role_code=item.role_code,
                        show=estimate_map.get(item.show_id),
                        payment=item.payment,
                        is_overridden=item.is_overridden,
                        is_story=item.is_story,
                        is_responsible=item.is_responsible,
                        comment=item.comment,
                    )

                copy.content_hash = copy.compute_content_hash()
                copy.save(update_fields=['content_hash'])

            return JsonResponse({
                'success': True,
                'order': {
                    'id': copy.id,
                    'name': copy.name,
                    'date': format_date(copy.date),
                    'has_date': bool(copy.date),
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class CityListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        cities = City.objects.select_related('group').order_by('name')
        data = []
        for c in cities:
            data.append({
                'id': c.id,
                'name': c.name,
                'group_id': c.group.id if c.group else None,
                'group_name': c.group.name if c.group else None,
                'salary_bonus': float(c.group.salary_bonus) if c.group else 0,
            })
        return JsonResponse({'cities': data})


class ServicesFlatListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        nodes = Service.objects.filter(is_active=True).prefetch_related('staff_rows').order_by('order', 'name')
        data = []
        for s in nodes:
            item = {
                'id': s.id,
                'name': s.name,
                'type': s.type,
                'parent_id': s.parent_id,
            }
            if s.type == 'service':
                item['artist_rate'] = float(s.artist_rate)
                item['staff_rows'] = [
                    {'artist_count': row.artist_count, 'cost': float(row.cost)}
                    for row in s.staff_rows.all()
                ]
            data.append(item)

        groups = []

        for group in CityGroup.objects.order_by('order', 'name'):
            groups.append({
                'id': group.id,
                'name': group.name,
                'coefficient': float(group.price_coefficient),
                'salary_bonus': float(group.salary_bonus),
            })

        return JsonResponse({'services': data, 'city_groups': groups})


class CityGroupsView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        groups = [
            {
                'id': group.id,
                'name': group.name,
                'coefficient': float(group.price_coefficient),
                'salary_bonus': float(group.salary_bonus),
            }
            for group in CityGroup.objects.order_by('order', 'name')
        ]

        city_groups = {
            city.id: city.group_id
            for city in City.objects.filter(group__isnull=False)
        }

        return JsonResponse({'groups': groups, 'city_groups': city_groups})


def serialize_price_period(period):
    if not period:
        return None

    return {
        'id': period.id,
        'start_date': period.start_date.strftime('%Y-%m-%d'),
        'end_date': period.end_date.strftime('%Y-%m-%d'),
        'percent': float(period.percent),
    }


def parse_request_date(value):
    if not value:
        return None

    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


class PricePeriodView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        period_date = parse_request_date(request.GET.get('date'))

        if not period_date:
            return JsonResponse({'success': True, 'percent': 0, 'period': None})

        period = PriceRisePeriod.find_for_date(period_date)

        return JsonResponse({
            'success': True,
            'percent': float(period.percent) if period else 0,
            'period': serialize_price_period(period),
        })


class ServicePriceForOrderView(View):
    def get(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            service = get_object_or_404(Service, id=service_id, type='service')
            city_id = request.GET.get('city_id')
            city = City.objects.filter(id=city_id).first() if city_id else None
            if city is None:
                city = City.objects.filter(name__iexact='Казань').first()

            return JsonResponse({
                'success': True,
                'price': 0,
                'city_id': city.id if city else None,
                'city_name': city.name if city else None,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ServiceEmployeesForOrderView(View):
    def get(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            service = get_object_or_404(Service, id=service_id, type='service')
            city_id = request.GET.get('city_id')
            city = City.objects.filter(id=city_id).first() if city_id else None
            if city is None:
                city = City.objects.filter(name__iexact='Казань').first()

            salary_bonus = get_city_salary_bonus(city)

            return JsonResponse({
                'success': True,
                'artist_rate': float(service.artist_rate) + salary_bonus,
                'staff_rows': [
                    {'artist_count': row.artist_count, 'cost': float(row.cost)}
                    for row in service.staff_rows.all()
                ],
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderPaymentView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_manage_orders():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        order = Order.objects.filter(id=order_id).first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        amount = parse_money(request.POST.get('amount'))

        if amount is None or amount <= 0:
            return JsonResponse({'error': 'Укажите корректную сумму'}, status=400)

        paid_at = parse_date_filter(request.POST.get('paid_at'))

        if paid_at is None:
            paid_at = timezone.localdate()

        payment_id = request.POST.get('id')

        if payment_id:
            payment = OrderPayment.objects.filter(id=payment_id, order=order).first()

            if payment is None:
                return JsonResponse({'error': 'Оплата не найдена'}, status=404)

            if payment.is_cancelled:
                return JsonResponse({'error': 'Нельзя изменить отменённую оплату'}, status=400)
        else:
            payment = OrderPayment(order=order, created_by=employee)

        payment.amount = amount
        payment.paid_at = paid_at
        payment.comment = request.POST.get('comment', '').strip()
        payment.save()

        return JsonResponse({
            'success': True,
            'payment': serialize_payment(payment),
            'total_paid': float(order.total_paid()),
        })

    def delete(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_manage_orders():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        payment_id = request.GET.get('id') or request.POST.get('id')
        payment = OrderPayment.objects.filter(id=payment_id, order_id=order_id).first()

        if payment is None:
            return JsonResponse({'error': 'Оплата не найдена'}, status=404)

        payment.is_cancelled = True
        payment.cancelled_at = timezone.now()
        payment.save(update_fields=['is_cancelled', 'cancelled_at', 'updated_at'])

        order = payment.order

        return JsonResponse({
            'success': True,
            'total_paid': float(order.total_paid()),
        })


class OrderChecklistView(View):
    def get(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        order = (
            Order.objects
            .filter(id=order_id)
            .prefetch_related('estimate_items', 'checklist_items')
            .first()
        )

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        employee = getattr(request.user, 'employee_profile', None)
        can_edit = bool(employee and employee.can_edit_checklists())

        payload = serialize_checklist(order, can_edit, bool(employee and employee.can_build_checklists()))
        payload['success'] = True

        return JsonResponse(payload)

    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_edit_checklists():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        order = Order.objects.filter(id=order_id).first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        action = request.POST.get('action', 'add')
        structural_actions = ['template', 'auto', 'delete_group', 'add', 'update', 'delete']

        if action in structural_actions and not employee.can_build_checklists():
            return JsonResponse({'error': 'У вас недостаточно прав для изменения чек-листа'}, status=403)

        show_id = request.POST.get('show_id', '').strip()
        show = order.estimate_items.filter(id=show_id).first() if show_id.isdigit() else None

        if action == 'toggle':
            item = ChecklistItem.objects.filter(id=request.POST.get('id'), order=order).first()

            if item is None:
                return JsonResponse({'error': 'Пункт не найден'}, status=404)

            item.is_done = not item.is_done
            item.save(update_fields=['is_done', 'updated_at'])
        elif action == 'delete':
            item = ChecklistItem.objects.filter(id=request.POST.get('id'), order=order).first()

            if item is None:
                return JsonResponse({'error': 'Пункт не найден'}, status=404)

            item.delete()
        elif action == 'update':
            item = ChecklistItem.objects.filter(id=request.POST.get('id'), order=order).first()

            if item is None:
                return JsonResponse({'error': 'Пункт не найден'}, status=404)

            text = request.POST.get('text', '').strip()

            if not text:
                return JsonResponse({'error': 'Текст пункта обязателен'}, status=400)

            item.text = text
            item.save(update_fields=['text', 'updated_at'])
        elif action == 'template':
            template = ChecklistTemplate.objects.filter(id=request.POST.get('template_id')).first()

            if template is None:
                return JsonResponse({'error': 'Шаблон не найден'}, status=404)

            attach_template(order, template, employee, show)
        elif action == 'delete_group':
            template_id = request.POST.get('template_id', '').strip()
            template_ref = template_id if template_id.isdigit() else None

            order.checklist_items.filter(template_id=template_ref).delete()

            if template_ref:
                OrderShowTemplate.objects.update_or_create(
                    order=order,
                    template_id=template_ref,
                    show=None,
                    defaults={'is_detached': True},
                )
        elif action == 'auto':
            created = attach_for_order(order, employee)

            return JsonResponse({
                'success': True,
                'created': created,
                'checklist': serialize_checklist(order, True, True),
            })
        else:
            text = request.POST.get('text', '').strip()

            if not text:
                return JsonResponse({'error': 'Текст пункта обязателен'}, status=400)

            template_id = request.POST.get('template_id', '').strip()
            template = ChecklistTemplate.objects.filter(id=template_id).first() if template_id.isdigit() else None

            if template is not None:
                order.show_templates.filter(template=template, is_detached=True).delete()
            else:
                template = order.checklist_items.filter(show__isnull=True).exclude(template__isnull=True).select_related('template').first()
                template = template.template if template else None

            ChecklistItem.objects.create(
                order=order,
                show=None,
                template=template,
                text=text,
                order_index=order.checklist_items.count(),
                created_by=employee,
            )

        return JsonResponse({
            'success': True,
            'checklist': serialize_checklist(order, True, True),
        })


class ChecklistTemplateListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        templates = ChecklistTemplate.objects.filter(is_active=True).select_related('service').prefetch_related('items')

        return JsonResponse({
            'templates': [
                {
                    'id': template.id,
                    'name': template.name,
                    'service_id': template.service_id,
                    'service_name': template.service.name if template.service_id else '',
                    'is_default': template.is_default,
                    'items': [{'id': item.id, 'text': item.text} for item in template.items.all()],
                }
                for template in templates
            ]
        })

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_edit_checklists():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        name = request.POST.get('name', '').strip()

        if not name:
            return JsonResponse({'error': 'Название шаблона обязательно'}, status=400)

        service = Service.objects.filter(id=request.POST.get('service_id')).first() if request.POST.get('service_id', '').isdigit() else None
        is_default = request.POST.get('is_default') in ('1', 'on', 'true')

        template, created = ChecklistTemplate.objects.get_or_create(name=name)
        template.service = service
        template.is_default = is_default
        template.save(update_fields=['service', 'is_default', 'updated_at'])

        lines = request.POST.get('items', '').splitlines()
        index = template.items.count()

        for line in lines:
            text = ' '.join(line.split())

            if not text:
                continue

            ChecklistItem.objects.create(template=template, text=text, order_index=index)
            index += 1

        return JsonResponse({
            'success': True,
            'template': {
                'id': template.id,
                'name': template.name,
                'service_id': template.service_id,
                'service_name': template.service.name if template.service_id else '',
                'is_default': template.is_default,
                'items': [{'id': item.id, 'text': item.text} for item in template.items.all()],
            }
        })

    def delete(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_edit_checklists():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        template_id = request.GET.get('id') or request.POST.get('id')
        template = ChecklistTemplate.objects.filter(id=template_id).first()

        if template is None:
            return JsonResponse({'error': 'Шаблон не найден'}, status=404)

        if ChecklistTemplate.objects.count() <= 1:
            return JsonResponse({'error': 'Нельзя удалить последний шаблон'}, status=400)

        template.delete()

        return JsonResponse({'success': True})


class OrderFeedbackView(View):
    def get(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        order = Order.objects.filter(id=order_id).first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        items = order.feedback.select_related('author').all()

        return JsonResponse({
            'success': True,
            'feedback': [
                {
                    'id': item.id,
                    'kind': item.kind,
                    'kind_display': item.get_kind_display(),
                    'status': item.status,
                    'status_display': item.get_status_display(),
                    'text': item.text,
                    'author': item.author.display_name if item.author else '',
                    'created_at': item.created_at.strftime('%d.%m.%Y %H:%M'),
                }
                for item in items
            ],
        })

    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        order = Order.objects.filter(id=order_id).first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        text = request.POST.get('text', '').strip()

        if not text:
            return JsonResponse({'error': 'Текст обратной связи обязателен'}, status=400)

        kind = request.POST.get('kind', OrderFeedback.KIND_COMMENT)

        if kind not in dict(OrderFeedback.KINDS):
            kind = OrderFeedback.KIND_COMMENT

        OrderFeedback.objects.create(
            order=order,
            author=employee,
            kind=kind,
            text=text,
        )

        return JsonResponse({'success': True})


class OrderFeedbackStatusView(View):
    def post(self, request, feedback_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_manage_feedback():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        item = OrderFeedback.objects.filter(id=feedback_id).first()

        if item is None:
            return JsonResponse({'error': 'Обратная связь не найдена'}, status=404)

        status = request.POST.get('status', '')

        if status not in dict(OrderFeedback.STATUSES):
            return JsonResponse({'error': 'Неизвестный статус'}, status=400)

        item.status = status
        item.save(update_fields=['status', 'updated_at'])

        return JsonResponse({'success': True, 'status': item.status})


class FeedbackListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee = getattr(request.user, 'employee_profile', None)

        if employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if not employee.can_manage_feedback() and not employee.can_send_feedback():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        items = OrderFeedback.objects.select_related('author', 'order').all()

        status = request.GET.get('status', 'all')

        if status != 'all':
            items = items.filter(status=status)

        author_id = request.GET.get('author_id')

        if author_id and author_id.isdigit():
            items = items.filter(author_id=int(author_id))

        limit = parse_int(request.GET.get('limit')) or 100

        return JsonResponse({
            'feedback': [
                {
                    'id': item.id,
                    'order_id': item.order_id,
                    'order_name': item.order.name or f'Заказ #{item.order_id}',
                    'order_date': format_date_short(item.order.date),
                    'kind_display': item.get_kind_display(),
                    'status': item.status,
                    'status_display': item.get_status_display(),
                    'text': item.text,
                    'author': item.author.display_name if item.author else '',
                    'created_at': item.created_at.strftime('%d.%m.%Y %H:%M'),
                }
                for item in items[:limit]
            ],
            'can_manage': employee.can_manage_feedback(),
        })


class CityCreateForOrderView(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        name = ' '.join(request.POST.get('name', '').split())

        if not name:
            return JsonResponse({'error': 'Название города обязательно'}, status=400)

        city = City.objects.filter(name__iexact=name).first()

        if city is not None:
            return JsonResponse({
                'success': True,
                'created': False,
                'city': {'id': city.id, 'name': city.name},
            })

        city = City.objects.create(name=name)

        return JsonResponse({
            'success': True,
            'created': True,
            'city': {'id': city.id, 'name': city.name},
        })
