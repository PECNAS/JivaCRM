import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')

application = get_wsgi_application()


def close_old_connections():
    try:
        from django.db import close_old_connections as django_close

        django_close()
    except Exception:
        pass


close_old_connections()
