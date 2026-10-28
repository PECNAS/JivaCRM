from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from ..models import Employee, OrderEmployee, MoneyAccrual, MoneyPayout, PriceRisePeriod

ZERO = Decimal('0.00')


def parse_amount(value):
    if value is None:
        return None

    text = str(value).strip().replace(' ', '').replace(',', '.')

    if not text:
        return None

    try:
        return Decimal(text).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return None


def parse_iso_date(value):
    if not value:
        return None

    if isinstance(value, date):
        return value

    try:
        return date.fromisoformat(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_month(value):
    target = parse_iso_date(value)

    if target:
        return target.year, target.month

    today = timezone.localdate()
    return today.year, today.month


def month_bounds(year, month):
    start = date(year, month, 1)

    if month == 12:
        end = date(year, 12, 31)
        next_start = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
        next_start = date(year, month + 1, 1)

    return start, end, next_start


def price_percent_for(order_date):
    period = PriceRisePeriod.find_for_date(order_date)

    if period:
        return Decimal(period.percent)

    return ZERO


def order_payment_amount(order, employee):
    if not order.date:
        return ZERO

    event_start = order.date
    event_end = order.date + timedelta(days=max((order.duration or 1) - 1, 0))
    start, end, _ = month_bounds(order.date.year, order.date.month)

    overlap_start = max(start, event_start)
    overlap_end = min(end, event_end)

    if overlap_start > overlap_end:
        return ZERO

    total_days = (event_end - event_start).days + 1
    overlap_days = (overlap_end - overlap_start).days + 1

    row = order_employee_payment(order, employee)

    if row is None or Decimal(row.payment) <= 0:
        return None

    base = Decimal(row.payment)

    if total_days > 1 and overlap_days < total_days:
        base = (base / Decimal(total_days) * Decimal(overlap_days)).quantize(Decimal('0.01'))

    percent = price_percent_for(order.date)

    if percent:
        base = (base * (Decimal('100') + percent) / Decimal('100')).quantize(Decimal('0.01'))

    return base


def order_employee_payment(order, employee):
    rows = list(OrderEmployee.objects.filter(order=order, employee=employee).order_by('id'))

    if not rows:
        return None

    selected = [row for row in rows if not row.is_overridden]

    return selected[0] if selected else rows[0]


def has_dated_employees(order):
    return OrderEmployee.objects.filter(order=order, employee__isnull=False).exists()


def order_accrual_title(order):
    base = order.name or order.client.full_name

    services = [item.service_name for item in order.estimate_items.all() if item.service_name]

    if services:
        return f'{base} · {", ".join(services)}'

    return base


def accrue_order(order, actor=None, period_start=None):
    created = []
    skipped = []

    if not order.date:
        return created, skipped

    period_date = period_start or order.date

    employees = (
        Employee.objects
        .filter(order_items__order=order)
        .distinct()
        .order_by('full_name')
    )

    for employee in employees:
        existing = MoneyAccrual.objects.filter(
            employee=employee,
            order=order,
            category=MoneyAccrual.CATEGORY_ORDER,
            status=MoneyAccrual.STATUS_ACTIVE,
        ).exists()

        if existing:
            skipped.append(employee)
            continue

        amount = order_payment_amount(order, employee)

        if amount is None or amount <= 0:
            skipped.append(employee)
            continue

        row = order_employee_payment(order, employee)

        MoneyAccrual.objects.create(
            employee=employee,
            category=MoneyAccrual.CATEGORY_ORDER,
            amount=amount,
            period_date=period_date,
            order=order,
            order_employee=row,
            title=order_accrual_title(order),
            created_by=actor,
        )

        created.append(employee)

    return created, skipped


def accrue_order_items(order, items, actor=None, period_start=None):
    created = []
    skipped = []

    if not order.date:
        return created, skipped

    period_date = period_start or order.date

    for item in items:
        employee_id = item.get('employee_id')
        amount = parse_amount(item.get('amount'))

        if not employee_id or amount is None:
            continue

        employee = Employee.objects.filter(id=employee_id).first()

        if not employee:
            continue

        existing = MoneyAccrual.objects.filter(
            employee=employee,
            order=order,
            category=MoneyAccrual.CATEGORY_ORDER,
            status=MoneyAccrual.STATUS_ACTIVE,
        ).exists()

        if existing:
            skipped.append(employee)
            continue

        if amount <= 0:
            skipped.append(employee)
            continue

        MoneyAccrual.objects.create(
            employee=employee,
            category=MoneyAccrual.CATEGORY_ORDER,
            amount=amount,
            period_date=period_date,
            order=order,
            order_employee=order_employee_payment(order, employee),
            title=order_accrual_title(order),
            created_by=actor,
        )

        created.append(employee)

    return created, skipped


def cancel_accrual(accrual, actor=None, reason=''):
    if not accrual.is_active:
        return None

    with transaction.atomic():
        accrual.status = MoneyAccrual.STATUS_CANCELLED
        accrual.cancelled_at = timezone.now()
        accrual.cancelled_by = actor

        if reason:
            accrual.comment = (accrual.comment + '\n' + reason).strip()

        accrual.save(update_fields=['status', 'cancelled_at', 'cancelled_by', 'comment', 'updated_at'])

        if accrual.amount <= 0:
            return accrual

        source = MoneyAccrual.objects.create(
            employee=accrual.employee,
            category=MoneyAccrual.CATEGORY_SOURCE,
            amount=accrual.amount,
            period_date=timezone.localdate(),
            order=accrual.order,
            order_employee=accrual.order_employee,
            title=f'Откат: {accrual.title or accrual.get_category_display()}',
            comment=reason,
            created_by=actor,
        )

    return source


def active_accrual_balance(employee, until=None):
    query = MoneyAccrual.objects.filter(employee=employee, status=MoneyAccrual.STATUS_ACTIVE)

    if until:
        query = query.filter(period_date__lte=until)

    total = ZERO

    for accrual in query:
        total += accrual.signed_amount()

    return total


def active_payout_total(employee, until=None):
    query = MoneyPayout.objects.filter(employee=employee, is_reverted=False)

    if until:
        query = query.filter(period_date__lte=until)

    total = ZERO

    for payout in query:
        total += Decimal(payout.amount)

    return total


def employee_balance(employee, until=None):
    return active_accrual_balance(employee, until) - active_payout_total(employee, until)


def create_month_payouts(rows, actor=None, period_start=None, period_end=None, method='cash'):
    payouts = []

    for row in rows:
        employee = Employee.objects.filter(id=row.get('employee_id')).first()
        amount = parse_amount(row.get('amount'))

        if not employee or amount is None or amount <= 0:
            continue

        payout = MoneyPayout.objects.create(
            employee=employee,
            amount=amount,
            method=method,
            kind=MoneyPayout.KIND_MONTH,
            period_date=period_end or timezone.localdate(),
            period_start=period_start,
            period_end=period_end,
            comment=row.get('comment', ''),
            created_by=actor,
        )

        payouts.append(payout)

    return payouts
