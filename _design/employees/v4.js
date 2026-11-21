(function () {
  var M = window.EMP_META;
  var fmt = window.fmt;
  var roles = [];

  var GROUPS = [
    { id: 'account', title: 'Учётная запись', fields: [
      { id: 'login', label: 'Логин', ph: 'sofia.event', auto: true },
      { id: 'password', label: 'Пароль', ph: 'сгенерировать', type: 'password', auto: true }
    ] },
    { id: 'main', title: 'Основное', fields: [
      { id: 'name', label: 'ФИО', ph: 'Фамилия Имя Отчество', auto: true },
      { id: 'nick', label: 'Обращение', ph: 'как звать', auto: true },
      { id: 'phone', label: 'Телефон', ph: '+7 (___) ___-__-__', auto: true },
      { id: 'tg', label: 'Телеграм', ph: '@username', auto: true },
      { id: 'inst', label: 'Инстаграм', ph: '@username', auto: true },
      { id: 'rzd', label: 'РЖД бонус', ph: 'номер', auto: true }
    ] },
    { id: 'foreign', title: 'Загранпаспорт', fields: [
      { id: 'fser', label: 'Серия', ph: '00 00', auto: true },
      { id: 'fnum', label: 'Номер', ph: '000000', auto: true },
      { id: 'fby', label: 'Кем выдан', ph: 'кем выдан', text: true },
      { id: 'fdate', label: 'Дата выдачи', ph: 'ДД.ММ.ГГГГ', auto: true },
      { id: 'fcode', label: 'Код', ph: '000-000', auto: true }
    ] },
    { id: 'passport', title: 'Паспортные данные', fields: [
      { id: 'pser', label: 'Серия', ph: '00 00', auto: true },
      { id: 'pnum', label: 'Номер', ph: '000000', auto: true },
      { id: 'pby', label: 'Кем выдан', ph: 'кем выдан', text: true },
      { id: 'pdate', label: 'Дата выдачи', ph: 'ДД.ММ.ГГГГ', auto: true },
      { id: 'pcode', label: 'Код', ph: '000-000', auto: true },
      { id: 'addr', label: 'Адрес регистрации', ph: 'город, улица, дом, кв.', text: true },
      { id: 'inn', label: 'ИНН', ph: '12 цифр', auto: true },
      { id: 'snils', label: 'СНИЛС', ph: '000-000-000 00', auto: true }
    ] },
    { id: 'artist', title: 'Карточка артиста', fields: [
      { id: 'weight', label: 'Вес', ph: 'кг', auto: true },
      { id: 'height', label: 'Рост', ph: 'см', auto: true },
      { id: 'shoe', label: 'Обувь', ph: 'размер', auto: true },
      { id: 'show', label: 'Знание шоу', ph: 'какие шоу знает', text: true },
      { id: 'comment', label: 'Комментарий', ph: 'заметки о сотруднике', text: true }
    ] }
  ];

  var MASKS = {
    phone: window.maskPhone,
    fser: window.maskSeries,
    pser: window.maskSeries,
    fcode: window.maskCode,
    pcode: window.maskCode,
    fdate: window.maskDate,
    pdate: window.maskDate
  };

  function fieldHtml(f) {
    var tag = f.text ? 'textarea' : 'input';
    return '<div class="w-row" data-row="' + f.id + '">' +
      '<span class="w-k">' + fmt(f.label) + '</span>' +
      '<' + tag + ' class="field' + (f.text ? ' field--text' : '') + '" id="f_' + f.id + '" data-id="' + f.id + '"' +
      ' placeholder="' + fmt(f.ph) + '" autocomplete="off" spellcheck="false"' +
      (f.type === 'password' ? ' type="password"' : '') + (f.text ? ' rows="1"' : '') + '></' + tag + '>' +
      '</div>';
  }

  function render() {
    var artist = roles.indexOf('artist') !== -1;
    var html = '<div class="w-head">' +
      '<div class="w-head__main"><div class="w-head__title">Новый сотрудник</div>' +
      '<div class="w-head__sub">Роли и навыки — кнопками, Enter переводит на следующее поле</div></div>' +
      '<button type="button" class="icon-btn" data-toast="Закрыть">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button></div>';

    html += '<div class="w-scroll" id="wScroll">';

    html += '<div class="w-group"><div class="w-group__head">Активен</div>' +
      '<div class="w-row w-row--line"><span class="w-k">Учётная запись</span>' +
      '<button type="button" class="w-flag is-on" id="activeFlag"><span class="w-flag__box"></span>Сотрудник активен</button></div>' +
      '<div class="w-row w-row--roles"><span class="w-k">Роли</span><div class="w-roles" id="roleList">' +
      M.roles.map(function (r) {
        return '<button type="button" class="w-role' + (roles.indexOf(r[0]) !== -1 ? ' is-on' : '') + '" data-role="' + r[0] + '">' + fmt(r[1]) + '</button>';
      }).join('') + '</div></div></div>';

    GROUPS.forEach(function (g) {
      if (g.id === 'artist' && !artist) return;
      html += '<div class="w-group">';
      html += '<div class="w-group__head">' + fmt(g.title) + '</div>';
      if (g.id === 'account') {
        html += fieldHtml(g.fields[0]) + fieldHtml(g.fields[1]);
        html += '<div class="w-row w-row--gen"><span class="w-k"></span><button type="button" class="btn btn-sm" id="genBtn">Сгенерировать</button>' +
          '<button type="button" class="btn btn-sm" data-toast="Пароль скопирован">Скопировать</button></div>';
      } else if (g.id === 'main') {
        html += fieldHtml(g.fields[0]);
        html += '<div class="w-row w-row--pair"><span class="w-k">Обращение / РЖД</span><div class="w-pair">' + inline(g.fields[1]) + inline(g.fields[5]) + '</div></div>';
        html += fieldHtml(g.fields[2]);
        html += '<div class="w-row w-row--pair"><span class="w-k">Телеграм / Инстаграм</span><div class="w-pair">' + inline(g.fields[3]) + inline(g.fields[4]) + '</div></div>';
      } else if (g.id === 'artist') {
        html += '<div class="w-row w-row--triple"><span class="w-k">Вес / Рост / Обувь</span><div class="w-triple">' +
          g.fields.slice(0, 3).map(function (f) {
            return '<label class="w-mini"><input class="field" id="f_' + f.id + '" data-id="' + f.id + '" placeholder="' + fmt(f.ph) + '" autocomplete="off" spellcheck="false"></label>';
          }).join('') + '</div></div>';
        html += '<div class="w-row w-row--skills"><span class="w-k">Навыки</span><div class="w-skills" id="skillList">' +
          M.skills.map(function (s) {
            return '<button type="button" class="chip" data-skill="' + fmt(s) + '">' + fmt(s) + '</button>';
          }).join('') + '</div></div>';
        html += fieldHtml(g.fields[4]) + fieldHtml(g.fields[3]);
      } else {
        g.fields.forEach(function (f) { html += fieldHtml(f); });
      }
      html += '</div>';
    });

    html += '<div class="w-group"><div class="w-group__head">Документы</div>' +
      '<div class="w-row"><span class="w-k">Фото документов</span><div class="w-docs" id="docs"></div></div>' +
      '<div class="w-row"><span class="w-k"></span><button type="button" class="btn btn-sm" id="addDoc">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Добавить документ</button></div>' +
      '</div>';

    html += '</div>';

    document.getElementById('view').innerHTML = html;
    bind();
    addDoc();
  }

  function inline(f) {
    return '<input class="field" id="f_' + f.id + '" data-id="' + f.id + '" placeholder="' + fmt(f.ph) + '" autocomplete="off" spellcheck="false">';
  }

  function addDoc() {
    var box = document.getElementById('docs');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'w-doc';
    el.innerHTML = '<select class="w-doc__type">' + M.docTypes.map(function (t) {
      return '<option>' + fmt(t) + '</option>';
    }).join('') + '</select>' +
      '<input class="w-doc__cap" placeholder="подпись" autocomplete="off">' +
      '<button type="button" class="w-doc__file" data-toast="Выбрать файл">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>файл</button>' +
      '<button type="button" class="icon-btn w-doc__x" title="Удалить">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';
    box.appendChild(el);
    el.querySelector('.w-doc__x').addEventListener('click', function () {
      el.remove();
      if (!box.children.length) window.toast('Документов нет');
    });
  }

  function bind() {
    var view = document.getElementById('view');

    view.addEventListener('click', function (e) {
      var rb = e.target.closest('[data-role]');
      if (rb) {
        var r = rb.getAttribute('data-role');
        if (roles.indexOf(r) === -1) roles.push(r);
        else roles = roles.filter(function (x) { return x !== r; });
        render();
        return;
      }
      var sk = e.target.closest('[data-skill]');
      if (sk) {
        sk.classList.add('chip--accent');
        return;
      }
      if (e.target.closest('#addDoc')) {
        addDoc();
        return;
      }
      if (e.target.closest('#genBtn')) {
        document.getElementById('f_password').value = 'jv-' + Math.random().toString(36).slice(2, 10);
        window.toast('Пароль сгенерирован');
        return;
      }
      var flag = e.target.closest('#activeFlag');
      if (flag) {
        flag.classList.toggle('is-on');
        flag.lastChild.textContent = flag.classList.contains('is-on') ? 'Сотрудник активен' : 'Сотрудник отключён';
      }
    });

    view.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains('field')) return;
      var mask = MASKS[t.getAttribute('data-id')];
      if (mask) t.value = mask(t.value);
      if (t.classList.contains('field--text')) window.autoGrow(t);
    });

    view.addEventListener('keydown', function (e) {
      var t = e.target;
      if (e.key !== 'Enter' || !t.classList || !t.classList.contains('field')) return;
      if (t.classList.contains('field--text') && !e.ctrlKey) {
        window.autoGrow(t);
        return;
      }
      e.preventDefault();
      var all = Array.prototype.slice.call(view.querySelectorAll('.field'));
      var next = all[all.indexOf(t) + 1];
      if (next) next.focus();
    });
  }

  render();
  document.getElementById('f_login').focus();
})();
