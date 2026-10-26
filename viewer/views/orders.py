from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.core.paginator import Paginator
from django.db.models import Q
from django.contrib import messages
from datetime import datetime
import json
from ..models import Order, Client, Employee, OrderEstimate, OrderEmployee, Service, City, CalendarColor


def format_date(date_value):
    if not date_value:
        return ''
    if hasattr(date_value, 'strftime'):
        return date_value.strftime('%Y-%m-%d')
    return str(date_value)


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


class OrdersView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer', 'technician', 'choreographer', 'production']:
                messages.error(request, 'У вас недостаточно прав для просмотра заказов')
                return redirect('index')
        except:
            return redirect('logout')

        orders = Order.objects.select_related('client', 'city', 'manager__user').order_by('-date', '-created_at')

        search_query = request.GET.get('search', '')
        status_filter = request.GET.get('status', 'all')

        if search_query:
            orders = orders.filter(
                Q(name__icontains=search_query) |
                Q(address__icontains=search_query) |
                Q(client__full_name__icontains=search_query) |
                Q(manager__full_name__icontains=search_query)
            )
        if status_filter != 'all':
            orders = orders.filter(status=status_filter)

        paginator = Paginator(orders, 20)
        page_obj = paginator.get_page(request.GET.get('page', 1))

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
            name = request.POST.get('name', '').strip()
            client_id = request.POST.get('client_id')
            date_str = request.POST.get('date', '').strip()

            if not name:
                return JsonResponse({'error': 'Название заказа обязательно для заполнения'}, status=400)
            if not client_id:
                return JsonResponse({'error': 'Заказчик обязателен для заполнения'}, status=400)
            if not date_str:
                return JsonResponse({'error': 'Дата обязательна для заполнения'}, status=400)

            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'error': 'Неверный формат даты'}, status=400)

            client = get_object_or_404(Client, id=client_id)
            default_city = City.objects.filter(name__iexact='Казань').first()

            order = Order.objects.create(
                name=name,
                client=client,
                city=default_city,
                date=date_obj,
                manager=employee,
                status='request'
            )

            return JsonResponse({
                'success': True,
                'order': {
                    'id': order.id,
                    'name': order.name,
                    'date': format_date(order.date),
                    'client': order.client.full_name,
                    'client_id': order.client.id,
                    'status': order.status,
                    'status_display': order.get_status_display(),
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
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer', 'technician', 'choreographer', 'production']:
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            order = Order.objects.select_related('client', 'city', 'manager__user', 'story_manager__user').get(id=order_id)

            estimate_items = []
            for item in order.estimate_items.all():
                estimate_items.append({
                    'service_id': item.service.id if item.service else None,
                    'name': item.service_name,
                    'people_count': item.people_count,
                    'coefficient': float(item.coefficient),
                    'price': float(item.price),
                    'comment': item.comment,
                    'overridden': item.is_overridden,
                })

            employee_items = []
            for item in order.employee_items.all():
                employee_items.append({
                    'employee_id': item.employee.id if item.employee else None,
                    'name': item.employee_name,
                    'role': item.employee_role,
                    'payment': float(item.payment),
                    'comment': item.comment
                })

            return JsonResponse({
                'id': order.id,
                'name': order.name or '',
                'client_id': order.client.id,
                'client_name': order.client.full_name,
                'city_id': order.city.id if order.city else None,
                'city_name': order.city.name if order.city else '',
                'date': format_date(order.date),
                'address': order.address or '',
                'contact_phone': order.contact_phone or '',
                'contact_telegram': order.contact_telegram or '',
                'setup_time': order.setup_time or '',
                'dressing_room_comment': order.dressing_room_comment or '',
                'meal_comment': order.meal_comment or '',
                'concept': order.concept or '',
                'tech_lamps': order.tech_lamps,
                'tech_laser': order.tech_laser,
                'tech_hazer': order.tech_hazer,
                'tech_grid': order.tech_grid,
                'tech_projection': order.tech_projection,
                'tech_comment': order.tech_comment or '',
                'venue_comment': order.venue_comment or '',
                'props_comment': order.props_comment or '',
                'manager_id': order.manager.id if order.manager else None,
                'manager_name': order.manager.full_name if order.manager else '',
                'cost': order.cost or '—',
                'payment_method': order.payment_method or '',
                'payment_method_display': order.get_payment_method_display() if order.payment_method else '',
                'status': order.status,
                'status_display': order.get_status_display(),
                'duration': order.duration,
                'story_manager_id': order.story_manager.id if order.story_manager else None,
                'story_manager_name': order.story_manager.full_name if order.story_manager else None,
                'estimate_items': estimate_items,
                'employee_items': employee_items,
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

            name = request.POST.get('name', '').strip()
            client_id = request.POST.get('client_id')
            date_str = request.POST.get('date', '').strip()
            city_id = request.POST.get('city_id')

            if not client_id:
                return JsonResponse({'error': 'Клиент обязателен для заполнения'}, status=400)
            if not name:
                return JsonResponse({'error': 'Название заказа обязательно для заполнения'}, status=400)

            if date_str:
                try:
                    order.date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    return JsonResponse({'error': 'Неверный формат даты'}, status=400)

            order.name = name
            order.client = get_object_or_404(Client, id=client_id)

            if city_id:
                order.city = City.objects.filter(id=city_id).first()
            else:
                order.city = None

            order.address = request.POST.get('address', '').strip()
            order.contact_phone = request.POST.get('contact_phone', '').strip()
            order.contact_telegram = request.POST.get('contact_telegram', '').strip()
            order.setup_time = request.POST.get('setup_time', '').strip()
            order.dressing_room_comment = request.POST.get('dressing_room_comment', '').strip()
            order.meal_comment = request.POST.get('meal_comment', '').strip()
            order.concept = request.POST.get('concept', '').strip()
            order.tech_lamps = request.POST.get('tech_lamps') == 'on'
            order.tech_laser = request.POST.get('tech_laser') == 'on'
            order.tech_hazer = request.POST.get('tech_hazer') == 'on'
            order.tech_grid = request.POST.get('tech_grid') == 'on'
            order.tech_projection = request.POST.get('tech_projection') == 'on'
            order.tech_comment = request.POST.get('tech_comment', '').strip()
            order.venue_comment = request.POST.get('venue_comment', '').strip()
            order.props_comment = request.POST.get('props_comment', '').strip()
            order.cost = request.POST.get('cost', '').strip() or '—'
            order.payment_method = request.POST.get('payment_method', '').strip()
            order.status = request.POST.get('status', 'request')

            try:
                order.duration = int(request.POST.get('duration', 1))
            except (ValueError, TypeError):
                order.duration = 1

            manager_id = request.POST.get('manager_id')
            if manager_id:
                order.manager = get_object_or_404(Employee, id=manager_id)

            story_manager_id = request.POST.get('story_manager_id')
            if story_manager_id:
                order.story_manager = get_object_or_404(Employee, id=story_manager_id)
            else:
                order.story_manager = None

            order.save()

            estimate_items_str = request.POST.get('estimate_items', '')
            if estimate_items_str:
                try:
                    estimate_items = json.loads(estimate_items_str)
                    order.estimate_items.all().delete()
                    for item in estimate_items:
                        service_id = item.get('service_id')
                        service = None
                        if service_id:
                            service = Service.objects.filter(id=service_id).first()
                        OrderEstimate.objects.create(
                            order=order,
                            service=service,
                            service_name=item.get('name', ''),
                            people_count=item.get('people_count', 0),
                            coefficient=item.get('coefficient', 1),
                            price=item.get('price', 0),
                            comment=item.get('comment', ''),
                            is_overridden=item.get('overridden', False)
                        )
                except (json.JSONDecodeError, TypeError):
                    pass

            employee_items_str = request.POST.get('employee_items', '')
            if employee_items_str:
                try:
                    employee_items = json.loads(employee_items_str)
                    order.employee_items.all().delete()
                    for item in employee_items:
                        employee_id = item.get('employee_id')
                        emp = None
                        if employee_id:
                            emp = Employee.objects.filter(id=employee_id).first()
                        OrderEmployee.objects.create(
                            order=order,
                            employee=emp,
                            employee_name=item.get('name', ''),
                            employee_role=item.get('role', ''),
                            payment=item.get('payment', 0),
                            comment=item.get('comment', '')
                        )
                except (json.JSONDecodeError, TypeError):
                    pass

            return JsonResponse({
                'success': True,
                'order': {
                    'id': order.id,
                    'name': order.name,
                    'address': order.address,
                    'date': format_date(order.date),
                    'client': order.client.full_name,
                    'client_id': order.client.id,
                    'city_id': order.city.id if order.city else None,
                    'city_name': order.city.name if order.city else '',
                    'cost': order.cost,
                    'status': order.status,
                    'status_display': order.get_status_display(),
                    'manager': order.manager.full_name if order.manager else '',
                    'manager_id': order.manager.id if order.manager else None
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderDeleteView(View):
    def post(self, request, order_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав для удаления заказов'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            order = get_object_or_404(Order, id=order_id)
            order.delete()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class OrderListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_orders() and employee.role not in ['artist', 'trainer', 'technician', 'choreographer', 'production']:
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        orders = Order.objects.select_related('client', 'city', 'manager__user').order_by('-date', '-created_at')

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
            services_list = []
            for item in order.estimate_items.all():
                if item.service_name:
                    services_list.append(item.service_name)

            orders_list.append({
                'id': order.id,
                'name': order.name or '—',
                'address': order.address or '',
                'date': format_date(order.date),
                'client': order.client.full_name,
                'client_id': order.client.id,
                'city_id': order.city.id if order.city else None,
                'city_name': order.city.name if order.city else '',
                'cost': order.cost or '—',
                'status': order.status,
                'status_display': order.get_status_display(),
                'manager': order.manager.full_name if order.manager else '',
                'manager_id': order.manager.id if order.manager else None,
                'services': services_list,
                'updated_at': order.updated_at.isoformat() if order.updated_at else None,
            })

        return JsonResponse({
            'orders': orders_list,
            'colors': serialize_calendar_colors(),
        })


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
                'date': format_date(order.date),
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
                'services': services_list,
                'updated_at': order.updated_at.isoformat() if order.updated_at else None,
            })

        return JsonResponse({
            'orders': orders_list,
            'colors': serialize_calendar_colors(),
        })


class CityListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        cities = City.objects.select_related('group').order_by('name')
        data = []
        for c in cities:
            data.append({
                'id': c.id,
                'name': c.name,
                'group_id': c.group.id if c.group else None,
                'group_name': c.group.name if c.group else None,
                'salary_bonus': float(c.group.salary_bonus) if c.group else 0,
            })
        return JsonResponse({'cities': data})


class ServicesFlatListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        services = Service.objects.filter(type='service', is_active=True).order_by('name')
        data = []
        for s in services:
            data.append({
                'id': s.id,
                'name': s.name,
                'parent_name': s.parent.name if s.parent else None,
                'artist_min': s.artist_min,
                'artist_max': s.artist_max,
                'artist_rate': float(s.artist_rate),
                'technician_min': s.technician_min,
                'technician_max': s.technician_max,
                'technician_rate': float(s.technician_rate),
                'driver_min': s.driver_min,
                'driver_max': s.driver_max,
                'driver_rate': float(s.driver_rate),
            })
        return JsonResponse({'services': data})


class ServicePriceForOrderView(View):
    def get(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            service = get_object_or_404(Service, id=service_id)
            city_id = request.GET.get('city_id')
            people_count_param = request.GET.get('people_count')

            city = None
            if city_id:
                city = City.objects.filter(id=city_id).first()
            if city is None:
                city = City.objects.filter(name__iexact='Казань').first()

            total_people = None
            if people_count_param is not None and people_count_param != '':
                try:
                    total_people = int(people_count_param)
                except (ValueError, TypeError):
                    total_people = None

            if service.overridden_total is not None:
                price = float(service.overridden_total)
            else:
                calc = service.calculate_for_city(city)
                price = calc['total'] if calc else 0
                if total_people is not None and calc:
                    extra_people = max(0, total_people - calc['total_people'])
                    if extra_people > 0:
                        salary_bonus = calc['salary_bonus']
                        avg_rate = 0
                        if service.artist_min > 0:
                            avg_rate = float(service.artist_rate) + salary_bonus
                        elif service.technician_min > 0:
                            avg_rate = float(service.technician_rate) + salary_bonus
                        elif service.driver_min > 0:
                            avg_rate = float(service.driver_rate) + salary_bonus
                        price += extra_people * avg_rate

            return JsonResponse({
                'success': True,
                'price': price,
                'city_id': city.id if city else None,
                'city_name': city.name if city else None,
                'total_people': total_people,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ServiceEmployeesForOrderView(View):
    def get(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        try:
            service = get_object_or_404(Service, id=service_id)
            city_id = request.GET.get('city_id')

            city = None
            if city_id:
                city = City.objects.filter(id=city_id).first()
            if city is None:
                city = City.objects.filter(name__iexact='Казань').first()

            salary_bonus = 0
            if city and city.group:
                salary_bonus = float(city.group.salary_bonus)

            artists_rate = float(service.artist_rate) + salary_bonus
            technicians_rate = float(service.technician_rate) + salary_bonus
            drivers_rate = float(service.driver_rate) + salary_bonus

            return JsonResponse({
                'success': True,
                'artist_rate': artists_rate,
                'technician_rate': technicians_rate,
                'driver_rate': drivers_rate,
                'artist_min': service.artist_min,
                'artist_max': service.artist_max,
                'technician_min': service.technician_min,
                'technician_max': service.technician_max,
                'driver_min': service.driver_min,
                'driver_max': service.driver_max,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)