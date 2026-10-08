(function() {
    let currentOrderId = null;
    let createClientTargetSelect = null;

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
    const newClientCity = document.getElementById('newClientCity');

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

    function loadClients(selectedId) {
        fetch('/clients/list/')
            .then(response => response.json())
            .then(data => {
                if (data.clients) {
                    const options = data.clients.map(c =>
                        `<option value="${c.id}">${escapeHtml(c.full_name)}${c.agency ? ' (' + escapeHtml(c.agency) + ')' : ''}</option>`
                    ).join('');

                    createOrderClient.innerHTML = '<option value="">Выберите клиента</option>' + options;

                    const editClientSelect = document.getElementById('editOrderClient');
                    if (editClientSelect) {
                        editClientSelect.innerHTML = '<option value="">Выберите клиента</option>' + options;
                    }

                    if (selectedId !== undefined && selectedId !== null) {
                        createOrderClient.value = selectedId;
                    }
                }
            })
            .catch(error => console.error('Ошибка загрузки клиентов:', error));
    }

    function renderOrders() {
        const search = searchInput.value.trim();
        const status = statusFilter.value;

        fetch(`/orders/list/?search=${encodeURIComponent(search)}&status=${status}`)
            .then(response => response.json())
            .then(data => {
                if (data.orders && data.orders.length > 0) {
                    tableBody.innerHTML = data.orders.map(order => {
                        const statusClass = `status-badge--${order.status}`;
                        return `
                            <tr data-order-id="${order.id}">
                                <td>${escapeHtml(order.name || '—')}</td>
                                <td>${order.date}</td>
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
            const today = new Date().toISOString().split('T')[0];
            createOrderDate.value = today;
        }
    }

    function closeCreateModal() {
        createModal.classList.remove('active');
        document.body.style.overflow = '';
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
        setTimeout(() => newClientFullName.focus(), 100);
    }

    function closeCreateClientModal() {
        createClientModal.classList.remove('active');
        createClientTargetSelect = null;
    }

    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', function() {
            openCreateModal();
        });
    }

    if (createModalCloseBtn) {
        createModalCloseBtn.addEventListener('click', closeCreateModal);
    }

    if (createModalCancelBtn) {
        createModalCancelBtn.addEventListener('click', closeCreateModal);
    }

    if (createModal) {
        createModal.addEventListener('click', function(e) {
            if (e.target === this) closeCreateModal();
        });
    }

    if (createClientFromCreateBtn) {
        createClientFromCreateBtn.addEventListener('click', function() {
            openCreateClientModal(createOrderClient);
        });
    }

    if (createClientModalCloseBtn) {
        createClientModalCloseBtn.addEventListener('click', closeCreateClientModal);
    }

    if (createClientModalCancelBtn) {
        createClientModalCancelBtn.addEventListener('click', closeCreateClientModal);
    }

    if (createClientModal) {
        createClientModal.addEventListener('click', function(e) {
            if (e.target === this) closeCreateClientModal();
        });
    }

    if (createClientForm) {
        createClientForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const fullName = newClientFullName.value.trim();
            const phone = newClientPhone.value.trim();
            const city = newClientCity.value.trim();

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

            fetch('/clients/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({
                    full_name: fullName,
                    phone: phone,
                    city: city,
                    rating: 'medium',
                    client_type: 'organizer'
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                if (data.success) {
                    showToast(`Клиент "${data.client.full_name}" создан`);

                    const newOption = document.createElement('option');
                    newOption.value = data.client.id;
                    newOption.textContent = data.client.full_name + (data.client.agency ? ' (' + data.client.agency + ')' : '');

                    if (createClientTargetSelect) {
                        createClientTargetSelect.appendChild(newOption);
                        createClientTargetSelect.value = data.client.id;
                    }

                    const editSelect = document.getElementById('editOrderClient');
                    if (editSelect && createClientTargetSelect !== editSelect) {
                        const editOption = newOption.cloneNode(true);
                        editSelect.appendChild(editOption);
                    }

                    closeCreateClientModal();
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
            if (!date) {
                showToast('Пожалуйста, выберите дату');
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
        if (e.key === 'Escape') {
            if (createClientModal && createClientModal.classList.contains('active')) {
                closeCreateClientModal();
            } else if (createModal && createModal.classList.contains('active')) {
                closeCreateModal();
            }
        }
    });

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