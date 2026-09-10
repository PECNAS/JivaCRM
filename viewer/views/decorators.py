from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages


def role_required(allowed_roles):
    """Декоратор для проверки ролей"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('login')
            
            try:
                employee = request.user.employee_profile
                if employee.role not in allowed_roles:
                    messages.error(request, 'У вас недостаточно прав для доступа к этому разделу')
                    return redirect('index')
            except:
                messages.error(request, 'Профиль сотрудника не найден')
                return redirect('logout')
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def admin_required(view_func):
    """Декоратор для проверки прав администратора"""
    return role_required(['senior_admin', 'admin'])(view_func)


def manager_required(view_func):
    """Декоратор для проверки прав менеджера"""
    return role_required(['senior_admin', 'admin', 'manager'])(view_func)


def trainer_required(view_func):
    """Декоратор для проверки прав тренера"""
    return role_required(['senior_admin', 'admin', 'trainer'])(view_func)