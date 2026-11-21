(function () {
  var M = window.EMP_META;
  var fmt = window.fmt;
  var roles = [];

  var STEPS = [
    { id: 'account', title: 'Учётная запись', fields: [
      { id: 'login', label: 'Логин', ph: 'sofia.event', req: true },
      { id: 'password', label: 'Пароль', ph: 'минимум 8 символов', type: 'password', req: true }
    ], lines: [
      { type: 'flag', id: 'activeFlag', text: 'Сотрудник активен' }
    ] },
    { id: 'main', title: 'Основное', fields: [
      { id: 'name', label: 'ФИО', ph: 'Фамилия Имя Отчество', req: true },
      { id: 'nick', label: 'Имя для обращения', ph: 'как звать' },
      { id: 'phone', label: 'Телефон', ph: '+7 (___) ___-__-__', req: true },
      { id: 'tg', label: 'Телеграм', ph: '@username' },
      { id: 'inst', label: 'Инстаграм', ph: '@username' },
      { id: 'rzd', label: 'Номер РЖД бонус', ph: 'номер' }
    ], lines: [
      { type: 'roles', id: 'roleList' }
    ] },
    { id: 'foreign', title: 'Загранпаспорт', fields: [
      { id: 'fser', label: 'Серия', ph: '00 00' },
      { id: 'fnum', label: 'Номер', ph: '000000' },
      { id: 'fby', label: 'Кем выдан', ph: 'кем выдан', text: true },
      { id: 'fdate', label: 'Дата выдачи', ph: 'ДД.ММ.ГГГГ' },
      { id: 'fcode', label: 'Код подразделения', ph: '000-000' }
    ] },
    { id: 'passport', title: 'Паспортные данные', fields: [
      { id: 'pser', label: 'Серия', ph: '00 00' },
      { id: 'pnum', label: 'Номер', ph: '000000' },
      { id: 'pby', label: 'Кем выдан', ph: 'кем выдан', text: true },
      { id: 'pdate', label: 'Дата выдачи', ph: 'ДД.ММ.ГГГГ' },
      { id: 'pcode', label: 'Код подразделения', ph: '000-000' },
      { id: 'addr', label: 'Адрес регистрации', ph: 'город, улица, дом, кв.', text: true },
      { id: 'inn', label: 'ИНН', ph: '12 цифр' },
      { id: 'snils', label: 'СНИЛС', ph: '000-000-000 00' }
    ] },
    { id: 'artist', title: 'Карточка артиста', fields: [
      { id: 'weight', label: 'Вес', ph: 'кг' },
      { id: 'height', label: 'Рост', ph: 'см' },
      { id: 'shoe', label: 'Размер обуви', ph: 'размер' },
      { id: 'show', label: 'Знание шоу', ph: 'какие шоу знает', text: true },
      { id: 'comment', label: 'Комментарий', ph: 'заметки о сотруднике', text: true }
    ], lines: [
      { type: 'skills', id: 'skillList' }
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
    return '<div class="f-row' + (f.text ? ' f-row--text' : '') + '" data-row="' + f.id + '">' +
      '<span class="f-num"></span>' +
      '<span class="f-k">' + fmt(f.label) + (f.req ? '<i class="f-req">*</i>' : '') + '</span>' +
      '<' + tag + ' class="field' + (f.text ? ' field--text' : '') + '" id="f_' + f.id + '" data-id="' + f.id + '"' +
      ' placeholder="' + fmt(f.ph) + '" autocomplete="off" spellcheck="false"' +
      (f.type === 'password' ? ' type="password"' : '') + (f.text ? ' rows="1"' : '') + '></' + tag + '>' +
      '<span class="f-tick"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg></span>' +
      '</div>';
  }

  function lineHtml(l) {
    if (l.type === 'roles') {
      return '<div class="f-row f-row--pick"><span class="f-num"></span><span class="f-k">Роли</span>' +
        '<div class="f-picks" id="roleList">' + M.roles.map(function (r) {
          return '<button type="button" class="f-pick' + (roles.indexOf(r[0]) !== -1 ? ' is-on' : '') + '" data-role="' + r[0] + '">' + fmt(r[1]) + '</button>';
        }).join('') + '</div></div>';
    }
    if (l.type === 'skills') {
      return '<div class="f-row f-row--pick"><span class="f-num"></span><span class="f-k">Навыки</span>' +
        '<div class="f-picks" id="skillList">' + M.skills.map(function (s, i) {
          return '<button type="button" class="f-pick' + (i < 2 ? ' is-on' : '') + '" data-skill="' + fmt(s) + '">' + fmt(s) + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="f-row f-row--flag"><span class="f-num"></span><span class="f-k"></span>' +
      '<button type="button" class="f-flag is-on" id="' + l.id + '"><span class="f-switch"></span>' + fmt(l.text) + '</button></div>';
  }

  function render() {
    var artist = roles.indexOf('artist') !== -1;
    var total = 0;
    var html = '<div class="f-head"><div class="f-head__title">Новый сотрудник</div>' +
      '<div class="f-head__sub">Tab и Enter — следующее поле, Esc — отмена</div>' +
      '<button type="button" class="icon-btn" data-toast="Закрыть">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button></div>';

    html += '<div class="f-scroll" id="fScroll">';
    STEPS.forEach(function (s, si) {
      if (s.id === 'artist' && !artist) return;
      html += '<div class="f-step" data-step="' + s.id + '">' +
        '<div class="f-step__head"><span class="f-step__n">' + (si + 1) + '</span>' + fmt(s.title) + '</div>';
      s.fields.forEach(function (f) {
        total += 1;
        html += fieldHtml(f);
      });
      (s.lines || []).forEach(function (l) { html += lineHtml(l); });
      html += '</div>';
    });
    html += '</div>';

    document.getElementById('view').innerHTML = html;
    bind();
    numberRows();
  }

  function numberRows() {
    var rows = document.querySelectorAll('#fScroll .f-row');
    var prevStep = null;
    var n = 0;
    rows.forEach(function (row) {
      var step = row.closest('.f-step').getAttribute('data-step');
      if (step !== prevStep) {
        n = 0;
        prevStep = step;
      }
      n += 1;
      row.querySelector('.f-num').textContent = String(n).padStart(2, '0');
    });
    updateCount();
  }

  function updateCount() {
    var el = document.getElementById('count');
    if (!el) return;
    var all = document.querySelectorAll('#fScroll .field');
    var done = document.querySelectorAll('#fScroll .f-row.is-done');
    el.textContent = done.length + ' из ' + all.length + ' полей';
  }

  function bind() {
    var view = document.getElementById('view');
    var stepField = null;

    view.addEventListener('click', function (e) {
      var rb = e.target.closest('[data-role]');
      if (rb) {
        var r = rb.getAttribute('data-role');
        if (roles.indexOf(r) === -1) roles.push(r);
        else roles = roles.filter(function (x) { return x !== r; });
        render();
        return;
      }
      var pk = e.target.closest('[data-skill]');
      if (pk) {
        pk.classList.toggle('is-on');
        return;
      }
      var fl = e.target.closest('.f-flag');
      if (fl) {
        fl.classList.toggle('is-on');
        fl.lastChild.textContent = fl.classList.contains('is-on') ? 'Сотрудник активен' : 'Сотрудник отключён';
      }
    });

    view.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains('field')) return;
      var mask = MASKS[t.getAttribute('data-id')];
      if (mask) t.value = mask(t.value);
      if (t.classList.contains('field--text')) window.autoGrow(t);
      t.closest('.f-row').classList.toggle('is-done', t.value.trim() !== '');
      updateCount();
    });

    view.addEventListener('keydown', function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains('field')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        t.blur();
        return;
      }
      if (e.key !== 'Enter') return;
      if (t.classList.contains('field--text') && !e.ctrlKey) return;
      e.preventDefault();
      var all = Array.prototype.slice.call(view.querySelectorAll('.field'));
      var next = all[all.indexOf(t) + 1];
      if (next) next.focus();
    });
  }

  render();
  document.getElementById('f_login').focus();
})();
