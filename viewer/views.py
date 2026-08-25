from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate, logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from .models import Client, Agency, Order, Employee


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
                employee = Employee.objects.get(id=request.user.id)
            except Employee.DoesNotExist:
                return JsonResponse({'error': 'Сотрудник не найден'}, status=400)
            
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


class OrdersView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        return render(request, "orders.html")

    def post(self, request):
        return HttpResponse("POST request successfully!")


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
            username = request.user.username
            logout(request)
        return redirect("login")
    
    def post(self, request):
        return self.get(request)


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