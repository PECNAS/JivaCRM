import hashlib
import re

from datetime import datetime
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.utils import timezone


ROLE_ARTIST = 'artist'
ROLE_TECHNICIAN = 'technician'
ROLE_CHOREOGRAPHER = 'choreographer'
ROLE_MANAGER = 'manager'
ROLE_SALES_MANAGER = 'sales_manager'
ROLE_PRODUCTION = 'production'
ROLE_SENIOR_ADMIN = 'senior_admin'
ROLE_BOSS = 'boss'

ROLE_CHOICES = [
    (ROLE_ARTIST, 'Артист'),
    (ROLE_TECHNICIAN, 'Техник'),
    (ROLE_CHOREOGRAPHER, 'Хореограф'),
    (ROLE_MANAGER, 'Управляющий'),
    (ROLE_SALES_MANAGER, 'Менеджер'),
    (ROLE_PRODUCTION, 'Выпускающий'),
    (ROLE_BOSS, 'Босс'),
    (ROLE_SENIOR_ADMIN, 'Старший администратор'),
]

ROLE_LABELS = dict(ROLE_CHOICES)

TOP_ROLES = [ROLE_BOSS, ROLE_SENIOR_ADMIN]
ARTIST_ROLES = [ROLE_ARTIST]
NON_ARTIST_ROLES = [
    ROLE_TECHNICIAN, ROLE_CHOREOGRAPHER, ROLE_MANAGER,
    ROLE_SALES_MANAGER, ROLE_PRODUCTION, ROLE_BOSS, ROLE_SENIOR_ADMIN,
]
CHECKLIST_EDITOR_ROLES = NON_ARTIST_ROLES


def normalize_text(value):
    return ' '.join((value or '').lower().replace('ё', 'е').split())


class Agency(models.Model):
    name = models.CharField('Название', max_length=200, unique=True)
    normalized_name = models.CharField('Название (нормализованное)', max_length=200, blank=True, db_index=True, editable=False)

    class Meta:
        verbose_name = 'Агентство'
        verbose_name_plural = 'Агентства'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_text(self.name)

        update_fields = kwargs.get('update_fields')

        if update_fields is not None:
            update_fields = set(update_fields)
            update_fields.add('normalized_name')
            kwargs['update_fields'] = list(update_fields)

        super().save(*args, **kwargs)

    def variants(self):
        return [self.name] + [alias.name for alias in self.aliases.all()]


class AgencyAlias(models.Model):
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name='aliases', verbose_name='Агентство')
    name = models.CharField('Вариация названия', max_length=200)
    normalized_name = models.CharField('Нормализованная вариация', max_length=200, blank=True, db_index=True, editable=False)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)

    class Meta:
        verbose_name = 'Вариация названия агентства'
        verbose_name_plural = 'Вариации названий агентств'
        ordering = ['name']

    def __str__(self):
        return f'{self.agency.name} — {self.name}'

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_text(self.name)

        update_fields = kwargs.get('update_fields')

        if update_fields is not None:
            update_fields = set(update_fields)
            update_fields.add('normalized_name')
            kwargs['update_fields'] = list(update_fields)

        super().save(*args, **kwargs)


class AgencyManager(models.Model):
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name='managers', verbose_name='Агентство')
    name = models.CharField('Имя менеджера', max_length=200)
    phone = models.CharField('Телефон', max_length=20, blank=True)
    telegram_username = models.CharField('Юзернейм в телеграм', max_length=100, blank=True)
    comment = models.TextField('Комментарий', blank=True)
    is_active = models.BooleanField('Активен', default=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)

    class Meta:
        verbose_name = 'Менеджер агентства'
        verbose_name_plural = 'Менеджеры агентств'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.agency.name})'


class Role(models.Model):
    name = models.CharField('Наименование', max_length=50, unique=True)
    code = models.CharField('Код', max_length=30, blank=True, db_index=True)
    is_system = models.BooleanField('Системная роль', default=False)

    class Meta:
        verbose_name = 'Роль'
        verbose_name_plural = 'Роли'
        ordering = ['name']

    def __str__(self):
        return self.name


class Skill(models.Model):
    name = models.CharField('Навык', max_length=100, unique=True)

    class Meta:
        verbose_name = 'Навык'
        verbose_name_plural = 'Навыки'
        ordering = ['name']

    def __str__(self):
        return self.name


class CityGroup(models.Model):
    name = models.CharField('Название группы', max_length=200, unique=True)
    salary_bonus = models.DecimalField('Надбавка к ставке', max_digits=10, decimal_places=2, default=0)
    price_coefficient = models.DecimalField(
        'Коэффициент цены',
        max_digits=6,
        decimal_places=2,
        default=1,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Например, 2.28 — цена услуги умножается на 2.28',
    )
    order = models.PositiveIntegerField('Порядок', default=0)

    class Meta:
        verbose_name = 'Группа городов'
        verbose_name_plural = 'Группы городов'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class City(models.Model):
    name = models.CharField('Название города', max_length=200, unique=True)
    group = models.ForeignKey(CityGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name='cities', verbose_name='Группа')
    transport_costs = models.JSONField('Транспортные расходы', default=dict, blank=True)

    class Meta:
        verbose_name = 'Город'
        verbose_name_plural = 'Города'
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_transport_cost(self, people_count):
        if not self.transport_costs or people_count <= 0:
            return 0
        try:
            ranges = sorted([(int(k), v) for k, v in self.transport_costs.items() if str(k).isdigit()])
        except (ValueError, TypeError):
            return 0
        for max_people, cost in ranges:
            if people_count <= max_people:
                try:
                    return float(cost)
                except (ValueError, TypeError):
                    return 0
        if ranges:
            try:
                return float(ranges[-1][1])
            except (ValueError, TypeError):
                return 0
        return 0


