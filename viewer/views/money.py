import json

from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.utils import timezone
from django.views import View

from ..models import Employee, Order, OrderEstimate, OrderShowPay, CalendarColor, ArtistCardRateRule
from .money_service import ZERO, parse_iso_date, price_percent_for
from .helpers import role_label


ORDER_STATUSES = Order.STATUS_CHOICES
STATUS_KEYS = [key for key, label in ORDER_STATUSES]

SORT_DESC = 'date_desc'
SORT_ASC = 'date_asc'
SORT_DEFAULT = SORT_ASC
SORTS = [SORT_DESC, SORT_ASC]

PAY_SERVICE = OrderShowPay.KIND_SERVICE
PAY_DAILY = OrderShowPay.KIND_DAILY
PAY_PROJECT = OrderShowPay.KIND_PROJECT

PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


def money_employee(request):
    if not request.user.is_authenticated:
        return None

    try:
        employee = request.user.employee_profile
    except Employee.DoesNotExist:
        return None

    return employee


def money_guard(request):
    employee = money_employee(request)

    if employee is None:
        return None, JsonResponse({'error': 'Не авторизован'}, status=401)

    if not employee.can_manage_money():
        return None, JsonResponse({'error': 'Недостаточно прав'}, status=403)

    return employee, None


def to_money(value):
    try:
        amount = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        return ZERO

    if not amount.is_finite() or amount < 0:
        return ZERO

    return amount.quantize(Decimal('0.01'))


def serialize_calendar_colors():
    colors = {}

    for item in CalendarColor.objects.filter(is_active=True, type='order'):
        colors[item.status] = {
            'background': item.background_color,
            'border': item.border_color,
            'text': item.text_color,
        }

    return colors


def rate_bonuses(employee_ids):
    rules = (
        ArtistCardRateRule.objects
        .filter(
            card__employee_id__in=list(employee_ids),
            extra_rate__gt=0,
        )
        .prefetch_related('services')
        .select_related('card')
    )

    bonuses = {}

    for rule in rules:
        extra = float(to_money(rule.extra_rate))

        if extra <= 0:
            continue

        for service in rule.services.all():
            per_employee = bonuses.setdefault(rule.card.employee_id, {})
            per_employee[str(service.id)] = per_employee.get(str(service.id), 0.0) + extra

    return bonuses


def serialize_show_row(order, can_edit=False):
    shows = []
    columns = []
    column_index = {}
    service_pays = {}
    daily_pays = {}
    project_pays = {}
    services = []

    for show in order.estimate_items.all():
        staff_ids = []
        staff_rows = []

        for item in show.staff.all():
            if not item.employee_id or item.employee_id in staff_ids:
                continue

            staff_ids.append(item.employee_id)

            staff_rows.append({
                'employee_id': item.employee_id,
                'name': item.employee.display_name,
            })

            if item.employee_id not in column_index:
                column_index[item.employee_id] = len(columns)
                columns.append({
                    'employee_id': item.employee_id,
                    'name': item.employee.display_name,
                    'role_label': role_label(item.employee.primary_role()),
                    'rate': float(item.employee.rate or 0),
                })

        if show.service_name:
            services.append(show.service_name)

        shows.append({
            'id': show.id,
            'service_id': show.service_id,
            'name': show.service_name or '',
            'staff_ids': staff_ids,
            'employees': staff_rows,
        })

    for item in order.employee_items.all():
        if not item.employee_id or item.employee_id in column_index:
            continue

        column_index[item.employee_id] = len(columns)
        columns.append({
            'employee_id': item.employee_id,
            'name': item.employee.display_name,
            'role_label': role_label(item.employee.primary_role()),
            'rate': float(item.employee.rate or 0),
        })

    bonuses = rate_bonuses([column['employee_id'] for column in columns])

    for column in columns:
        column['rate_bonuses'] = bonuses.get(column['employee_id'], {})

    for item in order.show_pays.all():
        if item.kind == PAY_SERVICE and item.show_id:
            service_pays[f'{item.show_id}:{item.employee_id}'] = float(to_money(item.amount))
        elif item.kind == PAY_DAILY:
            daily_pays[str(item.employee_id)] = float(to_money(item.amount))
        elif item.kind == PAY_PROJECT:
            project_pays[str(item.employee_id)] = float(to_money(item.amount))

    return {
        'id': order.id,
        'name': order.name or order.client.full_name,
        'client_name': order.client.full_name,
        'date': order.date.strftime('%Y-%m-%d') if order.date else '',
        'date_display': order.date.strftime('%d.%m.%Y') if order.date else '',
        'city_name': order.city.name if order.city else '',
        'status': order.status,
        'status_display': order.get_status_display(),
        'cost': float(to_money(order.get_cost_value())) if (order.cost or '').strip() not in ('', '—') else 0.0,
        'cost_display': order.cost or '—',
        'services': services,
        'employees_count': len(columns),
        'can_edit': can_edit,
        'shows': shows,
        'columns': columns,
        'service_pays': service_pays,
        'daily_pays': daily_pays,
        'project_pays': project_pays,
        'percent': float(price_percent_for(order.date)) if order.date else 0,
    }


