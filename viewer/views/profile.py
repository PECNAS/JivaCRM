import re

from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from ..models import (
	Employee, ArtistCard, Order, OrderEmployee, TransportTicket, Skill, Service,
	MoneyAccrual, MoneyPayout, ARTIST_ROLES, ROLE_ARTIST,
)
from .money_service import ZERO, employee_balance
from .helpers import role_label


def serialize_artist_card(card):
	if card is None:
		return None
	return {
		'weight': card.weight or '',
		'height': card.height or '',
		'shoe_size': card.shoe_size or '',
		'skills_text': card.skills_text or '',
		'comment': card.comment or '',
		'known_shows': [{'id': s.id, 'name': s.name} for s in card.known_shows.all()],
	}


EDITABLE_TEXT_FIELDS = [
	'full_name',
	'nickname',
	'phone',
	'telegram_username',
	'passport_series',
	'passport_number',
	'passport_issued_by',
	'passport_department_code',
	'passport_registration',
	'passport_inn',
	'passport_snils',
	'rzd_bonus_number',
	'instagram',
	'international_passport_series',
	'international_passport_number',
]


def parse_date(value):
	if not value:
		return None

	try:
		return datetime.strptime(value, '%Y-%m-%d').date()
	except (TypeError, ValueError):
		return None


class ProfileView(View):
	def get(self, request):
		if not request.user.is_authenticated:
			return redirect("login")

		try:
			employee = request.user.employee_profile
		except:
			return redirect('logout')

		return render(request, 'profile.html', {'employee': employee})


class ProfileDetailView(View):
	def get(self, request):
		if not request.user.is_authenticated:
			return JsonResponse({'error': 'Не авторизован'}, status=401)

		try:
			employee = request.user.employee_profile
		except:
			return JsonResponse({'error': 'Профиль не найден'}, status=404)

		card = None
		if employee.role in ARTIST_ROLES:
			card_obj, _ = ArtistCard.objects.get_or_create(employee=employee)
			card = serialize_artist_card(card_obj)

		shows = Service.objects.filter(type='service', is_active=True).order_by('name')

		return JsonResponse({
			'id': employee.id,
			'username': employee.user.username,
			'full_name': employee.full_name,
			'nickname': employee.nickname or '',
			'display_name': employee.display_name,
			'role': employee.role,
			'role_display': role_label(employee.role),
			'phone': employee.phone or '',
			'telegram': employee.telegram_username or '',
			'is_active': employee.is_active,
			'date_joined': employee.user.date_joined.strftime('%d.%m.%Y'),
			'skills': [{'id': s.id, 'name': s.name} for s in employee.skills.all()],
			'passport_series': employee.passport_series or '',
			'passport_number': employee.passport_number or '',
			'passport_issued_by': employee.passport_issued_by or '',
			'passport_issued_date': employee.passport_issued_date.strftime('%Y-%m-%d') if employee.passport_issued_date else '',
			'passport_issued_date_display': employee.passport_issued_date.strftime('%d.%m.%Y') if employee.passport_issued_date else '',
			'passport_department_code': employee.passport_department_code or '',
			'passport_registration': employee.passport_registration or '',
			'passport_inn': employee.passport_inn or '',
			'passport_snils': employee.passport_snils or '',
			'is_artist': employee.role in ARTIST_ROLES,
			'artist_card': card,
			'available_shows': [{'id': s.id, 'name': s.name} for s in shows],
		})


