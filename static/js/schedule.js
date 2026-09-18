(function() {
    let currentDate = new Date();
    let currentView = 'month';
    let activeStatuses = ['all'];
    let searchQuery = '';
    let currentOrders = [];
    let highlightedOrderId = null;

    const scheduleGrid = document.getElementById('scheduleGrid');
    const scheduleTitle = document.getElementById('scheduleTitle');
    const prevBtn = document.getElementById('prevPeriod');
    const nextBtn = document.getElementById('nextPeriod');
    const searchInput = document.getElementById('scheduleSearch');
    const modal = document.getElementById('orderModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const viewOrderBtn = document.getElementById('viewOrderBtn');

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const monthNamesGenitive = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const weekdaysShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const weekdaysFull = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

    function getStatusLabel(status) {
        const labels = {
            request: 'Запрос',
            confirmed: 'Подтверждено',
            completed: 'Выполнено',
            training: 'Тренировка'
        };
        return labels[status] || status;
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseDate(str) {
        if (!str) return null;
        const parts = str.split('-');
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    function dateToStr(date) {
        return formatDate(date);
    }

    function isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function getFilteredOrders() {
        let orders = currentOrders;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            orders = orders.filter(o =>
                (o.client && o.client.toLowerCase().includes(q)) ||
                (o.address && o.address.toLowerCase().includes(q)) ||
                (o.name && o.name.toLowerCase().includes(q))
            );
        } else if (!activeStatuses.includes('all')) {
            orders = orders.filter(o => activeStatuses.includes(o.status));
        }

        return orders;
    }

    function getOrdersSpanningDate(date) {
        const dateStr = dateToStr(date);
        return getFilteredOrders().filter(o => {
            const oStart = parseDate(o.date);
            if (!oStart) return false;
            const oEnd = new Date(oStart);
            oEnd.setDate(oEnd.getDate() + (o.duration || 1) - 1);
            const oStartStr = dateToStr(oStart);
            const oEndStr = dateToStr(oEnd);
            return dateStr >= oStartStr && dateStr <= oEndStr;
        });
    }

    function getOrderSpanInfo(order, currentCellDate) {
        const oStart = parseDate(order.date);
        if (!oStart) return { position: 'start', isStart: false };
        const oEnd = new Date(oStart);
        oEnd.setDate(oEnd.getDate() + (order.duration || 1) - 1);

        const cellStr = dateToStr(currentCellDate);
        const startStr = dateToStr(oStart);
        const endStr = dateToStr(oEnd);

        const isStart = cellStr === startStr;
        const isEnd = cellStr === endStr;

        let position = 'start';
        if (isStart && isEnd) position = 'single';
        else if (isStart) position = 'start';
        else if (isEnd) position = 'end';
        else position = 'middle';

        return { position, isStart, isEnd };
    }

    function orderBlockHtml(order, spanInfo) {
        const statusClass = `order-block--${order.status}`;
        let spanClass = '';
        if (spanInfo.position === 'start') spanClass = 'order-block--span-start';
        else if (spanInfo.position === 'middle') spanClass = 'order-block--span-middle';
        else if (spanInfo.position === 'end') spanClass = 'order-block--span-end';

        const highlight = (highlightedOrderId && highlightedOrderId === order.id) ? 'order-block--highlight' : '';

        if (spanInfo.position === 'middle' || spanInfo.position === 'end') {
            return `<div class="order-block ${statusClass} ${spanClass} ${highlight}" data-order-id="${order.id}"></div>`;
        }

        return `
            <div class="order-block ${statusClass} ${spanClass} ${highlight}" data-order-id="${order.id}">
                <div class="order-block__id">#${order.id}</div>
                <div class="order-block__client">${escapeHtml(order.client || '')}</div>
                <div class="order-block__address">${escapeHtml(order.address || '')}</div>
                <div class="order-block__bottom">
                    <span class="order-block__cost">${escapeHtml(order.cost || '—')}</span>
                    <span class="order-block__status">${getStatusLabel(order.status)}</span>
                </div>
                <div class="order-block__manager">${escapeHtml(order.manager || '')}</div>
            </div>
        `;
    }

    function renderMonth(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        let startDay = firstDay.getDay();
        if (startDay === 0) startDay = 7;
        const daysInMonth = lastDay.getDate();

        scheduleTitle.textContent = `${monthNames[month]} ${year}`;

        const startOffset = startDay - 1;
        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

        let html = '';
        weekdaysShort.forEach(day => {
            html += `<div class="schedule-grid__header">${day}</div>`;
        });

        const today = new Date();

        for (let i = 0; i < totalCells; i++) {
            const dayNumber = i - startOffset + 1;
            const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
            const dateObj = new Date(year, month, dayNumber);
            const isToday = isSameDay(dateObj, today);

            let cellClass = 'schedule-grid__cell';
            if (!isCurrentMonth) cellClass += ' schedule-grid__cell--empty';
            if (isToday) cellClass += ' schedule-grid__cell--today';

            let eventsHtml = '';
            if (isCurrentMonth) {
                const orders = getOrdersSpanningDate(dateObj);
                eventsHtml = '<div class="cell-events">';
                orders.forEach(order => {
                    const spanInfo = getOrderSpanInfo(order, dateObj);
                    eventsHtml += orderBlockHtml(order, spanInfo);
                });
                eventsHtml += '</div>';
            }

            const weekdayIndex = i % 7;
            html += `
                <div class="${cellClass}">
                    <div class="cell-date">
                        <span class="cell-date__day">${isCurrentMonth ? dayNumber : ''}</span>
                        <span class="cell-date__weekday">${isCurrentMonth ? weekdaysShort[weekdayIndex] : ''}</span>
                    </div>
                    ${eventsHtml}
                </div>
            `;
        }

        scheduleGrid.style.gridTemplateRows = '';
        scheduleGrid.innerHTML = html;
        attachOrderEvents();
    }

    function renderWeek(year, month, day) {
        const date = new Date(year, month, day);
        let dow = date.getDay();
        if (dow === 0) dow = 7;
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - (dow - 1));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        scheduleTitle.textContent = `${startOfWeek.getDate()} – ${endOfWeek.getDate()} ${monthNamesGenitive[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;

        let html = '';
        weekdaysShort.forEach(w => {
            html += `<div class="schedule-grid__header">${w}</div>`;
        });

        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const dateObj = new Date(startOfWeek);
            dateObj.setDate(startOfWeek.getDate() + i);
            const isToday = isSameDay(dateObj, today);

            let cellClass = 'schedule-grid__cell';
            if (isToday) cellClass += ' schedule-grid__cell--today';

            const orders = getOrdersSpanningDate(dateObj);
            let eventsHtml = '<div class="cell-events">';
            orders.forEach(order => {
                const spanInfo = getOrderSpanInfo(order, dateObj);
                eventsHtml += orderBlockHtml(order, spanInfo);
            });
            eventsHtml += '</div>';

            html += `
                <div class="${cellClass}">
                    <div class="cell-date">
                        <span class="cell-date__day">${dateObj.getDate()}</span>
                        <span class="cell-date__weekday">${weekdaysShort[i]}</span>
                    </div>
                    ${eventsHtml}
                </div>
            `;
        }

        scheduleGrid.style.gridTemplateRows = '';
        scheduleGrid.innerHTML = html;
        attachOrderEvents();
    }

    function renderDay(year, month, day) {
        const dateObj = new Date(year, month, day);
        let dow = dateObj.getDay();
        if (dow === 0) dow = 7;
        const weekdayIndex = dow - 1;

        scheduleTitle.textContent = `${dateObj.getDate()} ${monthNamesGenitive[month]} ${year}, ${weekdaysFull[weekdayIndex]}`;

        let html = '';
        weekdaysShort.forEach(w => {
            html += `<div class="schedule-grid__header">${w}</div>`;
        });

        const today = new Date();
        const isToday = isSameDay(dateObj, today);

        for (let i = 0; i < 7; i++) {
            const isActive = i === weekdayIndex;
            let cellClass = 'schedule-grid__cell';
            if (!isActive) cellClass += ' schedule-grid__cell--empty';
            if (isToday && isActive) cellClass += ' schedule-grid__cell--today';

            let eventsHtml = '';
            if (isActive) {
                const orders = getOrdersSpanningDate(dateObj);
                eventsHtml = '<div class="cell-events">';
                orders.forEach(order => {
                    const spanInfo = getOrderSpanInfo(order, dateObj);
                    eventsHtml += orderBlockHtml(order, spanInfo);
                });
                eventsHtml += '</div>';
            }

            html += `
                <div class="${cellClass}">
                    <div class="cell-date">
                        <span class="cell-date__day">${isActive ? dateObj.getDate() : ''}</span>
                        <span class="cell-date__weekday">${isActive ? weekdaysShort[i] : ''}</span>
                    </div>
                    ${eventsHtml}
                </div>
            `;
        }

        scheduleGrid.style.gridTemplateRows = '';
        scheduleGrid.innerHTML = html;
        attachOrderEvents();
    }

    function attachOrderEvents() {
        scheduleGrid.querySelectorAll('.order-block').forEach(block => {
            block.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-order-id'));
                openOrderModal(id);
            });
        });
    }

    function renderSchedule() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();

        if (currentView === 'month') {
            renderMonth(year, month);
        } else if (currentView === 'week') {
            renderWeek(year, month, day);
        } else {
            renderDay(year, month, day);
        }
    }

    function navigate(direction) {
        if (currentView === 'month') {
            currentDate.setMonth(currentDate.getMonth() + direction);
        } else if (currentView === 'week') {
            currentDate.setDate(currentDate.getDate() + direction * 7);
        } else {
            currentDate.setDate(currentDate.getDate() + direction);
        }
        renderSchedule();
    }

    function goToToday() {
        currentDate = new Date();
        currentView = 'month';
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === 'month');
        });
        renderSchedule();
    }

    function scrollToHighlightedOrder() {
        if (!highlightedOrderId) return;
        const el = scheduleGrid.querySelector(`.order-block[data-order-id="${highlightedOrderId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function runSearch(query) {
        searchQuery = query;
        highlightedOrderId = null;

        if (searchQuery) {
            const matches = currentOrders.filter(o =>
                (o.client && o.client.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (o.name && o.name.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            if (matches.length > 0) {
                const firstMatch = matches[0];
                highlightedOrderId = firstMatch.id;
                const matchDate = parseDate(firstMatch.date);
                if (matchDate) {
                    currentDate = new Date(matchDate);
                }
            }
        }

        renderSchedule();

        if (highlightedOrderId) {
            setTimeout(scrollToHighlightedOrder, 100);
        }
    }

    function openOrderModal(orderId) {
        const order = currentOrders.find(o => o.id === orderId);
        if (!order) return;

        document.getElementById('modalOrderTitle').textContent = `Заказ #${order.id}`;
        document.getElementById('viewAddress').textContent = order.address || '—';
        document.getElementById('viewDate').textContent = order.date || '—';
        document.getElementById('viewClient').textContent = order.client || '—';
        document.getElementById('viewCost').textContent = order.cost || '—';
        document.getElementById('viewStatus').textContent = getStatusLabel(order.status);
        document.getElementById('viewManager').textContent = order.manager || '—';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        viewOrderBtn.onclick = function() {
            window.location.href = `/orders/`;
        };
    }

    function closeOrderModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function showToast(message) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 2000);
    }

    function loadOrders() {
        fetch('/orders/list/?status=all')
            .then(r => r.json())
            .then(data => {
                if (data.orders) {
                    currentOrders = data.orders.map(o => ({
                        id: o.id,
                        name: o.name || '',
                        address: o.address || '',
                        date: o.date,
                        client: o.client || '',
                        cost: o.cost || '—',
                        status: o.status,
                        status_display: o.status_display,
                        manager: o.manager || '',
                        duration: o.duration || 1,
                    }));
                    renderSchedule();
                    if (highlightedOrderId) {
                        setTimeout(scrollToHighlightedOrder, 100);
                    }
                }
            })
            .catch(err => {
                console.error('Ошибка загрузки заказов:', err);
                showToast('Ошибка загрузки расписания');
            });
    }

    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            if (currentView === 'today') {
                goToToday();
            } else {
                renderSchedule();
            }
        });
    });

    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const status = this.dataset.status;
            if (status === 'all') {
                activeStatuses = ['all'];
                document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            } else {
                if (activeStatuses.includes('all')) {
                    activeStatuses = [];
                }
                const index = activeStatuses.indexOf(status);
                if (index > -1) {
                    activeStatuses.splice(index, 1);
                    this.classList.remove('active');
                } else {
                    activeStatuses.push(status);
                    this.classList.add('active');
                }
                if (activeStatuses.length === 0) {
                    activeStatuses = ['all'];
                    document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('[data-status="all"]').classList.add('active');
                }
            }
            renderSchedule();
        });
    });

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            runSearch(this.value.trim());
        }, 400);
    });

    modalCloseBtn.addEventListener('click', closeOrderModal);
    closeModalBtn.addEventListener('click', closeOrderModal);

    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeOrderModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeOrderModal();
        }
    });

    loadOrders();
})();