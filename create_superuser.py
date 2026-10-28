import os
from datetime import date, datetime, timedelta

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jiva.settings')
django.setup()

from django.contrib.auth.models import User
from viewer.models import (
    Employee, Role, ArtistCard, CalendarColor, Skill,
    Client, Agency, City, CityGroup, Service, ServiceStaffRow, Order,
    OrderEstimate, OrderEmployee, TransportTicket,
)


DEFAULT_USERS = [
    {
        'username': 'PECNAS',
        'password': 'admin',
        'full_name': 'Старший администратор',
        'role': 'senior_admin',
        'is_superuser': True,
        'is_staff': True,
        'phone': '+7 (917) 265-41-08',
        'telegram_username': 'jiva_senior',
    },
    {
        'username': 'manager',
        'password': 'manager',
        'full_name': 'Управляющий',
        'role': 'manager',
        'is_superuser': False,
        'is_staff': True,
        'phone': '+7 (917) 265-41-09',
        'telegram_username': 'jiva_manager',
    },
    {
        'username': 'sales_manager',
        'password': 'sales_manager',
        'full_name': 'Менеджер',
        'role': 'sales_manager',
        'is_superuser': False,
        'is_staff': True,
        'phone': '+7 (917) 265-41-10',
        'telegram_username': 'jiva_sales',
    },
    {
        'username': 'choreographer',
        'password': 'choreographer',
        'full_name': 'Хореограф',
        'role': 'choreographer',
        'is_superuser': False,
        'is_staff': True,
        'phone': '+7 (917) 265-41-11',
        'telegram_username': 'jiva_choreo',
    },
    {
        'username': 'production',
        'password': 'production',
        'full_name': 'Выпускающий',
        'role': 'production',
        'is_superuser': False,
        'is_staff': True,
        'phone': '+7 (917) 265-41-12',
        'telegram_username': 'jiva_production',
    },
    {
        'username': 'artist',
        'password': 'artist',
        'full_name': 'Артист',
        'role': 'artist',
        'is_superuser': False,
        'is_staff': True,
        'phone': '+7 (917) 265-41-13',
        'telegram_username': 'jiva_artist',
    },
    {
        'username': 'technician',
        'password': 'technician',
        'full_name': 'Сергей Техников',
        'role': 'technician',
        'is_superuser': False,
        'is_staff': True,
        'phone': '+7 (917) 265-41-14',
        'telegram_username': 'jiva_tech',
    },
]


DEFAULT_CALENDAR_COLORS = [
    {
        'type': 'order',
        'status': 'request',
        'background_color': '#2164c8',
        'border_color': '#2164c8',
        'text_color': '#90caf9',
    },
    {
        'type': 'order',
        'status': 'confirmed',
        'background_color': '#2e7d32',
        'border_color': '#2e7d32',
        'text_color': '#a5d6a7',
    },
    {
        'type': 'order',
        'status': 'completed',
        'background_color': '#dcc8a0',
        'border_color': '#dcc8a0',
        'text_color': '#e8d9b8',
    },
    {
        'type': 'training',
        'status': '',
        'background_color': '#966ebe',
        'border_color': '#966ebe',
        'text_color': '#d8c2ec',
    },
    {
        'type': 'event',
        'status': '',
        'background_color': '#c8963c',
        'border_color': '#c8963c',
        'text_color': '#f0d9a8',
    },
]


DEFAULT_SKILLS = [
    'Акробатика',
    'Анимация',
    'Барабаны',
    'Воздушное полотно',
    'Гироскутер',
    'Живые статуи',
    'Жонглирование',
    'Лазерное шоу',
    'Мим',
    'Ремни',
    'Светодиодное шоу',
    'Сира',
    'Трюки со скакалкой',
    'Фаер-шоу',
    'Ходулист',
    'Хореография',
]