class PriceRisePeriod(models.Model):
    start_date = models.DateField('Дата начала')
    end_date = models.DateField('Дата окончания')
    percent = models.DecimalField(
        'Процент повышения',
        max_digits=6,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Например, 10.5 — цена повышается на 10,5%',
    )
    is_active = models.BooleanField('Активен', default=True)
    comment = models.CharField('Комментарий', max_length=200, blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Период повышения цен'
        verbose_name_plural = 'Периоды повышения цен'
        ordering = ['-start_date']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F('start_date')),
                name='price_rise_period_end_after_start',
            ),
        ]

    def __str__(self):
        return f'{self.start_date:%d.%m.%Y} — {self.end_date:%d.%m.%Y}: +{self.percent}%'

    def covers(self, value):
        if not value or not self.is_active:
            return False

        return self.start_date <= value <= self.end_date

    @classmethod
    def active_periods(cls):
        return cls.objects.filter(is_active=True)

    @classmethod
    def find_for_date(cls, value):
        if not value:
            return None

        return cls.objects.filter(
            is_active=True,
            start_date__lte=value,
            end_date__gte=value,
        ).order_by('-start_date').first()

    @classmethod
    def percent_for_date(cls, value):
        period = cls.find_for_date(value)

        if not period:
            return Decimal('0')

        return Decimal(period.percent)


