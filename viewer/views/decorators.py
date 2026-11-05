from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages

from ..models import ROLE_BOSS, ROLE_SENIOR_ADMIN, ROLE_MANAGER, ROLE_CHOREOGRAPHER


def role_required(allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('login')

            try:
                employee = request.user.employee_profile
                if not employee.has_role(*allowed_roles):
                    messages.error(request, 'У вас недостаточно прав для доступа к этому разделу')
                    return redirect('index')
            except Exception:
                messages.error(request, 'Профиль сотрудника не найден')
                return redirect('logout')

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def admin_required(view_func):
    return role_required([ROLE_SENIOR_ADMIN, ROLE_BOSS])(view_func)


def manager_required(view_func):
    return role_required([ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER])(view_func)


def trainer_required(view_func):
    return role_required([ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_CHOREOGRAPHER])(view_func)
