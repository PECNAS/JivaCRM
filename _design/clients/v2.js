(function () {
  'use strict';

  function renderClient(client, helpers) {
    var esc = helpers.esc;
    var toast = helpers.toast;
    var card = document.createElement('div');
    var initials = client.name.split(' ').slice(0, 2).map(function (word) { return word.charAt(0); }).join('');

    card.className = 'card';
    card.innerHTML = ''
      + '<div class="v2-top">'
      + '  <div class="v2-avatar">' + esc(initials) + '</div>'
      + '  <div class="v2-id">'
      + '    <div class="card__title">' + esc(client.name) + '</div>'
      + '    <div class="v2-chips">'
      + '      <span class="badge badge--' + client.rating + '">Рейтинг: ' + esc(client.ratingLabel) + '</span>'
      + '      <span class="badge">' + esc(client.type) + '</span>'
      + (client.active ? '<span class="badge badge--ok">Активен</span>' : '<span class="badge badge--muted">Неактивен</span>')
      + '      <span class="badge badge--accent">' + esc(client.contact) + '</span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="v2-actions">'
      + '    <button type="button" class="btn btn-primary" data-act="order">Создать заказ</button>'
      + '    <button type="button" class="btn" data-act="edit">Изменить</button>'
      + '  </div>'
      + '</div>'
      + '<div class="v2-stats">'
      + '  <div class="v2-stat"><span>Заказов</span><b>' + client.orders + '</b></div>'
      + '  <div class="v2-stat"><span>Запросов</span><b>' + client.requests + '</b></div>'
      + '  <div class="v2-stat"><span>Оборот</span><b class="v2-money">' + esc(client.sum) + '</b></div>'
      + '  <div class="v2-stat"><span>Последний заказ</span><b>' + esc(client.lastOrder) + '</b></div>'
      + '</div>'
      + '<div class="v2-cols">'
      + '  <div class="v2-block">'
      + '    <div class="v2-block__title">Контакты</div>'
      + '    <div class="v2-contact"><span>Телефон</span><a class="link" href="tel:">' + esc(client.phone || '—') + '</a></div>'
      + '    <div class="v2-contact"><span>Телеграм</span><a class="link" href="#">' + esc(client.telegram || '—') + '</a></div>'
      + '    <div class="v2-contact"><span>Инстаграм</span>' + (client.instagram ? '<a class="link" href="#">' + esc(client.instagram) + '</a>' : '<span class="dim">—</span>') + '</div>'
      + '    <div class="v2-contact"><span>Email</span>' + (client.email ? '<a class="link" href="#">' + esc(client.email) + '</a>' : '<span class="dim">—</span>') + '</div>'
      + '  </div>'
      + '  <div class="v2-block">'
      + '    <div class="v2-block__title">Организация</div>'
      + '    <div class="v2-contact"><span>Агентство</span>' + (client.agency ? '<b>' + esc(client.agency) + '</b>' : '<span class="dim">—</span>') + '</div>'
      + '    <div class="v2-contact"><span>Города</span><b>' + esc(client.cities.join(', ')) + '</b></div>'
      + '  </div>'
      + '</div>'
      + (client.comment ? '<div class="v2-note"><span>Комментарий</span><p>' + esc(client.comment) + '</p></div>' : '')
      + '<div class="v2-foot">'
      + '  <span>Создан ' + esc(client.created) + ' · ' + esc(client.createdBy) + '</span>'
      + '  <button type="button" class="btn btn-sm" data-act="history">История заказов (' + client.orders + ')</button>'
      + '</div>';

    card.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');

      if (!act) return;

      var map = { order: 'Создать заказ', edit: 'Изменить клиента', history: 'История заказов' };

      toast(map[act.dataset.act] + ' · ' + client.name);
    });

    return card;
  }

  window.CLIENT_VIEW = { renderClient: renderClient };
})();