class ProfileUpdateView(View):
	def post(self, request):
		if not request.user.is_authenticated:
			return JsonResponse({'error': 'Не авторизован'}, status=401)

		try:
			employee = request.user.employee_profile
		except:
			return JsonResponse({'error': 'Профиль не найден'}, status=404)

		full_name = request.POST.get('full_name', employee.full_name).strip()

		if not full_name:
			return JsonResponse({'error': 'ФИО обязательно для заполнения'}, status=400)

		phone = request.POST.get('phone', employee.phone).strip()
		phone_digits = ''.join(filter(str.isdigit, phone))

		if phone_digits and len(phone_digits) != 11:
			return JsonResponse({'error': 'Номер телефона должен содержать 11 цифр'}, status=400)

		for field in EDITABLE_TEXT_FIELDS:
			if field in request.POST:
				setattr(employee, field, request.POST.get(field, '').strip())

		employee.full_name = full_name
		employee.phone = phone

		if 'passport_issued_date' in request.POST:
			raw_date = request.POST.get('passport_issued_date', '').strip()
			if raw_date and not parse_date(raw_date):
				return JsonResponse({'error': 'Неверный формат даты выдачи паспорта'}, status=400)
			employee.passport_issued_date = parse_date(raw_date)

		if 'skills' in request.POST:
			try:
				skill_ids = [
					int(value)
					for value in str(request.POST.get('skills', '')).split(',')
					if str(value).strip().isdigit()
				]
			except (TypeError, ValueError):
				skill_ids = []

			employee.skills.set(Skill.objects.filter(id__in=skill_ids))

		employee.save()

		if employee.role in ARTIST_ROLES:
			card, _ = ArtistCard.objects.get_or_create(employee=employee)

			if 'weight' in request.POST:
				card.weight = request.POST.get('weight', '').strip()
			if 'height' in request.POST:
				card.height = request.POST.get('height', '').strip()
			if 'shoe_size' in request.POST:
				card.shoe_size = request.POST.get('shoe_size', '').strip()
			if 'skills_text' in request.POST:
				card.skills_text = request.POST.get('skills_text', '').strip()
			if 'comment' in request.POST:
				card.comment = request.POST.get('comment', '').strip()

			card.save()

			if 'known_shows' in request.POST:
				raw_shows = request.POST.get('known_shows', '')

				try:
					show_ids = [
						int(value)
						for value in str(raw_shows).split(',')
						if str(value).strip().isdigit()
					]
				except (TypeError, ValueError):
					show_ids = []

				card.known_shows.set(Service.objects.filter(id__in=show_ids))

		return JsonResponse({
			'success': True,
			'profile': {
				'full_name': employee.full_name,
			'nickname': employee.nickname or '',
			'display_name': employee.display_name,
				'phone': employee.phone,
			}
		})


class ProfileCredentialsView(View):
	def post(self, request):
		if not request.user.is_authenticated:
			return JsonResponse({'error': 'Не авторизован'}, status=401)

		user = request.user

		try:
			employee = user.employee_profile
		except:
			return JsonResponse({'error': 'Профиль не найден'}, status=404)

		username = request.POST.get('username', '').strip()
		current_password = request.POST.get('current_password', '')
		new_password = request.POST.get('new_password', '')
		repeat_password = request.POST.get('repeat_password', '')

		username_changed = bool(username) and username != user.username
		password_changed = bool(new_password or repeat_password)

		if not username_changed and not password_changed:
			return JsonResponse({'error': 'Изменений нет'}, status=400)

		if not current_password:
			return JsonResponse({'error': 'Введите текущий пароль'}, status=400)

		if not user.check_password(current_password):
			return JsonResponse({'error': 'Текущий пароль указан неверно'}, status=400)

		if username_changed:
			if len(username) < 3:
				return JsonResponse({'error': 'Логин должен содержать минимум 3 символа'}, status=400)

			if len(username) > 150:
				return JsonResponse({'error': 'Логин слишком длинный'}, status=400)

			if not re.match(r'^[\w.@+-]+$', username):
				return JsonResponse({'error': 'Логин может содержать только буквы, цифры и символы @ . + - _'}, status=400)

			if User.objects.filter(username__iexact=username).exclude(id=user.id).exists():
				return JsonResponse({'error': 'Такой логин уже занят'}, status=400)

		if password_changed:
			if not new_password:
				return JsonResponse({'error': 'Введите новый пароль'}, status=400)

			if new_password != repeat_password:
				return JsonResponse({'error': 'Пароли не совпадают'}, status=400)

			if len(new_password) < 6:
				return JsonResponse({'error': 'Пароль должен содержать минимум 6 символов'}, status=400)

			try:
				validate_password(new_password, user)
			except ValidationError as error:
				return JsonResponse({'error': ' '.join(error.messages)}, status=400)

		if username_changed:
			user.username = username

		if password_changed:
			user.set_password(new_password)

		user.save()

		if password_changed:
			update_session_auth_hash(request, user)

		employee.save(update_fields=['updated_at'])

		return JsonResponse({
			'success': True,
			'username': user.username,
			'password_changed': password_changed,
		})


class ProfileScheduleView(View):
	def get(self, request):
		if not request.user.is_authenticated:
			return JsonResponse({'error': 'Не авторизован'}, status=401)

		try:
			employee = request.user.employee_profile
		except:
			return JsonResponse({'error': 'Профиль не найден'}, status=404)

		today = timezone.now().date()

		order_employees = OrderEmployee.objects.filter(employee=employee).select_related('order', 'order__city', 'order__client').order_by('order__date')

		events = []
		for oe in order_employees:
			order = oe.order
			if not order.date or order.date < today:
				continue
			events.append({
				'id': order.id,
				'order_id': order.id,
				'name': order.name or f'Заказ #{order.id}',
				'date': order.date.strftime('%Y-%m-%d'),
				'date_display': order.date.strftime('%d.%m.%Y'),
				'address': order.address or '',
				'city': order.city.name if order.city else '',
				'client': order.client.full_name if order.client else '',
				'status': order.status,
				'status_display': order.get_status_display(),
				'setup_time': order.setup_time or '',
				'concept': order.concept or '',
				'payment': float(oe.payment),
			})

		events.sort(key=lambda x: x['date'])

		return JsonResponse({'success': True, 'events': events})


