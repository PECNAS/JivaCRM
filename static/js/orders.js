(function() {
    let currentOrderId = null;

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

    function loadClients(callback) {
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
                    
                    if (callback) callback(data.clients);
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
                            <td colspan="6" style="text-align:center; padding: 2rem; color: #7a7267;">
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

    function openCreateModal() {
        createModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        createForm.reset();
        
        const today = new Date().toISOString().split('T')[0];
        createOrderDate.value = today;
    }

    function closeCreateModal() {
        createModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openEditor(orderId) {
        if (window.OrderEditor && typeof window.OrderEditor.open === 'function') {
            window.OrderEditor.open(orderId);
        }
    }

    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', openCreateModal);
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
            if (createModal && createModal.classList.contains('active')) {
                closeCreateModal();
            }
        }
    });

    loadClients();
    renderOrders();
})();