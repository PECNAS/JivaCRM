from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from ..models import Service, Employee, City


def serialize_service(service, full=True):
    data = {
        'id': service.id,
        'name': service.name,
        'type': service.type,
        'parent_id': service.parent.id if service.parent else None,
        'parent_name': service.parent.name if service.parent else None,
        'is_active': service.is_active,
        'order': service.order,
        'created_at': service.created_at.strftime('%d.%m.%Y'),
        'updated_at': service.updated_at.strftime('%d.%m.%Y'),
    }
    if full:
        data.update({
            'description': service.description or '',
            'duration': service.duration or '',
            'media_url': service.media_url or '',
            'artist_min': service.artist_min,
            'artist_max': service.artist_max,
            'artist_rate': float(service.artist_rate),
            'technician_min': service.technician_min,
            'technician_max': service.technician_max,
            'technician_rate': float(service.technician_rate),
            'driver_min': service.driver_min,
            'driver_max': service.driver_max,
            'driver_rate': float(service.driver_rate),
            'amortization': float(service.amortization),
            'logist': float(service.logist),
            'laser': float(service.laser),
            'manager_salary': float(service.manager_salary),
            'unforeseen': float(service.unforeseen),
            'extra_margin': float(service.extra_margin),
            'payment_method': service.payment_method,
            'overridden_total': float(service.overridden_total) if service.overridden_total is not None else None,
        })
    return data


class ServicesView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                messages.error(request, 'У вас недостаточно прав для просмотра услуг')
                return redirect('index')
        except:
            return redirect('logout')
        return render(request, "services.html")


class ServiceTreeView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        def build_tree(node):
            children = Service.objects.filter(parent=node).order_by('order', 'name')
            result = []
            for child in children:
                result.append({
                    'id': child.id,
                    'name': child.name,
                    'type': child.type,
                    'parent_id': child.parent.id if child.parent else None,
                    'children': build_tree(child),
                })
            return result

        return JsonResponse({'tree': build_tree(None)})


class ServiceCreateView(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            parent_id = request.POST.get('parent_id')
            type_ = request.POST.get('type', 'category')
            name = request.POST.get('name', 'Новый каталог' if type_ == 'category' else 'Новая услуга')

            parent = None
            if parent_id:
                parent = get_object_or_404(Service, id=parent_id)

            service = Service.objects.create(
                name=name,
                type=type_,
                parent=parent,
                created_by=employee
            )

            return JsonResponse({
                'success': True,
                'service': serialize_service(service)
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ServiceDetailView(View):
    def get(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            service = get_object_or_404(Service, id=service_id)
            return JsonResponse(serialize_service(service, full=True))
        except Service.DoesNotExist:
            return JsonResponse({'error': 'Услуга не найдена'}, status=404)


class ServiceUpdateView(View):
    def post(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            service = get_object_or_404(Service, id=service_id)

            if 'name' in request.POST:
                service.name = request.POST.get('name', '').strip() or service.name
            if 'description' in request.POST:
                service.description = request.POST.get('description', '')
            if 'duration' in request.POST:
                service.duration = request.POST.get('duration', '')
            if 'media_url' in request.POST:
                service.media_url = request.POST.get('media_url', '')

            int_fields = [
                'artist_min', 'artist_max',
                'technician_min', 'technician_max',
                'driver_min', 'driver_max',
            ]
            for field in int_fields:
                if field in request.POST:
                    try:
                        setattr(service, field, int(request.POST.get(field) or 0))
                    except (ValueError, TypeError):
                        pass

            decimal_fields = [
                'artist_rate', 'technician_rate', 'driver_rate',
                'amortization', 'logist', 'laser', 'manager_salary',
                'unforeseen', 'extra_margin',
            ]
            for field in decimal_fields:
                if field in request.POST:
                    try:
                        setattr(service, field, float(request.POST.get(field) or 0))
                    except (ValueError, TypeError):
                        pass

            if 'payment_method' in request.POST:
                pm = request.POST.get('payment_method')
                if pm in ['cash', 'self', 'ip']:
                    service.payment_method = pm

            if 'overridden_total' in request.POST:
                raw = request.POST.get('overridden_total')
                if raw in (None, '', 'null'):
                    service.overridden_total = None
                else:
                    try:
                        service.overridden_total = float(raw)
                    except (ValueError, TypeError):
                        service.overridden_total = None

            service.save()

            return JsonResponse({
                'success': True,
                'service': serialize_service(service, full=True)
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ServiceDeleteView(View):
    def post(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            service = get_object_or_404(Service, id=service_id)
            service.delete()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ServiceCalculationView(View):
    def get(self, request, service_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        try:
            employee = request.user.employee_profile
            if not employee.can_manage_services():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        try:
            service = get_object_or_404(Service, id=service_id)
            city_id = request.GET.get('city_id')
            city = None
            if city_id:
                city = City.objects.filter(id=city_id).first()
            if city is None:
                city = City.objects.filter(name__iexact='Казань').first()

            result = service.calculate_for_city(city)
            return JsonResponse({'success': True, 'calculation': result})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


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