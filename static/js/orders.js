(function() {
    let currentOrderId = null;
    let createClientTargetSelect = null;
    let allClients = [];
    let createClientPicker = null;
    let editClientPicker = null;

    const tableBody = document.getElementById('ordersTableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
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

    const createClientFromCreateBtn = document.getElementById('createClientFromCreateBtn');
    const createClientModal = document.getElementById('createClientModal');
    const createClientModalCloseBtn = document.getElementById('createClientModalCloseBtn');
    const createClientModalCancelBtn = document.getElementById('createClientModalCancelBtn');
    const createClientForm = document.getElementById('createClientForm');
    const newClientFullName = document.getElementById('newClientFullName');
    const newClientPhone = document.getElementById('newClientPhone');

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
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
        notification.className = 'notification';
        notification.innerHTML = `
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

        if (!order.has_date) classes += ' orders-row--no-date';
        if (order.content_changed) classes += ' orders-row--changed';
        if (order.is_incomplete) classes += ' orders-row--incomplete';

        return classes;
    }

    function getMissingTitle(order) {
        if (!order.is_incomplete || !order.missing_fields || !order.missing_fields.length) return '';
        return 'Не заполнено: ' + order.missing_fields.join(', ');
    }

    function loadClients(selectedId) {
        fetch('/clients/list/')
            .then(response => response.json())
            .then(data => {
                if (!data.clients) return;

                allClients = data.clients;

                const options = data.clients.map(c =>
                    `<option value="${c.id}">${escapeHtml(c.full_name)}${c.agency ? ' (' + escapeHtml(c.agency) + ')' : ''}</option>`
                ).join('');

                createOrderClient.innerHTML = '<option value="">Выберите клиента</option>' + options;

                const editClientSelect = document.getElementById('editOrderClient');

                if (editClientSelect) {
                    editClientSelect.innerHTML = '<option value="">Выберите клиента</option>' + options;
                }

                if (selectedId !== undefined && selectedId !== null && selectedId !== '') {
                    createOrderClient.value = selectedId;
                }

                if (createClientPicker) {
                    createClientPicker.refresh();
                }

                if (editClientPicker) {
                    editClientPicker.refresh();
                }
            })
            .catch(error => console.error('Ошибка загрузки клиентов:', error));
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

        function normalize(value) {
            return (value || '').toLowerCase().replace(/ё/g, 'е').trim();
        }

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
            index = -1;
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

            return result.slice(0, 40);
        }

        function pick(client) {
            select.value = client.id;
            input.value = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
            input.dataset.clientId = client.id;
            close();
            input.dispatchEvent(new CustomEvent('client-selected', { bubbles: true, detail: { client: client } }));
            input.blur();
        }

        function render(query) {
            dropdown.innerHTML = '';
            items = buildItems(query);

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
            const typed = this.value.trim();

            setTimeout(() => {
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
                    this.value = exact.full_name + (exact.agency ? ' (' + exact.agency + ')' : '');
                } else {
                    select.value = '';
                }

                close();
            }, 120);
        });

        document.addEventListener('click', function(e) {
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

    function renderOrders() {
        const search = searchInput.value.trim();
        const status = statusFilter.value;

        fetch(`/orders/list/?search=${encodeURIComponent(search)}&status=${status}`)
            .then(response => response.json())
            .then(data => {
                if (data.orders && data.orders.length > 0) {
                    const sorted = data.orders.slice().sort((a, b) => {
                        if (!!a.has_date !== !!b.has_date) return a.has_date ? 1 : -1;
                        return 0;
                    });

                    tableBody.innerHTML = sorted.map(order => {
                        const statusClass = `status-badge--${order.status}`;
                        const badge = order.content_changed
                            ? '<span class="orders-row__badge">Обновлено</span>'
                            : '';
                        const incompleteDot = order.is_incomplete
                            ? '<span class="orders-row__dot" title="Заполнено не полностью"></span>'
                            : '';
                        const missingTitle = getMissingTitle(order);

                        return `
                            <tr class="${getRowClassNames(order)}" data-order-id="${order.id}" ${missingTitle ? `title="${escapeHtml(missingTitle)}"` : ''}>
                                <td><span class="orders-row__name">${escapeHtml(getOrderName(order))}</span>${badge}${incompleteDot}</td>
                                <td>${order.has_date ? order.date : 'Не указана'}</td>
                                <td>${escapeHtml(order.client)}</td>
                                <td>${escapeHtml(order.city_name || '—')}</td>
                                <td><span class="status-badge ${statusClass}">${getStatusLabel(order.status)}</span></td>
                                <td>${order.cost || '—'}</td>
                                <td><button class="view-link" data-id="${order.id}">Открыть</button></td>
                            </tr>
                        `;
                    }).join('');

                    tableBody.querySelectorAll('[data-id]').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            const id = parseInt(this.getAttribute('data-id'));
                            openEditor(id);
                        });
                    });

                    tableBody.querySelectorAll('tr[data-order-id]').forEach(row => {
                        row.addEventListener('click', function() {
                            const id = parseInt(this.getAttribute('data-order-id'));
                            openEditor(id);
                        });
                    });
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align:center; padding: 2rem; color: #7a7267;">
                                Заказы не найдены
                            </td>
                        </tr>
                    `;
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки заказов:', error);
                showToast('Ошибка загрузки заказов');
            });
    }

    function openCreateModal(prefillDate) {
        createModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        createForm.reset();

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

    if (createClientFromCreateBtn) {
        createClientFromCreateBtn.addEventListener('click', function() {
            openCreateClientModal(createOrderClient);
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
            if (!phone) {
                showToast('Введите телефон');
                return;
            }

            const phoneDigits = phone.replace(/\D/g, '');
            if (phoneDigits.length !== 11) {
                showToast('Номер телефона должен содержать 11 цифр');
                return;
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
                    telegram: (document.getElementById('newClientTelegram') || {}).value || '',
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
                                telegram: (document.getElementById('newClientTelegram') || {}).value || '',
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

            const data = {
                name: name,
                client_id: clientId,
                date: date
            };

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
                    renderOrders();
                    showNotification(data.order.id, data.order.name || 'Новый заказ');
                }
            })
            .catch(error => {
                showToast('Ошибка при создании заказа');
                console.error(error);
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

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderOrders, 300);
    });

    statusFilter.addEventListener('change', renderOrders);

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('uiConfirmModal')) return;

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
    }

    loadClients();
    renderOrders();

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('open_create') === '1') {
        const prefillDate = urlParams.get('create_date') || '';
        openCreateModal(prefillDate);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    window.addEventListener('load', function() {
        tryOpenEditorFromUrl(20);
    });
})();