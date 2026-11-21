(function () {
  var E = window.EMP;
  var M = window.EMP_META;
  var fmt = window.fmt;
  var BLOCKS = [
    ['account', 'Учётная запись', 'Логин, пароль, активен'],
    ['main', 'Основное', 'ФИО, обращение, роли, контакты, РЖД'],
    ['foreign', 'Загранпаспорт', 'Серия, номер, кем выдан'],
    ['passport', 'Паспортные данные', 'Серия, номер, кем выдан, код'],
    ['artist', 'Карточка артиста', 'Вес, рост, обувь, навыки, шоу'],
    ['docs', 'Документы', 'Фото документов · ' + E.docs.length]
  ];

  function sub(key, value) {
    var v = value || '<span class="p-empty">—</span>';
    return '<div class="s-sub"><span class="s-sub__k">' + fmt(key) + '</span><span class="s-sub__v">' + v + '</span></div>';
  }

  function body(id) {
    var artist = E.roles.indexOf('artist') !== -1;
    if (id === 'account') {
      return sub('Логин', fmt(E.login)) + sub('Пароль', fmt(E.password)) +
        sub('Активен', '<span class="chip ' + (E.active ? 'chip--ok' : 'chip--off') + '">' + (E.active ? 'Да' : 'Нет') + '</span>');
    }
    if (id === 'main') {
      return sub('ФИО', fmt(E.name)) + sub('Обращение', fmt(E.nickname)) +
        sub('Роли', window.roleChips(E.roles)) +
        sub('Телефон', '<a class="link" href="tel:' + E.phone.replace(/\D/g, '') + '">' + fmt(E.phone) + '</a>') +
        sub('Телеграм', '<a class="link" href="https://t.me/' + E.telegram.replace('@', '') + '" target="_blank" rel="noopener">' + fmt(E.telegram) + '</a>') +
        sub('Инстаграм', '<a class="link" href="https://instagram.com/' + E.instagram.replace('@', '') + '" target="_blank" rel="noopener">' + fmt(E.instagram) + '</a>') +
        sub('РЖД бонус', fmt(E.rzd));
    }
    if (id === 'foreign') {
      return sub('Серия', fmt(E.foreign.series)) + sub('Номер', fmt(E.foreign.number)) +
        sub('Кем выдан', fmt(E.foreign.issuedBy)) + sub('Дата выдачи', fmt(E.foreign.issuedAt)) +
        sub('Код', fmt(E.foreign.code));
    }
    if (id === 'passport') {
      return sub('Серия', fmt(E.passport.series)) + sub('Номер', fmt(E.passport.number)) +
        sub('Кем выдан', fmt(E.passport.issuedBy)) + sub('Дата выдачи', fmt(E.passport.issuedAt)) +
        sub('Код', fmt(E.passport.code)) + sub('Адрес регистрации', fmt(E.address)) +
        sub('ИНН', fmt(E.inn)) + sub('СНИЛС', fmt(E.snils));
    }
    if (id === 'artist') {
      if (!artist) return '<div class="s-none">Карточка не заполнена</div>';
      return sub('Вес', fmt(E.artist.weight)) + sub('Рост', fmt(E.artist.height)) + sub('Обувь', fmt(E.artist.shoe)) +
        sub('Навыки', E.artist.skills.map(function (s) { return '<span class="chip">' + fmt(s) + '</span>'; }).join('')) +
        sub('Знание шоу', fmt(E.artist.show)) + sub('Комментарий', fmt(E.artist.comment));
    }
    return E.docs.map(function (d) {
      return '<div class="s-doc"><span class="s-doc__type">' + fmt(d.type) + '</span>' +
        '<span class="s-doc__cap">' + fmt(d.caption || '—') + '</span>' +
        '<span class="s-doc__file">' + fmt(d.file) + '</span></div>';
    }).join('');
  }

  function render() {
    var html = '<div class="s-head">' +
      '<div class="s-head__name">' + fmt(E.name) + '</div>' +
      '<div class="s-head__roles">' + window.roleChips(E.roles) + '</div>' +
      '</div><div class="s-list">';

    BLOCKS.forEach(function (b, i) {
      var open = i < 3;
      html += '<section class="s-block' + (open ? ' is-open' : '') + '" data-block="' + b[0] + '">' +
        '<button type="button" class="s-block__head">' +
        '<svg class="s-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' +
        '<span class="s-block__title">' + fmt(b[1]) + '</span>' +
        '<span class="s-block__hint">' + fmt(b[2]) + '</span>' +
        '</button>' +
        '<div class="s-block__body">' + body(b[0]) + '</div>' +
        '</section>';
    });

    html += '</div><div class="s-foot"><span class="dim">Создан ' + fmt(E.created) + ' · ' + fmt(E.createdBy) + '</span></div>';

    var view = document.getElementById('view');
    view.innerHTML = html;

    view.addEventListener('click', function (e) {
      var head = e.target.closest('.s-block__head');
      if (!head) return;
      head.parentNode.classList.toggle('is-open');
    });
  }

  render();
})();
