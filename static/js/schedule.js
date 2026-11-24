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

    let currentView = 'calendar';
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
    const eventModalBody = document.getElementById('eventModalPreviewBody');
    const eventModalCloseBtn = document.getElementById('eventModalCloseBtn');
    const eventModalDeleteBtn = document.getElementById('eventModalDeleteBtn');
    const eventModalDetailsBtn = document.getElementById('eventModalDetailsBtn');

    const eventChecklistModal = document.getElementById('eventChecklistModal');
    const eventChecklistTitle = document.getElementById('eventChecklistTitle');
    const eventChecklistProgress = document.getElementById('eventChecklistProgress');
    const eventChecklistList = document.getElementById('eventChecklistList');
    const eventModalChecklistBtn = document.getElementById('eventModalChecklistBtn');
    const eventModalCopyLinkBtn = document.getElementById('eventModalCopyLinkBtn');
    const eventChecklistCloseBtn = document.getElementById('eventChecklistCloseBtn');
    const eventChecklistCloseBtnFooter = document.getElementById('eventChecklistCloseBtnFooter');

    const calendarEventModal = document.getElementById('calendarEventModal');
    const calendarEventTitle = document.getElementById('calendarEventTitle');
    const calendarEventName = document.getElementById('calendarEventName');
    const calendarEventDate = document.getElementById('calendarEventDate');
    const calendarEventTime = document.getElementById('calendarEventTime');
    const calendarEventDescription = document.getElementById('calendarEventDescription');
    const calendarEventError = document.getElementById('calendarEventError');
    const calendarEventSaveBtn = document.getElementById('calendarEventSaveBtn');
    const calendarEventDeleteBtn = document.getElementById('calendarEventDeleteBtn');
    const calendarEventCloseBtn = document.getElementById('calendarEventCloseBtn');

    let calendarEvents = [];
    let activeCalendarEventId = null;

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

    const ALERT_ROLES = ['manager', 'boss', 'senior_admin'];

    function canSeeIncompleteAlert() {
        return ALERT_ROLES.indexOf(getRole()) !== -1;
    }

    function needsIncompleteAlert(order) {
        if (!canSeeIncompleteAlert()) return false;

        return order.status === 'confirmed' && isOrderIncomplete(order);
    }

    function getOrderNameParts(order) {
        const fullName = order.name_display || order.name || 'Без названия';

        if (!order.has_date || !order.date) {
            return { date: '', name: fullName };
        }

        const parts = order.date.split('-');

        if (parts.length !== 3) {
            return { date: '', name: fullName };
        }

        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (!year || !month || !day || month < 1 || month > 12) {
            return { date: '', name: fullName };
        }

        const stamp = String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0');
        const weekday = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(year, month - 1, day).getDay()];

        return {
            date: day + ' ' + MONTHS_GENITIVE[month - 1] + ', ' + weekday,
            name: fullName.replace(new RegExp('\\s*' + stamp.replace('.', '\\.') + '\\s*$'), '').trim(),
        };
    }

    function orderNameHtml(order) {
        const parts = getOrderNameParts(order);

        return '<span class="order-name__date">' + escapeHtml(parts.date) + '</span>'
            + '<span class="order-name__title">' + escapeHtml(parts.name) + '</span>';
    }

    function getOrderName(order) {
        const parts = getOrderNameParts(order);

        return parts.date ? parts.date + '\n' + parts.name : parts.name;
    }

    function getCalendarOrderName(order) {
        return getOrderNameParts(order).name;
    }

    function calendarOrderNameHtml(order) {
        const name = getCalendarOrderName(order);
        const city = String(order.city_name || '').trim();

        if (!order.has_date) {
            return escapeHtml(name)
                + (city ? '<span class="calendar-event__city">, ' + escapeHtml(city) + '</span>' : '')
                + '<span class="calendar-event__no-date">Без даты</span>';
        }

        return escapeHtml(name)
            + (city ? '<span class="calendar-event__city">, ' + escapeHtml(city) + '</span>' : '');
    }

    function getRowClasses(order, extra) {
        let classes = `order-row order-row--${order.status}`;

        if (extra) classes += ' ' + extra;
        if (!order.has_date) classes += ' order-row--no-date';
        if (isOrderChanged(order)) classes += ' order-row--changed';
        if (isOrderIncomplete(order)) classes += ' order-row--incomplete';
        if (needsIncompleteAlert(order)) classes += ' order-row--alert';

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

    function orderShareLink(orderId) {
        return window.location.origin + '/schedule/?order=' + encodeURIComponent(orderId);
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function(resolve, reject) {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.top = '-1000px';
            document.body.appendChild(area);
            area.select();

            try {
                const ok = document.execCommand('copy');
                document.body.removeChild(area);
                ok ? resolve() : reject(new Error('copy failed'));
            } catch (error) {
                document.body.removeChild(area);
                reject(error);
            }
        });
    }

    function copyOrderLink(orderId) {
        if (!orderId) return;

        copyTextToClipboard(orderShareLink(orderId))
            .then(function() {
                window.UI.showToast('Ссылка на заказ скопирована');
            })
            .catch(function() {
                showShareLink(orderId);
            });
    }

    function openOrderFromLink(order) {
        if (!order || !order.id) return;

        handleOrderOpen(order.id);
    }

    function openOrderByLink(orderId, attempts) {
        const linkOrder = currentOrders.find(item => String(item.id) === String(orderId));

        if (linkOrder) {
            openOrderFromLink(linkOrder);
            return;
        }

        if (attempts <= 0) {
            window.UI.showToast('Заказ не найден в расписании');
            return;
        }

        fetch('/orders/' + orderId + '/', { cache: 'no-store' })
            .then(r => r.json())
            .then(function(data) {
                if (data && !data.error && data.id) {
                    currentOrders.push(data);
                    openOrderFromLink(data);
                    return;
                }

                fetchOrdersForLink(function() {
                    openOrderByLink(orderId, attempts - 1);
                });
            })
            .catch(function() {
                fetchOrdersForLink(function() {
                    openOrderByLink(orderId, attempts - 1);
                });
            });
    }

    function showShareLink(orderId) {
        const link = orderShareLink(orderId);

        window.UI.showToast('Ссылка на заказ скопирована');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay share-link';
        modal.innerHTML = `
            <div class="modal modal--confirm">
                <div class="modal__header">
                    <h2 class="modal__title">Ссылка на заказ</h2>
                    <button type="button" class="modal__close" data-share-close>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal__body modal__body--confirm">
                    <p class="confirm-text">Скопируйте ссылку вручную:</p>
                    <input type="text" class="form-input" data-share-input value="${window.UI.escapeHtml(link)}" readonly>
                    <div class="form-actions form-actions--confirm">
                        <button type="button" class="btn btn-primary" data-share-close>Готово</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.classList.add('active');

        const input = modal.querySelector('[data-share-input]');
        input.focus();
        input.select();

        modal.querySelectorAll('[data-share-close]').forEach(function(button) {
            button.addEventListener('click', function() {
                modal.remove();
            });
        });

        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.remove();
        });
    }

    function openOrderEditor(orderId) {
        if (!orderId || !window.openOrderEditor) return false;

        return window.openOrderEditor(orderId);
    }

    let statusColorsPromise = null;

    function loadStatusColors() {
        if (statusColors && Object.keys(statusColors).length) return Promise.resolve(statusColors);

        if (statusColorsPromise) return statusColorsPromise;

        statusColorsPromise = fetch('/orders/list/?status=all&limit=1', { cache: 'no-store' })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data && data.colors) statusColors = Object.assign({}, statusColors, data.colors);

                return statusColors;
            })
            .catch(function() { return statusColors; })
            .finally(function() {
                statusColorsPromise = null;
            });

        return statusColorsPromise;
    }

    function openOrderCard(orderId) {
        if (!orderId) return;

        const order = currentOrders.find(item => String(item.id) === String(orderId));

        if (order) renderEventModal(order);

        Promise.all([
            loadStatusColors(),
            fetch('/orders/' + orderId + '/', { cache: 'no-store' })
                .then(function(response) { return response.json(); }),
        ])
            .then(function(results) {
                const data = results[1];

                if (!data || data.error || !data.id) return;

                const index = currentOrders.findIndex(item => String(item.id) === String(data.id));

                if (index >= 0) {
                    currentOrders[index] = Object.assign({}, currentOrders[index], data);
                } else {
                    currentOrders.push(data);
                }
            })
            .then(function() {
                if (!eventModal || !eventModal.classList.contains('active')) return;
                if (String(activeOrderId) !== String(orderId)) return;

                const current = currentOrders.find(item => String(item.id) === String(orderId));

                if (current) renderEventModal(current);
            })
            .catch(function() {});

        if (order) {
            markOrderViewed(order.id, order.updated_at);
            clearChangedFlag(order.id);
        }
    }

    function clearChangedFlag(orderId) {
        const id = parseInt(orderId, 10);

        if (isNaN(id)) return;

        fetch('/orders/' + id + '/peek/', { cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(function(response) {
                if (!response.ok) return;

                currentOrders.forEach(function(item) {
                    if (String(item.id) === String(id)) {
                        item.content_changed = false;
                    }
                });

                document.querySelectorAll('.calendar-event--changed[data-order-id="' + id + '"]').forEach(function(node) {
                    node.classList.remove('calendar-event--changed');

                    const flag = node.querySelector('.calendar-event__flag');

                    if (flag) flag.remove();
                });

                document.querySelectorAll('.order-row--changed[data-order-id="' + id + '"]').forEach(function(node) {
                    node.classList.remove('order-row--changed');

                    const badge = node.querySelector('.order-row__badge');

                    if (badge) badge.remove();
                });
            })
            .catch(function() {});
    }

    function openOrderEditorFor(orderId) {
        if (!canOpenOrders()) return false;

        return openOrderEditor(orderId);
    }

    function handleOrderClick(orderId) {
        if (!orderId) return;

        openOrderCard(orderId);
    }

    function handleOrderEdit(orderId) {
        if (!orderId) return;

        if (!canManageOrders()) {
            openOrderCard(orderId);
            return;
        }

        if (window.openOrderForm && window.openOrderForm(orderId)) {
            closeEventModal();
            return;
        }

        openOrderCard(orderId);
    }

    function handleOrderOpen(orderId) {
        openOrderCard(orderId);
    }

    function getEventStyle(status) {
        const c = statusColors['order:' + status];

        if (!c) return '';

        return `background:${c.background}; color:${c.text};`;
    }

    function getStatusChipStyle(status) {
        const c = statusColors['order:' + status];

        if (!c) return '';

        return `background:${c.background}; border-color:${c.border}; color:${c.text};`;
    }

    function applyEventModalStatus(status) {
        if (!eventModal) return;

        const c = statusColors['order:' + status];
        const card = eventModal.querySelector('.modal--event-card');

        if (!card) return;

        card.classList.toggle('modal--event-tinted', !!c);
        card.style.setProperty('--event-status-bg', c ? c.background + '2e' : 'transparent');
        card.style.setProperty('--event-status-bg-color', c ? c.background : 'transparent');
        card.style.setProperty('--event-status-border', c ? c.border : '#2b2620');
        card.style.setProperty('--event-status-text', c ? c.text : '');
    }

    function buildChangedBanner(order) {
        if (!isOrderChanged(order)) return '';

        const logs = (Array.isArray(order.change_logs) ? order.change_logs : []).slice(0, 5);

        const items = logs.map(function(item) {
            const oldValue = String(item.old_value || '').trim();
            const newValue = String(item.new_value || '').trim();
            const who = String(item.changed_by || '').trim();
            const when = whenLabel(item.changed_at);

            return '<div class="event-modal__change">'
                + '<div class="event-modal__change-head">'
                + (when ? '<span class="event-modal__change-when">' + escapeHtml(when) + '</span> ' : '')
                + '<b>' + escapeHtml(item.field || '') + '</b>'
                + (who ? ', ' + escapeHtml(who) : '')
                + '</div>'
                + '<div class="event-modal__change-values">'
                + '<span class="event-modal__change-old">' + escapeHtml(oldValue || 'пусто') + '</span>'
                + '<span class="event-modal__change-arrow"> - </span>'
                + '<span class="event-modal__change-new">' + escapeHtml(newValue || 'пусто') + '</span>'
                + '</div>'
                + '</div>';
        }).join('');

        return '<div class="event-modal__banner event-modal__banner--changed" data-changes-banner>'
            + '<button type="button" class="event-modal__banner-toggle" data-changes-toggle aria-expanded="false">'
            + '<span class="event-modal__banner-title">Информация о заказе изменена</span>'
            + '<svg class="event-modal__banner-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '<polyline points="6 9 12 15 18 9"/>'
            + '</svg>'
            + '</button>'
            + (items ? '<div class="event-modal__changes">' + items + '</div>' : '')
            + '</div>';
    }

    function mountChangedBanner() {
        if (!eventModalBody) return;

        eventModalBody.querySelectorAll('[data-changes-banner]').forEach(function(banner) {
            const toggle = banner.querySelector('[data-changes-toggle]');
            const changes = banner.querySelector('.event-modal__changes');

            if (!toggle || !changes) return;

            if (toggle.disabled) return;

            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const expanded = banner.classList.toggle('event-modal__banner--open');

                toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            });
        });
    }

    function whenLabel(value) {
        if (!value) return '';

        const date = new Date(value);

        if (isNaN(date.getTime())) return '';

        return date.toLocaleString('ru-RU', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
        });
    }

    function renderEventModal(order) {
        if (!order) return;

        const isArtistView = !canManageOrders();
        const changedBanner = buildChangedBanner(order);

        const incompleteBanner = !isArtistView && isOrderIncomplete(order)
            ? `<div class="event-modal__banner event-modal__banner--incomplete">Заказ заполнен не полностью: ${escapeHtml((order.missing_fields || []).join(', '))}</div>`
            : '';

        eventModalTitle.textContent = order.name || 'Заказ';
        applyEventModalStatus(order.status);

        if (eventModalBody) {
            if (window.renderOrderPreviewCard) {
                window.renderOrderPreviewCard(order, changedBanner + incompleteBanner, { hideClient: isArtistView, hideStatus: isArtistView, hidePayment: isArtistView });
            } else {
                eventModalBody.innerHTML = changedBanner + incompleteBanner;
            }

            mountChangedBanner();
        }

        if (eventModalDetailsBtn) {
            eventModalDetailsBtn.style.display = canManageOrders() ? '' : 'none';
        }

        if (eventModalDeleteBtn) {
            eventModalDeleteBtn.style.display = canManageOrders() ? '' : 'none';
        }

        if (eventModalChecklistBtn) {
            eventModalChecklistBtn.style.display = '';
            updateChecklistButton(order);
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

    function deleteActiveOrder() {
        if (!activeOrderId) return;

        const orderId = activeOrderId;

        window.UI.confirm({
            title: 'Удалить заказ из календаря',
            text: '',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true,
            checkLabel: 'Также удалить из истории агентства',
            checkDefault: false
        }).then(function(result) {
            if (!result) return;

            const hardDelete = !!result.checked;

            fetch('/orders/' + orderId + '/delete/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': window.UI.getCSRFToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hard: hardDelete })
            })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.error) {
                        window.UI.showToast(data.error);
                        return;
                    }

                    if (!data.success) return;

                    window.UI.showToast(hardDelete ? 'Заказ удалён' : 'Заказ отменён');
                    closeEventModal();

                    if (window.refreshSchedule) {
                        window.refreshSchedule(true);
                    }
                })
                .catch(function(error) {
                    window.UI.showToast('Ошибка удаления');
                    console.error(error);
                });
        });
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

        const total = order.checklist_total || 0;
        const done = order.checklist_done || 0;

        eventModalChecklistBtn.querySelectorAll('svg, .event-checklist-btn__count').forEach(function(node) {
            node.remove();
        });

        eventModalChecklistBtn.textContent = 'Чек-лист' + (total ? ' ' + done + '/' + total : '');
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

        let result = orders.slice();

        if (!showPastCompleted) {
            result = result.filter(o => !isPastOrder(o));
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

        return sortListByUpcoming(result);
    }

    function isPastOrder(order) {
        if (!order.has_date || !order.date) return false;

        return order.date < getTodayIso();
    }

    function sortListByUpcoming(result) {
        const today = getTodayIso();

        result.sort((a, b) => {
            const aHasDate = !!a.has_date && !!a.date;
            const bHasDate = !!b.has_date && !!b.date;

            if (aHasDate !== bHasDate) {
                return aHasDate ? -1 : 1;
            }

            if (!aHasDate) {
                return String(b.id).localeCompare(String(a.id));
            }

            const aPast = a.date < today;
            const bPast = b.date < today;

            if (aPast !== bPast) {
                return aPast ? 1 : -1;
            }

            const diff = a.date.localeCompare(b.date);

            if (diff !== 0) return diff;

            return String(a.id).localeCompare(String(b.id));
        });

        return result;
    }

    function applyCalendarFilters(orders) {
        const status = calendarStatusSelect ? calendarStatusSelect.value : 'all';

        let result = orders.slice();

        if (status !== 'all') {
            result = result.filter(o => o.status === status);
        }

        return sortByDate(result, 'date_asc');
    }

    function applyFiltersAndSort(orders) {
        return applyCalendarFilters(orders);
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
            const sorted = filtered.slice().sort((a, b) => {
                const aPast = isPastOrder(a);
                const bPast = isPastOrder(b);

                if (aPast !== bPast) return aPast ? 1 : -1;

                return (a.date || '').localeCompare(b.date || '');
            });

            dashboardList.innerHTML = sorted
                .map(order => renderOrderRow(order, isPastOrder(order) ? 'order-row--past' : ''))
                .join('');

            if (listHasMore) {
                const loadMoreBtn = document.createElement('button');

                loadMoreBtn.type = 'button';
                loadMoreBtn.className = 'schedule-load-more';
                loadMoreBtn.textContent = 'Загрузить ещё';
                loadMoreBtn.addEventListener('click', function() {
                    loadMoreOrders();
                });

                dashboardList.appendChild(loadMoreBtn);
            }

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

        if (listHasMore) {
            const loadMoreBtn = document.createElement('button');

            loadMoreBtn.type = 'button';
            loadMoreBtn.className = 'schedule-load-more';
            loadMoreBtn.textContent = 'Загрузить ещё';
            loadMoreBtn.addEventListener('click', function() {
                loadMoreOrders();
            });

            dashboardList.appendChild(loadMoreBtn);
        }

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
            row.addEventListener('click', function(e) {
                e.stopPropagation();

                const id = parseInt(this.getAttribute('data-order-id'));

                if (!id) return;

                if (e.defaultPrevented) return;

                handleOrderClick(id);
            });

            row.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                hideContextMenu();
                handleOrderEdit(parseInt(this.getAttribute('data-order-id'), 10));
            });
        });

        dashboardList.querySelectorAll('[data-client-id]').forEach(node => {
            if (!node.dataset.clientId) return;

            node.addEventListener('click', function(e) {
                e.stopPropagation();
                window.location.href = '/clients/?open_client=' + encodeURIComponent(this.dataset.clientId);
            });
        });

        dashboardList.querySelectorAll('[data-order-share]').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                copyOrderLink(parseInt(this.dataset.orderShare, 10));
            });
        });
    }

    function renderOrderRow(order, extra) {
        const showMyPayment = canSeeRates() && order.my_payment !== undefined && order.my_payment !== null;

        const costCell = showMyPayment
            ? formatPrice(order.my_payment)
            : (canSeeCost() && order.cost ? formatPrice(order.cost) : '—');

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

        const clientLinkHtml = canManageOrders()
            ? `<span class="order-row__meta-item order-row__client-link" data-client-id="${order.client_id || ''}" title="Открыть карточку клиента">`
            : `<span class="order-row__meta-item">`;

        return `
            <div class="${getRowClasses(order, extra)}" data-order-id="${order.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                <div class="order-row__head">
                    <span class="order-row__cell order-row__name">
                        ${orderNameHtml(order)}${incompleteBadge}
                    </span>
                    <span class="order-row__status">${escapeHtml(getStatusLabel(order.status))}</span>
                </div>
                <div class="order-row__meta">
                    ${clientLinkHtml}
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
                    <button type="button" class="order-row__share" data-order-share="${order.id}" title="Скопировать ссылку" aria-label="Скопировать ссылку">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    function calendarShowsHtml(order) {
        const shows = order.services || [];
        const parts = shows.map(function(item) {
            if (typeof item === 'string') return item;

            const name = item.name || '';
            const count = item.people_count;

            if (!name) return '';

            return count ? name + ' ' + count : name;
        }).filter(Boolean);

        if (!parts.length) return '';

        return '<div class="calendar-event__show">' + escapeHtml(parts.join(', ')) + '</div>';
    }

    function calendarShowTimeHtml(order) {
        const shows = order.services || [];
        let time = '';

        for (let index = 0; index < shows.length; index++) {
            const item = shows[index];

            if (item && typeof item === 'object') {
                const value = String(item.start_time || item.time || '').trim();

                if (value) {
                    time = value;
                    break;
                }
            }
        }

        if (!time) {
            time = String(order.start_time_text || order.start_time || '').trim();
        }

        if (!time) return '';

        return '<div class="calendar-event__time">' + escapeHtml(time) + '</div>';
    }

    function calendarStaffHtml(order) {
        return '';
    }

    function getCalendarEventsForDate(dateStr) {
        if (!dateStr) return [];

        return calendarEvents.filter(function(item) {
            return item.date === dateStr;
        });
    }

    function calendarEventHtml(item) {
        const timeText = String(item.time_text || '').trim();
        const description = String(item.description || '').trim();

        return '<div class="calendar-event calendar-event--event" data-event-id="' + item.id + '">'
            + '<div class="calendar-event__name">' + escapeHtml(item.title || 'Событие') + '</div>'
            + (timeText ? '<div class="calendar-event__show">' + escapeHtml(timeText) + '</div>' : '')
            + (description ? '<div class="calendar-event__staff">' + escapeHtml(description) + '</div>' : '')
            + '</div>';
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

        const hasSearch = false;
        const hasStatusFilter = calendarStatusSelect ? calendarStatusSelect.value !== 'all' : false;

        const isCurrentMonthView = month === today.getMonth() && year === today.getFullYear();

        const monthEvents = filtered.filter(o => {
            if (!o.has_date) return isCurrentMonthView;

            const start = parseDate(o.date);
            const end = new Date(start);
            end.setDate(end.getDate() + (o.duration || 1) - 1);

            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month, daysInMonth);

            return start <= monthEnd && end >= monthStart;
        });

        const emptyNotice = hasStatusFilter && monthEvents.length === 0
            ? '<div class="calendar-search-empty">По выбранному статусу в этом месяце ничего не найдено</div>'
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
                    if (!o.has_date) {
                        return dayNumber === 1 && month === today.getMonth() && year === today.getFullYear();
                    }
                    const start = parseDate(o.date);
                    const end = new Date(start);
                    end.setDate(end.getDate() + (o.duration || 1) - 1);
                    return cellDate >= start && cellDate <= end;
                });

                const cellEvents = getCalendarEventsForDate(
                    `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
                );

                if (events.length > 0 || cellEvents.length > 0) {
                    eventsHtml = '<div class="calendar-cell__events">' +
                        events.map(e => {
                            const servicesLabel = getServicesLabel(e);
                            const costHtml = (canSeeCost() && e.cost && e.cost !== '—')
                                ? `<div class="calendar-event__cost">${formatPrice(e.cost)}</div>`
                                : '';
                            const style = getEventStyle(e.status);

                            let eventClass = 'calendar-event';

                            if (isOrderChanged(e)) eventClass += ' calendar-event--changed';
                            if (isOrderIncomplete(e)) eventClass += ' calendar-event--incomplete';
                            if (needsIncompleteAlert(e)) eventClass += ' calendar-event--alert';

                            const missingTitle = getMissingTitle(e);
                            const showsHtml = calendarShowsHtml(e);
                            const showTimeHtml = calendarShowTimeHtml(e);
                            const staffHtml = calendarStaffHtml(e);
                            const clientHtml = canManageOrders()
                                ? `<div class="calendar-event__client">${escapeHtml(e.client || '—')}</div>`
                                : '';

                            return `
                                <div class="${eventClass}" style="${style}" data-order-id="${e.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                                    ${isOrderChanged(e) ? '<span class="calendar-event__flag" title="Заказ обновлён">!</span>' : ''}
                                    <div class="calendar-event__name">${calendarOrderNameHtml(e)}</div>
                                    ${showTimeHtml}
                                    ${clientHtml}
                                    ${showsHtml}
                                    ${staffHtml}
                                    ${costHtml}
                                    <button type="button" class="calendar-event__share" data-order-share="${e.id}" title="Скопировать ссылку" aria-label="Скопировать ссылку">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                        </svg>
                                    </button>
                                </div>
                            `;
                        }).join('') + cellEvents.map(calendarEventHtml).join('') +
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
                    <div class="calendar-cell__date${isToday ? ' calendar-cell__date--today' : ''}">
                        <span>${isCurrentMonth ? dayNumber : ''}</span>
                        <span class="calendar-cell__weekday">${isCurrentMonth ? weekdaysShort[weekdayIndex] : ''}</span>
                    </div>
                    ${eventsHtml}
                </div>
            `;
        }

        calendarGrid.innerHTML = html;

        calendarGrid.querySelectorAll('.calendar-event').forEach(ev => {
            if (ev.classList.contains('calendar-event--event')) return;

            ev.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-order-id'));

                if (id) handleOrderOpen(id);
            });

            const shareBtn = ev.querySelector('[data-order-share]');

            if (shareBtn) {
                shareBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    copyOrderLink(parseInt(this.dataset.orderShare, 10));
                });
            }

            ev.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                hideContextMenu();
                handleOrderEdit(parseInt(this.getAttribute('data-order-id'), 10));
            });
        });

        calendarGrid.querySelectorAll('.calendar-event--event').forEach(ev => {
            ev.addEventListener('click', function(e) {
                e.stopPropagation();
                openCalendarEventModal(parseInt(this.dataset.eventId, 10));
            });

            ev.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                hideContextMenu();
                openCalendarEventModal(parseInt(this.dataset.eventId, 10));
            });
        });        calendarGrid.querySelectorAll('.calendar-cell').forEach(cell => {
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
        dashboardCalendar.style.display = 'block';
        renderCalendar();

        if (dashboardFilters) dashboardFilters.style.display = 'none';
        if (calendarFilters) calendarFilters.style.display = 'none';
    }

    function applyInitialView() {
        currentView = 'calendar';
    }

    function isOnlyMyOrders() {
        if (!myOrdersOnlyToggle) return false;
        return myOrdersOnlyToggle.checked;
    }

    const LIST_PAGE_SIZE = 50;

    let listLimit = LIST_PAGE_SIZE;
    let listHasMore = false;
    let loadingOrders = false;

    function monthDateRange(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);

        return {
            from: dateToIso(start),
            to: dateToIso(end),
        };
    }

    function dateToIso(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
            + '-' + String(date.getDate()).padStart(2, '0');
    }

    function ordersUrl(options) {
        const settings = options || {};
        const isList = settings.list === true;
        const base = isOnlyMyOrders() ? '/schedule/my-orders/' : '/orders/list/';
        const params = new URLSearchParams();

        params.set('status', 'all');

        if (!isList) {
            const range = monthDateRange(calendarDate);

            params.set('date_from', range.from);
            params.set('date_to', range.to);
        }

        if (settings.limit) params.set('limit', String(settings.limit));
        if (settings.offset) params.set('offset', String(settings.offset));

        return base + '?' + params.toString();
    }

    function fetchOrdersQuery(settings) {
        return fetch(ordersUrl(settings), { cache: 'no-store' })
            .then(r => r.json())
            .catch(function() {
                return { error: 'network' };
            });
    }

    function fetchOrdersForLink(callback) {
        fetchOrdersQuery({ limit: LIST_PAGE_SIZE, offset: 0 })
            .then(data => {
                if (!data.error && data.orders) {
                    currentOrders = data.orders;
                    statusColors = Object.assign({}, statusColors, data.colors || {});
                }
            })
            .catch(function() {})
            .finally(function() {
                if (typeof callback === 'function') callback();
            });
    }

    function loadOrders() {
        if (loadingOrders) return;

        loadingOrders = true;

        const isList = currentView !== 'calendar';
        const limit = isList ? listLimit : null;
        const silent = arguments[0] === true;

        fetchOrdersQuery({ list: isList, limit: limit, offset: 0 })
            .then(data => {
                if (data.error) {
                    if (!silent) {
                        dashboardList.innerHTML = `<div class="dashboard-empty">${escapeHtml(data.error === 'network' ? 'Ошибка загрузки расписания' : data.error)}</div>`;
                    }
                    return;
                }

                currentOrders = data.orders || [];
                statusColors = Object.assign({}, statusColors, data.colors || {});
                listHasMore = isList ? !!data.has_more : false;
                render();
            })
            .catch(err => {
                if (!silent) {
                    dashboardList.innerHTML = '<div class="dashboard-empty">Ошибка загрузки расписания</div>';
                }
                console.error(err);
            })
            .finally(function() {
                loadingOrders = false;
            });
    }

    function loadMoreOrders() {
        if (loadingOrders || !listHasMore) return;

        loadingOrders = true;

        const offset = currentOrders.length;

        fetchOrdersQuery({ list: true, limit: listLimit, offset: offset })
            .then(data => {
                if (data.error) return;

                const seen = {};

                currentOrders.forEach(function(item) {
                    seen[item.id] = true;
                });

                (data.orders || []).forEach(function(item) {
                    if (seen[item.id]) return;

                    seen[item.id] = true;
                    currentOrders.push(item);
                });

                if (data.colors) statusColors = Object.assign({}, statusColors, data.colors);

                listHasMore = !!data.has_more;
                render();
            })
            .catch(function() {})
            .finally(function() {
                loadingOrders = false;
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

        loadCalendarEvents().then(refreshOrders);
    }

    function refreshOrders() {
        const isList = currentView !== 'calendar';

        fetchOrdersQuery({ list: isList, limit: isList ? listLimit : null, offset: 0 })
            .then(data => {
                if (data.error) return;

                const next = data.orders || [];

                if (JSON.stringify(next) === JSON.stringify(currentOrders)) {
                    return;
                }

                currentOrders = next;
                statusColors = Object.assign({}, statusColors, data.colors || {});

                if (isList) listHasMore = !!data.has_more;

                render();
            })
            .catch(() => {});
    }

    function startAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }

        refreshTimer = setInterval(refreshOrders, REFRESH_INTERVAL_MS);

        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) refreshOrders();
        });
    }

    window.refreshSchedule = silentRefresh;

    if (pastCompletedToggle) {
        pastCompletedToggle.checked = getShowPastPreference();
        showPastCompleted = pastCompletedToggle.checked;
    }

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

    calendarPrev.addEventListener('click', function() {
        calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
        storeMonth(calendarDate);
        loadOrders();
        renderCalendar();
    });

    calendarNext.addEventListener('click', function() {
        calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
        storeMonth(calendarDate);
        loadOrders();
        renderCalendar();
    });

    function loadCalendarEvents() {
        return fetch('/schedule/events/', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                calendarEvents = Array.isArray(data.events) ? data.events : [];
            })
            .catch(function() {
                calendarEvents = [];
            });
    }

    function setCalendarEventError(message) {
        if (!calendarEventError) return;

        calendarEventError.textContent = message || '';
        calendarEventError.style.display = message ? 'block' : 'none';
    }

    function openCalendarEventModal(eventId, prefillDate) {
        if (!calendarEventModal) return;

        setCalendarEventError('');

        const event = eventId
            ? calendarEvents.find(item => String(item.id) === String(eventId))
            : null;

        activeCalendarEventId = event ? event.id : null;

        if (calendarEventTitle) calendarEventTitle.textContent = event ? 'Событие' : 'Новое событие';
        if (calendarEventName) calendarEventName.value = event ? event.title || '' : '';
        if (calendarEventDate) calendarEventDate.value = event ? event.date || '' : (prefillDate || '');
        if (calendarEventTime) calendarEventTime.value = event ? event.time_text || '' : '';
        if (calendarEventDescription) calendarEventDescription.value = event ? event.description || '' : '';
        if (calendarEventDeleteBtn) calendarEventDeleteBtn.style.display = event ? '' : 'none';

        calendarEventModal.classList.add('active');

        setTimeout(function() {
            if (calendarEventName) calendarEventName.focus();
        }, 60);
    }

    function closeCalendarEventModal() {
        if (!calendarEventModal) return;

        calendarEventModal.classList.remove('active');
        activeCalendarEventId = null;
    }

    function saveCalendarEvent() {
        if (!calendarEventModal) return;

        const title = calendarEventName ? calendarEventName.value.trim() : '';
        const dateValue = calendarEventDate ? calendarEventDate.value : '';

        if (!title) {
            setCalendarEventError('Введите название события');
            return;
        }

        if (!dateValue) {
            setCalendarEventError('Укажите дату события');
            return;
        }

        setCalendarEventError('');

        const url = activeCalendarEventId
            ? '/schedule/events/' + activeCalendarEventId + '/'
            : '/schedule/events/';
        const body = new URLSearchParams();

        body.append('action', 'save');
        body.append('title', title);
        body.append('date', dateValue);
        body.append('time_text', calendarEventTime ? calendarEventTime.value.trim() : '');
        body.append('description', calendarEventDescription ? calendarEventDescription.value.trim() : '');

        window.UI.setButtonBusy(calendarEventSaveBtn, true);

        fetch(url, {
            method: 'POST',
            headers: { 'X-CSRFToken': window.UI.getCSRFToken() },
            body: body,
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    setCalendarEventError(data.error);
                    return;
                }

                closeCalendarEventModal();
                loadCalendarEvents().then(function() {
                    renderCalendar();
                });
            })
            .catch(function() {
                setCalendarEventError('Не удалось сохранить событие');
            })
            .finally(function() {
                window.UI.setButtonBusy(calendarEventSaveBtn, false);
            });
    }

    function deleteCalendarEvent() {
        if (!activeCalendarEventId) return;

        const eventId = activeCalendarEventId;

        window.UI.confirm({
            title: 'Удалить событие?',
            text: 'Событие будет удалено из календаря.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true,
        }).then(function(confirmed) {
            if (!confirmed) return;

            fetch('/schedule/events/' + eventId + '/', {
                method: 'POST',
                headers: { 'X-CSRFToken': window.UI.getCSRFToken() },
                body: new URLSearchParams({ action: 'delete' }),
            })
                .then(r => r.json())
                .then(function(data) {
                    if (data.error) {
                        setCalendarEventError(data.error);
                        return;
                    }

                    closeCalendarEventModal();
                    loadCalendarEvents().then(function() {
                        renderCalendar();
                    });
                })
                .catch(function() {
                    setCalendarEventError('Не удалось удалить событие');
                });
        });
    }

    if (calendarEventSaveBtn) calendarEventSaveBtn.addEventListener('click', saveCalendarEvent);
    if (calendarEventDeleteBtn) calendarEventDeleteBtn.addEventListener('click', deleteCalendarEvent);
    if (calendarEventCloseBtn) calendarEventCloseBtn.addEventListener('click', closeCalendarEventModal);

    if (calendarEventModal) {
        calendarEventModal.addEventListener('click', function(e) {
            if (e.target === this) closeCalendarEventModal();
        });

        window.UI.registerModal(calendarEventModal, closeCalendarEventModal);
    }

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
                    openCalendarEventModal(null, dateStr);
                }
            });
        });

        document.addEventListener('mousedown', function(e) {
            if (!contextMenu.contains(e.target)) {
                hideContextMenu();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') hideContextMenu();
        });

        window.addEventListener('scroll', function() {
            hideContextMenu();
        }, true);
    }

    if (eventModalCloseBtn) {
        eventModalCloseBtn.addEventListener('click', closeEventModal);
    }
    if (eventModalDeleteBtn) {
        eventModalDeleteBtn.addEventListener('click', deleteActiveOrder);
    }
    if (eventModal) {
        eventModal.addEventListener('click', function(e) {
            if (e.target === this) closeEventModal();
        });
    }
    if (eventModalDetailsBtn) {
        eventModalDetailsBtn.addEventListener('click', function() {
            if (!activeOrderId) return;

            if (!canManageOrders()) {
                window.UI.showToast('Подробные данные заказа доступны только с правом управления заказами');
                return;
            }

            if (window.openOrderForm && window.openOrderForm(activeOrderId)) {
                closeEventModal();
            }
        });
    }

    if (eventModalChecklistBtn) {
        eventModalChecklistBtn.addEventListener('click', openEventChecklist);
    }

    if (eventModalCopyLinkBtn) {
        eventModalCopyLinkBtn.addEventListener('click', function() {
            if (!activeOrderId) return;

            copyOrderLink(activeOrderId);
        });
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

    if (eventModal) {
        window.UI.registerModal(eventModal, closeEventModal);
    }

    if (eventChecklistModal) {
        window.UI.registerModal(eventChecklistModal, closeEventChecklist);
    }

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

    if (pastCompletedToggle) {
        pastCompletedToggle.addEventListener('change', function() {
            showPastCompleted = this.checked;
            setShowPastPreference(this.checked);
            render();
        });
    }

    if (calendarStatusSelect) calendarStatusSelect.addEventListener('change', render);

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

        window.UI.registerModal(availabilityModal, closeAvailabilityModal);
    }

    window.openAvailabilityModal = openAvailabilityModal;

    const startParams = new URLSearchParams(window.location.search);
    const openingOrderId = parseInt(startParams.get('open_order') || startParams.get('order'), 10);
    const openFormNow = startParams.get('open_form') === '1';

    applyInitialView();
    loadCalendarEvents().then(function() {
        loadOrders();
    });
    startAutoRefresh();

    if (!isNaN(openingOrderId)) {
        window.history.replaceState({}, '', window.location.pathname);

        if (openFormNow) {
            const openFormLink = function(orderId, attempts) {
                if (typeof window.openOrderForm === 'function') {
                    window.openOrderForm(orderId);
                    return;
                }

                if (attempts <= 0) {
                    openOrderByLink(orderId, 0);
                    return;
                }

                setTimeout(function() {
                    openFormLink(orderId, attempts - 1);
                }, 200);
            };

            openFormLink(openingOrderId, 40);
            return;
        }

        openOrderByLink(openingOrderId, 10);
        return;
    }
})();