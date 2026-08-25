from django.db import models
from django.contrib.auth.models import AbstractUser
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


class Employee(AbstractUser):
    ROLE_CHOICES = [
        ('manager', 'Менеджер'),
        ('admin', 'Администратор'),
        ('senior_admin', 'Старший администратор'),
        ('artist', 'Артист'),
        ('tech', 'Техник'),
    ]

    username = models.CharField('Логин', max_length=150, unique=True)
    password = models.CharField('Пароль', max_length=128)
    full_name = models.CharField('ФИО', max_length=200)
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='employees', verbose_name='Должность')
    photo = models.ImageField('Фотография', upload_to='employees/', blank=True, null=True)
    telegram_username = models.CharField('Юзернейм в телеграм', max_length=100, blank=True)
    phone = models.CharField('Номер телефона', max_length=20, blank=True)
    skills = models.ManyToManyField(Skill, related_name='employees', verbose_name='Навыки', blank=True)
    is_active = models.BooleanField('Активен', default=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='Группы',
        blank=True,
        help_text='Группы, к которым принадлежит этот пользователь. Пользователь получает все разрешения, предоставленные каждой из его групп.',
        related_name='employee_groups',
        related_query_name='employee',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='Разрешения пользователя',
        blank=True,
        help_text='Конкретные разрешения для этого пользователя.',
        related_name='employee_permissions',
        related_query_name='employee',
    )

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['full_name', 'role']

    class Meta:
        verbose_name = 'Сотрудник'
        verbose_name_plural = 'Сотрудники'
        ordering = ['full_name']

    def __str__(self):
        return self.full_name


class Client(models.Model):
    RATING_CHOICES = [
        ('high', 'Высокий'),
        ('medium', 'Средний'),
        ('low', 'Низкий'),
    ]

    full_name = models.CharField('ФИО клиента', max_length=200)
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


class Order(models.Model):
    STATUS_CHOICES = [
        ('request', 'Запрос'),
        ('confirmed', 'Подтверждено'),
        ('in_progress', 'В работе'),
        ('completed', 'Выполнено'),
        ('paid', 'Оплачено'),
    ]

    PAYMENT_CHOICES = [
        ('self', 'Самозанятость'),
        ('ip', 'ИП'),
        ('cash', 'Наличные'),
    ]

    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='orders', verbose_name='Клиент')
    date = models.DateField('Дата проведения')
    address = models.CharField('Адрес', max_length=300)
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
    manager = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='managed_orders', verbose_name='Менеджер')
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
        return f'Заказ #{self.id} - {self.client.full_name}'

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