DEFAULT_ARTISTS = [
    {
        'username': 'robert',
        'full_name': 'Роберт',
        'telegram_username': 'robbertay',
        'phone': '+7 (987) 238-10-15',
        'skills_text': 'Танцор - студент, ведёт свой танц коллектив',
        'comment': '',
        'weight': '72',
        'height': '178',
        'shoe_size': '43',
        'skills': ['Хореография', 'Трюки со скакалкой'],
        'shows': ['Чёрный бриллиант', 'Эмпатия', 'Гетсби'],
    },
    {
        'username': 'alexandr',
        'full_name': 'Александр',
        'telegram_username': 'alex_acro',
        'phone': '89872381014',
        'skills_text': 'Акробатика, жонглирование',
        'comment': '',
        'weight': '78',
        'height': '182',
        'shoe_size': '44',
        'skills': ['Акробатика', 'Жонглирование'],
        'shows': ['Эмпатия', 'Глубина', 'Русское гиро'],
    },
    {
        'username': 'ilgizar',
        'full_name': 'Ильгизар',
        'telegram_username': 'ilgizar_akbashev',
        'phone': '89509474056',
        'skills_text': 'Ремнист, баланс, воздушное полотно',
        'comment': 'VK: https://vk.com/i.akbashev',
        'weight': '70',
        'height': '176',
        'shoe_size': '42',
        'skills': ['Ремни', 'Воздушное полотно', 'Акробатика'],
        'shows': ['Космос', 'Сира', 'Гравитация'],
    },
    {
        'username': 'ruslan',
        'full_name': 'Руслан',
        'telegram_username': 'VariousMan',
        'phone': '+7 (917) 265-41-15',
        'skills_text': 'Акробатика, жонглирование, тренер (есть ученики акробаты), сира',
        'comment': '',
        'weight': '75',
        'height': '180',
        'shoe_size': '43',
        'skills': ['Акробатика', 'Жонглирование', 'Сира'],
        'shows': ['Сира', 'Свет мой', 'Дух феникса'],
    },
    {
        'username': 'viktoria',
        'full_name': 'Виктория',
        'telegram_username': 'Ice_vivi',
        'phone': '89522213570',
        'skills_text': 'Ходулист, аниматор, мим, танцор, фаершоу, живые статуи, гироскутер',
        'comment': 'Адекватная по работе, очень приятная, близкая подруга Бойки, цирковая с 16-17 лет',
        'weight': '54',
        'height': '170',
        'shoe_size': '38',
        'skills': ['Ходулист', 'Анимация', 'Мим', 'Фаер-шоу', 'Живые статуи', 'Гироскутер'],
        'shows': ['Фениксы', 'Ходулисты', 'Чародейка'],
    },
    {
        'username': 'sveta',
        'full_name': 'Света',
        'telegram_username': 'sveta_drums',
        'phone': '79033261819',
        'skills_text': 'Танцы, барабан, аниматор, пои',
        'comment': 'Ездила на контракт по танцам, на контракт по малым барабанам, аниматором. Отлично могу вписаться в любой движ, быстро учусь. Начала учиться крутить пои',
        'weight': '58',
        'height': '165',
        'shoe_size': '38',
        'skills': ['Хореография', 'Барабаны', 'Анимация', 'Фаер-шоу'],
        'shows': ['Тамаша', 'Чародейка', 'Глубина'],
    },
    {
        'username': 'aleksandra',
        'full_name': 'Александра',
        'telegram_username': 'suvorova_aleksandraa',
        'phone': '+7 (917) 265-41-16',
        'skills_text': 'Музыка, танцы',
        'comment': 'Казань',
        'weight': '56',
        'height': '168',
        'shoe_size': '38',
        'skills': ['Хореография', 'Светодиодное шоу'],
        'shows': ['Лазерное шоу', 'Эмпатия', 'Фениксы'],
    },
    {
        'username': 'daria',
        'full_name': 'Дарья',
        'telegram_username': 'daria_akh',
        'phone': '+7 (917) 265-41-17',
        'skills_text': 'Шовная акробатика, ручной баланс, гимнастика',
        'comment': 'Чирлидинг с 12 лет, работала в составе детского цирка',
        'weight': '52',
        'height': '164',
        'shoe_size': '37',
        'skills': ['Акробатика', 'Хореография'],
        'shows': ['Чир', 'Гимнастика', 'Гетсби'],
    },
    {
        'username': 'linar',
        'full_name': 'Линар',
        'telegram_username': 'linar_show',
        'phone': '+7 (917) 265-41-18',
        'skills_text': 'Техник — свет, звук, пульты, монтаж',
        'comment': '',
        'weight': '85',
        'height': '185',
        'shoe_size': '45',
        'skills': ['Лазерное шоу', 'Светодиодное шоу'],
        'shows': ['Лазерное шоу', 'Свет мой'],
    },
    {
        'username': 'dinara',
        'full_name': 'Динара',
        'telegram_username': 'dinara_fire',
        'phone': '+7 (917) 265-41-19',
        'skills_text': 'Фаер-шоу, пои, светодиодные пои',
        'comment': 'Выступления по огню с 2019 года',
        'weight': '55',
        'height': '167',
        'shoe_size': '38',
        'skills': ['Фаер-шоу', 'Светодиодное шоу'],
        'shows': ['Фениксы', 'Чародейка', 'Шаманка'],
    },
]


