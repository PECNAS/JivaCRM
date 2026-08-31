from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db.models import Q
from ..models import Employee, Role


class EmployeesView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        employees = Employee.objects.select_related('role', 'user').order_by('full_name')
        
        search_query = request.GET.get('search', '')
        role_filter = request.GET.get('role', 'all')
        
        if search_query:
            employees = employees.filter(
                Q(full_name__icontains=search_query) |
                Q(user__username__icontains=search_query) |
                Q(phone__icontains=search_query)
            )
        
        if role_filter != 'all':
            employees = employees.filter(role_id=role_filter)
        
        paginator = Paginator(employees, 20)
        page_number = request.GET.get('page', 1)
        page_obj = paginator.get_page(page_number)
        
        roles = Role.objects.all()
        
        context = {
            'employees': page_obj,
            'roles': roles,
            'search_query': search_query,
            'role_filter': role_filter,
        }
        return render(request, "employees.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            role_id = request.POST.get('role_id')
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'
            
            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not password:
                return JsonResponse({'error': 'Пароль обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            if not role_id:
                return JsonResponse({'error': 'Должность обязательна для заполнения'}, status=400)
            
            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)
            
            role = get_object_or_404(Role, id=role_id)
            
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=full_name,
                is_active=is_active,
                is_staff=True
            )
            
            employee = Employee.objects.create(
                user=user,
                full_name=full_name,
                role=role,
                phone=phone,
                telegram_username=telegram,
                is_active=is_active
            )
            
            return JsonResponse({
                'success': True,
                'employee': {
                    'id': employee.id,
                    'username': user.username,
                    'full_name': employee.full_name,
                    'role': employee.role.name,
                    'role_id': employee.role.id,
                    'phone': employee.phone,
                    'telegram': employee.telegram_username,
                    'is_active': employee.is_active
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeDetailView(View):
    def get(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = Employee.objects.select_related('role', 'user').get(id=employee_id)
            
            return JsonResponse({
                'id': employee.id,
                'username': employee.user.username,
                'full_name': employee.full_name,
                'role_id': employee.role.id,
                'role_name': employee.role.name,
                'phone': employee.phone or '',
                'telegram': employee.telegram_username or '',
                'is_active': employee.is_active,
                'date_joined': employee.user.date_joined.strftime('%d.%m.%Y'),
                'last_login': employee.user.last_login.strftime('%d.%m.%Y %H:%M') if employee.user.last_login else None,
            })
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)


class EmployeeUpdateView(View):
    def post(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = get_object_or_404(Employee.objects.select_related('user'), id=employee_id)
            
            username = request.POST.get('username', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            role_id = request.POST.get('role_id')
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'
            password = request.POST.get('password', '').strip()
            
            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            if not role_id:
                return JsonResponse({'error': 'Должность обязательна для заполнения'}, status=400)
            
            if User.objects.filter(username=username).exclude(id=employee.user.id).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)
            
            role = get_object_or_404(Role, id=role_id)
            
            user = employee.user
            user.username = username
            user.first_name = full_name
            user.is_active = is_active
            if password:
                user.set_password(password)
            user.save()
            
            employee.full_name = full_name
            employee.role = role
            employee.phone = phone
            employee.telegram_username = telegram
            employee.is_active = is_active
            employee.save()
            
            return JsonResponse({
                'success': True,
                'employee': {
                    'id': employee.id,
                    'username': employee.user.username,
                    'full_name': employee.full_name,
                    'role': employee.role.name,
                    'role_id': employee.role.id,
                    'phone': employee.phone,
                    'telegram': employee.telegram_username,
                    'is_active': employee.is_active
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeDeleteView(View):
    def post(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = get_object_or_404(Employee, id=employee_id)
            
            if employee.user.id == request.user.id:
                return JsonResponse({'error': 'Нельзя удалить самого себя'}, status=400)
            
            user = employee.user
            if not user.is_superuser:
                user.delete()
            employee.delete()
            
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        employees = Employee.objects.select_related('role', 'user').values('id', 'full_name', 'user__username', 'role__name')
        result = []
        for emp in employees:
            result.append({
                'id': emp['id'],
                'full_name': emp['full_name'],
                'username': emp['user__username'],
                'role__name': emp['role__name']
            })
        return JsonResponse({'employees': result})