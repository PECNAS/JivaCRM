from django.contrib import admin
from .models import (
    Agency, Role, Skill, Employee, Client, Order,
    OrderEstimate, OrderEmployee, Service, ArtistSchedule,
    City, CityGroup,
)


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


@admin.register(CityGroup)
class CityGroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'salary_bonus']
    search_fields = ['name']


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'group']
    list_filter = ['group']
    search_fields = ['name']
    fields = ['name', 'group', 'transport_costs']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'user', 'role', 'phone', 'is_active']
    list_filter = ['role', 'is_active', 'skills']
    search_fields = ['full_name', 'user__username', 'phone', 'telegram_username']
    raw_id_fields = ['user']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'agency', 'phone', 'city', 'rating', 'created_by']
    list_filter = ['rating', 'city', 'agency']
    search_fields = ['full_name', 'phone', 'telegram_username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'type', 'parent', 'payment_method', 'is_active']
    list_filter = ['type', 'is_active', 'payment_method']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']


class OrderEstimateInline(admin.TabularInline):
    model = OrderEstimate
    extra = 0


class OrderEmployeeInline(admin.TabularInline):
    model = OrderEmployee
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'client', 'city', 'date', 'status', 'cost', 'manager']
    list_filter = ['status', 'date', 'manager', 'client', 'city']
    search_fields = ['name', 'address', 'client__full_name', 'manager__full_name']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [OrderEstimateInline, OrderEmployeeInline]


@admin.register(OrderEstimate)
class OrderEstimateAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'service_name', 'coefficient', 'price', 'total']
    search_fields = ['service_name', 'order__name']


@admin.register(OrderEmployee)
class OrderEmployeeAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'employee_name', 'employee_role', 'payment']
    search_fields = ['employee_name', 'order__name']


@admin.register(ArtistSchedule)
class ArtistScheduleAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'order', 'order_date']
    list_filter = ['employee', 'order__date']
    search_fields = ['employee__full_name', 'order__client__full_name']

    def order_date(self, obj):
        return obj.order.date
    order_date.short_description = 'Дата мероприятия'
    order_date.admin_order_field = 'order__date'