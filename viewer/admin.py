from django.contrib import admin
from .models import (
    Agency, AgencyAlias, AgencyManager, Role, Skill, Employee, EmployeeDocument, Client, Order,
    OrderEstimate, OrderEmployee, OrderPayment, OrderFeedback,
    ChecklistTemplate, ChecklistItem, OrderShowTemplate,
    Service, ServiceStaffRow, ArtistSchedule,
    City, CityGroup, ArtistCard, CalendarColor, PriceRisePeriod,
    MoneyAccrual, MoneyPayout, OrderExpense,
)

admin.site.site_header = 'JIVA HUB'
admin.site.site_title = 'JIVA HUB'
admin.site.index_title = 'Управление данными'


class AgencyAliasInline(admin.TabularInline):
    model = AgencyAlias
    extra = 0


class AgencyManagerInline(admin.TabularInline):
    model = AgencyManager
    extra = 0


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']
    readonly_fields = ['normalized_name']
    inlines = [AgencyAliasInline, AgencyManagerInline]


@admin.register(AgencyAlias)
class AgencyAliasAdmin(admin.ModelAdmin):
    list_display = ['id', 'agency', 'name']
    search_fields = ['name', 'agency__name']
    readonly_fields = ['normalized_name']


@admin.register(AgencyManager)
class AgencyManagerAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'agency', 'phone', 'is_active']
    list_filter = ['agency', 'is_active']
    search_fields = ['name', 'phone']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'code', 'is_system']
    list_filter = ['is_system']
    search_fields = ['name', 'code']


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    search_fields = ['name']


@admin.register(CityGroup)
class CityGroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'salary_bonus', 'price_coefficient', 'order']
    search_fields = ['name']


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'group']
    list_filter = ['group']
    search_fields = ['name']
    fields = ['name', 'group', 'transport_costs']


@admin.register(CalendarColor)
class CalendarColorAdmin(admin.ModelAdmin):
    list_display = ['id', 'type', 'status', 'background_color', 'border_color', 'text_color', 'is_active']
    list_filter = ['type', 'status', 'is_active']
    list_editable = ['background_color', 'border_color', 'text_color', 'is_active']
    fieldsets = (
        ('Основное', {
            'fields': ('type', 'status', 'is_active')
        }),
        ('Цвета', {
            'fields': ('background_color', 'border_color', 'text_color'),
            'description': 'Укажите цвет в формате HEX (например, #2164c8) или RGB (например, rgb(33, 100, 200)).'
        }),
    )


@admin.register(PriceRisePeriod)
class PriceRisePeriodAdmin(admin.ModelAdmin):
    list_display = ['id', 'start_date', 'end_date', 'percent', 'is_active', 'comment']
    list_filter = ['is_active', 'start_date', 'end_date']
    search_fields = ['comment']
    list_editable = ['is_active']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Период', {
            'fields': ('start_date', 'end_date', 'percent'),
            'description': 'Даты учитываются включительно. Процент вводится дробным числом, например 10.5.'
        }),
        ('Дополнительно', {
            'fields': ('is_active', 'comment'),
        }),
        ('Системные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


class EmployeeDocumentInline(admin.TabularInline):
    model = EmployeeDocument
    fk_name = 'employee'
    extra = 0


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'nickname', 'user', 'role', 'phone', 'is_active']
    list_filter = ['role', 'is_active', 'skills', 'roles']
    search_fields = ['full_name', 'nickname', 'user__username', 'phone', 'telegram_username']
    raw_id_fields = ['user']
    filter_horizontal = ['roles']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [EmployeeDocumentInline]
    fieldsets = (
        ('Основное', {
            'fields': ('user', 'full_name', 'nickname', 'role', 'roles', 'phone', 'telegram_username', 'skills', 'is_active')
        }),
        ('Дополнительно', {
            'fields': ('rzd_bonus_number', 'instagram', 'international_passport_series', 'international_passport_number')
        }),
        ('Паспортные данные', {
            'fields': ('passport_series', 'passport_number', 'passport_issued_by',
                       'passport_issued_date', 'passport_department_code',
                       'passport_registration', 'passport_inn', 'passport_snils')
        }),
        ('Системные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'kind', 'title', 'created_at']
    list_filter = ['kind']
    search_fields = ['employee__full_name', 'title']
    readonly_fields = ['created_at']


@admin.register(ArtistCard)
class ArtistCardAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'weight', 'height', 'shoe_size']
    search_fields = ['employee__full_name']
    filter_horizontal = ['known_shows']


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['id', 'full_name', 'agency', 'agency_manager', 'contact_type', 'phone', 'get_cities', 'rating', 'created_by']
    list_filter = ['rating', 'cities', 'agency', 'contact_type']
    search_fields = ['full_name', 'phone', 'telegram_username', 'cities__name', 'comment']
    raw_id_fields = ['agency_manager']
    filter_horizontal = ['cities']
    readonly_fields = ['created_at', 'updated_at', 'phone_normalized', 'full_name_normalized']

    def get_cities(self, obj):
        return obj.get_cities_display()
    get_cities.short_description = 'Города'


class ServiceStaffRowInline(admin.TabularInline):
    model = ServiceStaffRow
    extra = 0


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'type', 'parent', 'artist_rate', 'is_active']
    list_filter = ['type', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ServiceStaffRowInline]


