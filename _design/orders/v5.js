(function () {
  var O = window.CURRENT_ORDER;
  var esc = window.oEsc;
  var meta = window.ORDER_META;
  var status = O.status;

  function build() {
    var html = '';
    var total = O.shows.reduce(function (n, s) { return n + s.artists.length; }, 0);

    html += '<div class="w-head">' +
      '<div class="w-head__main">' +
      '<div class="w-head__date">' + esc(O.date) + ' · ' + esc(O.city) + '</div>' +
      '<div class="w-head__name">' + esc(O.name) + '</div>' +
      '</div>' +
      '<div class="w-head__side">' +
      '<span class="chip chip--status-' + status + '">' + esc(meta.statusLabels[status]) + '</span>' +
      '<button type="button" class="icon-btn w-x" data-close title="Закрыть">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>' +
      '</div>';

    html += '<div class="w-body">';

    html += '<div class="w-key">' +
      '<div class="w-key__row">' +
      '<span class="w-key__label">Контакт</span>' +
      '<span class="w-key__val"><b>' + esc(O.contact.name) + '</b> <a class="link" href="https://t.me/' + esc(O.contact.telegram) + '" target="_blank" rel="noopener">@' + esc(O.contact.telegram) + '</a> <a class="w-tel" href="tel:' + O.contact.phone.replace(/\D/g, '') + '">' + esc(O.contact.phone) + '</a></span>' +
      '</div>' +
      '<div class="w-key__row">' +
      '<span class="w-key__label">Адрес</span>' +
      '<span class="w-key__val">' + esc(O.address) + '</span>' +
      '</div>' +
      '<div class="w-key__row">' +
      '<span class="w-key__label">Время</span>' +
      '<span class="w-key__val">начало <b>' + esc(O.startTime) + '</b> · чек <b>' + esc(O.setupTime) + '</b></span>' +
      '</div>' +
      '<div class="w-key__row">' +
      '<span class="w-key__label">Клиент</span>' +
      '<span class="w-key__val"><a class="link" href="#" data-toast="Открыть клиента">' + esc(O.client) + '</a> <span class="dim">· ' + esc(O.clientType) + '</span></span>' +
      '</div>' +
      '<div class="w-key__row">' +
      '<span class="w-key__label">Оплата</span>' +
      '<span class="w-key__val"><b>' + esc(O.payment) + '</b> <span class="dim">· ' + esc(O.paymentComment) + '</span></span>' +
      '</div>' +
      '</div>';

    html += '<div class="w-num">' +
      '<div class="w-num__cell"><span class="w-num__v">' + esc(O.startTime) + '</span><span class="w-num__k">начало</span></div>' +
      '<div class="w-num__cell"><span class="w-num__v">' + O.shows.length + '</span><span class="w-num__k">шоу</span></div>' +
      '<div class="w-num__cell"><span class="w-num__v">' + total + '</span><span class="w-num__k">артистов</span></div>' +
      '<div class="w-num__cell w-num__cell--money"><span class="w-num__v">' + esc(O.cost) + '</span><span class="w-num__k">стоимость</span></div>' +
      '</div>';

    html += '<table class="w-tbl">' +
      '<thead><tr><th>Время</th><th>Шоу</th><th>Артисты</th></tr></thead><tbody>' +
      O.shows.map(function (s) {
        return '<tr>' +
          '<td class="w-tbl__t">' + esc(s.time) + '</td>' +
          '<td>' + esc(s.name) + '</td>' +
          '<td class="w-tbl__a">' + s.artists.map(function (a) {
            var cls = 'artist' + (a.responsible ? ' is-answer' : '') + (a.story ? ' is-story' : '');
            return '<span class="' + cls + '">' + esc(a.name + (a.comment ? ' (' + a.comment + ')' : '')) + '</span>';
          }).join('') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';

    html += '<div class="w-dl">' + O.boxes.map(function (b) {
      return '<div class="w-dl__row"><span class="w-dl__k">' + esc(b[0]) + '</span><span class="w-dl__v">' + esc(b[1]) + '</span></div>';
    }).join('') + '</div>';

    html += '</div>';

    html += '<div class="ev-foot">' +
      '<span class="w-founder">Менеджер <b>' + esc(O.managers.join(', ')) + '</b></span>' +
      '<button type="button" class="btn btn-outline" data-toast="Чек-лист">Чек-лист</button>' +
      '<button type="button" class="btn btn-primary" data-toast="Подробнее">Подробнее</button>' +
      '</div>';

    document.getElementById('view').innerHTML = html;
  }

  build();
})();
