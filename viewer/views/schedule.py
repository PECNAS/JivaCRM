from django.http import HttpResponse
from django.views import View
from django.shortcuts import render, redirect


class ScheduleView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("login")
        return render(request, "schedule.html")

    def post(self, request):
        return HttpResponse("POST request successfully!")