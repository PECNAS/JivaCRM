from datetime import date, timedelta
import json

from django.http import JsonResponse
from django.shortcuts import redirect
from django.utils import timezone
from django.views import View

from ..models import ArtistAvailability, Employee, WEEKDAY_NAMES, normalize_intervals, resolve_availability
from .employees import AvailabilityByDateView


def parse_date(value):
    if not value:
        return None

    try:
        return date.fromisoformat(str(value).strip())
    except (TypeError, ValueError):
        return None


def resolve_employee(request):
    if not request.user.is_authenticated:
        return None

    try:
        return request.user.employee_profile
    except Employee.DoesNotExist:
        return None


def can_view_employee(actor, target):
    if actor is None:
        return False

    if actor.id == target.id:
        return True

    return actor.can_manage_feedback()


def serialize_rule(rule):
    day_label = ''

    if rule.kind == ArtistAvailability.KIND_WEEKLY and rule.weekday is not None:
        day_label = WEEKDAY_NAMES[rule.weekday] if 0 <= rule.weekday <= 6 else ''

    return {
        'id': rule.id,
        'kind': rule.kind,
        'weekday': rule.weekday,
        'weekday_label': day_label,
        'start_date': rule.start_date.strftime('%Y-%m-%d') if rule.start_date else '',
        'end_date': rule.end_date.strftime('%Y-%m-%d') if rule.end_date else '',
        'start_display': rule.start_date.strftime('%d.%m.%Y') if rule.start_date else '',
        'end_display': rule.end_date.strftime('%d.%m.%Y') if rule.end_date else '',
        'action': rule.action,
        'action_display': rule.get_action_display(),
        'label': rule.label(),
        'intervals': normalize_intervals(rule.intervals),
        'comment': rule.comment or '',
    }


class AvailabilityView(View):
    def get(self, request):
        actor = resolve_employee(request)

        if actor is None:
            return redirect('login')

        return JsonResponse({'success': True, 'employee_id': actor.id})

    def post(self, request):
        actor = resolve_employee(request)

        if actor is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        target_id = request.POST.get('employee_id')
        target = actor

        if target_id:
            found = Employee.objects.filter(id=target_id).first()

            if found is not None and can_view_employee(actor, found):
                target = found

        kind = request.POST.get('kind', ArtistAvailability.KIND_WEEKLY)

        if kind not in [ArtistAvailability.KIND_WEEKLY, ArtistAvailability.KIND_EXCEPTION]:
            return JsonResponse({'error': 'Неверный тип правила'}, status=400)

        action = request.POST.get('action', ArtistAvailability.ACTION_DAY)

        if action not in [ArtistAvailability.ACTION_DAY, ArtistAvailability.ACTION_OFF, ArtistAvailability.ACTION_PARTIAL]:
            return JsonResponse({'error': 'Неверное действие'}, status=400)

        intervals = []

        if action == ArtistAvailability.ACTION_PARTIAL:
            try:
                intervals = json.loads(request.POST.get('intervals', '[]'))
            except (TypeError, ValueError):
                intervals = []

            intervals = normalize_intervals(intervals)

            if not intervals:
                return JsonResponse({'error': 'Укажите хотя бы один промежуток времени'}, status=400)

        rule_id = request.POST.get('id')

        rule = None

        if rule_id:
            rule = ArtistAvailability.objects.filter(id=rule_id, employee=target).first()

            if rule is None:
                return JsonResponse({'error': 'Правило не найдено'}, status=404)

        if kind == ArtistAvailability.KIND_WEEKLY:
            try:
                weekday = int(request.POST.get('weekday', ''))
            except (TypeError, ValueError):
                return JsonResponse({'error': 'Укажите день недели'}, status=400)

            if weekday < 0 or weekday > 6:
                return JsonResponse({'error': 'Укажите день недели'}, status=400)

            if rule is None:
                rule = ArtistAvailability.objects.filter(
                    employee=target,
                    kind=ArtistAvailability.KIND_WEEKLY,
                    weekday=weekday,
                ).first()

            if rule is None:
                rule = ArtistAvailability(employee=target)

            rule.kind = ArtistAvailability.KIND_WEEKLY
            rule.weekday = weekday
            rule.start_date = None
            rule.end_date = None
        else:
            start_date = parse_date(request.POST.get('start_date')) or timezone.localdate()
            end_date = parse_date(request.POST.get('end_date')) or start_date

            if end_date < start_date:
                start_date, end_date = end_date, start_date

            if rule is None:
                rule = ArtistAvailability.objects.filter(
                    employee=target,
                    kind=ArtistAvailability.KIND_EXCEPTION,
                    start_date=start_date,
                    end_date=end_date,
                ).first()

            if rule is None:
                rule = ArtistAvailability(employee=target)

            rule.kind = ArtistAvailability.KIND_EXCEPTION
            rule.weekday = None
            rule.start_date = start_date
            rule.end_date = end_date

        rule.action = action
        rule.intervals = intervals if action == ArtistAvailability.ACTION_PARTIAL else []
        rule.comment = request.POST.get('comment', '').strip()

        rule.save()

        if rule.kind == ArtistAvailability.KIND_WEEKLY:
            target.availability_rules.filter(
                kind=ArtistAvailability.KIND_WEEKLY,
                weekday=rule.weekday,
            ).exclude(id=rule.id).delete()
        else:
            target.availability_rules.filter(
                kind=ArtistAvailability.KIND_EXCEPTION,
                start_date=rule.start_date,
                end_date=rule.end_date,
            ).exclude(id=rule.id).delete()

        return JsonResponse({'success': True, 'rule': serialize_rule(rule)})

    def delete(self, request):
        actor = resolve_employee(request)

        if actor is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        rule = ArtistAvailability.objects.filter(id=request.GET.get('id')).first()

        if rule is None:
            return JsonResponse({'error': 'Правило не найдено'}, status=404)

        if not can_view_employee(actor, rule.employee):
            return JsonResponse({'error': 'Недостаточно прав'}, status=403)

        employee = rule.employee
        kind = rule.kind
        exception_dates = []

        if kind == ArtistAvailability.KIND_EXCEPTION:
            current = rule.start_date
            limit = rule.end_date or rule.start_date

            while current is not None and limit is not None and current <= limit:
                exception_dates.append(current.strftime('%Y-%m-%d'))
                current += timedelta(days=1)

        rule.delete()

        return JsonResponse({'success': True, 'kind': kind, 'exception_dates': exception_dates})


