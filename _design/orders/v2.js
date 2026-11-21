(function () {
  var O = window.CURRENT_ORDER;
  var esc = window.oEsc;
  var meta = window.ORDER_META;
  var status = O.status;

  function build() {
    var chips = window.techChips();
    var html = '';

    html += '<div class="c-top c-top--' + status + '">' +
      '<div class="c-top__left">' +
      '<span class="c-date">' + esc(O.date) + '</span>' +
      '<span class="c-dot"></span>' +
      '<span class="c-city">' + esc(O.city) + '</span>' +
      '<span class="chip chip--status-' + status + '">' + esc(meta.statusLabels[status]) + '</span>' +
      '</div>' +
      '<button type="button" class="icon-btn" data-close title="Закрыть">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>';

    html += '<div class="c-body">';

    html += '<h2 class="c-name">' + esc(O.name) + '</h2>';
    html += '<div class="c-sub">' +
      '<a class="link" href="#" data-toast="Открыть клиента">' + esc(O.client) + '</a>' +
      '<span class="c-dot"></span>' +
      '<span class="muted">' + esc(O.clientType) + '</span>' +
      '</div>';

    html += '<div class="c-strip">' +
      '<div class="c-cell"><span class="c-k">Начало</span><span class="c-v">' + esc(O.startTime) + '</span></div>' +
      '<div class="c-cell"><span class="c-k">Чек</span><span class="c-v">' + esc(O.setupTime) + '</span></div>' +
      '<div class="c-cell"><span class="c-k">Стоимость</span><span class="c-v c-v--money">' + esc(O.cost) + '</span></div>' +
      '<div class="c-cell"><span class="c-k">Чат</span><span class="c-v"><a class="link" href="https://t.me/c/130000/sm3" target="_blank" rel="noopener">' + esc(O.chat) + '</a></span></div>' +
      '</div>';

    html += '<div class="c-line"><span class="c-k">Адрес</span>' + esc(O.address) + '</div>';
    html += '<div class="c-line"><span class="c-k">Контакт</span>' +
      '<b>' + esc(O.contact.name) + '</b> ' +
      '<a class="link" href="https://t.me/' + esc(O.contact.telegram) + '" target="_blank" rel="noopener">@' + esc(O.contact.telegram) + '</a> ' +
      '<a class="c-tel" href="tel:' + O.contact.phone.replace(/\D/g, '') + '">' + esc(O.contact.phone) + '</a>' +
      '</div>';
    html += '<div class="c-line"><span class="c-k">Менеджер</span>' + esc(O.managers.join(', ')) + '<span class="dim"> · стори ' + esc(O.storyManager) + '</span></div>';

    html += '<div class="c-sec"><span class="sec">Шоу</span><span class="dim">' + O.shows.length + ' · ' +
      O.shows.reduce(function (n, s) { return n + s.artists.length; }, 0) + ' арт.</span></div>';
    html += '<div class="c-shows">' + O.shows.map(function (s) {
      return '<div class="c-show">' +
        '<span class="c-show__t">' + esc(s.time) + '</span>' +
        '<span class="c-show__n">' + esc(s.name) + '</span>' +
        '<span class="c-show__a">' + s.artists.map(function (a) {
          var cls = 'artist' + (a.responsible ? ' is-answer' : '') + (a.story ? ' is-story' : '');
          return '<span class="' + cls + '">' + esc(a.name + (a.comment ? ' (' + a.comment + ')' : '')) + '</span>';
        }).join('') + '</span></div>';
    }).join('') + '</div>';

    html += '<div class="c-sec"><span class="sec">Детали</span></div>';
    if (chips.length || O.tech.comment) {
      html += '<div class="c-tech"><b>Техничка</b>' +
        chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
        (O.tech.comment ? '<span class="dim">' + esc(O.tech.comment) + '</span>' : '') + '</div>';
    }
    html += '<div class="c-grid">' + O.boxes.map(function (b) {
      return '<div class="c-box"><span class="c-box__k">' + esc(b[0]) + '</span><span class="c-box__v">' + esc(b[1]) + '</span></div>';
    }).join('') + '</div>';

    html += '<div class="c-pay">Оплата: <b>' + esc(O.payment) + '</b><span class="dim"> · ' + esc(O.paymentComment) + '</span></div>';

    html += '</div>';

    html += '<div class="ev-foot">' +
      '<button type="button" class="btn btn-outline" data-toast="Ссылка скопирована">Ссылка</button>' +
      '<button type="button" class="btn btn-outline" data-toast="Чек-лист">Чек-лист</button>' +
      '<button type="button" class="btn btn-primary" data-toast="Подробнее">Подробнее</button>' +
      '</div>';

    document.getElementById('view').innerHTML = html;
  }

  build();
})();
