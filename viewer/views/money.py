from datetime import date
from decimal import Decimal

from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.utils import timezone
from django.views import View

from ..models import (
    Employee, Order, MoneyAccrual, MoneyPayout,
)
from .money_service import (
    ZERO, parse_amount, parse_iso_date, parse_month, month_bounds,
    price_percent_for,
    accrue_order_items, cancel_accrual,
    employee_balance, create_month_payouts,
)


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


def format_money(value):
    return float(value)


def serialize_employee_options():
    employees = Employee.objects.select_related('user').order_by('full_name')
    data = []

    for employee in employees:
        data.append({
            'id': employee.id,
            'name': employee.full_name,
            'role': employee.role,
            'role_display': employee.get_role_display(),
            'is_active': employee.is_active,
        })

    return data


def serialize_accrual(accrual):
    order = accrual.order

    return {
        'id': accrual.id,
        'employee_id': accrual.employee_id,
        'employee_name': accrual.employee.full_name,
        'category': accrual.category,
        'category_display': accrual.get_category_display(),
        'amount': float(accrual.amount),
        'signed_amount': float(accrual.signed_amount()),
        'period_date': accrual.period_date.strftime('%Y-%m-%d'),
        'period_date_display': accrual.period_date.strftime('%d.%m.%Y'),
        'title': accrual.title or '',
        'comment': accrual.comment or '',
        'status': accrual.status,
        'is_active': accrual.is_active,
        'order_id': order.id if order else None,
        'order_name': (order.name or order.client.full_name) if order else '',
        'order_date_display': order.date.strftime('%d.%m.%Y') if order and order.date else '',
        'created_by': accrual.created_by.full_name if accrual.created_by else '',
        'created_at': accrual.created_at.strftime('%d.%m.%Y %H:%M') if accrual.created_at else '',
        'can_edit': accrual.category != MoneyAccrual.CATEGORY_SOURCE and accrual.is_active,
    }


def serialize_payout(payout):
    return {
        'id': payout.id,
        'employee_id': payout.employee_id,
        'employee_name': payout.employee.full_name,
        'amount': float(payout.amount),
        'method': payout.method,
        'method_display': payout.get_method_display(),
        'kind': payout.kind,
        'kind_display': payout.get_kind_display(),
        'period_date': payout.period_date.strftime('%Y-%m-%d'),
        'period_date_display': payout.period_date.strftime('%d.%m.%Y'),
        'period_start_display': payout.period_start.strftime('%d.%m.%Y') if payout.period_start else '',
        'period_end_display': payout.period_end.strftime('%d.%m.%Y') if payout.period_end else '',
        'comment': payout.comment or '',
        'is_reverted': payout.is_reverted,
        'reverted_display': payout.reverted_at.strftime('%d.%m.%Y %H:%M') if payout.reverted_at else '',
        'created_by': payout.created_by.full_name if payout.created_by else '',
    }


def serialize_order_row(order):
    employees = []
    busy = 0
    total = ZERO

    accruals = {
        accrual.employee_id: accrual
        for accrual in order.money_accruals.filter(
            status=MoneyAccrual.STATUS_ACTIVE,
            category=MoneyAccrual.CATEGORY_ORDER,
        )
    }

    for item in order.employee_items.select_related('employee').order_by('id'):
        if not item.employee_id:
            continue

        accrual = accruals.get(item.employee_id)

        if accrual:
            busy += 1

        amount = Decimal(item.payment)
        total += amount

        employees.append({
            'employee_id': item.employee_id,
            'employee_name': item.employee.full_name,
            'role_display': item.employee.get_role_display(),
            'payment': float(item.payment),
            'is_overridden': item.is_overridden,
            'accrual_id': accrual.id if accrual else None,
            'accrual_amount': float(accrual.amount) if accrual else None,
        })

    services = [item.service_name for item in order.estimate_items.all() if item.service_name]

    return {
        'id': order.id,
        'name': order.name or order.client.full_name,
        'client_name': order.client.full_name,
        'date': order.date.strftime('%Y-%m-%d') if order.date else '',
        'date_display': order.date.strftime('%d.%m.%Y') if order.date else '',
        'city_name': order.city.name if order.city else '',
        'services': services,
        'status': order.status,
        'status_display': order.get_status_display(),
        'percent': float(price_percent_for(order.date)) if order.date else 0,
        'total': float(total),
        'employees': employees,
        'employees_total': len(employees),
        'employees_accrued': busy,
        'is_accrued': bool(employees) and busy > 0,
        'is_full': bool(employees) and busy == len(employees),
    }


