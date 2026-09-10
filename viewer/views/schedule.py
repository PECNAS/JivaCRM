from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Q
from ..models import ArtistSchedule, Order


class ScheduleView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        
        try:
            employee = request.user.employee_profile
            if not employee.can_view_schedule():
                messages.error(request, 'У вас недостаточно прав для просмотра расписания')
                return redirect('index')
        except:
            return redirect('logout')
        
        return render(request, "schedule.html")

    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Не авторизован'}, status=401)
        
        try:
            employee = request.user.employee_profile
            if not employee.can_create_trainings():
                return JsonResponse({'error': 'У вас недостаточно прав для создания тренировок'}, status=403)
        except:
            return JsonResponse({'error': 'Профиль не найден'}, status=404)
        
        return HttpResponse("POST request successfully!")