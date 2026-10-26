import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from ..models import Service, ServiceStaffRow, City


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
            'artist_rate': float(service.artist_rate),
            'staff_rows': [
                {'id': row.id, 'artist_count': row.artist_count, 'cost': float(row.cost)}
                for row in service.staff_rows.all()
            ],
        })
    return data


def parse_decimal(value):
    try:
        number = Decimal(str(value).strip().replace(',', '.'))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not number.is_finite():
        return None
    return number.quantize(Decimal('0.01'))


def parse_non_negative_decimal(value):
    number = parse_decimal(value)
    return number if number is not None and number >= 0 else None


def parse_positive_decimal(value):
    number = parse_decimal(value)
    return number if number is not None and number > 0 else None


def parse_positive_int(value):
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def parse_staff_rows(raw):
    try:
        items = json.loads(raw or '[]')
    except (TypeError, ValueError):
        return None
    if not isinstance(items, list):
        return None
    rows = []
    for item in items:
        if not isinstance(item, dict):
            return None
        count = parse_positive_int(item.get('artist_count'))
        cost = parse_positive_decimal(item.get('cost'))
        if count is None or cost is None:
            return None
        rows.append((count, cost))
    return rows


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
                service.duration = request.POST.get('duration', '').strip()
            if 'media_url' in request.POST:
                service.media_url = request.POST.get('media_url', '').strip()

            if 'artist_rate' in request.POST:
                rate = parse_non_negative_decimal(request.POST.get('artist_rate'))
                if rate is None:
                    return JsonResponse({'error': 'Ставка артиста должна быть неотрицательным числом'}, status=400)
                service.artist_rate = rate

            staff_rows = None
            if 'staff_rows' in request.POST:
                staff_rows = parse_staff_rows(request.POST.get('staff_rows'))
                if staff_rows is None:
                    return JsonResponse({'error': 'Значения персонала должны быть положительными числами'}, status=400)

            with transaction.atomic():
                service.save()
                if staff_rows is not None:
                    service.staff_rows.all().delete()
                    ServiceStaffRow.objects.bulk_create([
                        ServiceStaffRow(service=service, artist_count=count, cost=cost, order=index)
                        for index, (count, cost) in enumerate(staff_rows)
                    ])

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