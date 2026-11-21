(function () {
  var M = window.EMP_META;
  var fmt = window.fmt;

  var form = {
    name: '',
    nick: '',
    roles: [],
    active: true,
    phone: '',
    tg: '',
    inst: '',
    rzd: '',
    fser: '', fnum: '', fby: '', fdate: '', fcode: '',
    pser: '', pnum: '', pby: '', pdate: '', pcode: '',
    addr: '', inn: '', snils: '',
    weight: '', height: '', shoe: '', show: '', comment: ''
  };

  var MASKS = {
    phone: window.maskPhone,
    fser: window.maskSeries,
    pser: window.maskSeries,
    fcode: window.maskCode,
    pcode: window.maskCode,
    fdate: window.maskDate,
    pdate: window.maskDate
  };

  var MAIN = [
    ['name', 'ФИО', 'Фамилия Имя Отчество', 'text'],
    ['nick', 'Обращение', 'как звать'],
    ['phone', 'Телефон', '+7 (___) ___-__-__'],
    ['tg', 'Телеграм', '@username'],
    ['inst', 'Инстаграм', '@username'],
    ['rzd', 'РЖД бонус', 'номер']
  ];

  var FOREIGN = [
    ['fser', 'Серия', '00 00'],
    ['fnum', 'Номер', '000000'],
    ['fcode', 'Код', '000-000'],
    ['fdate', 'Дата выдачи', 'ДД.ММ.ГГГГ'],
    ['fby', 'Кем выдан', 'кем выдан', 'wide']
  ];

  var PASSPORT = [
    ['pser', 'Серия', '00 00'],
    ['pnum', 'Номер', '000000'],
    ['pcode', 'Код', '000-000'],
    ['pdate', 'Дата выдачи', 'ДД.ММ.ГГГГ'],
    ['pby', 'Кем выдан', 'кем выдан', 'wide'],
    ['addr', 'Адрес регистрации', 'город, улица, дом, кв.', 'wide'],
    ['inn', 'ИНН', '12 цифр'],
    ['snils', 'СНИЛС', '000-000-000 00']
  ];

  function fieldHtml(id, label, ph, mode) {
    return '<label class="t-f' + (mode === 'wide' ? ' t-f--wide' : '') + '">' +
      '<span class="t-f__k">' + fmt(label) + '</span>' +
      '<input class="t-f__i" data-id="' + id + '" id="f_' + id + '" placeholder="' + fmt(ph) + '" autocomplete="off" spellcheck="false" value="' + fmt(form[id]) + '">' +
      '</label>';
  }

  function render() {
    var artist = form.roles.indexOf('artist') !== -1;
    var html = '';

    html += '<div class="t-top"><span class="t-crumb" data-toast="Назад к списку">Сотрудники</span>' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' +
      '<span>Новый</span>' +
      '<button type="button" class="icon-btn t-close" data-toast="Закрыть">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button></div>';

    html += '<div class="t-body">';

    html += '<div class="t-head">' +
      '<input class="t-name" id="tName" placeholder="Фамилия Имя Отчество" autocomplete="off" value="' + fmt(form.name) + '">' +
      '<button type="button" class="t-active' + (form.active ? ' is-on' : '') + '" id="tActive"><span class="t-active__dot"></span>' + (form.active ? 'Активен' : 'Неактивен') + '</button>' +
      '</div>';

    html += '<div class="t-chips">';
    html += '<span class="t-chips__label">Роли</span><div class="t-chips__box" id="roleBox">' +
      form.roles.map(function (r) {
        return '<span class="chip chip--accent">' + fmt(M.roleLabels[r]) + '<button type="button" class="chip__x" data-unrole="' + r + '">×</button></span>';
      }).join('') +
      '<input class="t-chip-in" id="roleIn" placeholder="роль" autocomplete="off"></div>';
    html += '</div>';

    html += '<div class="t-tabs" id="tabs">' +
      '<button type="button" class="t-tab is-on" data-tab="main">Основное</button>' +
      '<button type="button" class="t-tab" data-tab="pass">Паспорт</button>' +
      '<button type="button" class="t-tab" data-tab="foreign">Загран</button>' +
      '<button type="button" class="t-tab" data-tab="artist">Артист</button>' +
      '<button type="button" class="t-tab" data-tab="docs">Файлы</button>' +
      '</div>';

    html += '<div class="t-panels">';

    html += '<div class="t-panel is-on" data-panel="main">';
    html += '<div class="t-grid t-grid--acct">' +
      fieldHtml('_login', 'Логин', 'sofia.event') +
      '<label class="t-f"><span class="t-f__k">Пароль</span><input class="t-f__i" id="f_password" type="password" placeholder="минимум 8" autocomplete="off"></label>' +
      '</div>';
    html += '<div class="t-grid">' + MAIN.map(function (f) { return fieldHtml(f[0], f[1], f[2]); }).join('') + '</div>';
    html += '</div>';

    html += '<div class="t-panel" data-panel="pass">';
    html += '<div class="t-grid">' + PASSPORT.map(function (f) { return fieldHtml(f[0], f[1], f[2], f[3]); }).join('') + '</div>';
    html += '</div>';

    html += '<div class="t-panel" data-panel="foreign">';
    html += '<div class="t-grid">' + FOREIGN.map(function (f) { return fieldHtml(f[0], f[1], f[2], f[3]); }).join('') + '</div>';
    html += '</div>';

    html += '<div class="t-panel" data-panel="artist">';
    if (artist) {
      html += '<div class="t-grid t-grid--3">' + fieldHtml('weight', 'Вес', 'кг') + fieldHtml('height', 'Рост', 'см') + fieldHtml('shoe', 'Обувь', 'размер') + '</div>';
      html += '<div class="t-line"><span class="t-f__k">Навыки</span><div class="t-chips__box" id="skillBox">' +
        M.skills.map(function (s) {
          return '<button type="button" class="chip' + (form.skills.indexOf(s) !== -1 ? ' chip--accent' : '') + '" data-skill="' + fmt(s) + '">' + fmt(s) + '</button>';
        }).join('') + '</div></div>';
      html += '<div class="t-grid">' + fieldHtml('show', 'Знание шоу', 'какие шоу знает', 'wide') + fieldHtml('comment', 'Комментарий', 'заметки', 'wide') + '</div>';
    } else {
      html += '<div class="t-none">Карточка артиста заполняется при роли «Артист». Добавьте роль выше.</div>';
    }
    html += '</div>';

    html += '<div class="t-panel" data-panel="docs">';
    html += '<div class="t-docs"><span class="t-f__k">Фото документов</span><div class="t-docs__list" id="docsList"></div>' +
      '<button type="button" class="btn btn-sm" id="docAdd">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Добавить</button></div>';
    html += '</div>';

    html += '</div></div>';

    document.getElementById('view').innerHTML = html;
    bind();
    addDoc();
    highlight();
    document.getElementById('tName').focus();
  }

  function highlight() {
    document.querySelectorAll('.t-f__i').forEach(function (i) {
      i.closest('.t-f').classList.toggle('is-done', i.value.trim() !== '');
    });
  }

  function addDoc() {
    var box = document.getElementById('docsList');
    var el = document.createElement('div');
    el.className = 't-doc';
    el.innerHTML = '<select class="t-doc__type">' + M.docTypes.map(function (t) {
      return '<option>' + fmt(t) + '</option>';
    }).join('') + '</select>' +
      '<input class="t-doc__cap" placeholder="подпись" autocomplete="off">' +
      '<button type="button" class="t-doc__file" data-toast="Выбрать файл">файл</button>' +
      '<button type="button" class="chip__x t-doc__x">×</button>';
    box.appendChild(el);
    el.querySelector('.t-doc__x').addEventListener('click', function () { el.remove(); });
  }

  function bind() {
    var view = document.getElementById('view');

    document.getElementById('tName').addEventListener('input', function (e) {
      form.name = e.target.value;
      var f = document.getElementById('f_name');
      if (f) f.value = e.target.value;
    });

    view.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        view.querySelectorAll('.t-tab').forEach(function (b) { b.classList.toggle('is-on', b === tab); });
        var id = tab.getAttribute('data-tab');
        view.querySelectorAll('.t-panel').forEach(function (p) {
          p.classList.toggle('is-on', p.getAttribute('data-panel') === id);
        });
        return;
      }
      var un = e.target.closest('[data-unrole]');
      if (un) {
        form.roles = form.roles.filter(function (r) { return r !== un.getAttribute('data-unrole'); });
        render();
        return;
      }
      var sk = e.target.closest('[data-skill]');
      if (sk) {
        var s = sk.getAttribute('data-skill');
        if (form.skills.indexOf(s) === -1) form.skills.push(s);
        else form.skills = form.skills.filter(function (x) { return x !== s; });
        sk.classList.toggle('chip--accent');
        return;
      }
      var act = e.target.closest('#tActive');
      if (act) {
        form.active = !form.active;
        render();
        return;
      }
      if (e.target.closest('#docAdd')) addDoc();
    });

    view.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('t-f__i')) {
        var id = t.getAttribute('data-id');
        var mask = MASKS[id];
        if (mask) t.value = mask(t.value);
        if (id && id.charAt(0) !== '_') form[id] = t.value;
        if (id === 'name') document.getElementById('tName').value = t.value;
        t.closest('.t-f').classList.toggle('is-done', t.value.trim() !== '');
        return;
      }
      if (t.id === 'roleIn') return;
    });

    document.getElementById('roleIn').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var v = e.target.value.trim().toLowerCase();
      if (!v) return;
      var found = M.roles.filter(function (r) {
        return r[1].toLowerCase().indexOf(v) !== -1 && form.roles.indexOf(r[0]) === -1;
      })[0];
      if (!found) {
        window.toast('Роль не найдена');
        return;
      }
      form.roles.push(found[0]);
      render();
      document.getElementById('roleIn').focus();
    });
  }

  form.skills = [];
  render();
})();