class CalendarColor(models.Model):
    COLOR_TYPES = [
        ('order', 'Заказ'),
        ('training', 'Тренировка'),
        ('event', 'Событие'),
    ]

    ORDER_STATUSES = [
        ('request', 'Запрос'),
        ('confirmed', 'Подтвержденный'),
        ('completed', 'Выполненный'),
    ]

    type = models.CharField('Тип', max_length=20, choices=COLOR_TYPES, default='order')
    status = models.CharField('Статус заказа', max_length=20, choices=ORDER_STATUSES, blank=True)
    background_color = models.CharField('Цвет фона', max_length=20, default='#2164c8')
    border_color = models.CharField('Цвет полосы', max_length=20, default='#2164c8')
    text_color = models.CharField('Цвет текста', max_length=20, default='#ddd4c7')
    is_active = models.BooleanField('Активен', default=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Цвет календаря'
        verbose_name_plural = 'Цвета календаря'
        ordering = ['type', 'status']
        unique_together = ['type', 'status']

    def __str__(self):
        if self.type == 'order':
            return f'Заказ — {self.get_status_display() or "—"}'
        return self.get_type_display()


class Employee(models.Model):
    USER_ROLES = ROLE_CHOICES

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    full_name = models.CharField('ФИО', max_length=200)
    nickname = models.CharField('Имя для обращения', max_length=100, blank=True)
    role = models.CharField('Основная роль', max_length=20, choices=ROLE_CHOICES, default=ROLE_ARTIST)
    roles = models.ManyToManyField(Role, related_name='employees', verbose_name='Дополнительные роли', blank=True)
    telegram_username = models.CharField('Юзернейм в телеграм', max_length=100, blank=True)
    phone = models.CharField('Номер телефона', max_length=20, blank=True)
    skills = models.ManyToManyField(Skill, related_name='employees', verbose_name='Навыки', blank=True)
    is_active = models.BooleanField('Активен', default=True)

    rzd_bonus_number = models.CharField('Номер РЖД бонус', max_length=50, blank=True)
    instagram = models.CharField('Инстаграм', max_length=100, blank=True)
    international_passport_series = models.CharField('Серия загранпаспорта', max_length=10, blank=True)
    international_passport_number = models.CharField('Номер загранпаспорта', max_length=20, blank=True)

    passport_series = models.CharField('Серия паспорта', max_length=10, blank=True)
    passport_number = models.CharField('Номер паспорта', max_length=20, blank=True)
    passport_issued_by = models.CharField('Кем выдан', max_length=500, blank=True)
    passport_issued_date = models.DateField('Дата выдачи', null=True, blank=True)
    passport_department_code = models.CharField('Код подразделения', max_length=20, blank=True)
    passport_registration = models.CharField('Адрес регистрации', max_length=500, blank=True)
    passport_inn = models.CharField('ИНН', max_length=20, blank=True)
    passport_snils = models.CharField('СНИЛС', max_length=20, blank=True)

    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Сотрудник'
        verbose_name_plural = 'Сотрудники'
        ordering = ['full_name']

    def __str__(self):
        return self.full_name

    @property
    def username(self):
        return self.user.username

    @property
    def email(self):
        return self.user.email

    @property
    def is_staff(self):
        return self.user.is_staff

    @property
    def is_superuser(self):
        return self.user.is_superuser

    @property
    def date_joined(self):
        return self.user.date_joined

    @property
    def last_login(self):
        return self.user.last_login

    @property
    def display_name(self):
        return self.nickname or self.full_name

    def short_name(self):
        return self.display_name

    def role_codes(self):
        codes = [self.role] if self.role else []

        for role_obj in self.roles.all():
            code = (role_obj.code or '').strip()
            if code and code not in codes:
                codes.append(code)

        return codes

    def has_role(self, *codes):
        available = self.role_codes()
        return any(code in available for code in codes)

    def is_artist(self):
        return self.role in ARTIST_ROLES

    def is_top(self):
        return self.role in TOP_ROLES

    def can_see_rates(self):
        return self.role in TOP_ROLES

    def can_see_costs(self):
        return self.role not in ARTIST_ROLES and self.role != ROLE_TECHNICIAN

    def can_manage_roles(self):
        return self.role in TOP_ROLES

    def can_edit_checklists(self):
        return True

    def can_build_checklists(self):
        return self.role in CHECKLIST_EDITOR_ROLES

    def can_manage_employees(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER]

    def can_manage_clients(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER, ROLE_SALES_MANAGER]

    def can_manage_orders(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER, ROLE_SALES_MANAGER, ROLE_PRODUCTION]

    def can_view_schedule(self):
        return self.role in [
            ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER, ROLE_SALES_MANAGER, ROLE_PRODUCTION,
            ROLE_CHOREOGRAPHER, ROLE_TECHNICIAN, ROLE_ARTIST,
        ]

    def can_create_trainings(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER, ROLE_CHOREOGRAPHER]

    def can_manage_services(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER, ROLE_PRODUCTION]

    def can_manage_cities(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER]

    def can_manage_calendar_colors(self):
        return self.role in TOP_ROLES

    def can_manage_money(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER]

    def can_view_reports(self):
        return self.role in [ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER]

    def can_send_feedback(self):
        return True

    def can_manage_feedback(self):
        return self.role in [
            ROLE_SENIOR_ADMIN, ROLE_BOSS, ROLE_MANAGER, ROLE_PRODUCTION,
            ROLE_CHOREOGRAPHER, ROLE_SALES_MANAGER,
        ]

    def can_view_own_profile(self):
        return True


class EmployeeDocument(models.Model):
    KIND_PASSPORT = 'passport'
    KIND_INTERNATIONAL = 'international_passport'
    KIND_OTHER = 'other'

    KINDS = [
        (KIND_PASSPORT, 'Паспорт'),
        (KIND_INTERNATIONAL, 'Загранпаспорт'),
        (KIND_OTHER, 'Другое'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents', verbose_name='Сотрудник')
    kind = models.CharField('Тип документа', max_length=30, choices=KINDS, default=KIND_PASSPORT)
    title = models.CharField('Подпись', max_length=200, blank=True)
    file = models.FileField('Файл', upload_to='employee_documents/%Y/%m/')
    uploaded_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_documents', verbose_name='Загрузил',
    )
    created_at = models.DateTimeField('Дата загрузки', auto_now_add=True)

    class Meta:
        verbose_name = 'Документ сотрудника'
        verbose_name_plural = 'Документы сотрудников'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.employee.full_name} — {self.get_kind_display()}'


class ArtistCard(models.Model):

    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='artist_card', verbose_name='Сотрудник')
    weight = models.CharField('Вес', max_length=50, blank=True)
    height = models.CharField('Рост', max_length=50, blank=True)
    shoe_size = models.CharField('Размер обуви', max_length=20, blank=True)
    skills_text = models.TextField('Навыки', blank=True)
    comment = models.TextField('Комментарий', blank=True)
    known_shows = models.ManyToManyField('Service', related_name='artist_cards', verbose_name='Знание шоу', blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Карточка артиста'
        verbose_name_plural = 'Карточки артистов'

    def __str__(self):
        return f'Карточка артиста - {self.employee.full_name}'


class TransportTicket(models.Model):
    TRANSPORT_TYPES = [
        ('plane', 'Самолёт'),
        ('train', 'Поезд'),
        ('bus', 'Автобус'),
        ('car', 'Автомобиль'),
        ('other', 'Другое'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='transport_tickets', verbose_name='Сотрудник')
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='transport_tickets', verbose_name='Заказ')
    transport_type = models.CharField('Тип транспорта', max_length=20, choices=TRANSPORT_TYPES, default='plane')
    from_city = models.CharField('Откуда', max_length=200, blank=True)
    to_city = models.CharField('Куда', max_length=200, blank=True)
    departure_datetime = models.DateTimeField('Дата и время отправления', null=True, blank=True)
    arrival_datetime = models.DateTimeField('Дата и время прибытия', null=True, blank=True)
    ticket_number = models.CharField('Номер билета', max_length=100, blank=True)
    carrier = models.CharField('Перевозчик', max_length=200, blank=True)
    cost = models.DecimalField('Стоимость', max_digits=10, decimal_places=2, default=0)
    comment = models.TextField('Комментарий', blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Транспортный билет'
        verbose_name_plural = 'Транспортные билеты'
        ordering = ['departure_datetime']

    def __str__(self):
        return f'{self.get_transport_type_display()} {self.from_city} → {self.to_city}'


class Client(models.Model):
    CLIENT_TYPE_CHOICES = [
        ('organizer', 'Организатор'),
        ('agency', 'Агентство'),
    ]

    RATING_CHOICES = [
        ('high', 'Высокий'),
        ('medium', 'Средний'),
        ('low', 'Низкий'),
    ]

    CONTACT_PHONE = 'phone'
    CONTACT_TELEGRAM = 'telegram'

    CONTACT_CHOICES = [
        (CONTACT_PHONE, 'Телефон'),
        (CONTACT_TELEGRAM, 'Телеграм'),
    ]

    full_name = models.CharField('ФИО клиента', max_length=200)
    client_type = models.CharField('Тип клиента', max_length=10, choices=CLIENT_TYPE_CHOICES, default='organizer')
    agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True, related_name='clients', verbose_name='Агентство')
    agency_manager = models.ForeignKey(AgencyManager, on_delete=models.SET_NULL, null=True, blank=True, related_name='clients', verbose_name='Менеджер агентства')
    contact_type = models.CharField('Тип контакта', max_length=10, choices=CONTACT_CHOICES, blank=True)
    phone = models.CharField('Номер телефона', max_length=20, blank=True)
    phone_normalized = models.CharField('Телефон (нормализованный)', max_length=20, blank=True, db_index=True, editable=False)
    telegram_username = models.CharField('Юзернейм в тг', max_length=100, blank=True)
    email = models.EmailField('Email', max_length=254, blank=True)
    full_name_normalized = models.CharField('ФИО (нормализованное)', max_length=200, blank=True, db_index=True, editable=False)
    city = models.CharField('Город', max_length=100, blank=True)
    cities = models.ManyToManyField(City, related_name='clients', blank=True, verbose_name='Города')
    rating = models.CharField('Рейтинг', max_length=10, choices=RATING_CHOICES, default='medium')
    comment = models.TextField('Комментарий', blank=True)
    is_active = models.BooleanField('Активен', default=True)
    deactivated_at = models.DateTimeField('Дата деактивации', null=True, blank=True)
    requests_count = models.PositiveIntegerField('Количество запросов', default=0)
    created_by = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='created_clients', verbose_name='Создан сотрудником')
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Клиент'
        verbose_name_plural = 'Клиенты'
        ordering = ['full_name']

    def __str__(self):
        return self.full_name

    @staticmethod
    def normalize_phone(value):
        return ''.join(filter(str.isdigit, value or ''))

    @staticmethod
    def normalize_name(value):
        words = [word for word in (value or '').lower().replace('ё', 'е').split() if word]
        return ' '.join(sorted(words))

    @staticmethod
    def detect_contact_type(value):
        text = (value or '').strip()

        if not text:
            return ''

        if text.startswith('@'):
            return Client.CONTACT_TELEGRAM

        digits = Client.normalize_phone(text)

        if digits and len(digits) >= 10:
            return Client.CONTACT_PHONE

        return Client.CONTACT_TELEGRAM

    @staticmethod
    def normalize_telegram(value):
        text = (value or '').strip()

        if not text:
            return ''

        text = re.sub(r'^https?://', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^(www\.)?(t\.me/|telegram\.me/|telegram\.dog/)', '', text, flags=re.IGNORECASE)
        text = text.split('?')[0].split('#')[0].strip('/').strip()

        return text.lstrip('@').strip()

    def save(self, *args, **kwargs):
        self.phone_normalized = self.normalize_phone(self.phone)
        self.full_name_normalized = self.normalize_name(self.full_name)
        self.telegram_username = self.normalize_telegram(self.telegram_username)

        if not self.contact_type:
            if self.phone:
                self.contact_type = self.CONTACT_PHONE
            elif self.telegram_username:
                self.contact_type = self.CONTACT_TELEGRAM

        update_fields = kwargs.get('update_fields')

        if update_fields is not None:
            update_fields = set(update_fields)
            update_fields.update({'phone_normalized', 'full_name_normalized', 'contact_type'})
            kwargs['update_fields'] = list(update_fields)

        super().save(*args, **kwargs)

    def get_cities_display(self):
        names = [city.name for city in self.cities.all()]
        if names:
            return ', '.join(names)
        return self.city or ''

    def get_contact_display(self):
        if self.contact_type == self.CONTACT_TELEGRAM and self.telegram_username:
            handle = self.telegram_username if self.telegram_username.startswith('@') else f'@{self.telegram_username}'
            return handle

        return self.phone or self.telegram_username or ''


class Service(models.Model):
    SERVICE_TYPES = [
        ('category', 'Каталог'),
        ('service', 'Услуга'),
    ]

    name = models.CharField('Название', max_length=200)
    type = models.CharField('Тип', max_length=10, choices=SERVICE_TYPES, default='category')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name='Родительский каталог')

    description = models.TextField('Описание', blank=True)
    duration = models.CharField('Длительность', max_length=100, blank=True)
    media_url = models.URLField('Ссылка на медиаконтент', max_length=500, blank=True)

    artist_rate = models.DecimalField('Ставка артиста', max_digits=10, decimal_places=2, default=0)

    order = models.PositiveIntegerField('Порядок', default=0)
    is_active = models.BooleanField('Активен', default=True)
    created_by = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='created_services', verbose_name='Создан сотрудником')
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Услуга'
        verbose_name_plural = 'Услуги'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_ancestors(self):
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current)
            current = current.parent
        return list(reversed(ancestors))

    def get_full_path(self):
        return ' / '.join([a.name for a in self.get_ancestors()] + [self.name])


