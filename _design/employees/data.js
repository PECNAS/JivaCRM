window.EMP = {
  name: 'Титова Софья Ильдаровна',
  nickname: 'Софа',
  roles: ['artist', 'choreographer'],
  phone: '+7 (927) 710-61-11',
  telegram: '@sofia.event',
  instagram: '@sofia.event',
  rzd: '4820 115 764',
  active: true,
  foreign: {
    series: '72 14',
    number: '778341',
    issuedBy: 'УФМС России по Республике Татарстан',
    issuedAt: '18.06.2019',
    code: '160-018'
  },
  passport: {
    series: '92 11',
    number: '446102',
    issuedBy: 'Отделением УФМС России по Республике Татарстан в Вахитовском районе г. Казани',
    issuedAt: '21.09.2011',
    code: '160-002'
  },
  address: 'г. Казань, ул. Пушкина, д. 12, кв. 45',
  inn: '165912345678',
  snils: '123-456-789 64',
  artist: {
    weight: '52',
    height: '168',
    shoe: '37',
    skills: ['Воздушная гимнастка', 'Полотна', 'Контемпорари'],
    show: 'Рада — вед. performer, выносят на воздушных полотнах',
    comment: 'Плохо видит вечером, линзы. Не летать на самолётах без надзора +1.'
  },
  docs: [
    { type: 'Загранпаспорт', caption: 'Главная страница', file: 'zagran_1.jpg', size: '2.4 МБ' },
    { type: 'Паспорт РФ', caption: 'Прописка', file: 'passport_propiska.jpg', size: '1.1 МБ' },
    { type: 'СНИЛС', caption: '', file: 'snils.pdf', size: '340 КБ' }
  ],
  login: 'sofia.event',
  password: '········',
  createdBy: 'DHS',
  created: '12.03.2024'
};

window.EMP_META = {
  roles: [
    ['artist', 'Артист'],
    ['technician', 'Техник'],
    ['choreographer', 'Хореограф'],
    ['manager', 'Управляющий'],
    ['sales_manager', 'Менеджер'],
    ['production', 'Выпускающий'],
    ['boss', 'Босс'],
    ['senior_admin', 'Старший администратор']
  ],
  roleLabels: {
    artist: 'Артист',
    technician: 'Техник',
    choreographer: 'Хореограф',
    manager: 'Управляющий',
    sales_manager: 'Менеджер',
    production: 'Выпускающий',
    boss: 'Босс',
    senior_admin: 'Старший администратор'
  },
  docTypes: ['Загранпаспорт', 'Паспорт РФ', 'СНИЛС', 'ИНН', 'Медицинская книжка', 'Прочее'],
  skills: [
    'Воздушная гимнастка', 'Полотна', 'Воздушное кольцо', 'Трапеция',
    'Контемпорари', 'Хип-хоп', 'Пластика', 'Пилон', 'Акробатика',
    'Импровизация', 'Балет', 'Вокал', 'Дубляж'
  ]
};

window.fmt = function (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

window.maskPhone = function (value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits[0] !== '7') digits = '7' + digits;
  digits = digits.slice(0, 11);
  var out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 5) out += ') ' + digits.slice(4, 7);
  if (digits.length >= 8) out += '-' + digits.slice(7, 9);
  if (digits.length >= 10) out += '-' + digits.slice(9, 11);
  return out;
};

window.maskSeries = function (value) {
  var digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? digits.slice(0, 2) + ' ' + digits.slice(2) : digits;
};

window.maskCode = function (value) {
  var digits = String(value || '').replace(/\D/g, '').slice(0, 6);
  return digits.length > 3 ? digits.slice(0, 3) + '-' + digits.slice(3) : digits;
};

window.maskDate = function (value) {
  var digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  var out = digits.slice(0, 2);
  if (digits.length > 2) out += '.' + digits.slice(2, 4);
  if (digits.length > 4) out += '.' + digits.slice(4, 8);
  return out;
};

window.autoGrow = function (el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

window.toast = function (text) {
  var box = document.getElementById('toasts');
  if (!box) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, 2200);
};

window.roleChips = function (roles) {
  return roles.map(function (r) {
    return '<span class="chip chip--accent">' + fmt(window.EMP_META.roleLabels[r] || r) + '</span>';
  }).join('');
};