DEFAULT_ORGANIZERS = [
    {
        'full_name': 'Иванова Анна Сергеевна',
        'phone': '79161234501',
        'telegram_username': 'anna_ivanova',
        'email': 'anna.ivanova@mail.ru',
        'city': 'Казань',
        'rating': 'high',
        'comment': 'Свадьбы и юбилеи, берёт шоу целиком',
    },
    {
        'full_name': 'Петров Игорь Михайлович',
        'phone': '79161234502',
        'telegram_username': 'igor_petrov',
        'email': 'petrov.im@yandex.ru',
        'city': 'Казань',
        'rating': 'medium',
        'comment': 'Организует корпоративы местных компаний',
    },
    {
        'full_name': 'Смирнова Ольга Викторовна',
        'phone': '79161234503',
        'telegram_username': 'smirnova_olga',
        'email': 'o.smirnova@gmail.com',
        'city': 'Москва',
        'rating': 'high',
        'comment': 'Москва, работаем регулярно на крупных премиях',
    },
    {
        'full_name': 'Кузнецов Дмитрий Олегович',
        'phone': '79161234504',
        'telegram_username': 'dkuznetsov',
        'email': '',
        'city': 'Казань',
        'rating': 'medium',
        'comment': '',
    },
    {
        'full_name': 'Гарипова Гульнара Равиловна',
        'phone': '79161234505',
        'telegram_username': 'gulnara_g',
        'email': 'gulnara@cdtkzn.ru',
        'city': 'Казань',
        'comment': 'Директор ДК, городские праздники и фестивали',
        'rating': 'high',
    },
    {
        'full_name': 'Морозов Сергей Павлович',
        'phone': '79161234506',
        'telegram_username': 'morozov_sp',
        'email': 'morozov@event-holding.ru',
        'city': 'Нижнекамск',
        'rating': 'medium',
        'comment': 'Промышленные компании, любит техническую часть',
    },
    {
        'full_name': 'Валиева Алия Ильдаровна',
        'phone': '79161234507',
        'telegram_username': 'aliya_v',
        'email': '',
        'city': 'Набережные Челны',
        'rating': 'medium',
        'comment': 'Залы, банкеты, часто просит ходулистов',
    },
    {
        'full_name': 'Никитин Артур Ренатович',
        'phone': '79161234508',
        'telegram_username': 'artur_nikitin',
        'email': 'artur@promo-media.ru',
        'city': 'Москва',
        'rating': 'low',
        'comment': 'Один раз перенесли дату за день до мероприятия',
    },
    {
        'full_name': 'Сафина Лилия Маратовна',
        'phone': '79161234509',
        'telegram_username': 'liliya_safina',
        'email': 'safina.l@school.edu.ru',
        'city': 'Казань',
        'rating': 'medium',
        'comment': 'Школы и выпускные, второй квартал',
    },
    {
        'full_name': 'Тимофеев Павел Андреевич',
        'phone': '79161234510',
        'telegram_username': 'pavel_t',
        'email': '',
        'city': 'Альметьевск',
        'rating': 'low',
        'comment': '',
    },
    {
        'full_name': 'Хабибуллина Регина Ильнаровна',
        'phone': '79161234511',
        'telegram_username': 'regina_h',
        'email': 'regina.event@mail.ru',
        'city': 'Казань',
        'rating': 'high',
        'comment': 'Клиент с VIP-уровнем, только лучшие составы',
    },
    {
        'full_name': 'Орлов Максим Витальевич',
        'phone': '79161234512',
        'telegram_username': 'orlov_maks',
        'city': 'Зеленодольск',
        'email': '',
        'rating': 'medium',
        'comment': '',
    },
]


DEFAULT_AGENCIES = [
    {
        'name': 'Праздник Плюс',
        'clients': [
            {
                'full_name': 'Агентство Праздник',
                'phone': '79161239999',
                'telegram_username': 'prazdnik_plus',
                'email': 'info@prazdnikplus.ru',
                'city': 'Казань',
                'rating': 'high',
                'comment': 'Основной партнёр, от 5 заказов в месяц',
            },
            {
                'full_name': 'Мария Соколова',
                'phone': '79161234520',
                'telegram_username': 'sokolova_maria',
                'email': 'maria@prazdnikplus.ru',
                'city': 'Казань',
                'rating': 'medium',
                'comment': 'Менеджер агентства, ведёт свадьбы',
            },
        ],
    },
    {
        'name': 'Лайт Шоу',
        'clients': [
            {
                'full_name': 'Агентство Лайт Шоу',
                'phone': '79161234521',
                'telegram_username': 'light_show',
                'email': 'order@lightshow.ru',
                'city': 'Москва',
                'rating': 'high',
                'comment': 'Заказывают технику и лазерные номера',
            },
        ],
    },
    {
        'name': 'Ивент Лаб',
        'clients': [
            {
                'full_name': 'Агентство Ивент Лаб',
                'phone': '79161234522',
                'telegram_username': 'event_lab',
                'email': 'hello@eventlab.pro',
                'city': 'Москва',
                'rating': 'medium',
                'comment': 'Премии и презентации, часто в последний момент',
            },
            {
                'full_name': 'Ринат Газетдинов',
                'phone': '79161234523',
                'telegram_username': 'rinat_lab',
                'email': '',
                'city': 'Москва',
                'rating': 'medium',
                'comment': 'Продюсер, договариваться только с ним',
            },
        ],
    },
    {
        'name': 'Мотор Промо',
        'clients': [
            {
                'full_name': 'Агентство Мотор Промо',
                'phone': '79161234524',
                'telegram_username': 'motor_promo',
                'email': 'motor@promo.ru',
                'city': 'Набережные Челны',
                'rating': 'low',
                'comment': '',
            },
        ],
    },
]


DEFAULT_CITY_GROUPS = [
    {'name': 'Казань', 'salary_bonus': 0},
    {'name': 'Республика', 'salary_bonus': 500},
    {'name': 'Другие регионы', 'salary_bonus': 1500},
]

DEFAULT_CITIES = [
    {'name': 'Казань', 'group': 'Казань', 'transport_costs': {'4': 0, '8': 0}},
    {'name': 'Зеленодольск', 'group': 'Республика', 'transport_costs': {'4': 3000, '8': 4500}},
    {'name': 'Набережные Челны', 'group': 'Республика', 'transport_costs': {'4': 8000, '8': 12000}},
    {'name': 'Нижнекамск', 'group': 'Республика', 'transport_costs': {'4': 9000, '8': 14000}},
    {'name': 'Альметьевск', 'group': 'Республика', 'transport_costs': {'4': 9000, '8': 14000}},
    {'name': 'Арск', 'group': 'Республика', 'transport_costs': {'4': 3500, '8': 5000}},
    {'name': 'Чистополь', 'group': 'Республика', 'transport_costs': {'4': 7000, '8': 10000}},
    {'name': 'Москва', 'group': 'Другие регионы', 'transport_costs': {'4': 25000, '8': 35000}},
    {'name': 'Самара', 'group': 'Другие регионы', 'transport_costs': {'4': 18000, '8': 26000}},
    {'name': 'Ульяновск', 'group': 'Другие регионы', 'transport_costs': {'4': 14000, '8': 20000}},
    {'name': 'Ижевск', 'group': 'Другие регионы', 'transport_costs': {'4': 15000, '8': 21000}},
]


