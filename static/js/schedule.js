(function() {
    const VIEW_STORAGE_KEY = 'jiva_schedule_view';
    const PAST_STORAGE_KEY = 'jiva_schedule_show_past';

    let currentView = localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'calendar';
    let currentOrders = [];
    let calendarDate = new Date();
    let activeOrderId = null;
    let statusColors = {};
    let showPastCompleted = false;

    function getTodayIso() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isPastCompleted(order) {
        if (order.status !== 'completed') return false;
        if (!order.has_date) return false;
        return order.date < getTodayIso();
    }

    function getShowPastPreference() {
        try {
            return localStorage.getItem(PAST_STORAGE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function setShowPastPreference(value) {
        try {
            localStorage.setItem(PAST_STORAGE_KEY, value ? '1' : '0');
        } catch (error) {}
    }

    const myOrdersOnlyToggle = document.getElementById('myOrdersOnly');
    const searchInput = document.getElementById('dashboardSearch');
    const sortSelect = document.getElementById('dashboardSort');
    const statusSelect = document.getElementById('dashboardStatus');
    const pastCompletedToggle = document.getElementById('pastCompletedToggle');
    const dashboardList = document.getElementById('dashboardList');
    const dashboardCalendar = document.getElementById('dashboardCalendar');
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarTitle = document.getElementById('calendarTitle');
    const calendarPrev = document.getElementById('calendarPrev');
    const calendarNext = document.getElementById('calendarNext');
    const contextMenu = document.getElementById('scheduleContextMenu');

    const eventModal = document.getElementById('eventModal');
    const eventModalTitle = document.getElementById('eventModalTitle');
    const eventModalBody = document.getElementById('eventModalBody');
    const eventModalCloseBtn = document.getElementById('eventModalCloseBtn');
    const eventModalDismissBtn = document.getElementById('eventModalDismissBtn');
    const eventModalDetailsBtn = document.getElementById('eventModalDetailsBtn');

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
        return !!order.content_changed;
    }

    function isOrderIncomplete(order) {
        return !!order.is_incomplete;
    }

    function getOrderName(order) {
        return order.name_display || order.name || 'Без названия';
    }

    function getRowClasses(order, extra) {
        let classes = `order-row order-row--${order.status}`;

        if (extra) classes += ' ' + extra;
        if (!order.has_date) classes += ' order-row--no-date';
        if (isOrderChanged(order)) classes += ' order-row--changed';
        if (isOrderIncomplete(order)) classes += ' order-row--incomplete';

        return classes;
    }
    function getMissingTitle(order) {
        if (!isOrderIncomplete(order) || !order.missing_fields || !order.missing_fields.length) return '';
        return 'Не заполнено: ' + order.missing_fields.join(', ');
    }

    function getServicesLabel(order) {
        if (!order.services || order.services.length === 0) return '';
        if (order.services.length === 1) return order.services[0];
        return order.services[0] + ' ...';
    }

    function getRole() {
        return document.body.dataset.role || '';
    }

    function canSeeCost() {
        const role = getRole();
        return role === 'senior_admin' || role === 'manager' || role === 'sales_manager';
    }

    function canOpenOrders() {
        const role = getRole();
        return role === 'senior_admin'
            || role === 'manager'
            || role === 'sales_manager'
            || role === 'production'
            || role === 'choreographer';
    }

    function getEventStyle(status) {
        const c = statusColors['order:' + status];
        if (!c) return '';
        return `background:${c.background}33; border-left-color:${c.border};`;
    }

    function renderEventModal(order) {
        if (!order) return;

        eventModalTitle.textContent = `Мероприятие #${order.id}`;

        const services = order.services && order.services.length
            ? order.services.map(s => `<li>${escapeHtml(s)}</li>`).join('')
            : '<li class="event-modal__empty">Услуги не указаны</li>';

        const costRow = canSeeCost() && order.cost && order.cost !== '—'
            ? `<div class="event-modal__row"><span class="event-modal__label">Общая стоимость</span><span class="event-modal__value event-modal__value--cost">${escapeHtml(order.cost)}</span></div>`
            : '';

        const paymentRow = (order.my_payment !== undefined && order.my_payment > 0)
            ? `<div class="event-modal__row"><span class="event-modal__label">Моя оплата</span><span class="event-modal__value event-modal__value--cost">${formatPrice(order.my_payment)}</span></div>`
            : '';

        const changedBanner = isOrderChanged(order)
            ? '<div class="event-modal__banner event-modal__banner--changed">Информация о заказе изменена</div>'
            : '';

        const incompleteBanner = isOrderIncomplete(order)
            ? `<div class="event-modal__banner event-modal__banner--incomplete">Заказ заполнен не полностью: ${escapeHtml((order.missing_fields || []).join(', '))}</div>`
            : '';

        eventModalBody.innerHTML = `
            ${changedBanner}
            ${incompleteBanner}
            <div class="event-modal__section">
                <div class="event-modal__row">
                    <span class="event-modal__label">Название</span>
                    <span class="event-modal__value">${escapeHtml(order.name || 'Без названия')}</span>
                </div>
                <div class="event-modal__row">
                    <span class="event-modal__label">Статус</span>
                    <span class="event-modal__value">
                        <span class="order-row__status order-row__status--${order.status}">${getStatusLabel(order.status)}</span>
                    </span>
                </div>
                <div class="event-modal__row">
                    <span class="event-modal__label">Дата</span>
                    <span class="event-modal__value">${order.has_date ? formatDate(order.date) : 'Дата не указана'}</span>
                </div>
                <div class="event-modal__row">
                    <span class="event-modal__label">Заказчик</span>
                    <span class="event-modal__value">${escapeHtml(order.client || '—')}</span>
                </div>
                <div class="event-modal__row">
                    <span class="event-modal__label">Город</span>
                    <span class="event-modal__value">${escapeHtml(order.city_name || '—')}</span>
                </div>
                <div class="event-modal__row">
                    <span class="event-modal__label">Адрес</span>
                    <span class="event-modal__value">${escapeHtml(order.address || '—')}</span>
                </div>
                <div class="event-modal__row">
                    <span class="event-modal__label">Менеджер</span>
                    <span class="event-modal__value">${escapeHtml(order.manager || '—')}</span>
                </div>
                ${costRow}
                ${paymentRow}
            </div>
            <div class="event-modal__section">
                <div class="event-modal__section-title">Услуги</div>
                <ul class="event-modal__list">${services}</ul>
            </div>
        `;

        if (eventModalDetailsBtn) {
            eventModalDetailsBtn.style.display = canOpenOrders() ? '' : 'none';
        }

        activeOrderId = order.id;
        eventModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeEventModal() {
        eventModal.classList.remove('active');
        document.body.style.overflow = '';
        activeOrderId = null;
    }

    function applyFiltersAndSort(orders) {
        const search = (searchInput.value || '').toLowerCase().trim();
        const status = statusSelect.value;
        const sort = sortSelect.value;

        let result = orders.slice();

        if (!showPastCompleted) {
            result = result.filter(o => !isPastCompleted(o));
        }

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
            const aHasDate = !!a.has_date;
            const bHasDate = !!b.has_date;

            if (aHasDate !== bHasDate) {
                return aHasDate ? 1 : -1;
            }

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
            const message = showPastCompleted
                ? 'Выполненных ранее заказов нет'
                : 'Заказы не найдены';
            dashboardList.innerHTML = `<div class="dashboard-empty">${message}</div>`;
            return;
        }

        if (showPastCompleted) {
            const sorted = filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            let pastHtml = `<div class="order-list-note">Выполненные ранее — ${sorted.length}. Фильтр по статусу не применяется.</div>`;

            pastHtml += `
                <div class="order-list-header">
                    <span>ID</span>
                    <span>Название</span>
                    <span>Клиент</span>
                    <span>Адрес</span>
                    <span>Дата</span>
                    <span>Стоимость</span>
                    <span>Статус</span>
                </div>
            `;

            pastHtml += sorted.map(order => renderOrderRow(order, 'order-row--past')).join('');

            dashboardList.innerHTML = pastHtml;

            attachOrderRowEvents();
            return;
        }

        const withoutDate = filtered.filter(o => !o.has_date);
        const withDate = filtered.filter(o => o.has_date);

        let html = `
            <div class="order-list-header">
                <span>ID</span>
                <span>Название</span>
                <span>Клиент</span>
                <span>Адрес</span>
                <span>Дата</span>
                <span>Стоимость</span>
                <span>Статус</span>
            </div>
        `;

        html += withoutDate.map(order => renderOrderRow(order, 'order-row--no-date-zone')).join('');
        html += withDate.map(order => renderOrderRow(order, '')).join('');

        dashboardList.innerHTML = html;

        attachOrderRowEvents();
    }

    function attachOrderRowEvents() {
        dashboardList.querySelectorAll('.order-row').forEach(row => {
            row.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-order-id'));
                const order = currentOrders.find(o => o.id === id);

                if (order) {
                    markOrderViewed(order.id, order.updated_at);
                    renderEventModal(order);
                }
            });
        });
    }

    function renderOrderRow(order, extra) {
        const isArtistView = myOrdersOnlyToggle && myOrdersOnlyToggle.checked;

        const costCell = isArtistView && order.my_payment !== undefined
            ? formatPrice(order.my_payment)
            : (order.cost || '—');

        const statusHtml = isOrderChanged(order)
            ? '<span class="order-row__badge">Обновлено</span>'
            : `<span class="order-row__status order-row__status--${order.status}">${getStatusLabel(order.status)}</span>`;

        const incompleteBadge = isOrderIncomplete(order)
            ? '<span class="order-row__dot" title="Заполнено не полностью"></span>'
            : '';

        const missingTitle = getMissingTitle(order);

        return `
            <div class="${getRowClasses(order, extra)}" data-order-id="${order.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                <span class="order-row__cell order-row__id">#${order.id}${incompleteBadge}</span>
                <span class="order-row__cell order-row__name">
                    <span class="order-row__label">Название: </span>
                    ${escapeHtml(getOrderName(order))}
                </span>
                <span class="order-row__cell order-row__client">
                    <span class="order-row__label">Клиент: </span>
                    ${escapeHtml(order.client || '—')}
                </span>
                <span class="order-row__cell order-row__address">
                    <span class="order-row__label">Адрес: </span>
                    ${escapeHtml(order.address || '—')}
                </span>
                <span class="order-row__cell order-row__date">
                    <span class="order-row__label">Дата: </span>
                    ${order.has_date ? formatDate(order.date) : 'Не указана'}
                </span>
                <span class="order-row__cell order-row__cost">${costCell}</span>
                <span class="order-row__cell">${statusHtml}</span>
            </div>
        `;
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
                const cellDate = new Date(year, month, dayNumber);
                const events = filtered.filter(o => {
                    if (!o.has_date) return false;
                    const start = parseDate(o.date);
                    const end = new Date(start);
                    end.setDate(end.getDate() + (o.duration || 1) - 1);
                    return cellDate >= start && cellDate <= end;
                });

                if (events.length > 0) {
                    eventsHtml = '<div class="calendar-cell__events">' +
                        events.map(e => {
                            const servicesLabel = getServicesLabel(e);
                            const costHtml = (canSeeCost() && e.cost && e.cost !== '—')
                                ? `<div class="calendar-event__cost">${escapeHtml(e.cost)}</div>`
                                : '';
                            const style = getEventStyle(e.status);

                            let eventClass = 'calendar-event';

                            if (isOrderChanged(e)) eventClass += ' calendar-event--changed';
                            if (isOrderIncomplete(e)) eventClass += ' calendar-event--incomplete';

                            const missingTitle = getMissingTitle(e);

                            return `
                                <div class="${eventClass}" style="${style}" data-order-id="${e.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                                    <div class="calendar-event__id">#${e.id}</div>
                                    <div class="calendar-event__name">${escapeHtml(getOrderName(e))}</div>
                                    <div class="calendar-event__client">${escapeHtml(e.client || '—')}</div>
                                    ${servicesLabel ? `<div class="calendar-event__service">${escapeHtml(servicesLabel)}</div>` : ''}
                                    ${costHtml}
                                </div>
                            `;
                        }).join('') +
                        '</div>';
                }
            }

            const weekdayIndex = i % 7;
            html += `
                <div class="${cellClass}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}">
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
                    renderEventModal(order);
                }
            });

            ev.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e.clientX, e.clientY, null, this.dataset.orderId);
            });
        });

        calendarGrid.querySelectorAll('.calendar-cell').forEach(cell => {
            cell.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                const dateStr = this.dataset.date;
                const isEmpty = this.classList.contains('calendar-cell--empty');
                showContextMenu(e.clientX, e.clientY, isEmpty ? null : dateStr, null);
            });
        });
    }

    function showContextMenu(x, y, dateStr, orderId) {
        if (!contextMenu) return;
        const items = contextMenu.querySelectorAll('.context-menu-item');
        if (items.length === 0) return;

        contextMenu.dataset.date = dateStr || '';
        contextMenu.dataset.orderId = orderId || '';

        contextMenu.style.display = 'block';
        contextMenu.style.left = '0px';
        contextMenu.style.top = '0px';

        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let left = x;
        let top = y;

        if (left + menuWidth > winWidth) left = winWidth - menuWidth - 10;
        if (top + menuHeight > winHeight) top = winHeight - menuHeight - 10;
        if (left < 10) left = 10;
        if (top < 10) top = 10;

        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
    }

    function hideContextMenu() {
        if (contextMenu) contextMenu.style.display = 'none';
    }

    function render() {
        if (currentView === 'list') {
            dashboardList.style.display = 'flex';
            dashboardCalendar.style.display = 'none';
            renderList();
        } else {
            dashboardList.style.display = 'none';
            dashboardCalendar.style.display = 'block';
            renderCalendar();
        }
    }

    function applyInitialView() {
        document.querySelectorAll('.view-switch__btn').forEach(b => {
            b.classList.toggle('active', b.dataset.view === currentView);
        });
    }

    function loadOrders() {
        let url = '/orders/list/?status=all';
        const isArtistView = myOrdersOnlyToggle && myOrdersOnlyToggle.checked;

        if (isArtistView) {
            url = '/schedule/my-orders/';
        }

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    dashboardList.innerHTML = `<div class="dashboard-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }
                currentOrders = data.orders || [];
                statusColors = data.colors || {};
                render();
            })
            .catch(err => {
                dashboardList.innerHTML = '<div class="dashboard-empty">Ошибка загрузки расписания</div>';
                console.error(err);
            });
    }

    if (pastCompletedToggle) {
        pastCompletedToggle.checked = getShowPastPreference();
        showPastCompleted = pastCompletedToggle.checked;

        pastCompletedToggle.addEventListener('change', function() {
            showPastCompleted = this.checked;
            setShowPastPreference(this.checked);
            render();
        });
    }

    document.querySelectorAll('.view-switch__btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-switch__btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            try {
                localStorage.setItem(VIEW_STORAGE_KEY, currentView);
            } catch {}
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

    if (contextMenu) {
        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', function() {
                const action = this.dataset.action;
                const dateStr = contextMenu.dataset.date || '';
                hideContextMenu();
                if (action === 'create-order') {
                    const params = new URLSearchParams();
                    if (dateStr) params.set('open_create', '1');
                    if (dateStr) params.set('create_date', dateStr);
                    window.location.href = '/orders/' + (params.toString() ? '?' + params.toString() : '');
                } else if (action === 'create-training') {
                    window.UI.showToast('Создание тренировки — функция в разработке');
                } else if (action === 'create-event') {
                    window.UI.showToast('Создание события — функция в разработке');
                }
            });
        });

        document.addEventListener('click', function(e) {
            if (!contextMenu.contains(e.target)) {
                hideContextMenu();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideContextMenu();
            }
        });

        window.addEventListener('scroll', hideContextMenu, true);
    }

    if (eventModalCloseBtn) {
        eventModalCloseBtn.addEventListener('click', closeEventModal);
    }
    if (eventModalDismissBtn) {
        eventModalDismissBtn.addEventListener('click', closeEventModal);
    }
    if (eventModal) {
        eventModal.addEventListener('click', function(e) {
            if (e.target === this) closeEventModal();
        });
    }
    if (eventModalDetailsBtn) {
        eventModalDetailsBtn.addEventListener('click', function() {
            if (!activeOrderId) return;
            window.location.href = `/orders/?open_order=${activeOrderId}`;
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && eventModal && eventModal.classList.contains('active')) {
            closeEventModal();
        }
    });

    applyInitialView();
    loadOrders();
})();