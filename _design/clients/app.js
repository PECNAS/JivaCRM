(function () {
  'use strict';

  var BASE = '../';

  var CLIENTS = [
    {
      id: 1,
      name: 'Титова Софья Ильдаровна',
      type: 'Агентство',
      agency: 'ЭТМ',
      phone: '+7 (927) 710-61-11',
      telegram: '@sshnkv',
      instagram: '@sofia.event',
      email: 'sofia@etm.ru',
      cities: ['Казань', 'Москва'],
      rating: 'high',
      ratingLabel: 'Высокий',
      requests: 14,
      orders: 23,
      sum: '4 820 000.00₽',
      lastOrder: '25.12.2026',
      contact: 'Телефон',
      comment: 'Постоянный заказчик, платит ИП, просит счёт заранее за две недели.',
      createdBy: 'DHS',
      created: '12.03.2024',
      active: true,
      history: [
        { date: '25.12.2026', name: 'Форум ЭТМ', status: 'Подтверждённый', key: 'confirmed', cost: '278 000.00₽' },
        { date: '14.09.2026', name: 'Корпоратив ЭТМ', status: 'Выполненный', key: 'completed', cost: '310 000.00₽' },
        { date: '02.06.2026', name: 'Юбилей компании', status: 'Выполненный', key: 'completed', cost: '185 000.00₽' },
        { date: '18.02.2026', name: 'Презентация бренда', status: 'Запрос', key: 'request', cost: '—' }
      ]
    },
    {
      id: 2,
      name: 'Беляева Камилла Алексеевна',
      type: 'Организатор',
      agency: '',
      phone: '',
      telegram: '@kamilla_belyaeva_event',
      instagram: '@kamilla.belyaeva',
      email: '',
      cities: ['Нижнекамск'],
      rating: 'medium',
      ratingLabel: 'Средний',
      requests: 3,
      orders: 1,
      sum: '180 000.00₽',
      lastOrder: '18.10.2026',
      contact: 'Телеграм',
      comment: 'Ведём только через телеграм, на звонки не отвечает.',
      createdBy: 'Ирада',
      created: '02.09.2025',
      active: true,
      history: [
        { date: '18.10.2026', name: 'Городской праздник', status: 'Выполненный', key: 'completed', cost: '180 000.00₽' },
        { date: '30.04.2026', name: 'Открытие сезона', status: 'Запрос', key: 'request', cost: '—' }
      ]
    },
    {
      id: 3,
      name: 'Борисова Анна Ивановна',
      type: 'Агентство',
      agency: 'Свадебная студия «Мокко»',
      phone: '+7 (919) 915-86-41',
      telegram: '@анна_борисова',
      instagram: '',
      email: 'anna@mokko.ru',
      cities: ['Москва'],
      rating: 'low',
      ratingLabel: 'Низкий',
      requests: 6,
      orders: 2,
      sum: '95 000.00₽',
      lastOrder: '03.03.2025',
      contact: 'Телефон',
      comment: 'Дважды отменяли заказ за сутки. Просим предоплату всегда.',
      createdBy: 'Полина',
      created: '14.01.2025',
      active: false,
      history: [
        { date: '03.03.2025', name: 'Свадьба', status: 'Выполненный', key: 'completed', cost: '95 000.00₽' }
      ]
    }
  ];

  var view = document.getElementById('view');
  var tabs = document.getElementById('tabs');
  var current = 0;

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(text) {
    var box = document.getElementById('toasts');
    var item = document.createElement('div');

    item.className = 'toast';
    item.textContent = text;
    box.appendChild(item);

    setTimeout(function () {
      item.style.opacity = '0';
      setTimeout(function () { item.remove(); }, 300);
    }, 1800);
  }

  function renderTabs() {
    tabs.innerHTML = '';

    CLIENTS.forEach(function (client, index) {
      var tab = document.createElement('button');

      tab.type = 'button';
      tab.className = 'client-tab' + (index === current ? ' is-on' : '');
      tab.innerHTML = '<span class="client-tab__dot ' + client.rating + '"></span>' + esc(client.name);

      tab.addEventListener('click', function () {
        current = index;
        renderTabs();
        render();
      });

      tabs.appendChild(tab);
    });
  }

  function render() {
    var client = CLIENTS[current];
    var renderer = window.CLIENT_VIEW || {};

    view.innerHTML = '';

    if (typeof renderer.renderClient !== 'function') {
      view.innerHTML = '<div class="card card__body">Функция рендера не подключена</div>';
      return;
    }

    var node = renderer.renderClient(client, { esc: esc, toast: toast });

    node.classList.add('card--loaded');
    view.appendChild(node);
  }

  window.ClientDemo = { esc: esc, toast: toast, rerender: render };

  renderTabs();
  render();
})();
