from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Count, Q
from django.core.paginator import Paginator
from django.contrib import messages
from ..models import Client, Agency, Order, Employee, Role


class ClientsView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                messages.error(request, 'У вас недостаточно прав для просмотра клиентов')
                return redirect('index')
        except:
            return redirect('logout')
        
        clients = Client.objects.annotate(
            orders_count=Count('orders')
        ).select_related('agency', 'created_by__user').order_by('full_name')
        
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
        
        agencies = Agency.objects.all()
        
        context = {
            'clients': page_obj,
            'agencies': agencies,
            'search_query': search_query,
            'rating_filter': rating_filter,
        }
        return render(request, "clients.html", context)

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            full_name = request.POST.get('full_name', '').strip()
            phone = request.POST.get('phone', '').strip()
            client_type = request.POST.get('client_type', 'organizer')
            agency_id = request.POST.get('agency_id')
            telegram = request.POST.get('telegram', '').strip()
            email = request.POST.get('email', '').strip()
            city = request.POST.get('city', '').strip()
            rating = request.POST.get('rating', 'medium')
            
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            if not phone:
                return JsonResponse({'error': 'Телефон обязателен для заполнения'}, status=400)
            
            phone_digits = ''.join(filter(str.isdigit, phone))
            if len(phone_digits) != 11:
                return JsonResponse({'error': 'Номер телефона должен содержать 11 цифр'}, status=400)
            
            if client_type == 'agency' and not agency_id:
                return JsonResponse({'error': 'Для клиента типа "Агентство" необходимо выбрать агентство'}, status=400)
            
            agency = None
            if agency_id:
                agency = get_object_or_404(Agency, id=agency_id)
            
            try:
                employee_obj = Employee.objects.get(user=request.user)
            except Employee.DoesNotExist:
                employee_obj = Employee.objects.create(
                    user=request.user,
                    full_name=request.user.get_full_name() or request.user.username,
                    role='manager',
                    is_active=True
                )
            
            client = Client.objects.create(
                full_name=full_name,
                phone=phone,
                client_type=client_type,
                agency=agency,
                telegram_username=telegram,
                email=email,
                city=city,
                rating=rating,
                created_by=employee_obj
            )
            
            return JsonResponse({
                'success': True,
                'client': {
                    'id': client.id,
                    'full_name': client.full_name,
                    'phone': client.phone,
                    'client_type': client.client_type,
                    'client_type_display': client.get_client_type_display(),
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
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            client = Client.objects.annotate(
                orders_count=Count('orders')
            ).select_related('agency', 'created_by__user').get(id=client_id)
            
            orders = Order.objects.filter(client=client).select_related('manager__user')
            
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
                'client_type_key': client.client_type,
                'client_type_display': client.get_client_type_display(),
                'agency_id': client.agency.id if client.agency else None,
                'agency': client.agency.name if client.agency else None,
                'telegram': client.telegram_username or '—',
                'rating': client.rating,
                'rating_key': client.rating,
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
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            client = get_object_or_404(Client, id=client_id)
            
            full_name = request.POST.get('full_name', '').strip()
            phone = request.POST.get('phone', '').strip()
            client_type = request.POST.get('client_type', 'organizer')
            agency_id = request.POST.get('agency_id')
            telegram = request.POST.get('telegram', '').strip()
            email = request.POST.get('email', '').strip()
            city = request.POST.get('city', '').strip()
            rating = request.POST.get('rating', 'medium')
            
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)
            if not phone:
                return JsonResponse({'error': 'Телефон обязателен для заполнения'}, status=400)
            
            phone_digits = ''.join(filter(str.isdigit, phone))
            if len(phone_digits) != 11:
                return JsonResponse({'error': 'Номер телефона должен содержать 11 цифр'}, status=400)
            
            if client_type == 'agency' and not agency_id:
                return JsonResponse({'error': 'Для клиента типа "Агентство" необходимо выбрать агентство'}, status=400)
            
            agency = None
            if agency_id:
                agency = get_object_or_404(Agency, id=agency_id)
            
            client.full_name = full_name
            client.phone = phone
            client.client_type = client_type
            client.agency = agency
            client.telegram_username = telegram
            client.email = email
            client.city = city
            client.rating = rating
            client.save()
            
            return JsonResponse({
                'success': True,
                'client': {
                    'id': client.id,
                    'full_name': client.full_name,
                    'phone': client.phone,
                    'client_type': client.client_type,
                    'client_type_display': client.get_client_type_display(),
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
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
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
                'client_type': client.client_type,
                'client_type_display': client.get_client_type_display(),
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


class AgencyCreateView(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_clients():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            name = request.POST.get('name', '').strip()
            
            if not name:
                return JsonResponse({'error': 'Название агентства обязательно для заполнения'}, status=400)
            
            agency, created = Agency.objects.get_or_create(name=name)
            
            if not created:
                return JsonResponse({'error': 'Агентство с таким названием уже существует'}, status=400)
            
            return JsonResponse({
                'success': True,
                'agency': {
                    'id': agency.id,
                    'name': agency.name
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)