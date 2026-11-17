(function () {
  'use strict';

  var CITIES = ['Москва', 'Казань', 'Чебоксары', 'Манжерок', 'Екатеринбург', 'Самара', 'Ульяновск', 'Нижнекамск', 'Бугульма', 'Нижний Новгород', 'Ижевск', 'Уфа', 'Сочи', 'Краснодар', 'Ростов-на-Дону', 'Воронеж', 'Пермь', 'Тюмень', 'Саратов', 'Тольятти', 'Набережные Челны', 'Йошкар-Ола', 'Новосибирск', 'Челябинск', 'Ярославль', 'Тула', 'Калининград', 'Симферополь', 'Волгоград', 'Омск', 'Альметьевск', 'Оренбург', 'Пенза', 'Ставрополь', 'Астрахань', 'Иркутск', 'Красноярск', 'Барнаул', 'Сургут', 'Ташкент'];

  var CLIENTS = [
    { id: 1, name: 'Титова Софья Ильдаровна', city: 'Казань', phone: '+7 (927) 710-61-11', telegram: '@sshnkv', agency: 'ЭТМ' },
    { id: 2, name: 'Беляева Камилла Алексеевна', city: 'Нижнекамск', phone: '', telegram: '@kamilla_belyaeva_event', agency: '' },
    { id: 3, name: 'Борисова Анна Ивановна', city: 'Москва', phone: '+7 (919) 915-86-41', telegram: '@анна_борисова', agency: 'Свадебная студия «Мокко»' },
    { id: 4, name: 'Богданов Марат Айратович', city: 'Нижний Новгород', phone: '+7 (937) 901-90-30', telegram: '@marat_bogdanov7', agency: '' }
  ];

  var EMPLOYEES = ['Арина', 'Ирада', 'Лида', 'Натали', 'Полина', 'Света', 'Альбина', 'Юля', 'Оля', 'Аня', 'Ира', 'Марина', 'Лена', 'Карина'];
  var STAFF = ['Матвей', 'Миша', 'Маша', 'Саша', 'Катя', 'Натали', 'Лида', 'Джу', 'Влад', 'Ваня', 'Денис', 'Кирилл', 'Алия', 'Диляра', 'Даша', 'Лиза', 'Илья', 'Артём', 'Сергей', 'Роман', 'Никита', 'Тимур', 'Руслан', 'Ольга', 'Кристина', 'Ясмина'];
  var SHOWS = ['Эмпатия', 'Космос', 'Дефиле', 'Фениксы', 'Глубина', 'Белые крылья', 'Ритуал', 'Славянское', 'Русское шоу', 'Жар-птицы', 'Часовщица', 'Связист', 'Изобретатель', 'Вечеринка', 'Татарский женский танец', 'Флешмоб', 'Брейкеры'];

  var STATE = {
    name: 'Форум ЭТМ — казанский вариант, 700 человек',
    status: 'confirmed',
    client: null,
    contactPhone: '',
    contactTelegram: '',
    city: 'Казань',
    date: '25.12.2026',
    start: '19:00',
    setup: 'с 13 до 16',
    address: 'Экспо, главный зал\nсначала хотели феников',
    shows: ['Эмпатия', 'Космос', 'Дефиле'],
    staff: ['Матвей', 'Миша', 'Маша', 'Лиза'],
    concept: 'Солянка, проекция общая универсальная новогодняя',
    tech: '5 лазеров, большая сетка, хейзеры не нужны',
    dressing: 'Две монтажки, хорошие гримерки',
    meal: 'Заказали на всех',
    cost: '278 000.00₽',
    payment: 'ИП, остаток уточняем',
    managers: ['Арина']
  };

  STATE.client = CLIENTS[0];
  STATE.contactPhone = CLIENTS[0].phone;
  STATE.contactTelegram = CLIENTS[0].telegram;

  var editCard = document.getElementById('editCard');
  var editTitle = document.getElementById('editTitle');
  var editClips = document.getElementById('editClips');
  var editRows = document.getElementById('editRows');
  var editNote = document.getElementById('editNote');
  var pop = document.getElementById('pop');
  var viewHeadTitle = document.getElementById('viewHeadTitle');
  var viewDate = document.getElementById('viewDate');
  var viewStatus = document.getElementById('viewStatus');
  var viewClient = document.getElementById('viewClient');
  var viewLines = document.getElementById('viewLines');
  var viewStaff = document.getElementById('viewStaff');
  var viewBoxes = document.getElementById('viewBoxes');
  var viewExtra = document.getElementById('viewExtra');
  var viewBody = document.getElementById('viewBody');
  var activeMenu = null;

  var statusSwitch = document.createElement('div');

  statusSwitch.className = 'status-switch';
  statusSwitch.id = 'statusSwitch';
  statusSwitch.innerHTML = '<button type="button" class="status-switch__btn" data-status="request">Запрос</button>'
    + '<button type="button" class="status-switch__btn is-on" data-status="confirmed">Подтверждённый</button>'
    + '<button type="button" class="status-switch__btn" data-status="completed">Выполненный</button>';

  function esc(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function autoSize(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;

    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 22) + 'px';
  }

  function closePop() {
    pop.hidden = true;
    pop.innerHTML = '';
    activeMenu = null;
  }

  function openPop(anchor, html, menu) {
    var rect = anchor.getBoundingClientRect();

    pop.hidden = false;
    pop.style.left = Math.min(rect.left, window.innerWidth - 306) + 'px';
    pop.style.top = Math.min(rect.bottom + 4, window.innerHeight - 336) + 'px';
    pop.innerHTML = html;
    activeMenu = menu;

    var search = pop.querySelector('.pop__search');

    if (!search) return;

    search.focus();

    search.addEventListener('input', function () {
      var value = search.value.toLowerCase();

      Array.prototype.forEach.call(pop.querySelectorAll('[data-pick], [data-client]'), function (item) {
        item.style.display = item.textContent.toLowerCase().indexOf(value) >= 0 ? '' : 'none';
      });
    });
  }

  pop.addEventListener('click', function (e) {
    if (!activeMenu) return;

    var pick = e.target.closest('[data-pick]');

    if (pick) {
      activeMenu.pick(pick.dataset.pick);
      return;
    }

    var clientItem = e.target.closest('[data-client]');

    if (clientItem) {
      activeMenu.client(clientItem.dataset.client);
      return;
    }

    if (e.target.closest('[data-new-client]')) {
      activeMenu.create();
    }
  });

  document.addEventListener('click', function (e) {
    if (pop.hidden) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest('.token-add, .select__field, .select__caret')) return;

    closePop();
  });

  function tokenHtml(value) {
    return '<span class="token">' + esc(value) + '<button type="button" class="token__x" data-token-drop="' + esc(value) + '">×</button></span>';
  }

  function buildMulti(box, key, options, placeholder) {
    var wrap = document.createElement('div');

    wrap.className = 'select';
    wrap.innerHTML = '<div class="select__tokens"></div>'
      + '<input type="text" class="select__field" placeholder="' + esc(placeholder) + '">'
      + '<span class="token-add" data-more="' + key + '" title="Выбрать">+</span>';
    box.appendChild(wrap);

    var tokens = wrap.querySelector('.select__tokens');
    var field = wrap.querySelector('.select__field');

    function paint() {
      tokens.innerHTML = STATE[key].map(tokenHtml).join('');

      Array.prototype.forEach.call(tokens.querySelectorAll('[data-token-drop]'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();

          var index = STATE[key].indexOf(btn.dataset.tokenDrop);

          if (index >= 0) STATE[key].splice(index, 1);

          paint();
          updateCount();
        });
      });
    }

    paint();

    function showMenu() {
      openPop(field, '<input type="text" class="pop__search" placeholder="Поиск">'
        + options.map(function (item) {
          var taken = STATE[key].indexOf(item) >= 0;

          return '<button type="button" class="pop__item' + (taken ? ' is-picked' : '') + '" data-pick="' + esc(item) + '">'
            + '<span>' + esc(item) + '</span><em>' + (taken ? 'добавлено' : '') + '</em></button>';
        }).join(''), {
        pick: function (value) {
          if (STATE[key].indexOf(value) < 0) STATE[key].push(value);

          paint();
          updateCount();
          closePop();
        },
        client: function () {},
        create: function () {}
      });
    }

    field.addEventListener('click', showMenu);
    wrap.querySelector('.token-add').addEventListener('click', showMenu);
  }

  function buildClient(box) {
    var wrap = document.createElement('div');

    wrap.className = 'select';
    wrap.innerHTML = '<div class="select__tokens"></div>'
      + '<span class="token-add" data-more="client" title="Выбрать клиента">+</span>';
    box.appendChild(wrap);

    var tokens = wrap.querySelector('.select__tokens');

    function paint() {
      tokens.innerHTML = STATE.client ? tokenHtml(STATE.client.name) : '<span class="select__empty">клиент не выбран</span>';

      Array.prototype.forEach.call(tokens.querySelectorAll('[data-token-drop]'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();

          STATE.client = null;
          STATE.contactPhone = '';
          STATE.contactTelegram = '';

          paint();
          renderRows();
          updateCount();
        });
      });
    }

    paint();

    wrap.querySelector('.token-add').addEventListener('click', function () {
      openPop(wrap.querySelector('.token-add'), '<input type="text" class="pop__search" placeholder="ФИО, телефон или агентство">'
        + '<button type="button" class="pop__item pop__item--new" data-new-client="1">+ Создать клиента</button>'
        + CLIENTS.map(function (item) {
          return '<button type="button" class="pop__item" data-client="' + item.id + '">'
            + '<span>' + esc(item.name) + '</span>'
            + '<em>' + esc([item.city, item.agency].filter(Boolean).join(' · ')) + '</em></button>';
        }).join(''), {
        pick: function () {},
        client: function (id) {
          var client = CLIENTS.filter(function (item) { return String(item.id) === id; })[0];

          if (!client) return;

          STATE.client = client;
          STATE.city = client.city || STATE.city;
          STATE.contactPhone = client.phone;
          STATE.contactTelegram = client.telegram;

          closePop();
          renderClips();
          renderRows();
          updateCount();
        },
        create: function () {
          newClientForm(pop.querySelector('.pop__search').value);
        }
      });
    });
  }

  function newClientForm(prefill) {
    pop.innerHTML = '<div class="pop__form">'
      + '<label>ФИО<input type="text" class="pop__input" data-new-name value="' + esc(prefill || '') + '"></label>'
      + '<label>Город<input type="text" class="pop__input" data-new-city></label>'
      + '<label>Телеграм<input type="text" class="pop__input" data-new-telegram></label>'
      + '<label>Телефон<input type="text" class="pop__input" data-new-phone></label>'
      + '<div class="pop__actions">'
      + '<button type="button" class="btn btn-outline btn-sm" data-cancel>Отмена</button>'
      + '<button type="button" class="btn btn-primary btn-sm" data-create>Создать</button>'
      + '</div></div>';

    pop.querySelector('[data-new-name]').focus();
    pop.querySelector('[data-cancel]').addEventListener('click', closePop);

    pop.querySelector('[data-create]').addEventListener('click', function () {
      var name = pop.querySelector('[data-new-name]').value.trim();

      if (!name) return;

      var client = {
        id: Date.now(),
        name: name,
        city: pop.querySelector('[data-new-city]').value.trim(),
        phone: pop.querySelector('[data-new-phone]').value.trim(),
        telegram: pop.querySelector('[data-new-telegram]').value.trim(),
        agency: ''
      };

      CLIENTS.unshift(client);

      STATE.client = client;

      if (client.city) STATE.city = client.city;

      STATE.contactPhone = client.phone;
      STATE.contactTelegram = client.telegram;

      closePop();
      renderClips();
      renderRows();
      updateCount();
    });
  }

  function buildContacts(box) {
    var pair = document.createElement('div');

    pair.className = 'pair';
    pair.innerHTML = '<textarea class="field" rows="1" placeholder="Телефон"></textarea>'
      + '<textarea class="field" rows="1" placeholder="@telegram"></textarea>';
    box.appendChild(pair);

    var phone = pair.children[0];
    var telegram = pair.children[1];

    phone.value = STATE.contactPhone;
    telegram.value = STATE.contactTelegram;
    autoSize(phone);
    autoSize(telegram);

    phone.addEventListener('input', function () {
      STATE.contactPhone = phone.value;
      autoSize(phone);
      updateCount();
    });

    telegram.addEventListener('input', function () {
      STATE.contactTelegram = telegram.value;
      autoSize(telegram);
      updateCount();
    });
  }

  function renderClips() {
    editClips.innerHTML = '';

    var city = document.createElement('span');

    city.className = 'clip';
    city.dataset.kind = 'city';
    city.innerHTML = '<input type="text" class="clip__input" placeholder="Город" readonly>';
    editClips.appendChild(city);

    var cityInput = city.querySelector('input');

    cityInput.value = STATE.city || '';

    cityInput.addEventListener('click', function () {
      openPop(cityInput, '<input type="text" class="pop__search" placeholder="Поиск города">'
        + CITIES.map(function (item) {
          return '<button type="button" class="pop__item" data-pick="' + esc(item) + '">' + esc(item) + '</button>';
        }).join(''), {
        pick: function (value) {
          STATE.city = value;
          cityInput.value = value;
          updateCount();
          closePop();
        },
        client: function () {},
        create: function () {}
      });
    });

    var date = document.createElement('span');

    date.className = 'clip';
    date.innerHTML = '<input type="text" class="clip__input" placeholder="Дата">';
    editClips.appendChild(date);

    var dateInput = date.querySelector('input');

    dateInput.value = STATE.date || '';

    dateInput.addEventListener('input', function () {
      STATE.date = dateInput.value;
      updateCount();
    });

    var start = document.createElement('span');

    start.className = 'clip';
    start.innerHTML = '<input type="text" class="clip__input" placeholder="Время">';
    editClips.appendChild(start);

    var startInput = start.querySelector('input');

    startInput.value = STATE.start || '';

    startInput.addEventListener('input', function () {
      STATE.start = startInput.value;
      updateCount();
    });

    editClips.appendChild(statusSwitch);
  }

  function rowBlock(label, build) {
    var el = document.createElement('div');

    el.className = 'row';
    el.innerHTML = '<span class="row__k">' + esc(label) + '</span><span class="row__v"></span>';

    build(el.querySelector('.row__v'));
    editRows.appendChild(el);
  }

  function buildText(box, key, placeholder) {
    var area = document.createElement('textarea');

    area.className = 'field';
    area.rows = 1;
    area.placeholder = placeholder || '';
    area.value = STATE[key] || '';

    box.appendChild(area);
    autoSize(area);

    area.addEventListener('input', function () {
      STATE[key] = area.value;
      autoSize(area);
      updateCount();
    });
  }

  function renderRows() {
    editRows.innerHTML = '';

    rowBlock('Клиент', function (box) {
      buildClient(box);
    });

    rowBlock('Контакты', function (box) {
      buildContacts(box);
    });

    rowBlock('Шоу', function (box) {
      buildMulti(box, 'shows', SHOWS, 'Найти шоу');
    });

    rowBlock('Состав', function (box) {
      buildMulti(box, 'staff', STAFF, 'Найти сотрудника');
    });

    rowBlock('Установка', function (box) {
      buildText(box, 'setup', 'Например: с 13 до 16, начало 19:00');
    });

    rowBlock('Адрес', function (box) {
      buildText(box, 'address', 'Площадка, зал');
    });

    rowBlock('Техника', function (box) {
      buildText(box, 'tech', 'Лампы, лазер, сетка, проекция');
    });

    rowBlock('Гримёрка', function (box) {
      buildText(box, 'dressing', 'Гримёрки');
    });

    rowBlock('Еда', function (box) {
      buildText(box, 'meal', 'Питание');
    });

    rowBlock('Стоимость', function (box) {
      buildText(box, 'cost', 'Сумма');
    });

    rowBlock('Оплата', function (box) {
      buildText(box, 'payment', 'Способ, остаток');
    });

    rowBlock('Менеджер', function (box) {
      buildMulti(box, 'managers', EMPLOYEES, 'Найти менеджера');
    });
  }

  function techBadges() {
    var source = (STATE.tech + ' ' + STATE.concept).toLowerCase();
    var badges = [];

    if (/ламп|свет/.test(source)) badges.push('Лампы');
    if (/лазер|сира/.test(source)) badges.push('Лазер');
    if (/хейзер|дым/.test(source)) badges.push('Хейзер');
    if (/сетк/.test(source)) badges.push('Сетка');
    if (/проекц/.test(source)) badges.push('Проекция');

    return badges.join(', ');
  }

  function statusLabel() {
    var active = statusSwitch.querySelector('.status-switch__btn.is-on');

    return active ? active.textContent : 'Запрос';
  }

  function clipHtml(label, value) {
    if (!value) return '';

    return '<span class="tag"><span class="tag__k">' + esc(label) + '</span>' + esc(value) + '</span>';
  }

  function vrow(label, value, extra) {
    if (!value) return '';

    return '<div class="vrow' + (extra ? ' ' + extra : '') + '"><span class="vrow__k">' + esc(label) + '</span>'
      + '<span class="vrow__v">' + esc(value).replace(/\n/g, '<br>') + '</span></div>';
  }

  function ebox(label, value) {
    if (!value) return '';

    return '<div class="ev-box"><span class="ev-box__k">' + esc(label) + ':</span> <b>' + esc(value).replace(/\n/g, '<br>') + '</b></div>';
  }

  function renderView() {
    viewHeadTitle.textContent = STATE.name || 'Заказ';

    var place = [STATE.city, STATE.address.split('\n')[0]].filter(Boolean).join(', ');
    var dateLine = [STATE.date, place].filter(Boolean).join(', ');

    viewDate.textContent = dateLine || 'Дата не указана';
    viewStatus.textContent = statusLabel();

    viewClient.innerHTML = STATE.client
      ? '<a class="ev-client__name" href="#">' + esc(STATE.client.name) + '</a>'
        + (STATE.client.agency ? '<div class="ev-client__agency">' + esc(STATE.client.agency) + '</div>' : '')
      : '<div class="ev-muted">Клиент не выбран</div>';

    var lines = [];

    lines.push('<div class="ev-line ev-line--show">' + esc(STATE.shows.join(' · ') || 'Шоу не указаны') + '</div>');
    lines.push('<div class="ev-line">' + esc([STATE.city, STATE.address.split('\n')[0]].filter(Boolean).join(', ') || 'Адрес не указан') + '</div>');
    lines.push('<div class="ev-line">Менеджер: <b>' + esc(STATE.managers.join(', ') || '—') + '</b></div>');
    lines.push('<div class="ev-line ev-line--cost">Стоимость: <b>' + esc(STATE.cost || '—') + '</b></div>');

    viewLines.innerHTML = lines.join('');

    viewStaff.innerHTML = STATE.staff.length
      ? '<div class="ev-staff">' + STATE.staff.map(function (name) {
          return '<span class="ev-staff__item">' + esc(name) + '</span>';
        }).join('') + '</div>'
      : '<div class="ev-empty">Сотрудники не назначены</div>';

    var boxes = [];

    boxes.push(ebox('Контакт', [STATE.client ? STATE.client.name : '', STATE.contactPhone, STATE.contactTelegram].filter(Boolean).join(' · ')));
    boxes.push(ebox('Время чека/установки', STATE.setup));
    boxes.push(ebox('Техничка', [techBadges(), STATE.tech].filter(Boolean).join(' — ')));
    boxes.push(ebox('Особенности площадки', STATE.address.split('\n').slice(1).join(' ') || ''));
    boxes.push(ebox('Гримёрка', STATE.dressing));
    boxes.push(ebox('Еда', STATE.meal));
    boxes.push(ebox('Оплата', STATE.payment));

    viewBoxes.innerHTML = boxes.filter(Boolean).join('') || '<div class="ev-empty">Нет данных</div>';

    viewExtra.innerHTML = STATE.concept
      ? '<div class="ev-section">КОММЕНТАРИЙ</div><div class="ev-comment">' + esc(STATE.concept).replace(/\n/g, '<br>') + '</div>'
      : '';
  }

  function updateCount() {
    renderView();
    var count = 0;

    count += STATE.client ? 1 : 0;
    count += STATE.contactPhone || STATE.contactTelegram ? 1 : 0;
    count += STATE.city ? 1 : 0;
    count += STATE.date ? 1 : 0;
    count += STATE.start ? 1 : 0;
    count += STATE.shows.length ? 1 : 0;
    count += STATE.staff.length ? 1 : 0;
    count += STATE.managers.length ? 1 : 0;

    ['setup', 'address', 'tech', 'dressing', 'meal', 'cost', 'payment'].forEach(function (key) {
      if (STATE[key]) count += 1;
    });

    document.getElementById('fieldCount').textContent = 'Заполнено ' + count + ' из 16';
  }

  editTitle.addEventListener('input', function () {
    STATE.name = editTitle.textContent.trim();
  });

  editNote.addEventListener('input', function () {
    STATE.concept = editNote.textContent.trim();
    updateCount();
  });

  statusSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('.status-switch__btn');

    if (!btn) return;

    STATE.status = btn.dataset.status;

    Array.prototype.forEach.call(statusSwitch.querySelectorAll('.status-switch__btn'), function (item) {
      item.classList.toggle('is-on', item === btn);
    });
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    STATE.name = '';
    STATE.client = null;
    STATE.contactPhone = '';
    STATE.contactTelegram = '';
    STATE.city = '';
    STATE.date = '';
    STATE.start = '';
    STATE.setup = '';
    STATE.address = '';
    STATE.shows = [];
    STATE.staff = [];
    STATE.concept = '';
    STATE.tech = '';
    STATE.dressing = '';
    STATE.meal = '';
    STATE.cost = '';
    STATE.payment = '';
    STATE.managers = [];

    editTitle.textContent = '';
    editNote.textContent = '';

    renderClips();
    renderRows();
    updateCount();
  });

  document.getElementById('saveBtn').addEventListener('click', function () {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');

    toast.className = 'toast';
    toast.textContent = 'Заказ сохранён';
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2200);
  });

  editTitle.textContent = STATE.name;
  editNote.textContent = STATE.concept;

  if (window.statusSwitch) {
    statusSwitch = window.statusSwitch;
  }

  renderClips();
  renderRows();
  updateCount();
  requestAnimationFrame(updateCount);

  window.addEventListener('error', function (e) {
    document.getElementById('fieldCount').textContent = 'Ошибка: ' + e.message;
  });
})();
