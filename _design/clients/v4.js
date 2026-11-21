(function () {
  'use strict';

  function metric(label, value, extra) {
    return '<div class="v4-metric"><span>' + label + '</span><b class="' + (extra || '') + '">' + value + '</b></div>';
  }

  function renderClient(client, helpers) {
    var esc = helpers.esc;
    var toast = helpers.toast;
    var card = document.createElement('div');

    card.className = 'card';
    card.innerHTML = ''
      + '<div class="v4-band">'
      + '  <div class="v4-band__main">'
      + '    <div class="v4-band__label">Клиент</div>'
      + '    <div class="v4-band__name">' + esc(client.name) + '</div>'
      + '    <div class="v4-band__sub">' + esc([client.type, client.agency, client.cities.join(', ')].filter(Boolean).join(' · ')) + '</div>'
      + '  </div>'
      + '  <div class="v4-band__actions">'
      + '    <button type="button" class="btn btn-primary" data-act="order">Создать заказ</button>'
      + '    <button type="button" class="btn" data-act="edit">Изменить</button>'
      + '  </div>'
      + '</div>'
      + '<div class="v4-metrics">'
      + metric('Рейтинг', '<span class="badge badge--' + client.rating + '">' + esc(client.ratingLabel) + '</span>')
      + metric('Запросов', String(client.requests))
      + metric('Заказов', String(client.orders))
      + metric('Оборот', esc(client.sum), 'v4-money')
      + metric('Последний заказ', esc(client.lastOrder))
      + '</div>'
      + '<div class="v4-grid">'
      + '  <div class="v4-box">'
      + '    <div class="v4-box__head">Связь</div>'
      + '    <div class="v4-line"><span>Телефон</span><b>' + esc(client.phone || '—') + '</b></div>'
      + '    <div class="v4-line"><span>Телеграм</span><b>' + esc(client.telegram || '—') + '</b></div>'
      + '    <div class="v4-line"><span>Инстаграм</span><b>' + esc(client.instagram || '—') + '</b></div>'
      + '    <div class="v4-line"><span>Email</span><b>' + esc(client.email || '—') + '</b></div>'
      + '  </div>'
      + '  <div class="v4-box">'
      + '    <div class="v4-box__head">Связи</div>'
      + '    <div class="v4-line"><span>Агентство</span><b>' + esc(client.agency || '—') + '</b></div>'
      + '    <div class="v4-line"><span>Города</span><b>' + esc(client.cities.join(', ')) + '</b></div>'
      + '  </div>'
      + '</div>'
      + '<div class="v4-stream">'
      + '  <div class="v4-stream__head"><span>История</span><span class="dim">' + client.orders + ' заказов</span></div>'
      + client.history.map(function (item) {
        return '<div class="v4-event v4-event--' + item.key + '">'
          + '<span class="v4-event__date">' + esc(item.date) + '</span>'
          + '<span class="v4-event__name">' + esc(item.name) + '</span>'
          + '<span class="v4-event__status">' + esc(item.status) + '</span>'
          + '<span class="v4-event__cost">' + esc(item.cost) + '</span></div>';
      }).join('')
      + '</div>'
      + (client.comment ? '<div class="v4-comment"><b>Комментарий</b><p>' + esc(client.comment) + '</p></div>' : '')
      + '<div class="v4-meta">Создан ' + esc(client.created) + ' · ' + esc(client.createdBy) + ' · ' + (client.active ? 'активен' : 'неактивен') + '</div>';

    card.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');

      if (!act) return;

      toast((act.dataset.act === 'order' ? 'Создать заказ' : 'Изменить') + ' · ' + client.name);
    });

    return card;
  }

  window.CLIENT_VIEW = { renderClient: renderClient };
})();
