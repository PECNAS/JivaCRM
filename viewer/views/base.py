from django.http import HttpResponse, JsonResponse
from django.views import View
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from ..models import Employee


MANIFEST = {
    'name': 'JIVA CRM',
    'short_name': 'JIVA',
    'description': 'CRM театра «Джива»: расписание, заказы, клиенты, сотрудники',
    'start_url': '/schedule/',
    'scope': '/',
    'display': 'standalone',
    'orientation': 'portrait',
    'background_color': '#0b0b0b',
    'theme_color': '#0b0b0b',
    'lang': 'ru',
    'icons': [
        {
            'src': '/static/images/icon-192.png',
            'sizes': '192x192',
            'type': 'image/png',
            'purpose': 'any',
        },
        {
            'src': '/static/images/icon-512.png',
            'sizes': '512x512',
            'type': 'image/png',
            'purpose': 'any',
        },
        {
            'src': '/static/images/icon-192-maskable.png',
            'sizes': '192x192',
            'type': 'image/png',
            'purpose': 'maskable',
        },
        {
            'src': '/static/images/icon-512-maskable.png',
            'sizes': '512x512',
            'type': 'image/png',
            'purpose': 'maskable',
        },
    ],
}


class ManifestView(View):
    def get(self, request):
        return JsonResponse(MANIFEST, json_dumps_params={'ensure_ascii': False})


class IndexView(View):
    def get(self, request):
        return redirect('schedule')

    def post(self, request):
        return HttpResponse("POST request successfully!")


class LoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect('schedule')
        list(messages.get_messages(request))
        return render(request, "login.html")

    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')

        if not username or not password:
            messages.error(request, 'Пожалуйста, заполните все поля')
            return redirect('login')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            request.session.set_expiry(1209600)
            return redirect("schedule")
        else:
            messages.error(request, 'Неверное имя пользователя или пароль')
            return redirect("login")


class LogoutView(View):
    def get(self, request):
        if request.user.is_authenticated:
            logout(request)
        return redirect("login")

    def post(self, request):
        return self.get(request)