DEFAULT_SERVICE_GROUPS = [
    {
        'name': 'Шоу-программы',
        'description': 'Комплекты шоу для корпоративов, свадеб и городских праздников',
        'services': [
            {
                'name': 'Эмпатия',
                'duration': '15-20 мин',
                'rate': 5000,
                'rows': [(2, 29000), (3, 37000), (4, 43000), (5, 52000), (6, 60000)],
            },
            {
                'name': 'Глубина',
                'duration': '15 мин',
                'rate': 5000,
                'rows': [(3, 37000), (4, 43000), (5, 52000), (6, 60000)],
            },
            {
                'name': 'Чёрный бриллиант',
                'duration': '20 мин',
                'rate': 5000,
                'rows': [(2, 29000), (3, 37000), (4, 43000)],
            },
            {
                'name': 'Гетсби',
                'duration': '20 мин',
                'rate': 5000,
                'rows': [(4, 43000), (5, 52000), (6, 60000)],
            },
            {
                'name': 'Цирк',
                'duration': '25 мин',
                'rate': 5500,
                'rows': [(4, 43000), (5, 52000), (6, 60000), (7, 66000)],
            },
            {
                'name': 'Русское гиро',
                'duration': '15 мин',
                'rate': 5000,
                'rows': [(3, 37000), (4, 43000), (5, 52000)],
            },
            {
                'name': 'Татарское',
                'duration': '15 мин',
                'rate': 5000,
                'rows': [(3, 37000), (4, 43000), (6, 60000)],
            },
            {
                'name': 'Гравитация',
                'duration': '20 мин',
                'rate': 6000,
                'rows': [(4, 43000), (5, 52000), (6, 60000)],
            },
        ],
    },
    {
        'name': 'Воздушные и гимнастические номера',
        'description': 'Сира, полотно, ремни и гимнастические номера',
        'services': [
            {
                'name': 'Космос с сира',
                'duration': '15 мин',
                'rate': 6000,
                'rows': [(3, 41000), (5, 51000), (6, 57000)],
            },
            {
                'name': 'Славянское с сира',
                'duration': '15 мин',
                'rate': 6000,
                'rows': [(3, 41000), (5, 51000), (7, 61000)],
            },
            {
                'name': 'Сира (отдельный номер)',
                'duration': '8 мин',
                'rate': 7000,
                'rows': [(1, 21000), (2, 26000)],
            },
            {
                'name': 'Чир',
                'duration': '6 мин',
                'rate': 4500,
                'rows': [(4, 33000), (5, 38000), (6, 43000)],
            },
            {
                'name': 'Гимнастика',
                'duration': '6 мин',
                'rate': 4500,
                'rows': [(4, 33000), (5, 38000), (6, 43000)],
            },
            {
                'name': 'Свет мой (+3 лазера + адаптация)',
                'duration': '20 мин',
                'rate': 8000,
                'rows': [(2, 64000), (3, 71000), (4, 77000)],
            },
        ],
    },
    {
        'name': 'Огненные и световые номера',
        'description': 'Фаер-шоу, лазерные и светодиодные номера',
        'services': [
            {
                'name': 'Дух феникса',
                'duration': '15 мин',
                'rate': 5500,
                'rows': [(4, 48000), (5, 54000), (6, 60000), (7, 66000)],
            },
            {
                'name': 'Ритуал',
                'duration': '15 мин',
                'rate': 5500,
                'rows': [(4, 48000), (5, 54000), (6, 60000)],
            },
            {
                'name': 'Дух феникса / Славянское с сира (огонь)',
                'duration': '20 мин',
                'rate': 6500,
                'rows': [(4, 51000), (5, 56000), (6, 63000), (7, 68000)],
            },
            {
                'name': 'Лазерное шоу',
                'duration': '10 мин',
                'rate': 7000,
                'rows': [(2, 32000), (3, 40000), (4, 46000)],
            },
            {
                'name': 'Фаер-шоу',
                'duration': '10 мин',
                'rate': 5000,
                'rows': [(2, 26000), (3, 33000), (4, 38000)],
            },
        ],
    },
    {
        'name': 'Велокомменто-шоу',
        'description': 'Встреча гостей: ходулисты, статуи, мимы, аниматоры',
        'services': [
            {
                'name': 'Ходулисты (велком)',
                'duration': '30-60 мин',
                'rate': 4500,
                'rows': [(1, 21000), (2, 27000), (3, 33000), (4, 38000)],
            },
            {
                'name': 'Живые статуи',
                'duration': '45 мин',
                'rate': 4000,
                'rows': [(2, 24000), (3, 30000), (4, 35000)],
            },
            {
                'name': 'Мим',
                'duration': '45 мин',
                'rate': 4000,
                'rows': [(1, 18000), (2, 24000)],
            },
            {
                'name': 'Аниматоры',
                'duration': '60 мин',
                'rate': 3500,
                'rows': [(1, 15000), (2, 20000), (3, 25000)],
            },
            {
                'name': 'Гироскутер',
                'duration': '30 мин',
                'rate': 4000,
                'rows': [(2, 24000), (4, 32000)],
            },
        ],
    },
    {
        'name': 'Тематические и сценические номера',
        'description': 'Перфомансы под концепцию и отдельные сценические номера',
        'services': [
            {
                'name': 'Слав. перфоманс',
                'duration': '25 мин',
                'rate': 5500,
                'rows': [(1, 26000), (2, 31000), (3, 36000), (4, 39000), (5, 45000)],
            },
            {
                'name': 'Перфоманс «СДВ»',
                'duration': '20 мин',
                'rate': 6000,
                'rows': [(1, 26000), (2, 31000), (3, 36000), (4, 39000)],
            },
            {
                'name': 'Шаманка (стихии)',
                'duration': '15 мин',
                'rate': 5000,
                'rows': [(1, 26000), (2, 31000), (3, 36000), (5, 45000)],
            },
            {
                'name': 'Чародейка',
                'duration': '15 мин',
                'rate': 5000,
                'rows': [(2, 38000), (3, 44000), (4, 51000), (6, 61000)],
            },
            {
                'name': 'Тамаша',
                'duration': '15 мин',
                'rate': 5000,
                'rows': [(2, 38000), (3, 44000), (4, 51000), (8, 70000)],
            },
        ],
    },
]


