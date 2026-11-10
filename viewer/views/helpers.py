import re
from decimal import Decimal, InvalidOperation

from django.utils import timezone

from ..models import ROLE_LABELS, ROLE_CHOICES, normalize_text


TRANSLIT_MAP = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}

NUMBER_WORDS = {
    'сто': '100',
    'двести': '200',
    'триста': '300',
    'четыреста': '400',
    'пятьсот': '500',
    'шестьсот': '600',
    'семьсот': '700',
    'восемьсот': '800',
    'девятьсот': '900',
    'тысяча': '1000',
    'тысячи': '1000',
}

MONTHS_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]


def transliterate(value):
    result = []

    for char in (value or '').lower():
        result.append(TRANSLIT_MAP.get(char, char))

    return ''.join(result)


def search_key(value):
    text = normalize_text(value)
    text = re.sub(r'[^0-9a-zа-я]+', ' ', text)
    return text.strip()


def search_forms(value):
    base = search_key(value)
    forms = {base, transliterate(base)}

    for word, digits in NUMBER_WORDS.items():
        if word in base:
            forms.add(base.replace(word, digits))
            forms.add(transliterate(base.replace(word, digits)))

    for word, digits in NUMBER_WORDS.items():
        if digits in base:
            forms.add(base.replace(digits, word))
            forms.add(base.replace(digits, transliterate(word)))

    words = base.split()

    if words:
        forms.add(''.join(words))

    return {form for form in forms if form}


def levenshtein(a, b):
    if a == b:
        return 0

    if not a:
        return len(b)

    if not b:
        return len(a)

    previous = list(range(len(b) + 1))

    for i, char_a in enumerate(a, start=1):
        current = [i]

        for j, char_b in enumerate(b, start=1):
            cost = 0 if char_a == char_b else 1
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost))

        previous = current

    return previous[-1]


def similarity(query, candidate):
    query_forms = search_forms(query)
    candidate_forms = search_forms(candidate)

    if not query_forms or not candidate_forms:
        return 0

    best = 0

    for left in query_forms:
        for right in candidate_forms:
            if left == right:
                return 100

            if right.startswith(left) or left.startswith(right):
                best = max(best, 90)

            distance = levenshtein(left, right)
            limit = max(len(left), len(right))

            if limit:
                ratio = int((1 - distance / limit) * 100)
                best = max(best, ratio)

    return max(best, 0)


def match_score(query, candidate):
    if not (query or '').strip():
        return 100

    return similarity(query, candidate)


def format_money(value, with_currency=True):
    try:
        amount = Decimal(str(value or 0))
    except (InvalidOperation, ValueError):
        amount = Decimal('0')

    text = f'{amount:,.2f}'.replace(',', ' ')

    if with_currency:
        return f'{text}₽'

    return text


def format_date_short(value, today=None):
    if not value:
        return ''

    today = today or timezone.localdate()
    label = f'{value.day} {MONTHS_GENITIVE[value.month - 1]}'

    if value.year != today.year:
        label = f'{label} {str(value.year)[2:]}'

    return label


def format_date_full(value):
    if not value:
        return ''

    return f'{value.day} {MONTHS_GENITIVE[value.month - 1]} {value.year}'


def parse_money(value):
    text = str(value or '').strip().replace(' ', '').replace('₽', '').replace(',', '.')

    if not text or text == '—':
        return None

    try:
        return Decimal(text).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return None


def role_label(code):
    return ROLE_LABELS.get(code, code or '')


def role_options():
    return [{'code': code, 'label': label} for code, label in ROLE_CHOICES]


def employee_payload(employee, include_role=True, include_nickname=True):
    data = {
        'id': employee.id,
        'full_name': employee.full_name,
        'display_name': employee.display_name,
        'username': employee.user.username if employee.user_id else '',
        'phone': employee.phone or '',
        'is_active': employee.is_active,
    }

    if include_nickname:
        data['nickname'] = employee.nickname or ''

    if include_role:
        data['role'] = employee.primary_role()
        data['role_label'] = role_label(employee.primary_role())
        data['roles'] = [
            {'id': item.id, 'name': item.name, 'code': item.code or ''}
            for item in employee.roles.all()
        ]
        data['role_codes'] = employee.role_codes()

    return data