class ServiceStaffRow(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='staff_rows', verbose_name='Услуга')
    artist_count = models.PositiveIntegerField('Кол-во артистов', validators=[MinValueValidator(1)])
    cost = models.DecimalField('Стоимость', max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    order = models.PositiveIntegerField('Порядок', default=0)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Строка персонала'
        verbose_name_plural = 'Строки персонала'
        ordering = ['order', 'artist_count', 'id']
        constraints = [
            models.CheckConstraint(condition=models.Q(artist_count__gt=0), name='service_staff_row_artist_count_positive'),
            models.CheckConstraint(condition=models.Q(cost__gt=0), name='service_staff_row_cost_positive'),
        ]

    def __str__(self):
        return f'{self.service.name}: {self.artist_count} арт. — {self.cost}'


class Order(models.Model):
    STATUS_CHOICES = [
        ('request', 'Запрос'),
        ('confirmed', 'Подтвержденный'),
        ('completed', 'Выполненный'),
    ]

    PAYMENT_CHOICES = [
        ('self', 'Самозанятость'),
        ('ip', 'ИП'),
        ('cash', 'Наличные'),
    ]

    name = models.CharField('Название заказа', max_length=300, blank=True, default='')
    auto_name = models.CharField('Название (автоматическое)', max_length=300, blank=True, default='')
    name_is_manual = models.BooleanField('Название изменено вручную', default=False)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='orders', verbose_name='Клиент')
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', verbose_name='Город')
    date = models.DateField('Дата проведения', null=True, blank=True)
    start_datetime = models.DateTimeField('Начало мероприятия', null=True, blank=True)
    end_datetime = models.DateTimeField('Окончание мероприятия', null=True, blank=True)
    address = models.CharField('Адрес', max_length=300, blank=True, default='')
    contact_name = models.CharField('Контактное лицо - имя', max_length=200, blank=True)
    contact_phone = models.CharField('Контактное лицо - номер телефона', max_length=20, blank=True)
    contact_telegram = models.CharField('Контактное лицо - телеграм', max_length=100, blank=True)
    chat_number = models.CharField('Номер узкого чата', max_length=100, blank=True, default='')
    setup_time = models.CharField('Время чека', max_length=20, blank=True)
    dressing_room_comment = models.TextField('Комментарии к гримерке', blank=True)
    meal_comment = models.TextField('Комментарии к еде', blank=True)
    concept = models.TextField('Концепция', blank=True)
    tech_lamps = models.BooleanField('Лампы', default=False)
    tech_laser = models.BooleanField('Лазер', default=False)
    tech_hazer = models.BooleanField('Хейзер', default=False)
    tech_grid = models.BooleanField('Сетка', default=False)
    tech_projection = models.BooleanField('Проекция', default=False)
    tech_comment = models.TextField('Комментарий к техничке', blank=True)
    venue_comment = models.TextField('Комментарии к площадке', blank=True)
    props_comment = models.TextField('Комментарии к реквизиту', blank=True)
    manager = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='managed_orders', verbose_name='Менеджер', null=True, blank=True)
    managers = models.ManyToManyField(Employee, related_name='co_managed_orders', verbose_name='Дополнительные менеджеры', blank=True)
    story_manager = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='story_orders', verbose_name='Сториз ответственный')
    cost = models.CharField('Общая стоимость', max_length=50, blank=True, default='—')
    payment_method = models.CharField('Способ оплаты', max_length=10, choices=PAYMENT_CHOICES, blank=True)
    payment_due_date = models.DateField('Дата оплаты по заказу', null=True, blank=True)
    payment_due_comment = models.CharField('Заметка к оплате', max_length=300, blank=True)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='request')
    duration = models.PositiveSmallIntegerField('Длительность (дней)', default=1)
    content_hash = models.CharField('Отпечаток данных', max_length=40, blank=True, default='')
    content_changed_at = models.DateTimeField('Данные изменены', null=True, blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'Заказ #{self.id} - {self.name or self.client.full_name}'

    CONTENT_FIELDS = [
        'name', 'client_id', 'city_id', 'date', 'start_datetime', 'end_datetime', 'address',
        'contact_name', 'contact_phone', 'contact_telegram', 'chat_number',
        'setup_time', 'dressing_room_comment', 'meal_comment', 'concept',
        'tech_lamps', 'tech_laser', 'tech_hazer', 'tech_grid', 'tech_projection', 'tech_comment',
        'venue_comment', 'props_comment', 'manager_id', 'story_manager_id', 'cost',
        'payment_method', 'status', 'duration', 'payment_due_date', 'payment_due_comment',
    ]

    def build_auto_name(self):
        from datetime import date as date_class

        parts = []

        if self.chat_number:
            parts.append(self.chat_number.strip())

        if self.date:
            months = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
            ]
            label = f'{self.date.day} {months[self.date.month - 1]}'

            if self.date.year != date_class.today().year:
                label = f'{label} {str(self.date.year)[2:]}'

            parts.append(label)

        if self.city:
            parts.append(self.city.name)

        for item in self.estimate_items.all().order_by('id'):
            if not item.service_name:
                continue

            title = item.service_name

            if item.people_count:
                title = f'{title} {item.people_count}'

            parts.append(title)

        return ', '.join(parts)

    def refresh_auto_name(self):
        self.auto_name = self.build_auto_name()

        if self.name_is_manual and self.name:
            return self.auto_name

        self.name = self.auto_name
        return self.auto_name

    def total_paid(self):
        return sum((payment.amount for payment in self.payments.filter(is_cancelled=False)), Decimal('0.00'))

    def is_paid(self):
        return self.total_paid() > 0

    def get_cost_value(self):
        try:
            return Decimal(str(self.cost or '0').replace(' ', '').replace('₽', '').replace(',', '.')).quantize(Decimal('0.01'))
        except (InvalidOperation, ValueError):
            return Decimal('0.00')

    def get_content_signature(self):
        items = []

        for field in self.CONTENT_FIELDS:
            value = getattr(self, field, None)
            items.append(f'{field}={value if value is not None else ""}')

        for item in self.estimate_items.all().order_by('id'):
            items.append(f'est:{item.service_name}:{item.people_count}:{item.coefficient}:{item.price}:{item.comment}:{item.is_overridden}:{item.is_main}')

        for item in self.employee_items.all().order_by('id'):
            items.append(f'emp:{item.employee_name}:{item.employee_role}:{item.payment}:{item.comment}:{item.is_overridden}:{item.is_story}:{item.is_responsible}')

        return '|'.join(items)

    def compute_content_hash(self):
        return hashlib.md5(self.get_content_signature().encode('utf-8')).hexdigest()

    def touch_content_change(self):
        if not self.content_hash:
            self.content_hash = self.compute_content_hash()
            self.content_changed_at = None
            return False

        new_hash = self.compute_content_hash()

        if new_hash == self.content_hash:
            return False

        self.content_hash = new_hash
        self.content_changed_at = timezone.now()
        return True

    def get_missing_fields(self):
        labels = {
            'name': 'название',
            'date': 'дата',
            'address': 'адрес',
            'setup_time': 'время чека',
            'contact_phone': 'телефон контакта',
            'contact_telegram': 'телеграм контакта',
            'city_id': 'город',
            'manager_id': 'менеджер',
            'client_id': 'клиент',
        }

        missing = []

        for field, label in labels.items():
            value = getattr(self, field, None)

            if value is None or (isinstance(value, str) and not value.strip()):
                missing.append(label)

        if not self.estimate_items.exists():
            missing.append('услуги')

        if not self.employee_items.exists():
            missing.append('сотрудники')

        cost_value = (self.cost or '').strip()

        if not cost_value or cost_value == '—':
            missing.append('стоимость')

        if not self.payment_method:
            missing.append('способ оплаты')

        return missing

    def is_incomplete(self):
        return bool(self.get_missing_fields())

    def get_tech_list(self):
        tech = []
        if self.tech_lamps:
            tech.append('Лампы')
        if self.tech_laser:
            tech.append('Лазер')
        if self.tech_hazer:
            tech.append('Хейзер')
        if self.tech_grid:
            tech.append('Сетка')
        if self.tech_projection:
            tech.append('Проекция')
        return tech


