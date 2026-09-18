from django.http import JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.utils import timezone
from datetime import datetime
from ..models import Employee, ArtistCard, Order, OrderEmployee, TransportTicket


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
		if employee.role == 'artist':
			card_obj, _ = ArtistCard.objects.get_or_create(employee=employee)
			card = serialize_artist_card(card_obj)

		return JsonResponse({
			'id': employee.id,
			'username': employee.user.username,
			'full_name': employee.full_name,
			'role': employee.role,
			'role_display': employee.get_role_display(),
			'phone': employee.phone or '',
			'telegram': employee.telegram_username or '',
			'is_active': employee.is_active,
			'date_joined': employee.user.date_joined.strftime('%d.%m.%Y'),
			'skills': [{'id': s.id, 'name': s.name} for s in employee.skills.all()],
			'passport_series': employee.passport_series or '',
			'passport_number': employee.passport_number or '',
			'passport_issued_by': employee.passport_issued_by or '',
			'passport_issued_date': employee.passport_issued_date.strftime('%Y-%m-%d') if employee.passport_issued_date else '',
			'passport_department_code': employee.passport_department_code or '',
			'passport_registration': employee.passport_registration or '',
			'passport_inn': employee.passport_inn or '',
			'passport_snils': employee.passport_snils or '',
			'is_artist': employee.role == 'artist',
			'artist_card': card,
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
			if order.date < today:
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