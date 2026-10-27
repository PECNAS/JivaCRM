from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db.models import Q
from django.contrib import messages
from datetime import datetime
from ..models import Employee, Role, Service, ArtistCard, OrderEmployee


def serialize_artist_card(card):
    if card is None:
        return None
    return {
        'id': card.id,
        'weight': card.weight or '',
        'height': card.height or '',
        'shoe_size': card.shoe_size or '',
        'skills_text': card.skills_text or '',
        'comment': card.comment or '',
        'known_shows': [{'id': s.id, 'name': s.name} for s in card.known_shows.all()],
    }


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

        employees = Employee.objects.filter(is_active=True, user__is_active=True).select_related('user').order_by('full_name')

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
        page_obj = paginator.get_page(request.GET.get('page', 1))

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
            role = request.POST.get('role', 'artist')
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'

            passport_series = request.POST.get('passport_series', '').strip()
            passport_number = request.POST.get('passport_number', '').strip()
            passport_issued_by = request.POST.get('passport_issued_by', '').strip()
            passport_issued_date = request.POST.get('passport_issued_date', '').strip()
            passport_department_code = request.POST.get('passport_department_code', '').strip()
            passport_registration = request.POST.get('passport_registration', '').strip()
            passport_inn = request.POST.get('passport_inn', '').strip()
            passport_snils = request.POST.get('passport_snils', '').strip()

            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not password:
                return JsonResponse({'error': 'Пароль обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)

            if role == 'senior_admin' and employee.role != 'senior_admin':
                return JsonResponse({'error': 'Только старший администратор может назначать эту роль'}, status=403)

            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=full_name,
                is_active=is_active,
                is_staff=True
            )

            issued_date_obj = None
            if passport_issued_date:
                try:
                    issued_date_obj = datetime.strptime(passport_issued_date, '%Y-%m-%d').date()
                except ValueError:
                    issued_date_obj = None

            employee_obj = Employee.objects.create(
                user=user,
                full_name=full_name,
                role=role,
                phone=phone,
                telegram_username=telegram,
                is_active=is_active,
                passport_series=passport_series,
                passport_number=passport_number,
                passport_issued_by=passport_issued_by,
                passport_issued_date=issued_date_obj,
                passport_department_code=passport_department_code,
                passport_registration=passport_registration,
                passport_inn=passport_inn,
                passport_snils=passport_snils,
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
                    'is_active': employee_obj.is_active,
                    'is_artist': employee_obj.role == 'artist',
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
            employee_obj = Employee.objects.select_related('user').get(id=employee_id)

            card = None
            if employee_obj.role == 'artist':
                card_obj, _ = ArtistCard.objects.get_or_create(employee=employee_obj)
                card = serialize_artist_card(card_obj)

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
                'passport_series': employee_obj.passport_series or '',
                'passport_number': employee_obj.passport_number or '',
                'passport_issued_by': employee_obj.passport_issued_by or '',
                'passport_issued_date': employee_obj.passport_issued_date.strftime('%Y-%m-%d') if employee_obj.passport_issued_date else '',
                'passport_department_code': employee_obj.passport_department_code or '',
                'passport_registration': employee_obj.passport_registration or '',
                'passport_inn': employee_obj.passport_inn or '',
                'passport_snils': employee_obj.passport_snils or '',
                'is_artist': employee_obj.role == 'artist',
                'artist_card': card,
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
            employee_obj = get_object_or_404(Employee.objects.select_related('user'), id=employee_id)

            username = request.POST.get('username', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            role = request.POST.get('role', 'artist')
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'
            password = request.POST.get('password', '').strip()

            passport_series = request.POST.get('passport_series', '').strip()
            passport_number = request.POST.get('passport_number', '').strip()
            passport_issued_by = request.POST.get('passport_issued_by', '').strip()
            passport_issued_date = request.POST.get('passport_issued_date', '').strip()
            passport_department_code = request.POST.get('passport_department_code', '').strip()
            passport_registration = request.POST.get('passport_registration', '').strip()
            passport_inn = request.POST.get('passport_inn', '').strip()
            passport_snils = request.POST.get('passport_snils', '').strip()

            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)

            if User.objects.filter(username=username).exclude(id=employee_obj.user.id).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)

            if role == 'senior_admin' and current_employee.role != 'senior_admin':
                return JsonResponse({'error': 'Только старший администратор может назначать эту роль'}, status=403)

            user = employee_obj.user
            user.username = username
            user.first_name = full_name
            user.is_active = is_active
            if password:
                user.set_password(password)
            user.save()

            issued_date_obj = employee_obj.passport_issued_date
            if passport_issued_date:
                try:
                    issued_date_obj = datetime.strptime(passport_issued_date, '%Y-%m-%d').date()
                except ValueError:
                    pass
            elif passport_issued_date == '':
                issued_date_obj = None

            employee_obj.full_name = full_name
            employee_obj.role = role
            employee_obj.phone = phone
            employee_obj.telegram_username = telegram
            employee_obj.is_active = is_active
            employee_obj.passport_series = passport_series
            employee_obj.passport_number = passport_number
            employee_obj.passport_issued_by = passport_issued_by
            employee_obj.passport_issued_date = issued_date_obj
            employee_obj.passport_department_code = passport_department_code
            employee_obj.passport_registration = passport_registration
            employee_obj.passport_inn = passport_inn
            employee_obj.passport_snils = passport_snils
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
                    'is_active': employee_obj.is_active,
                    'is_artist': employee_obj.role == 'artist',
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

            if employee_obj.role == 'senior_admin' and current_employee.role != 'senior_admin':
                return JsonResponse({'error': 'Нельзя удалить старшего администратора'}, status=403)

            user = employee_obj.user

            if user.is_superuser:
                return JsonResponse({'error': 'Нельзя деактивировать суперпользователя'}, status=400)

            employee_obj.is_active = False
            employee_obj.save(update_fields=['is_active'])

            if not user.is_superuser:
                user.is_active = False
                user.save(update_fields=['is_active'])

            return JsonResponse({'success': True, 'deactivated': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class EmployeeListView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employees = Employee.objects.filter(is_active=True, user__is_active=True).values('id', 'full_name', 'user__username', 'role')
        result = []
        for emp in employees:
            result.append({
                'id': emp['id'],
                'full_name': emp['full_name'],
                'username': emp['user__username'],
                'role': emp['role']
            })
        return JsonResponse({'employees': result})


class ArtistCardUpdateView(View):
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
            if employee_obj.role != 'artist':
                return JsonResponse({'error': 'Карточка доступна только для артистов'}, status=400)

            card, _ = ArtistCard.objects.get_or_create(employee=employee_obj)

            card.weight = request.POST.get('weight', '').strip()
            card.height = request.POST.get('height', '').strip()
            card.shoe_size = request.POST.get('shoe_size', '').strip()
            card.skills_text = request.POST.get('skills_text', '').strip()
            card.comment = request.POST.get('comment', '').strip()
            card.save()

            shows_raw = request.POST.get('known_shows', '')
            if shows_raw:
                try:
                    ids = [int(x) for x in shows_raw.split(',') if x.strip().isdigit()]
                except (ValueError, TypeError):
                    ids = []
                card.known_shows.set(Service.objects.filter(id__in=ids))
            else:
                card.known_shows.clear()

            return JsonResponse({
                'success': True,
                'artist_card': serialize_artist_card(card)
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ArtistCardDetailView(View):
    def get(self, request, employee_id):
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
            if employee_obj.role != 'artist':
                return JsonResponse({'error': 'Карточка доступна только для артистов'}, status=400)

            card, _ = ArtistCard.objects.get_or_create(employee=employee_obj)
            return JsonResponse({
                'success': True,
                'artist_card': serialize_artist_card(card)
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class ServicesForArtistCardView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        services = Service.objects.filter(type='service', is_active=True).order_by('name')
        data = [{'id': s.id, 'name': s.name} for s in services]
        return JsonResponse({'services': data})