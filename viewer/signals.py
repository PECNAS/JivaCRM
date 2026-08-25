from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Employee

@receiver(post_save, sender=Employee)
def create_user_for_employee(sender, instance, created, **kwargs):
    if created:
        # Создаем пользователя в auth_user
        user = User.objects.create_user(
            username=instance.username,
            password=instance.password,  # Пароль уже захеширован
            first_name=instance.full_name,
            is_active=instance.is_active,
            is_staff=True
        )