DEMO_ORDERS = [
    {
        'offset': -74,
        'name': 'Корпоратив «Итоги года»',
        'client': 'Иванова Анна Сергеевна',
        'city': 'Казань',
        'address': 'Казань, ул. Баумана, 15',
        'status': 'completed',
        'payment_method': 'cash',
        'services': [('Эмпатия', 4)],
        'staff': 4,
        'technician': True,
        'setup_time': '17:00',
        'concept': 'Новогодний корпоратив для сотрудников производственной компании',
    },
    {
        'offset': -61,
        'name': 'Свадьба «Белая сказка»',
        'client': 'Агентство Праздник',
        'city': 'Казань',
        'address': 'Казань, ул. Островского, 38',
        'status': 'completed',
        'payment_method': 'self',
        'services': [('Ходулисты (велком)', 4), ('Глубина', 5)],
        'staff': 5,
        'technician': False,
        'setup_time': '15:30',
        'concept': 'Свадьба на 120 гостей, встреча гостей и шоу-блок',
    },
    {
        'offset': -45,
        'name': 'Городской фестиваль «Огни города»',
        'client': 'Гарипова Гульнара Равиловна',
        'city': 'Казань',
        'address': 'Казань, Кремлёвская наб., 2',
        'status': 'completed',
        'payment_method': 'ip',
        'services': [('Дух феникса', 6)],
        'staff': 6,
        'technician': True,
        'setup_time': '19:00',
        'concept': 'Городской праздник, вечерний блок с огнём',
    },
    {
        'offset': -33,
        'name': 'Презентация бренда',
        'client': 'Агентство Ивент Лаб',
        'city': 'Москва',
        'address': 'Москва, Тверская ул., 22',
        'status': 'completed',
        'payment_method': 'ip',
        'services': [('Свет мой (+3 лазера + адаптация)', 3)],
        'staff': 3,
        'technician': True,
        'setup_time': '18:00',
        'concept': 'Показ коллекции, световое шоу на финал',
    },
    {
        'offset': -21,
        'name': 'Юбилей «Путешествие по миру»',
        'client': 'Хабибуллина Регина Ильнаровна',
        'city': 'Казань',
        'address': 'Казань, ул. Пушкина, 4',
        'status': 'completed',
        'payment_method': 'cash',
        'services': [('Чародейка', 4)],
        'staff': 4,
        'technician': False,
        'setup_time': '16:00',
        'concept': 'Юбилей 50 лет, блок из трёх номеров',
    },
    {
        'offset': -12,
        'name': 'Корпоратив «Гравитация»',
        'client': 'Морозов Сергей Павлович',
        'city': 'Нижнекамск',
        'address': 'Нижнекамск, пр. Строителей, 10',
        'status': 'completed',
        'payment_method': 'ip',
        'services': [('Гравитация', 5)],
        'staff': 5,
        'technician': True,
        'setup_time': '18:30',
        'concept': 'Корпоратив нефтяной компании, выезд составом',
    },
    {
        'offset': -6,
        'name': 'День рождения «Цирковая ночь»',
        'client': 'Петров Игорь Михайлович',
        'city': 'Казань',
        'address': 'Казань, ул. Мусы Джалиля, 8',
        'status': 'completed',
        'payment_method': 'cash',
        'services': [('Цирк', 4)],
        'staff': 4,
        'technician': False,
        'setup_time': '17:00',
        'concept': 'Семейный праздник с цирковой программой',
    },
    {
        'offset': -2,
        'name': 'Открытие ресторана «Гранд»',
        'client': 'Валиева Алия Ильдаровна',
        'city': 'Набережные Челны',
        'address': 'Набережные Челны, пр. Мира, 5',
        'status': 'completed',
        'payment_method': 'cash',
        'services': [('Ходулисты (велком)', 2), ('Живые статуи', 2)],
        'staff': 4,
        'technician': False,
        'setup_time': '16:00',
        'concept': 'Открытие ресторана, встреча гостей',
    },
    {
        'offset': 0,
        'name': 'Фестиваль «Новогодние огни»',
        'client': 'Смирнова Ольга Викторовна',
        'city': 'Москва',
        'address': 'Москва, Пушкинская площадь, 1',
        'status': 'confirmed',
        'payment_method': 'ip',
        'services': [('Лазерное шоу', 3), ('Фаер-шоу', 4)],
        'staff': 6,
        'technician': True,
        'setup_time': '18:00',
        'concept': 'Новогодняя площадка, два номера с интервалом',
    },
    {
        'offset': 2,
        'name': 'Корпоратив «Татарское шоу»',
        'client': 'Агентство Лайт Шоу',
        'city': 'Казань',
        'address': 'Казань, ул. Декабристов, 60',
        'status': 'confirmed',
        'payment_method': 'ip',
        'services': [('Татарское', 4)],
        'staff': 4,
        'technician': False,
        'setup_time': '18:00',
        'concept': 'Корпоратив с национальным колоритом',
    },
    {
        'offset': 5,
        'name': 'Выпускной «Звёздный путь»',
        'client': 'Сафина Лилия Маратовна',
        'city': 'Казань',
        'address': 'Казань, ул. Адоратского, 1',
        'status': 'confirmed',
        'payment_method': 'cash',
        'services': [('Эмпатия', 6)],
        'staff': 6,
        'technician': True,
        'setup_time': '17:00',
        'concept': 'Выпускной школы, вечерний блок',
    },
    {
        'offset': 9,
        'name': 'Свадьба «Барокко»',
        'client': 'Мария Соколова',
        'city': 'Зеленодольск',
        'address': 'Зеленодольск, ул. Ленина, 12',
        'status': 'confirmed',
        'payment_method': 'self',
        'services': [('Гетсби', 4)],
        'staff': 4,
        'technician': False,
        'setup_time': '16:30',
        'concept': 'Свадьба в стиле Гэтсби',
    },
    {
        'offset': 14,
        'name': 'Презентация «Свет и музыка»',
        'client': 'Агентство Мотор Промо',
        'city': 'Набережные Челны',
        'address': 'Набережные Челны, ул. Академика Рубаненко, 4',
        'status': 'confirmed',
        'payment_method': 'ip',
        'services': [('Свет мой (+3 лазера + адаптация)', 2)],
        'staff': 2,
        'technician': True,
        'setup_time': '19:30',
        'concept': 'Презентация нового автомобиля',
    },
    {
        'offset': 21,
        'name': 'Новогодний корпоратив «Феникс»',
        'client': 'Иванова Анна Сергеевна',
        'city': 'Казань',
        'address': 'Казань, ул. Чистопольская, 12',
        'status': 'request',
        'payment_method': 'cash',
        'services': [('Дух феникса / Славянское с сира (огонь)', 6)],
        'staff': 6,
        'technician': True,
        'setup_time': '18:00',
        'concept': 'Корпоратив на 200 гостей, нужен огненный финал',
    },
    {
        'offset': 26,
        'name': 'Детский праздник «Шаманка»',
        'client': 'Орлов Максим Витальевич',
        'city': 'Зеленодольск',
        'address': 'Зеленодольск, ул. Энергетиков, 7',
        'status': 'request',
        'payment_method': 'cash',
        'services': [('Шаманка (стихии)', 3)],
        'staff': 3,
        'technician': False,
        'setup_time': '12:00',
        'concept': 'Новогодний утренник',
    },
    {
        'offset': 33,
        'name': 'Гала-ужин «Тамаша»',
        'client': 'Агентство Ивент Лаб',
        'city': 'Москва',
        'address': 'Москва, Кутузовский пр., 2/1',
        'status': 'request',
        'payment_method': 'ip',
        'services': [('Тамаша', 4), ('Чародейка', 4)],
        'staff': 8,
        'technician': True,
        'setup_time': '19:00',
        'concept': 'Гала-ужин, два блока по 15 минут',
    },
    {
        'offset': 41,
        'name': 'Спортивный фестиваль',
        'client': 'Агентство Ивент Лаб',
        'city': 'Казань',
        'address': 'Казань, ул. Московская, 1',
        'status': 'request',
        'payment_method': 'ip',
        'services': [('Чир', 6)],
        'staff': 6,
        'technician': False,
        'setup_time': '11:00',
        'concept': 'Открытие соревнований',
    },
    {
        'offset': 48,
        'name': 'Корпоратив «Космос»',
        'client': 'Морозов Сергей Павлович',
        'city': 'Нижнекамск',
        'address': 'Нижнекамск, пр. Химиков, 21',
        'status': 'request',
        'payment_method': 'ip',
        'services': [('Космос с сира', 5)],
        'staff': 5,
        'technician': True,
        'setup_time': '18:00',
        'concept': 'Корпоратив на 150 человек',
    },
]