def show_accrued_totals(order):
    totals = {}

    for item in order.show_pays.all():
        key = str(item.employee_id)
        totals[key] = totals.get(key, ZERO) + to_money(item.amount)

    return {key: float(value) for key, value in totals.items()}


def shows_queryset():
    return (
        Order.objects
        .select_related('client', 'city')
        .prefetch_related(
            'estimate_items',
            'estimate_items__staff',
            'estimate_items__staff__employee',
            'employee_items',
            'employee_items__employee',
            'show_pays',
        )
    )


class MoneyView(View):
    def get(self, request):
        employee = money_employee(request)

        if employee is None:
            return redirect('login')

        if not employee.can_manage_money():
            return redirect('index')

        return render(request, 'money.html', {
            'employee': employee,
            'can_edit_orders': employee.can_manage_orders(),
        })


class MoneyShowsView(View):
    def get(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        status = (request.GET.get('status') or 'all').strip()

        if status not in STATUS_KEYS:
            status = 'all'

        today = timezone.localdate()

        date_from_raw = (request.GET.get('date_from') or '').strip()
        date_to_raw = (request.GET.get('date_to') or '').strip()

        date_from = parse_iso_date(date_from_raw)
        date_to = parse_iso_date(date_to_raw)

        if not date_from_raw:
            date_from = today.replace(day=1)

        if date_to and date_from and date_from > date_to:
            date_from, date_to = date_to, date_from

        sort_key = request.GET.get('sort') or SORT_DEFAULT

        if sort_key not in SORTS:
            sort_key = SORT_DEFAULT

        query = shows_queryset()

        if status != 'all':
            query = query.filter(status=status)

        if date_from:
            query = query.filter(date__gte=date_from)

        if date_to:
            query = query.filter(date__lte=date_to)

        prefix = '-' if sort_key == SORT_DESC else ''

        query = query.order_by(prefix + 'date', prefix + 'id')

        try:
            page = int(request.GET.get('page') or 1)
        except (TypeError, ValueError):
            page = 1

        try:
            per_page = int(request.GET.get('per_page') or PAGE_SIZE)
        except (TypeError, ValueError):
            per_page = PAGE_SIZE

        page = max(page, 1)
        per_page = min(max(per_page, 1), MAX_PAGE_SIZE)

        total = query.count()
        offset = (page - 1) * per_page
        chunk = list(query[offset:offset + per_page])

        can_edit = employee.can_manage_orders()

        rows = [serialize_show_row(order, can_edit) for order in chunk]

        return JsonResponse({
            'success': True,
            'shows': rows,
            'colors': serialize_calendar_colors(),
            'statuses': [{'key': key, 'label': label} for key, label in ORDER_STATUSES],
            'status': status,
            'sort': sort_key,
            'page': page,
            'per_page': per_page,
            'total': total,
            'has_more': offset + len(rows) < total,
            'date_from': date_from.strftime('%Y-%m-%d') if date_from else '',
            'date_to': date_to.strftime('%Y-%m-%d') if date_to else '',
        })


class MoneyShowPayView(View):
    def post(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        order = shows_queryset().filter(id=request.POST.get('order_id') or 0).first()

        if order is None:
            return JsonResponse({'error': 'Шоу не найдено'}, status=404)

        try:
            payload = json.loads(request.POST.get('pays') or '')
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({'error': 'Некорректные данные'}, status=400)

        if not isinstance(payload, list):
            return JsonResponse({'error': 'Некорректные данные'}, status=400)

        show_ids = set(order.estimate_items.values_list('id', flat=True))
        staff_ids = set()

        for show in order.estimate_items.all():
            for item in show.staff.all():
                if item.employee_id:
                    staff_ids.add(item.employee_id)

        for item in order.employee_items.all():
            if item.employee_id:
                staff_ids.add(item.employee_id)

        rows = []

        for item in payload:
            if not isinstance(item, dict):
                continue

            kind = item.get('kind')

            if kind not in (PAY_SERVICE, PAY_DAILY, PAY_PROJECT):
                continue

            try:
                employee_id = int(item.get('employee_id'))
            except (TypeError, ValueError):
                continue

            if employee_id not in staff_ids:
                continue

            show_id = None

            if kind == PAY_SERVICE:
                try:
                    show_id = int(item.get('show_id'))
                except (TypeError, ValueError):
                    continue

                if show_id not in show_ids:
                    continue

            amount = to_money(item.get('amount'))

            if amount <= 0:
                continue

            rows.append({
                'show_id': show_id,
                'employee_id': employee_id,
                'kind': kind,
                'amount': amount,
            })

        project_ids = {
            row['employee_id'] for row in rows if row['kind'] == PAY_PROJECT
        }

        clean = [
            row for row in rows
            if row['kind'] == PAY_PROJECT or row['employee_id'] not in project_ids
        ]

        order.show_pays.all().delete()

        created = [
            OrderShowPay(
                order=order,
                show_id=row['show_id'],
                employee_id=row['employee_id'],
                kind=row['kind'],
                amount=row['amount'],
            )
            for row in clean
        ]

        if created:
            OrderShowPay.objects.bulk_create(created)

        refreshed = shows_queryset().filter(id=order.id).first()

        return JsonResponse({
            'success': True,
            'show': serialize_show_row(refreshed, employee.can_manage_orders()),
            'totals': show_accrued_totals(refreshed),
        })
