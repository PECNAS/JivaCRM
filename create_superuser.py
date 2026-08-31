import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
django.setup()

from django.contrib.auth.models import User

if not User.objects.filter(username='PECNAS').exists():
    User.objects.create_superuser('PECNAS', 'busovrm4@gmail.com', 'admin')
    print("Суперпользователь PECNAS создан")
else:
    print("Суперпользователь PECNAS уже существует")