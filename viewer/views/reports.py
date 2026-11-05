from django.shortcuts import render, redirect
from django.views import View

from ..models import Employee


class ReportsView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')

        try:
            employee = request.user.employee_profile
        except Employee.DoesNotExist:
            return redirect('logout')

        if not employee.can_view_reports():
            return redirect('index')

        return render(request, 'reports.html', {'employee': employee})