class AvailabilityDetailView(View):
    def get(self, request):
        actor = resolve_employee(request)

        if actor is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        target_id = request.GET.get('employee_id')
        target = actor

        if target_id:
            found = Employee.objects.filter(id=target_id).first()

            if found is not None and can_view_employee(actor, found):
                target = found

        weekly = {}

        duplicate_weekdays = (
            target.availability_rules
            .filter(kind=ArtistAvailability.KIND_WEEKLY, weekday__isnull=False)
            .values_list('weekday', flat=True)
        )

        for weekday in sorted(set(duplicate_weekdays)):
            rule = target.availability_rules.filter(
                kind=ArtistAvailability.KIND_WEEKLY,
                weekday=weekday,
            ).order_by('-updated_at', '-id').first()

            if rule is not None:
                weekly[str(weekday)] = serialize_rule(rule)

        exceptions = [
            serialize_rule(rule)
            for rule in target.availability_rules.filter(kind=ArtistAvailability.KIND_EXCEPTION).order_by('start_date')
        ]

        today = timezone.localdate()
        month_start = date(today.year, today.month, 1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        calendar = []
        leading = month_start.weekday()

        for _ in range(leading):
            calendar.append({'empty': True})

        current = month_start

        weekly_cache = {}

        for rule in target.availability_rules.filter(kind=ArtistAvailability.KIND_WEEKLY):
            if rule.weekday is not None:
                weekly_cache[rule.weekday] = rule

        exception_rules = list(target.availability_rules.filter(kind=ArtistAvailability.KIND_EXCEPTION))

        while current <= month_end:
            row = resolve_availability(target, current)
            row['empty'] = False
            row['date'] = current.strftime('%Y-%m-%d')
            row['date_display'] = current.strftime('%d.%m.%Y')
            row['exception_ids'] = []
            matched = None

            for rule in exception_rules:
                if rule.start_date and rule.end_date and rule.start_date <= current <= rule.end_date:
                    row['exception_ids'].append(rule.id)

                    if matched is None or (rule.updated_at, rule.id) > (matched.updated_at, matched.id):
                        matched = rule

            weekly_rule = weekly_cache.get(current.weekday())

            if matched is not None:
                row['source_kind'] = ArtistAvailability.KIND_EXCEPTION
                row['source_id'] = matched.id
            elif weekly_rule is not None:
                row['source_kind'] = ArtistAvailability.KIND_WEEKLY
                row['source_id'] = weekly_rule.id
            else:
                row['source_kind'] = ''
                row['source_id'] = None

            row['is_today'] = current == today
            row['weekday'] = current.weekday()
            row['day_label'] = current.strftime('%d')
            row['day_number'] = current.day
            row['weekday_label'] = WEEKDAY_NAMES[current.weekday()]
            row['month_day'] = current.strftime('%d.%m')
            calendar.append(row)
            current += timedelta(days=1)

        while len(calendar) % 7:
            calendar.append({'empty': True})

        return JsonResponse({
            'success': True,
            'employee': {'id': target.id, 'name': target.display_name},
            'weekdays': WEEKDAY_NAMES,
            'weekly': weekly,
            'exceptions': exceptions,
            'calendar': calendar,
            'month_label': today.strftime('%m.%Y'),
        })


class AvailabilityScheduleView(View):
    def get(self, request):
        actor = resolve_employee(request)

        if actor is None:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        target_id = request.GET.get('employee_id')
        target = actor

        if target_id and target_id.isdigit():
            found = Employee.objects.filter(id=int(target_id)).first()

            if found is not None and can_view_employee(actor, found):
                target = found

        start = parse_date(request.GET.get('start')) or timezone.localdate()
        days = []

        try:
            count = max(1, min(int(request.GET.get('days', '14')), 62))
        except (TypeError, ValueError):
            count = 14

        for offset in range(count):
            current = start + timedelta(days=offset)
            row = resolve_availability(target, current)
            row['weekday_label'] = WEEKDAY_NAMES[current.weekday()]
            row['day_label'] = current.strftime('%d.%m.%Y')
            days.append(row)

        return JsonResponse({'success': True, 'employee_id': target.id, 'days': days})
