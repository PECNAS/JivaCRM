(function () {
  var E = window.EMP;
  var M = window.EMP_META;
  var fmt = window.fmt;

  var MASKS = {
    phone: window.maskPhone,
    foreignSeries: window.maskSeries,
    foreignNumber: function (v) { return String(v || '').replace(/\D/g, '').slice(0, 6); },
    foreignDate: window.maskDate,
    foreignCode: window.maskCode,
    passportSeries: window.maskSeries,
    passportNumber: function (v) { return String(v || '').replace(/\D/g, '').slice(0, 6); },
    passportDate: window.maskDate,
    passportCode: window.maskCode,
    inn: function (v) { return String(v || '').replace(/\D/g, '').slice(0, 12); },
    snils: function (v) {
      var d = String(v || '').replace(/\D/g, '').slice(0, 11);
      var out = d.slice(0, 3);
      if (d.length > 3) out += '-' + d.slice(3, 6);
      if (d.length > 6) out += '-' + d.slice(6, 9);
      if (d.length > 9) out += ' ' + d.slice(9, 11);
      return out;
    }
  };

  var TEXT_KEYS = {
    name: 1, nickname: 1, phone: 1, telegram: 1, instagram: 1, rzd: 1, address: 1,
    inn: 1, snils: 1, login: 1,
    'passport.series': 1, 'passport.number': 1, 'passport.issuedBy': 1,
    'passport.issuedAt': 1, 'passport.code': 1,
    'foreign.series': 1, 'foreign.number': 1, 'foreign.issuedBy': 1,
    'foreign.issuedAt': 1, 'foreign.code': 1,
    'artist.weight': 1, 'artist.height': 1, 'artist.shoe': 1,
    'artist.show': 1, 'artist.comment': 1
  };

  var WIDE_KEYS = {
    address: 1, 'passport.issuedBy': 1, 'foreign.issuedBy': 1,
    'artist.show': 1, 'artist.comment': 1
  };

  function get(path) {
    var parts = path.split('.');
    var v = E;
    parts.forEach(function (p) { v = v == null ? '' : v[p]; });
    return v == null ? '' : v;
  }

  function set(path, value) {
    var parts = path.split('.');
    var obj = E;
    for (var i = 0; i < parts.length - 1; i += 1) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }

  function val(path, display) {
    var text = display != null ? display : get(path);
    var empty = String(text).trim() === '';
    return '<span class="p-row__v' + (empty ? ' is-empty' : '') + ' m-editable" data-edit="' + path + '">' +
      (empty ? '<span class="p-empty">—</span>' : text) +
      '</span>';
  }

  function row(label, path, display) {
    return '<div class="p-row"><span class="p-row__k">' + fmt(label) + '</span>' + val(path, display) + '</div>';
  }

  function docRow(doc, index) {
    return '<div class="p-doc" data-doc="' + index + '">' +
      '<span class="p-doc__type">' + fmt(doc.type) + '</span>' +
      '<span class="p-doc__cap m-editable" data-edit="docs.' + index + '.caption">' + (doc.caption ? fmt(doc.caption) : '<span class="p-empty">—</span>') + '</span>' +
      '<span class="p-doc__file">' + fmt(doc.file) + '</span>' +
      '<span class="p-doc__size">' + fmt(doc.size) + '</span>' +
      '<button type="button" class="p-doc__x" data-doc-remove="' + index + '" title="Удалить">' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>';
  }

  function passCard(title, key) {
    var p = E[key];
    return '<div class="p-card">' +
      '<div class="sec">' + fmt(title) + '</div>' +
      '<div class="p-pass">' +
      '<span class="p-pass__num">' + val(key + '.series', fmt(p.series) + ' ' + fmt(p.number)) + '</span>' +
      '<span class="p-pass__code">' + val(key + '.code', fmt(p.code)) + '</span>' +
      '<span class="p-pass__by">' + val(key + '.issuedBy', fmt(p.issuedBy)) + '</span>' +
      '<span class="p-pass__date">' + val(key + '.issuedAt', fmt(p.issuedAt)) + '</span>' +
      '</div></div>';
  }

  function render() {
    var artist = E.roles.indexOf('artist') !== -1;
    var html = '';

    html += '<div class="p-head">' +
      '<div class="p-head__main">' +
      '<div class="p-head__name m-editable" data-edit="name">' + fmt(E.name) + '</div>' +
      '<div class="p-head__sub">' +
      val('nickname', fmt(E.nickname || '')) +
      '<span class="p-dot"></span>' +
      val('login', fmt(E.login)) +
      '<button type="button" class="chip ' + (E.active ? 'chip--ok' : 'chip--off') + '" id="activeBtn">' + (E.active ? 'Активен' : 'Неактивен') + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="p-head__roles" id="roleBox">' + window.roleChips(E.roles) + '</div>' +
      '<button type="button" class="icon-btn" data-close title="Закрыть">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>';

    html += '<div class="p-body">';

    html += '<div class="p-col">';
    html += '<div class="p-card">';
    html += '<div class="sec">Контакты</div>';
    html += row('Телефон', 'phone');
    html += row('Телеграм', 'telegram');
    html += row('Инстаграм', 'instagram');
    html += row('РЖД бонус', 'rzd');
    html += row('Адрес', 'address');
    html += '</div>';

    html += '<div class="p-card">';
    html += '<div class="sec">Идентификация</div>';
    html += row('ИНН', 'inn');
    html += row('СНИЛС', 'snils');
    html += '</div>';

    html += '</div><div class="p-col">';

    html += passCard('Паспорт РФ', 'passport');
    html += passCard('Загранпаспорт', 'foreign');

    if (artist) {
      html += '<div class="p-card">';
      html += '<div class="sec">Карточка артиста</div>';
      html += '<div class="p-params">' +
        '<div class="p-param"><span class="p-param__k">Вес</span>' + val('artist.weight') + '</div>' +
        '<div class="p-param"><span class="p-param__k">Рост</span>' + val('artist.height') + '</div>' +
        '<div class="p-param"><span class="p-param__k">Обувь</span>' + val('artist.shoe') + '</div>' +
        '</div>';
      html += '<div class="p-skills" id="skillBox">' +
        (E.artist.skills.length ? E.artist.skills.map(function (s) {
          return '<span class="chip">' + fmt(s) + '<button type="button" class="chip__x" data-skill-remove="' + fmt(s) + '">×</button></span>';
        }).join('') : '<span class="p-empty">—</span>') +
        '</div>';
      html += row('Знание шоу', 'artist.show');
      html += row('Комментарий', 'artist.comment');
      html += '</div>';
    }

    html += '</div></div>';

    html += '<div class="p-foot">';
    html += '<div class="p-docs"><span class="sec">Документы</span><div class="p-docs__list" id="docList">' +
      E.docs.map(docRow).join('') + '</div>' +
      '<button type="button" class="p-add" id="docAdd">' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Загрузить</button>' +
      '</div>';
    html += '<div class="p-foot__meta"><span class="sec">Создан</span>' + fmt(E.created) + ' · ' + fmt(E.createdBy) + '</div>';
    html += '</div>';

    document.getElementById('view').innerHTML = html;
    bind();
  }

  function bind() {
    var card = document.getElementById('view');

    card.addEventListener('click', function (e) {
      if (e.target.closest('input, textarea')) return;
      if (e.target.closest('.chip__x')) return;
      if (e.target.closest('.chip')) return;
      if (e.target.closest('[data-close]')) {
        window.toast('Закрыть карточку');
        return;
      }
      if (e.target.closest('#activeBtn')) {
        E.active = !E.active;
        render();
        window.toast(E.active ? 'Сотрудник активен' : 'Сотрудник отключён');
        return;
      }
      if (e.target.closest('#docAdd')) {
        addDoc();
        return;
      }
      var rm = e.target.closest('[data-doc-remove]');
      if (rm) {
        E.docs.splice(Number(rm.getAttribute('data-doc-remove')), 1);
        render();
        window.toast('Документ удалён');
        return;
      }
      var srm = e.target.closest('[data-skill-remove]');
      if (srm) {
        var name = srm.getAttribute('data-skill-remove');
        E.artist.skills = E.artist.skills.filter(function (s) { return s !== name; });
        render();
        window.toast('Навык удалён');
        return;
      }
      if (e.target.closest('#skillBox')) {
        if (e.target.closest('.p-input')) return;
        startSkillEdit();
        return;
      }
      var target = e.target.closest('.m-editable');
      if (target) {
        startEdit(target);
      }
    });
  }

  function startSkillEdit() {
    var box = document.getElementById('skillBox');
    if (!box || box.querySelector('.p-input')) return;
    var input = document.createElement('input');
    input.className = 'p-input p-input--chip';
    input.placeholder = 'навык';
    box.appendChild(input);
    input.focus();
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var v = input.value.trim();
      if (save && v) E.artist.skills.push(v);
      render();
      if (save && v) window.toast('Сохранено: ' + v);
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      }
    });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        if (input.value.trim()) finish(true);
        else finish(false);
      }, 60);
    });
  }

  function addDoc() {
    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      files.forEach(function (f) {
        E.docs.push({
          type: 'Прочее',
          caption: '',
          file: f.name,
          size: (f.size / 1048576).toFixed(1).replace('.', ',') + ' МБ'
        });
      });
      render();
      window.toast(files.length === 1 ? 'Документ загружен' : 'Загружено: ' + files.length);
    });
    input.click();
  }

  function startEdit(target) {
    if (target.querySelector('input, textarea')) return;
    var path = target.getAttribute('data-edit');
    var raw = String(get(path) || '');
    var wide = WIDE_KEYS[path] || raw.length > 34;
    var mask = MASKS[path] || MASKS[path.replace(/^.*\./, '')];
    if (path === 'phone') mask = MASKS.phone;
    if (/^foreign\./.test(path)) mask = MASKS['foreign' + path.split('.')[1].charAt(0).toUpperCase() + path.split('.')[1].slice(1)];
    if (/^passport\./.test(path)) mask = MASKS['passport' + path.split('.')[1].charAt(0).toUpperCase() + path.split('.')[1].slice(1)];

    var input = document.createElement(wide ? 'textarea' : 'input');
    input.className = 'p-input' + (wide ? ' p-input--area' : '');
    input.value = raw;
    if (wide) input.rows = 2;
    var holder = document.createElement('span');
    holder.className = 'p-editbox' + (wide ? ' p-editbox--wide' : '');
    holder.appendChild(input);
    target.innerHTML = '';
    target.appendChild(holder);
    target.classList.add('is-editing');
    input.focus();
    var start = input.value.length;
    input.setSelectionRange(start, start);
    if (wide) window.autoGrow(input);

    var done = false;

    function finish(save) {
      if (done) return;
      done = true;
      if (save) {
        var value = mask ? mask(input.value) : input.value;
        value = value.trim();
        var before = String(get(path));
        set(path, value);
        render();
        if (before !== value) window.toast('Сохранено: ' + (value || 'пусто'));
      } else {
        render();
      }
    }

    input.addEventListener('input', function () {
      if (wide) window.autoGrow(input);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
        return;
      }
      if (e.key !== 'Enter') return;
      if (wide && !e.ctrlKey) return;
      e.preventDefault();
      finish(true);
    });

    input.addEventListener('blur', function () {
      setTimeout(function () { finish(true); }, 60);
    });
  }

  window.renderView = render;
  render();
})();
