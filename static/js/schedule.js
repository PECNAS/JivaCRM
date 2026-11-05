(function() {
    const VIEW_STORAGE_KEY = 'jiva_schedule_view';
    const PAST_STORAGE_KEY = 'jiva_schedule_show_past';
    const MONTH_STORAGE_KEY = 'jiva_schedule_month';

    function readStoredMonth() {
        try {
            const raw = localStorage.getItem(MONTH_STORAGE_KEY);

            if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return null;

            const parts = raw.split('-');
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        } catch (error) {
            return null;
        }
    }

    function storeMonth(value) {
        try {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            localStorage.setItem(MONTH_STORAGE_KEY, `${year}-${month}`);
        } catch (error) {}
    }

    let currentView = localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'calendar';
    let currentOrders = [];
    let calendarDate = readStoredMonth() || new Date();
    let activeOrderId = null;
    let statusColors = {};
    let showPastCompleted = false;
    let myOrdersOnly = true;
    let selectedClientId = '';
    let selectedClientName = '';
    let clientFilterTimer = null;

    const MY_ORDERS_STORAGE_KEY = 'jiva_schedule_my_orders';

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
    const clientFilterInput = document.getElementById('dashboardClientFilter');
    const clientFilterDropdown = document.getElementById('dashboardClientDropdown');
    const clientFilterClear = document.getElementById('dashboardClientClear');
    const sortSelect = document.getElementById('dashboardSort');
    const statusSelect = document.getElementById('dashboardStatus');
    const pastCompletedToggle = document.getElementById('pastCompletedToggle');
    const calendarFilters = document.getElementById('dashboardCalendarFilters');
    const calendarStatusSelect = document.getElementById('calendarStatus');
    const calendarFilledSelect = document.getElementById('calendarFilled');
    const calendarPastToggle = document.getElementById('calendarPastToggle');
    const dashboardFilters = document.getElementById('dashboardFilters');
    const dashboardList = document.getElementById('dashboardList');
    const dashboardCalendar = document.getElementById('dashboardCalendar');
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarNotice = document.getElementById('calendarNotice');
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

    const eventChecklistModal = document.getElementById('eventChecklistModal');
    const eventChecklistTitle = document.getElementById('eventChecklistTitle');
    const eventChecklistProgress = document.getElementById('eventChecklistProgress');
    const eventChecklistList = document.getElementById('eventChecklistList');
    const eventModalChecklistBtn = document.getElementById('eventModalChecklistBtn');
    const eventChecklistCloseBtn = document.getElementById('eventChecklistCloseBtn');
    const eventChecklistCloseBtnFooter = document.getElementById('eventChecklistCloseBtnFooter');

    let checklistState = { orderId: null, groups: [], can_edit: false, total: 0, done: 0 };
    let checklistExpanded = {};
    let checklistLoading = false;

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
        return window.formatMoney(value);
    }

    const MONTHS_GENITIVE = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];

    function formatDate(dateStr) {
        if (!dateStr) return '';

        const parts = dateStr.split('-');

        if (parts.length !== 3) return dateStr;

        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (!year || !month || !day) return dateStr;

        const label = day + ' ' + MONTHS_GENITIVE[month - 1];
        const today = new Date();

        if (year !== today.getFullYear()) {
            return label + ' ' + String(year).slice(2);
        }

        return label;
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

    function serviceLabel(service) {
        if (!service) return '';

        if (typeof service === 'string') return service;

        const name = service.name || '';

        if (service.people_count_unknown || !service.people_count) {
            return name;
        }

        return name + ' ' + service.people_count;
    }

    function getServicesLabel(order) {
        if (!order.services || order.services.length === 0) return '';

        const first = serviceLabel(order.services[0]);

        if (order.services.length === 1) return first;

        return first + ' ...';
    }

    function getRole() {
        return document.body.dataset.role || '';
    }

    function canSeeCost() {
        const role = getRole();

        return role !== 'artist' && role !== 'art_tech' && role !== 'technician';
    }

    function canSeeRates() {
        const role = getRole();

        return role === 'boss' || role === 'senior_admin';
    }

    function canOpenOrders() {
        const role = getRole();
        return role === 'senior_admin'
            || role === 'boss'
            || role === 'manager'
            || role === 'sales_manager'
            || role === 'production'
            || role === 'choreographer';
    }

    function canManageOrders() {
        return document.body.dataset.canManageOrders === '1';
    }

    function openOrderEditor(orderId) {
        if (!orderId || !window.openOrderEditor) return false;

        return window.openOrderEditor(orderId);
    }

    function handleOrderOpen(orderId) {
        if (canManageOrders() && openOrderEditor(orderId)) {
            return;
        }

        const order = currentOrders.find(item => String(item.id) === String(orderId));

        if (order) {
            markOrderViewed(order.id, order.updated_at);
            renderEventModal(order);
        }
    }

    function getEventStyle(status) {
        const c = statusColors['order:' + status];

        if (!c) return '';

        return `background:${c.background}2e; border-left-color:${c.border}; color:#f5efe7;`;
    }

    function modalTitleLine(order) {
        const dateLabel = order.has_date ? formatDate(order.date) : 'Без даты';
        const city = (order.city_name || '').trim();

        return city ? `${dateLabel}, ${city}` : dateLabel;
    }

    function modalShowsLine(order) {
        const services = order.services || [];

        if (!services.length) return '';

        return services.map(item => serviceLabel(item)).filter(Boolean).join(', ');
    }

    function modalStaffHtml(order) {
        const staff = order.staff || [];

        if (!staff.length) {
            return '<div class="event-modal__staff-empty">Сотрудники не назначены</div>';
        }

        return staff.map(item => {
            const parts = [];

            if (item.show_name) parts.push(escapeHtml(item.show_name));
            if (item.role_label) parts.push(escapeHtml(item.role_label));
            if (item.comment) parts.push(`<span class="event-modal__staff-comment">${escapeHtml(item.comment)}</span>`);

            return `
                <div class="event-modal__staff-row">
                    <span class="event-modal__staff-name">${escapeHtml(item.name)}</span>
                    ${item.is_responsible ? '<span class="event-modal__staff-badge">Отв.</span>' : ''}
                    ${parts.length ? `<span class="event-modal__staff-meta">${parts.join(' · ')}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    function renderEventModal(order) {
        if (!order) return;

        eventModalTitle.textContent = order.name || 'Заказ';

        const changedBanner = isOrderChanged(order)
            ? '<div class="event-modal__banner event-modal__banner--changed">Информация о заказе изменена</div>'
            : '';

        const incompleteBanner = isOrderIncomplete(order)
            ? `<div class="event-modal__banner event-modal__banner--incomplete">Заказ заполнен не полностью: ${escapeHtml((order.missing_fields || []).join(', '))}</div>`
            : '';

        const showsLine = modalShowsLine(order);

        const canEditOrder = canManageOrders();

        const clientHtml = order.client_id && canEditOrder
            ? `<a href="/clients/?open_client=${order.client_id}" class="event-modal__client">${escapeHtml(order.client || '—')}</a>`
            : `<span class="event-modal__client event-modal__client--plain">${escapeHtml(order.client || '—')}</span>`;
        const addressClass = order.address
            ? 'event-modal__address'
            : 'event-modal__address event-modal__address--empty';

        const addressHtml = canEditOrder
            ? `<div class="${addressClass} event-modal__editable" data-edit-field="address" data-order-id="${order.id}" title="Двойной клик для редактирования">${escapeHtml(order.address || 'Адрес не указан')}</div>`
            : `<div class="${addressClass}">${escapeHtml(order.address || 'Адрес не указан')}</div>`;

        const managerHtml = order.manager
            ? `<div class="event-modal__manager">Менеджер: <b>${escapeHtml(order.manager)}</b></div>`
            : '';

        const costHtml = canSeeCost() && order.cost && order.cost !== '—'
            ? `<div class="event-modal__money">Стоимость: <b>${escapeHtml(order.cost)}</b></div>`
            : '';

        const paymentHtml = canSeeRates() && order.my_payment !== undefined && order.my_payment > 0
            ? `<div class="event-modal__money">Моя оплата: <b>${formatPrice(order.my_payment)}</b></div>`
            : '';

        const checklistHtml = order.checklist_total
            ? `<div class="event-modal__checklist-line">Чек-лист: <b>${order.checklist_done} из ${order.checklist_total}</b></div>`
            : '';

        eventModalBody.innerHTML = `
            ${changedBanner}
            ${incompleteBanner}
            <div class="event-modal__head">
                <div class="event-modal__head-date${canEditOrder ? ' event-modal__editable' : ''}"${canEditOrder ? ` data-edit-field="date" data-order-id="${order.id}" title="Двойной клик для редактирования"` : ''}>${escapeHtml(modalTitleLine(order))}</div>
                <div class="event-modal__head-client">${clientHtml}</div>
                ${showsLine ? `<div class="event-modal__head-shows">${escapeHtml(showsLine)}</div>` : ''}
                ${addressHtml}
                ${managerHtml}
                ${costHtml}
                ${paymentHtml}
                ${checklistHtml}
            </div>
            <div class="event-modal__section">
                <div class="event-modal__section-title">Сотрудники</div>
                <div class="event-modal__staff">${modalStaffHtml(order)}</div>
            </div>
            <div class="event-modal__status-line">
                <span class="order-row__status order-row__status--${order.status}">${getStatusLabel(order.status)}</span>
            </div>
        `;

        if (eventModalDetailsBtn) {
            eventModalDetailsBtn.style.display = canOpenOrders() ? '' : 'none';
        }

        if (eventModalChecklistBtn) {
            eventModalChecklistBtn.style.display = '';
            updateChecklistButton(order);
        }

        activeOrderId = order.id;
        eventModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        attachInlineEdit();
    }

    function attachInlineEdit() {
        if (!eventModalBody) return;

        eventModalBody.querySelectorAll('.event-modal__editable').forEach(node => {
            node.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (this.querySelector('input')) return;

                startInlineEdit(this);
            });
        });
    }

    function startInlineEdit(node) {
        const field = node.dataset.editField;
        const orderId = node.dataset.orderId;
        const order = currentOrders.find(item => String(item.id) === String(orderId));

        if (!order || !canOpenOrders()) return;

        const currentValue = field === 'date' ? (order.date || '') : (order.address || '');
        const input = document.createElement('input');

        input.type = field === 'date' ? 'date' : 'text';
        input.className = 'event-modal__inline-input';
        input.value = currentValue;

        node.textContent = '';
        node.appendChild(input);
        input.focus();

        let cancelled = false;

        const commit = function() {
            if (cancelled) return;

            const value = input.value.trim();

            if (value === currentValue) {
                renderEventModal(order);
                return;
            }

            const body = new URLSearchParams({
                name: order.name || '',
                client_id: String(order.client_id || ''),
                status: order.status || 'request',
                cost: order.cost || '',
                address: field === 'address' ? value : (order.address || ''),
                date: field === 'date' ? value : (order.date || ''),
            });

            fetch('/orders/' + orderId + '/update/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': window.UI.getCSRFToken(),
                },
                body: body,
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    window.UI.showToast(data.error);
                    renderEventModal(order);
                    return;
                }

                window.UI.showToast('Изменения сохранены');

                if (window.refreshSchedule) window.refreshSchedule();

                if (data.order) {
                    Object.assign(order, {
                        name: data.order.name,
                        address: data.order.address,
                        date: data.order.date,
                        has_date: !!data.order.date,
                        city_name: data.order.city_name,
                        status: data.order.status,
                    });

                    order.date_display = data.order.date_display;
                    renderEventModal(order);
                }
            })
            .catch(() => {
                window.UI.showToast('Не удалось сохранить');
                renderEventModal(order);
            });
        };

        input.addEventListener('blur', commit);

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }

            if (e.key === 'Escape') {
                cancelled = true;
                e.stopPropagation();
                renderEventModal(order);
            }
        });
    }

    function closeEventModal() {
        eventModal.classList.remove('active');
        document.body.style.overflow = '';
        activeOrderId = null;
    }

    function closeEventChecklist() {
        if (eventChecklistModal) eventChecklistModal.classList.remove('active');
        checklistState = { orderId: null, groups: [], can_edit: false, total: 0, done: 0 };
    }

    function checklistGroupKey(group) {
        return String(group.template_id || 'none');
    }

    function renderEventChecklist() {
        if (!eventChecklistList) return;

        const groups = checklistState.groups || [];
        const total = checklistState.total || 0;
        const done = checklistState.done || 0;
        const percent = total ? Math.round((done / total) * 100) : 0;

        if (eventChecklistProgress) {
            eventChecklistProgress.innerHTML = total
                ? `<div class="order-checklist__bar"><span style="width:${percent}%"></span></div><span class="order-checklist__count">Выполнено ${done} из ${total}</span>`
                : '<span class="order-checklist__count">Чек-листов в заказе нет</span>';
        }

        if (!groups.length) {
            eventChecklistList.innerHTML = '<div class="order-checklist__empty">Чек-листов пока нет</div>';
            return;
        }

        const canEdit = !!checklistState.can_edit;

        eventChecklistList.innerHTML = groups.map(group => {
            const key = checklistGroupKey(group);
            const expanded = !!checklistExpanded[key];
            const groupPercent = group.total ? Math.round((group.done / group.total) * 100) : 0;

            const renderItem = function(item) {
                return `
                    <div class="order-checklist__row ${item.is_done ? 'order-checklist__row--done' : ''}">
                        <label class="order-checklist__check">
                            <input type="checkbox" data-event-checklist-toggle="${item.id}" ${item.is_done ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
                        </label>
                        <span class="order-checklist__text">${escapeHtml(item.body || item.text)}</span>
                    </div>
                `;
            };

            const groupSections = group.sections || [{ title: '', items: group.items, total: group.total, done: group.done }];
            const hasGroupSections = groupSections.some(section => section.title);

            const rows = hasGroupSections
                ? groupSections.map((section, sectionIndex) => {
                    const sectionPercent = section.total ? Math.round((section.done / section.total) * 100) : 0;

                    return `
                        <div class="order-checklist__section">
                            <div class="order-checklist__section-head">
                                ${section.title ? `<span class="order-checklist__section-num">${sectionIndex + 1}</span>` : ''}
                                <span class="order-checklist__section-title">${escapeHtml(section.title || 'Прочее')}</span>
                                <span class="order-checklist__section-progress">
                                    <span class="order-checklist__section-bar"><span style="width:${sectionPercent}%"></span></span>
                                    <span class="order-checklist__section-count">${section.done}/${section.total}</span>
                                </span>
                            </div>
                            <div class="order-checklist__section-body">${section.items.map(renderItem).join('')}</div>
                        </div>
                    `;
                }).join('')
                : group.items.map(renderItem).join('');

            return `
                <div class="order-checklist__card ${expanded ? 'order-checklist__card--open' : ''}">
                    <div class="order-checklist__card-head" data-event-checklist-open="${key}">
                        <span class="order-checklist__chevron">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </span>
                        <span class="order-checklist__card-title">${escapeHtml(group.name)}</span>
                        <span class="order-checklist__card-progress">
                            <span class="order-checklist__card-bar"><span style="width:${groupPercent}%"></span></span>
                            <span class="order-checklist__count">${group.done} из ${group.total}</span>
                        </span>
                    </div>
                    ${expanded ? `<div class="order-checklist__card-body">${rows || '<div class="order-checklist__empty">Пунктов нет</div>'}</div>` : ''}
                </div>
            `;
        }).join('');

        eventChecklistList.querySelectorAll('[data-event-checklist-open]').forEach(node => {
            node.addEventListener('click', function() {
                const key = this.dataset.eventChecklistOpen;

                if (checklistExpanded[key]) {
                    delete checklistExpanded[key];
                } else {
                    checklistExpanded[key] = true;
                }

                renderEventChecklist();
            });
        });

        eventChecklistList.querySelectorAll('[data-event-checklist-toggle]').forEach(input => {
            input.addEventListener('click', function(e) {
                e.stopPropagation();
            });

            input.addEventListener('change', function() {
                toggleEventChecklistItem(this.dataset.eventChecklistToggle);
            });
        });
    }

    function toggleEventChecklistItem(itemId) {
        if (!checklistState.orderId) return;

        const orderId = checklistState.orderId;

        const body = new URLSearchParams({ action: 'toggle', id: itemId });

        fetch(`/orders/${orderId}/checklist/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': window.UI.getCSRFToken(),
            },
            body: body,
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    window.UI.showToast(data.error);
                    return;
                }

                applyEventChecklist(data.checklist);
                syncOrderChecklistCounters(orderId, data.checklist);
            })
            .catch(() => window.UI.showToast('Не удалось сохранить чек-лист'));
    }

    function syncOrderChecklistCounters(orderId, checklist) {
        if (!checklist) return;

        const order = currentOrders.find(item => String(item.id) === String(orderId));

        if (!order) return;

        order.checklist_total = checklist.total || 0;
        order.checklist_done = checklist.done || 0;

        const label = eventModalChecklistBtn ? eventModalChecklistBtn.querySelector('.event-checklist-btn__count') : null;

        if (eventModalChecklistBtn) {
            updateChecklistButton(order);
        }
    }

    function updateChecklistButton(order) {
        if (!eventModalChecklistBtn) return;

        let counter = eventModalChecklistBtn.querySelector('.event-checklist-btn__count');

        if (!counter) {
            counter = document.createElement('span');
            counter.className = 'event-checklist-btn__count';
            eventModalChecklistBtn.appendChild(counter);
        }

        const total = order.checklist_total || 0;
        const done = order.checklist_done || 0;

        counter.textContent = total ? `${done}/${total}` : '';
        eventModalChecklistBtn.classList.toggle('btn--attention', total > 0 && done < total);
    }

    function applyEventChecklist(data) {
        if (!data) return;

        checklistState = {
            orderId: checklistState.orderId,
            groups: data.groups || [],
            can_edit: !!data.can_edit,
            total: data.total || 0,
            done: data.done || 0,
        };

        renderEventChecklist();
    }

    function openEventChecklist() {
        if (!eventChecklistModal || !activeOrderId) return;

        const order = currentOrders.find(item => String(item.id) === String(activeOrderId));

        checklistState = { orderId: activeOrderId, groups: [], can_edit: false, total: 0, done: 0 };
        checklistExpanded = {};
        checklistLoading = true;

        if (eventChecklistTitle) {
            eventChecklistTitle.textContent = order ? `Чек-лист · ${order.name || ''}` : 'Чек-лист';
        }

        if (eventChecklistList) {
            eventChecklistList.innerHTML = '<div class="order-checklist__empty">Загрузка...</div>';
        }

        if (eventChecklistProgress) {
            eventChecklistProgress.innerHTML = '';
        }

        eventChecklistModal.classList.add('active');

        fetch(`/orders/${activeOrderId}/checklist/`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                checklistLoading = false;

                if (data.error) {
                    eventChecklistList.innerHTML = `<div class="order-checklist__empty">${escapeHtml(data.error)}</div>`;
                    return;
                }

                (data.groups || []).forEach(group => {
                    checklistExpanded[checklistGroupKey(group)] = true;
                });

                applyEventChecklist(data);
                syncOrderChecklistCounters(activeOrderId, data);
            })
            .catch(() => {
                checklistLoading = false;

                if (eventChecklistList) {
                    eventChecklistList.innerHTML = '<div class="order-checklist__empty">Не удалось загрузить чек-лист</div>';
                }
            });
    }

    function compareRu(a, b) {
        return String(a || '').toLowerCase().localeCompare(String(b || '').toLowerCase(), 'ru');
    }

    function sortByDate(result, sort) {
        result.sort((a, b) => {
            const aHasDate = !!a.has_date;
            const bHasDate = !!b.has_date;

            if (aHasDate !== bHasDate) {
                return aHasDate ? 1 : -1;
            }

            if (sort === 'date_asc') {
                return (a.date || '').localeCompare(b.date || '');
            }

            return (b.date || '').localeCompare(a.date || '');
        });

        return result;
    }

    function applyListFilters(orders) {
        const search = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const clientValue = selectedClientId
            ? (selectedClientName || '').toLowerCase()
            : (clientFilterInput ? clientFilterInput.value : '').trim().toLowerCase();
        const status = statusSelect ? statusSelect.value : 'all';
        const sort = sortSelect ? sortSelect.value : 'date_desc';

        let result = orders.slice();

        if (!showPastCompleted) {
            result = result.filter(o => !isPastCompleted(o));
        }

        if (search) {
            result = result.filter(o =>
                (o.name && o.name.toLowerCase().includes(search)) ||
                (o.client && o.client.toLowerCase().includes(search))
            );
        }

        if (clientValue) {
            result = result.filter(o => String(o.client || '').toLowerCase().includes(clientValue));
        }

        if (status !== 'all') {
            result = result.filter(o => o.status === status);
        }

        return sortByDate(result, sort);
    }

    function applyCalendarFilters(orders) {
        const status = calendarStatusSelect ? calendarStatusSelect.value : 'all';
        const filled = calendarFilledSelect ? calendarFilledSelect.value : 'all';
        const showPast = calendarPastToggle ? calendarPastToggle.checked : false;

        let result = orders.slice();

        if (!showPast) {
            result = result.filter(o => !isPastCompleted(o));
        }

        if (status !== 'all') {
            result = result.filter(o => o.status === status);
        }

        if (filled === 'full') {
            result = result.filter(o => !o.is_incomplete);
        } else if (filled === 'partial') {
            result = result.filter(o => !!o.is_incomplete);
        }

        return sortByDate(result, 'date_asc');
    }

    function applyFiltersAndSort(orders) {
        return currentView === 'list' ? applyListFilters(orders) : applyCalendarFilters(orders);
    }

    function listDateLabel(order) {
        if (!order.has_date) return 'Дата не указана';

        const label = formatDate(order.date);

        if (order.duration && order.duration > 1) {
            return `${label} · ${order.duration} дн.`;
        }

        return label;
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

            pastHtml += sorted.map(order => renderOrderRow(order, 'order-row--past')).join('');

            dashboardList.innerHTML = pastHtml;

            attachOrderRowEvents();
            return;
        }

        const withoutDate = filtered.filter(o => !o.has_date);
        const withDate = filtered.filter(o => o.has_date);

        let html = '';

        if (withoutDate.length) {
            const noDateCollapsed = isNoDateCollapsed();

            html += `
                <button type="button" class="schedule-list-section schedule-list-section--toggle ${noDateCollapsed ? 'schedule-list-section--collapsed' : ''}" id="noDateToggle">
                    <span class="schedule-list-section__chevron">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </span>
                    <span>Без даты</span>
                    <span class="schedule-list-section__count">${withoutDate.length}</span>
                </button>
            `;

            if (!noDateCollapsed) {
                html += withoutDate.map(order => renderOrderRow(order, 'order-row--no-date-zone')).join('');
            }
        }

        if (withDate.length) {
            html += '<div class="schedule-list-section">С датой</div>';
            html += withDate.map(order => renderOrderRow(order, '')).join('');
        }

        dashboardList.innerHTML = html;

        const noDateToggle = document.getElementById('noDateToggle');

        if (noDateToggle) {
            noDateToggle.addEventListener('click', function() {
                toggleNoDateCollapsed();
                renderList();
            });
        }

        attachOrderRowEvents();
    }

    const NO_DATE_COLLAPSED_KEY = 'jiva_schedule_no_date_collapsed';

    function isNoDateCollapsed() {
        return localStorage.getItem(NO_DATE_COLLAPSED_KEY) === '1';
    }

    function toggleNoDateCollapsed() {
        const next = isNoDateCollapsed() ? '0' : '1';

        try {
            localStorage.setItem(NO_DATE_COLLAPSED_KEY, next);
        } catch (error) {}
    }

    function attachOrderRowEvents() {
        dashboardList.querySelectorAll('.order-row').forEach(row => {
            row.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-order-id'));

                if (id) handleOrderOpen(id);
            });
        });

        dashboardList.querySelectorAll('[data-client-id]').forEach(node => {
            if (!node.dataset.clientId) return;

            node.addEventListener('click', function(e) {
                e.stopPropagation();
                window.location.href = '/clients/?open_client=' + encodeURIComponent(this.dataset.clientId);
            });
        });
    }

    function renderOrderRow(order, extra) {
        const showMyPayment = canSeeRates() && order.my_payment !== undefined && order.my_payment !== null;

        const costCell = showMyPayment
            ? formatPrice(order.my_payment)
            : (canSeeCost() && order.cost ? order.cost : '—');

        const managerBadge = isOrderChanged(order)
            ? '<span class="order-row__badge">Обновлено</span>'
            : '';

        const managerHtml = `<span class="order-row__manager">${escapeHtml(order.manager || '—')}</span>${managerBadge}`;

        const incompleteBadge = isOrderIncomplete(order)
            ? '<span class="order-row__dot" title="Заполнено не полностью"></span>'
            : '';

        const missingTitle = getMissingTitle(order);

        const servicesText = (order.services || [])
            .map(item => {
                if (!item) return '';
                if (typeof item === 'string') return item;

                const name = item.name || '';

                if (item.people_count_unknown || !item.people_count) return name;

                return `${name} ${item.people_count}`;
            })
            .filter(Boolean)
            .join(' · ');

        const checklistLabel = order.checklist_total
            ? `${order.checklist_done || 0}/${order.checklist_total}`
            : '';

        return `
            <div class="${getRowClasses(order, extra)}" data-order-id="${order.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                <div class="order-row__head">
                    <span class="order-row__cell order-row__name">
                        ${escapeHtml(getOrderName(order))}${incompleteBadge}
                    </span>
                    <span class="order-row__status">${escapeHtml(getStatusLabel(order.status))}</span>
                </div>
                <div class="order-row__meta">
                    <span class="order-row__meta-item order-row__client-link" data-client-id="${order.client_id || ''}" title="Открыть карточку клиента">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        ${escapeHtml(order.client || '—')}
                    </span>
                </div>
                ${servicesText ? `<div class="order-row__services">${escapeHtml(servicesText)}</div>` : ''}
                <div class="order-row__foot">
                    <span class="order-row__cell order-row__cost">${costCell}</span>
                    <span class="order-row__manager-cell">${managerHtml}</span>
                    ${checklistLabel ? `<span class="order-row__checklist" title="Чек-лист">${checklistLabel}</span>` : ''}
                </div>
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

        const hasSearch = (searchInput.value || '').trim().length > 0;
        const hasStatusFilter = statusSelect.value !== 'all';

        const monthEvents = filtered.filter(o => {
            if (!o.has_date) return false;

            const start = parseDate(o.date);
            const end = new Date(start);
            end.setDate(end.getDate() + (o.duration || 1) - 1);

            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month, daysInMonth);

            return start <= monthEnd && end >= monthStart;
        });

        const emptyNotice = (hasSearch || hasStatusFilter) && monthEvents.length === 0
            ? `<div class="calendar-search-empty">${hasSearch ? 'По запросу «' + escapeHtml(searchInput.value.trim()) + '»' : 'По выбранному статусу'} в этом месяце ничего не найдено</div>`
            : '';

        if (emptyNotice) {
            calendarNotice.innerHTML = emptyNotice;
        } else {
            calendarNotice.innerHTML = '';
        }

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
            const cellDateObj = new Date(year, month, dayNumber);
            const cellDateValue = isCurrentMonth
                ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
                : `${cellDateObj.getFullYear()}-${String(cellDateObj.getMonth() + 1).padStart(2, '0')}-${String(cellDateObj.getDate()).padStart(2, '0')}`;
            html += `
                <div class="${cellClass}" data-date="${cellDateValue}">
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

                if (id) handleOrderOpen(id);
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
        const toolbar = document.querySelector('.dashboard-toolbar');

        if (currentView === 'list') {
            dashboardList.style.display = 'flex';
            dashboardCalendar.style.display = 'none';
            renderList();

            if (dashboardFilters) dashboardFilters.style.display = 'flex';
            if (calendarFilters) calendarFilters.style.display = 'none';
            if (toolbar) toolbar.classList.add('dashboard-toolbar--list');
        } else {
            dashboardList.style.display = 'none';
            dashboardCalendar.style.display = 'block';
            renderCalendar();

            if (dashboardFilters) dashboardFilters.style.display = 'none';
            if (calendarFilters) calendarFilters.style.display = 'flex';
            if (toolbar) toolbar.classList.remove('dashboard-toolbar--list');
        }
    }

    function applyInitialView() {
        document.querySelectorAll('.view-switch__btn').forEach(b => {
            b.classList.toggle('active', b.dataset.view === currentView);
        });
    }

    function isOnlyMyOrders() {
        if (!myOrdersOnlyToggle) return false;
        return myOrdersOnlyToggle.checked;
    }

    function loadOrders() {
        let url = '/orders/list/?status=all';

        if (isOnlyMyOrders()) {
            url = '/schedule/my-orders/';
        }

        fetch(url, { cache: 'no-store' })
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

    const REFRESH_INTERVAL_MS = 30000;
    let refreshTimer = null;

    function silentRefresh(force) {
        if (document.hidden) return;

        if (!force) {
            if (document.body.classList.contains('modal-lock')) return;

            const openModal = document.querySelector('.modal-overlay.active');

            if (openModal) return;
        }

        let url = '/orders/list/?status=all';

        if (isOnlyMyOrders()) {
            url = '/schedule/my-orders/';
        }

        fetch(url, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.error) return;

                const next = data.orders || [];

                if (JSON.stringify(next) === JSON.stringify(currentOrders)) {
                    return;
                }

                currentOrders = next;
                statusColors = data.colors || {};
                render();
            })
            .catch(() => {});
    }

    function startAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }

        refreshTimer = setInterval(silentRefresh, REFRESH_INTERVAL_MS);

        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) silentRefresh();
        });
    }

    window.refreshSchedule = silentRefresh;

    if (pastCompletedToggle) {
        pastCompletedToggle.checked = getShowPastPreference();
        showPastCompleted = pastCompletedToggle.checked;
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
        let storedPreference = '1';

        try {
            const raw = localStorage.getItem(MY_ORDERS_STORAGE_KEY);

            if (raw !== null) storedPreference = raw;
        } catch (error) {}

        myOrdersOnlyToggle.checked = storedPreference !== '0';
        myOrdersOnly = myOrdersOnlyToggle.checked;

        myOrdersOnlyToggle.addEventListener('change', function() {
            myOrdersOnly = this.checked;

            try {
                localStorage.setItem(MY_ORDERS_STORAGE_KEY, this.checked ? '1' : '0');
            } catch (error) {}

            loadOrders();
        });
    }

    if (isOnlyMyOrders() && dashboardFilters) {
        dashboardFilters.classList.add('open');
    }

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(render, 300);
    });

    sortSelect.addEventListener('change', render);
    statusSelect.addEventListener('change', render);

    calendarPrev.addEventListener('click', function() {
        calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
        storeMonth(calendarDate);
        renderCalendar();
    });

    calendarNext.addEventListener('click', function() {
        calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
        storeMonth(calendarDate);
        renderCalendar();
    });

    if (contextMenu) {
        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', function() {
                const action = this.dataset.action;
                const dateStr = contextMenu.dataset.date || '';
                hideContextMenu();
                if (action === 'create-order') {
                    if (window.openCreateOrderModal) {
                        window.openCreateOrderModal(dateStr);
                    }
                } else if (action === 'create-training') {
                    window.UI.showToast('Создание тренировки — функция в разработке');
                } else if (action === 'create-availability') {
                    if (window.openAvailabilityModal) window.openAvailabilityModal(dateStr);
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

            if (openOrderEditor(activeOrderId)) {
                closeEventModal();
                return;
            }

            window.location.href = `/schedule/`;
        });
    }

    if (eventModalChecklistBtn) {
        eventModalChecklistBtn.addEventListener('click', openEventChecklist);
    }

    if (eventChecklistCloseBtn) {
        eventChecklistCloseBtn.addEventListener('click', closeEventChecklist);
    }

    if (eventChecklistCloseBtnFooter) {
        eventChecklistCloseBtnFooter.addEventListener('click', closeEventChecklist);
    }

    if (eventChecklistModal) {
        eventChecklistModal.addEventListener('click', function(e) {
            if (e.target === this) closeEventChecklist();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (e.defaultPrevented) return;

        if (eventChecklistModal && eventChecklistModal.classList.contains('active')) {
            e.preventDefault();
            closeEventChecklist();
            return;
        }

        if (eventModal && eventModal.classList.contains('active')) {
            e.preventDefault();
            closeEventModal();
        }
    });

    function closeClientFilterDropdown() {
        if (!clientFilterDropdown) return;

        clientFilterDropdown.classList.remove('open');
        clientFilterDropdown.innerHTML = '';
    }

    function renderClientFilterDropdown(query) {
        if (!clientFilterDropdown) return;

        const value = (query || '').toLowerCase().trim();
        const seen = new Set();
        const clients = [];

        currentOrders.forEach(order => {
            const name = order.client || '';

            if (!name || seen.has(name)) return;

            if (value && !name.toLowerCase().includes(value)) return;

            seen.add(name);
            clients.push({ id: order.client_id || '', name: name });
        });

        if (!clients.length) {
            clientFilterDropdown.innerHTML = '<div class="dashboard-client-empty">Клиенты не найдены</div>';
            clientFilterDropdown.classList.add('open');
            return;
        }

        clientFilterDropdown.innerHTML = clients.slice(0, 40).map(client => `
            <button type="button" class="client-combobox__option" data-client-name="${window.UI.escapeHtml(client.name)}" data-client-id="${client.id}">
                <span class="client-combobox__name">${window.UI.escapeHtml(client.name)}</span>
            </button>
        `).join('');

        clientFilterDropdown.classList.add('open');

        clientFilterDropdown.querySelectorAll('[data-client-name]').forEach(btn => {
            btn.addEventListener('mousedown', function(e) {
                e.preventDefault();

                selectedClientId = this.dataset.clientId || '';
                selectedClientName = this.dataset.clientName || '';

                if (clientFilterInput) clientFilterInput.value = selectedClientName;
                if (clientFilterClear) clientFilterClear.style.display = '';

                closeClientFilterDropdown();
                render();
            });
        });
    }

    if (clientFilterInput) {
        clientFilterInput.addEventListener('focus', function() {
            renderClientFilterDropdown(this.value);
        });

        clientFilterInput.addEventListener('input', function() {
            selectedClientId = '';
            selectedClientName = '';
            if (clientFilterClear) clientFilterClear.style.display = this.value ? '' : 'none';

            renderClientFilterDropdown(this.value);

            clearTimeout(clientFilterTimer);
            clientFilterTimer = setTimeout(render, 300);
        });

        clientFilterInput.addEventListener('blur', function() {
            setTimeout(closeClientFilterDropdown, 120);
        });
    }

    if (clientFilterClear) {
        clientFilterClear.addEventListener('click', function() {
            selectedClientId = '';
            selectedClientName = '';

            if (clientFilterInput) clientFilterInput.value = '';

            this.style.display = 'none';
            closeClientFilterDropdown();
            render();
        });
    }

    if (searchInput) searchInput.addEventListener('input', render);
    if (statusSelect) statusSelect.addEventListener('change', render);
    if (sortSelect) sortSelect.addEventListener('change', render);

    if (pastCompletedToggle) {
        pastCompletedToggle.addEventListener('change', function() {
            showPastCompleted = this.checked;
            setShowPastPreference(this.checked);
            render();
        });
    }

    if (calendarStatusSelect) calendarStatusSelect.addEventListener('change', render);
    if (calendarFilledSelect) calendarFilledSelect.addEventListener('change', render);
    if (calendarPastToggle) calendarPastToggle.addEventListener('change', render);

    document.addEventListener('click', function(e) {
        if (!clientFilterInput) return;

        const wrapper = clientFilterInput.closest('.dashboard-client-search');

        if (wrapper && !wrapper.contains(e.target)) closeClientFilterDropdown();
    });

    const availabilityModal = document.getElementById('availabilityModal');
    const availabilityDate = document.getElementById('availabilityDate');
    const availabilityEmployee = document.getElementById('availabilityEmployee');
    const availabilityAction = document.getElementById('availabilityAction');
    const availabilityTimeGroup = document.getElementById('availabilityTimeGroup');
    const availabilityStart = document.getElementById('availabilityStart');
    const availabilityEnd = document.getElementById('availabilityEnd');
    const availabilityComment = document.getElementById('availabilityComment');
    const availabilityError = document.getElementById('availabilityError');
    const availabilitySaveBtn = document.getElementById('availabilitySaveBtn');
    const availabilityCloseBtn = document.getElementById('availabilityCloseBtn');
    const availabilityCancelBtn = document.getElementById('availabilityCancelBtn');

    function openAvailabilityModal(dateStr) {
        if (!availabilityModal) return;

        availabilityModal.classList.add('active');
        document.body.classList.add('modal-lock');

        if (availabilityDate) availabilityDate.value = dateStr || '';
        if (availabilityAction) availabilityAction.value = 'off';
        if (availabilityTimeGroup) availabilityTimeGroup.style.display = 'none';
        if (availabilityComment) availabilityComment.value = '';
        if (availabilityError) availabilityError.style.display = 'none';

        if (availabilityEmployee && !availabilityEmployee.dataset.loaded) {
            fetch('/employees/list/?limit=200', { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    const list = data.employees || [];

                    availabilityEmployee.innerHTML = list.map(emp =>
                        '<option value="' + emp.id + '">' + escapeHtml(emp.display_name || emp.full_name) + '</option>'
                    ).join('');

                    availabilityEmployee.dataset.loaded = '1';
                })
                .catch(() => {});
        }
    }

    function closeAvailabilityModal() {
        if (!availabilityModal) return;

        availabilityModal.classList.remove('active');
        document.body.classList.remove('modal-lock');
    }

    function saveAvailability() {
        if (!availabilityDate || !availabilityEmployee) return;

        const employeeId = availabilityEmployee.value;
        const dateStr = availabilityDate.value;
        const action = availabilityAction ? availabilityAction.value : 'off';

        if (!employeeId || !dateStr) {
            if (availabilityError) {
                availabilityError.textContent = 'Выберите сотрудника и дату';
                availabilityError.style.display = 'block';
            }
            return;
        }

        const body = new URLSearchParams({
            employee_id: employeeId,
            kind: 'exception',
            action: action,
            start_date: dateStr,
            end_date: dateStr,
            comment: availabilityComment ? availabilityComment.value.trim() : '',
        });

        if (action === 'partial') {
            const start = availabilityStart ? availabilityStart.value : '';
            const end = availabilityEnd ? availabilityEnd.value : '';

            if (!start || !end) {
                if (availabilityError) {
                    availabilityError.textContent = 'Укажите время начала и окончания';
                    availabilityError.style.display = 'block';
                }
                return;
            }

            body.set('intervals', JSON.stringify([{ start: start, end: end }]));
        }

        window.UI.setButtonBusy(availabilitySaveBtn, true, 'Сохранение...');

        fetch('/schedule/availability/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': window.UI.getCSRFToken(),
            },
            body: body,
        })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                if (availabilityError) {
                    availabilityError.textContent = data.error;
                    availabilityError.style.display = 'block';
                }
                return;
            }

            closeAvailabilityModal();
            window.UI.showToast('Занятость отмечена');

            if (window.refreshSchedule) window.refreshSchedule();
        })
        .catch(() => window.UI.showToast('Не удалось сохранить занятость'))
        .finally(() => {
            window.UI.setButtonBusy(availabilitySaveBtn, false);
        });
    }

    if (availabilityAction) {
        availabilityAction.addEventListener('change', function() {
            if (availabilityTimeGroup) {
                availabilityTimeGroup.style.display = this.value === 'partial' ? 'grid' : 'none';
            }
        });
    }

    if (availabilitySaveBtn) availabilitySaveBtn.addEventListener('click', saveAvailability);
    if (availabilityCloseBtn) availabilityCloseBtn.addEventListener('click', closeAvailabilityModal);
    if (availabilityCancelBtn) availabilityCancelBtn.addEventListener('click', closeAvailabilityModal);

    if (availabilityModal) {
        availabilityModal.addEventListener('click', function(e) {
            if (e.target === this) closeAvailabilityModal();
        });
    }

    window.openAvailabilityModal = openAvailabilityModal;

    const startParams = new URLSearchParams(window.location.search);
    const openingOrderId = parseInt(startParams.get('open_order'), 10);

    if (!isNaN(openingOrderId)) {
        window.history.replaceState({}, '', window.location.pathname);

        let attempts = 20;

        const openWhenReady = function() {
            if (openOrderEditor(openingOrderId) || attempts <= 0) return;

            attempts -= 1;
            setTimeout(openWhenReady, 150);
        };

        openWhenReady();
    }

    applyInitialView();
    loadOrders();
    startAutoRefresh();
})();