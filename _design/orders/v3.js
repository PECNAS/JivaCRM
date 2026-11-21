(function () {
  var O = window.CURRENT_ORDER;
  var esc = window.oEsc;
  var meta = window.ORDER_META;
  var status = O.status;

  function build() {
    var chips = window.techChips();
    var html = '';

    html += '<div class="s-head">' +
      '<div class="s-head__row">' +
      '<div>' +
      '<div class="s-head__date">' + esc(O.date) + ' · ' + esc(O.city) + '</div>' +
      '<div class="s-head__name">' + esc(O.name) + '</div>' +
      '</div>' +
      '<div class="s-head__side">' +
      '<span class="chip chip--status-' + status + '">' + esc(meta.statusLabels[status]) + '</span>' +
      '<button type="button" class="icon-btn s-x" data-close title="Закрыть">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div></div>' +

      '<div class="s-rows">' +
      '<div class="s-row"><span class="s-k">Клиент</span><span class="s-v"><a class="link" href="#" data-toast="Открыть клиента">' + esc(O.client) + '</a> <span class="dim">· ' + esc(O.clientType) + '</span></span></div>' +
      '<div class="s-row"><span class="s-k">Время</span><span class="s-v"><b>' + esc(O.startTime) + '</b> начало · чек <b>' + esc(O.setupTime) + '</b></span></div>' +
      '<div class="s-row"><span class="s-k">Адрес</span><span class="s-v">' + esc(O.address) + '</span></div>' +
      '<div class="s-row"><span class="s-k">Контакт</span><span class="s-v"><b>' + esc(O.contact.name) + '</b> <a class="link" href="https://t.me/' + esc(O.contact.telegram) + '" target="_blank" rel="noopener">@' + esc(O.contact.telegram) + '</a> <a class="s-tel" href="tel:' + O.contact.phone.replace(/\D/g, '') + '">' + esc(O.contact.phone) + '</a></span></div>' +
      '<div class="s-row"><span class="s-k">Чат</span><span class="s-v"><a class="link" href="https://t.me/c/130000/sm3" target="_blank" rel="noopener">' + esc(O.chat) + '</a></span></div>' +
      '<div class="s-row"><span class="s-k">Менеджер</span><span class="s-v">' + esc(O.managers.join(', ')) + '<span class="dim"> · стори ' + esc(O.storyManager) + '</span></span></div>' +
      '</div>' +

      '<div class="s-tech">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
      '<span class="s-tech__c">' + esc(O.tech.comment) + '</span></div>' +

      '<div class="s-payrow">' +
      '<span class="s-cost">' + esc(O.cost) + '</span>' +
      '<span class="s-pay">' + esc(O.payment) + '<span class="dim"> · ' + esc(O.paymentComment) + '</span></span>' +
      '</div>' +
      '</div>';

    html += '<div class="s-time">' +
      '<span class="s-time__t">' + esc(O.shows[0].time) + '</span>' +
      '<span class="s-time__l"></span>' +
      '<span class="s-time__t">' + esc(O.shows[1].time) + '</span>' +
      '<span class="s-time__l"></span>' +
      '<span class="s-time__t">' + esc(O.shows[2].time) + '</span>' +
      '</div>';

    html += '<div class="s-shows">' + O.shows.map(function (s, i) {
      return '<div class="s-show">' +
        '<div class="s-show__head">' +
        '<span class="s-show__t">' + esc(s.time) + '</span>' +
        '<span class="s-show__n">' + esc(s.name) + '</span>' +
        '<span class="s-show__c">' + s.artists.length + '</span>' +
        '</div>' +
        '<div class="s-show__a">' + s.artists.map(function (a) {
          var cls = 'artist' + (a.responsible ? ' is-answer' : '') + (a.story ? ' is-story' : '');
          return '<span class="' + cls + '">' + esc(a.name + (a.comment ? ' (' + a.comment + ')' : '')) + '</span>';
        }).join('') + '</div>' +
        '</div>';
    }).join('') + '</div>';

    html += '<div class="s-boxes">' + O.boxes.map(function (b) {
      return '<div class="s-box"><span class="s-box__k">' + esc(b[0]) + '</span><span class="s-box__v">' + esc(b[1]) + '</span></div>';
    }).join('') + '</div>';

    html += '<div class="ev-foot">' +
      '<button type="button" class="btn btn-outline" data-toast="Ссылка скопирована">Ссылка</button>' +
      '<button type="button" class="btn btn-outline" data-toast="Чек-лист">Чек-лист</button>' +
      '<button type="button" class="btn btn-primary" data-toast="Подробнее">Подробнее</button>' +
      '</div>';

    document.getElementById('view').innerHTML = html;
  }

  build();
})();
