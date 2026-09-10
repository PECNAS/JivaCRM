from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db.models import Q
from django.contrib import messages
from ..models import Employee, Role


class EmployeesView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_employees():
                messages.error(request, 'У вас недостаточно прав для просмотра сотрудников')
                return redirect('index')
        except:
            return redirect('logout')
        
        employees = Employee.objects.select_related('user').order_by('full_name')
        
        search_query = request.GET.get('search', '')
        role_filter = request.GET.get('role', 'all')
        
        if search_query:
            employees = employees.filter(
                Q(full_name__icontains=search_query) |
                Q(user__username__icontains=search_query) |
                Q(phone__icontains=search_query)
            )
        
        if role_filter != 'all':
            employees = employees.filter(role=role_filter)
        
        paginator = Paginator(employees, 20)
        page_number = request.GET.get('page', 1)
        page_obj = paginator.get_page(page_number)
        
        context = {
            'employee': employee,
            'employees': page_obj,
            'search_query': search_query,
            'role_filter': role_filter,
        }
        return render(request, "employees.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_employees():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            role = request.POST.get('role_id')  # Убираем значение по умолчанию
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'
            
            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not password:
                return JsonResponse({'error': 'Пароль обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            if not role:
                return JsonResponse({'error': 'Роль обязательна для заполнения'}, status=400)
            
            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)
            
            # Проверка: только старший администратор может назначать роль старшего администратора
            if role == 'senior_admin' and employee.role != 'senior_admin':
                return JsonResponse({'error': 'Только старший администратор может назначать эту роль'}, status=403)
            
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=full_name,
                is_active=is_active,
                is_staff=True
            )
            
            employee_obj = Employee.objects.create(
                user=user,
                full_name=full_name,
                role=role,  # Используем полученное значение
                phone=phone,
                telegram_username=telegram,
                is_active=is_active
            )
            
            return JsonResponse({
                'success': True,
                'employee': {
                    'id': employee_obj.id,
                    'username': user.username,
                    'full_name': employee_obj.full_name,
                    'role': employee_obj.role,
                    'role_display': employee_obj.get_role_display(),
                    'phone': employee_obj.phone,
                    'telegram': employee_obj.telegram_username,
                    'is_active': employee_obj.is_active
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeDetailView(View):
    def get(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_employees():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            employee_obj = Employee.objects.get(id=employee_id)
            
            return JsonResponse({
                'id': employee_obj.id,
                'username': employee_obj.user.username,
                'full_name': employee_obj.full_name,
                'role': employee_obj.role,
                'role_display': employee_obj.get_role_display(),
                'phone': employee_obj.phone or '',
                'telegram': employee_obj.telegram_username or '',
                'is_active': employee_obj.is_active,
                'date_joined': employee_obj.user.date_joined.strftime('%d.%m.%Y'),
                'last_login': employee_obj.user.last_login.strftime('%d.%m.%Y %H:%M') if employee_obj.user.last_login else None,
            })
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)


class EmployeeUpdateView(View):
    def post(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            current_employee = request.user.employee_profile
            if not current_employee.can_manage_employees():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            employee_obj = get_object_or_404(Employee, id=employee_id)
            
            username = request.POST.get('username', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            role = request.POST.get('role')  # Убираем значение по умолчанию
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'
            password = request.POST.get('password', '').strip()
            
            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            if not role:
                return JsonResponse({'error': 'Роль обязательна для заполнения'}, status=400)
            
            if User.objects.filter(username=username).exclude(id=employee_obj.user.id).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)
            
            # Проверка: только старший администратор может назначать роль старшего администратора
            if role == 'senior_admin' and current_employee.role != 'senior_admin':
                return JsonResponse({'error': 'Только старший администратор может назначать эту роль'}, status=403)
            
            user = employee_obj.user
            user.username = username
            user.first_name = full_name
            user.is_active = is_active
            if password:
                user.set_password(password)
            user.save()
            
            employee_obj.full_name = full_name
            employee_obj.role = role  # Используем полученное значение
            employee_obj.phone = phone
            employee_obj.telegram_username = telegram
            employee_obj.is_active = is_active
            employee_obj.save()
            
            return JsonResponse({
                'success': True,
                'employee': {
                    'id': employee_obj.id,
                    'username': employee_obj.user.username,
                    'full_name': employee_obj.full_name,
                    'role': employee_obj.role,
                    'role_display': employee_obj.get_role_display(),
                    'phone': employee_obj.phone,
                    'telegram': employee_obj.telegram_username,
                    'is_active': employee_obj.is_active
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeDeleteView(View):
    def post(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            current_employee = request.user.employee_profile
            if not current_employee.can_manage_employees():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            employee_obj = get_object_or_404(Employee, id=employee_id)
            
            if employee_obj.user.id == request.user.id:
                return JsonResponse({'error': 'Нельзя удалить самого себя'}, status=400)
            
            # Защита: нельзя удалить старшего администратора, если вы не старший администратор
            if employee_obj.role == 'senior_admin' and current_employee.role != 'senior_admin':
                return JsonResponse({'error': 'Нельзя удалить старшего администратора'}, status=403)
            
            user = employee_obj.user
            if not user.is_superuser:
                user.delete()
            employee_obj.delete()
            
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        employees = Employee.objects.all().values('id', 'full_name', 'user__username', 'role')
        result = []
        for emp in employees:
            result.append({
                'id': emp['id'],
                'full_name': emp['full_name'],
                'username': emp['user__username'],
                'role': emp['role']
            })
        return JsonResponse({'employees': result})