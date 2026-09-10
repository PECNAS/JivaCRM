from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q
from ..models import Service, Employee


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
                    'children': build_tree(child),
                    'data': {
                        'description': child.description,
                        'price': str(child.price) if child.price else None,
                        'duration': child.duration,
                        'is_active': child.is_active,
                    }
                })
            return result
        
        root_services = Service.objects.filter(parent=None).order_by('order', 'name')
        tree = build_tree(None) if not root_services else build_tree(None)
        
        return JsonResponse({'tree': tree})


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
            type = request.POST.get('type', 'category')
            name = request.POST.get('name', 'Новый каталог' if type == 'category' else 'Новая услуга')
            
            parent = None
            if parent_id:
                parent = get_object_or_404(Service, id=parent_id)
            
            service = Service.objects.create(
                name=name,
                type=type,
                parent=parent,
                created_by=employee
            )
            
            return JsonResponse({
                'success': True,
                'service': {
                    'id': service.id,
                    'name': service.name,
                    'type': service.type,
                    'parent_id': service.parent.id if service.parent else None,
                    'data': {
                        'description': service.description,
                        'price': str(service.price) if service.price else None,
                        'duration': service.duration,
                        'is_active': service.is_active,
                    }
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


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
            
            name = request.POST.get('name')
            description = request.POST.get('description', '')
            price = request.POST.get('price')
            duration = request.POST.get('duration', '')
            is_active = request.POST.get('is_active') == 'true' or request.POST.get('is_active') == 'on'
            parent_id = request.POST.get('parent_id')
            
            if name:
                service.name = name
            
            service.description = description
            service.duration = duration
            service.is_active = is_active
            
            if price:
                try:
                    service.price = float(price)
                except:
                    pass
            else:
                service.price = None
            
            if parent_id:
                service.parent = get_object_or_404(Service, id=parent_id)
            else:
                service.parent = None
            
            service.save()
            
            return JsonResponse({
                'success': True,
                'service': {
                    'id': service.id,
                    'name': service.name,
                    'type': service.type,
                    'parent_id': service.parent.id if service.parent else None,
                    'data': {
                        'description': service.description,
                        'price': str(service.price) if service.price else None,
                        'duration': service.duration,
                        'is_active': service.is_active,
                    }
                }
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
            
            return JsonResponse({
                'id': service.id,
                'name': service.name,
                'type': service.type,
                'parent_id': service.parent.id if service.parent else None,
                'parent_name': service.parent.name if service.parent else None,
                'data': {
                    'description': service.description,
                    'price': str(service.price) if service.price else None,
                    'duration': service.duration,
                    'is_active': service.is_active,
                },
                'created_at': service.created_at.strftime('%d.%m.%Y'),
                'updated_at': service.updated_at.strftime('%d.%m.%Y'),
            })
        except Service.DoesNotExist:
            return JsonResponse({'error': 'Услуга не найдена'}, status=404)