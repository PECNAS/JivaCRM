(function () {
  var O = window.CURRENT_ORDER;
  var esc = window.oEsc;
  var meta = window.ORDER_META;
  var status = O.status;

  function build() {
    var chips = window.techChips();
    var html = '';

    html += '<div class="h-bar h-bar--' + status + '">' +
      '<span class="h-bar__s">' + esc(meta.statusLabels[status]) + '</span>' +
      '<span class="h-bar__d">' + esc(O.date) + '</span>' +
      '<span class="h-bar__c">' + esc(O.city) + '</span>' +
      '<button type="button" class="icon-btn h-x" data-close title="Закрыть">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>';

    html += '<div class="h-body">';
    html += '<h2 class="h-name">' + esc(O.name) + '</h2>';
    html += '<div class="h-sub">' +
      '<a class="link" href="#" data-toast="Открыть клиента">' + esc(O.client) + '</a>' +
      '<span class="dim">' + esc(O.clientType) + '</span>' +
      '</div>';

    html += '<div class="h-tags">' +
      '<span class="h-tag">Начало <b>' + esc(O.startTime) + '</b></span>' +
      '<span class="h-tag">Чек <b>' + esc(O.setupTime) + '</b></span>' +
      '<span class="h-tag h-tag--money">' + esc(O.cost) + '</span>' +
      '<a class="h-tag h-tag--link" href="https://t.me/c/130000/sm3" target="_blank" rel="noopener">Чат ' + esc(O.chat) + '</a>' +
      '</div>';

    html += '<div class="h-cur">' +
      '<span class="h-cur__k">Контакт</span>' +
      '<span class="h-cur__v"><b>' + esc(O.contact.name) + '</b> · <a class="link" href="https://t.me/' + esc(O.contact.telegram) + '" target="_blank" rel="noopener">@' + esc(O.contact.telegram) + '</a> · <a class="h-tel" href="tel:' + O.contact.phone.replace(/\D/g, '') + '">' + esc(O.contact.phone) + '</a></span>' +
      '</div>';
    html += '<div class="h-cur">' +
      '<span class="h-cur__k">Адрес</span>' +
      '<span class="h-cur__v">' + esc(O.address) + '</span>' +
      '</div>';

    html += '<div class="h-sec"><span class="sec">Шоу</span></div>';
    html += O.shows.map(function (s) {
      return '<div class="h-show">' +
        '<div class="h-show__t">' + esc(s.time) + '</div>' +
        '<div class="h-show__card">' +
        '<div class="h-show__n">' + esc(s.name) + '</div>' +
        '<div class="h-show__a">' + s.artists.map(function (a) {
          var cls = 'artist' + (a.responsible ? ' is-answer' : '') + (a.story ? ' is-story' : '');
          return '<span class="' + cls + '">' + esc(a.name + (a.comment ? ' (' + a.comment + ')' : '')) + '</span>';
        }).join('') + '</div>' +
        '</div></div>';
    }).join('');

    html += '<div class="h-sec"><span class="sec">Детали</span></div>';
    if (chips.length || O.tech.comment) {
      html += '<div class="h-tech">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
        (O.tech.comment ? '<span class="dim">' + esc(O.tech.comment) + '</span>' : '') + '</div>';
    }
    O.boxes.forEach(function (b) {
      html += '<div class="ev-box h-box"><b>' + esc(b[0]) + '</b><span>' + esc(b[1]) + '</span></div>';
    });

    html += '<div class="h-pay">' +
      '<span>Менеджер <b>' + esc(O.managers.join(', ')) + '</b></span>' +
      '<span>Оплата <b>' + esc(O.payment) + '</b></span>' +
      '</div>';

    html += '</div>';

    html += '<div class="h-foot">' +
      '<button type="button" class="btn btn-outline" data-toast="Ссылка скопирована">Ссылка</button>' +
      '<button type="button" class="btn btn-outline" data-toast="Чек-лист">Чек-лист</button>' +
      '<button type="button" class="btn btn-primary" data-toast="Подробнее">Подробнее</button>' +
      '</div>';

    document.getElementById('view').innerHTML = html;
  }

  build();
})();