class OrderEstimate(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='estimate_items', verbose_name='Заказ')
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name='estimate_items', verbose_name='Услуга', null=True, blank=True)
    service_name = models.CharField('Название услуги', max_length=200)
    people_count = models.PositiveIntegerField('Количество человек', default=0)
    people_count_unknown = models.BooleanField('Количество не указано', default=False)
    coefficient = models.DecimalField('Коэффициент', max_digits=10, decimal_places=2, default=1)
    price = models.DecimalField('Стоимость', max_digits=12, decimal_places=2, default=0)
    comment = models.TextField('Комментарий', blank=True)
    is_overridden = models.BooleanField('Переопределена вручную', default=False)
    is_main = models.BooleanField('Основное шоу', default=False)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Смета заказа'
        verbose_name_plural = 'Сметы заказов'
        ordering = ['id']

    def __str__(self):
        return f'{self.service_name} - {self.price}'

    @property
    def total(self):
        return float(self.price) * float(self.coefficient)

    def get_people_label(self):
        if self.people_count_unknown:
            return ''
        return str(self.people_count or '')


class OrderEmployee(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='employee_items', verbose_name='Заказ')
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='order_items', verbose_name='Сотрудник')
    employee_name = models.CharField('ФИО сотрудника', max_length=200)
    employee_role = models.CharField('Роль', max_length=100, blank=True)
    role_code = models.CharField('Код роли', max_length=30, blank=True, default='')
    show = models.ForeignKey(OrderEstimate, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff', verbose_name='Шоу')
    payment = models.DecimalField('Оплата', max_digits=10, decimal_places=2, default=0)
    is_overridden = models.BooleanField('Ставка изменена вручную', default=False)
    is_story = models.BooleanField('Сториз', default=False)
    is_responsible = models.BooleanField('Ответственный', default=False)
    comment = models.TextField('Комментарий', blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Сотрудник заказа'
        verbose_name_plural = 'Сотрудники заказов'
        ordering = ['id']

    def __str__(self):
        return f'{self.employee_name} - {self.payment}'

    def get_show_label(self):
        if self.show_id is None:
            return ''

        return self.show.service_name


class OrderPayment(models.Model):

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments', verbose_name='Заказ')
    amount = models.DecimalField('Сумма', max_digits=12, decimal_places=2, default=0)
    paid_at = models.DateField('Дата оплаты')
    comment = models.CharField('Комментарий', max_length=300, blank=True)
    is_cancelled = models.BooleanField('Отменена', default=False)
    cancelled_at = models.DateTimeField('Когда отменена', null=True, blank=True)
    created_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_order_payments', verbose_name='Зафиксировал',
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Оплата по заказу'
        verbose_name_plural = 'Оплаты по заказам'
        ordering = ['paid_at', 'id']
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gte=0), name='order_payment_amount_non_negative'),
        ]
        indexes = [
            models.Index(fields=['order', 'paid_at']),
        ]

    def __str__(self):
        return f'{self.order_id} - {self.amount} - {self.paid_at}'


