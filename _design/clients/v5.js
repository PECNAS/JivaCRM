(function () {
  'use strict';

  var TABS = [
    { key: 'all', label: 'Все данные' },
    { key: 'contacts', label: 'Контакты' },
    { key: 'orders', label: 'Заказы' }
  ];

  function escOf(helpers) {
    return helpers.esc;
  }

  function renderClient(client, helpers) {
    var esc = escOf(helpers);
    var toast = helpers.toast;
    var card = document.createElement('div');
    var active = 'all';

    var contacts = [
      { k: 'Телефон', v: client.phone },
      { k: 'Телеграм', v: client.telegram },
      { k: 'Инстаграм', v: client.instagram },
      { k: 'Email', v: client.email },
      { k: 'Агентство', v: client.agency },
      { k: 'Города', v: client.cities.join(', ') },
      { k: 'Тип клиента', v: client.type }
    ];

    function panel(key) {
      if (key === 'all') {
        return '<div class="v5-grid">'
          + contacts.map(function (item) {
            return '<div class="v5-cell"><span>' + esc(item.k) + '</span><b class="' + (item.v ? '' : 'dim') + '">' + esc(item.v || '—') + '</b></div>';
          }).join('')
          + '<div class="v5-cell"><span>Рейтинг</span><span class="badge badge--' + client.rating + '">' + esc(client.ratingLabel) + '</span></div>'
          + '<div class="v5-cell"><span>Запросов</span><b>' + client.requests + '</b></div>'
          + '<div class="v5-cell"><span>Заказов</span><b>' + client.orders + '</b></div>'
          + '<div class="v5-cell"><span>Оборот</span><b class="v5-money">' + esc(client.sum) + '</b></div>'
          + '<div class="v5-cell"><span>Последний заказ</span><b>' + esc(client.lastOrder) + '</b></div>'
          + '</div>'
          + (client.comment ? '<div class="v5-note">' + esc(client.comment) + '</div>' : '');
      }

      if (key === 'contacts') {
        return '<div class="v5-list">'
          + contacts.slice(0, 8).map(function (item) {
            return '<div class="v5-lrow"><span>' + esc(item.k) + '</span><b class="' + (item.v ? '' : 'dim') + '">' + esc(item.v || '—') + '</b></div>';
          }).join('')
          + '</div>';
      }

      return '<div class="v5-list">'
        + client.history.map(function (item) {
          return '<div class="v5-lrow"><span>' + esc(item.date) + '</span>'
            + '<b>' + esc(item.name) + '</b>'
            + '<span class="badge badge--' + item.key + '">' + esc(item.status) + '</span>'
            + '<span class="v5-lcost">' + esc(item.cost) + '</span></div>';
        }).join('')
        + '</div>';
    }

    card.className = 'card';
    card.innerHTML = ''
      + '<div class="v5-head">'
      + '  <div>'
      + '    <div class="card__title">' + esc(client.name) + '</div>'
      + '    <div class="v5-sub">' + esc([client.type, client.agency].filter(Boolean).join(' · ')) + ' · ' + esc(client.cities.join(', ')) + '</div>'
      + '  </div>'
      + '  <div class="v5-actions">'
      + '    <button type="button" class="btn" data-act="call">Позвонить</button>'
      + '    <button type="button" class="btn" data-act="edit">Изменить</button>'
      + '    <button type="button" class="btn btn-primary" data-act="order">Создать заказ</button>'
      + '  </div>'
      + '</div>'
      + '<div class="v5-tabs">'
      + TABS.map(function (tab) {
        return '<button type="button" class="v5-tab' + (tab.key === 'all' ? ' is-on' : '') + '" data-tab="' + tab.key + '">' + esc(tab.label) + '</button>';
      }).join('')
      + '</div>'
      + '<div class="v5-body" id="v5Body">' + panel('all') + '</div>'
      + '<div class="v5-foot">Создан ' + esc(client.created) + ' · ' + esc(client.createdBy) + (client.active ? '' : ' · неактивен') + '</div>';

    card.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');

      if (tab) {
        active = tab.dataset.tab;

        Array.prototype.forEach.call(card.querySelectorAll('[data-tab]'), function (btn) {
          btn.classList.toggle('is-on', btn === tab);
        });

        card.querySelector('#v5Body').innerHTML = panel(active);
        return;
      }

      var act = e.target.closest('[data-act]');

      if (!act) return;

      var map = { order: 'Создать заказ', edit: 'Изменить', call: 'Позвонить' };

      toast(map[act.dataset.act] + ' · ' + client.name);
    });

    return card;
  }

  window.CLIENT_VIEW = { renderClient: renderClient };
})();