def ask_yes_no(question):
    answer = input(f'{question} [y/N]: ').strip().lower()
    return answer in ('y', 'yes', 'д', 'да')


def create_default_users():
    print('Создание пользователей по умолчанию...')

    for user_data in DEFAULT_USERS:
        username = user_data['username']

        if User.objects.filter(username=username).exists():
            print(f'  Пользователь "{username}" уже существует. Пропускаем.')
            continue

        user = User.objects.create_user(
            username=username,
            password=user_data['password'],
            first_name=user_data['full_name'],
            email=f'{username}@jiva.ru',
            is_active=True,
            is_staff=user_data['is_staff'],
            is_superuser=user_data['is_superuser'],
        )

        Role.objects.get_or_create(name=user_data['full_name'])

        employee = Employee.objects.create(
            user=user,
            full_name=user_data['full_name'],
            role=user_data['role'],
            phone=user_data['phone'],
            telegram_username=user_data['telegram_username'],
            is_active=True,
        )

        if user_data['role'] == 'artist':
            ArtistCard.objects.get_or_create(employee=employee)

        print(f'  Создан пользователь "{username}" с ролью "{user_data["full_name"]}".')

    print('Готово.')


def create_default_calendar_colors():
    print('Создание цветов календаря по умолчанию...')

    for color_data in DEFAULT_CALENDAR_COLORS:
        obj, created = CalendarColor.objects.get_or_create(
            type=color_data['type'],
            status=color_data['status'],
            defaults={
                'background_color': color_data['background_color'],
                'border_color': color_data['border_color'],
                'text_color': color_data['text_color'],
                'is_active': True,
            },
        )
        if created:
            label = color_data['status'] or color_data['type']
            print(f'  Создан цвет для "{label}".')
        else:
            print(f'  Цвет для "{color_data["status"] or color_data["type"]}" уже существует. Пропускаем.')

    print('Готово.')


