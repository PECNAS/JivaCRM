(function () {
  'use strict';

  var CLIENT = {
    id: 1,
    name: 'Титова Софья Ильдаровна',
    type: 'agency',
    agency: 'ЭТМ',
    agencyAliases: ['ЭТМ Групп', 'Единая Техническая Модаль'],
    phone: '+7 (927) 710-61-11',
    telegram: '@sshnkv',
    instagram: '@sofia.event',
    email: 'sofia@etm.ru',
    cities: 'Казань, Москва',
    rating: 'high',
    ratingLabel: 'Высокий',
    requests: 14,
    orders: 54,
    sum: '11 380 000.00₽',
    lastOrder: '25.12.2026',
    comment: 'Постоянный заказчик, платит ИП, просит счёт заранее за две недели.',
    createdBy: 'DHS',
    created: '12.03.2024',
    history: [
      { date: '25.12.2026', name: 'Форум ЭТМ', status: 'Подтверждённый', key: 'confirmed', cost: '278 000.00₽' },
      { date: '14.09.2026', name: 'Корпоратив ЭТМ', status: 'Выполненный', key: 'completed', cost: '310 000.00₽' },
      { date: '02.06.2026', name: 'Юбилей компании', status: 'Выполненный', key: 'completed', cost: '185 000.00₽' },
      { date: '18.02.2026', name: 'Презентация бренда', status: 'Запрос', key: 'request', cost: '—' }
    ]
  };

  var TYPE_ORDER = ['unknown', 'organizer', 'agency'];
  var TYPE_LABELS = { unknown: '—', organizer: 'Орг', agency: 'Агентство' };

  var RATING_ORDER = ['low', 'medium', 'high'];
  var RATING_LABELS = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };

  var SHOWN = 8;

  var MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  function makeHistory(count) {
    var titles = ['Форум ЭТМ', 'Корпоратив', 'Свадьба', 'Юбилей', 'Открытие ТЦ', 'День города', 'Гала-ужин', 'Презентация', 'Выпускной', 'Детский праздник'];
    var statuses = ['confirmed', 'completed', 'request'];
    var list = [];
    var day = 28;
    var month = 11;

    for (var i = 0; i < count; i += 1) {
      var key = statuses[i % 3];

      list.push({
        date: ('0' + day).slice(-2) + '.' + ('0' + month).slice(-2) + '.2026',
        name: titles[i % titles.length] + ' ' + (i + 1),
        key: key,
        cost: key === 'request' ? '—' : ((120 + (i * 37) % 180) * 1000).toLocaleString('ru-RU') + '.00₽'
      });

      day -= 7;

      while (day < 1) {
        day += 30;
        month -= 1;
      }
    }

    return list;
  }

  var view = document.getElementById('view');
  var historyLimit = SHOWN;

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
    }, 1600);
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);

    return String(value || '').split(/[,;]/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function setList(key, list) {
    if (key === 'cities') CLIENT.cities = list.join(', ');
    else CLIENT[key] = list.slice();
  }

  function getList(key) {
    return normalizeList(key === 'cities' ? CLIENT.cities : CLIENT[key]);
  }

  function fieldRow(key, label, value, options) {
    var settings = options || {};
    var html = '';

    if (settings.chips) {
      var list = normalizeList(settings.chipSource);

      html = '<span class="m-val m-editable chips-view" data-edit="' + key + '" data-value="' + esc(list.join(', ')) + '">'
        + esc(list.join(', ') || '—') + '</span>';
    } else if (settings.tag) {
      html = '<span class="badge badge--' + value + '">' + esc(settings.tagLabel) + '</span>';
    } else if (settings.plain) {
      html = '<span class="m-val">' + esc(value || '—') + '</span>';
    } else {
      html = '<span class="m-val m-editable" data-edit="' + key + '" data-value="' + esc(value) + '">' + esc(value || '—') + '</span>';
    }

    return '<div class="m-row"' + (settings.tag ? ' data-kind="tag"' : '') + '>'
      + '<span class="m-key">' + esc(label) + '</span>'
      + '<span class="m-cell">' + html + '</span></div>';
  }

  function render() {
    var client = CLIENT;
    var history = makeHistory(client.orders);

    var contacts = [
      fieldRow('phone', 'Телефон', client.phone),
      '<div class="m-row"><span class="m-key">Телеграм</span>'
        + '<span class="m-cell"><a class="m-val m-link" href="https://t.me/' + esc(String(client.telegram).replace(/^@/, '')) + '" target="_blank" rel="noopener">'
        + esc(client.telegram) + '</a></span></div>',
      fieldRow('instagram', 'Инстаграм', client.instagram),
      fieldRow('email', 'Email', client.email)
    ].join('');

    var details = [
      '<div class="m-row m-row--type"><span class="m-key">Тип клиента</span>'
        + '<span class="m-cell"><span class="switch" id="typeSwitch">'
        + TYPE_ORDER.map(function (key) {
          return '<button type="button" class="switch__btn' + (client.type === key ? ' is-on' : '') + '" data-type="' + key + '">' + TYPE_LABELS[key] + '</button>';
        }).join('')
        + '</span></span></div>',
      fieldRow('agency', 'Агентство', client.agency),
      fieldRow('agencyAliases', 'Вариации', client.agencyAliases.join(', '), { chips: 'agencyAliases', chipSource: client.agencyAliases }),
      fieldRow('cities', 'Города', client.cities, { chips: 'cities', chipSource: client.cities }),
      '<div class="m-row m-row--type"><span class="m-key">Рейтинг</span>'
        + '<span class="m-cell"><span class="switch" id="ratingSwitch">'
        + RATING_ORDER.map(function (key) {
          return '<button type="button" class="switch__btn' + (client.rating === key ? ' is-on' : '') + '" data-rating="' + key + '">' + RATING_LABELS[key] + '</button>';
        }).join('')
        + '</span></span></div>'
    ].join('');

    view.innerHTML = ''
      + '<div class="card">'
      + '  <div class="m-head">'
      + '    <div class="m-head__title m-editable" data-edit="name" data-value="' + esc(client.name) + '">' + esc(client.name) + '</div>'
      + '  </div>'
      + '  <div class="m-body">'
      + '    <div class="m-main">'
      + '      <div class="m-group"><div class="m-group__title">Контакты</div>' + contacts + '</div>'
      + '      <div class="m-group"><div class="m-group__title">Клиент</div>' + details + '</div>'
      + '      <div class="m-group"><div class="m-group__title">Комментарий</div>'
      + '        <div class="m-note m-editable" data-edit="comment" data-value="' + esc(client.comment) + '">' + esc(client.comment || '—') + '</div>'
      + '      </div>'
      + '    </div>'
      + '    <aside class="m-side">'
      + '      <div class="m-metrics">'
      + '        <div class="m-metric"><span>Заказов</span><b>' + client.orders + '</b></div>'
      + '        <div class="m-metric"><span>Запросов</span><b>' + client.requests + '</b></div>'
      + '        <div class="m-metric"><span>Последний заказ</span><b>' + esc(client.lastOrder) + '</b></div>'
      + '        <div class="m-metric"><span>Оборот за год</span><b class="m-metric__money">' + esc(client.sum) + '</b></div>'
      + '      </div>'
      + '      <div class="m-stream">'
      + '        <div class="m-stream__head"><span>История</span><span class="dim">' + client.orders + ' заказов</span></div>'
      + '        <div class="m-stream__list" id="streamList"></div>'
      + '      </div>'
      + '    </aside>'
      + '  </div>'
      + '  <div class="m-foot">Создан ' + esc(client.created) + ' · ' + esc(client.createdBy) + '</div>'
      + '</div>';

    history = makeHistory(client.orders);
    fillStream(history);

    bind();
  }

  function fillStream(items) {
    document.getElementById('streamList').innerHTML = items.map(function (item) {
      return '<button type="button" class="m-event m-event--' + item.key + '" data-order="' + esc(item.name) + '">'
        + '<span class="m-event__date">' + esc(item.date) + '</span>'
        + '<span class="m-event__name">' + esc(item.name) + '</span>'
        + '<span class="m-event__cost">' + esc(item.cost) + '</span></button>';
    }).join('');
  }

  function bind() {
    var card = view.querySelector('.card');

    card.querySelectorAll('.switch').forEach(function (switcher) {
      switcher.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-type], [data-rating]');

        if (!btn) return;

        if (btn.dataset.type) CLIENT.type = btn.dataset.type;
        if (btn.dataset.rating) CLIENT.rating = btn.dataset.rating;

        Array.prototype.forEach.call(this.querySelectorAll('button'), function (item) {
          item.classList.toggle('is-on', item === btn);
        });
      });
    });

    card.addEventListener('click', function (e) {
      var order = e.target.closest('[data-order]');

      if (order) {
        toast('Открыть заказ · ' + order.dataset.order);
        return;
      }

      var drop = e.target.closest('[data-chip-remove]');

      if (drop) {
        var dropKey = drop.dataset.chipRemove;

        setList(dropKey, getList(dropKey).filter(function (item) { return item !== drop.dataset.chipValue; }));
        render();
        return;
      }

    });

    card.addEventListener('dblclick', function (e) {
      var target = e.target.closest('.m-editable');

      if (!target || target.querySelector('input, textarea')) return;

      if (target.dataset.edit === 'cities' || target.dataset.edit === 'agencyAliases') {
        startChipEdit(target);
        return;
      }

      startEdit(target);
    });
  }

  function startChipEdit(target) {
    var key = target.dataset.edit;
    var list = getList(key);

    target.classList.remove('m-editable');
    target.innerHTML = '<span class="chips">'
      + list.map(function (item) {
        return '<span class="city-chip"><span>' + esc(item) + '</span>'
          + '<button type="button" class="city-chip__remove" data-chip-remove="' + key + '" data-chip-value="' + esc(item) + '">×</button></span>';
      }).join('')
      + '<input class="chip-input" placeholder="Добавить">'
      + '</span>';

    var input = target.querySelector('.chip-input');

    input.focus();

    function collect() {
      return list.slice();
    }

    function finish(save) {
      if (target.dataset.done) return;

      target.dataset.done = '1';

      if (save) setList(key, collect());

      render();
    }

    target.addEventListener('click', function (e) {
      var drop = e.target.closest('[data-chip-remove]');

      if (!drop) return;

      var value = drop.dataset.chipValue;
      var index = list.indexOf(value);

      if (index >= 0) list.splice(index, 1);

      drop.closest('.city-chip').remove();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        var value = input.value.trim();

        if (value && list.indexOf(value) < 0) {
          list.push(value);

          var chip = document.createElement('span');

          chip.className = 'city-chip';
          chip.innerHTML = '<span>' + esc(value) + '</span>'
            + '<button type="button" class="city-chip__remove" data-chip-remove="' + key + '" data-chip-value="' + esc(value) + '">×</button>';
          input.parentNode.insertBefore(chip, input);
        }

        input.value = '';
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(function () {
        if (!target.contains(document.activeElement)) finish(true);
      }, 80);
    });
  }

  function startEdit(target) {
    var key = target.dataset.edit;
    var value = CLIENT[key];
    var multiline = key === 'comment';

    if (Array.isArray(value)) value = value.join(', ');

    var input = document.createElement(multiline ? 'textarea' : (String(CLIENT[key] || '').length > 60 ? 'textarea' : 'input'));

    input.className = 'm-input' + (input.tagName === 'TEXTAREA' ? ' m-input--area' : '');
    input.value = value || '';

    if (input.tagName === 'TEXTAREA') input.rows = 2;

    target.textContent = '';
    target.appendChild(input);
    input.focus();

    if (input.tagName === 'TEXTAREA') {
      autoGrow(input);

      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      input.select();
    }

    input.addEventListener('input', function () {
      if (input.tagName === 'TEXTAREA') autoGrow(input);
    });

    function commit(save) {
      if (save) {
        var next = input.value.trim();

        if (key === 'agencyAliases') {
          CLIENT[key] = next ? next.split(',').map(function (part) { return part.trim(); }).filter(Boolean) : [];
        } else if (key === 'cities') {
          CLIENT[key] = next;
        } else {
          CLIENT[key] = next;
        }

        toast('Сохранено: ' + next.replace(/\n/g, ' '));
      }

      render();
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.tagName === 'INPUT') {
        e.preventDefault();
        commit(true);
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit(true);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        commit(false);
      }
    });

    input.addEventListener('blur', function () {
      if (input.dataset.done) return;

      input.dataset.done = '1';
      commit(true);
    });
  }

  render();
})();