class ChecklistTemplate(models.Model):
    name = models.CharField('Название', max_length=200)
    service = models.ForeignKey(
        Service, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='checklist_templates', verbose_name='Шоу',
    )
    is_active = models.BooleanField('Активен', default=True)
    is_default = models.BooleanField('Проверять в каждом заказе', default=False)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Шаблон чек-листа'
        verbose_name_plural = 'Шаблоны чек-листов'
        ordering = ['name']

    def __str__(self):
        return self.name

    def matches_show(self, service, name):
        if self.service_id and service is not None and self.service_id == service.id:
            return True

        if not self.service_id and name:
            return ' '.join(self.name.lower().split()) == ' '.join(name.lower().split())

        return False


class ChecklistItem(models.Model):
    template = models.ForeignKey(ChecklistTemplate, on_delete=models.CASCADE, null=True, blank=True, related_name='items', verbose_name='Шаблон')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, null=True, blank=True, related_name='checklist_items', verbose_name='Заказ')
    show = models.ForeignKey(OrderEstimate, on_delete=models.SET_NULL, null=True, blank=True, related_name='checklist_items', verbose_name='Шоу')
    text = models.CharField('Пункт', max_length=500)
    is_done = models.BooleanField('Выполнено', default=False)
    order_index = models.PositiveIntegerField('Порядок', default=0)
    created_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_checklist_items', verbose_name='Создал',
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Пункт чек-листа'
        verbose_name_plural = 'Пункты чек-листов'
        ordering = ['order_index', 'id']

    def __str__(self):
        return self.text


class OrderShowTemplate(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='show_templates', verbose_name='Заказ')
    template = models.ForeignKey(ChecklistTemplate, on_delete=models.CASCADE, related_name='show_orders', verbose_name='Шаблон')
    show = models.ForeignKey(OrderEstimate, on_delete=models.CASCADE, null=True, blank=True, related_name='show_checklist_templates', verbose_name='Шоу')
    is_detached = models.BooleanField('Отвязан от заказа', default=False)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)

    class Meta:
        verbose_name = 'Чек-лист заказа по шоу'
        verbose_name_plural = 'Чек-листы заказов по шоу'
        ordering = ['id']

    def __str__(self):
        return f'{self.order_id} - {self.template.name}'


class OrderFeedback(models.Model):
    KIND_COMMENT = 'comment'
    KIND_ISSUE = 'issue'
    KIND_IDEA = 'idea'

    KINDS = [
        (KIND_COMMENT, 'Замечание'),
        (KIND_ISSUE, 'Проблема'),
        (KIND_IDEA, 'Идея'),
    ]

    STATUS_NEW = 'new'
    STATUS_READ = 'read'
    STATUS_DONE = 'done'

    STATUSES = [
        (STATUS_NEW, 'Новое'),
        (STATUS_READ, 'Прочитано'),
        (STATUS_DONE, 'Решено'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='feedback', verbose_name='Заказ')
    author = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_sent', verbose_name='Автор')
    kind = models.CharField('Тип', max_length=20, choices=KINDS, default=KIND_COMMENT)
    text = models.TextField('Текст')
    status = models.CharField('Статус', max_length=20, choices=STATUSES, default=STATUS_NEW)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Обратная связь по заказу'
        verbose_name_plural = 'Обратная связь по заказам'
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['order']),
        ]

    def __str__(self):
        return f'{self.order_id} - {self.get_kind_display()}'


class OrderExpense(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_COMPANY = 'company'
    STATUS_TEAM = 'team'

    STATUSES = [
        (STATUS_PENDING, 'На рассмотрении'),
        (STATUS_COMPANY, 'Оплачено с корпоративного счёта'),
        (STATUS_TEAM, 'Оплачено командой'),
    ]

    RESOLVED_STATUSES = [STATUS_COMPANY, STATUS_TEAM]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='expenses', verbose_name='Заказ')
    payer_name = models.CharField('Кто оплатил', max_length=200)
    amount = models.DecimalField('Сумма', max_digits=12, decimal_places=2, default=0)
    comment = models.TextField('Комментарий', blank=True)
    status = models.CharField('Статус', max_length=20, choices=STATUSES, default=STATUS_PENDING)
    period_date = models.DateField('Дата расхода', null=True, blank=True)

    decided_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='decided_expenses', verbose_name='Решение принял',
    )
    decided_at = models.DateTimeField('Когда решено', null=True, blank=True)

    created_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_expenses', verbose_name='Создал',
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Расход по заказу'
        verbose_name_plural = 'Расходы по заказам'
        ordering = ['-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gte=0), name='order_expense_amount_non_negative'),
        ]
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.order_id} - {self.payer_name} - {self.amount}'

    @property
    def is_pending(self):
        return self.status == self.STATUS_PENDING

    def get_status_class(self):
        if self.status == self.STATUS_COMPANY:
            return 'company'

        if self.status == self.STATUS_TEAM:
            return 'team'

        return 'pending'