def create_default_skills():
    print('Создание навыков по умолчанию...')

    for name in DEFAULT_SKILLS:
        skill, created = Skill.objects.get_or_create(name=name)

        if created:
            print(f'  Создан навык "{name}".')

    print('Готово.')


def create_default_cities():
    print('Создание групп городов и городов...')

    groups = {}

    for group_data in DEFAULT_CITY_GROUPS:
        group, created = CityGroup.objects.get_or_create(
            name=group_data['name'],
            defaults={'salary_bonus': group_data['salary_bonus']},
        )

        groups[group.name] = group

        if created:
            print(f'  Создана группа городов "{group.name}".')

    for city_data in DEFAULT_CITIES:
        city, created = City.objects.get_or_create(
            name=city_data['name'],
            defaults={
                'group': groups.get(city_data['group']),
                'transport_costs': city_data['transport_costs'],
            },
        )

        if created:
            print(f'  Создан город "{city.name}".')

    print('Готово.')


def service_shows_map():
    shows = {}

    for group in DEFAULT_SERVICE_GROUPS:
        for item in group['services']:
            shows[item['name']] = item['name']

            for part in item['name'].split(' / '):
                shows.setdefault(part.strip(), item['name'])

    return shows


def create_default_artists():
    print('Создание артистов по умолчанию...')

    shows = service_shows_map()

    for artist_data in DEFAULT_ARTISTS:
        username = artist_data['username']

        if User.objects.filter(username=username).exists():
            print(f'  Артист "{username}" уже существует. Пропускаем.')
            continue

        user = User.objects.create_user(
            username=username,
            password='artist',
            first_name=artist_data['full_name'],
            email=f'{username}@jiva.ru',
            is_active=True,
            is_staff=True,
        )

        Role.objects.get_or_create(name='Артист')

        employee = Employee.objects.create(
            user=user,
            full_name=artist_data['full_name'],
            role='artist',
            phone=artist_data['phone'],
            telegram_username=artist_data['telegram_username'],
            is_active=True,
        )

        employee.skills.set(Skill.objects.filter(name__in=artist_data['skills']))

        card, _ = ArtistCard.objects.get_or_create(employee=employee)
        card.weight = artist_data['weight']
        card.height = artist_data['height']
        card.shoe_size = artist_data['shoe_size']
        card.skills_text = artist_data['skills_text']
        card.comment = artist_data['comment']
        card.save()

        known = [shows[name] for name in artist_data['shows'] if name in shows]

        card.known_shows.set(Service.objects.filter(name__in=known, type='service'))

        print(f'  Создан артист "{artist_data["full_name"]}" (логин: {username}).')

    print('Готово.')


def create_default_services():
    print('Создание каталогов и услуг по умолчанию...')

    owner = Employee.objects.filter(role='senior_admin').first() or Employee.objects.first()

    if owner is None:
        print('  Нет сотрудников — услуги не созданы.')
        return

    Service.objects.filter(
        type='category',
        name='Шоу-программы',
        parent=None,
        children__isnull=True,
    ).delete()

    for group_index, group_data in enumerate(DEFAULT_SERVICE_GROUPS):
        category, created = Service.objects.get_or_create(
            name=group_data['name'],
            parent=None,
            type='category',
            defaults={
                'created_by': owner,
                'order': group_index,
                'description': group_data['description'],
            },
        )

        if created:
            print(f'  Создан каталог "{category.name}".')
        else:
            category.description = group_data['description']
            category.order = group_index
            category.save(update_fields=['description', 'order'])

        for service_index, item in enumerate(group_data['services']):
            service, service_created = Service.objects.get_or_create(
                name=item['name'],
                parent=category,
                type='service',
                defaults={
                    'created_by': owner,
                    'order': service_index,
                    'duration': item['duration'],
                    'artist_rate': item['rate'],
                    'is_active': True,
                },
            )

            if not service_created:
                service.duration = item['duration']
                service.artist_rate = item['rate']
                service.order = service_index
                service.save(update_fields=['duration', 'artist_rate', 'order'])
                print(f'  Услуга "{item["name"]}" уже существует. Обновлены ставка и длительность.')
                continue

            ServiceStaffRow.objects.bulk_create([
                ServiceStaffRow(service=service, artist_count=count, cost=cost, order=position)
                for position, (count, cost) in enumerate(item['rows'])
            ])

            print(f'  Создана услуга "{service.name}" ({len(item["rows"])} ставок).')

    print('Готово.')


