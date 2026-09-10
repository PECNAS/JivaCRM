from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.core.paginator import Paginator
from django.db.models import Q
from django.contrib import messages
from ..models import Order, Client, Employee


class OrdersView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer']:
                messages.error(request, 'У вас недостаточно прав для просмотра заказов')
                return redirect('index')
        except:
            return redirect('logout')
        
        orders = Order.objects.select_related('client', 'manager__user', 'story_manager__user').order_by('-date', '-created_at')
        
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
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для создания заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
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
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer']:
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        try:
            order = Order.objects.select_related('client', 'manager__user', 'story_manager__user').get(id=order_id)
            
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
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для редактирования заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
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
        
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer']:
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        orders = Order.objects.select_related('client', 'manager__user').order_by('-date', '-created_at')
        
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