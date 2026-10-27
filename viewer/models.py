import hashlib

from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.utils import timezone


class Agency(models.Model):
    name = models.CharField('Название', max_length=200, unique=True)

    class Meta:
        verbose_name = 'Агентство'
        verbose_name_plural = 'Агентства'
        ordering = ['name']

    def __str__(self):
        return self.name


class Role(models.Model):
    name = models.CharField('Наименование', max_length=50, unique=True)

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

    class Meta:
        verbose_name = 'Группа городов'
        verbose_name_plural = 'Группы городов'
        ordering = ['name']

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
    USER_ROLES = [
        ('artist', 'Артист'),
        ('technician', 'Техник'),
        ('choreographer', 'Хореограф'),
        ('manager', 'Управляющий'),
        ('sales_manager', 'Менеджер'),
        ('production', 'Выпускающий'),
        ('senior_admin', 'Старший администратор'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    full_name = models.CharField('ФИО', max_length=200)
    role = models.CharField('Роль', max_length=20, choices=USER_ROLES, default='artist')
    telegram_username = models.CharField('Юзернейм в телеграм', max_length=100, blank=True)
    phone = models.CharField('Номер телефона', max_length=20, blank=True)
    skills = models.ManyToManyField(Skill, related_name='employees', verbose_name='Навыки', blank=True)
    is_active = models.BooleanField('Активен', default=True)

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

    def can_manage_employees(self):
        return self.role in ['senior_admin', 'manager']

    def can_manage_clients(self):
        return self.role in ['senior_admin', 'manager', 'sales_manager']

    def can_manage_orders(self):
        return self.role in ['senior_admin', 'manager', 'sales_manager', 'production']

    def can_view_schedule(self):
        return self.role in [
            'senior_admin', 'manager', 'sales_manager', 'production',
            'choreographer', 'technician', 'artist',
        ]

    def can_create_trainings(self):
        return self.role in ['senior_admin', 'manager', 'choreographer']

    def can_manage_services(self):
        return self.role in ['senior_admin', 'manager', 'production']

    def can_manage_cities(self):
        return self.role in ['senior_admin', 'manager']

    def can_manage_calendar_colors(self):
        return self.role == 'senior_admin'

    def can_view_own_profile(self):
        return True


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

    full_name = models.CharField('ФИО клиента', max_length=200)
    client_type = models.CharField('Тип клиента', max_length=10, choices=CLIENT_TYPE_CHOICES, default='organizer')
    agency = models.ForeignKey(Agency, on_delete=models.SET_NULL, null=True, blank=True, related_name='clients', verbose_name='Агентство')
    phone = models.CharField('Номер телефона', max_length=20)
    phone_normalized = models.CharField('Телефон (нормализованный)', max_length=20, blank=True, db_index=True, editable=False)
    telegram_username = models.CharField('Юзернейм в тг', max_length=100, blank=True)
    email = models.EmailField('Email', max_length=254, blank=True)
    full_name_normalized = models.CharField('ФИО (нормализованное)', max_length=200, blank=True, db_index=True, editable=False)
    city = models.CharField('Город', max_length=100, blank=True)
    cities = models.ManyToManyField(City, related_name='clients', blank=True, verbose_name='Города')
    rating = models.CharField('Рейтинг', max_length=10, choices=RATING_CHOICES, default='medium')
    comment = models.TextField('Комментарий', blank=True)
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

    def save(self, *args, **kwargs):
        self.phone_normalized = self.normalize_phone(self.phone)
        self.full_name_normalized = self.normalize_name(self.full_name)

        update_fields = kwargs.get('update_fields')

        if update_fields is not None:
            update_fields = set(update_fields)
            update_fields.update({'phone_normalized', 'full_name_normalized'})
            kwargs['update_fields'] = list(update_fields)

        super().save(*args, **kwargs)

    def get_cities_display(self):
        names = [city.name for city in self.cities.all()]
        if names:
            return ', '.join(names)
        return self.city or ''


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
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='orders', verbose_name='Клиент')
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', verbose_name='Город')
    date = models.DateField('Дата проведения', null=True, blank=True)
    address = models.CharField('Адрес', max_length=300, blank=True, default='')
    contact_phone = models.CharField('Контактное лицо - номер телефона', max_length=20, blank=True)
    contact_telegram = models.CharField('Контактное лицо - телеграм', max_length=100, blank=True)
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
    story_manager = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='story_orders', verbose_name='Сториз ответственный')
    cost = models.CharField('Общая стоимость', max_length=50, blank=True, default='—')
    payment_method = models.CharField('Способ оплаты', max_length=10, choices=PAYMENT_CHOICES, blank=True)
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
        'name', 'client_id', 'city_id', 'date', 'address', 'contact_phone', 'contact_telegram',
        'setup_time', 'dressing_room_comment', 'meal_comment', 'concept',
        'tech_lamps', 'tech_laser', 'tech_hazer', 'tech_grid', 'tech_projection', 'tech_comment',
        'venue_comment', 'props_comment', 'manager_id', 'story_manager_id', 'cost',
        'payment_method', 'status', 'duration',
    ]

    def get_content_signature(self):
        items = []

        for field in self.CONTENT_FIELDS:
            value = getattr(self, field, None)
            items.append(f'{field}={value if value is not None else ""}')

        for item in self.estimate_items.all().order_by('id'):
            items.append(f'est:{item.service_name}:{item.people_count}:{item.coefficient}:{item.price}:{item.comment}:{item.is_overridden}')

        for item in self.employee_items.all().order_by('id'):
            items.append(f'emp:{item.employee_name}:{item.employee_role}:{item.payment}:{item.comment}:{item.is_overridden}')

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
    coefficient = models.DecimalField('Коэффициент', max_digits=10, decimal_places=2, default=1)
    price = models.DecimalField('Стоимость', max_digits=12, decimal_places=2, default=0)
    comment = models.TextField('Комментарий', blank=True)
    is_overridden = models.BooleanField('Переопределена вручную', default=False)
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


class OrderEmployee(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='employee_items', verbose_name='Заказ')
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='order_items', verbose_name='Сотрудник')
    employee_name = models.CharField('ФИО сотрудника', max_length=200)
    employee_role = models.CharField('Роль', max_length=100, blank=True)
    payment = models.DecimalField('Оплата', max_digits=10, decimal_places=2, default=0)
    is_overridden = models.BooleanField('Ставка изменена вручную', default=False)
    comment = models.TextField('Комментарий', blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Сотрудник заказа'
        verbose_name_plural = 'Сотрудники заказов'
        ordering = ['id']

    def __str__(self):
        return f'{self.employee_name} - {self.payment}'


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