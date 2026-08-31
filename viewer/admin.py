from django.contrib import admin
from .models import Agency, Role, Skill, Employee, Client, Order, ArtistSchedule


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'user', 'role', 'phone', 'is_active']
    list_filter = ['role', 'is_active', 'skills']
    search_fields = ['full_name', 'user__username', 'phone', 'telegram_username']
    raw_id_fields = ['user']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        (None, {
            'fields': ('user', 'full_name', 'role', 'phone', 'telegram_username', 'skills')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Важные даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('user', 'full_name', 'role', 'phone', 'telegram_username', 'is_active'),
        }),
    )


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'agency', 'phone', 'city', 'rating', 'created_by']
    list_filter = ['rating', 'city', 'agency']
    search_fields = ['full_name', 'phone', 'telegram_username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'client', 'address', 'date', 'status', 'cost', 'manager']
    list_filter = ['status', 'date', 'manager', 'client']
    search_fields = ['address', 'client__full_name', 'manager__full_name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Основная информация', {
            'fields': ('client', 'date', 'address', 'status', 'duration')
        }),
        ('Контакты', {
            'fields': ('contact_phone', 'contact_telegram')
        }),
        ('Детали мероприятия', {
            'fields': ('setup_time', 'dressing_room_comment', 'meal_comment', 'concept')
        }),
        ('Технические параметры', {
            'fields': ('tech_lamps', 'tech_laser', 'tech_hazer', 'tech_grid', 'tech_projection', 'tech_comment')
        }),
        ('Комментарии', {
            'fields': ('venue_comment', 'props_comment')
        }),
        ('Финансы и управление', {
            'fields': ('cost', 'payment_method', 'manager')
        }),
        ('Системные поля', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ArtistSchedule)
class ArtistScheduleAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'order', 'order_date']
    list_filter = ['employee', 'order__date']
    search_fields = ['employee__full_name', 'order__client__full_name']

    def order_date(self, obj):
        return obj.order.date
    order_date.short_description = 'Дата мероприятия'
    order_date.admin_order_field = 'order__date'