class MoneyView(View):
    def get(self, request):
        employee = money_employee(request)

        if employee is None:
            return redirect('login')

        if not employee.can_manage_money():
            return redirect('index')

        return render(request, 'money.html', {'employee': employee})


RANGE_MONTH = 'month'
RANGE_TWO_MONTHS = 'two_months'
RANGE_HALF_YEAR = 'half_year'

RANGE_MONTHS = {
    RANGE_MONTH: 1,
    RANGE_TWO_MONTHS: 2,
    RANGE_HALF_YEAR: 6,
}

SORT_DEFAULT = 'date_desc'
SORT_DATE_ASC = 'date_asc'
SORT_AMOUNT_DESC = 'amount_desc'
SORT_AMOUNT_ASC = 'amount_asc'
SORT_NAME = 'name'

SORTS = [SORT_DEFAULT, SORT_DATE_ASC, SORT_AMOUNT_DESC, SORT_AMOUNT_ASC, SORT_NAME]


def resolve_range(value, year, month):
    key = value if value in RANGE_MONTHS else RANGE_MONTH
    months = RANGE_MONTHS[key]

    start_year = year
    start_month = month - months + 1

    while start_month <= 0:
        start_month += 12
        start_year -= 1

    start = date(start_year, start_month, 1)
    _, end, next_start = month_bounds(year, month)

    return key, start, end, next_start


def sort_rows(rows, sort_key, date_field='date', amount_field='amount', name_field='name'):
    if sort_key == SORT_DATE_ASC:
        return sorted(rows, key=lambda row: (row.get(date_field) or '', row.get('id') or 0))

    if sort_key == SORT_AMOUNT_DESC:
        return sorted(rows, key=lambda row: (-(row.get(amount_field) or 0), row.get(date_field) or ''))

    if sort_key == SORT_AMOUNT_ASC:
        return sorted(rows, key=lambda row: ((row.get(amount_field) or 0), row.get(date_field) or ''))

    if sort_key == SORT_NAME:
        return sorted(rows, key=lambda row: (row.get(name_field) or '').lower())

    return sorted(rows, key=lambda row: (row.get(date_field) or '', row.get('id') or 0), reverse=True)


def serialize_pending_order(order):
    row = serialize_order_row(order)
    row['is_full'] = bool(row['employees']) and row['employees_accrued'] == len(row['employees'])
    row['amount'] = row['total']
    return row


