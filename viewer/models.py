from django.db import models
from django.contrib.auth.models import User
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
    telegram_username = models.CharField('Юзернейм в тг', max_length=100, blank=True)
    email = models.EmailField('Email', max_length=254, blank=True)
    city = models.CharField('Город', max_length=100, blank=True)
    rating = models.CharField('Рейтинг', max_length=10, choices=RATING_CHOICES, default='medium')
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


class Service(models.Model):
    SERVICE_TYPES = [
        ('category', 'Каталог'),
        ('service', 'Услуга'),
    ]

    PAYMENT_METHODS = [
        ('cash', 'Наличные'),
        ('self', 'Самозанятость'),
        ('ip', 'ИП'),
    ]

    name = models.CharField('Название', max_length=200)
    type = models.CharField('Тип', max_length=10, choices=SERVICE_TYPES, default='category')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', verbose_name='Родительский каталог')

    description = models.TextField('Описание', blank=True)
    duration = models.CharField('Длительность', max_length=100, blank=True)
    media_url = models.URLField('Ссылка на медиаконтент', max_length=500, blank=True)

    artist_min = models.PositiveIntegerField('Артисты (мин)', default=0)
    artist_max = models.PositiveIntegerField('Артисты (макс)', default=0)
    artist_rate = models.DecimalField('Ставка артиста', max_digits=10, decimal_places=2, default=0)

    technician_min = models.PositiveIntegerField('Техники (мин)', default=0)
    technician_max = models.PositiveIntegerField('Техники (макс)', default=0)
    technician_rate = models.DecimalField('Ставка техника', max_digits=10, decimal_places=2, default=0)

    driver_min = models.PositiveIntegerField('Водители (мин)', default=0)
    driver_max = models.PositiveIntegerField('Водители (макс)', default=0)
    driver_rate = models.DecimalField('Ставка водителя', max_digits=10, decimal_places=2, default=0)

    amortization = models.DecimalField('Амортизация', max_digits=10, decimal_places=2, default=0)
    logist = models.DecimalField('Логист', max_digits=10, decimal_places=2, default=0)
    laser = models.DecimalField('Лазер', max_digits=10, decimal_places=2, default=0)
    manager_salary = models.DecimalField('ЗП менеджера', max_digits=10, decimal_places=2, default=0)
    unforeseen = models.DecimalField('Запас на непредвиденные', max_digits=10, decimal_places=2, default=0)
    extra_margin = models.DecimalField('Доп. моржа', max_digits=10, decimal_places=2, default=0)

    payment_method = models.CharField('Способ оплаты', max_length=10, choices=PAYMENT_METHODS, default='cash')

    overridden_total = models.DecimalField('Переопределённая стоимость', max_digits=12, decimal_places=2, null=True, blank=True)

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

    def calculate_for_city(self, city, people_count=None):
        if self.type != 'service':
            return None

        if city is None:
            city = City.objects.filter(name__iexact='Казань').first()

        salary_bonus = 0
        if city and city.group:
            salary_bonus = float(city.group.salary_bonus)

        artist_min = self.artist_min
        technician_min = self.technician_min
        driver_min = self.driver_min

        if people_count is not None:
            total_min = artist_min + technician_min + driver_min
            if people_count > total_min:
                extra = people_count - total_min
                if artist_min > 0:
                    artist_min += extra
                elif technician_min > 0:
                    technician_min += extra
                elif driver_min > 0:
                    driver_min += extra

        artist_sum = artist_min * (float(self.artist_rate) + salary_bonus)
        technician_sum = technician_min * (float(self.technician_rate) + salary_bonus)
        driver_sum = driver_min * (float(self.driver_rate) + salary_bonus)

        total_people = artist_min + technician_min + driver_min
        transport = 0
        if city:
            transport = city.get_transport_cost(total_people)

        amortization = float(self.amortization)
        logist = float(self.logist)
        laser = float(self.laser)
        manager_salary = float(self.manager_salary)
        unforeseen = float(self.unforeseen)
        extra_margin = float(self.extra_margin)

        subtotal = (
            artist_sum + technician_sum + driver_sum + transport +
            amortization + logist + laser + manager_salary + unforeseen + extra_margin
        )

        coefficient = 1.0
        if self.payment_method == 'self':
            coefficient = 1 / 0.94
        elif self.payment_method == 'ip':
            coefficient = 1 / 0.9

        total = subtotal * coefficient

        return {
            'city_id': city.id if city else None,
            'city_name': city.name if city else None,
            'salary_bonus': salary_bonus,
            'artist_sum': artist_sum,
            'technician_sum': technician_sum,
            'driver_sum': driver_sum,
            'transport': transport,
            'total_people': total_people,
            'amortization': amortization,
            'logist': logist,
            'laser': laser,
            'manager_salary': manager_salary,
            'unforeseen': unforeseen,
            'extra_margin': extra_margin,
            'payment_method': self.payment_method,
            'coefficient': coefficient,
            'subtotal': subtotal,
            'total': total,
        }


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
    date = models.DateField('Дата проведения')
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
    cost = models.CharField('Стоимость', max_length=50, blank=True, default='—')
    payment_method = models.CharField('Способ оплаты', max_length=10, choices=PAYMENT_CHOICES, blank=True)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='request')
    duration = models.PositiveSmallIntegerField('Длительность (дней)', default=1)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'Заказ #{self.id} - {self.name or self.client.full_name}'

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