from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.views import View

from ..models import Employee
from fill_data import (
    create_users, create_services, create_clients, create_orders,
    delete_employees, delete_clients, delete_orders, delete_services,
)


FILL_ACTIONS = {
    'users': create_users,
    'services': create_services,
    'clients': create_clients,
    'orders': create_orders,
    'delete_employees': delete_employees,
    'delete_clients': delete_clients,
    'delete_orders': delete_orders,
    'delete_services': delete_services,
}


class FillDataView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')

        try:
            employee = request.user.employee_profile
        except Employee.DoesNotExist:
            return redirect('logout')

        if employee.role != 'senior_admin' and not request.user.is_superuser:
            return redirect('index')

        return render(request, 'fill_data.html', {'employee': employee})

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Не авторизован'}, status=401)

        try:
            employee = request.user.employee_profile
        except Employee.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Профиль не найден'}, status=404)

        if employee.role != 'senior_admin' and not request.user.is_superuser:
            return JsonResponse({'success': False, 'error': 'Недостаточно прав'}, status=403)

        action = request.POST.get('action', '')
        handler = FILL_ACTIONS.get(action)

        if handler is None:
            return JsonResponse({'success': False, 'error': 'Неизвестное действие'}, status=400)

        try:
            result = handler()
        except Exception as error:
            return JsonResponse({'success': False, 'error': str(error)}, status=500)

        return JsonResponse({
            'success': True,
            'action': action,
            'result': result,
        })
