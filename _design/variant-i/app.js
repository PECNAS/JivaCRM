(function () {
  'use strict';

  var FIELDS = [
    { key: 'name', label: 'Название', required: false, placeholder: 'Например: Форум ЭТМ, юбилей, корпоратив' },
    { key: 'client', label: 'Клиент', required: true, placeholder: 'Агентство, компания или заказчик' },
    { key: 'city', label: 'Город', required: true, placeholder: 'Москва, Казань, Чебоксары…' },
    { key: 'date', label: 'Дата', required: true, placeholder: '25.12.2026 или 25 декабря' },
    { key: 'start', label: 'Начало', required: false, placeholder: '19:00' },
    { key: 'end', label: 'Окончание', required: false, placeholder: '21:30' },
    { key: 'setup_time', label: 'Чек / установка', required: true, placeholder: 'с 13 до 16, монтаж лазеров' },
    { key: 'address', label: 'Адрес', required: true, placeholder: 'Площадка, зал, особенности' },
    { key: 'contact_name', label: 'Контакт', required: false, placeholder: 'Имя контактного лица' },
    { key: 'contact_phone', label: 'Телефон', required: true, placeholder: '+7 (999) 123-45-67' },
    { key: 'contact_telegram', label: 'Телеграм', required: true, placeholder: '@username' },
    { key: 'chat', label: 'Номер чата', required: false, placeholder: '759-845' },
    { key: 'shows', label: 'Шоу', required: false, placeholder: 'Одно шоу на строку: Эмпатия, Космос, Фениксы' },
    { key: 'staff', label: 'Состав', required: false, placeholder: 'Артисты: Матвей, Миша, Маша' },
    { key: 'concept', label: 'Концепция', required: false, placeholder: 'Задача, формат, важность' },
    { key: 'tech', label: 'Техника', required: false, placeholder: 'Лампы, лазер, сетка, проекция, комментарий' },
    { key: 'dressing_room', label: 'Гримёрка', required: false, placeholder: 'Гримёрки, удобства' },
    { key: 'meal', label: 'Еда', required: false, placeholder: 'Питание, предпочтения' },
    { key: 'cost', label: 'Стоимость', required: true, placeholder: '278 000.00₽' },
    { key: 'payment', label: 'Оплата', required: true, placeholder: 'ИП / самозанятость / наличные, остаток' },
    { key: 'manager', label: 'Менеджер', required: true, placeholder: 'Имя менеджера' },
    { key: 'story_manager', label: 'Сториз', required: false, placeholder: 'Ответственный за сториз' }
  ];

  var fieldsEl = document.getElementById('fields');
  var writeScroll = document.getElementById('writeScroll');
  var headTags = document.getElementById('headTags');
  var activeLabel = document.getElementById('activeLabel');
  var writeCount = document.getElementById('writeCount');
  var fieldCount = document.getElementById('fieldCount');
  var cardEl = document.getElementById('card');
  var cardTitle = document.getElementById('cardTitle');
  var cardBadges = document.getElementById('cardBadges');
  var cardRows = document.getElementById('cardRows');
  var cardNote = document.getElementById('cardNote');
  var cardNoteBody = document.getElementById('cardNoteBody');
  var statusSwitch = document.getElementById('statusSwitch');

  var inputs = {};

  function esc(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function val(key) {
    return inputs[key] ? inputs[key].input.value.trim() : '';
  }

  function lines(key) {
    return val(key).split('\n').map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function autoSize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function build() {
    fieldsEl.innerHTML = '';
    inputs = {};

    FIELDS.forEach(function (field) {
      var wrap = document.createElement('div');
      var label = document.createElement('label');
      var box = document.createElement('div');
      var input = document.createElement('textarea');
      var flag = document.createElement('span');

      wrap.className = 'field';
      wrap.dataset.key = field.key;
      label.className = 'field__label' + (field.required ? ' is-required' : '');
      label.textContent = field.label;
      label.htmlFor = 'f-' + field.key;
      box.className = 'field__box';
      input.className = 'field__input';
      input.id = 'f-' + field.key;
      input.rows = 1;
      input.placeholder = field.placeholder;
      input.spellcheck = false;
      flag.className = 'field__flag';
      flag.textContent = 'ок';

      box.appendChild(input);
      box.appendChild(flag);
      wrap.appendChild(label);
      wrap.appendChild(box);
      fieldsEl.appendChild(wrap);

      inputs[field.key] = { wrap: wrap, input: input, flag: flag, def: field };

      bindInput(field, wrap, input);
    });
  }

  function bindInput(field, wrap, input) {
    input.addEventListener('focus', function () {
      setActive(field.key);
    });

    input.addEventListener('input', function () {
      autoSize(input);
      markDone(field.key, input.value.trim().length > 0);
      renderAll();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          save();
          return;
        }

        if (e.shiftKey) return;

        e.preventDefault();
        insertLineBreak(input);
        autoSize(input);
        markDone(field.key, input.value.trim().length > 0);
        renderAll();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();

        var target = e.shiftKey ? prevInput(field.key) : nextInput(field.key);

        if (target) {
          target.focus();

          var end = target.value.length;

          target.setSelectionRange(end, end);
        }

        return;
      }

      if (e.key === 'Backspace' && !input.value && !e.shiftKey) {
        var prev = prevInput(field.key);

        if (prev) {
          e.preventDefault();
          prev.focus();

          var len = prev.value.length;

          prev.setSelectionRange(len, len);
        }
      }
    });

    input.addEventListener('paste', function () {
      setTimeout(function () {
        autoSize(input);
        markDone(field.key, input.value.trim().length > 0);
        renderAll();
      }, 0);
    });
  }

  function insertLineBreak(input) {
    var start = input.selectionStart;
    var end = input.selectionEnd;
    var value = input.value;

    input.value = value.slice(0, start) + '\n' + value.slice(end);
    input.selectionStart = start + 1;
    input.selectionEnd = start + 1;
    autoSize(input);
  }

  function nextInput(key) {
    var index = FIELDS.map(function (item) { return item.key; }).indexOf(key);
    var next = FIELDS[index + 1];

    return next ? inputs[next.key].input : null;
  }

  function prevInput(key) {
    var index = FIELDS.map(function (item) { return item.key; }).indexOf(key);
    var prev = FIELDS[index - 1];

    return prev ? inputs[prev.key].input : null;
  }

  function setActive(key) {
    Object.keys(inputs).forEach(function (name) {
      inputs[name].wrap.classList.toggle('is-active', name === key);
    });

    var field = FIELDS.filter(function (item) { return item.key === key; })[0];

    activeLabel.textContent = field ? 'Ввод: ' + field.label : '—';
    cardEl.classList.toggle('is-typing', !!field);
  }

  function markDone(key, done) {
    var item = inputs[key];

    if (!item) return;

    item.wrap.classList.toggle('is-done', done);
  }

  function techBadges() {
    var source = (val('tech') + ' ' + val('concept')).toLowerCase();
    var badges = [];

    if (/ламп|свет/.test(source)) badges.push('Лампы');
    if (/лазер|сира/.test(source)) badges.push('Лазер');
    if (/хейзер|дым/.test(source)) badges.push('Хейзер');
    if (/сетк/.test(source)) badges.push('Сетка');
    if (/проекц/.test(source)) badges.push('Проекция');

    return badges;
  }

  function renderCard() {
    var name = val('name');
    var city = val('city');
    var date = val('date');
    var start = val('start');
    var end = val('end');
    var manager = val('manager');
    var cost = val('cost');
    var staff = lines('staff');
    var people = staff.length;

    cardTitle.textContent = name || (city || date ? (date ? date : city) : 'Без названия');

    var badges = [];

    badges.push('<span class="cbadge cbadge--status">' + esc(statusTitle()) + '</span>');

    if (city) badges.push('<span class="cbadge">' + esc(city) + '</span>');
    if (date) badges.push('<span class="cbadge">' + esc(date) + '</span>');

    var time = start ? start + (end ? '–' + end : '') : '';

    if (time) badges.push('<span class="cbadge">' + esc(time) + '</span>');
    if (people) badges.push('<span class="cbadge">' + people + ' чел.</span>');

    cardBadges.innerHTML = badges.join('');

    var rows = [];

    function row(label, value, extra) {
      if (!value) return;

      rows.push('<div class="cline' + (extra ? ' ' + extra : '') + '"><span class="cline__k">' + esc(label) + '</span>'
        + '<span class="cline__v">' + esc(value).replace(/\n/g, '<br>') + '</span></div>');
    }

    row('Площадка', [val('address'), val('chat') ? 'чат ' + val('chat') : ''].filter(Boolean).join(', '));

    var contact = [val('contact_name'), val('contact_phone'), val('contact_telegram')].filter(Boolean).join(', ');

    row('Контакты', contact);
    row('Шоу', lines('shows').join(' · '));
    row('Состав', staff.join(', '));
    row('Выставление', [val('setup_time') ? 'чек ' + val('setup_time') : '', val('start') ? 'начало ' + val('start') : ''].filter(Boolean).join(', '));
    row('Техника', [techBadges().join(', '), val('tech')].filter(Boolean).join(' — '));
    row('Гримёрка', val('dressing_room'));
    row('Еда', val('meal'));
    row('Менеджер', [manager, val('story_manager') ? 'сториз: ' + val('story_manager') : ''].filter(Boolean).join(' · '));

    var payment = [val('payment')].filter(Boolean).join('');

    row('Оплата', payment);
    row('Стоимость', cost, cost ? 'cline--money' : '');

    cardRows.innerHTML = rows.join('');

    if (!rows.length) {
      cardRows.innerHTML = '<div class="card__empty">Карточка соберётся, как только заполните поля</div>';
    }

    var concept = [val('concept')].filter(Boolean).join('\n');

    cardNote.hidden = !concept;

    if (concept && cardNoteBody.textContent !== concept) cardNoteBody.textContent = concept;

    cardEl.classList.toggle('is-empty', !rows.length);
  }

  function statusTitle() {
    var active = statusSwitch.querySelector('.status-switch__btn.is-on');

    return active ? active.textContent : 'Запрос';
  }

  function renderCounts() {
    var filled = FIELDS.filter(function (field) { return val(field.key); }).length;
    var required = FIELDS.filter(function (field) { return field.required; });
    var doneRequired = required.filter(function (field) { return val(field.key); }).length;

    writeCount.textContent = filled + ' заполнено';
    fieldCount.textContent = 'Заполнено ' + filled + ' из ' + FIELDS.length + ' · обязательных ' + doneRequired + ' из ' + required.length;
  }

  function renderTags() {
    var tags = ['<span class="tag tag--status">' + esc(statusTitle()) + '</span>'];
    var city = val('city');
    var date = val('date');
    var start = val('start');
    var manager = val('manager');
    var cost = val('cost');

    if (city) tags.push('<span class="tag" data-label="город">' + esc(city) + '</span>');
    if (date) tags.push('<span class="tag" data-label="дата">' + esc(date) + '</span>');
    if (start) tags.push('<span class="tag" data-label="время">' + esc(start) + '</span>');
    if (manager) tags.push('<span class="tag" data-label="менеджер">' + esc(manager) + '</span>');
    if (cost) tags.push('<span class="tag tag--accent">' + esc(cost) + '</span>');

    headTags.innerHTML = tags.join('');
  }

  function renderAll() {
    renderCard();
    renderCounts();
    renderTags();
  }

  statusSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('.status-switch__btn');

    if (!btn) return;

    Array.prototype.forEach.call(this.querySelectorAll('.status-switch__btn'), function (item) {
      item.classList.toggle('is-on', item === btn);
    });

    renderAll();
  });

  cardTitle.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    cardTitle.blur();
  });

  cardNoteBody.addEventListener('blur', function () {
    inputs.concept.input.value = cardNoteBody.textContent;
    autoSize(inputs.concept.input);
  });

  document.getElementById('addLine').addEventListener('click', function () {
    var empty = FIELDS.filter(function (field) { return !val(field.key); })[0];

    if (empty) {
      inputs[empty.key].input.focus();
      return;
    }

    inputs[FIELDS[0].key].input.focus();
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    FIELDS.forEach(function (field) {
      var input = inputs[field.key].input;

      input.value = '';
      autoSize(input);
      markDone(field.key, false);
    });

    renderAll();
    inputs.name.input.focus();
  });

  document.getElementById('saveBtn').addEventListener('click', save);

  function save() {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');

    toast.className = 'toast';
    toast.textContent = 'Заказ сохранён · ' + fieldCount.textContent;
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2200);
  }

  build();

  inputs.name.input.value = 'Форум ЭТМ — казанский вариант, 700 человек';
  inputs.city.input.value = 'Казань';
  inputs.date.input.value = '25.12.2026';
  inputs.start.input.value = '19:00';
  inputs.end.input.value = '21:30';
  inputs.address.input.value = 'Экспо, главный зал\nсначала хотели феников';
  inputs.contact_name.input.value = 'Ирина';
  inputs.contact_phone.input.value = '+7 (927) 710-61-11';
  inputs.contact_telegram.input.value = '@sshnkv';
  inputs.setup_time.input.value = 'с 13 до 16';
  inputs.shows.input.value = 'Эмпатия\nКосмос\nДефиле';
  inputs.staff.input.value = 'Матвей, Миша, Маша, Лиза';
  inputs.concept.input.value = 'Солянка, проекция общая универсальная новогодняя';
  inputs.tech.input.value = '5 лазеров, большая сетка, хейзеры не нужны';
  inputs.dressing_room.input.value = 'Две монтажки, хорошие гримерки';
  inputs.meal.input.value = 'Заказали на всех';
  inputs.cost.input.value = '278 000.00₽';
  inputs.payment.input.value = 'ИП, остаток уточняем';
  inputs.manager.input.value = 'Арина';
  inputs.story_manager.input.value = 'Джу';

  FIELDS.forEach(function (field) {
    var input = inputs[field.key].input;

    autoSize(input);
    markDone(field.key, input.value.trim().length > 0);
  });

  renderAll();
  inputs.name.input.focus();
})();