def create_default_clients(manager):
    print('Создание клиентов по умолчанию...')

    clients = {}

    for city in DEFAULT_CITIES:
        City.objects.get_or_create(name=city['name'])

    for item in DEFAULT_ORGANIZERS:
        client, created = Client.objects.get_or_create(
            phone=item['phone'],
            defaults={
                'full_name': item['full_name'],
                'client_type': 'organizer',
                'phone': item['phone'],
                'telegram_username': item.get('telegram_username', ''),
                'email': item.get('email', ''),
                'city': item['city'],
                'rating': item['rating'],
                'comment': item.get('comment', ''),
                'created_by': manager,
            },
        )

        if created:
            print(f'  Создан организатор "{client.full_name}".')

        clients[item['full_name']] = client

    for agency_data in DEFAULT_AGENCIES:
        agency, created = Agency.objects.get_or_create(name=agency_data['name'])

        if created:
            print(f'  Создано агентство "{agency.name}".')

        for item in agency_data['clients']:
            client, client_created = Client.objects.get_or_create(
                phone=item['phone'],
                defaults={
                    'full_name': item['full_name'],
                    'client_type': 'agency',
                    'agency': agency,
                    'phone': item['phone'],
                    'telegram_username': item.get('telegram_username', ''),
                    'email': item.get('email', ''),
                    'city': item['city'],
                    'rating': item['rating'],
                    'comment': item.get('comment', ''),
                    'created_by': manager,
                },
            )

            if client_created:
                print(f'  Создан клиент агентства "{client.full_name}".')

            clients[item['full_name']] = client

    for item in DEFAULT_ORGANIZERS + [c for a in DEFAULT_AGENCIES for c in a['clients']]:
        client = clients.get(item['full_name'])

        if not client:
            continue

        city = City.objects.filter(name__iexact=item['city']).first()

        if city:
            client.cities.set([city])

        client.city = item['city']
        client.save()

    print('Готово.')

    return clients


def pick_staff(order_data, artists, technicians):
    total = order_data['staff']
    require_tech = order_data.get('technician', False)

    artist_count = total - 1 if require_tech and technicians else total

    selected = artists[:max(artist_count, 1)]

    if require_tech and technicians:
        selected = selected + [technicians[0]]

    return selected


def create_demo_events():
    print('Создание демонстрационных заказов...')

    today = date.today()
    manager = Employee.objects.filter(role='sales_manager').first() or Employee.objects.filter(role='senior_admin').first()
    senior = Employee.objects.filter(role='senior_admin').first()
    producer = Employee.objects.filter(role='production').first()
    artists = list(Employee.objects.filter(role='artist', is_active=True).order_by('full_name'))
    technicians = list(Employee.objects.filter(role='technician', is_active=True).order_by('full_name'))

    clients = create_default_clients(manager or senior)

    for index, item in enumerate(DEMO_ORDERS):
        event_date = today + timedelta(days=item['offset'])
        client = clients.get(item['client'])

        if client is None:
            print(f'  Клиент "{item["client"]}" не найден — заказ "{item["name"]}" пропущен.')
            continue

        if Order.objects.filter(name=item['name'], date=event_date).exists():
            print(f'  Заказ "{item["name"]}" на {event_date.strftime("%d.%m.%Y")} уже существует. Пропускаем.')
            continue

        city = City.objects.filter(name__iexact=item['city']).first()

        order = Order.objects.create(
            name=item['name'],
            client=client,
            city=city,
            date=event_date,
            address=item['address'],
            contact_phone=client.phone,
            contact_telegram=client.telegram_username,
            setup_time=item.get('setup_time', ''),
            concept=item.get('concept', ''),
            manager=manager,
            story_manager=producer,
            status=item['status'],
            duration=1,
            payment_method=item.get('payment_method', ''),
        )

        total_cost = 0
        service_rates = {}

        for service_name, people_count in item['services']:
            service = Service.objects.filter(name=service_name, type='service').first()

            if service is None:
                print(f'  Услуга "{service_name}" не найдена — пропущена в заказе "{order.name}".')
                continue

            rows = list(service.staff_rows.order_by('artist_count', 'id'))
            chosen = None

            for row in rows:
                if row.artist_count >= people_count:
                    chosen = row
                    break

            if chosen is None and rows:
                chosen = rows[-1]

            if chosen is None:
                continue

            OrderEstimate.objects.create(
                order=order,
                service=service,
                service_name=service.name,
                people_count=people_count,
                coefficient=1,
                price=chosen.cost,
            )

            total_cost += float(chosen.cost)
            service_rates[service.id] = float(service.artist_rate)

        order.cost = str(int(total_cost)) if total_cost else '—'
        order.employee_items.all().delete()

        selected = pick_staff(item, artists, technicians)

        for employee in selected:
            if employee.role == 'technician':
                rate = 5000
            else:
                rate = max(service_rates.values()) if service_rates else 5000

            OrderEmployee.objects.create(
                order=order,
                employee=employee,
                employee_name=employee.full_name,
                employee_role=employee.get_role_display(),
                payment=rate,
            )

        order.content_hash = order.compute_content_hash()
        order.save()

        print(f'  Создан заказ "{order.name}" на {event_date.strftime("%d.%m.%Y")} ({item["status"]}).')

    print('Готово.')


if __name__ == '__main__':
    create_default_users()
    create_default_calendar_colors()
    create_default_skills()
    create_default_cities()
    create_default_services()
    create_default_artists()

    if ask_yes_no('Создать заказы и клиентов?'):
        create_demo_events()
