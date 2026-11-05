from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q
from django.contrib import messages
from datetime import datetime
from ..models import (
    Employee, Role, Service, ArtistCard, EmployeeDocument, OrderEmployee, resolve_availability,
    ROLE_CHOICES, ROLE_LABELS, ROLE_ARTIST, ROLE_SENIOR_ADMIN, ARTIST_ROLES, normalize_text,
)
from .helpers import role_label, format_date_short


EMPLOYEES_PAGE_SIZE = 50


def parse_int(value):
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None

    return result if result > 0 else None


def normalize_phone_display(value):
    digits = ''.join(filter(str.isdigit, value or ''))

    if len(digits) == 11 and digits[0] in ('7', '8'):
        digits = digits[1:]

    if len(digits) != 10:
        return value or ''

    return f'+7 ({digits[0:3]}) {digits[3:6]}-{digits[6:8]}-{digits[8:10]}'


def parse_request_date(value):
    if not value:
        return None

    try:
        return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def parse_roles(request):
    codes = []

    raw_values = request.POST.getlist('roles')

    if not raw_values:
        raw_values = request.POST.get('roles', '').split(',')

    for raw_value in raw_values:
        for part in str(raw_value).split(','):
            code = part.strip()

            if code and code in ROLE_LABELS and code not in codes:
                codes.append(code)

    primary = request.POST.get('role', '').strip()

    if primary not in ROLE_LABELS:
        primary = codes[0] if codes else ROLE_ARTIST

    if primary not in codes:
        codes.insert(0, primary)

    return primary, codes


def sync_employee_roles(employee_obj, codes):
    objects = []

    for code in codes:
        label = ROLE_LABELS.get(code)

        if not label:
            continue

        role_obj = Role.objects.filter(code=code).first()

        if role_obj is None:
            role_obj = Role.objects.create(name=label, code=code, is_system=True)

        objects.append(role_obj)

    employee_obj.roles.set(objects)


def serialize_employee(employee_obj, with_card=False):
    data = {
        'id': employee_obj.id,
        'username': employee_obj.user.username,
        'full_name': employee_obj.full_name,
        'nickname': employee_obj.nickname or '',
        'display_name': employee_obj.display_name,
        'role': employee_obj.role,
        'role_label': role_label(employee_obj.role),
        'role_display': role_label(employee_obj.role),
        'role_codes': employee_obj.role_codes(),
        'phone': normalize_phone_display(employee_obj.phone),
        'telegram': employee_obj.telegram_username or '',
        'is_active': employee_obj.is_active,
        'is_artist': employee_obj.role in ARTIST_ROLES,
        'rzd_bonus_number': employee_obj.rzd_bonus_number or '',
        'instagram': employee_obj.instagram or '',
        'international_passport_series': employee_obj.international_passport_series or '',
        'international_passport_number': employee_obj.international_passport_number or '',
        'passport_series': employee_obj.passport_series or '',
        'passport_number': employee_obj.passport_number or '',
        'passport_issued_by': employee_obj.passport_issued_by or '',
        'passport_issued_date': employee_obj.passport_issued_date.strftime('%Y-%m-%d') if employee_obj.passport_issued_date else '',
        'passport_department_code': employee_obj.passport_department_code or '',
        'passport_registration': employee_obj.passport_registration or '',
        'passport_inn': employee_obj.passport_inn or '',
        'passport_snils': employee_obj.passport_snils or '',
    }

    if with_card:
        card = None

        if employee_obj.role in ARTIST_ROLES:
            card_obj, _ = ArtistCard.objects.get_or_create(employee=employee_obj)
            card = serialize_artist_card(card_obj)

        data['artist_card'] = card
        data['date_joined'] = employee_obj.user.date_joined.strftime('%d.%m.%Y')
        data['last_login'] = employee_obj.user.last_login.strftime('%d.%m.%Y %H:%M') if employee_obj.user.last_login else None

    return data


