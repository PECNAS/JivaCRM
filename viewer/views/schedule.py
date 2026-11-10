from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Q
from ..models import Employee, Order, OrderEmployee, City, CalendarColor, ARTIST_ROLES, ROLE_TECHNICIAN
from .helpers import format_date_short, role_label


def format_date(date_value):
    if not date_value:
        return ''
    if hasattr(date_value, 'strftime'):
        return date_value.strftime('%Y-%m-%d')
    return str(date_value)


def serialize_schedule_order(order, my_payment=None, can_see_cost=True):
    checklist_items = list(order.checklist_items.all())
    checklist_total = len(checklist_items)

    staff = [
        {
            'id': item.id,
            'employee_id': item.employee_id,
            'name': item.employee.display_name if item.employee_id else item.employee_name,
            'role_label': role_label(item.role_code) or item.employee_role,
            'show_name': item.get_show_label(),
            'comment': item.comment or '',
            'is_responsible': item.is_responsible,
            'is_story': item.is_story,
        }
        for item in order.employee_items.select_related('employee', 'show').order_by('id')
    ]

    data = {
        'id': order.id,
        'name': order.name or '—',
        'name_display': (order.name or '—').upper() if order.status == 'confirmed' else (order.name or '—'),
        'auto_name': order.auto_name or '',
        'chat_number': order.chat_number or '',
        'date_display': format_date_short(order.date),
        'total_paid': float(order.total_paid()) if can_see_cost else None,
        'is_paid': order.is_paid() if can_see_cost else None,
        'address': order.address or '',
        'date': format_date(order.date),
        'has_date': bool(order.date),
        'client': order.client.full_name,
        'client_id': order.client.id,
        'city_id': order.city.id if order.city else None,
        'city_name': order.city.name if order.city else '',
        'cost': (order.cost or '—') if can_see_cost else '',
        'comment': order.concept or '',
        'status': order.status,
        'status_display': order.get_status_display(),
        'manager': order.manager.display_name if order.manager else '',
        'manager_id': order.manager.id if order.manager else None,
        'duration': order.duration or 1,
        'services': [
            {
                'name': item.service_name,
                'people_count': item.people_count,
                'people_count_unknown': item.people_count_unknown,
            }
            for item in order.estimate_items.all()
            if item.service_name
        ],
        'checklist_total': checklist_total,
        'checklist_done': len([item for item in checklist_items if item.is_done]),
        'staff': staff,
        'updated_at': order.updated_at.isoformat() if order.updated_at else None,
        'content_changed': bool(order.content_changed_at),
        'content_changed_at': order.content_changed_at.isoformat() if order.content_changed_at else None,
        'is_incomplete': order.is_incomplete(),
        'missing_fields': order.get_missing_fields(),
        'can_see_cost': can_see_cost,
        'contact_name': order.contact_name or '',
        'contact_phone': order.contact_phone or '',
        'contact_telegram': order.contact_telegram or '',
        'setup_time': order.setup_time or '',
        'dressing_room_comment': order.dressing_room_comment or '',
        'meal_comment': order.meal_comment or '',
        'tech_comment': order.tech_comment or '',
        'venue_comment': order.venue_comment or '',
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
    return Order.objects.prefetch_related(
        'estimate_items', 'checklist_items', 'employee_items__employee', 'employee_items__show',
    ).select_related('client', 'city', 'manager__user')


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

        is_artist_or_tech = employee.primary_role() in ARTIST_ROLES or employee.primary_role() == ROLE_TECHNICIAN

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

        can_see_cost = employee.can_see_costs()
        can_see_rates = employee.can_see_rates()

        for order in ordered:
            my_payment = 0

            for item in order.employee_items.all():
                if item.employee_id == employee.id:
                    my_payment = float(item.payment) if can_see_rates else None
                    break

            orders_list.append(serialize_schedule_order(order, my_payment, can_see_cost))

        return JsonResponse({'orders': orders_list, 'colors': serialize_calendar_colors()})
