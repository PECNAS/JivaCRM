from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Q
from ..models import Employee, Order, OrderEmployee, City, CalendarColor


def format_date(date_value):
    if not date_value:
        return ''
    if hasattr(date_value, 'strftime'):
        return date_value.strftime('%Y-%m-%d')
    return str(date_value)


def serialize_schedule_order(order, my_payment=None):
    data = {
        'id': order.id,
        'name': order.name or '—',
        'name_display': (order.name or '—').upper() if order.status == 'confirmed' else (order.name or '—'),
        'address': order.address or '',
        'date': format_date(order.date),
        'has_date': bool(order.date),
        'client': order.client.full_name,
        'client_id': order.client.id,
        'city_id': order.city.id if order.city else None,
        'city_name': order.city.name if order.city else '',
        'cost': order.cost or '—',
        'status': order.status,
        'status_display': order.get_status_display(),
        'manager': order.manager.full_name if order.manager else '',
        'manager_id': order.manager.id if order.manager else None,
        'duration': order.duration or 1,
        'services': [item.service_name for item in order.estimate_items.all() if item.service_name],
        'updated_at': order.updated_at.isoformat() if order.updated_at else None,
        'content_changed': bool(order.content_changed_at),
        'content_changed_at': order.content_changed_at.isoformat() if order.content_changed_at else None,
        'is_incomplete': order.is_incomplete(),
        'missing_fields': order.get_missing_fields(),
    }

    if my_payment is not None:
        data['my_payment'] = my_payment

    return data


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


def order_queryset():
    return Order.objects.prefetch_related('estimate_items').select_related('client', 'city', 'manager__user')


class ScheduleView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")

        try:
            employee = request.user.employee_profile
            if not employee.can_view_schedule():
                messages.error(request, 'У вас недостаточно прав для просмотра расписания')
                return redirect('logout')
        except:
            return redirect('logout')

        is_artist_or_tech = employee.role in ['artist', 'technician']

        context = {
            'employee': employee,
            'is_artist_or_tech': is_artist_or_tech,
        }
        return render(request, "schedule.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_create_trainings():
                return JsonResponse({'error': 'У вас недостаточно прав для создания тренировок'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        return HttpResponse("POST request successfully!")


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

        search = request.GET.get('search', '')
        status = request.GET.get('status', 'all')

        if search:
            orders = orders.filter(
                Q(name__icontains=search) |
                Q(address__icontains=search) |
                Q(client__full_name__icontains=search) |
                Q(manager__full_name__icontains=search)
            )
        if status != 'all':
            orders = orders.filter(status=status)

        all_orders = list(orders)
        ordered_undated = sorted([o for o in all_orders if not o.date], key=lambda o: o.created_at, reverse=True)
        ordered_dated = sorted([o for o in all_orders if o.date], key=lambda o: o.date, reverse=True)
        ordered = ordered_undated + ordered_dated

        orders_list = []

        for order in ordered:
            my_payment = 0

            for item in order.employee_items.all():
                if item.employee_id == employee.id:
                    my_payment = float(item.payment)
                    break

            orders_list.append(serialize_schedule_order(order, my_payment))

        return JsonResponse({'orders': orders_list, 'colors': serialize_calendar_colors()})
