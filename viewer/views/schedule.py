from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Q
from ..models import Employee, Order, OrderEmployee, City, CalendarColor


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

        orders = Order.objects.filter(
            employee_items__employee=employee
        ).select_related('client', 'city', 'manager__user').distinct().order_by('-date', '-created_at')

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

        orders_list = []
        for order in orders:
            my_payment = 0
            try:
                item = order.employee_items.get(employee=employee)
                my_payment = float(item.payment)
            except OrderEmployee.DoesNotExist:
                pass

            services_list = []
            for item in order.estimate_items.all():
                if item.service_name:
                    services_list.append(item.service_name)

            orders_list.append({
                'id': order.id,
                'name': order.name or '—',
                'address': order.address or '',
                'date': order.date.strftime('%Y-%m-%d') if order.date else '',
                'client': order.client.full_name,
                'client_id': order.client.id,
                'city_id': order.city.id if order.city else None,
                'city_name': order.city.name if order.city else '',
                'cost': order.cost or '—',
                'status': order.status,
                'status_display': order.get_status_display(),
                'manager': order.manager.full_name if order.manager else '',
                'manager_id': order.manager.id if order.manager else None,
                'my_payment': my_payment,
                'duration': order.duration or 1,
                'services': services_list,
                'updated_at': order.updated_at.isoformat() if order.updated_at else None,
            })

        colors = {}
        for c in CalendarColor.objects.filter(is_active=True):
            key = c.type if c.type != 'order' else f'order:{c.status}'
            colors[key] = {
                'background': c.background_color,
                'border': c.border_color,
                'text': c.text_color,
            }

        return JsonResponse({'orders': orders_list, 'colors': colors})