from django.shortcuts import redirect
from django.contrib import messages

class RoleAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        # Для отладки пропускаем всех авторизованных
        if request.user.is_authenticated:
            return None
        return None


# class RoleAccessMiddleware:
#     """Middleware для проверки доступа по ролям"""

#     def __init__(self, get_response):
#         self.get_response = get_response

#     def __call__(self, request):
#         response = self.get_response(request)
#         return response

#     def process_view(self, request, view_func, view_args, view_kwargs):
#         # Пропускаем неавторизованных пользователей и страницу входа
#         if not request.user.is_authenticated:
#             return None

#         # Получаем имя URL
#         url_name = request.resolver_match.url_name if request.resolver_match else None
        
#         # Публичные URL - доступны всем
#         public_urls = ['login', 'logout']
#         if url_name in public_urls:
#             return None

#         # Получаем сотрудника
#         try:
#             employee = request.user.employee_profile
#         except:
#             # Если нет профиля, но пользователь авторизован - перенаправляем на логаут
#             return redirect('logout')

#         # Старший администратор имеет доступ ко всему
#         if employee.role == 'senior_admin':
#             return None

#         # Проверка доступа к админ-панели Django
#         if request.path.startswith('/admin/'):
#             if employee.role not in ['senior_admin', 'admin']:
#                 messages.error(request, 'У вас недостаточно прав для доступа к админ-панели')
#                 return redirect('index')
#             return None

#         # Доступ к разделам по ролям
#         role_access = {
#             'admin': ['clients', 'orders', 'schedule', 'employees', 'services', 'index'],
#             'manager': ['clients', 'orders', 'schedule', 'services', 'index'],
#             'trainer': ['schedule', 'orders', 'index'],
#             'artist': ['schedule', 'index'],
#         }

#         # Если URL не найден, пропускаем
#         if not url_name:
#             return None

#         # Проверяем доступ
#         allowed_urls = role_access.get(employee.role, [])
        
#         # Если URL не в списке разрешенных, перенаправляем на главную
#         if url_name not in allowed_urls:
#             # Добавляем сообщение об ошибке только если это не index
#             if url_name != 'index':
#                 messages.error(request, f'У вас недостаточно прав для доступа к разделу "{url_name}"')
#             return redirect('index')

#         return None