class MoneyDataView(View):
    def get(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        year, month = parse_month(request.GET.get('month'))
        range_key, start, end, next_start = resolve_range(request.GET.get('range'), year, month)

        search = request.GET.get('search', '').strip().lower()
        category = request.GET.get('category', 'all')
        accrual_filter = request.GET.get('accrual_filter', 'all')
        sort_key = request.GET.get('sort', SORT_DEFAULT)

        if sort_key not in SORTS:
            sort_key = SORT_DEFAULT

        orders = [
            serialize_pending_order(order)
            for order in (
                Order.objects
                .filter(status='completed', date__gte=start, date__lt=next_start)
                .select_related('client', 'city', 'manager')
                .prefetch_related('employee_items__employee', 'estimate_items', 'money_accruals')
                .order_by('date', 'id')
            )
            if order.employee_items.exists()
        ]

        pending_orders = [row for row in orders if not row['is_full']]
        accrued_orders = [row for row in orders if row['is_accrued']]

        if accrual_filter == 'pending':
            orders = pending_orders
        elif accrual_filter == 'accrued':
            orders = accrued_orders

        orders = sort_rows(orders, sort_key, date_field='date', amount_field='amount')

        accruals = (
            MoneyAccrual.objects
            .filter(period_date__gte=start, period_date__lt=next_start)
            .select_related('employee', 'order', 'order__client', 'created_by')
            .order_by('-period_date', '-id')
        )

        if category != 'all':
            accruals = accruals.filter(category=category)

        accrual_rows = [serialize_accrual(item) for item in accruals]

        payouts = (
            MoneyPayout.objects
            .filter(period_date__gte=start, period_date__lt=next_start)
            .select_related('employee', 'created_by')
            .order_by('-period_date', '-id')
        )

        payout_rows = [serialize_payout(item) for item in payouts]

        if search:
            def matches(row):
                parts = [
                    row.get('employee_name', ''),
                    row.get('title', ''),
                    row.get('order_name', ''),
                    row.get('comment', ''),
                    row.get('method_display', ''),
                    row.get('kind_display', ''),
                ]
                return any(search in str(part).lower() for part in parts)

            accrual_rows = [row for row in accrual_rows if matches(row)]
            payout_rows = [row for row in payout_rows if matches(row)]
            orders = [
                row for row in orders
                if search in row['name'].lower()
                or search in row['client_name'].lower()
                or any(search in item['employee_name'].lower() for item in row['employees'])
                or any(search in service.lower() for service in row['services'])
            ]

        summary = build_summary(start, next_start)

        stats = {
            'accrued': sum(row['signed_amount'] for row in accrual_rows if row['is_active']),
            'paid': sum(row['amount'] for row in payout_rows if not row['is_reverted']),
            'pending_orders': len(pending_orders),
            'pending_amount': sum(
                item['payment'] - (item['accrual_amount'] or 0)
                for row in pending_orders
                for item in row['employees']
                if not item['accrual_id']
            ),
            'balance_total': sum(row['balance'] for row in summary),
        }

        return JsonResponse({
            'success': True,
            'month': f'{year:04d}-{month:02d}',
            'range': range_key,
            'sort': sort_key,
            'accrual_filter': accrual_filter,
            'range_start': start.strftime('%Y-%m-%d'),
            'range_end': end.strftime('%Y-%m-%d'),
            'range_label': f'{start.strftime("%d.%m.%Y")} — {end.strftime("%d.%m.%Y")}',
            'accruals': accrual_rows,
            'payouts': payout_rows,
            'pending': orders,
            'summary': summary,
            'stats': stats,
            'employees': serialize_employee_options(),
            'today': timezone.localdate().strftime('%Y-%m-%d'),
        })


def build_summary(start, end):
    rows = {}

    for employee in Employee.objects.order_by('full_name'):
        rows[employee.id] = {
            'employee_id': employee.id,
            'employee_name': employee.full_name,
            'role_display': employee.get_role_display(),
            'is_active': employee.is_active,
            'salary': 0.0,
            'hours': 0.0,
            'order': 0.0,
            'extra': 0.0,
            'deduction': 0.0,
            'accrued': 0.0,
            'paid': 0.0,
            'balance': 0.0,
            'orders': 0,
        }

    accruals = (
        MoneyAccrual.objects
        .filter(period_date__gte=start, period_date__lt=end, status=MoneyAccrual.STATUS_ACTIVE)
        .values_list('employee_id', 'category', 'amount', 'order_id')
    )

    for employee_id, category, amount, order_id in accruals:
        row = rows.get(employee_id)

        if row is None:
            continue

        value = float(amount)
        row['accrued'] += -value if category == MoneyAccrual.CATEGORY_DEDUCTION else value

        if category == MoneyAccrual.CATEGORY_ORDER:
            row['order'] += value
            row['orders'] += 1
        elif category == MoneyAccrual.CATEGORY_SALARY:
            row['salary'] += value
        elif category == MoneyAccrual.CATEGORY_HOURS:
            row['hours'] += value
        elif category == MoneyAccrual.CATEGORY_DEDUCTION:
            row['deduction'] += value
        elif category == MoneyAccrual.CATEGORY_SOURCE:
            row['extra'] -= value
        else:
            row['extra'] += value

    payouts = (
        MoneyPayout.objects
        .filter(period_date__gte=start, period_date__lt=end, is_reverted=False)
        .values_list('employee_id', 'amount')
    )

    for employee_id, amount in payouts:
        row = rows.get(employee_id)

        if row is None:
            continue

        row['paid'] += float(amount)

    result = []

    for employee in Employee.objects.filter(id__in=list(rows.keys())):
        row = rows[employee.id]
        balance = employee_balance(employee)

        row['balance'] = float(balance)

        if row['accrued'] or row['paid'] or row['balance']:
            result.append(row)

    result.sort(key=lambda item: (-item['balance'], item['employee_name']))

    return result


class MoneyOrderPaymentView(View):
    def get(self, request, order_id):
        employee, error = money_guard(request)

        if error:
            return error

        order = (
            Order.objects
            .filter(id=order_id)
            .select_related('client', 'city')
            .first()
        )

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        row = serialize_order_row(order)
        row['today'] = timezone.localdate().strftime('%Y-%m-%d')
        row['has_date'] = bool(order.date)

        return JsonResponse({'success': True, 'order': row})


class MoneyOrderPayView(View):
    def post(self, request, order_id):
        employee, error = money_guard(request)

        if error:
            return error

        order = Order.objects.filter(id=order_id).select_related('client').first()

        if order is None:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)

        if order.status != 'completed':
            return JsonResponse({'error': 'Начисление можно провести только для выполненного заказа'}, status=400)

        if not order.employee_items.exists():
            return JsonResponse({'error': 'В заказе нет назначенных сотрудников'}, status=400)

        period_date = parse_iso_date(request.POST.get('period_date')) or order.date

        items = []
        amount_ids = request.POST.getlist('employee_id')
        amount_values = request.POST.getlist('amount')

        for index, employee_id in enumerate(amount_ids):
            amount = amount_values[index] if index < len(amount_values) else ''
            items.append({'employee_id': employee_id, 'amount': amount})

        created, skipped = accrue_order_items(order, items, actor=employee, period_start=period_date)

        total = ZERO

        for accrual in MoneyAccrual.objects.filter(
            employee__in=created,
            order=order,
            category=MoneyAccrual.CATEGORY_ORDER,
            status=MoneyAccrual.STATUS_ACTIVE,
        ):
            total += Decimal(accrual.amount)

        return JsonResponse({
            'success': True,
            'accrued': [item.full_name for item in created],
            'skipped': [item.full_name for item in skipped],
            'accrued_total': float(total),
        })