class ArtistSchedule(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='artist_schedules', verbose_name='Сотрудник')
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name='artist_schedules', verbose_name='Мероприятие')
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Расписание артиста'
        verbose_name_plural = 'Расписание артистов'
        ordering = ['order__date']
        unique_together = ['employee', 'order']

    def __str__(self):
        return f'{self.employee.full_name} - {self.order}'


class AvailabilityInterval(models.Model):
    start_time = models.TimeField('С')
    end_time = models.TimeField('До')

    class Meta:
        ordering = ['start_time', 'id']
        constraints = [
            models.CheckConstraint(condition=models.Q(end_time__gt=models.F('start_time')), name='availability_interval_end_after_start'),
        ]

    def __str__(self):
        return f'{self.start_time:%H:%M}–{self.end_time:%H:%M}'

    def label(self):
        return f'{self.start_time:%H:%M}–{self.end_time:%H:%M}'


class ArtistAvailability(models.Model):
    ACTION_DAY = 'day'
    ACTION_OFF = 'off'
    ACTION_PARTIAL = 'partial'

    ACTIONS = [
        (ACTION_DAY, 'Свободен весь день'),
        (ACTION_OFF, 'Занят весь день'),
        (ACTION_PARTIAL, 'Занят с ... до ...'),
    ]

    KIND_WEEKLY = 'weekly'
    KIND_EXCEPTION = 'exception'

    KINDS = [
        (KIND_WEEKLY, 'Шаблон недели'),
        (KIND_EXCEPTION, 'Исключение на даты'),
    ]

    LAST_WEEKDAY = 6

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='availability_rules', verbose_name='Сотрудник')
    kind = models.CharField('Тип правила', max_length=10, choices=KINDS, default=KIND_WEEKLY)
    weekday = models.PositiveSmallIntegerField('День недели', null=True, blank=True)
    start_date = models.DateField('С даты', null=True, blank=True)
    end_date = models.DateField('По дату', null=True, blank=True)
    action = models.CharField('Действие', max_length=10, choices=ACTIONS, default=ACTION_DAY)
    intervals = models.JSONField('Промежутки', default=list, blank=True)
    comment = models.CharField('Комментарий', max_length=200, blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Доступность артиста'
        verbose_name_plural = 'Доступность артистов'
        ordering = ['weekday', 'start_date', 'id']
        indexes = [
            models.Index(fields=['employee', 'kind']),
            models.Index(fields=['employee', 'start_date']),
        ]

    def __str__(self):
        return f'{self.employee.full_name} - {self.get_action_display()}'

    def interval_labels(self):
        labels = []

        for item in self.intervals or []:
            if isinstance(item, dict):
                start = item.get('start') or ''
                end = item.get('end') or ''
            else:
                start, end = '', ''

            if start and end:
                labels.append(f'{start}–{end}')

        return labels

    def label(self):
        if self.action == self.ACTION_DAY:
            return 'Весь день'

        if self.action == self.ACTION_OFF:
            return 'Занят весь день'

        labels = self.interval_labels()

        return ', '.join(labels) if labels else 'Занят'


WEEKDAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']


def normalize_intervals(values):
    result = []

    for value in values or []:
        if not isinstance(value, dict):
            continue

        start = str(value.get('start') or '').strip()[:5]
        end = str(value.get('end') or '').strip()[:5]

        if len(start) != 5 or len(end) != 5:
            continue

        try:
            start_dt = datetime.strptime(start, '%H:%M').time()
            end_dt = datetime.strptime(end, '%H:%M').time()
        except ValueError:
            continue

        if end_dt <= start_dt:
            continue

        result.append({'start': start, 'end': end})

    result.sort(key=lambda item: item['start'])

    merged = []

    for item in result:
        if merged and item['start'] <= merged[-1]['end']:
            if item['end'] > merged[-1]['end']:
                merged[-1]['end'] = item['end']
        else:
            merged.append(dict(item))

    return merged


def resolve_availability(employee, target_date):
    weekday = target_date.weekday()

    weekly = employee.availability_rules.filter(
        kind=ArtistAvailability.KIND_WEEKLY,
        weekday=weekday,
    ).order_by('-updated_at', '-id').first()

    action = ArtistAvailability.ACTION_DAY
    intervals = []

    if weekly is not None:
        action = weekly.action
        intervals = normalize_intervals(weekly.intervals)

    exception = employee.availability_rules.filter(
        kind=ArtistAvailability.KIND_EXCEPTION,
        start_date__lte=target_date,
        end_date__gte=target_date,
    ).order_by('-updated_at', '-id').first()

    if exception is not None:
        action = exception.action
        intervals = normalize_intervals(exception.intervals)

    data = {'date': target_date.strftime('%Y-%m-%d'), 'action': action, 'intervals': []}

    if action == ArtistAvailability.ACTION_DAY:
        data['status'] = 'free'
        data['label'] = 'Весь день'
        return data

    if action == ArtistAvailability.ACTION_OFF:
        data['status'] = 'off'
        data['label'] = 'Занят весь день'
        return data

    labels = [f'{item["start"]}–{item["end"]}' for item in intervals]

    data['status'] = 'partial'
    data['intervals'] = intervals
    data['label'] = ', '.join(labels) if labels else 'Занят'
    data['free_ranges'] = free_ranges_for_intervals(intervals)

    return data


def time_to_minutes(value):
    try:
        hours, minutes = str(value).strip()[:5].split(':')
        return int(hours) * 60 + int(minutes)
    except (AttributeError, TypeError, ValueError):
        return None


def complement_intervals(start, end):
    start_minutes = time_to_minutes(start)
    end_minutes = time_to_minutes(end)

    if start_minutes is None or end_minutes is None:
        return []

    result = []

    if start_minutes > 0:
        result.append({'start': '00:00', 'end': f'{start_minutes // 60:02d}:{start_minutes % 60:02d}'})

    if end_minutes < 1440:
        result.append({'start': f'{end_minutes // 60:02d}:{end_minutes % 60:02d}', 'end': '24:00'})

    return result


def free_ranges_for_intervals(intervals):
    covered = []

    for item in intervals or []:
        covered.append({
            'start': time_to_minutes(item.get('start')),
            'end': time_to_minutes(item.get('end')),
        })

    covered = [item for item in covered if item['start'] is not None and item['end'] is not None]

    if not covered:
        return [{'start': '00:00', 'end': '24:00'}]

    covered.sort(key=lambda item: item['start'])

    merged = []

    for item in covered:
        if merged and item['start'] <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], item['end']))
        else:
            merged.append((item['start'], item['end']))

    result = []
    cursor = 0

    for start_minutes, end_minutes in merged:
        if start_minutes > cursor:
            result.append({'start': f'{cursor // 60:02d}:{cursor % 60:02d}', 'end': f'{start_minutes // 60:02d}:{start_minutes % 60:02d}'})

        cursor = max(cursor, end_minutes)

    if cursor < 1440:
        result.append({'start': f'{cursor // 60:02d}:{cursor % 60:02d}', 'end': '24:00'})

    return result


