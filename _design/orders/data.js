window.CURRENT_ORDER = {
  name: 'Свадьба Рустама и Алины',
  date: '26 сентября 2026, суббота',
  city: 'Казань',
  status: 'confirmed',
  statusLabel: 'Подтверждённый',
  client: 'Титова Софья Ильдаровна',
  clientType: 'Агентство ЭТМ',
  chat: '1128',
  chatLink: 'https://t.me/c/130000/sm3',
  startTime: '17:00',
  setupTime: '15:00',
  address: 'Казань, ул. Пушкина 12, отель «Мираж», 3 этаж',
  contact: { name: 'Алина', phone: '+7 (927) 710-61-11', telegram: 'alinashow' },
  managers: ['DHS'],
  storyManager: 'Софа',
  cost: '480 000.00₽',
  payment: 'СЗ до 30.09.2026',
  paymentComment: 'остаток после аванса',
  shows: [
    { time: '17:00', name: 'Шоу 1 · Открытие', artists: [
      { name: 'Софа', comment: 'ответственная', responsible: true },
      { name: 'Марк' },
      { name: 'Лиза' }
    ] },
    { time: '19:30', name: 'Шоу 2 · Воздушные полотна', artists: [
      { name: 'Софа', comment: 'ответственная', responsible: true },
      { name: 'Ника' },
      { name: 'Марк', comment: 'стори', story: true }
    ] },
    { time: '21:00', name: 'Шоу 3 · Финал', artists: [
      { name: 'Алиса' },
      { name: 'Ника' }
    ] }
  ],
  tech: { lamps: true, laser: true, hazer: true, grid: false, projection: true, comment: '2 пульта, дым на финал' },
  boxes: [
    ['Гримёрка, еда', 'Гримёрка на 3 этаже, вода и фрукты, кофе после шоу'],
    ['Про площадку', 'Сцена 8х6, ограничение по весу на балке 200 кг'],
    ['Не забыть', 'Костюм «Огонь» — в химчистке до 25.09'],
    ['Адаптация', 'Новый артист Марк — присмотреть в первом прогоне'],
    ['Комментарий', 'Клиент просил артистов не фотографировать детей']
  ]
};

window.ORDER_META = {
  statusLabels: { request: 'Запрос', confirmed: 'Подтверждённый', completed: 'Выполненный' },
  statusKeys: ['confirmed', 'completed', 'request']
};

window.oEsc = function (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

window.oToast = function (text) {
  var box = document.getElementById('toasts');
  if (!box) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  box.appendChild(el);
  setTimeout(function () { el.remove(); }, 2200);
};

window.orderShowsHtml = function (clsPrefix) {
  var O = window.CURRENT_ORDER;
  return O.shows.map(function (s) {
    var artists = s.artists.map(function (a) {
      var cls = clsPrefix + '-show__artist';
      if (a.responsible) cls += ' is-answer';
      if (a.story) cls += ' is-story';
      var label = a.name + (a.comment ? ' (' + a.comment + ')' : '');
      return '<span class="' + cls + '">' + window.oEsc(label) + '</span>';
    }).join('');
    return '<div class="' + clsPrefix + '-show">' +
      '<span class="' + clsPrefix + '-show__time">' + window.oEsc(s.time) + '</span>' +
      '<span class="' + clsPrefix + '-show__body">' +
      '<span class="' + clsPrefix + '-show__name">' + window.oEsc(s.name) + '</span>' +
      '<span class="' + clsPrefix + '-show__chips">' + artists + '</span>' +
      '</span></div>';
  }).join('');
};

window.techChips = function () {
  var t = window.CURRENT_ORDER.tech;
  var out = [];
  if (t.lamps) out.push('УФ');
  if (t.laser) out.push('Лазер');
  if (t.hazer) out.push('Хейзер');
  if (t.grid) out.push('Сетка');
  if (t.projection) out.push('Проекция');
  return out;
};

window.bindClose = function (selector) {
  document.addEventListener('click', function (e) {
    var x = e.target.closest(selector);
    if (!x) return;
    window.oToast('Закрыть карточку');
  });
};