def serialize_employee_documents(employee_obj):
    documents = []

    for item in employee_obj.documents.all():
        documents.append({
            'id': item.id,
            'kind': item.kind,
            'kind_display': item.get_kind_display(),
            'url': item.file.url if item.file else '',
            'title': item.title or '',
            'uploaded_at': item.created_at.strftime('%d.%m.%Y'),
        })

    return documents


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

        employees = Employee.objects.filter(is_active=True, user__is_active=True).select_related('user').prefetch_related('roles').order_by('full_name')

        search_query = request.GET.get('search', '')
        role_filter = request.GET.get('role', 'all')

        if search_query:
            employees = employees.filter(
                Q(full_name__icontains=search_query) |
                Q(nickname__icontains=search_query) |
                Q(user__username__icontains=search_query) |
                Q(phone__icontains=search_query)
            )

        if role_filter != 'all':
            employees = employees.filter(role=role_filter)

        total = employees.count()

        context = {
            'employee': employee,
            'employees': employees[:EMPLOYEES_PAGE_SIZE],
            'has_more': total > EMPLOYEES_PAGE_SIZE,
            'employees_total': total,
            'search_query': search_query,
            'role_filter': role_filter,
            'role_options': [{'code': code, 'label': label} for code, label in ROLE_CHOICES],
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
            nickname = request.POST.get('nickname', '').strip()
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'

            role, role_codes = parse_roles(request)

            if not request.POST.getlist('roles') and not request.POST.get('roles', '').strip():
                return JsonResponse({'error': 'Выберите хотя бы одну роль'}, status=400)

            passport_series = request.POST.get('passport_series', '').strip()
            passport_number = request.POST.get('passport_number', '').strip()
            passport_issued_by = request.POST.get('passport_issued_by', '').strip()
            passport_issued_date = request.POST.get('passport_issued_date', '').strip()
            passport_department_code = request.POST.get('passport_department_code', '').strip()
            passport_registration = request.POST.get('passport_registration', '').strip()
            passport_inn = request.POST.get('passport_inn', '').strip()
            passport_snils = request.POST.get('passport_snils', '').strip()

            rzd_bonus_number = request.POST.get('rzd_bonus_number', '').strip()
            instagram = request.POST.get('instagram', '').strip()
            international_passport_series = request.POST.get('international_passport_series', '').strip()
            international_passport_number = request.POST.get('international_passport_number', '').strip()

            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not password:
                return JsonResponse({'error': 'Пароль обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)

            if employee.role not in [ROLE_SENIOR_ADMIN, 'boss'] and not employee.can_manage_roles():
                if 'senior_admin' in role_codes or 'boss' in role_codes:
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
                nickname=nickname,
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
                rzd_bonus_number=rzd_bonus_number,
                instagram=instagram,
                international_passport_series=international_passport_series,
                international_passport_number=international_passport_number,
            )

            sync_employee_roles(employee_obj, role_codes)

            return JsonResponse({
                'success': True,
                'employee': serialize_employee(Employee.objects.select_related('user').prefetch_related('roles').get(id=employee_obj.id)),
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
            employee_obj = Employee.objects.select_related('user').prefetch_related('roles').get(id=employee_id)

            data = serialize_employee(employee_obj, with_card=True)
            data['documents'] = serialize_employee_documents(employee_obj)

            return JsonResponse(data)
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
            employee_obj = get_object_or_404(Employee.objects.select_related('user').prefetch_related('roles'), id=employee_id)

            username = request.POST.get('username', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            nickname = request.POST.get('nickname', '').strip()
            phone = request.POST.get('phone', '').strip()
            telegram = request.POST.get('telegram', '').strip()
            is_active = request.POST.get('is_active') == 'on' or request.POST.get('is_active') == 'true'
            password = request.POST.get('password', '').strip()

            role, role_codes = parse_roles(request)

            if not request.POST.getlist('roles') and not request.POST.get('roles', '').strip():
                return JsonResponse({'error': 'Выберите хотя бы одну роль'}, status=400)

            passport_series = request.POST.get('passport_series', '').strip()
            passport_number = request.POST.get('passport_number', '').strip()
            passport_issued_by = request.POST.get('passport_issued_by', '').strip()
            passport_issued_date = request.POST.get('passport_issued_date', '').strip()
            passport_department_code = request.POST.get('passport_department_code', '').strip()
            passport_registration = request.POST.get('passport_registration', '').strip()
            passport_inn = request.POST.get('passport_inn', '').strip()
            passport_snils = request.POST.get('passport_snils', '').strip()

            rzd_bonus_number = request.POST.get('rzd_bonus_number', '').strip()
            instagram = request.POST.get('instagram', '').strip()
            international_passport_series = request.POST.get('international_passport_series', '').strip()
            international_passport_number = request.POST.get('international_passport_number', '').strip()

            if not username:
                return JsonResponse({'error': 'Логин обязателен для заполнения'}, status=400)
            if not full_name:
                return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)

            if User.objects.filter(username=username).exclude(id=employee_obj.user.id).exists():
                return JsonResponse({'error': 'Пользователь с таким логином уже существует'}, status=400)

            if not current_employee.can_manage_roles():
                if 'senior_admin' in role_codes or 'boss' in role_codes:
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
            employee_obj.nickname = nickname
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
            employee_obj.rzd_bonus_number = rzd_bonus_number
            employee_obj.instagram = instagram
            employee_obj.international_passport_series = international_passport_series
            employee_obj.international_passport_number = international_passport_number
            employee_obj.save()

            sync_employee_roles(employee_obj, role_codes)

            return JsonResponse({
                'success': True,
                'employee': serialize_employee(Employee.objects.select_related('user').prefetch_related('roles').get(id=employee_obj.id)),
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

        try:
            employee = request.user.employee_profile
            if not employee.can_manage_employees() and not employee.can_manage_orders():
                return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        search = request.GET.get('search', '').strip()
        role = request.GET.get('role', 'all')

        employees = Employee.objects.filter(
            is_active=True, user__is_active=True
        ).select_related('user').prefetch_related('roles').order_by('full_name')

        if search:
            employees = employees.filter(
                Q(full_name__icontains=search) |
                Q(nickname__icontains=search) |
                Q(user__username__icontains=search) |
                Q(phone__icontains=search)
            )

        if role != 'all':
            employees = employees.filter(role=role)

        total = employees.count()
        limit = parse_int(request.GET.get('limit'))

        employee_list = list(employees)

        if limit:
            employee_list = employee_list[:limit]

        result = []

        for emp in employee_list:
            result.append({
                'id': emp.id,
                'full_name': emp.full_name,
                'nickname': emp.nickname or '',
                'display_name': emp.display_name,
                'username': emp.user.username,
                'role': emp.role,
                'role_label': role_label(emp.role),
                'role_display': role_label(emp.role),
                'role_codes': emp.role_codes(),
                'phone': normalize_phone_display(emp.phone),
                'is_active': emp.is_active,
            })

        return JsonResponse({
            'employees': result,
            'total': total,
            'has_more': total > len(result),
        })


class AvailabilityByDateView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        target_date = parse_request_date(request.GET.get('date'))

        if target_date is None:
            return JsonResponse({'success': True, 'date': '', 'items': []})

        employee_ids = []

        for value in request.GET.getlist('employee_id'):
            for part in str(value).split(','):
                if part.strip().isdigit():
                    employee_ids.append(int(part))

        employees = Employee.objects.filter(id__in=employee_ids).prefetch_related('availability_rules')

        items = []

        for emp in employees:
            row = resolve_availability(emp, target_date)
            row['employee_id'] = emp.id
            row['employee_name'] = emp.display_name
            items.append(row)

        return JsonResponse({
            'success': True,
            'date': target_date.strftime('%Y-%m-%d'),
            'items': items,
        })


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
            if employee_obj.role not in ARTIST_ROLES:
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
            if employee_obj.role not in ARTIST_ROLES:
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


class EmployeeDocumentsView(View):
    def get(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee_obj = Employee.objects.filter(id=employee_id).first()

        if employee_obj is None:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)

        current_employee = getattr(request.user, 'employee_profile', None)

        if current_employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if current_employee.id != employee_obj.id and not current_employee.can_manage_employees():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        return JsonResponse({
            'success': True,
            'documents': serialize_employee_documents(employee_obj),
        })

    def post(self, request, employee_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        employee_obj = Employee.objects.filter(id=employee_id).first()

        if employee_obj is None:
            return JsonResponse({'error': 'Сотрудник не найден'}, status=404)

        current_employee = getattr(request.user, 'employee_profile', None)

        if current_employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if current_employee.id != employee_obj.id and not current_employee.can_manage_employees():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        upload = request.FILES.get('file')

        if upload is None:
            return JsonResponse({'error': 'Файл не выбран'}, status=400)

        kind = request.POST.get('kind', EmployeeDocument.KIND_PASSPORT)

        if kind not in dict(EmployeeDocument.KINDS):
            kind = EmployeeDocument.KIND_OTHER

        EmployeeDocument.objects.create(
            employee=employee_obj,
            kind=kind,
            title=request.POST.get('title', '').strip(),
            file=upload,
            uploaded_by=current_employee,
        )

        return JsonResponse({
            'success': True,
            'documents': serialize_employee_documents(employee_obj),
        })


class EmployeeDocumentDeleteView(View):
    def post(self, request, employee_id, document_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)

        current_employee = getattr(request.user, 'employee_profile', None)

        if current_employee is None:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)

        if current_employee.id != int(employee_id) and not current_employee.can_manage_employees():
            return JsonResponse({'error': 'У вас недостаточно прав'}, status=403)

        document = EmployeeDocument.objects.filter(id=document_id, employee_id=employee_id).first()

        if document is None:
            return JsonResponse({'error': 'Документ не найден'}, status=404)

        if document.file:
            document.file.delete(save=False)

        document.delete()

        return JsonResponse({'success': True})
