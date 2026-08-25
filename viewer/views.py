from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.hashers import make_password
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.utils import timezone
from .models import Client, Agency, Order, Employee, Role, Skill


class IndexView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        return render(request, "index.html")

    def post(self, request):
        return HttpResponse("POST request successfully!")


class ClientsView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        clients = Client.objects.annotate(
            orders_count=Count('orders')
        ).select_related('agency', 'created_by').order_by('full_name')
        
        search_query = request.GET.get('search', '')
        rating_filter = request.GET.get('rating', 'all')
        
        if search_query:
            clients = clients.filter(
                Q(full_name__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(agency__name__icontains=search_query)
            )
        
        if rating_filter != 'all':
            clients = clients.filter(rating=rating_filter)
        
        paginator = Paginator(clients, 20)
        page_number = request.GET.get('page', 1)
        page_obj = paginator.get_page(page_number)
        
        context = {
            'clients': page_obj,
            'search_query': search_query,
            'rating_filter': rating_filter,
        }
        return render(request, "clients.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            full_name = request.POST.get('full_name', '').strip()
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            email = request.POST.get('email', '').strip()
            agency_name = request.POST.get('agency', '').strip()
            city = request.POST.get('city', '').strip()
            rating = request.POST.get('rating', 'medium')
            
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            
            if not phone:
                return JsonResponse({'error': 'Телефон обязателен для заполнения'}, status=400)
            
            phone_digits = ''.join(filter(str.isdigit, phone))
            if len(phone_digits) != 11:
                return JsonResponse({'error': 'Номер телефона должен содержать 11 цифр'}, status=400)
            
            agency = None
            if agency_name:
                agency, _ = Agency.objects.get_or_create(name=agency_name)
            
            try:
                employee = Employee.objects.get(username=request.user.username)
            except Employee.DoesNotExist:
                default_role, _ = Role.objects.get_or_create(name='Менеджер')
                employee = Employee.objects.create(
                    username=request.user.username,
                    full_name=request.user.get_full_name() or request.user.username,
                    role=default_role,
                    is_active=True
                )
            
            client = Client.objects.create(
                full_name=full_name,
                phone=phone,
                telegram_username=telegram,
                email=email,
                agency=agency,
                city=city,
                rating=rating,
                created_by=employee
            )
            
            return JsonResponse({
                'success': True,
                'client': {
                    'id': client.id,
                    'full_name': client.full_name,
                    'phone': client.phone,
                    'telegram': client.telegram_username,
                    'email': client.email,
                    'agency': agency.name if agency else None,
                    'city': client.city,
                    'rating': client.rating,
                    'orders_count': 0,
                    'requests_count': client.requests_count
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ClientDetailView(View):
    def get(self, request, client_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            client = Client.objects.annotate(
                orders_count=Count('orders')
            ).select_related('agency', 'created_by').get(id=client_id)
            
            orders = Order.objects.filter(client=client).select_related('manager')
            
            orders_list = []
            for order in orders:
                orders_list.append({
                    'id': order.id,
                    'address': order.address,
                    'date': order.date.strftime('%d.%m.%Y'),
                    'status': order.get_status_display(),
                    'status_key': order.status,
                    'cost': order.cost,
                    'manager': order.manager.full_name if order.manager else None,
                })
            
            return JsonResponse({
                'id': client.id,
                'full_name': client.full_name,
                'phone': client.phone,
                'telegram': client.telegram_username or '—',
                'agency': client.agency.name if client.agency else None,
                'rating': client.rating,
                'rating_display': client.get_rating_display(),
                'email': client.email or '—',
                'city': client.city or '—',
                'requests_count': client.requests_count,
                'orders_count': client.orders_count,
                'orders': orders_list,
                'created_by': client.created_by.full_name if client.created_by else None,
            })
        except Client.DoesNotExist:
            return JsonResponse({'error': 'Клиент не найден'}, status=404)


class ClientUpdateView(View):
    def post(self, request, client_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            client = get_object_or_404(Client, id=client_id)
            
            full_name = request.POST.get('full_name', '').strip()
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            email = request.POST.get('email', '').strip()
            agency_name = request.POST.get('agency', '').strip()
            city = request.POST.get('city', '').strip()
            rating = request.POST.get('rating', 'medium')
            
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            
            if not phone:
                return JsonResponse({'error': 'Телефон обязателен для заполнения'}, status=400)
            
            phone_digits = ''.join(filter(str.isdigit, phone))
            if len(phone_digits) != 11:
                return JsonResponse({'error': 'Номер телефона должен содержать 11 цифр'}, status=400)
            
            agency = None
            if agency_name:
                agency, _ = Agency.objects.get_or_create(name=agency_name)
            
            client.full_name = full_name
            client.phone = phone
            client.telegram_username = telegram
            client.email = email
            client.agency = agency
            client.city = city
            client.rating = rating
            client.save()
            
            return JsonResponse({
                'success': True,
                'client': {
                    'id': client.id,
                    'full_name': client.full_name,
                    'phone': client.phone,
                    'telegram': client.telegram_username,
                    'email': client.email,
                    'agency': agency.name if agency else None,
                    'city': client.city,
                    'rating': client.rating,
                    'rating_display': client.get_rating_display(),
                    'orders_count': client.orders.count(),
                    'requests_count': client.requests_count
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ClientListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        clients = Client.objects.annotate(
            orders_count=Count('orders')
        ).select_related('agency').order_by('full_name')
        
        search = request.GET.get('search', '')
        rating = request.GET.get('rating', 'all')
        
        if search:
            clients = clients.filter(
                Q(full_name__icontains=search) |
                Q(phone__icontains=search) |
                Q(agency__name__icontains=search)
            )
        
        if rating != 'all':
            clients = clients.filter(rating=rating)
        
        clients_list = []
        for client in clients:
            clients_list.append({
                'id': client.id,
                'full_name': client.full_name,
                'phone': client.phone,
                'telegram': client.telegram_username,
                'agency': client.agency.name if client.agency else None,
                'rating': client.rating,
                'rating_display': client.get_rating_display(),
                'requests_count': client.requests_count,
                'orders_count': client.orders_count,
                'email': client.email,
                'city': client.city,
            })
        
        return JsonResponse({'clients': clients_list})


class EmployeesView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        employees = Employee.objects.select_related('role').order_by('full_name')
        
        search_query = request.GET.get('search', '')
        role_filter = request.GET.get('role', 'all')
        
        if search_query:
            employees = employees.filter(
                Q(full_name__icontains=search_query) |
                Q(username__icontains=search_query) |
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
            
            from django.contrib.auth.models import User
            
            # Проверяем существование пользователя
            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)
            
            if Employee.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Сотрудник с таким логином уже существует'}, status=400)
            
            role = get_object_or_404(Role, id=role_id)
            
            # Сначала создаем пользователя в auth_user
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=full_name,
                is_active=is_active,
                is_staff=True
            )
            
            # Затем создаем сотрудника с тем же паролем
            employee = Employee(
                username=username,
                full_name=full_name,
                role=role,
                phone=phone,
                telegram_username=telegram,
                is_active=is_active,
                is_staff=True
            )
            # Копируем хеш пароля из auth_user
            employee.password = user.password
            employee.save()
            
            return JsonResponse({
                'success': True,
                'employee': {
                    'id': employee.id,
                    'username': employee.username,
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
            employee = Employee.objects.select_related('role').get(id=employee_id)
            
            return JsonResponse({
                'id': employee.id,
                'username': employee.username,
                'full_name': employee.full_name,
                'role_id': employee.role.id,
                'role_name': employee.role.name,
                'phone': employee.phone or '',
                'telegram': employee.telegram_username or '',
                'is_active': employee.is_active,
                'date_joined': employee.date_joined.strftime('%d.%m.%Y'),
                'last_login': employee.last_login.strftime('%d.%m.%Y %H:%M') if employee.last_login else None,
            })
        except Employee.DoesNotExist:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)


class EmployeeUpdateView(View):
    def post(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = get_object_or_404(Employee, id=employee_id)
            
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
            
            if Employee.objects.filter(username=username).exclude(id=employee_id).exists():
                return JsonResponse({'error': 'Сотрудник с таким логином уже существует'}, status=400)
            
            role = get_object_or_404(Role, id=role_id)
            
            # Обновляем данные сотрудника
            employee.username = username
            employee.full_name = full_name
            employee.role = role
            employee.phone = phone
            employee.telegram_username = telegram
            employee.is_active = is_active
            
            # Если пароль передан, обновляем его
            if password:
                employee.set_password(password)
            
            employee.save()
            
            # Синхронизируем пароль с auth_user
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(username=employee.username)
                if user.password != employee.password:
                    user.password = employee.password
                    user.save()
            except User.DoesNotExist:
                pass
            
            return JsonResponse({
                'success': True,
                'employee': {
                    'id': employee.id,
                    'username': employee.username,
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
            
            if employee.id == request.user.id:
                return JsonResponse({'error': 'Нельзя удалить самого себя'}, status=400)
            
            employee.delete()
            
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        employees = Employee.objects.select_related('role').values('id', 'full_name', 'username', 'role__name')
        return JsonResponse({'employees': list(employees)})


class OrdersView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        orders = Order.objects.select_related('client', 'manager', 'story_manager').order_by('-date', '-created_at')
        
        search_query = request.GET.get('search', '')
        status_filter = request.GET.get('status', 'all')
        
        if search_query:
            orders = orders.filter(
                Q(address__icontains=search_query) |
                Q(client__full_name__icontains=search_query) |
                Q(manager__full_name__icontains=search_query)
            )
        
        if status_filter != 'all':
            orders = orders.filter(status=status_filter)
        
        paginator = Paginator(orders, 20)
        page_number = request.GET.get('page', 1)
        page_obj = paginator.get_page(page_number)
        
        context = {
            'orders': page_obj,
            'search_query': search_query,
            'status_filter': status_filter,
        }
        return render(request, "orders.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            client_id = request.POST.get('client_id')
            date = request.POST.get('date')
            address = request.POST.get('address', '').strip()
            contact_phone = request.POST.get('contact_phone', '').strip()
            contact_telegram = request.POST.get('contact_telegram', '').strip()
            setup_time = request.POST.get('setup_time', '').strip()
            dressing_room_comment = request.POST.get('dressing_room_comment', '').strip()
            meal_comment = request.POST.get('meal_comment', '').strip()
            concept = request.POST.get('concept', '').strip()
            tech_lamps = request.POST.get('tech_lamps') == 'on'
            tech_laser = request.POST.get('tech_laser') == 'on'
            tech_hazer = request.POST.get('tech_hazer') == 'on'
            tech_grid = request.POST.get('tech_grid') == 'on'
            tech_projection = request.POST.get('tech_projection') == 'on'
            tech_comment = request.POST.get('tech_comment', '').strip()
            venue_comment = request.POST.get('venue_comment', '').strip()
            props_comment = request.POST.get('props_comment', '').strip()
            manager_id = request.POST.get('manager_id')
            cost = request.POST.get('cost', '').strip()
            payment_method = request.POST.get('payment_method', '').strip()
            status = request.POST.get('status', 'request')
            duration = request.POST.get('duration', 1)
            
            if not client_id:
                return JsonResponse({'error': 'Клиент обязателен для заполнения'}, status=400)
            
            if not address:
                return JsonResponse({'error': 'Адрес обязателен для заполнения'}, status=400)
            
            if not date:
                return JsonResponse({'error': 'Дата обязательна для заполнения'}, status=400)
            
            if not manager_id:
                return JsonResponse({'error': 'Менеджер обязателен для заполнения'}, status=400)
            
            client = get_object_or_404(Client, id=client_id)
            manager = get_object_or_404(Employee, id=manager_id)
            
            order = Order.objects.create(
                client=client,
                date=date,
                address=address,
                contact_phone=contact_phone,
                contact_telegram=contact_telegram,
                setup_time=setup_time,
                dressing_room_comment=dressing_room_comment,
                meal_comment=meal_comment,
                concept=concept,
                tech_lamps=tech_lamps,
                tech_laser=tech_laser,
                tech_hazer=tech_hazer,
                tech_grid=tech_grid,
                tech_projection=tech_projection,
                tech_comment=tech_comment,
                venue_comment=venue_comment,
                props_comment=props_comment,
                manager=manager,
                cost=cost or '—',
                payment_method=payment_method,
                status=status,
                duration=int(duration)
            )
            
            return JsonResponse({
                'success': True,
                'order': {
                    'id': order.id,
                    'address': order.address,
                    'date': order.date.strftime('%Y-%m-%d'),
                    'client': order.client.full_name,
                    'client_id': order.client.id,
                    'cost': order.cost,
                    'status': order.status,
                    'status_display': order.get_status_display(),
                    'manager': order.manager.full_name,
                    'manager_id': order.manager.id
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderDetailView(View):
    def get(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            order = Order.objects.select_related('client', 'manager', 'story_manager').get(id=order_id)
            
            return JsonResponse({
                'id': order.id,
                'client_id': order.client.id,
                'client_name': order.client.full_name,
                'date': order.date.strftime('%Y-%m-%d'),
                'address': order.address,
                'contact_phone': order.contact_phone,
                'contact_telegram': order.contact_telegram,
                'setup_time': order.setup_time,
                'dressing_room_comment': order.dressing_room_comment,
                'meal_comment': order.meal_comment,
                'concept': order.concept,
                'tech_lamps': order.tech_lamps,
                'tech_laser': order.tech_laser,
                'tech_hazer': order.tech_hazer,
                'tech_grid': order.tech_grid,
                'tech_projection': order.tech_projection,
                'tech_comment': order.tech_comment,
                'venue_comment': order.venue_comment,
                'props_comment': order.props_comment,
                'manager_id': order.manager.id,
                'manager_name': order.manager.full_name,
                'cost': order.cost,
                'payment_method': order.payment_method,
                'payment_method_display': order.get_payment_method_display() if order.payment_method else '',
                'status': order.status,
                'status_display': order.get_status_display(),
                'duration': order.duration,
                'story_manager_id': order.story_manager.id if order.story_manager else None,
                'story_manager_name': order.story_manager.full_name if order.story_manager else None,
            })
        except Order.DoesNotExist:
            return JsonResponse({'error': 'Заказ не найден'}, status=404)


class OrderUpdateView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            order = get_object_or_404(Order, id=order_id)
            
            client_id = request.POST.get('client_id')
            date = request.POST.get('date')
            address = request.POST.get('address', '').strip()
            contact_phone = request.POST.get('contact_phone', '').strip()
            contact_telegram = request.POST.get('contact_telegram', '').strip()
            setup_time = request.POST.get('setup_time', '').strip()
            dressing_room_comment = request.POST.get('dressing_room_comment', '').strip()
            meal_comment = request.POST.get('meal_comment', '').strip()
            concept = request.POST.get('concept', '').strip()
            tech_lamps = request.POST.get('tech_lamps') == 'on'
            tech_laser = request.POST.get('tech_laser') == 'on'
            tech_hazer = request.POST.get('tech_hazer') == 'on'
            tech_grid = request.POST.get('tech_grid') == 'on'
            tech_projection = request.POST.get('tech_projection') == 'on'
            tech_comment = request.POST.get('tech_comment', '').strip()
            venue_comment = request.POST.get('venue_comment', '').strip()
            props_comment = request.POST.get('props_comment', '').strip()
            manager_id = request.POST.get('manager_id')
            cost = request.POST.get('cost', '').strip()
            payment_method = request.POST.get('payment_method', '').strip()
            status = request.POST.get('status', 'request')
            duration = request.POST.get('duration', 1)
            story_manager_id = request.POST.get('story_manager_id')
            
            if not client_id:
                return JsonResponse({'error': 'Клиент обязателен для заполнения'}, status=400)
            
            if not address:
                return JsonResponse({'error': 'Адрес обязателен для заполнения'}, status=400)
            
            if not date:
                return JsonResponse({'error': 'Дата обязательна для заполнения'}, status=400)
            
            if not manager_id:
                return JsonResponse({'error': 'Менеджер обязателен для заполнения'}, status=400)
            
            client = get_object_or_404(Client, id=client_id)
            manager = get_object_or_404(Employee, id=manager_id)
            
            order.client = client
            order.date = date
            order.address = address
            order.contact_phone = contact_phone
            order.contact_telegram = contact_telegram
            order.setup_time = setup_time
            order.dressing_room_comment = dressing_room_comment
            order.meal_comment = meal_comment
            order.concept = concept
            order.tech_lamps = tech_lamps
            order.tech_laser = tech_laser
            order.tech_hazer = tech_hazer
            order.tech_grid = tech_grid
            order.tech_projection = tech_projection
            order.tech_comment = tech_comment
            order.venue_comment = venue_comment
            order.props_comment = props_comment
            order.manager = manager
            order.cost = cost or '—'
            order.payment_method = payment_method
            order.status = status
            order.duration = int(duration)
            
            if story_manager_id:
                order.story_manager = get_object_or_404(Employee, id=story_manager_id)
            else:
                order.story_manager = None
            
            order.save()
            
            return JsonResponse({
                'success': True,
                'order': {
                    'id': order.id,
                    'address': order.address,
                    'date': order.date.strftime('%Y-%m-%d'),
                    'client': order.client.full_name,
                    'client_id': order.client.id,
                    'cost': order.cost,
                    'status': order.status,
                    'status_display': order.get_status_display(),
                    'manager': order.manager.full_name,
                    'manager_id': order.manager.id
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        orders = Order.objects.select_related('client', 'manager').order_by('-date', '-created_at')
        
        search = request.GET.get('search', '')
        status = request.GET.get('status', 'all')
        
        if search:
            orders = orders.filter(
                Q(address__icontains=search) |
                Q(client__full_name__icontains=search) |
                Q(manager__full_name__icontains=search)
            )
        
        if status != 'all':
            orders = orders.filter(status=status)
        
        orders_list = []
        for order in orders:
            orders_list.append({
                'id': order.id,
                'address': order.address,
                'date': order.date.strftime('%Y-%m-%d'),
                'client': order.client.full_name,
                'client_id': order.client.id,
                'cost': order.cost,
                'status': order.status,
                'status_display': order.get_status_display(),
                'manager': order.manager.full_name,
                'manager_id': order.manager.id
            })
        
        return JsonResponse({'orders': orders_list})


class ScheduleView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        return render(request, "schedule.html")

    def post(self, request):
        return HttpResponse("POST request successfully!")


class LoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect('index')
        return render(request, "login.html")
    
    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        if not username or not password:
            messages.error(request, 'Пожалуйста, заполните все поля')
            return redirect('login')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            request.session.set_expiry(1209600)
            return redirect("index")
        else:
            messages.error(request, 'Неверное имя пользователя или пароль')
            return redirect("login")


class LogoutView(View):
    def get(self, request):
        if request.user.is_authenticated:
            logout(request)
        return redirect("login")
    
    def post(self, request):
        return self.get(request)