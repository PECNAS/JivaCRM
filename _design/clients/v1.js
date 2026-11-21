(function () {
  'use strict';

  function renderClient(client, helpers) {
    var esc = helpers.esc;
    var toast = helpers.toast;
    var card = document.createElement('div');

    card.className = 'card';
    card.innerHTML = ''
      + '<header class="card__head">'
      + '  <div>'
      + '    <div class="card__title">' + esc(client.name) + '</div>'
      + '    <div class="card__sub">' + esc([client.type, client.agency, client.cities.join(' · ')].filter(Boolean).join(' · ')) + '</div>'
      + '  </div>'
      + '  <div class="card__tools">'
      + '    <button type="button" class="btn btn-primary" data-act="order">Создать заказ</button>'
      + '    <button type="button" class="btn" data-act="edit">Изменить</button>'
      + '    <button type="button" class="btn" data-act="duplicate">Проверить дубли</button>'
      + '  </div>'
      + '</header>'
      + '<div class="card__body">'
      + '  <div class="v1-grid">'
      + '    <div>'
      + '      <div class="v1-label">Контакты</div>'
      + '      <div class="v1-rows">'
      + '        <div class="v1-row"><span>Телефон</span><b>' + esc(client.phone || '—') + '</b></div>'
      + '        <div class="v1-row"><span>Телеграм</span><b>' + esc(client.telegram || '—') + '</b></div>'
      + '        <div class="v1-row"><span>Инстаграм</span><b>' + esc(client.instagram || '—') + '</b></div>'
      + '        <div class="v1-row"><span>Email</span><b>' + esc(client.email || '—') + '</b></div>'
      + '      </div>'
      + '      <div class="v1-label">Реквизиты</div>'
      + '      <div class="v1-rows">'
      + '        <div class="v1-row"><span>Тип клиента</span><b>' + esc(client.type) + '</b></div>'
      + '        <div class="v1-row"><span>Агентство</span><b>' + esc(client.agency || '—') + '</b></div>'
      + '        <div class="v1-row"><span>Города</span><b>' + esc(client.cities.join(', ') || '—') + '</b></div>'
      + '      </div>'
      + '    </div>'
      + '    <div>'
      + '      <div class="v1-stats">'
      + '        <div class="v1-stat"><span>Рейтинг</span><b class="badge badge--' + client.rating + '">' + esc(client.ratingLabel) + '</b></div>'
      + '        <div class="v1-stat"><span>Запросов</span><b>' + client.requests + '</b></div>'
      + '        <div class="v1-stat"><span>Заказов</span><b>' + client.orders + '</b></div>'
      + '        <div class="v1-stat"><span>Оборот</span><b class="v1-money">' + esc(client.sum) + '</b></div>'
      + '      </div>'
      + '      <div class="v1-label">Комментарий</div>'
      + '      <div class="v1-comment">' + esc(client.comment || '—') + '</div>'
      + '      <div class="v1-label">История заказов</div>'
      + '      <div class="v1-history">'
      + client.history.map(function (item) {
        return '<div class="v1-hrow"><span class="v1-date">' + esc(item.date) + '</span>'
          + '<span class="v1-name">' + esc(item.name) + '</span>'
          + '<span class="badge badge--' + item.key + '">' + esc(item.status) + '</span>'
          + '<span class="v1-cost">' + esc(item.cost) + '</span></div>';
      }).join('')
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    card.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');

      if (!act) return;

      var map = { order: 'Создать заказ', edit: 'Изменить клиента', duplicate: 'Проверка дублей' };

      toast(map[act.dataset.act] + ' · ' + client.name);
    });

    return card;
  }

  window.CLIENT_VIEW = { renderClient: renderClient };
})();