class MoneyAccrual(models.Model):
    CATEGORY_ORDER = 'order'
    CATEGORY_SALARY = 'salary'
    CATEGORY_HOURS = 'hours'
    CATEGORY_DAILY = 'daily'
    CATEGORY_BONUS = 'bonus'
    CATEGORY_DEDUCTION = 'deduction'
    CATEGORY_SOURCE = 'source'

    CATEGORIES = [
        (CATEGORY_ORDER, 'Ставка за заказ'),
        (CATEGORY_SALARY, 'Оклад'),
        (CATEGORY_HOURS, 'Часы и %'),
        (CATEGORY_DAILY, 'Суточные'),
        (CATEGORY_BONUS, 'Премия'),
        (CATEGORY_DEDUCTION, 'Вычет'),
        (CATEGORY_SOURCE, 'Откат начисления'),
    ]

    ORDER_CATEGORIES = [CATEGORY_ORDER]
    MANUAL_CATEGORIES = [CATEGORY_SALARY, CATEGORY_HOURS, CATEGORY_DAILY, CATEGORY_BONUS, CATEGORY_DEDUCTION]
    NEGATIVE_CATEGORIES = [CATEGORY_DEDUCTION, CATEGORY_SOURCE]

    STATUS_ACTIVE = 'active'
    STATUS_CANCELLED = 'cancelled'

    STATUSES = [
        (STATUS_ACTIVE, 'Активно'),
        (STATUS_CANCELLED, 'Отменено'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='money_accruals', verbose_name='Сотрудник')
    category = models.CharField('Статья', max_length=20, choices=CATEGORIES, default=CATEGORY_ORDER)
    amount = models.DecimalField('Сумма', max_digits=12, decimal_places=2, default=0)

    period_date = models.DateField('Дата начисления')
    order = models.ForeignKey(
        Order, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='money_accruals', verbose_name='Заказ',
    )
    order_employee = models.ForeignKey(
        OrderEmployee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='money_accruals', verbose_name='Строка заказа',
    )

    title = models.CharField('За что', max_length=300, blank=True, default='')
    comment = models.TextField('Комментарий', blank=True)

    status = models.CharField('Статус', max_length=20, choices=STATUSES, default=STATUS_ACTIVE)
    cancelled_at = models.DateTimeField('Когда отменено', null=True, blank=True)
    cancelled_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cancelled_money_accruals', verbose_name='Отменил',
    )

    created_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_money_accruals', verbose_name='Создал',
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Начисление'
        verbose_name_plural = 'Деньги: начисления'
        ordering = ['period_date', 'id']
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gte=0), name='money_accrual_amount_non_negative'),
        ]
        indexes = [
            models.Index(fields=['employee', 'period_date']),
            models.Index(fields=['order']),
        ]

    def __str__(self):
        return f'{self.employee.full_name} - {self.get_category_display()} - {self.amount}'

    @property
    def is_active(self):
        return self.status == self.STATUS_ACTIVE

    def signed_amount(self):
        if not self.is_active:
            return Decimal('0')
        if self.category in self.NEGATIVE_CATEGORIES:
            return -self.amount
        return self.amount


class MoneyPayout(models.Model):
    METHOD_CASH = 'cash'
    METHOD_TRANSFER = 'transfer'

    METHODS = [
        (METHOD_CASH, 'Наличными'),
        (METHOD_TRANSFER, 'Переводом'),
    ]

    KIND_ORDER = 'order'
    KIND_MONTH = 'month'
    KIND_MANUAL = 'manual'

    KINDS = [
        (KIND_ORDER, 'Выплата по заказу'),
        (KIND_MONTH, 'Выплата по месяцам'),
        (KIND_MANUAL, 'Выплата вручную'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='money_payouts', verbose_name='Сотрудник')
    amount = models.DecimalField('Сумма', max_digits=12, decimal_places=2, default=0)
    method = models.CharField('Способ', max_length=10, choices=METHODS, default=METHOD_CASH)
    kind = models.CharField('Тип выплаты', max_length=20, choices=KINDS, default=KIND_MANUAL)
    period_date = models.DateField('Дата выплаты')
    period_start = models.DateField('Начало периода', null=True, blank=True)
    period_end = models.DateField('Конец периода', null=True, blank=True)
    comment = models.TextField('Комментарий', blank=True)

    is_reverted = models.BooleanField('Отменена', default=False)
    reverted_at = models.DateTimeField('Когда отменена', null=True, blank=True)
    reverted_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reverted_money_payouts', verbose_name='Отменил',
    )

    created_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_money_payouts', verbose_name='Создал',
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Выплата'
        verbose_name_plural = 'Деньги: выплаты'
        ordering = ['-period_date', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gte=0), name='money_payout_amount_non_negative'),
        ]
        indexes = [
            models.Index(fields=['employee', 'period_date']),
        ]

    def __str__(self):
        return f'{self.employee.full_name} - {self.amount} - {self.get_method_display()}'

    @property
    def is_active(self):
        return not self.is_reverted