class OrderEstimateInline(admin.TabularInline):
    model = OrderEstimate
    extra = 0


class OrderEmployeeInline(admin.TabularInline):
    model = OrderEmployee
    extra = 0


class OrderPaymentInline(admin.TabularInline):
    model = OrderPayment
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'client', 'city', 'date', 'chat_number', 'status', 'cost', 'manager']
    list_filter = ['status', 'date', 'manager', 'client', 'city']
    search_fields = ['name', 'auto_name', 'chat_number', 'address', 'client__full_name', 'manager__full_name']
    readonly_fields = ['created_at', 'updated_at', 'content_hash', 'content_changed_at']
    filter_horizontal = ['managers']
    inlines = [OrderEstimateInline, OrderEmployeeInline, OrderPaymentInline]


@admin.register(OrderEstimate)
class OrderEstimateAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'service_name', 'people_count', 'coefficient', 'price', 'total', 'is_main']
    list_filter = ['is_main']
    search_fields = ['service_name', 'order__name']


@admin.register(OrderEmployee)
class OrderEmployeeAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'employee_name', 'employee_role', 'show', 'payment', 'is_story', 'is_responsible']
    list_filter = ['is_story', 'is_responsible', 'role_code']
    search_fields = ['employee_name', 'order__name']


@admin.register(OrderPayment)
class OrderPaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'amount', 'paid_at', 'is_cancelled', 'created_by']
    list_filter = ['is_cancelled', 'paid_at']
    search_fields = ['order__name', 'comment']
    readonly_fields = ['created_at', 'updated_at', 'cancelled_at']


class ChecklistItemInline(admin.TabularInline):
    model = ChecklistItem
    extra = 0


@admin.register(ChecklistTemplate)
class ChecklistTemplateAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'service', 'is_default', 'is_active']
    list_filter = ['is_active', 'is_default', 'service']
    search_fields = ['name', 'service__name']
    autocomplete_fields = ['service']
    inlines = [ChecklistItemInline]


@admin.register(ChecklistItem)
class ChecklistItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'text', 'template', 'order', 'show', 'is_done', 'order_index']
    list_filter = ['is_done']
    search_fields = ['text']


@admin.register(OrderShowTemplate)
class OrderShowTemplateAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'template', 'show']
    search_fields = ['order__name', 'template__name']


@admin.register(OrderFeedback)
class OrderFeedbackAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'author', 'kind', 'status', 'created_at']
    list_filter = ['kind', 'status']
    search_fields = ['text', 'order__name', 'author__full_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ArtistSchedule)
class ArtistScheduleAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'order', 'order_date']
    list_filter = ['employee', 'order__date']
    search_fields = ['employee__full_name', 'order__client__full_name']

    def order_date(self, obj):
        return obj.order.date
    order_date.short_description = 'Дата мероприятия'
    order_date.admin_order_field = 'order__date'


@admin.register(MoneyAccrual)
class MoneyAccrualAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'category', 'amount', 'period_date', 'order', 'status']
    list_filter = ['category', 'status', 'period_date']
    search_fields = ['employee__full_name', 'title', 'order__name']
    readonly_fields = ['created_at', 'updated_at', 'cancelled_at']


@admin.register(MoneyPayout)
class MoneyPayoutAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'amount', 'method', 'kind', 'period_date', 'is_reverted']
    list_filter = ['method', 'kind', 'is_reverted', 'period_date']
    search_fields = ['employee__full_name', 'comment']
    readonly_fields = ['created_at', 'updated_at', 'reverted_at']


@admin.register(OrderExpense)
class OrderExpenseAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'payer_name', 'amount', 'status', 'period_date', 'created_at']
    list_filter = ['status', 'period_date']
    search_fields = ['payer_name', 'comment', 'order__name']
    readonly_fields = ['created_at', 'updated_at', 'decided_at']