class MoneyAccrualView(View):
    def post(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        accrual_id = request.POST.get('id')
        employee_id = request.POST.get('employee_id')
        category = request.POST.get('category', MoneyAccrual.CATEGORY_SALARY)
        amount = parse_amount(request.POST.get('amount'))
        period_date = parse_iso_date(request.POST.get('period_date'))
        title = request.POST.get('title', '').strip()
        comment = request.POST.get('comment', '').strip()

        if category not in MoneyAccrual.MANUAL_CATEGORIES:
            category = MoneyAccrual.CATEGORY_SALARY

        if not employee_id:
            return JsonResponse({'error': 'Выберите сотрудника'}, status=400)

        target = Employee.objects.filter(id=employee_id).first()

        if target is None:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)

        if amount is None or amount <= 0:
            return JsonResponse({'error': 'Сумма должна быть больше нуля'}, status=400)

        if period_date is None:
            return JsonResponse({'error': 'Укажите дату начисления'}, status=400)

        if accrual_id:
            accrual = MoneyAccrual.objects.filter(id=accrual_id).first()

            if accrual is None:
                return JsonResponse({'error': 'Начисление не найдено'}, status=404)

            if not accrual.is_active:
                return JsonResponse({'error': 'Начисление уже отменено'}, status=400)

            if accrual.category == MoneyAccrual.CATEGORY_SOURCE:
                return JsonResponse({'error': 'Эту запись изменить нельзя'}, status=400)
        else:
            accrual = MoneyAccrual()

        accrual.employee = target
        accrual.category = category
        accrual.amount = amount
        accrual.period_date = period_date
        accrual.title = title

        if comment:
            accrual.comment = comment

        if not accrual.pk:
            accrual.created_by = employee

        accrual.save()

        return JsonResponse({
            'success': True,
            'accrual': serialize_accrual(accrual),
        })

    def delete(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        accrual_id = request.GET.get('id') or request.POST.get('id')
        accrual = MoneyAccrual.objects.filter(id=accrual_id).first()

        if accrual is None:
            return JsonResponse({'error': 'Начисление не найдено'}, status=404)

        if not accrual.is_active:
            return JsonResponse({'error': 'Начисление уже отменено'}, status=400)

        if accrual.category == MoneyAccrual.CATEGORY_SOURCE:
            return JsonResponse({'error': 'Эту запись отменить нельзя'}, status=400)

        cancel_accrual(accrual, actor=employee)

        return JsonResponse({'success': True})


class MoneyPayoutView(View):
    def post(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        employee_id = request.POST.get('employee_id')
        amount = parse_amount(request.POST.get('amount'))
        method = request.POST.get('method', MoneyPayout.METHOD_CASH)
        period_date = parse_iso_date(request.POST.get('period_date')) or timezone.localdate()
        comment = request.POST.get('comment', '').strip()

        if method not in [MoneyPayout.METHOD_CASH, MoneyPayout.METHOD_TRANSFER]:
            method = MoneyPayout.METHOD_CASH

        target = Employee.objects.filter(id=employee_id).first()

        if target is None:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)

        if amount is None or amount <= 0:
            return JsonResponse({'error': 'Сумма должна быть больше нуля'}, status=400)

        payout = MoneyPayout.objects.create(
            employee=target,
            amount=amount,
            method=method,
            kind=MoneyPayout.KIND_MANUAL,
            period_date=period_date,
            comment=comment,
            created_by=employee,
        )

        return JsonResponse({'success': True, 'payout': serialize_payout(payout)})

    def delete(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        payout_id = request.GET.get('id') or request.POST.get('id')
        payout = MoneyPayout.objects.filter(id=payout_id).first()

        if payout is None:
            return JsonResponse({'error': 'Выплата не найдена'}, status=404)

        if payout.is_reverted:
            return JsonResponse({'error': 'Выплата уже отменена'}, status=400)

        payout.is_reverted = True
        payout.reverted_at = timezone.now()
        payout.reverted_by = employee
        payout.save(update_fields=['is_reverted', 'reverted_at', 'reverted_by', 'updated_at'])

        return JsonResponse({'success': True})


class MoneyMonthPreviewView(View):
    def get(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        year, month = parse_month(request.GET.get('month'))
        start, end, next_start = month_bounds(year, month)

        rows = []
        total = ZERO

        for summary_row in build_summary(start, end):
            balance = Decimal(str(summary_row['balance']))

            if balance <= 0:
                continue

            rows.append({
                'employee_id': summary_row['employee_id'],
                'employee_name': summary_row['employee_name'],
                'role_display': summary_row['role_display'],
                'accrued': summary_row['accrued'],
                'paid': summary_row['paid'],
                'balance': summary_row['balance'],
                'amount': summary_row['balance'],
            })

            total += balance

        return JsonResponse({
            'success': True,
            'month': f'{year:04d}-{month:02d}',
            'period_start': start.strftime('%Y-%m-%d'),
            'period_end': end.strftime('%Y-%m-%d'),
            'period_label': f'{start.strftime("%d.%m.%Y")} — {end.strftime("%d.%m.%Y")}',
            'rows': rows,
            'total': float(total),
            'today': timezone.localdate().strftime('%Y-%m-%d'),
        })


class MoneyMonthPayView(View):
    def post(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        year, month = parse_month(request.POST.get('month'))
        start, end, next_start = month_bounds(year, month)

        method = request.POST.get('method', MoneyPayout.METHOD_CASH)

        if method not in [MoneyPayout.METHOD_CASH, MoneyPayout.METHOD_TRANSFER]:
            method = MoneyPayout.METHOD_CASH

        period_date = parse_iso_date(request.POST.get('period_date')) or timezone.localdate()

        employee_ids = request.POST.getlist('employee_id')
        amounts = request.POST.getlist('amount')

        rows = []

        for index, employee_id in enumerate(employee_ids):
            rows.append({
                'employee_id': employee_id,
                'amount': amounts[index] if index < len(amounts) else '',
            })

        payouts = create_month_payouts(
            rows,
            actor=employee,
            period_start=start,
            period_end=end,
            method=method,
        )

        total = sum([Decimal(payout.amount) for payout in payouts], ZERO)

        return JsonResponse({
            'success': True,
            'count': len(payouts),
            'total': float(total),
        })
