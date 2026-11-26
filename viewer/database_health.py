from django.db import connections
from django.db.utils import Error as DatabaseError
from django.http import JsonResponse
from django.shortcuts import render
from django.views import View


HEALTH_PATH = '/health/db/'
STATIC_PREFIX = '/static/'
MEDIA_PREFIX = '/media/'


def database_alive(timeout=3):
    """Проверяет, отвечает ли база данных."""
    try:
        connection = connections['default']
        connection.close()
        connection.ensure_connection()

        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchall()

        return True
    except Exception:
        return False


def is_static_request(request):
    path = request.path or ''

    return path.startswith(STATIC_PREFIX) or path.startswith(MEDIA_PREFIX) or path == HEALTH_PATH


def wants_json(request):
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return True

    if 'application/json' in (request.headers.get('Accept') or ''):
        return True

    return (request.path or '').startswith('/api/')


class DatabaseStatusMiddleware:
    """Раннее определение связи с базой данных и единая страница ошибки."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if is_static_request(request):
            return self.get_response(request)

        if not database_alive():
            return database_error_response(request)

        try:
            response = self.get_response(request)
        except (DatabaseError, IOError, OSError, ValueError):
            try:
                alive = database_alive()
            except Exception:
                alive = False

            if not alive:
                return database_error_response(request)

            raise

        return response


def database_error_response(request):
    retry_url = request.get_full_path() or '/'

    if wants_json(request):
        return JsonResponse({
            'error': 'Нет связи с базой данных. Попробуйте обновить страницу.',
            'database_error': True,
            'retry_url': retry_url,
        }, status=503)

    response = render(request, 'db_error.html', {
        'retry_url': retry_url,
        'server_time': None,
    }, status=503)

    response['Retry-After'] = '30'
    response['Cache-Control'] = 'no-store'

    return response


class DatabaseHealthView(View):
    def get(self, request):
        alive = database_alive()

        return JsonResponse({'ok': alive, 'database': 'up' if alive else 'down'}, status=200 if alive else 503)


def handler503(request, exception=None):
    return render(request, 'db_error.html', {
        'retry_url': request.get_full_path() or '/',
    }, status=503)
