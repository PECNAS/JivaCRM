(function() {
    let currentOrderId = null;
    let isCreatingOrder = false;
    let createClientTargetSelect = null;
    let allClients = [];
    let createClientPicker = null;
    let editClientPicker = null;

    const tableBody = document.getElementById('ordersTableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const dateFromInput = document.getElementById('dateFromInput');
    const dateToInput = document.getElementById('dateToInput');
    const dateResetBtn = document.getElementById('dateResetBtn');
    const addOrderBtn = document.getElementById('addOrderBtn');
    const createModal = document.getElementById('createOrderModal');
    const createModalCloseBtn = document.getElementById('createModalCloseBtn');
    const createModalCancelBtn = document.getElementById('createModalCancelBtn');
    const createForm = document.getElementById('createOrderForm');
    const createOrderName = document.getElementById('createOrderName');
    const createOrderClient = document.getElementById('createOrderClient');
    const createOrderDate = document.getElementById('createOrderDate');
    const notificationContainer = document.getElementById('notificationContainer');
    const editorModal = document.getElementById('orderEditorModal');
    const editorModalCloseBtn = document.getElementById('editorModalCloseBtn');
    const editorOrderTitle = document.getElementById('editorOrderTitle');

    const createClientModal = document.getElementById('createClientModal');
    const createClientModalCloseBtn = document.getElementById('createClientModalCloseBtn');
    const createClientModalCancelBtn = document.getElementById('createClientModalCancelBtn');
    const createClientForm = document.getElementById('createClientForm');
    const newClientFullName = document.getElementById('newClientFullName');
    const newClientPhone = document.getElementById('newClientPhone');

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);

        if (cookieValue) return cookieValue[2];

        return window.__csrfToken || '';
    }

    const ORDERS_PAGE = 50;
    const CLIENTS_PAGE = 200;
    const COMBOBOX_LIMIT = 300;
    const ordersLoadMore = document.getElementById('ordersLoadMore');
    const ordersLoadMoreBtn = document.getElementById('ordersLoadMoreBtn');

    const DATE_STORAGE_KEY = 'jiva_orders_date_filter';

    function restoreDateFilter() {
        try {
            const raw = localStorage.getItem(DATE_STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (dateFromInput && data.from) dateFromInput.value = data.from;
            if (dateToInput && data.to) dateToInput.value = data.to;
        } catch (error) {}
    }

    function saveDateFilter() {
        try {
            localStorage.setItem(DATE_STORAGE_KEY, JSON.stringify({
                from: dateFromInput ? dateFromInput.value : '',
                to: dateToInput ? dateToInput.value : ''
            }));
        } catch (error) {}
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

    function showNotification(orderId, orderName) {
        const notification = document.createElement('div');
        notification.className = 'notification';        notification.innerHTML = `
            <div class="notification__content">
                <div class="notification__text">
                    Заказ "<strong>${escapeHtml(orderName)}</strong>" успешно создан
                </div>
                <div class="notification__actions">
                    <button class="notification__btn" data-order-id="${orderId}">
                        Перейти к редактированию
                    </button>
                    <button class="notification__btn notification__btn--outline" data-dismiss>
                        Закрыть
                    </button>
                </div>
            </div>
            <div class="notification__progress"></div>
        `;

        const progressBar = notification.querySelector('.notification__progress');
        const duration = 5000;
        const startTime = Date.now();

        function updateProgress() {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1 - elapsed / duration);
            progressBar.style.transform = `scaleX(${remaining})`;

            if (remaining > 0) {
                requestAnimationFrame(updateProgress);
            }
        }

        requestAnimationFrame(updateProgress);

        const timeoutId = setTimeout(() => {
            removeNotification(notification);
        }, duration);

        notification.querySelector('[data-order-id]').addEventListener('click', function() {
            clearTimeout(timeoutId);
            removeNotification(notification);
            openEditor(parseInt(this.dataset.orderId));
        });

        notification.querySelector('[data-dismiss]').addEventListener('click', function() {
            clearTimeout(timeoutId);
            removeNotification(notification);
        });

        notificationContainer.appendChild(notification);
    }

    function removeNotification(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(30px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 300);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getStatusLabel(status) {
        const labels = {
            request: 'Запрос',
            confirmed: 'Подтвержденный',
            completed: 'Выполненный'
        };
        return labels[status] || status;
    }

    function getOrderName(order) {
        return order.name_display || order.name || '—';
    }

    function getRowClassNames(order) {
        let classes = 'orders-row';

        if (order.status) classes += ' orders-row--' + order.status;
        if (!order.has_date) classes += ' orders-row--no-date';
        if (order.content_changed) classes += ' orders-row--changed';
        if (order.is_incomplete) classes += ' orders-row--incomplete';

        return classes;
    }

    function getMissingTitle(order) {
        if (!order.is_incomplete || !order.missing_fields || !order.missing_fields.length) return '';
        return 'Не заполнено: ' + order.missing_fields.join(', ');
    }

    function canManageOrdersClientList() {
        return document.body.dataset.canManageOrders === '1';
    }

    function loadClients(selectedId, offset) {
        if (!canManageOrdersClientList()) return;

        const start = offset || 0;
        const params = new URLSearchParams();
        params.set('offset', String(start));
        params.set('limit', String(CLIENTS_PAGE));

        fetch(`/clients/list/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (!data.clients) return;

                if (start === 0) {
                    allClients = data.clients;
                } else {
                    const known = new Set(allClients.map(item => String(item.id)));
                    data.clients.forEach(client => {
                        if (!known.has(String(client.id))) {
                            allClients.push(client);
                        }
                    });
                }

                window.allOrderClients = allClients;

                const options = allClients.map(c =>
                    `<option value="${c.id}">${escapeHtml(c.full_name)}${c.agency ? ' (' + escapeHtml(c.agency) + ')' : ''}</option>`
                ).join('');

                createOrderClient.innerHTML = '<option value="">Выберите клиента</option>' + options;

                const editClientSelect = document.getElementById('editOrderClient');

                if (editClientSelect) {
                    editClientSelect.innerHTML = '<option value="">Выберите клиента</option>' + options;
                }

                if (selectedId !== undefined && selectedId !== null && selectedId !== '') {
                    createOrderClient.value = selectedId;

                    if (editClientSelect) {
                        editClientSelect.value = selectedId;
                    }
                }

                if (createClientPicker) {
                    createClientPicker.refresh();
                }

                if (editClientPicker) {
                    editClientPicker.refresh();
                }

                if (data.has_more) {
                    loadClients(undefined, start + data.clients.length);
                }
            })
            .catch(error => console.error('Ошибка загрузки клиентов:', error));
    }

    function applyClientContacts(client) {
        if (!client) return;

        const nameField = document.getElementById('editOrderContactName');
        const phoneField = document.getElementById('editOrderContactPhone');
        const telegramField = document.getElementById('editOrderContactTelegram');

        if (nameField) nameField.value = client.full_name || '';

        if (phoneField) {
            if (window.UI && window.UI.setPhoneValue) {
                window.UI.setPhoneValue(phoneField, client.phone || '');
            } else {
                phoneField.value = client.phone || '';
            }
        }

        if (telegramField) telegramField.value = client.telegram || '';
    }

    function createClientCombobox(inputId, selectId) {
        const input = document.getElementById(inputId);
        const select = document.getElementById(selectId);

        if (!input || !select) return null;

        const wrapper = input.closest('.client-combobox');
        const dropdown = wrapper ? wrapper.querySelector('.client-combobox__dropdown') : null;

        if (!dropdown) return null;

        let items = [];
        let index = -1;
        let inlineFormOpen = false;

        function normalize(value) {
            return (value || '').toLowerCase().replace(/ё/g, 'е').trim();
        }

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
            index = -1;
            inlineFormOpen = false;
        }

        function openInlineClientForm(name) {
            inlineFormOpen = true;
            dropdown.innerHTML = '';

            const form = document.createElement('div');
            form.className = 'client-inline-form';
            form.innerHTML = `
                <div class="client-inline-form__title">Новый клиент</div>
                <input type="text" class="client-inline-form__input" data-field="full_name" placeholder="Имя клиента *" value="${window.UI.escapeHtml(name || '')}">
                <select class="client-inline-form__input" data-field="client_type">
                    <option value="organizer">Организатор</option>
                    <option value="agency">Агентство</option>
                </select>
                <input type="text" class="client-inline-form__input" data-field="agency" placeholder="Название агентства *" autocomplete="off" style="display:none;">
                <input type="text" class="client-inline-form__input" data-field="contact" placeholder="Телефон или @телеграм *" autocomplete="off">
                <div class="client-inline-form__actions">
                    <button type="button" class="client-inline-form__cancel">Отмена</button>
                    <button type="button" class="client-inline-form__submit">Создать</button>
                </div>
                <div class="client-inline-form__error" style="display:none;"></div>
            `;

            dropdown.appendChild(form);
            dropdown.classList.add('open');

            const nameInput = form.querySelector('[data-field="full_name"]');
            const typeInput = form.querySelector('[data-field="client_type"]');
            const agencyInput = form.querySelector('[data-field="agency"]');
            const contactInput = form.querySelector('[data-field="contact"]');
            const errorBox = form.querySelector('.client-inline-form__error');

            const syncAgencyVisibility = function() {
                agencyInput.style.display = typeInput.value === 'agency' ? '' : 'none';
            };

            typeInput.addEventListener('change', syncAgencyVisibility);

            nameInput.focus();
            nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);

            form.querySelector('.client-inline-form__cancel').addEventListener('mousedown', function(e) {
                e.preventDefault();
                close();
            });

            const submit = function() {
                const fullName = nameInput.value.trim();
                const clientType = typeInput.value;
                const agencyName = agencyInput.value.trim();
                const contact = contactInput.value.trim();

                if (!fullName) {
                    errorBox.textContent = 'Укажите имя клиента';
                    errorBox.style.display = 'block';
                    nameInput.focus();
                    return;
                }

                if (clientType === 'agency' && !agencyName) {
                    errorBox.textContent = 'Укажите агентство';
                    errorBox.style.display = 'block';
                    agencyInput.focus();
                    return;
                }

                if (!contact) {
                    errorBox.textContent = 'Укажите телефон или телеграм';
                    errorBox.style.display = 'block';
                    contactInput.focus();
                    return;
                }

                errorBox.style.display = 'none';

                const isPhone = contact.replace(/\D/g, '').length >= 10;
                const isTelegramHandle = /^[\w.]+$/.test(contact) && !isPhone;

                const body = new URLSearchParams({
                    full_name: fullName,
                    agency_name: clientType === 'agency' ? agencyName : '',
                    phone: isPhone ? contact : '',
                    telegram: isPhone ? '' : (isTelegramHandle && !contact.startsWith('@') ? '@' + contact : contact),
                    client_type: clientType,
                    rating: 'medium',
                });

                fetch('/clients/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': window.UI.getCSRFToken(),
                    },
                    body: body,
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        errorBox.textContent = data.error;
                        errorBox.style.display = 'block';
                        return;
                    }

                    if (data.duplicate) {
                        errorBox.textContent = 'Похожий клиент уже существует';
                        errorBox.style.display = 'block';
                        return;
                    }

                    if (data.client) {
                        allClients.push(data.client);
                        pick(data.client);
                        window.UI.showToast('Клиент «' + data.client.full_name + '» создан');
                    }
                })
                .catch(() => {
                    errorBox.textContent = 'Не удалось создать клиента';
                    errorBox.style.display = 'block';
                });
            };

            form.querySelector('.client-inline-form__submit').addEventListener('mousedown', function(e) {
                e.preventDefault();
                submit();
            });

            form.querySelectorAll('input').forEach(field => {
                field.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submit();
                    }

                    if (e.key === 'Escape') {
                        e.preventDefault();
                        close();
                    }
                });
            });
        }

        function buildItems(query) {
            const search = normalize(query);

            let result = allClients.slice();

            if (search) {
                result = result.filter(client => {
                    const haystack = [
                        client.full_name,
                        client.phone,
                        client.telegram,
                        client.agency,
                        client.city
                    ].map(normalize).join(' ');

                    return haystack.indexOf(search) !== -1;
                });

                result.sort((a, b) => {
                    const aName = normalize(a.full_name);
                    const bName = normalize(b.full_name);
                    const aStart = aName.indexOf(search) === 0 ? 0 : 1;
                    const bStart = bName.indexOf(search) === 0 ? 0 : 1;
                    if (aStart !== bStart) return aStart - bStart;
                    return aName.localeCompare(bName, 'ru');
                });
            } else {
                const selected = select.value;
                result.sort((a, b) => {
                    if (String(a.id) === selected) return -1;
                    if (String(b.id) === selected) return 1;
                    return a.full_name.localeCompare(b.full_name, 'ru');
                });
            }

            return result.slice(0, COMBOBOX_LIMIT);
        }

        function pick(client) {
            select.value = client.id;
            input.value = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
            input.dataset.clientId = client.id;
            applyClientContacts(client);
            close();
            input.dispatchEvent(new CustomEvent('client-selected', { bubbles: true, detail: { client: client } }));
            input.blur();
        }

        function render(query) {
            dropdown.innerHTML = '';
            items = buildItems(query);

            const trimmed = (query || '').trim();

            if (trimmed && allClients.every(client => normalize(client.full_name) !== normalize(trimmed))) {
                const createRow = document.createElement('div');
                createRow.className = 'client-combobox__create';

                const createBtn = document.createElement('button');
                createBtn.type = 'button';
                createBtn.className = 'client-combobox__create-btn';
                createBtn.textContent = 'Создать клиента «' + trimmed + '»';

                createBtn.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    openInlineClientForm(trimmed);
                });

                createRow.appendChild(createBtn);
                dropdown.appendChild(createRow);
            }

            if (!items.length) {
                const empty = document.createElement('div');
                empty.className = 'client-combobox__empty';
                empty.textContent = query ? 'Клиенты не найдены' : 'Начните вводить имя клиента';
                dropdown.appendChild(empty);
                dropdown.classList.add('open');
                return;
            }

            items.forEach((client, position) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'client-combobox__option' + (position === index ? ' active' : '');
                option.dataset.clientId = client.id;

                const name = document.createElement('span');
                name.className = 'client-combobox__name';
                name.textContent = client.full_name;
                option.appendChild(name);

                const metaParts = [];

                if (client.agency) metaParts.push(client.agency);
                if (client.phone) metaParts.push(client.phone);
                if (client.city) metaParts.push(client.city);

                if (metaParts.length) {
                    const meta = document.createElement('span');
                    meta.className = 'client-combobox__meta';
                    meta.textContent = metaParts.join(' · ');
                    option.appendChild(meta);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(client);
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.add('open');
        }

        input.addEventListener('focus', function() {
            const selectedClient = allClients.find(client => String(client.id) === select.value);

            if (selectedClient && !this.value) {
                this.value = selectedClient.full_name + (selectedClient.agency ? ' (' + selectedClient.agency + ')' : '');
            }

            render(this.value);
        });

        input.addEventListener('input', function() {
            select.value = '';
            this.dataset.clientId = '';
            index = -1;
            render(this.value);
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.client-combobox__option');

            if (e.key === 'ArrowDown' && options.length) {
                e.preventDefault();
                index = (index + 1) % options.length;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
                options[index].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp' && options.length) {
                e.preventDefault();
                index = index <= 0 ? options.length - 1 : index - 1;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
                options[index].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                if (index >= 0 && items[index]) {
                    e.preventDefault();
                    pick(items[index]);
                }
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        input.addEventListener('blur', function() {
            if (inlineFormOpen) return;

            const typed = this.value.trim();

            setTimeout(() => {
                if (inlineFormOpen) return;
                if (!dropdown.classList.contains('open')) return;

                if (!typed) {
                    this.value = '';
                    select.value = '';
                    close();
                    return;
                }

                const exact = allClients.find(client => {
                    const label = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
                    return normalize(label) === normalize(typed) || normalize(client.full_name) === normalize(typed);
                });

                if (exact) {
                    select.value = exact.id;
                    this.dataset.clientId = exact.id;
                    this.value = exact.full_name + (exact.agency ? ' (' + exact.agency + ')' : '');
                } else if (!select.value) {
                    this.value = '';
                    this.dataset.clientId = '';
                }

                close();
            }, 120);
        });

        document.addEventListener('click', function(e) {
            if (inlineFormOpen) return;
            if (wrapper && !wrapper.contains(e.target)) close();
        });

        return {
            refresh: function() {
                const current = select.value;

                if (!current) return;

                const client = allClients.find(item => String(item.id) === String(current));

                if (client && !input.value) {
                    input.value = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
                }
            },
            setClient: function(id) {
                const client = allClients.find(item => String(item.id) === String(id));

                if (!client) {
                    select.value = '';
                    input.value = '';
                    return;
                }

                select.value = client.id;
                input.value = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
                input.dataset.clientId = client.id;
                close();
            },
            clear: function() {
                select.value = '';
                input.value = '';
                input.dataset.clientId = '';
                close();
            },
            getValue: function() {
                return select.value;
            }
        };
    }

    let orderRowsShown = 0;

    function servicesSummary(order) {
        const services = order.services || [];

        if (!services.length) {
            return '';
        }

        const parts = services.map(item => {
            if (!item) return '';

            if (typeof item === 'string') return item;

            const name = item.name || '';

            if (item.people_count_unknown || !item.people_count) {
                return name;
            }

            return name + ' ' + item.people_count;
        }).filter(Boolean);

        return parts.join(' · ');
    }

    function orderRow(order) {
        const badge = order.content_changed
            ? '<span class="orders-row__badge">Обновлено</span>'
            : '';
        const incompleteDot = order.is_incomplete
            ? '<span class="orders-row__dot" title="Заполнено не полностью"></span>'
            : '';
        const missingTitle = getMissingTitle(order);
        const dateLabel = order.has_date ? order.date_display || order.date : 'Без даты';
        const cityLabel = order.city_name || '';
        const servicesText = servicesSummary(order);
        const commentText = order.comment || '';
        const managerLabel = order.manager || '—';

        return `
            <tr class="${getRowClassNames(order)}" data-order-id="${order.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                <td class="orders-row__date"><span class="orders-row__date-value">${escapeHtml(dateLabel)}</span></td>
                <td class="orders-row__main">
                    <span class="orders-row__title">${escapeHtml(order.name || '—')}${badge}${incompleteDot}</span>
                    <span class="orders-row__meta">
                        ${cityLabel ? `<span class="orders-row__city">${escapeHtml(cityLabel)}</span>` : ''}
                        ${servicesText ? `<span class="orders-row__services">${escapeHtml(servicesText)}</span>` : ''}
                    </span>
                    ${commentText ? `<details class="orders-row__comment"><summary>Комментарий</summary><div class="orders-row__comment-text">${escapeHtml(commentText)}</div></details>` : ''}
                </td>
                <td class="orders-row__client">${escapeHtml(order.client)}</td>
                <td class="orders-row__manager">${escapeHtml(managerLabel)}</td>
                <td class="orders-row__cost">${order.cost || '—'}</td>
                <td><button class="view-link" data-id="${order.id}">Открыть</button></td>
            </tr>
        `;
    }

    function attachOrderRowEvents() {
        tableBody.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                openEditor(id);
            });
        });

        tableBody.querySelectorAll('tr[data-order-id]').forEach(row => {
            row.addEventListener('click', function() {
                const id = parseInt(row.getAttribute('data-order-id'));
                openEditor(id);
            });
        });
    }

    function buildOrderParams(limit) {
        const params = new URLSearchParams();

        params.set('search', searchInput.value.trim());
        params.set('status', statusFilter.value);
        params.set('limit', String(limit));

        if (dateFromInput && dateFromInput.value) params.set('date_from', dateFromInput.value);
        if (dateToInput && dateToInput.value) params.set('date_to', dateToInput.value);

        return params;
    }

    function fetchOrdersPage(limit, reset) {
        if (ordersLoadMoreBtn) ordersLoadMoreBtn.disabled = true;

        fetch(`/orders/list/?${buildOrderParams(limit).toString()}`)
            .then(response => response.json())
            .then(data => {
                if (ordersLoadMoreBtn) ordersLoadMoreBtn.disabled = false;

                const rows = (data.orders || []).slice().sort((a, b) => {
                    if (!!a.has_date !== !!b.has_date) return a.has_date ? 1 : -1;
                    return 0;
                });

                if (reset) {
                    tableBody.innerHTML = rows.length ? rows.map(orderRow).join('') : `
                        <tr>
                            <td colspan="6" style="text-align:center; padding: 2rem; color: #7a7267;">
                                Заказы не найдены
                            </td>
                        </tr>
                    `;
                } else {
                    const existing = new Set(
                        Array.from(tableBody.querySelectorAll('tr[data-order-id]'))
                            .map(row => row.getAttribute('data-order-id'))
                    );

                    const fresh = rows.filter(order => !existing.has(String(order.id)));

                    tableBody.insertAdjacentHTML('beforeend', fresh.map(orderRow).join(''));
                }

                orderRowsShown = tableBody.querySelectorAll('tr[data-order-id]').length;

                if (ordersLoadMore) {
                    ordersLoadMore.classList.toggle('load-more--done', !data.has_more);
                }

                attachOrderRowEvents();
            })
            .catch(error => {
                if (ordersLoadMoreBtn) ordersLoadMoreBtn.disabled = false;
                console.error('Ошибка загрузки заказов:', error);
                showToast('Ошибка загрузки заказов');
            });
    }

    function renderOrders() {
        if (!tableBody) return;

        saveDateFilter();
        orderRowsShown = 0;
        fetchOrdersPage(ORDERS_PAGE, true);
    }

    function updateOrderRow(data) {
        if (!data || !data.id) return;

        if (window.refreshSchedule) {
            window.refreshSchedule(true);
            return;
        }

        if (!tableBody) return;

        const row = tableBody.querySelector(`tr[data-order-id="${data.id}"]`);

        if (!row) return;

        const costCell = row.querySelector('.orders-row__cost');

        if (costCell && data.cost !== undefined) {
            costCell.textContent = data.cost || '—';
        }

        const titleNode = row.querySelector('.orders-row__title');

        if (titleNode && data.name) {
            const badge = titleNode.querySelector('.orders-row__badge');
            const dot = titleNode.querySelector('.orders-row__dot');

            titleNode.textContent = data.name;

            if (badge) titleNode.appendChild(badge);
            if (dot) titleNode.appendChild(dot);
        }

        const cityNode = row.querySelector('.orders-row__city');

        if (cityNode && data.city_name !== undefined) {
            cityNode.textContent = data.city_name || '';
        }

        const managerNode = row.querySelector('.orders-row__manager');

        if (managerNode && data.manager !== undefined) {
            managerNode.textContent = data.manager || '—';
        }

        const dateNode = row.querySelector('.orders-row__date-value');

        if (dateNode && data.date_display) {
            dateNode.textContent = data.date_display;
        }
    }

    window.updateOrderRow = updateOrderRow;

    function loadMoreOrders() {
        fetchOrdersPage(orderRowsShown + ORDERS_PAGE, false);
    }

    function openCreateModal(prefillDate) {
        if (!createModal) return;

        if (document.body.dataset.canManageOrders !== '1') {
            showToast('У вас нет прав на создание заказов');
            return;
        }

        createModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        createForm.reset();

        if (window.createOrderCityPicker) {
            window.createOrderCityPicker.reset();
        }

        if (window.createOrderNameSuggest) {
            window.createOrderNameSuggest.reset();
        }

        if (prefillDate) {
            createOrderDate.value = prefillDate;
        } else {
            createOrderDate.value = '';
        }
    }

    function closeCreateModal() {
        createModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function requestCloseCreateModal() {
        if (window.UI.isEmptyForm(createForm)) {
            closeCreateModal();
            return;
        }

        window.UI.confirm({
            title: 'Закрыть окно?',
            text: 'Вы действительно хотите закрыть создание заказа? Введённые данные не сохранятся.',
            okText: 'Закрыть',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeCreateModal();
        });
    }

    function openEditor(orderId) {
        if (window.OrderEditor && typeof window.OrderEditor.open === 'function') {
            window.OrderEditor.open(orderId);
            return true;
        }
        return false;
    }

    function tryOpenEditorFromUrl(attempts) {
        const urlParams = new URLSearchParams(window.location.search);
        const openOrderId = urlParams.get('open_order');
        if (!openOrderId) return;

        const id = parseInt(openOrderId);
        if (isNaN(id)) return;

        if (openEditor(id)) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
            return;
        }

        if (attempts > 0) {
            setTimeout(() => tryOpenEditorFromUrl(attempts - 1), 100);
        }
    }

    function openCreateClientModal(targetSelect) {
        createClientTargetSelect = targetSelect;
        createClientModal.classList.add('active');
        createClientForm.reset();

        const typeField = document.getElementById('newClientType');
        const agencyGroup = document.getElementById('newClientAgencyGroup');
        const agencySearch = document.getElementById('newClientAgencySearch');
        const agencySelect = document.getElementById('newClientAgency');
        const ratingField = document.getElementById('newClientRating');
        const commentField = document.getElementById('newClientComment');
        const cityField = document.getElementById('newClientCities');
        const phoneField = document.getElementById('newClientPhone');

        if (typeField) typeField.value = 'organizer';
        if (ratingField) ratingField.value = 'medium';
        if (commentField) commentField.value = '';
        if (agencySelect) agencySelect.value = '';
        if (agencySearch) agencySearch.value = '';
        if (agencyGroup) agencyGroup.style.display = 'none';
        if (phoneField) phoneField.value = '';

        if (cityField) {
            cityField.value = '';
        }

        if (window.createOrderCitySelector) {
            window.createOrderCitySelector.clear();
        }

        setTimeout(() => newClientFullName.focus(), 100);
    }

    function updateNewClientAgencyVisibility() {
        const typeField = document.getElementById('newClientType');
        const agencyGroup = document.getElementById('newClientAgencyGroup');

        if (!typeField || !agencyGroup) return;

        agencyGroup.style.display = typeField.value === 'agency' ? 'block' : 'none';
    }

    function newClientPhoneMask(input) {
        let digits = input.value.replace(/\D/g, '');

        if (digits.length > 0 && digits[0] !== '7' && digits[0] !== '8') {
            digits = '7' + digits;
        }

        if (digits.length > 0 && digits[0] === '8') {
            digits = '7' + digits.slice(1);
        }

        let formatted = '';

        if (digits.length > 0) {
            formatted = '+7';
            const remaining = digits.slice(1);

            if (remaining.length > 0) {
                formatted += ' (' + remaining.slice(0, 3);
                if (remaining.length > 3) {
                    formatted += ') ' + remaining.slice(3, 6);
                    if (remaining.length > 6) {
                        formatted += '-' + remaining.slice(6, 8);
                        if (remaining.length > 8) {
                            formatted += '-' + remaining.slice(8, 10);
                        }
                    }
                }
            }
        }

        input.value = formatted;
    }

    const newClientTypeField = document.getElementById('newClientType');
    const newClientPhoneField = document.getElementById('newClientPhone');

    function mountNewClientCitySelector() {
        const container = document.getElementById('newClientCitySelector');
        const hidden = document.getElementById('newClientCities');

        if (!container || !hidden || container.dataset.mounted === '1') return;

        let selected = [];
        let suggestions = [];
        let index = -1;
        let timer = null;
        let counter = 0;

        const field = document.createElement('div');
        field.className = 'city-selector__field';

        const chips = document.createElement('div');
        chips.className = 'city-selector__chips';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'city-selector__input';
        input.placeholder = 'Начните вводить город';
        input.autocomplete = 'off';

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';

        chips.appendChild(input);
        field.appendChild(chips);
        field.appendChild(dropdown);
        container.appendChild(field);
        container.dataset.mounted = '1';

        function sync() {
            hidden.value = selected.join(',');
        }

        function renderChips() {
            chips.querySelectorAll('.city-chip').forEach(chip => chip.remove());

            selected.forEach(name => {
                const chip = document.createElement('span');
                chip.className = 'city-chip';

                const label = document.createElement('span');
                label.textContent = name;

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'city-chip__remove';
                remove.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
                remove.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    selected = selected.filter(item => item !== name);
                    renderChips();
                });

                chip.appendChild(label);
                chip.appendChild(remove);
                chips.insertBefore(chip, input);
            });

            sync();
        }

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            suggestions = [];
            index = -1;
        }

        function add(name) {
            const clean = (name || '').trim();
            if (!clean) return;

            if (selected.some(item => item.toLowerCase() === clean.toLowerCase())) {
                input.value = '';
                close();
                return;
            }

            selected.push(clean);
            input.value = '';
            renderChips();
            close();
            input.focus();
        }

        function render(query) {
            dropdown.innerHTML = '';

            suggestions.forEach((city, position) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'city-selector__option' + (position === index ? ' active' : '');

                const name = document.createElement('span');
                name.className = 'city-selector__option-name';
                name.textContent = city.name;
                option.appendChild(name);

                if (city.subject) {
                    const subject = document.createElement('span');
                    subject.className = 'city-selector__option-subject';
                    subject.textContent = city.subject;
                    option.appendChild(subject);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    add(city.name);
                });

                dropdown.appendChild(option);
            });

            if (query && !selected.some(item => item.toLowerCase() === query.toLowerCase())) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'city-selector__option city-selector__option--create';
                create.textContent = 'Добавить город "' + query + '"';
                create.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    add(query);
                });
                dropdown.appendChild(create);
            }

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function load(query) {
            const current = ++counter;

            fetch('/clients/cities/?search=' + encodeURIComponent(query))
                .then(r => r.json())
                .then(data => {
                    if (current !== counter) return;
                    suggestions = data.cities || [];
                    index = -1;
                    render(query);
                })
                .catch(err => console.error(err));
        }

        input.addEventListener('input', function() {
            const query = this.value.trim();
            clearTimeout(timer);
            timer = setTimeout(() => load(query), 180);
        });

        input.addEventListener('focus', function() {
            clearTimeout(timer);
            timer = setTimeout(() => load(this.value.trim()), 60);
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.city-selector__option');

            if (e.key === 'Backspace' && !this.value && selected.length) {
                selected.pop();
                renderChips();
                return;
            }

            if (e.key === 'ArrowDown' && options.length) {
                e.preventDefault();
                index = (index + 1) % options.length;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'ArrowUp' && options.length) {
                e.preventDefault();
                index = index <= 0 ? options.length - 1 : index - 1;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const active = index >= 0 ? options[index] : options[0];
                if (active) {
                    active.dispatchEvent(new MouseEvent('mousedown'));
                } else {
                    add(this.value.trim());
                }
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) close();
        });

        window.createOrderCitySelector = {
            clear: function() {
                selected = [];
                input.value = '';
                renderChips();
                close();
            },
            getValues: function() {
                return selected.slice();
            }
        };
    }

    mountNewClientCitySelector();

    function mountCreateOrderCityPicker() {
        const wrapper = document.getElementById('createOrderCityPicker');
        const input = document.getElementById('createOrderCityInput');
        const dropdown = document.getElementById('createOrderCityDropdown');
        const hiddenId = document.getElementById('createOrderCityId');
        const hiddenName = document.getElementById('createOrderCityName');

        if (!wrapper || !input || !dropdown || hiddenId.dataset.mounted === '1') return;

        hiddenId.dataset.mounted = '1';

        let suggestions = [];
        let index = -1;
        let timer = null;
        let counter = 0;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            index = -1;
        }

        function pick(city) {
            hiddenId.value = city.id || '';
            hiddenName.value = city.name || '';
            input.value = city.name || '';
            close();
        }

        function createCity(name) {
            const trimmed = (name || '').trim();

            if (!trimmed) return;

            const existing = suggestions.find(city => city.name.toLowerCase() === trimmed.toLowerCase());

            if (existing) {
                pick(existing);
                return;
            }

            fetch('/orders/cities/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: new URLSearchParams({ name: trimmed }),
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                pick({ id: data.city.id, name: data.city.name });
                showToast('Город «' + data.city.name + '» добавлен');
            })
            .catch(() => showToast('Не удалось создать город'));
        }

        function render(query) {
            dropdown.innerHTML = '';

            const trimmed = (query || '').trim();
            const exact = suggestions.some(city => city.name.toLowerCase() === trimmed.toLowerCase());

            suggestions.forEach((city, position) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'single-city-picker__option' + (position === index ? ' active' : '');

                const name = document.createElement('span');
                name.className = 'single-city-picker__name';
                name.textContent = city.name;
                option.appendChild(name);

                if (city.subject) {
                    const subject = document.createElement('span');
                    subject.className = 'single-city-picker__subject';
                    subject.textContent = city.subject;
                    option.appendChild(subject);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(city);
                });

                dropdown.appendChild(option);
            });

            if (trimmed && !exact) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'single-city-picker__option single-city-picker__option--create';
                create.textContent = 'Создать город «' + trimmed + '»';
                create.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    createCity(trimmed);
                });
                dropdown.appendChild(create);
            }

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function load(query) {
            const current = ++counter;

            const params = new URLSearchParams();
            params.set('search', query);
            params.set('limit', '20');

            fetch('/clients/cities/?' + params.toString(), { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    if (current !== counter) return;
                    suggestions = data.cities || [];
                    index = -1;
                    render(query);
                })
                .catch(() => {});
        }

        input.addEventListener('input', function() {
            hiddenId.value = '';
            hiddenName.value = '';

            const query = this.value.trim();
            clearTimeout(timer);
            timer = setTimeout(() => load(query), 180);
        });

        input.addEventListener('focus', function() {
            clearTimeout(timer);
            timer = setTimeout(() => load(this.value.trim()), 60);
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.single-city-picker__option');

            if (e.key === 'ArrowDown' && options.length) {
                e.preventDefault();
                index = (index + 1) % options.length;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'ArrowUp' && options.length) {
                e.preventDefault();
                index = index <= 0 ? options.length - 1 : index - 1;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'Enter') {
                e.preventDefault();

                const active = index >= 0 ? options[index] : options[0];

                if (active && !active.classList.contains('single-city-picker__option--create')) {
                    active.dispatchEvent(new MouseEvent('mousedown'));
                } else {
                    createCity(this.value);
                }
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) close();
        });

        window.createOrderCityPicker = {
            reset: function() {
                hiddenId.value = '';
                hiddenName.value = '';
                input.value = '';
                close();
            },
            getValue: function() {
                return { id: hiddenId.value, name: hiddenName.value || input.value.trim() };
            }
        };
    }

    mountCreateOrderCityPicker();

    function mountCreateOrderNameSuggest() {
        const wrapper = document.getElementById('createOrderNamePicker');
        const input = document.getElementById('createOrderName');
        const dropdown = document.getElementById('createOrderNameDropdown');

        if (!wrapper || !input || !dropdown || wrapper.dataset.mounted === '1') return;

        wrapper.dataset.mounted = '1';

        let services = [];
        let filtered = [];
        let index = -1;
        let loaded = false;

        function parseName(value) {
            const text = (value || '').trim();

            if (!text) return { query: '', count: null };

            const match = text.match(/^(.*?)[\s,\-–—]*(\d+)?$/);

            if (!match) return { query: text.toLowerCase(), count: null };

            const query = (match[1] || '').trim().toLowerCase();
            const count = match[2] ? parseInt(match[2], 10) : null;

            return { query: query, count: count };
        }

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            filtered = [];
            index = -1;
        }

        function loadServices() {
            if (loaded) return Promise.resolve();

            return fetch('/orders/services/', { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    services = (data.services || []).filter(item => item.type === 'service');
                    loaded = true;
                })
                .catch(() => {});
        }

        function applyService(service) {
            const parsed = parseName(input.value);
            const count = parsed.count;

            input.value = service.name + (count !== null ? ' ' + count : ' ');
            input.dataset.serviceId = service.id;
            input.dataset.peopleCount = count !== null ? String(count) : '';
            close();
            input.focus();

            if (count !== null) {
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }

        function render() {
            dropdown.innerHTML = '';

            const parsed = parseName(input.value);

            if (!parsed.query) {
                close();
                return;
            }

            filtered = services.filter(item => item.name.toLowerCase().includes(parsed.query)).slice(0, 12);

            if (!filtered.length) {
                close();
                return;
            }

            filtered.forEach((service, position) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'single-city-picker__option' + (position === index ? ' active' : '');

                const name = document.createElement('span');
                name.className = 'single-city-picker__name';
                name.textContent = service.name;
                option.appendChild(name);

                if (parsed.count !== null) {
                    const meta = document.createElement('span');
                    meta.className = 'single-city-picker__subject';
                    meta.textContent = parsed.count + ' чел.';
                    option.appendChild(meta);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    applyService(service);
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.add('open');
        }

        input.addEventListener('input', function() {
            delete this.dataset.serviceId;
            delete this.dataset.peopleCount;

            const parsed = parseName(this.value);

            if (!parsed.query) {
                close();
                return;
            }

            loadServices().then(() => {
                index = -1;
                render();
            });
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.single-city-picker__option');

            if (e.key === 'ArrowDown' && options.length) {
                e.preventDefault();
                index = (index + 1) % options.length;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'ArrowUp' && options.length) {
                e.preventDefault();
                index = index <= 0 ? options.length - 1 : index - 1;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'Enter' && index >= 0 && filtered[index]) {
                e.preventDefault();
                applyService(filtered[index]);
            } else if (e.key === 'Escape') {
                close();
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(() => {
                if (filtered.length && index < 0) close();
            }, 120);
        });

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) close();
        });

        window.createOrderNameSuggest = {
            reset: function() {
                delete input.dataset.serviceId;
                delete input.dataset.peopleCount;
                close();
            },
            getService: function() {
                return {
                    id: input.dataset.serviceId ? parseInt(input.dataset.serviceId, 10) : null,
                    count: input.dataset.peopleCount ? parseInt(input.dataset.peopleCount, 10) : null,
                };
            }
        };
    }

    mountCreateOrderNameSuggest();

    if (newClientTypeField) {
        newClientTypeField.addEventListener('change', updateNewClientAgencyVisibility);
    }

    if (newClientPhoneField) {
        newClientPhoneField.addEventListener('input', function() { newClientPhoneMask(this); });
        newClientPhoneField.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        newClientPhoneField.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    function closeCreateClientModal() {
        createClientModal.classList.remove('active');
        createClientTargetSelect = null;
    }

    function requestCloseCreateClientModal() {
        if (window.UI.isEmptyForm(createClientForm)) {
            closeCreateClientModal();
            return;
        }

        window.UI.confirm({
            title: 'Закрыть окно?',
            text: 'Вы действительно хотите закрыть создание клиента? Введённые данные не сохранятся.',
            okText: 'Закрыть',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeCreateClientModal();
        });
    }

    function afterClientCreated(client) {
        showToast(`Клиент "${client.full_name}" создан`);

        if (!allClients.some(item => String(item.id) === String(client.id))) {
            allClients.push(client);
        }

        const newOption = document.createElement('option');
        newOption.value = client.id;
        newOption.textContent = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');

        if (createClientTargetSelect) {
            createClientTargetSelect.appendChild(newOption);
            createClientTargetSelect.value = client.id;
        }

        const editSelect = document.getElementById('editOrderClient');

        if (editSelect && createClientTargetSelect !== editSelect) {
            editSelect.appendChild(newOption.cloneNode(true));
        }

        if (createClientTargetSelect === createOrderClient && createClientPicker) {
            createClientPicker.setClient(client.id);
        }

        if (editClientPicker) {
            editClientPicker.refresh();
        }

        closeCreateClientModal();
    }

    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', function() {
            openCreateModal();
        });
    }

    if (createModalCloseBtn) {
        createModalCloseBtn.addEventListener('click', requestCloseCreateModal);
    }

    if (createModalCancelBtn) {
        createModalCancelBtn.addEventListener('click', requestCloseCreateModal);
    }

    if (createModal) {
        createModal.addEventListener('click', function(e) {
            if (e.target === this) requestCloseCreateModal();
        });
    }

    if (createClientModalCloseBtn) {
        createClientModalCloseBtn.addEventListener('click', requestCloseCreateClientModal);
    }

    if (createClientModalCancelBtn) {
        createClientModalCancelBtn.addEventListener('click', requestCloseCreateClientModal);
    }

    if (createClientModal) {
        createClientModal.addEventListener('click', function(e) {
            if (e.target === this) requestCloseCreateClientModal();
        });
    }

    if (createClientForm) {
        createClientForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const fullName = newClientFullName.value.trim();
            const phone = newClientPhone.value.trim();
            const telegramField = document.getElementById('newClientTelegram');
            const telegram = telegramField ? telegramField.value.trim() : '';

            const typeField = document.getElementById('newClientType');
            const agencySelect = document.getElementById('newClientAgency');
            const cityField = document.getElementById('newClientCities');

            const clientType = typeField ? typeField.value : 'organizer';
            const agencyId = agencySelect ? agencySelect.value : '';
            const cityNames = cityField ? cityField.value : '';

            if (!fullName) {
                showToast('Введите ФИО');
                return;
            }

            if (!phone && !telegram) {
                showToast('Укажите телефон или телеграм');
                return;
            }

            if (phone) {
                const phoneDigits = phone.replace(/\D/g, '');

                if (phoneDigits.length !== 11) {
                    showToast('Номер телефона должен содержать 11 цифр');
                    return;
                }
            }

            if (clientType === 'agency' && !agencyId) {
                showToast('Выберите агентство');
                return;
            }

            fetch('/clients/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({
                    full_name: fullName,
                    phone: phone,
                    client_type: clientType,
                    agency_id: agencyId,
                    telegram: telegram,
                    email: (document.getElementById('newClientEmail') || {}).value || '',
                    city_names: cityNames,
                    comment: (document.getElementById('newClientComment') || {}).value || '',
                    rating: (document.getElementById('newClientRating') || {}).value || 'medium'
                })
            })
            .then(r => r.json().then(body => ({ status: r.status, body: body })))
            .then(result => {
                const data = result.body;

                if (data.error) {
                    showToast(data.error);
                    return;
                }

                if (result.status === 409 && Array.isArray(data.matches) && data.matches.length) {
                    const firstMatch = data.matches[0];
                    const extra = data.matches.length > 1 ? ` и ещё ${data.matches.length - 1}` : '';

                    window.UI.confirm({
                        title: 'Найдено совпадение',
                        text: `В базе уже есть клиент: ${firstMatch.full_name}${extra}. Создать дубликат?`,
                        okText: 'Создать дубликат',
                        cancelText: 'Отмена'
                    }).then(confirmed => {
                        if (!confirmed) return;

                        fetch('/clients/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'X-CSRFToken': getCSRFToken()
                            },
                            body: new URLSearchParams({
                                full_name: fullName,
                                phone: phone,
                                client_type: clientType,
                                agency_id: agencyId,
                                telegram: telegram,
                                email: (document.getElementById('newClientEmail') || {}).value || '',
                                city_names: cityNames,
                                comment: (document.getElementById('newClientComment') || {}).value || '',
                                rating: (document.getElementById('newClientRating') || {}).value || 'medium',
                                force_create: '1'
                            })
                        })
                        .then(response => response.json())
                        .then(forceData => {
                            if (forceData.error) { showToast(forceData.error); return; }
                            if (forceData.success) afterClientCreated(forceData.client);
                        })
                        .catch(error => {
                            showToast('Ошибка создания клиента');
                            console.error(error);
                        });
                    });
                    return;
                }

                if (data.success) {
                    afterClientCreated(data.client);
                }
            })
            .catch(err => {
                showToast('Ошибка создания клиента');
                console.error(err);
            });
        });
    }

    if (createForm) {
        createForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const name = createOrderName.value.trim();
            const clientId = createOrderClient.value;
            const date = createOrderDate.value;

            if (!name) {
                showToast('Пожалуйста, введите название заказа');
                return;
            }
            if (!clientId) {
                showToast('Пожалуйста, выберите заказчика');
                return;
            }

            const cityValue = window.createOrderCityPicker
                ? window.createOrderCityPicker.getValue()
                : { id: '', name: '' };

            const serviceValue = window.createOrderNameSuggest
                ? window.createOrderNameSuggest.getService()
                : { id: null, count: null };

            const data = {
                name: name,
                client_id: clientId,
                date: date,
                city_id: cityValue.id || '',
                city_name: cityValue.id ? '' : (cityValue.name || ''),
                service_id: serviceValue.id ? String(serviceValue.id) : '',
                people_count: serviceValue.count !== null ? String(serviceValue.count) : '',
                concept: (document.getElementById('createOrderConcept') || {}).value || '',
            };

            const submitBtn = createForm.querySelector('[type="submit"]');

            if (isCreatingOrder) return;

            isCreatingOrder = true;

            if (submitBtn) {
                window.UI.setButtonBusy(submitBtn, true, 'Создание...');
            }

            fetch('/orders/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                if (data.success) {
                    closeCreateModal();

                    if (window.refreshSchedule) {
                        window.refreshSchedule(true);
                    }

                    showNotification(data.order.id, data.order.name || 'Новый заказ');
                }
            })
            .catch(error => {
                showToast('Ошибка при создании заказа');
                console.error(error);
            })
            .finally(() => {
                isCreatingOrder = false;

                if (submitBtn) {
                    window.UI.setButtonBusy(submitBtn, false);
                }
            });
        });
    }

    if (editorModalCloseBtn) {
        editorModalCloseBtn.addEventListener('click', function() {
            if (window.OrderEditor && typeof window.OrderEditor.close === 'function') {
                window.OrderEditor.close();
            }
        });
    }

    if (editorModal) {
        editorModal.addEventListener('click', function(e) {
            if (e.target === this && window.OrderEditor) {
                window.OrderEditor.close();
            }
        });
    }

    if (tableBody && searchInput) {
        let searchTimeout;

        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(renderOrders, 300);
        });

        if (statusFilter) statusFilter.addEventListener('change', renderOrders);

        if (ordersLoadMoreBtn) {
            ordersLoadMoreBtn.addEventListener('click', loadMoreOrders);
        }

        if (dateFromInput) dateFromInput.addEventListener('change', renderOrders);
        if (dateToInput) dateToInput.addEventListener('change', renderOrders);

        if (dateResetBtn) {
            dateResetBtn.addEventListener('click', function() {
                if (dateFromInput) dateFromInput.value = '';
                if (dateToInput) dateToInput.value = '';
                renderOrders();
            });
        }
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;

        const confirmElement = document.getElementById('uiConfirmModal');

        if (confirmElement && confirmElement.classList.contains('active')) {
            if ((createClientModal && createClientModal.classList.contains('active')) ||
                (createModal && createModal.classList.contains('active'))) {
                e.preventDefault();
            }

            return;
        }

        const openDropdowns = document.querySelectorAll('.city-selector__dropdown.open, .client-combobox__dropdown.open');

        if (openDropdowns.length) {
            openDropdowns.forEach(dropdown => dropdown.classList.remove('open'));
            return;
        }

        if (createClientModal && createClientModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseCreateClientModal();
        } else if (createModal && createModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseCreateModal();
        }
    }, true);

    createClientPicker = createClientCombobox('createOrderClientSearch', 'createOrderClient');
    editClientPicker = createClientCombobox('editOrderClientSearch', 'editOrderClient');

    if (editClientPicker) {
        window.getOrderClientPicker = function() {
            return editClientPicker;
        };

        const editSearch = document.getElementById('editOrderClientSearch');

        if (editSearch) {
            editSearch.addEventListener('client-selected', function(e) {
                if (e.detail && e.detail.client) applyClientContacts(e.detail.client);
            });
        }
    }


    let pendingOrderId = null;

    window.openOrderEditor = function(orderId) {
        return openEditor(orderId);
    };

    window.openCreateOrderModal = function(prefillDate) {
        openCreateModal(prefillDate || '');
    };

    window.setPendingOrderId = function(orderId) {
        pendingOrderId = orderId;

        if (openEditor(orderId)) {
            pendingOrderId = null;
        }
    };

    window.takePendingOrderId = function() {
        const value = pendingOrderId;
        pendingOrderId = null;
        return value;
    };

    loadClients();
    restoreDateFilter();

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('open_create') === '1') {
        const prefillDate = urlParams.get('create_date') || '';
        openCreateModal(prefillDate);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    if (urlParams.get('open_order')) {
        const orderId = parseInt(urlParams.get('open_order'), 10);

        if (!isNaN(orderId)) {
            window.history.replaceState({}, '', window.location.pathname);
            window.setPendingOrderId(orderId);
        }
    }
})();
