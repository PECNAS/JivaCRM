(function () {
  var O = window.CURRENT_ORDER;
  var esc = window.oEsc;
  var meta = window.ORDER_META;
  var status = O.status;

  function build() {
    var chips = window.techChips();
    var html = '';

    html += '<div class="a-head a-head--' + status + '">' +
      '<div class="a-head__main">' +
      '<div class="a-head__date">' + esc(O.date) + ' · ' + esc(O.city) + '</div>' +
      '<div class="a-head__name">' + esc(O.name) + '</div>' +
      '</div>' +
      '<div class="a-head__side">' +
      '<span class="a-status a-status--' + status + '">' + esc(meta.statusLabels[status]) + '</span>' +
      '<button type="button" class="icon-btn a-x" data-close>' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div></div>';

    html += '<div class="a-body">';

    html += '<div class="a-meta">' +
      '<a class="link" href="#" data-toast="Открыть клиента">' + esc(O.client) + '</a>' +
      '<span class="a-dot"></span>' +
      '<span class="muted">' + esc(O.clientType) + '</span>' +
      '<span class="a-dot"></span>' +
      '<a class="link" href="https://t.me/c/130000/sm3" target="_blank" rel="noopener">Чат ' + esc(O.chat) + '</a>' +
      '</div>';

    html += '<div class="a-times">' +
      '<span><i>*</i>Начало <b>' + esc(O.startTime) + '</b></span>' +
      '<span>Чек <b>' + esc(O.setupTime) + '</b></span>' +
      '<span>Менеджер <b>' + esc(O.managers.join(', ')) + '</b></span>' +
      '</div>';

    html += '<div class="a-addr"><span class="sec">Адрес</span>' + esc(O.address) + '</div>';

    html += '<div class="a-contact">' +
      '<span class="sec">Контакт</span>' +
      '<b>' + esc(O.contact.name) + '</b>' +
      '<a class="link" href="https://t.me/' + esc(O.contact.telegram) + '" target="_blank" rel="noopener">@' + esc(O.contact.telegram) + '</a>' +
      '<a class="a-phone" href="tel:' + O.contact.phone.replace(/\D/g, '') + '">' + esc(O.contact.phone) + '</a>' +
      '</div>';

    html += '<div class="a-section"><span class="sec">Шоу</span><span class="dim">' + O.shows.length + '</span></div>';
    html += '<div class="a-shows">' + O.shows.map(function (s) {
      return '<div class="a-show">' +
        '<span class="a-show__time">' + esc(s.time) + '</span>' +
        '<span class="a-show__body">' +
        '<span class="a-show__name">' + esc(s.name) + '</span>' +
        '<span class="a-artists">' + s.artists.map(function (a) {
          var cls = 'artist';
          if (a.responsible) cls += ' is-answer';
          if (a.story) cls += ' is-story';
          return '<span class="' + cls + '">' + esc(a.name + (a.comment ? ' (' + a.comment + ')' : '')) + '</span>';
        }).join('') + '</span></span></div>';
    }).join('') + '</div>';

    html += '<div class="a-section"><span class="sec">Детали</span></div>';
    if (chips.length || O.tech.comment) {
      html += '<div class="ev-box a-tech"><b>Техничка:</b> ' +
        chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
        (O.tech.comment ? '<span class="dim">' + esc(O.tech.comment) + '</span>' : '') +
        '</div>';
    }
    O.boxes.forEach(function (b) {
      html += '<div class="ev-box"><b>' + esc(b[0]) + ':</b> ' + esc(b[1]) + '</div>';
    });

    html += '</div>';

    html += '<div class="a-money">' +
      '<div class="a-money__cost"><span class="sec">Стоимость</span><b>' + esc(O.cost) + '</b></div>' +
      '<div class="a-money__pay"><span class="sec">Оплата</span>' + esc(O.payment) + '<span class="dim"> · ' + esc(O.paymentComment) + '</span></div>' +
      '</div>';

    html += '<div class="ev-foot">' +
      '<button type="button" class="btn btn-outline" data-toast="Ссылка скопирована">Ссылка</button>' +
      '<button type="button" class="btn btn-outline" data-toast="Чек-лист">Чек-лист</button>' +
      '<button type="button" class="btn btn-primary" data-toast="Подробнее">Подробнее</button>' +
      '</div>';

    document.getElementById('view').innerHTML = html;
  }

  build();
})();
