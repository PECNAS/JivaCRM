import json

from datetime import date, timedelta
from decimal import Decimal

from django.db import models
from django.http import JsonResponse
from django.utils import timezone
from django.views import View

from ..models import Employee, MoneyPayout, OrderShowPay
from .money_service import ZERO, parse_iso_date
from .helpers import role_label


METHOD_CASH = MoneyPayout.METHOD_CASH
METHOD_TRANSFER = MoneyPayout.METHOD_TRANSFER


def month_bounds_for(value):
    start = value.replace(day=1)

    if start.month == 12:
        end = date(start.year, 12, 31)
    else:
        end = date(start.year, start.month + 1, 1) - timedelta(days=1)

    return start, end


def resolve_period(request):
    raw_start = (request.GET.get('date_from') or '').strip()
    raw_end = (request.GET.get('date_to') or '').strip()

    today = timezone.localdate()
    default_start, default_end = month_bounds_for(today)

    start = parse_iso_date(raw_start) or default_start
    end = parse_iso_date(raw_end) or default_end

    if start > end:
        start, end = end, start

    return start, end


def employee_earnings(employee, start, end):
    rows = (
        OrderShowPay.objects
        .filter(
            employee=employee,
            order__date__gte=start,
            order__date__lte=end,
        )
        .select_related('order', 'order__client', 'order__city', 'show')
        .order_by('order__date', 'order_id')
    )

    orders = {}
    total = ZERO

    for item in rows:
        order = item.order
        service = ''
        kind = item.kind

        if item.show_id:
            service = item.show.service_name
        elif kind == OrderShowPay.KIND_DAILY:
            service = 'Суточные'
        elif kind == OrderShowPay.KIND_PROJECT:
            service = 'За проект'

        entry = orders.get(order.id)

        if entry is None:
            entry = {
                'order_id': order.id,
                'order_name': order.name or order.client.full_name,
                'service': service,
                'kind': kind,
                'city': order.city.name if order.city else '',
                'date': order.date.strftime('%Y-%m-%d') if order.date else '',
                'date_display': order.date.strftime('%d.%m.%Y') if order.date else '',
                'amount': 0.0,
            }
            orders[order.id] = entry
        elif service and service not in entry['service']:
            entry['service'] = (entry['service'] + ', ' + service) if entry['service'] else service

        entry['amount'] = round(entry['amount'] + float(item.amount), 2)
        total += Decimal(item.amount)

    return list(orders.values()), total


def employee_payments(employee, start, end):
    payouts = (
        MoneyPayout.objects
        .filter(employee=employee, period_date__gte=start, period_date__lte=end, is_reverted=False)
        .order_by('-period_date', '-id')
    )

    rows = []
    total = ZERO

    for payout in payouts:
        rows.append({
            'id': payout.id,
            'date_display': payout.period_date.strftime('%d.%m.%Y'),
            'method_display': payout.get_method_display(),
            'comment': payout.comment or '',
            'amount': float(payout.amount),
        })

        total += Decimal(payout.amount)

    return rows, total


def build_rows(start, end, scope='all', search=''):
    rows = []
    totals = {
        'accrued': 0.0,
        'paid': 0.0,
        'balance': 0.0,
        'orders': 0,
    }

    employees = Employee.objects.order_by('full_name')

    if scope == 'active':
        employees = employees.filter(is_active=True)

    if search:
        employees = employees.filter(
            models.Q(full_name__icontains=search)
            | models.Q(nickname__icontains=search)
            | models.Q(user__username__icontains=search)
        )

    for employee in employees:
        shows, accrued = employee_earnings(employee, start, end)
        payouts, paid = employee_payments(employee, start, end)

        balance = accrued - paid

        if scope == 'month' and not shows:
            continue

        if scope == 'debt' and balance <= 0:
            continue

        rows.append({
            'employee_id': employee.id,
            'employee_name': employee.display_name,
            'full_name': employee.full_name,
            'login': employee.user.username,
            'role_label': role_label(employee.primary_role()),
            'rate': float(employee.rate or 0),
            'orders': len(shows),
            'accrued': float(accrued),
            'paid': float(paid),
            'balance': float(balance),
            'shows': shows,
            'payouts': payouts,
        })

        totals['accrued'] += float(accrued)
        totals['paid'] += float(paid)
        totals['balance'] += float(balance)
        totals['orders'] += len(shows)

    rows.sort(key=lambda row: (-row['balance'], row['employee_name']))

    return rows, totals


