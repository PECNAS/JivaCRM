(function() {
    let currentView = 'list';
    let currentOrders = [];
    let calendarDate = new Date();
    let highlightedOrderId = null;

    const myOrdersOnlyToggle = document.getElementById('myOrdersOnly');
    const searchInput = document.getElementById('dashboardSearch');
    const sortSelect = document.getElementById('dashboardSort');
    const statusSelect = document.getElementById('dashboardStatus');
    const dashboardList = document.getElementById('dashboardList');
    const dashboardCalendar = document.getElementById('dashboardCalendar');
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarTitle = document.getElementById('calendarTitle');
    const calendarPrev = document.getElementById('calendarPrev');
    const calendarNext = document.getElementById('calendarNext');

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const weekdaysShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    function getStatusLabel(status) {
        const labels = {
            request: 'Запрос',
            confirmed: 'Подтверждено',
            completed: 'Выполнено',
        };
        return labels[status] || status;
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function formatPrice(value) {
        const num = parseFloat(value) || 0;
        return num.toFixed(2).replace('.', ',') + ' ₽';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    function parseDate(dateStr) {
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    function getViewedOrders() {
        try {
            const raw = localStorage.getItem('jiva_viewed_orders');
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function markOrderViewed(orderId, updatedAt) {
        const viewed = getViewedOrders();
        viewed[orderId] = updatedAt;
        try {
            localStorage.setItem('jiva_viewed_orders', JSON.stringify(viewed));
        } catch {}
    }

    function isOrderChanged(order) {
        if (!order.updated_at) return false;
        const viewed = getViewedOrders();
        const prev = viewed[order.id];
        if (!prev) return false;
        return prev !== order.updated_at;
    }

    function applyFiltersAndSort(orders) {
        const search = (searchInput.value || '').toLowerCase().trim();
        const status = statusSelect.value;
        const sort = sortSelect.value;

        let result = orders.slice();

        if (search) {
            result = result.filter(o =>
                (o.name && o.name.toLowerCase().includes(search)) ||
                (o.client && o.client.toLowerCase().includes(search)) ||
                (o.address && o.address.toLowerCase().includes(search))
            );
        }

        if (status !== 'all') {
            result = result.filter(o => o.status === status);
        }

        result.sort((a, b) => {
            if (sort === 'date_desc') {
                return (b.date || '').localeCompare(a.date || '');
            } else if (sort === 'date_asc') {
                return (a.date || '').localeCompare(b.date || '');
            } else if (sort === 'name_asc') {
                return (a.name || '').localeCompare(b.name || '', 'ru');
            } else if (sort === 'name_desc') {
                return (b.name || '').localeCompare(a.name || '', 'ru');
            } else if (sort === 'client_asc') {
                return (a.client || '').localeCompare(b.client || '', 'ru');
            }
            return 0;
        });

        return result;
    }

    function renderList() {
        const filtered = applyFiltersAndSort(currentOrders);

        if (filtered.length === 0) {
            dashboardList.innerHTML = '<div class="dashboard-empty">Заказы не найдены</div>';
            return;
        }

        dashboardList.innerHTML = filtered.map(order => {
            const changedClass = isOrderChanged(order) ? 'order-card--changed' : '';
            const isArtistView = myOrdersOnlyToggle && myOrdersOnlyToggle.checked;

            const paymentRow = isArtistView && order.my_payment !== undefined
                ? `<div class="order-card__row">
                        <span class="order-card__label">Моя оплата</span>
                        <span class="order-card__value order-card__value--accent">${formatPrice(order.my_payment)}</span>
                   </div>`
                : '';

            return `
                <div class="order-card order-card--${order.status} ${changedClass}" data-order-id="${order.id}">
                    ${isOrderChanged(order) ? '<span class="order-card__badge">Обновлено</span>' : ''}
                    <div class="order-card__title">${escapeHtml(order.name || 'Без названия')}</div>
                    <div class="order-card__row">
                        <span class="order-card__label">Дата</span>
                        <span class="order-card__value">${formatDate(order.date)}</span>
                    </div>
                    <div class="order-card__row">
                        <span class="order-card__label">Клиент</span>
                        <span class="order-card__value">${escapeHtml(order.client || '—')}</span>
                    </div>
                    <div class="order-card__row">
                        <span class="order-card__label">Адрес</span>
                        <span class="order-card__value">${escapeHtml(order.address || '—')}</span>
                    </div>
                    ${paymentRow}
                    <span class="order-card__status order-card__status--${order.status}">${getStatusLabel(order.status)}</span>
                </div>
            `;
        }).join('');

        dashboardList.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-order-id'));
                const order = currentOrders.find(o => o.id === id);
                if (order) {
                    markOrderViewed(order.id, order.updated_at);
                }
                window.location.href = `/orders/`;
            });
        });
    }

    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        let startDay = firstDay.getDay();
        if (startDay === 0) startDay = 7;
        const daysInMonth = lastDay.getDate();

        calendarTitle.textContent = `${monthNames[month]} ${year}`;

        let html = '';
        weekdaysShort.forEach(day => {
            html += `<div class="calendar-header">${day}</div>`;
        });

        const startOffset = startDay - 1;
        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
        const today = new Date();
        const filtered = applyFiltersAndSort(currentOrders);

        for (let i = 0; i < totalCells; i++) {
            const dayNumber = i - startOffset + 1;
            const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
            const dateObj = new Date(year, month, dayNumber);
            const isToday = dateObj.getFullYear() === today.getFullYear() &&
                dateObj.getMonth() === today.getMonth() &&
                dateObj.getDate() === today.getDate();

            let cellClass = 'calendar-cell';
            if (!isCurrentMonth) cellClass += ' calendar-cell--empty';
            if (isToday) cellClass += ' calendar-cell--today';

            let eventsHtml = '';
            if (isCurrentMonth) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                const events = filtered.filter(o => {
                    const start = parseDate(o.date);
                    const end = new Date(start);
                    end.setDate(end.getDate() + (o.duration || 1) - 1);
                    const current = new Date(dateStr);
                    return current >= start && current <= end;
                });

                if (events.length > 0) {
                    eventsHtml = '<div class="calendar-cell__events">' +
                        events.map(e => `<div class="calendar-event calendar-event--${e.status}" data-order-id="${e.id}">#${e.id} ${escapeHtml(e.name || '')}</div>`).join('') +
                        '</div>';
                }
            }

            const weekdayIndex = i % 7;
            html += `
                <div class="${cellClass}">
                    <div class="calendar-cell__date">
                        <span>${isCurrentMonth ? dayNumber : ''}</span>
                        <span class="calendar-cell__weekday">${isCurrentMonth ? weekdaysShort[weekdayIndex] : ''}</span>
                    </div>
                    ${eventsHtml}
                </div>
            `;
        }

        calendarGrid.innerHTML = html;

        calendarGrid.querySelectorAll('.calendar-event').forEach(ev => {
            ev.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-order-id'));
                const order = currentOrders.find(o => o.id === id);
                if (order) {
                    markOrderViewed(order.id, order.updated_at);
                }
                window.location.href = `/orders/`;
            });
        });
    }

    function render() {
        if (currentView === 'list') {
            dashboardList.style.display = 'grid';
            dashboardCalendar.style.display = 'none';
            renderList();
        } else {
            dashboardList.style.display = 'none';
            dashboardCalendar.style.display = 'block';
            renderCalendar();
        }
    }

    function loadOrders() {
        let url = '/orders/list/?status=all';
        const isArtistView = myOrdersOnlyToggle && myOrdersOnlyToggle.checked;

        if (isArtistView) {
            url = '/orders/my/';
        }

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    dashboardList.innerHTML = `<div class="dashboard-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }
                currentOrders = data.orders || [];
                render();
            })
            .catch(err => {
                dashboardList.innerHTML = '<div class="dashboard-empty">Ошибка загрузки заказов</div>';
                console.error(err);
            });
    }

    document.querySelectorAll('.view-switch__btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-switch__btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            render();
        });
    });

    if (myOrdersOnlyToggle) {
        myOrdersOnlyToggle.addEventListener('change', function() {
            loadOrders();
        });
    }

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(render, 300);
    });

    sortSelect.addEventListener('change', render);
    statusSelect.addEventListener('change', render);

    calendarPrev.addEventListener('click', function() {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    });

    calendarNext.addEventListener('click', function() {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    });

    loadOrders();
})();