class ProfileTicketsView(View):
	def get(self, request):
		if not request.user.is_authenticated:
			return JsonResponse({'error': 'Не авторизован'}, status=401)

		try:
			employee = request.user.employee_profile
		except:
			return JsonResponse({'error': 'Профиль не найден'}, status=404)

		tickets = TransportTicket.objects.filter(employee=employee).select_related('order', 'order__city').order_by('departure_datetime')

		tickets_list = []
		for t in tickets:
			tickets_list.append({
				'id': t.id,
				'transport_type': t.transport_type,
				'transport_type_display': t.get_transport_type_display(),
				'from_city': t.from_city or '',
				'to_city': t.to_city or '',
				'departure_datetime': t.departure_datetime.strftime('%d.%m.%Y %H:%M') if t.departure_datetime else '',
				'arrival_datetime': t.arrival_datetime.strftime('%d.%m.%Y %H:%M') if t.arrival_datetime else '',
				'ticket_number': t.ticket_number or '',
				'carrier': t.carrier or '',
				'cost': float(t.cost),
				'comment': t.comment or '',
				'order_id': t.order.id if t.order else None,
				'order_name': t.order.name if t.order else '',
			})

		return JsonResponse({'success': True, 'tickets': tickets_list})


class ProfilePaymentsView(View):
	def get(self, request):
		if not request.user.is_authenticated:
			return JsonResponse({'error': 'Не авторизован'}, status=401)

		try:
			employee = request.user.employee_profile
		except:
			return JsonResponse({'error': 'Профиль не найден'}, status=404)

		accruals = (
			MoneyAccrual.objects
			.filter(employee=employee)
			.select_related('order', 'order__client')
			.order_by('-period_date', '-id')[:60]
		)

		payouts = (
			MoneyPayout.objects
			.filter(employee=employee)
			.order_by('-period_date', '-id')[:60]
		)

		operations = []

		for accrual in accruals:
			operations.append({
				'type': 'accrual',
				'date': accrual.period_date.strftime('%Y-%m-%d'),
				'date_display': accrual.period_date.strftime('%d.%m.%Y'),
				'title': accrual.title or accrual.get_category_display(),
				'subtitle': accrual.get_category_display(),
				'amount': float(accrual.signed_amount()),
				'is_active': accrual.is_active,
				'order_id': accrual.order.id if accrual.order else None,
			})

		for payout in payouts:
			operations.append({
				'type': 'payout',
				'date': payout.period_date.strftime('%Y-%m-%d'),
				'date_display': payout.period_date.strftime('%d.%m.%Y'),
				'title': f'Выплата · {payout.get_method_display()}',
				'subtitle': payout.get_kind_display(),
				'amount': -float(payout.amount),
				'is_active': not payout.is_reverted,
				'order_id': None,
			})

		operations.sort(key=lambda item: (item['date'], 0 if item['type'] == 'payout' else 1), reverse=True)

		month_start = timezone.localdate().replace(day=1)

		month_accrued = ZERO
		month_paid = ZERO

		for item in operations:
			if not item['is_active']:
				continue

			if item['date'] < month_start.strftime('%Y-%m-%d'):
				continue

			if item['type'] == 'accrual':
				month_accrued += Decimal(str(item['amount']))
			else:
				month_paid += -Decimal(str(item['amount']))

		balance = employee_balance(employee)

		return JsonResponse({
			'success': True,
			'balance': float(balance),
			'accrued_total': float(sum(
				[Decimal(str(item['amount'])) for item in operations if item['is_active'] and item['type'] == 'accrual'],
				ZERO,
			)),
			'paid_total': float(sum(
				[-Decimal(str(item['amount'])) for item in operations if item['is_active'] and item['type'] == 'payout'],
				ZERO,
			)),
			'month_label': month_start.strftime('%m.%Y'),
			'month_accrued': float(month_accrued),
			'month_paid': float(month_paid),
			'show_rates': employee.can_see_rates(),
			'operations': operations[:80],
		})