def serialize_history():
    payouts = (
        MoneyPayout.objects
        .filter(is_reverted=False)
        .select_related('employee')
        .order_by('-period_date', '-id')[:40]
    )

    history = []

    for payout in payouts:
        history.append({
            'id': payout.id,
            'employee_id': payout.employee_id,
            'employee_name': payout.employee.display_name,
            'date': payout.period_date.strftime('%Y-%m-%d'),
            'time_display': timezone.localtime(payout.created_at).strftime('%H:%M'),
            'date_display': payout.period_date.strftime('%d.%m.%Y'),
            'method_display': payout.get_method_display(),
            'kind_display': payout.get_kind_display(),
            'comment': payout.comment or '',
            'amount': float(payout.amount),
        })

    return history


def money_employee(request):
    if not request.user.is_authenticated:
        return None

    try:
        return request.user.employee_profile
    except Employee.DoesNotExist:
        return None


def money_guard(request):
    employee = money_employee(request)

    if employee is None:
        return None, JsonResponse({'error': 'Не авторизован'}, status=401)

    if not employee.can_manage_money():
        return None, JsonResponse({'error': 'Недостаточно прав'}, status=403)

    return employee, None


class MoneyPayoutsView(View):
    def get(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        start, end = resolve_period(request)

        scope = (request.GET.get('scope') or 'all').strip()

        if scope not in ('all', 'active', 'month', 'debt'):
            scope = 'all'

        search = (request.GET.get('search') or '').strip()

        rows, totals = build_rows(start, end, scope, search)

        return JsonResponse({
            'success': True,
            'period_start': start.strftime('%d.%m.%Y'),
            'period_end': end.strftime('%d.%m.%Y'),
            'date_from': start.strftime('%Y-%m-%d'),
            'date_to': end.strftime('%Y-%m-%d'),
            'scope': scope,
            'search': search,
            'rows': rows,
            'totals': totals,
            'history': serialize_history(),
            'today': timezone.localdate().strftime('%Y-%m-%d'),
        })

    def post(self, request):
        employee, error = money_guard(request)

        if error:
            return error

        try:
            payload = json.loads(request.POST.get('items') or '[]')
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({'error': 'Некорректные данные'}, status=400)

        if not isinstance(payload, list) or not payload:
            return JsonResponse({'error': 'Укажите сумму выплаты'}, status=400)

        method = request.POST.get('method') or METHOD_CASH

        if method not in (METHOD_CASH, METHOD_TRANSFER):
            method = METHOD_CASH

        period_date = parse_iso_date(request.POST.get('period_date')) or timezone.localdate()
        comment = (request.POST.get('comment') or '').strip()

        created = []

        for item in payload:
            if not isinstance(item, dict):
                continue

            try:
                employee_id = int(item.get('employee_id'))
            except (TypeError, ValueError):
                continue

            try:
                amount = Decimal(str(item.get('amount') or 0))
            except Exception:
                continue

            if not amount.is_finite() or amount <= 0:
                continue

            target = Employee.objects.filter(id=employee_id).first()

            if target is None:
                continue

            payout = MoneyPayout.objects.create(
                employee=target,
                amount=amount.quantize(Decimal('0.01')),
                method=method,
                kind=MoneyPayout.KIND_MANUAL,
                period_date=period_date,
                comment=comment,
                created_by=employee,
            )

            created.append(payout)

        if not created:
            return JsonResponse({'error': 'Укажите сумму выплаты больше нуля'}, status=400)

        return JsonResponse({
            'success': True,
            'count': len(created),
            'total': float(sum([Decimal(item.amount) for item in created], ZERO)),
        })


class MoneyPayoutDeleteView(View):
    def post(self, request, payout_id):
        employee, error = money_guard(request)

        if error:
            return error

        payout = MoneyPayout.objects.select_related('employee').filter(id=payout_id).first()

        if payout is None:
            return JsonResponse({'error': 'Выплата не найдена'}, status=404)

        refund = str(request.POST.get('refund') or '').strip().lower() in ('1', 'true', 'on', 'yes')

        amount = float(payout.amount)
        payout_employee = payout.employee
        is_reverted = payout.is_reverted

        if is_reverted:
            return JsonResponse({'error': 'Выплата уже отменена'}, status=400)

        if refund:
            payout.is_reverted = True
            payout.reverted_at = timezone.now()
            payout.reverted_by = employee
            payout.save(update_fields=['is_reverted', 'reverted_at', 'reverted_by', 'updated_at'])
        else:
            payout.delete()

        target = Employee.objects.filter(id=payout_employee.id).first()

        balance = None

        if target is not None:
            _, accrued = employee_earnings(target, *resolve_period(request))
            _, paid = employee_payments(target, *resolve_period(request))
            balance = float(accrued - paid)

        return JsonResponse({
            'success': True,
            'refund': refund,
            'employee_id': payout_employee.id,
            'amount': amount,
            'balance': balance,
            'history': serialize_history(),
        })
