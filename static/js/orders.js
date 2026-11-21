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

            const id = parseInt(this.dataset.orderId);

            if (openEditor(id)) return;

            if (window.openOrderForm && window.openOrderForm(id)) return;
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
        let pendingCreate = null;

        function makeCreateButton(name) {
            const createRow = document.createElement('div');
            createRow.className = 'client-combobox__create';

            const createBtn = document.createElement('button');
            createBtn.type = 'button';
            createBtn.className = 'client-combobox__create-btn';
            createBtn.textContent = 'Создать клиента «' + name + '»';

            createBtn.addEventListener('mousedown', function(e) {
                e.preventDefault();
                openInlineClientForm(name);
                setTimeout(() => {
                    const contactInput = dropdown.querySelector('.client-inline-form [data-field="contact"]');

                    if (contactInput) contactInput.focus();
                }, 0);
            });

            createRow.appendChild(createBtn);

            return createRow;
        }

        function normalize(value) {
            return (value || '').toLowerCase().replace(/ё/g, 'е').trim();
        }

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
            index = -1;
            inlineFormOpen = false;
            pendingCreate = null;
        }

        function setSelectedClient(client) {
            if (!client) return;

            if (!allClients.some(item => String(item.id) === String(client.id))) {
                allClients.push(client);
            }

            let option = Array.prototype.find.call(select.options, item => String(item.value) === String(client.id));

            if (!option) {
                option = document.createElement('option');
                option.value = String(client.id);
                option.textContent = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
                select.appendChild(option);
            }

            option.selected = true;
            select.value = String(client.id);

            input.value = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
            input.dataset.clientId = String(client.id);

            applyClientContacts(client);
            input.dispatchEvent(new CustomEvent('client-selected', { bubbles: true, detail: { client: client } }));

            if (typeof syncCreateOrderPreview === 'function') {
                setTimeout(function() { safeCall('preview', syncCreateOrderPreview); }, 0);
            }
        }

        function openInlineClientForm(name) {
            inlineFormOpen = true;
            pendingCreate = null;
            dropdown.innerHTML = '';

            const form = document.createElement('div');
            form.className = 'client-inline-form';
            form.innerHTML = `
                <div class="client-inline-form__title">Новый клиент</div>
                <input type="text" class="client-inline-form__input" data-field="full_name" placeholder="Имя клиента *" value="${window.UI.escapeHtml(name || '')}">
                <select class="client-inline-form__input" data-field="client_type">
                    <option value="unknown">—</option>
                    <option value="organizer">Организатор</option>
                    <option value="agency">Агентство</option>
                </select>
                <input type="text" class="client-inline-form__input" data-field="agency" placeholder="Название агентства *" autocomplete="off" style="display:none;">
                <div class="client-inline-form__suggest" data-agency-suggest style="display:none;"></div>
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
            const agencySuggest = form.querySelector('[data-agency-suggest]');
            const contactInput = form.querySelector('[data-field="contact"]');
            const errorBox = form.querySelector('.client-inline-form__error');

            let agencyTimer = null;
            let agencyCounter = 0;

            function hideAgencySuggest() {
                if (!agencySuggest) return;

                agencySuggest.innerHTML = '';
                agencySuggest.style.display = 'none';
            }

            function renderAgencySuggest(agencies, query) {
                if (!agencySuggest || !agencies.length) {
                    hideAgencySuggest();
                    return;
                }

                const q = query.toLowerCase().replace(/ё/g, 'е');

                agencySuggest.innerHTML = '';

                agencies.forEach(function(agency) {
                    const alias = (agency.aliases || []).find(function(name) {
                        return name.toLowerCase().replace(/ё/g, 'е').indexOf(q) !== -1;
                    });

                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'client-inline-form__suggest-item';
                    option.textContent = agency.name;

                    if (alias) {
                        const hint = document.createElement('span');
                        hint.className = 'client-inline-form__suggest-hint';
                        hint.textContent = 'вариация: ' + alias;
                        option.appendChild(hint);
                    }

                    option.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        agencyInput.value = agency.name;
                        hideAgencySuggest();
                        contactInput.focus();
                    });

                    agencySuggest.appendChild(option);
                });

                agencySuggest.style.display = 'block';
            }

            agencyInput.addEventListener('input', function() {
                const query = agencyInput.value.trim();

                clearTimeout(agencyTimer);
                hideAgencySuggest();

                if (!query) return;

                const current = ++agencyCounter;

                agencyTimer = setTimeout(function() {
                    fetch('/agencies/catalog/?search=' + encodeURIComponent(query))
                        .then(function(response) { return response.json(); })
                        .then(function(data) {
                            if (current !== agencyCounter) return;
                            renderAgencySuggest(data.agencies || [], query);
                        })
                        .catch(function(error) { console.error(error); });
                }, 180);
            });

            agencyInput.addEventListener('blur', function() {
                setTimeout(hideAgencySuggest, 120);
            });

            const syncAgencyVisibility = function() {
                agencyInput.style.display = typeInput.value === 'agency' ? '' : 'none';

                if (typeInput.value !== 'agency') hideAgencySuggest();
            };

            typeInput.addEventListener('change', syncAgencyVisibility);
            moveOnEnter(nameInput, typeInput.value === 'agency' ? agencyInput : contactInput);
            moveOnEnter(agencyInput, contactInput);

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
                    if (data.error || data.duplicate || (Array.isArray(data.matches) && data.matches.length)) {
                        errorBox.textContent = data.error || 'Похожий клиент уже существует';
                        errorBox.style.display = 'block';
                        return;
                    }

                    if (data.client) {
                        setSelectedClient(data.client);
                        close();
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

            form.querySelectorAll('select').forEach(field => {
                field.addEventListener('keydown', function(e) {
                    if (e.key !== 'Enter') return;

                    e.preventDefault();
                    syncAgencyVisibility();
                    contactInput.focus();
                });
            });
        }

        function moveOnEnter(field, nextField) {
            field.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter') return;

                e.preventDefault();

                if (nextField) nextField.focus();
            });
        }

        function digitsOnly(value) {
            return String(value || '').replace(/\D/g, '');
        }

        function telegramKey(value) {
            return String(value || '').toLowerCase().replace(/[@\s\-_.]/g, '');
        }

        function buildItems(query) {
            const search = normalize(query);
            const searchDigits = digitsOnly(query);
            const searchTelegram = telegramKey(query);

            let result = allClients.slice();

            if (search) {
                result = result.filter(client => {
                    const agencyAliases = Array.isArray(client.agency_aliases) ? client.agency_aliases : [];

                    const text = [
                        client.full_name,
                        client.agency,
                        client.city
                    ].concat(agencyAliases).map(normalize).join(' ');

                    if (text.indexOf(search) !== -1) return true;

                    if (searchDigits.length >= 2) {
                        const phoneDigits = digitsOnly(client.phone);

                        if (phoneDigits && phoneDigits.indexOf(searchDigits) !== -1) return true;
                    }

                    if (searchTelegram.length >= 1) {
                        const telegram = telegramKey(client.telegram) || telegramKey(client.telegram_username);

                        if (telegram && telegram.indexOf(searchTelegram) !== -1) return true;
                    }

                    return false;
                });

                result.sort((a, b) => {
                    const aStart = normalize(a.full_name).indexOf(search) === 0 ? 0 : 1;
                    const bStart = normalize(b.full_name).indexOf(search) === 0 ? 0 : 1;

                    if (aStart !== bStart) return aStart - bStart;

                    return String(a.full_name).localeCompare(String(b.full_name), 'ru');
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

            if (selectId === 'createOrderClient' || selectId === 'editOrderClient') {
                if (typeof syncCreateOrderPreview === 'function') {
                    setTimeout(function() { safeCall('preview', syncCreateOrderPreview); }, 0);
                }
            }

            input.blur();
        }

        function render(query) {
            dropdown.innerHTML = '';
            items = buildItems(query);

            const trimmed = (query || '').trim();
            const canCreate = trimmed && allClients.every(client => normalize(client.full_name) !== normalize(trimmed));

            if (canCreate) {
                dropdown.appendChild(makeCreateButton(trimmed));
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

                const main = document.createElement('span');
                main.className = 'client-combobox__main';

                const name = document.createElement('span');
                name.className = 'client-combobox__name';
                name.textContent = client.full_name;
                main.appendChild(name);

                const metaParts = [];

                if (client.phone) metaParts.push(client.phone);
                if (client.city) metaParts.push(client.city);

                if (metaParts.length) {
                    const meta = document.createElement('span');
                    meta.className = 'client-combobox__meta';
                    meta.textContent = metaParts.join(' · ');
                    main.appendChild(meta);
                }

                option.appendChild(main);

                if (client.agency) {
                    const agency = document.createElement('span');
                    agency.className = 'client-combobox__agency';
                    agency.textContent = client.agency;
                    option.appendChild(agency);
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
                e.preventDefault();

                if (index >= 0 && items[index]) {
                    pick(items[index]);
                    return;
                }

                if (items.length) {
                    pick(items[0]);
                    return;
                }

                const typed = this.value.trim();

                if (typed) pendingCreate = typed;
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        input.addEventListener('blur', function() {
            if (inlineFormOpen) return;

            if (pendingCreate) {
                const name = pendingCreate;

                pendingCreate = null;
                setTimeout(() => openInlineClientForm(name), 0);
                return;
            }

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

                if (!Array.prototype.some.call(select.options, option => String(option.value) === String(client.id))) {
                    const option = document.createElement('option');
                    option.value = String(client.id);
                    option.textContent = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
                    select.appendChild(option);
                }

                select.value = String(client.id);
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

    let createOrderStatus = 'request';
    let createOrderManagers = [];

    function createOrderField(id) {
        return document.getElementById(id);
    }

    function createOrderFieldValue(id) {
        const node = createOrderField(id);

        return node ? String(node.value || '').trim() : '';
    }

    function getCreateOrderName() {
        if (!createOrderName) return '';

        return (createOrderName.isContentEditable ? createOrderName.textContent : createOrderName.value || '').trim();
    }

    function setCreateOrderName(value) {
        if (!createOrderName) return;

        if (createOrderName.isContentEditable) {
            createOrderName.textContent = value || '';
        } else {
            createOrderName.value = value || '';
        }
    }

    function getCreateOrderPaymentFlags() {
        return {
            cash: !!(createOrderField('createOrderPayCash') || {}).checked,
            ip: !!(createOrderField('createOrderPayIp') || {}).checked,
            self: !!(createOrderField('createOrderPaySelf') || {}).checked,
        };
    }

    const PAYMENT_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    function formatPaymentDueLabel(value) {
        const text = String(value || '').trim();

        if (!text) return '';

        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (match) {
            return Number(match[3]) + ' ' + PAYMENT_MONTHS[Number(match[2]) - 1];
        }

        return text.replace(/\.\d{4}$/, '').replace(/\s+\d{4}\s*$/, '').trim();
    }

    const PAYMENT_METHOD_ORDER = ['cash', 'ip', 'self'];

    function splitPaymentMethods(value) {
        return String(value || '')
            .split(/[,;\s]+/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function getCreateOrderPaymentMethods() {
        const flags = getCreateOrderPaymentFlags();

        return PAYMENT_METHOD_ORDER.filter(key => flags[key]);
    }

    function setCreateOrderPaymentFlags(value) {
        const selected = splitPaymentMethods(value);

        [['createOrderPayCash', 'cash'], ['createOrderPayIp', 'ip'], ['createOrderPaySelf', 'self']].forEach(function(pair) {
            const node = createOrderField(pair[0]);

            if (node) node.checked = selected.indexOf(pair[1]) !== -1;
        });
    }

    function getCreateOrderPaymentMethod() {
        return getCreateOrderPaymentMethods().join(',');
    }

    function autoGrowNode(node) {
        if (!node || node.tagName !== 'TEXTAREA') return;

        node.style.height = 'auto';
        node.style.height = Math.max(node.scrollHeight, 22) + 'px';
    }

    function autoGrowAll() {
        document.querySelectorAll('#createOrderModal textarea.cof-field').forEach(autoGrowNode);
    }

    window.addEventListener('resize', autoGrowAll);

    function isInsideCreateModal(e) {
        return createModal && createModal.contains(e.target);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        if (!isInsideCreateModal(e)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const target = e.target;

        if (!target || target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

        if (target.tagName === 'TEXTAREA') {
            if (!e.shiftKey) return;

            e.preventDefault();

            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;

            target.value = value.slice(0, start) + '\n' + value.slice(end);
            target.selectionStart = target.selectionEnd = start + 1;

            autoGrowNode(target);
            syncCreateOrderPreview();
            return;
        }

        if (target.type === 'checkbox' || target.type === 'radio' || target.type === 'button') return;

        e.preventDefault();
        target.blur();
    }, true);

    function syncCreateOrderStatus() {
        const box = createOrderField('createOrderStatusSwitch');

        if (!box) return;

        box.querySelectorAll('[data-status]').forEach(function(btn) {
            btn.classList.toggle('is-on', btn.dataset.status === createOrderStatus);
        });
    }

    function formatNumber(value) {
        return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    function mountCreateOrderServiceInput() {
        const input = createOrderField('createOrderServiceInput');
        const dropdown = createOrderField('createOrderServiceDropdown');

        if (!input || !dropdown || input.dataset.mounted === '1') return;

        input.dataset.mounted = '1';

        let services = [];
        let loaded = false;
        let current = null;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
        }

        function load() {
            if (loaded) return Promise.resolve();

            return fetch('/orders/services/', { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    services = (data.services || [])
                        .filter(item => item.type === 'service')
                        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
                    loaded = true;
                })
                .catch(() => {});
        }

        function pickByValue() {
            const value = input.value.trim().toLowerCase();

            if (!value) return null;

            const exact = services.find(item => String(item.name).toLowerCase() === value);

            if (exact) return exact;

            return services.find(item => String(item.name).toLowerCase().includes(value)) || null;
        }

        function currentCount() {
            const match = input.value.match(/(\d+)\s*(?:чел|человек)?\s*$/i);
            const people = match ? parseInt(match[1], 10) : NaN;

            return !isNaN(people) && people > 0 ? people : null;
        }

        function pick(service) {
            const count = currentCount();

            const rows = (service.staff_rows || []).slice().sort((a, b) => a.artist_count - b.artist_count);
            let price = rows.length ? Number(rows[0].cost) : 0;

            if (rows.length && count) {
                const matched = rows.find(row => row.artist_count >= count) || rows[rows.length - 1];
                price = Number(matched.cost);
            }

            current = service;
            input.value = service.name + (count ? ' ' + count : '');
            input.dataset.serviceId = service.id;

            if (createOrderName) {
                createOrderName.textContent = service.name;
            }

            const costField = createOrderField('createOrderCost');

            if (costField && rows.length) costField.value = String(Math.round(price));

            close();
            syncCreateOrderPreview();
        }

        function render() {
            dropdown.innerHTML = '';

            const query = input.value.trim().toLowerCase();
            const matches = query
                ? services.filter(item => item.name.toLowerCase().includes(query)).slice(0, 10)
                : services.slice(0, 10);

            if (!matches.length) {
                close();
                return;
            }

            matches.forEach(function(service) {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'single-city-picker__option';

                const name = document.createElement('span');
                name.className = 'single-city-picker__name';
                name.textContent = service.name;
                option.appendChild(name);

                const rows = (service.staff_rows || []).slice().sort((a, b) => a.artist_count - b.artist_count);

                if (rows.length) {
                    const meta = document.createElement('span');
                    meta.className = 'single-city-picker__subject';

                    const min = Math.round(Number(rows[0].cost));
                    const max = Math.round(Number(rows[rows.length - 1].cost));

                    meta.textContent = min === max
                        ? formatNumber(min) + ' ₽'
                        : formatNumber(min) + '–' + formatNumber(max) + ' ₽';

                    option.appendChild(meta);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(service);
                });

                option.addEventListener('click', function(e) {
                    e.preventDefault();
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.add('open');
        }

        input.addEventListener('focus', function() {
            load();
        });

        input.addEventListener('input', function() {
            current = null;
            load().then(render);
        });

        input.addEventListener('blur', function() {
            if (!input.value.trim()) current = null;
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.single-city-picker__option');

            if (e.key === 'Enter') {
                e.preventDefault();

                if (options.length) {
                    options[0].dispatchEvent(new MouseEvent('mousedown'));
                    return;
                }

                const found = pickByValue();

                if (found) pick(found);
            } else if (e.key === 'Escape') {
                close();
            }
        });

        input.addEventListener('change', function() {
            if (current) return;

            const found = pickByValue();

            if (found) {
                pick(found);
            } else {
                current = null;
                delete input.dataset.serviceId;
                syncCreateOrderPreview();
            }
        });

        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target) && e.target !== input) close();
        });

        window.createOrderServicePicker = {
            reset: function() {
                current = null;
                input.value = '';
                delete input.dataset.serviceId;
                close();
            },
            getService: function() {
                if (!current) return { id: null, count: null };

                return {
                    id: current.id,
                    count: currentCount(),
                };
            },
            setValue: function(service) {
                current = null;

                if (!service || !service.id) {
                    input.value = '';
                    delete input.dataset.serviceId;
                    setCreateOrderName('');
                    close();
                    return;
                }

                load().then(function() {
                    const found = services.find(item => String(item.id) === String(service.id));

                    current = found
                        ? found
                        : {
                            id: service.id,
                            name: service.name || '',
                            staff_rows: service.staff_rows || [],
                        };

                    input.value = (current.name || '') + (service.count ? ' ' + service.count : '');
                    input.dataset.serviceId = current.id;
                    setCreateOrderName(current.name || '');
                    close();
                    syncCreateOrderPreview();
                });
            },
            fillFrom: function(container, service) {
                current = null;

                if (!service || !service.id) return Promise.resolve();

                return load().then(function() {
                    const found = services.find(item => String(item.id) === String(service.id));

                    current = found
                        ? found
                        : {
                            id: service.id,
                            name: service.name || '',
                            staff_rows: service.staff_rows || [],
                        };

                    input.value = (current.name || '') + (service.count ? ' ' + service.count : '');
                    input.dataset.serviceId = current.id;
                    close();
                });
            }
        };
    }

    let createOrderEmployees = [];
    let draggedShowRow = null;

    function loadCreateOrderEmployees() {
        if (createOrderEmployees.length) return Promise.resolve(createOrderEmployees);

        return fetch('/employees/list/?limit=200', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                createOrderEmployees = data.employees || [];
                return createOrderEmployees;
            })
            .catch(() => createOrderEmployees);
    }

    let artistNote = null;
    let artistNoteOwner = null;
    let artistNoteChip = null;

    function closeArtistNote() {
        if (artistNote) {
            artistNote.remove();
            artistNote = null;
        }

        if (artistNoteChip) {
            artistNoteChip = null;
        }

        artistNoteOwner = null;
    }

    function commitArtistNote(value) {
        const row = artistNoteOwner;
        const employeeId = artistNote ? artistNote.dataset.employeeId : '';

        if (!row || !employeeId) return;

        const artists = getRowArtists(row).slice();
        const index = artists.findIndex(item => String(item.employee_id) === String(employeeId));

        if (index === -1) return;

        const next = (value || '').trim();

        if ((artists[index].comment || '') === next) return;

        artists[index].comment = next;

        if (artistNoteChip) {
            artistNoteChip.classList.toggle('cof-chip--noted', !!next);
            artistNoteChip.title = next || 'Комментарий к артисту';
        }

        setRowArtists(row, artists);
        syncCreateOrderPreview();
    }

    function commitArtistFlag(flag, value) {
        const row = artistNoteOwner;
        const employeeId = artistNote ? artistNote.dataset.employeeId : '';

        if (!row || !employeeId) return;

        const artists = getRowArtists(row).slice();
        const index = artists.findIndex(item => String(item.employee_id) === String(employeeId));

        if (index === -1) return;

        if (value) {
            artists.forEach(function(item) {
                if (item[flag]) item[flag] = false;
            });
        }

        if (!!artists[index][flag] === !!value) {
            setRowArtists(row, artists);
            syncCreateOrderPreview();
            return;
        }

        artists[index][flag] = !!value;

        setRowArtists(row, artists);
        syncCreateOrderPreview();

        const freshChip = row.querySelector('[data-artist-chip="' + employeeId + '"]');

        if (freshChip) {
            artistNoteChip = freshChip;
            refreshArtistNotePosition(freshChip);
        }
    }

    function refreshArtistNotePosition(chip) {
        if (!artistNote || !chip) return;

        const rect = chip.getBoundingClientRect();
        const width = artistNote.offsetWidth;
        const height = artistNote.offsetHeight;
        let left = rect.left;

        if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
        if (left < 10) left = 10;

        let top = rect.top - height - 8;

        if (top < 10) top = rect.bottom + 8;

        artistNote.style.left = left + 'px';
        artistNote.style.top = top + 'px';
    }

    function openArtistNote(chip, row, artist, position) {
        closeArtistNote();

        const note = document.createElement('div');

        note.className = 'cof-artist-note';
        note.dataset.employeeId = String(artist.employee_id || '');
        note.innerHTML = '<textarea class="cof-field cof-field--area cof-artist-note__text" rows="2" placeholder="Комментарий"></textarea>'
            + '<div class="cof-artist-note__flags">'
            + '<label class="cof-check" data-label="Отв"><input type="checkbox" data-artist-flag="is_responsible"> Отв</label>'
            + '<label class="cof-check" data-label="Сториз"><input type="checkbox" data-artist-flag="is_story"> Сториз</label>'
            + '</div>';

        document.body.appendChild(note);

        const text = note.querySelector('.cof-artist-note__text');
        const responsible = note.querySelector('[data-artist-flag="is_responsible"]');
        const story = note.querySelector('[data-artist-flag="is_story"]');

        text.value = artist.comment || '';

        const rect = chip.getBoundingClientRect();
        const width = note.offsetWidth;
        const height = note.offsetHeight;
        let left = rect.left;

        if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
        if (left < 10) left = 10;

        let top = rect.top - height - 8;

        if (top < 10) top = rect.bottom + 8;

        note.style.left = left + 'px';
        note.style.top = top + 'px';

        if (artist.comment) chip.classList.add('cof-chip--noted');

        artistNote = note;
        artistNoteOwner = row;
        artistNoteChip = chip;

        text.focus();
        text.setSelectionRange(text.value.length, text.value.length);

        text.addEventListener('input', function() {
            commitArtistNote(text.value);
        });

        text.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeArtistNote();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                closeArtistNote();
            }
        });

        [responsible, story].forEach(function(box) {
            if (box) box.checked = !!artist[box.dataset.artistFlag];

            if (!box) return;

            box.addEventListener('change', function() {
                commitArtistFlag(box.dataset.artistFlag, box.checked);

                if (box.dataset.artistFlag === 'is_responsible' && box.checked) responsible.checked = true;
                if (box.dataset.artistFlag === 'is_story' && box.checked) story.checked = true;

                if (!box.checked) return;

                const other = box.dataset.artistFlag === 'is_responsible' ? story : responsible;

                if (other) other.checked = false;
            });
        });

        note.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });

        document.addEventListener('mousedown', function onOutside(e) {
            if (!artistNote || note.contains(e.target)) return;
            if (chip.contains(e.target)) return;

            document.removeEventListener('mousedown', onOutside);
            closeArtistNote();
        });
    }

    function renderShowArtists(container, artists, row) {
        container.innerHTML = '';

        artists.forEach(function(artist, position) {
            const chip = document.createElement('span');

            chip.className = 'cof-chip cof-chip--artist';
            chip.dataset.artistChip = String(artist.employee_id || '');

            if (artist.comment) chip.classList.add('cof-chip--noted');
            if (artist.is_responsible) chip.classList.add('cof-chip--responsible');
            if (artist.is_story) chip.classList.add('cof-chip--story');

            chip.title = [artist.comment, artist.is_story ? 'Сториз' : '', artist.is_responsible ? 'Отв' : '']
                .filter(Boolean).join(' · ') || 'Комментарий к артисту';
            chip.innerHTML = '<span>' + window.UI.escapeHtml(artist.name || '') + '</span>';

            const remove = document.createElement('button');

            remove.type = 'button';
            remove.className = 'cof-chip__x';
            remove.textContent = '×';
            remove.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
            });
            remove.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const next = getRowArtists(row).slice();

                next.splice(position, 1);
                setRowArtists(row, next);
                syncCreateOrderPreview();
            });

            chip.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (remove.contains(e.target)) return;

                if (artistNoteOwner === row && artistNote && artistNote.dataset.employeeId === String(artist.employee_id)) {
                    closeArtistNote();
                    return;
                }

                openArtistNote(chip, row, artist, position);
            });

            chip.appendChild(remove);
            container.appendChild(chip);
        });
    }

    function syncShowServiceWidth(row) {
        const input = row.querySelector('[data-show-input]');

        if (!input) return;

        input.style.width = '';

        const style = window.getComputedStyle(input);
        const mirror = document.createElement('span');

        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.whiteSpace = 'pre';
        mirror.style.fontFamily = style.fontFamily;
        mirror.style.fontSize = style.fontSize;
        mirror.style.fontWeight = style.fontWeight;
        mirror.style.letterSpacing = style.letterSpacing;
        mirror.textContent = input.value || 'Название шоу';

        document.body.appendChild(mirror);

        const measured = mirror.offsetWidth;

        document.body.removeChild(mirror);

        input.style.width = Math.min(Math.max(measured + 10, 84), 340) + 'px';
    }

    function createShowRow() {
        const row = document.createElement('div');

        row.className = 'cof-show-row';
        row.dataset.artists = '[]';

        row.innerHTML = `
            <span class="cof-show-row__handle" data-show-handle draggable="true" title="Перетащить шоу">⋮⋮</span>
            <textarea class="cof-field cof-field--area cof-show-row__time" data-show-time rows="1" placeholder="18:00"></textarea>
            <div class="cof-show-row__main">
                <div class="cof-show-row__inline">
                    <div class="cof-service cof-show-row__service">
                        <input type="text" class="cof-field" data-show-input placeholder="Название шоу" autocomplete="off">
                        <div class="single-city-picker__dropdown" data-show-dropdown></div>
                    </div>
                    <div class="cof-chips cof-show-row__artist-chips" data-show-artists></div>
                    <div class="cof-picker cof-show-row__artists">
                        <input type="text" class="cof-field cof-picker__input" data-show-artist-input placeholder="Артисты" autocomplete="off">
                    </div>
                </div>
                <div class="single-city-picker__dropdown cof-show-row__artist-dropdown" data-show-artist-dropdown></div>
            </div>
            <button type="button" class="cof-repeat__remove" data-show-remove title="Удалить шоу">&times;</button>
        `;

        return row;
    }

    function getRowArtists(row) {
        try {
            return JSON.parse(row.dataset.artists || '[]');
        } catch (error) {
            return [];
        }
    }

    function setRowArtists(row, artists) {
        row.dataset.artists = JSON.stringify(artists || []);
        renderShowArtists(row.querySelector('[data-show-artists]'), getRowArtists(row), row);
    }

    function mountArtistPicker(row) {
        const input = row.querySelector('[data-show-artist-input]');
        const dropdown = row.querySelector('[data-show-artist-dropdown]');
        const chips = row.querySelector('[data-show-artists]');
        let employees = [];

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
        }

        function toggle(employee) {
            const artists = getRowArtists(row).slice();
            const exists = artists.some(item => String(item.employee_id) === String(employee.id));

            if (exists) {
                artists.splice(artists.findIndex(item => String(item.employee_id) === String(employee.id)), 1);
            } else {
                artists.push({
                    employee_id: employee.id,
                    name: employee.display_name || employee.full_name,
                    role: employee.role_display || '',
                    comment: '',
                    is_responsible: false,
                    is_story: false,
                });
            }

            input.value = '';
            setRowArtists(row, artists);
            render();
            syncCreateOrderPreview();
        }

        function render() {
            dropdown.innerHTML = '';

            const artists = getRowArtists(row);
            const query = input.value.trim().toLowerCase();
            const matches = employees
                .filter(item => {
                    const label = (item.display_name || item.full_name || '').toLowerCase();
                    return !query || label.indexOf(query) !== -1;
                })
                .slice(0, 20);

            if (!matches.length) {
                close();
                return;
            }

            matches.forEach(function(employee) {
                const picked = artists.some(item => String(item.employee_id) === String(employee.id));
                const option = document.createElement('button');

                option.type = 'button';
                option.className = 'single-city-picker__option' + (picked ? ' active' : '');

                const name = document.createElement('span');

                name.className = 'single-city-picker__name';
                name.textContent = employee.display_name || employee.full_name;
                option.appendChild(name);

                if (employee.role_display) {
                    const meta = document.createElement('span');

                    meta.className = 'single-city-picker__subject';
                    meta.textContent = employee.role_display;
                    option.appendChild(meta);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    toggle(employee);
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.add('open');
        }

        input.addEventListener('focus', function() {
            loadCreateOrderEmployees().then(function(list) {
                employees = list;
                render();
            });
        });

        input.addEventListener('input', render);

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const first = dropdown.querySelector('.single-city-picker__option');

                if (first) {
                    e.preventDefault();
                    first.dispatchEvent(new MouseEvent('mousedown'));
                }
            } else if (e.key === 'Escape') {
                close();
            }
        });

        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target) && e.target !== input) close();
        });

        document.addEventListener('click', function(e) {
            if (artistNoteOwner !== row || !artistNote) return;
            if (artistNote.contains(e.target) || chips.contains(e.target)) return;

            closeArtistNote();
        });

        renderShowArtists(chips, getRowArtists(row), row);
    }

    function attachShowDrag(row) {
        const handle = row.querySelector('[data-show-handle]');

        if (!handle) return;

        handle.addEventListener('dragstart', function(e) {
            row.classList.add('cof-show-row--dragging');
            e.dataTransfer.effectAllowed = 'move';

            try {
                e.dataTransfer.setData('text/plain', 'show-row');
            } catch (error) {}

            draggedShowRow = row;
        });

        handle.addEventListener('dragend', function() {
            row.classList.remove('cof-show-row--dragging');
            draggedShowRow = null;
            clearShowDropMarks();

            if (document.getElementById('createOrderModal').classList.contains('active')) {
                syncCreateOrderPreview();
            }
        });

        row.addEventListener('dragover', function(e) {
            if (!draggedShowRow || draggedShowRow === row) return;

            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const rect = row.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;

            clearShowDropMarks();
            row.classList.add(after ? 'cof-show-row--drop-after' : 'cof-show-row--drop-before');
        });

        row.addEventListener('dragleave', function(e) {
            if (row.contains(e.relatedTarget)) return;

            row.classList.remove('cof-show-row--drop-before', 'cof-show-row--drop-after');
        });

        row.addEventListener('drop', function(e) {
            if (!draggedShowRow || draggedShowRow === row) return;

            e.preventDefault();

            const rect = row.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;

            if (after) {
                row.parentNode.insertBefore(draggedShowRow, row.nextSibling);
            } else {
                row.parentNode.insertBefore(draggedShowRow, row);
            }

            clearShowDropMarks();

            if (document.getElementById('createOrderModal').classList.contains('active')) {
                syncCreateOrderPreview();
            }
        });
    }

    function clearShowDropMarks() {
        document.querySelectorAll('.cof-show-row--drop-before, .cof-show-row--drop-after').forEach(function(node) {
            node.classList.remove('cof-show-row--drop-before', 'cof-show-row--drop-after');
        });
    }

    function getCreateOrderShowRows() {
        const box = createOrderField('createOrderShows');

        return box ? Array.prototype.slice.call(box.querySelectorAll('.cof-show-row')) : [];
    }

    function addCreateOrderShow(data) {
        if (!document.getElementById('createOrderShows')) return;

        const box = createOrderField('createOrderShows');

        if (!box) return;

        const row = createShowRow();

        box.appendChild(row);

        const timeInput = row.querySelector('[data-show-time]');
        const serviceInput = row.querySelector('[data-show-input]');
        const dropdown = row.querySelector('[data-show-dropdown]');
        const remove = row.querySelector('[data-show-remove]');

        attachServicePicker(serviceInput, dropdown);
        mountArtistPicker(row);
        attachShowDrag(row);

        remove.addEventListener('click', function() {
            row.remove();
            syncCreateOrderPreview();
        });

        [timeInput, serviceInput].forEach(function(node) {
            node.addEventListener('input', syncCreateOrderPreview);
        });

        serviceInput.addEventListener('input', function() {
            syncShowServiceWidth(row);
        });

        syncShowServiceWidth(row);

        timeInput.addEventListener('input', function() {
            autoGrowNode(timeInput);
        });

        autoGrowNode(timeInput);

        if (data) {
            timeInput.value = data.time || '';

            serviceInput.value = data.name || '';

            if (data.id) serviceInput.dataset.serviceId = data.id;

            setRowArtists(row, data.employees || []);
        }

        syncShowServiceWidth(row);

        if (document.getElementById('createOrderModal').classList.contains('active')) {
            syncCreateOrderPreview();
        }
    }

    function resetCreateOrderShows() {
        const box = createOrderField('createOrderShows');

        if (!box) return;

        box.innerHTML = '';
        addCreateOrderShow(null);
    }

    function getCreateOrderShows() {
        return getCreateOrderShowRows().map(function(row, index) {
            const timeInput = row.querySelector('[data-show-time]');
            const serviceInput = row.querySelector('[data-show-input]');
            const artists = getRowArtists(row);

            return {
                id: serviceInput.dataset.serviceId || '',
                name: serviceInput.value.trim(),
                count: artists.length || null,
                time: timeInput.value.trim(),
                main: index === 0,
                employees: artists,
            };
        }).filter(item => item.name);
    }

    function getPrimaryShow() {
        const shows = getCreateOrderShows();

        if (!shows.length) return { id: null, name: '', count: null };

        return shows[0];
    }

    function createContactRow() {
        const row = document.createElement('div');
        row.className = 'cof-repeat__row cof-repeat__row--contact';

        row.innerHTML = `
            <label class="cof-radio" title="Основной контакт">
                <input type="radio" name="createOrderMainContact" data-contact-main>
                <span></span>
            </label>
            <div class="cof-repeat__body">
                <input type="text" class="cof-field" data-contact-name placeholder="Имя контактного лица">
                <div class="cof-pair">
                    <input type="tel" class="cof-field" data-contact-phone placeholder="+7 (999) 123-45-67">
                    <input type="text" class="cof-field" data-contact-telegram placeholder="@telegram">
                </div>
            </div>
            <button type="button" class="cof-repeat__remove" data-contact-remove title="Удалить контакт">&times;</button>
        `;

        return row;
    }

    function getCreateOrderContactRows() {
        const box = createOrderField('createOrderContacts');

        return box ? Array.prototype.slice.call(box.querySelectorAll('.cof-repeat__row')) : [];
    }

    function addCreateOrderContact(data) {
        if (!document.getElementById('createOrderContacts')) return;

        const box = createOrderField('createOrderContacts');

        if (!box) return;

        const row = createContactRow();

        box.appendChild(row);

        const main = row.querySelector('[data-contact-main]');
        const remove = row.querySelector('[data-contact-remove]');
        const name = row.querySelector('[data-contact-name]');
        const phone = row.querySelector('[data-contact-phone]');
        const telegram = row.querySelector('[data-contact-telegram]');

        if (window.UI.attachPhoneMask) window.UI.attachPhoneMask(phone);

        if (data) {
            name.value = data.name || '';
            telegram.value = data.telegram || '';

            if (data.phone && window.UI.setPhoneValue) {
                window.UI.setPhoneValue(phone, data.phone);
            } else if (data.phone) {
                phone.value = data.phone;
            }

            if (data.main) main.checked = true;
        }

        main.addEventListener('change', function() {
            getCreateOrderContactRows().forEach(function(other) {
                const radio = other.querySelector('[data-contact-main]');

                if (radio && other !== row) radio.checked = false;
            });

            syncCreateOrderPreview();
        });

        remove.addEventListener('click', function() {
            row.remove();
            syncCreateOrderPreview();
        });

        [name, phone, telegram].forEach(function(node) {
            node.addEventListener('input', syncCreateOrderPreview);
        });

        syncCreateOrderPreview();
    }

    function resetCreateOrderContacts() {
        const box = createOrderField('createOrderContacts');

        if (!box) return;

        box.innerHTML = '';
        addCreateOrderContact(null);
    }

    function getCreateOrderContacts() {
        return getCreateOrderContactRows().map(function(row) {
            const main = row.querySelector('[data-contact-main]');

            return {
                name: row.querySelector('[data-contact-name]').value.trim(),
                phone: row.querySelector('[data-contact-phone]').value.trim(),
                telegram: row.querySelector('[data-contact-telegram]').value.trim(),
                main: !!(main && main.checked),
            };
        }).filter(item => item.name || item.phone || item.telegram);
    }

    let selectedCityId = '';
    let selectedCityName = '';

    function syncSelectedCity() {
        const input = document.getElementById('createOrderCityInput');
        const hiddenId = document.getElementById('createOrderCityId');
        const hiddenName = document.getElementById('createOrderCityName');

        if (hiddenId) hiddenId.value = selectedCityId;
        if (hiddenName) hiddenName.value = selectedCityName;
        if (input && document.activeElement !== input) input.value = selectedCityName;
    }

    function setSelectedCity(id, name) {
        selectedCityId = id ? String(id) : '';
        selectedCityName = name || '';
        syncSelectedCity();
    }

    function getCreateOrderCity() {
        return { id: selectedCityId, name: selectedCityName };
    }

    document.addEventListener('city-selected', function(e) {
        const detail = e.detail || {};
        setSelectedCity(detail.id, detail.name);
    });

    function getSafeCityPicker() {
        const picker = window.createOrderCityPicker;

        if (picker && typeof picker.getValue === 'function') return picker;

        return { reset: function() {}, getValue: function() { return { id: '', name: '' }; }, setValue: function() {} };
    }

    function getPrimaryContact() {
        const contacts = getCreateOrderContacts();

        if (!contacts.length) return { name: '', phone: '', telegram: '' };

        return contacts.find(item => item.main) || contacts[0];
    }

    function attachServicePicker(input, dropdown) {
        if (input.dataset.mounted === '1') return;

        input.dataset.mounted = '1';

        let services = [];
        let loaded = false;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
        }

        function load() {
            if (loaded) return Promise.resolve();

            return fetch('/orders/services/', { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    services = (data.services || [])
                        .filter(item => item.type === 'service')
                        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
                    loaded = true;
                })
                .catch(() => {});
        }

        function render() {
            dropdown.innerHTML = '';

            const query = input.value.trim().toLowerCase();
            const matches = query
                ? services.filter(item => String(item.name).toLowerCase().includes(query)).slice(0, 10)
                : services.slice(0, 10);

            if (!matches.length) {
                close();
                return;
            }

            matches.forEach(function(service) {
                const option = document.createElement('button');

                option.type = 'button';
                option.className = 'single-city-picker__option';

                const name = document.createElement('span');

                name.className = 'single-city-picker__name';
                name.textContent = service.name;
                option.appendChild(name);

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    input.value = service.name;
                    input.dataset.serviceId = service.id;
                    close();
                    syncCreateOrderPreview();
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.add('open');
        }

        input.addEventListener('focus', function() {
            load();
        });

        input.addEventListener('input', function() {
            delete input.dataset.serviceId;
            load().then(render);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') close();
        });

        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target) && e.target !== input) close();
        });
    }

    function renderCreateOrderManagerChips() {
        const chips = createOrderField('createOrderManagerChips');

        if (!chips) return;

        chips.innerHTML = '';

        createOrderManagers.forEach(function(manager) {
            const chip = document.createElement('span');
            chip.className = 'cof-chip';
            chip.innerHTML = '<span>' + window.UI.escapeHtml(manager.name) + '</span>';

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'cof-chip__x';
            remove.textContent = '×';
            remove.addEventListener('click', function(e) {
                e.preventDefault();
                createOrderManagers = createOrderManagers.filter(item => item.id !== manager.id);
                renderCreateOrderManagerChips();
                syncCreateOrderPreview();
            });

            chip.appendChild(remove);
            chips.appendChild(chip);
        });
    }

    function mountCreateOrderManagerPicker() {
        const input = createOrderField('createOrderManagerInput');
        const dropdown = createOrderField('createOrderManagerDropdown');

        if (!input || !dropdown || input.dataset.mounted === '1') return;

        input.dataset.mounted = '1';

        let employees = [];

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
        }

        function load() {
            return fetch('/employees/list/?limit=200', { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    employees = data.employees || [];
                })
                .catch(() => {});
        }

        function toggle(employee) {
            const exists = createOrderManagers.some(item => String(item.id) === String(employee.id));

            if (exists) {
                createOrderManagers = createOrderManagers.filter(item => String(item.id) !== String(employee.id));
            } else {
                createOrderManagers.push({ id: employee.id, name: employee.display_name || employee.full_name });
            }

            input.value = '';
            renderCreateOrderManagerChips();
            render();
            syncCreateOrderPreview();
        }

        function render() {
            dropdown.innerHTML = '';

            const query = input.value.trim().toLowerCase();
            const matches = employees
                .filter(item => !query || (item.display_name || item.full_name || '').toLowerCase().includes(query))
                .slice(0, 30);

            if (!matches.length) {
                close();
                return;
            }

            matches.forEach(function(employee) {
                const picked = createOrderManagers.some(item => String(item.id) === String(employee.id));
                const option = document.createElement('button');

                option.type = 'button';
                option.className = 'single-city-picker__option' + (picked ? ' active' : '');

                const name = document.createElement('span');
                name.className = 'single-city-picker__name';
                name.textContent = employee.display_name || employee.full_name;
                option.appendChild(name);

                if (employee.role_display) {
                    const meta = document.createElement('span');
                    meta.className = 'single-city-picker__subject';
                    meta.textContent = employee.role_display;
                    option.appendChild(meta);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    toggle(employee);
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.add('open');
        }

        input.addEventListener('focus', function() {
            load().then(render);
        });

        input.addEventListener('input', render);

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const options = dropdown.querySelectorAll('.single-city-picker__option');

                if (options.length) {
                    e.preventDefault();
                    options[0].dispatchEvent(new MouseEvent('mousedown'));
                }
            } else if (e.key === 'Escape') {
                close();
            }
        });

        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target) && e.target !== input) close();
        });

        window.createOrderManagerPicker = {
            reset: function() {
                createOrderManagers = [];
                input.value = '';
                renderCreateOrderManagerChips();
                close();
            },
            getManagers: function() {
                return createOrderManagers;
            },
            setValue: function(managers) {
                createOrderManagers = (managers || [])
                    .filter(item => item && item.id)
                    .map(item => ({ id: item.id, name: item.name || '' }));

                input.value = '';
                renderCreateOrderManagerChips();
                close();
            }
        };

        renderCreateOrderManagerChips();
    }

    window.refreshCreateOrderPreview = syncCreateOrderPreview;

    const PREVIEW_MONTHS = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];

    const PREVIEW_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

    function formatPreviewDate(value) {
        if (!value) return 'Дата не указана';

        const parts = value.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (!year || !month || !day) return 'Дата не указана';

        const weekday = PREVIEW_WEEKDAYS[new Date(year, month - 1, day).getDay()];

        return day + ' ' + PREVIEW_MONTHS[month - 1] + ', ' + weekday;
    }

    let createOrderChats = [];

    function getCreateOrderChatChecks() {
        return Array.prototype.slice.call(document.querySelectorAll('#createOrderModal [data-chat-check]'));
    }

    function getCreateOrderChatLabel() {
        const checked = getCreateOrderChatChecks().filter(node => node.checked);

        return checked.map(node => node.value).join(', ');
    }

    function setCreateOrderChats(value) {
        const raw = String(value || '').trim();
        const first = raw.split(',')[0].trim();
        let matched = false;

        getCreateOrderChatChecks().forEach(function(node) {
            const isMatch = !matched && !!first && node.value === first;

            node.checked = isMatch;

            if (isMatch) matched = true;
        });
    }

    function getCreateOrderChatLink() {
        const name = getCreateOrderChatLabel();

        if (!name) return '';

        const chat = createOrderChats.find(item => item.name === name);

        return chat && chat.link ? chat.link : '';
    }

    function mountCreateOrderChats() {
        const checks = getCreateOrderChatChecks();

        if (!checks.length || checks[0].dataset.mounted === '1') return;

        checks[0].dataset.mounted = '1';

        fetch('/orders/narrow-chats/', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                createOrderChats = data.chats || [];
                syncCreateOrderPreview();
            })
            .catch(function() {});

        checks.forEach(function(node) {
            node.dataset.mounted = '1';

            node.addEventListener('change', function() {
                if (node.checked) {
                    checks.forEach(function(other) {
                        if (other !== node) other.checked = false;
                    });
                }

                syncCreateOrderPreview();
            });
        });
    }

    let previewShowsList = [];
    let previewChatName = '';
    let previewChatLinks = {};

    function buildPreviewDateLabel(order) {
        const dateLabel = order.has_date ? formatPreviewDate(order.date) : 'Дата не указана';
        const city = (order.city_name || '').trim();

        return city ? dateLabel + ', ' + city : dateLabel;
    }

    function setPreviewShowsList(list) {
        previewShowsList = Array.isArray(list) ? list : [];
    }

    function buildPreviewShows() {
        const list = Array.isArray(previewShowsList) ? previewShowsList : [];

        return list.map(function(item) {
            const artistList = (item.employees || [])
                .map(function(staff) {
                    const name = String(staff.name || '').trim();
                    const comment = String(staff.comment || '').trim();

                    if (!name) return '';

                    return {
                        label: comment ? name + ' (' + comment + ')' : name,
                        is_story: !!staff.is_story,
                        is_responsible: !!staff.is_responsible,
                    };
                })
                .filter(Boolean);

            const artists = artistList
                .map(function(entry) {
                    const classes = ['cof-ev-show__artist'];

                    if (entry.is_story) classes.push('cof-ev-show__artist--story');
                    if (entry.is_responsible) classes.push('cof-ev-show__artist--responsible');

                    return '<span class="' + classes.join(' ') + '">'
                        + window.UI.escapeHtml(entry.label) + '</span>';
                })
                .join(' ');

            if (!item.name && !artists) return '';

            return '<div class="cof-ev-show">'
                + '<span class="cof-ev-show__time">' + window.UI.escapeHtml(item.start_time || item.time || '') + '</span>'
                + '<span class="cof-ev-show__body">'
                + '<span class="cof-ev-show__name">' + window.UI.escapeHtml(item.name || '') + '</span>'
                + (artists ? '<span class="cof-ev-show__artist-chips">' + artists + '</span>' : '')
                + '</span>'
                + '</div>';
        }).join('');
    }

    function buildPreviewChat() {
        const raw = String(previewChatName || '').trim();
        const first = raw.split(',')[0].trim();

        if (!first) return '';

        const links = previewChatLinks || {};
        const link = links[first] || links[first.replace(/\s+/g, '').replace(/(\D)(\d)/, '$1-$2')] || '';

        return link
            ? '<a class="cof-ev-chat" href="' + window.UI.escapeHtml(link) + '" target="_blank" rel="noopener">' + window.UI.escapeHtml(first) + '</a>'
            : '<span class="cof-ev-chat">' + window.UI.escapeHtml(first) + '</span>';
    }

    function buildOrderPreviewHtml(order, options) {
        const settings = options || {};
        const showsHtml = buildPreviewShows();
        const chatHtml = buildPreviewChat();

        let html = '<div class="cof-ev-head">'
            + '<div class="cof-ev-head__date">' + window.UI.escapeHtml(buildPreviewDateLabel(order)) + '</div>'
            + '<span class="cof-ev-chat-wrap">' + (chatHtml || '') + '</span>'
            + '</div>';

        if (!settings.hideClient) {
            html += order.client_id
                ? '<a class="cof-ev-client" href="/clients/?open_client=' + encodeURIComponent(order.client_id) + '" target="_blank" rel="noopener">' + window.UI.escapeHtml(order.client || '') + '</a>'
                : '<div class="cof-ev-client cof-ev-client--empty">Клиент не выбран</div>';
        }

        if (settings.bannerHtml) html += settings.bannerHtml;

        html += showsHtml;

        const lines = [];
        const contactItems = Array.isArray(order.contact_items) ? order.contact_items : [];
        const contact = contactItems.find(item => item.is_primary) || contactItems[0] || {
            name: order.contact_name || '',
            phone: order.contact_phone || '',
            telegram: order.contact_telegram || '',
        };

        if (order.start_time) {
            lines.push('<div class="cof-ev-line cof-ev-line--pre cof-ev-time-note"><b>*</b> ' + window.UI.escapeHtml(order.start_time) + '</div>');
        }

        if (contact.name || contact.phone || contact.telegram) {
            const telegramName = String(contact.telegram || '').trim();
            const telegramHandle = telegramName.replace(/^@+/, '').replace(/^https?:\/\/t\.me\//i, '');
            const telegramHtml = telegramHandle
                ? '<a class="cof-ev-link" href="https://t.me/' + encodeURIComponent(telegramHandle) + '" target="_blank" rel="noopener">'
                    + window.UI.escapeHtml('@' + telegramHandle) + '</a>'
                : '';

            const contactParts = [];

            if (contact.name) contactParts.push(window.UI.escapeHtml(contact.name));
            if (telegramHtml) contactParts.push(telegramHtml);
            if (contact.phone) contactParts.push(window.UI.escapeHtml(contact.phone));

            lines.push('<div class="cof-ev-line cof-ev-line--contact">Контакт: <b>' + contactParts.join(', ') + '</b></div>');
        }

        if (order.setup_time) lines.push('<div class="cof-ev-line cof-ev-line--muted">Чек: <b>' + window.UI.escapeHtml(order.setup_time) + '</b></div>');

        if (order.address) lines.push('<div class="cof-ev-line cof-ev-line--muted">Адрес: <b>' + window.UI.escapeHtml(order.address) + '</b></div>');

        const managers = Array.isArray(order.managers) && order.managers.length
            ? order.managers
            : (order.manager_name ? [{ name: order.manager_name }] : []);
        const managerNames = [];

        managers.forEach(function(item) {
            const managerName = String(item.name || '').trim();

            if (!managerName || managerNames.indexOf(managerName) !== -1) return;

            managerNames.push(managerName);
        });

        if (managerNames.length) {
            lines.push('<div class="cof-ev-line cof-ev-line--muted">Менеджер: <b>'
                + window.UI.escapeHtml(managerNames.join(', '))
                + '</b></div>');
        }

        const canPay = !!(order.can_see_cost || settings.canSeeCost);

        if (canPay && order.cost && order.cost !== '—') {
            const numeric = String(order.cost).replace(/\s/g, '').replace(',', '.');
            const costValue = parseFloat(numeric);
            const costLabel = isNaN(costValue) ? String(order.cost) : formatNumber(Math.round(costValue)) + ' ₽';

            lines.push('<div class="cof-ev-line">Стоимость: <b>' + window.UI.escapeHtml(costLabel) + '</b></div>');
        }

        if (lines.length) {
            html += '<div class="cof-ev-section cof-ev-section--row"></div>' + lines.join('');
        }

        const boxes = [];

        const describeBox = function(label, value) {
            return '<div class="cof-ev-box cof-ev-box--block"><b>' + window.UI.escapeHtml(label) + ':</b> '
                + '<span class="cof-ev-box__next">' + window.UI.escapeHtml(value) + '</span></div>';
        };

        if (order.importance) boxes.push(describeBox('Важность', order.importance));

        const techLabels = [];

        if (order.tech_lamps) techLabels.push('УФ');
        if (order.tech_laser) techLabels.push('Лазер');
        if (order.tech_hazer) techLabels.push('Хейзер');
        if (order.tech_grid) techLabels.push('Сетка');
        if (order.tech_projection) techLabels.push('Проекция');

        if (techLabels.length || order.tech_comment) {
            let techText = '';

            if (techLabels.length) {
                techText += '<span class="cof-ev-box__next">' + window.UI.escapeHtml(techLabels.join(', ')) + '</span>';
            }

            if (order.tech_comment) {
                techText += '<span class="cof-ev-box__next">' + window.UI.escapeHtml(order.tech_comment) + '</span>';
            }

            boxes.push('<div class="cof-ev-box cof-ev-box--block"><b>Техничка:</b> ' + techText + '</div>');
        }

        if (order.dressing_room_comment) boxes.push(describeBox('Гримёрка, еда', order.dressing_room_comment));
        if (order.event_comment) boxes.push(describeBox('Про событие', order.event_comment));
        if (order.venue_comment) boxes.push(describeBox('Про площадку', order.venue_comment));
        if (order.donotforget_comment) boxes.push(describeBox('Не забыть', order.donotforget_comment));
        if (order.adaptation_comment) boxes.push(describeBox('Адаптация', order.adaptation_comment));

        const conceptText = order.concept || order.comment || '';

        if (conceptText && !settings.hideConcept) {
            boxes.push(describeBox('Комментарий', conceptText));
        }

        if (!settings.hidePayment && (order.payment_method || order.payment_due_comment || order.payment_due_date)) {
            const methodLabels = { cash: 'Нал', ip: 'ИП', self: 'СЗ' };
            const methodCodes = String(order.payment_method || '')
                .split(/[,;\s]+/)
                .map(item => item.trim())
                .filter(item => methodLabels[item]);

            const methodText = methodCodes.map(item => methodLabels[item]).join(', ');
            const dueText = formatPaymentDueLabel(order.payment_due_display || order.payment_due_date || '');
            const paymentComment = String(order.payment_due_comment || '').trim();

            const values = [methodText, dueText ? 'до ' + dueText : ''].filter(Boolean).join(' ');

            boxes.push('<div class="cof-ev-box cof-ev-box--block"><b>Оплата:</b>'
                + (values ? '<span class="cof-ev-box__val">' + window.UI.escapeHtml(values) + '</span>' : '')
                + (paymentComment ? '<span class="cof-ev-box__next">' + window.UI.escapeHtml(paymentComment) + '</span>' : '')
                + '</div>');
        }

        if (boxes.length) {
            html += '<div class="cof-ev-section">Детали</div>' + boxes.join('');
        }

        return html;
    }

    window.renderOrderPreviewCard = function(order, bannerHtml, options) {
        const box = document.getElementById('eventModalPreviewBody');

        if (!box || !order) return;

        const settings = options || {};

        setPreviewShowsList(order.services || []);
        previewChatName = order.chat_number || '';
        previewChatLinks = order.chat_links || {};

        box.innerHTML = buildOrderPreviewHtml(order, {
            bannerHtml: bannerHtml || '',
            canSeeCost: order.can_see_cost !== false,
            hideClient: !!settings.hideClient,
            hideStatus: !!settings.hideStatus,
            hidePayment: !!settings.hidePayment,
        });
    };

    function createOrderFieldChecked(id) {
        const node = createOrderField(id);

        return !!(node && node.checked);
    }

    function syncCreateOrderPreview() {
        const titleNode = createOrderField('createOrderPreviewTitle');
        const preview = createOrderField('createOrderPreview');
        const countNode = createOrderField('createOrderFieldCount');

        if (!document.getElementById('createOrderPreview')) return;

        const name = getCreateOrderName();
        const clientSelect = createOrderClient;
        const clientLabel = clientSelect ? clientSelect.options[clientSelect.selectedIndex] : null;
        const clientName = clientLabel && clientSelect.value ? clientLabel.textContent : '';

        const city = getCreateOrderCity();
        const cityName = city && city.name ? city.name : '';
        const dateValue = createOrderDate ? createOrderDate.value : '';
        const concept = createOrderFieldValue('createOrderConcept');
        const showsList = getCreateOrderShows();
        const serviceValue = getPrimaryShow();
        const contact = getPrimaryContact();
        const contactName = contact.name;
        const contactPhone = contact.phone;
        const contactTelegram = contact.telegram;
        const startTime = createOrderFieldValue('createOrderStartTime');
        const setupTime = createOrderFieldValue('createOrderSetupTime');
        const address = createOrderFieldValue('createOrderAddress');
        const chat = getCreateOrderChatLabel();
        const dressing = createOrderFieldValue('createOrderDressingRoom');
        const techComment = createOrderFieldValue('createOrderTechComment');
        const importance = createOrderFieldValue('createOrderImportance');
        const eventComment = createOrderFieldValue('createOrderEventComment');
        const venueComment = createOrderFieldValue('createOrderVenueComment');
        const donotforget = createOrderFieldValue('createOrderDonotforget');
        const adaptation = createOrderFieldValue('createOrderAdaptation');
        const cost = createOrderFieldValue('createOrderCost');
        const paymentMethod = getCreateOrderPaymentMethod();
        const paymentComment = createOrderFieldValue('createOrderPaymentComment');
        const paymentDue = createOrderFieldValue('createOrderPaymentDue');

        if (titleNode) titleNode.textContent = name || 'Новый заказ';

        if (preview) {
            const statusLabels = { request: 'Запрос', confirmed: 'Подтверждённый', completed: 'Выполненный' };
            const chatLink = getCreateOrderChatLink();

            previewChatName = chat;
            previewChatLinks = {};

            if (chat && chatLink) previewChatLinks[chat] = chatLink;

            setPreviewShowsList(showsList.map(function(item) {
                return {
                    name: item.name,
                    start_time: item.time,
                    employees: item.employees || [],
                };
            }));

            preview.innerHTML = buildOrderPreviewHtml({
                name: name,
                has_date: !!dateValue,
                date: dateValue,
                city_name: cityName,
                status: createOrderStatus,
                status_display: statusLabels[createOrderStatus] || 'Запрос',
                client_id: clientSelect ? clientSelect.value : '',
                client: clientName,
                start_time: startTime,
                setup_time: setupTime,
                address: address,
                contact_items: [contact],
                managers: createOrderManagers,
                cost: cost,
                importance: importance,
                tech_lamps: createOrderFieldChecked('createOrderTechLamps'),
                tech_laser: createOrderFieldChecked('createOrderTechLaser'),
                tech_hazer: createOrderFieldChecked('createOrderTechHazer'),
                tech_grid: createOrderFieldChecked('createOrderTechGrid'),
                tech_projection: createOrderFieldChecked('createOrderTechProjection'),
                tech_comment: techComment,
                dressing_room_comment: dressing,
                event_comment: eventComment,
                venue_comment: venueComment,
                donotforget_comment: donotforget,
                adaptation_comment: adaptation,
                payment_method: paymentMethod,
                payment_due_comment: paymentComment,
                payment_due_date: formatPaymentDueLabel(paymentDue),
                concept: concept,
            }, { canSeeCost: true });
        }

        if (countNode) {
            let filled = 0;
            let total = 0;

            [name, clientSelect && clientSelect.value, cityName, dateValue, startTime, setupTime,
                createOrderManagers.length ? '1' : '', contactPhone || contactTelegram,
                serviceValue.id, concept].forEach(function(value) {
                total += 1;
                if (value) filled += 1;
            });

            countNode.textContent = 'Заполнено ' + filled + ' из ' + total;
        }
    }

    mountCreateOrderServiceInput();
    mountCreateOrderManagerPicker();
    mountCreateOrderChats();

    const addShowBtn = document.getElementById('createOrderAddShow');

    if (addShowBtn) {
        addShowBtn.addEventListener('click', function() {
            addCreateOrderShow(null);
        });
    }

    const addContactBtn = document.getElementById('createOrderAddContact');

    if (addContactBtn) {
        addContactBtn.addEventListener('click', function() {
            addCreateOrderContact(null);
        });
    }

    if (document.getElementById('createOrderModal')) {
        resetCreateOrderShows();
        resetCreateOrderContacts();
    }

    const createStatusSwitch = createOrderField('createOrderStatusSwitch');

    if (createStatusSwitch) {
        createStatusSwitch.addEventListener('click', function(e) {
            const btn = e.target.closest('[data-status]');

            if (!btn) return;

            createOrderStatus = btn.dataset.status;
            syncCreateOrderStatus();
            syncCreateOrderPreview();
        });
    }

    const CREATE_ORDER_LIVE_FIELDS = [
        'createOrderManagerInput',
        'createOrderSetupTime', 'createOrderStartTime', 'createOrderAddress',
        'createOrderImportance', 'createOrderEventComment', 'createOrderVenueComment',
        'createOrderDonotforget', 'createOrderAdaptation',
        'createOrderDressingRoom', 'createOrderTechComment',
        'createOrderCost', 'createOrderPaymentDue', 'createOrderPaymentComment', 'createOrderConcept',
        'createOrderPayCash', 'createOrderPayIp', 'createOrderPaySelf',
    ];

    CREATE_ORDER_LIVE_FIELDS.forEach(function(id) {
        const node = createOrderField(id);

        if (!node) return;

        node.addEventListener('input', syncCreateOrderPreview);
        node.addEventListener('change', syncCreateOrderPreview);

        if (node.tagName === 'TEXTAREA') {
            node.addEventListener('input', function() { autoGrowNode(node); });
            autoGrowNode(node);
        }
    });

    ['createOrderTechLamps', 'createOrderTechLaser', 'createOrderTechHazer', 'createOrderTechGrid', 'createOrderTechProjection'].forEach(function(id) {
        const node = createOrderField(id);

        if (node) node.addEventListener('change', syncCreateOrderPreview);
    });

    if (createOrderName) {
        createOrderName.addEventListener('input', syncCreateOrderPreview);
    }

    if (createOrderDate) {
        createOrderDate.addEventListener('input', syncCreateOrderPreview);
        createOrderDate.addEventListener('change', syncCreateOrderPreview);
    }

    const createClientSearchInput = createOrderField('createOrderClientSearch');

    if (createClientSearchInput) {
        createClientSearchInput.addEventListener('client-selected', function(e) {
            const client = e.detail && e.detail.client;

            if (!client) return;

            const rows = getCreateOrderContactRows();

            if (!rows.length) {
                addCreateOrderContact({
                    name: client.full_name || '',
                    phone: client.phone || '',
                    telegram: client.telegram || '',
                    main: true,
                });
                return;
            }

            const firstRow = rows[0];

            const nameNode = firstRow.querySelector('[data-contact-name]');
            const phoneNode = firstRow.querySelector('[data-contact-phone]');
            const telegramNode = firstRow.querySelector('[data-contact-telegram]');

            if (nameNode && !nameNode.value) nameNode.value = client.full_name || '';

            if (phoneNode && window.UI && window.UI.setPhoneValue) {
                window.UI.setPhoneValue(phoneNode, client.phone || '');
            } else if (phoneNode && !phoneNode.value) {
                phoneNode.value = client.phone || '';
            }

            if (telegramNode && !telegramNode.value) telegramNode.value = client.telegram || '';

            syncCreateOrderPreview();
        });
    }

    function safeCall(label, fn) {
        try {
            fn();
        } catch (error) {
            console.error('createOrder: ' + label, error);
        }
    }

    function openCreateModal(prefillDate) {
        if (!createModal) return;

        if (document.body.dataset.canManageOrders !== '1') {
            showToast('У вас нет прав на создание заказов');
            return;
        }

        createModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        safeCall('mode', function() { setCreateOrderMode('create', null); });
        safeCall('reset', function() { resetCreateOrderForm(prefillDate); });
        safeCall('preview', syncCreateOrderPreview);

        setTimeout(function() {
            if (createOrderName) createOrderName.focus();
        }, 60);
    }

    function closeCreateModal() {
        closeArtistNote();
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

        const agencySelectEl = document.getElementById('newClientAgency');
        const agencySearchEl = document.getElementById('newClientAgencySearch');

        if (agencySelectEl) agencySelectEl.value = '';
        if (agencySearchEl) agencySearchEl.value = '';

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

    const newClientTypeField = document.getElementById('newClientType');
    const newClientPhoneField = document.getElementById('newClientPhone');

    function mountNewClientAgencyPicker() {
        const input = document.getElementById('newClientAgencySearch');
        const select = document.getElementById('newClientAgency');

        if (!input || !select || input.dataset.mounted === '1') return;

        input.dataset.mounted = '1';

        const group = input.closest('.form-group') || input.parentNode;

        group.style.position = 'relative';

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';
        group.appendChild(dropdown);

        let items = [];
        let index = -1;
        let counter = 0;
        let timer = null;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
            index = -1;
        }

        function pick(agency) {
            select.value = String(agency.id);
            input.value = agency.name;
            close();
        }

        function render() {
            dropdown.innerHTML = '';

            items.forEach(function(agency, position) {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'city-selector__option' + (position === index ? ' active' : '');
                option.textContent = agency.name;

                if (agency.matched_alias) {
                    const hint = document.createElement('span');
                    hint.className = 'city-selector__option-subject';
                    hint.textContent = 'вариация: ' + agency.matched_alias;
                    option.appendChild(hint);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(agency);
                });

                dropdown.appendChild(option);
            });

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function load(query) {
            const current = ++counter;

            fetch('/agencies/catalog/?search=' + encodeURIComponent(query))
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (current !== counter) return;

                    const q = query.toLowerCase().replace(/ё/g, 'е');

                    items = (data.agencies || []).map(function(agency) {
                        const alias = (agency.aliases || []).find(function(name) {
                            return name.toLowerCase().replace(/ё/g, 'е').indexOf(q) !== -1;
                        });

                        return Object.assign({}, agency, { matched_alias: alias || '' });
                    });

                    index = -1;
                    render();
                })
                .catch(function(error) { console.error(error); });
        }

        input.addEventListener('input', function() {
            select.value = '';
            const query = input.value.trim();

            clearTimeout(timer);

            if (!query) {
                close();
                return;
            }

            timer = setTimeout(function() { load(query); }, 180);
        });

        input.addEventListener('focus', function() {
            const query = input.value.trim();

            if (query) load(query);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                index = (index + 1) % Math.max(items.length, 1);
                render();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                index = index <= 0 ? Math.max(items.length - 1, 0) : index - 1;
                render();
            } else if (e.key === 'Enter') {
                if (!items.length) return;

                e.preventDefault();
                pick(index >= 0 ? items[index] : items[0]);
            } else if (e.key === 'Escape') {
                close();
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(close, 120);
        });
    }

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
    mountNewClientAgencyPicker();

    window.createOrderCityPicker = {
        reset: function() {},
        getValue: function() { return { id: '', name: '' }; },
        setValue: function() {},
    };

    mountCreateOrderCityPicker();

    window.createOrderCityPicker = {
        reset: function() {},
        getValue: function() { return { id: '', name: '' }; },
        setValue: function() {},
    };

    function mountCreateOrderCityPicker() {
        const wrapper = document.getElementById('createOrderCityPicker');
        const input = document.getElementById('createOrderCityInput');
        const dropdown = document.getElementById('createOrderCityDropdown');
        const hiddenId = document.getElementById('createOrderCityId');
        const hiddenName = document.getElementById('createOrderCityName');

        if (!wrapper || !input || !dropdown || !hiddenId || !hiddenName) return;
        if (hiddenId.dataset.mounted === '1') return;

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

            document.dispatchEvent(new CustomEvent('city-selected', {
                detail: { id: city.id || '', name: city.name || '' },
            }));
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
            hiddenName.value = input.value.trim();

            document.dispatchEvent(new CustomEvent('city-selected', {
                detail: { id: '', name: input.value.trim() },
            }));

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
            },
            setValue: function(id, name) {
                hiddenId.value = id ? String(id) : '';
                hiddenName.value = name || '';
                input.value = name || '';
                close();
            }
        };
    }

    mountCreateOrderCityPicker();

    if (newClientTypeField) {
        newClientTypeField.addEventListener('change', updateNewClientAgencyVisibility);
    }

    if (newClientPhoneField) {
        if (window.UI && window.UI.attachPhoneMask) {
            window.UI.attachPhoneMask(newClientPhoneField);
        }
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

        if (typeof syncCreateOrderPreview === 'function') {
            safeCall('preview', syncCreateOrderPreview);
        }
    }

    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', function() {
            openCreateModal();
        });
    }

    if (createModalCancelBtn) {
        createModalCancelBtn.addEventListener('click', requestCloseCreateModal);
    }

    const createModalCopyLinkBtn = document.getElementById('createModalCopyLinkBtn');

    if (createModalCopyLinkBtn) {
        createModalCopyLinkBtn.addEventListener('click', function() {
            if (!createOrderEditId) {
                showToast('Ссылка доступна после сохранения заказа');
                return;
            }

            const link = window.location.origin + '/schedule/?order=' + encodeURIComponent(createOrderEditId);

            const done = function() {
                showToast('Ссылка на заказ скопирована');
            };

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(link).then(done).catch(function() { showToast(link); });
                return;
            }

            const area = document.createElement('textarea');

            area.value = link;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.top = '-1000px';
            document.body.appendChild(area);
            area.select();

            try {
                document.execCommand('copy');
                done();
            } catch (error) {
                showToast(link);
            }

            document.body.removeChild(area);
        });
    }

    if (createModal) {
        createModal.addEventListener('click', function(e) {
            if (e.target === this) requestCloseCreateModal();
        });

        window.UI.registerModal(createModal, requestCloseCreateModal);
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

        window.UI.registerModal(createClientModal, requestCloseCreateClientModal);
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

    function collectCreateOrderPayload() {
        const cityValue = getCreateOrderCity();

        const serviceValue = window.createOrderServicePicker
            ? window.createOrderServicePicker.getService()
            : { id: null, count: null };

        const managers = window.createOrderManagerPicker ? window.createOrderManagerPicker.getManagers() : [];

        const payload = new URLSearchParams({
            name: getCreateOrderName(),
            client_id: createOrderClient ? createOrderClient.value : '',
            date: createOrderDate ? createOrderDate.value : '',
            city_id: cityValue.id || '',
            city_name: cityValue.name || '',
            service_id: serviceValue.id ? String(serviceValue.id) : '',
            people_count: serviceValue.count !== null ? String(serviceValue.count) : '',
            concept: createOrderFieldValue('createOrderConcept'),
            status: createOrderStatus || 'request',
            setup_time: createOrderFieldValue('createOrderSetupTime'),
            address: createOrderFieldValue('createOrderAddress'),
            start_time: createOrderFieldValue('createOrderStartTime'),
            chat_number: getCreateOrderChatLabel(),
            contact_name: getPrimaryContact().name,
            contact_phone: getPrimaryContact().phone,
            contact_telegram: getPrimaryContact().telegram,
            shows_json: JSON.stringify(getCreateOrderShows()),
            contacts_json: JSON.stringify(getCreateOrderContacts()),
            dressing_room_comment: createOrderFieldValue('createOrderDressingRoom'),
            tech_comment: createOrderFieldValue('createOrderTechComment'),
            importance: createOrderFieldValue('createOrderImportance'),
            event_comment: createOrderFieldValue('createOrderEventComment'),
            venue_comment: createOrderFieldValue('createOrderVenueComment'),
            donotforget_comment: createOrderFieldValue('createOrderDonotforget'),
            adaptation_comment: createOrderFieldValue('createOrderAdaptation'),
            cost: createOrderFieldValue('createOrderCost').replace(/\s/g, '').replace(',', '.'),
            payment_method: getCreateOrderPaymentMethod(),
            payment_due_date: createOrderFieldValue('createOrderPaymentDue'),
            payment_due_comment: createOrderFieldValue('createOrderPaymentComment'),
            manager_id: managers.length ? String(managers[0].id) : '',
            manager_ids: managers.map(item => item.id).join(','),
        });

        [['createOrderTechLamps', 'tech_lamps'], ['createOrderTechLaser', 'tech_laser'],
            ['createOrderTechHazer', 'tech_hazer'], ['createOrderTechGrid', 'tech_grid'],
            ['createOrderTechProjection', 'tech_projection']].forEach(function(pair) {
            const node = createOrderField(pair[0]);

            payload.append(pair[1], node && node.checked ? 'on' : 'off');
        });

        return payload;
    }

    if (createForm) {
        createForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updateCreateOrderRequest();
        });
    }

    const createSubmitBtn = createForm ? createForm.querySelector('[type="submit"]') : null;

    if (createSubmitBtn) {
        createSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();

            if (!createForm) return;

            if (typeof createForm.requestSubmit === 'function') {
                createForm.requestSubmit();
            } else {
                updateCreateOrderRequest();
            }
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
        if (e.defaultPrevented) return;
        if (window.UI.isConfirmOpen()) return;

        const openDropdowns = document.querySelectorAll('.city-selector__dropdown.open, .client-combobox__dropdown.open');

        if (!openDropdowns.length) return;

        openDropdowns.forEach(dropdown => dropdown.classList.remove('open'));
        e.preventDefault();
    }, false);

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


    let createOrderMode = 'create';
    let createOrderEditId = null;

    function setCreateOrderMode(mode, orderId) {
        const editing = mode === 'edit' && orderId;

        createOrderMode = editing ? 'edit' : 'create';
        createOrderEditId = editing ? orderId : null;

        const modal = document.getElementById('createOrderModal');

        if (modal) modal.classList.toggle('cof-modal--edit', createOrderMode === 'edit');

        const title = createOrderField('createOrderPreviewTitle');
        const submitBtn = document.getElementById('createOrderSubmitBtn');

        if (title) title.textContent = createOrderMode === 'edit' ? 'Заказ' : 'Новый заказ';
        if (submitBtn) submitBtn.textContent = createOrderMode === 'edit' ? 'Сохранить' : 'Создать';
    }

    function isCreateOrderRowNode(node) {
        return !!(node && node.closest && node.closest('.cof-repeat__row'));
    }

    function resetCreateOrderForm(prefillDate) {
        if (!document.getElementById('createOrderModal')) return;

        if (createForm) {
            createForm.reset();

            Array.prototype.slice.call(createForm.elements || []).forEach(function(node) {
                if (!isCreateOrderRowNode(node)) return;

                if (node.type === 'checkbox' || node.type === 'radio') {
                    node.checked = false;
                } else {
                    node.value = '';
                    delete node.dataset.serviceId;
                }
            });
        }

        if (createOrderClient) createOrderClient.value = '';
        if (createClientSearchInput) createClientSearchInput.value = '';

        document.querySelectorAll('#createOrderModal .cof-field').forEach(function(node) {
            if (node.tagName === 'TEXTAREA') node.style.height = '';
        });

        ['createOrderDate', 'createOrderPaymentDue'].forEach(function(id) {
            const node = createOrderField(id);

            if (node) node.value = '';
        });

        document.querySelectorAll('#createOrderModal input[type="checkbox"]').forEach(function(node) {
            node.checked = false;
        });

        createOrderStatus = 'request';
        syncCreateOrderStatus();

        getSafeCityPicker().reset();
        setSelectedCity('', '');

        const cityInput = document.getElementById('createOrderCityInput');

        if (cityInput) cityInput.value = '';
        if (window.createOrderManagerPicker) {
            window.createOrderManagerPicker.reset();

            const currentEmployeeId = document.body.dataset.employeeId;
            const currentEmployeeName = document.body.dataset.employeeName;

            if (currentEmployeeId) {
                window.createOrderManagerPicker.setValue([{ id: currentEmployeeId, name: currentEmployeeName || '' }]);
            }
        }

        resetCreateOrderShows();
        resetCreateOrderContacts();

        setCreateOrderName('');

        if (createOrderDate) {
            createOrderDate.value = prefillDate ? prefillDate : '';
        }

        setCreateOrderPaymentFlags('');
        setCreateOrderChats('');
    }

    function mapOrderForForm(order) {
        const service = Array.isArray(order.services) && order.services.length ? order.services[0] : null;
        const managerList = [];

        if (Array.isArray(order.managers)) {
            order.managers.forEach(function(item) {
                const id = item.id || item.employee_id || item;

                if (!id) return;

                managerList.push({
                    id: id,
                    name: item.name || item.display_name || item.full_name || String(id)
                });
            });
        }

        if (!managerList.length && order.manager_id) {
            managerList.push({
                id: order.manager_id,
                name: order.manager_name || ''
            });
        }

        const showsList = (Array.isArray(order.services) ? order.services : []).map(function(item, index) {
            return {
                id: item.service_id || item.id || '',
                name: item.service_name || item.name || '',
                count: item.people_count || item.artist_count || null,
                time: item.start_time || '',
                main: index === 0,
                employees: (Array.isArray(item.employees) ? item.employees : []).map(function(staff) {
                    return {
                        employee_id: staff.employee_id || '',
                        name: staff.name || '',
                        role: staff.role || '',
                        comment: staff.comment || '',
                        is_story: !!staff.is_story,
                        is_responsible: !!staff.is_responsible,
                    };
                }),
            };
        });

        const contactsList = (Array.isArray(order.contact_items) ? order.contact_items : []).map(function(item, index) {
            return {
                name: item.name || '',
                phone: item.phone || '',
                telegram: item.telegram || '',
                main: !!item.is_primary || index === 0,
            };
        });

        if (!contactsList.length && (order.contact_name || order.contact_phone || order.contact_telegram)) {
            contactsList.push({
                name: order.contact_name || '',
                phone: order.contact_phone || '',
                telegram: order.contact_telegram || '',
                main: true,
            });
        }

        return {
            name: order.name || '',
            client_id: order.client_id || '',
            client_name: order.client_name || order.client || '',
            date: order.date || '',
            city_id: order.city_id || '',
            city_name: order.city_name || '',
            shows: showsList,
            contacts: contactsList,
            service: service ? {
                id: service.service_id || service.id || null,
                name: service.service_name || service.name || '',
                count: service.people_count || service.artist_count || null
            } : { id: null, name: '', count: null },
            status: order.status || 'request',
            importance: order.importance || '',
            event_comment: order.event_comment || '',
            venue_comment: order.venue_comment || '',
            donotforget: order.donotforget_comment || '',
            adaptation: order.adaptation_comment || '',
            setup_time: order.setup_time || '',
            address: order.address || '',
            start_time: order.start_time || '',
            chat: order.chat_number || '',
            contact_name: order.contact_name || '',
            contact_phone: order.contact_phone || '',
            contact_telegram: order.contact_telegram || '',
            dressing: order.dressing_room_comment || '',
            props: order.props_comment || '',
            tech_comment: order.tech_comment || '',
            tech: {
                lamps: !!order.tech_lamps,
                laser: !!order.tech_laser,
                hazer: !!order.tech_hazer,
                grid: !!order.tech_grid,
                projection: !!order.tech_projection,
            },
            concept: order.concept || '',
            cost: order.cost === null || order.cost === undefined ? '' : String(Math.round(Number(order.cost))),
            payment_method: order.payment_method || '',
            payment_due_comment: order.payment_due_comment || '',
            payment_due_date: order.payment_due_date || '',
            managers: managerList,
        };
    }

    function fillCreateOrderForm(data) {
        resetCreateOrderForm('');

        setCreateOrderName(data.name || '');

        if (createOrderClient && data.client_id) createOrderClient.value = String(data.client_id);
        if (createClientSearchInput && data.client_name) createClientSearchInput.value = data.client_name;

        const cityPicker = getSafeCityPicker();

        cityPicker.setValue(data.city_id, data.city_name);
        setSelectedCity(data.city_id, data.city_name);

        const showsBox = createOrderField('createOrderShows');

        if (showsBox) {
            showsBox.innerHTML = '';

            const list = data.shows && data.shows.length ? data.shows : [data.service];

            list.forEach(function(item, index) {
                if (!item || (!item.id && !item.name)) return;

                addCreateOrderShow({
                    id: item.id,
                    name: item.name,
                    count: item.count,
                    time: item.time,
                    employees: item.employees,
                    main: !!item.main || index === 0,
                });
            });

            if (!showsBox.children.length) addCreateOrderShow(null);
        }

        const contactsBox = createOrderField('createOrderContacts');

        if (contactsBox) {
            contactsBox.innerHTML = '';

            const list = data.contacts && data.contacts.length ? data.contacts : [];

            list.forEach(function(item) {
                addCreateOrderContact(item);
            });

            if (!contactsBox.children.length) addCreateOrderContact(null);
        }

        const managerPicker = window.createOrderManagerPicker;

        if (managerPicker && managerPicker.setValue) {
            managerPicker.setValue(data.managers);
        }

        createOrderStatus = data.status || 'request';
        syncCreateOrderStatus();

        [
            ['createOrderDate', data.date],
            ['createOrderImportance', data.importance],
            ['createOrderEventComment', data.event_comment],
            ['createOrderVenueComment', data.venue_comment],
            ['createOrderDonotforget', data.donotforget],
            ['createOrderAdaptation', data.adaptation],
            ['createOrderSetupTime', data.setup_time],
            ['createOrderAddress', data.address],
            ['createOrderStartTime', data.start_time],
            ['createOrderDressingRoom', data.dressing],
            ['createOrderTechComment', data.tech_comment],
            ['createOrderConcept', data.concept],
            ['createOrderCost', data.cost],
            ['createOrderPaymentComment', data.payment_due_comment],
            ['createOrderPaymentDue', data.payment_due_date],
        ].forEach(function(pair) {
            const node = createOrderField(pair[0]);

            if (node) node.value = pair[1] || '';
        });

        setCreateOrderPaymentFlags(data.payment_method);
        setCreateOrderChats(data.chat);

        [['createOrderTechLamps', data.tech.lamps], ['createOrderTechLaser', data.tech.laser],
            ['createOrderTechHazer', data.tech.hazer], ['createOrderTechGrid', data.tech.grid],
            ['createOrderTechProjection', data.tech.projection]].forEach(function(pair) {
            const node = createOrderField(pair[0]);

            if (node) node.checked = !!pair[1];
        });

        document.querySelectorAll('#createOrderModal .cof-field').forEach(function(node) {
            if (node.tagName === 'TEXTAREA') autoGrowNode(node);
        });

        syncCreateOrderPreview();
    }

    function updateCreateOrderRequest() {
        if (!createForm || isCreatingOrder) return;

        const name = getCreateOrderName();
        const clientId = createOrderClient ? createOrderClient.value : '';

        if (!name) {
            showToast('Пожалуйста, введите название заказа');
            if (createOrderName) createOrderName.focus();
            return;
        }

        if (!clientId) {
            showToast('Пожалуйста, выберите заказчика');
            if (createClientSearchInput) createClientSearchInput.focus();
            return;
        }

        const payload = collectCreateOrderPayload();
        const orderId = createOrderEditId;
        const url = orderId ? '/orders/' + orderId + '/update/' : '/orders/';
        const submitBtn = document.getElementById('createOrderSubmitBtn');

        isCreatingOrder = true;

        if (submitBtn) window.UI.setButtonBusy(submitBtn, true, 'Сохранение...');

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: payload
        })
        .then(response => response.json().then(body => ({ status: response.status, body })).catch(() => ({ status: 0, body: {} })))
        .then(result => {
            const body = result.body || {};

            if (body.error) {
                showToast(body.error);
                return;
            }

            if (result.status >= 400) {
                showToast('Не удалось сохранить заказ (код ' + result.status + ')');
                return;
            }

            closeCreateModal();
            showToast(orderId ? 'Заказ сохранён' : 'Заказ создан');

            if (window.refreshSchedule) {
                window.refreshSchedule(true);
            }

            if (orderId) return;

            try {
                showNotification(body.order.id, body.order.name || 'Новый заказ');
            } catch (error) {
                console.error(error);
            }
        })
        .catch(error => {
            showToast(orderId ? 'Ошибка при сохранении заказа' : 'Ошибка при создании заказа');
            console.error(error);
        })
        .finally(() => {
            isCreatingOrder = false;

            if (submitBtn) window.UI.setButtonBusy(submitBtn, false);
        });
    }

    window.openOrderForm = function(orderId) {
        if (!createModal) return false;

        if (document.body.dataset.canManageOrders !== '1') {
            showToast('У вас нет прав на редактирование заказов');
            return false;
        }

        const editorOverlay = document.getElementById('orderEditorModal');

        if (editorOverlay) editorOverlay.classList.remove('active');

        createModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        safeCall('reset', function() { resetCreateOrderForm(''); });
        safeCall('mode', function() { setCreateOrderMode('edit', orderId); });
        safeCall('preview', syncCreateOrderPreview);

        fetch('/orders/' + orderId + '/', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    closeCreateModal();
                    return;
                }

                safeCall('fill', function() { fillCreateOrderForm(mapOrderForForm(data)); });

                safeCall('mode', function() { setCreateOrderMode('edit', orderId); });
                safeCall('preview', syncCreateOrderPreview);
            })
            .catch(error => {
                showToast('Ошибка загрузки заказа');
                console.error(error);
                closeCreateModal();
            });

        return true;
    };

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
