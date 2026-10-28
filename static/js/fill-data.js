(function() {
    'use strict';

    const buttons = document.querySelectorAll('[data-fill]');
    const deleteButtons = document.querySelectorAll('[data-delete]');
    const logBox = document.getElementById('fillLog');

    function getCSRFToken() {
        const match = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return match ? match[2] : '';
    }

    function addLog(message) {
        if (!logBox) return;

        const row = document.createElement('div');
        row.className = 'fill-log__row';
        row.textContent = message;
        logBox.prepend(row);
    }

    function setStatus(action, text, isError) {
        const card = document.querySelector('[data-action="' + action + '"]');
        if (!card) return;

        const box = card.querySelector('.fill-card__status');
        box.textContent = text || '';
        box.classList.toggle('fill-card__status--error', !!isError);
    }

    function send(action) {
        const body = new URLSearchParams();
        body.set('action', action);

        return fetch('/fill-data/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        }).then(response => response.json());
    }

    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.dataset.fill;
            const card = this.closest('.fill-card');

            this.disabled = true;
            card.classList.add('fill-card--loading');
            setStatus(action, 'Создаём...', false);

            send(action)
                .then(data => {
                    this.disabled = false;
                    card.classList.remove('fill-card--loading');

                    if (!data.success) {
                        setStatus(action, data.error || 'Ошибка', true);
                        addLog('Ошибка: ' + (data.error || 'неизвестно'));
                        return;
                    }

                    const result = data.result || {};
                    setStatus(action, result.message || 'Готово', false);
                    addLog(result.message || 'Готово');
                })
                .catch(error => {
                    this.disabled = false;
                    card.classList.remove('fill-card--loading');
                    setStatus(action, 'Ошибка запроса', true);
                    addLog('Ошибка запроса');
                    console.error(error);
                });
        });
    });

    const DELETE_TEXTS = {
        delete_orders: 'Удалить все заказы? Вместе с заказами удалятся начисления и выплаты по ним.',
        delete_clients: 'Удалить всех клиентов? Вместе с клиентами удалятся все их заказы.',
        delete_employees: 'Удалить всех сотрудников, кроме суперпользователя? Их заказы останутся, но без сотрудников.',
        delete_services: 'Удалить все услуги и каталоги? Заказы останутся, но без привязки к услугам.'
    };

    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.dataset.delete;

            window.UI.confirm({
                title: 'Удаление данных',
                text: DELETE_TEXTS[action] || 'Удалить данные?',
                okText: 'Удалить',
                cancelText: 'Отмена',
                danger: true
            }).then(confirmed => {
                if (!confirmed) return;

                this.disabled = true;

                send(action)
                    .then(data => {
                        this.disabled = false;

                        if (!data.success) {
                            addLog('Ошибка: ' + (data.error || 'неизвестно'));
                            return;
                        }

                        addLog((data.result && data.result.message) || 'Удалено');
                    })
                    .catch(error => {
                        this.disabled = false;
                        addLog('Ошибка запроса');
                        console.error(error);
                    });
            });
        });
    });
})();
