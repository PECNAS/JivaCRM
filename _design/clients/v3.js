(function () {
  'use strict';

  function renderClient(client, helpers) {
    var esc = helpers.esc;
    var toast = helpers.toast;
    var card = document.createElement('div');

    var rows = [
      { group: 'Контакты', items: [
        { k: 'Телефон', v: client.phone, link: 'tel' },
        { k: 'Телеграм', v: client.telegram, link: 'tg' },
        { k: 'Инстаграм', v: client.instagram },
        { k: 'Email', v: client.email }
      ] },
      { group: 'Клиент', items: [
        { k: 'Тип клиента', v: client.type },
        { k: 'Агентство', v: client.agency },
        { k: 'Города', v: client.cities.join(', ') }
      ] },
      { group: 'Показатели', items: [
        { k: 'Рейтинг', v: client.ratingLabel, tag: client.rating },
        { k: 'Запросов', v: String(client.requests) },
        { k: 'Заказов', v: String(client.orders) },
        { k: 'Оборот', v: client.sum, money: true },
        { k: 'Последний заказ', v: client.lastOrder }
      ] }
    ];

    card.className = 'card';
    card.innerHTML = ''
      + '<div class="v3-layout">'
      + '  <div class="v3-main">'
      + '    <div class="v3-title">'
      + '      <h2>' + esc(client.name) + '</h2>'
      + '      <div class="v3-sub">' + esc(client.type) + (client.agency ? ' · ' + esc(client.agency) : '') + ' · ' + esc(client.cities.join(' · ')) + '</div>'
      + '    </div>'
      + rows.map(function (group) {
        return '<div class="v3-group"><div class="v3-group__title">' + esc(group.group) + '</div>'
          + group.items.map(function (item) {
            var value = item.v || '—';
            var html = item.tag
              ? '<span class="badge badge--' + item.tag + '">' + esc(value) + '</span>'
              : item.money
                ? '<b class="v3-money">' + esc(value) + '</b>'
                : item.link && item.v
                  ? '<a class="link" href="#">' + esc(value) + '</a>'
                  : '<span class="' + (item.v ? 'v3-val' : 'dim') + '">' + esc(value) + '</span>';

            return '<div class="v3-row"><span class="v3-key">' + esc(item.k) + '</span><span class="v3-cell">' + html + '</span></div>';
          }).join('')
          + '</div>';
      }).join('')
      + '  </div>'
      + '  <aside class="v3-side">'
      + '    <div class="v3-side__title">Действия</div>'
      + '    <button type="button" class="btn btn-primary v3-act" data-act="order">Создать заказ</button>'
      + '    <button type="button" class="btn v3-act" data-act="edit">Изменить</button>'
      + '    <button type="button" class="btn v3-act" data-act="call">Позвонить</button>'
      + '    <button type="button" class="btn v3-act" data-act="tg">Написать в телеграм</button>'
      + '    <div class="v3-side__title">Комментарий</div>'
      + '    <div class="v3-note">' + esc(client.comment || '—') + '</div>'
      + '    <div class="v3-side__title">Служебное</div>'
      + '    <div class="v3-meta">Создан ' + esc(client.created) + '<br>Автор: ' + esc(client.createdBy) + '<br>Статус: ' + (client.active ? 'активен' : 'неактивен') + '</div>'
      + '  </aside>'
      + '</div>';

    card.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');

      if (!act) return;

      var map = { order: 'Создать заказ', edit: 'Изменить', call: 'Позвонить', tg: 'Написать в телеграм' };

      toast(map[act.dataset.act] + ' · ' + client.name);
    });

    return card;
  }

  window.CLIENT_VIEW = { renderClient: renderClient };
})();
