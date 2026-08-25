(function() {
    let currentOrderId = null;
    let isEditMode = false;

    const tableBody = document.getElementById('ordersTableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const modal = document.getElementById('orderModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const addOrderBtn = document.getElementById('addOrderBtn');
    const addModal = document.getElementById('addOrderModal');
    const addModalCloseBtn = document.getElementById('addModalCloseBtn');
    const addModalCancelBtn = document.getElementById('addModalCancelBtn');
    const addForm = document.getElementById('addOrderForm');
    const editForm = document.getElementById('editOrderForm');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editOrderBtn = document.getElementById('editOrderBtn');
    const viewInScheduleBtn = document.getElementById('viewInScheduleBtn');

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
    }

    function loadClientsAndEmployees() {
        // Загрузка клиентов для селектов
        fetch('/clients/list/')
            .then(response => response.json())
            .then(data => {
                if (data.clients) {
                    const clientSelects = ['addClient', 'editClient'];
                    clientSelects.forEach(id => {
                        const select = document.getElementById(id);
                        if (select) {
                            select.innerHTML = data.clients.map(c => 
                                `<option value="${c.id}">${c.full_name}${c.agency ? ' (' + c.agency + ')' : ''}</option>`
                            ).join('');
                        }
                    });
                }
            })
            .catch(error => console.error('Ошибка загрузки клиентов:', error));

        // Загрузка сотрудников для селектов
        fetch('/employees/list/')
            .then(response => response.json())
            .then(data => {
                if (data.employees) {
                    const managerSelects = ['addManager', 'editManager'];
                    managerSelects.forEach(id => {
                        const select = document.getElementById(id);
                        if (select) {
                            select.innerHTML = data.employees.map(e => 
                                `<option value="${e.id}">${e.full_name}</option>`
                            ).join('');
                        }
                    });
                    
                    const storySelects = ['addStoryManager', 'editStoryManager'];
                    storySelects.forEach(id => {
                        const select = document.getElementById(id);
                        if (select) {
                            select.innerHTML = '<option value="">Не назначен</option>' + 
                                data.employees.map(e => 
                                    `<option value="${e.id}">${e.full_name}</option>`
                                ).join('');
                        }
                    });
                }
            })
            .catch(error => console.error('Ошибка загрузки сотрудников:', error));
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
                                <td>${order.address}</td>
                                <td>${order.date}</td>
                                <td>${order.client}</td>
                                <td><span class="status-badge ${statusClass}">${order.status_display}</span></td>
                                <td>${order.cost || '—'}</td>
                                <td><button class="view-link" data-id="${order.id}">Подробнее</button></td>
                            </tr>
                        `;
                    }).join('');

                    tableBody.querySelectorAll('[data-id]').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            const id = parseInt(this.getAttribute('data-id'));
                            openOrderModal(id);
                        });
                    });

                    tableBody.querySelectorAll('tr[data-order-id]').forEach(row => {
                        row.addEventListener('click', function() {
                            const id = parseInt(this.getAttribute('data-order-id'));
                            openOrderModal(id);
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

    function openOrderModal(orderId) {
        fetch(`/orders/${orderId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                currentOrderId = orderId;
                isEditMode = false;

                document.getElementById('modalOrderTitle').textContent = `Заказ #${data.id}`;
                document.getElementById('viewAddress').textContent = data.address || '—';
                document.getElementById('viewDate').textContent = data.date || '—';
                document.getElementById('viewClient').innerHTML = `<a href="#" data-client-id="${data.client_id}">${data.client_name}</a>`;
                document.getElementById('viewCost').textContent = data.cost || '—';
                document.getElementById('viewStatus').textContent = data.status_display;
                document.getElementById('viewSetupTime').textContent = data.setup_time || '—';
                document.getElementById('viewDressingRoom').textContent = data.dressing_room_comment || '—';
                document.getElementById('viewMeal').textContent = data.meal_comment || '—';
                document.getElementById('viewConcept').textContent = data.concept || '—';
                document.getElementById('viewTask').textContent = ''; // task поле отсутствует в модели

                const techItems = [];
                if (data.tech_lamps) techItems.push('Лампы');
                if (data.tech_laser) techItems.push('Лазер');
                if (data.tech_hazer) techItems.push('Хейзер');
                if (data.tech_grid) techItems.push('Сетка');
                if (data.tech_projection) techItems.push('Проекция');
                document.getElementById('viewTech').textContent = techItems.length ? techItems.join(', ') : '—';

                document.getElementById('viewProjection').textContent = data.tech_projection ? 'Есть' : 'Нет';
                document.getElementById('viewVenueFeatures').textContent = data.venue_comment || '—';
                document.getElementById('viewPropsFeatures').textContent = data.props_comment || '—';
                document.getElementById('viewAdaptation').textContent = ''; // adaptation поле отсутствует в модели
                document.getElementById('viewPaymentMethod').textContent = data.payment_method_display || '—';
                document.getElementById('viewManager').innerHTML = `<a href="#" data-manager-id="${data.manager_id}">${data.manager_name}</a>`;
                document.getElementById('viewStoryManager').textContent = data.story_manager_name || '—';

                document.getElementById('orderDetailsView').style.display = 'flex';
                document.getElementById('orderDetailsEdit').style.display = 'none';
                editOrderBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    Редактировать
                `;

                // Заполняем форму редактирования
                document.getElementById('editClient').value = data.client_id || '';
                document.getElementById('editDate').value = data.date || '';
                document.getElementById('editAddress').value = data.address || '';
                document.getElementById('editContactPhone').value = data.contact_phone || '';
                document.getElementById('editContactTelegram').value = data.contact_telegram || '';
                document.getElementById('editSetupTime').value = data.setup_time || '';
                document.getElementById('editDressingRoomComment').value = data.dressing_room_comment || '';
                document.getElementById('editMealComment').value = data.meal_comment || '';
                document.getElementById('editConcept').value = data.concept || '';
                document.getElementById('editTechComment').value = data.tech_comment || '';
                document.getElementById('editTechLamps').checked = data.tech_lamps || false;
                document.getElementById('editTechLaser').checked = data.tech_laser || false;
                document.getElementById('editTechHazer').checked = data.tech_hazer || false;
                document.getElementById('editTechGrid').checked = data.tech_grid || false;
                document.getElementById('editTechProjection').checked = data.tech_projection || false;
                document.getElementById('editVenueComment').value = data.venue_comment || '';
                document.getElementById('editPropsComment').value = data.props_comment || '';
                document.getElementById('editManager').value = data.manager_id || '';
                document.getElementById('editCost').value = data.cost || '';
                document.getElementById('editPaymentMethod').value = data.payment_method || '';
                document.getElementById('editStatus').value = data.status || 'request';
                document.getElementById('editDuration').value = data.duration || 1;
                document.getElementById('editStoryManager').value = data.story_manager_id || '';

                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                showToast('Ошибка загрузки данных заказа');
                console.error(error);
            });
    }

    function closeOrderModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentOrderId = null;
        isEditMode = false;
    }

    function openEditMode() {
        isEditMode = true;
        document.getElementById('orderDetailsView').style.display = 'none';
        document.getElementById('orderDetailsEdit').style.display = 'flex';
        editOrderBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Редактирование...
        `;
    }

    function cancelEdit() {
        isEditMode = false;
        document.getElementById('orderDetailsView').style.display = 'flex';
        document.getElementById('orderDetailsEdit').style.display = 'none';
        editOrderBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Редактировать
        `;
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
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 2000);
    }

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addStatus').value = 'request';
        document.getElementById('addPaymentMethod').value = '';
        document.getElementById('addTechLamps').checked = false;
        document.getElementById('addTechLaser').checked = false;
        document.getElementById('addTechHazer').checked = false;
        document.getElementById('addTechGrid').checked = false;
        document.getElementById('addTechProjection').checked = false;
        document.getElementById('addDuration').value = 1;
        document.getElementById('addStoryManager').value = '';
    }

    function closeAddModal() {
        addModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function getAddFormData() {
        return {
            client_id: document.getElementById('addClient').value,
            date: document.getElementById('addDate').value,
            address: document.getElementById('addAddress').value,
            contact_phone: document.getElementById('addContactPhone').value,
            contact_telegram: document.getElementById('addContactTelegram').value,
            setup_time: document.getElementById('addSetupTime').value,
            dressing_room_comment: document.getElementById('addDressingRoomComment').value,
            meal_comment: document.getElementById('addMealComment').value,
            concept: document.getElementById('addConcept').value,
            tech_lamps: document.getElementById('addTechLamps').checked,
            tech_laser: document.getElementById('addTechLaser').checked,
            tech_hazer: document.getElementById('addTechHazer').checked,
            tech_grid: document.getElementById('addTechGrid').checked,
            tech_projection: document.getElementById('addTechProjection').checked,
            tech_comment: document.getElementById('addTechComment').value,
            venue_comment: document.getElementById('addVenueComment').value,
            props_comment: document.getElementById('addPropsComment').value,
            manager_id: document.getElementById('addManager').value,
            cost: document.getElementById('addCost').value,
            payment_method: document.getElementById('addPaymentMethod').value,
            status: document.getElementById('addStatus').value,
            duration: document.getElementById('addDuration').value,
            story_manager_id: document.getElementById('addStoryManager').value
        };
    }

    function getEditFormData() {
        return {
            client_id: document.getElementById('editClient').value,
            date: document.getElementById('editDate').value,
            address: document.getElementById('editAddress').value,
            contact_phone: document.getElementById('editContactPhone').value,
            contact_telegram: document.getElementById('editContactTelegram').value,
            setup_time: document.getElementById('editSetupTime').value,
            dressing_room_comment: document.getElementById('editDressingRoomComment').value,
            meal_comment: document.getElementById('editMealComment').value,
            concept: document.getElementById('editConcept').value,
            tech_lamps: document.getElementById('editTechLamps').checked,
            tech_laser: document.getElementById('editTechLaser').checked,
            tech_hazer: document.getElementById('editTechHazer').checked,
            tech_grid: document.getElementById('editTechGrid').checked,
            tech_projection: document.getElementById('editTechProjection').checked,
            tech_comment: document.getElementById('editTechComment').value,
            venue_comment: document.getElementById('editVenueComment').value,
            props_comment: document.getElementById('editPropsComment').value,
            manager_id: document.getElementById('editManager').value,
            cost: document.getElementById('editCost').value,
            payment_method: document.getElementById('editPaymentMethod').value,
            status: document.getElementById('editStatus').value,
            duration: document.getElementById('editDuration').value,
            story_manager_id: document.getElementById('editStoryManager').value
        };
    }

    // Обработчики событий
    searchInput.addEventListener('input', function() {
        clearTimeout(this._timeout);
        this._timeout = setTimeout(renderOrders, 300);
    });

    statusFilter.addEventListener('change', renderOrders);

    modalCloseBtn.addEventListener('click', closeOrderModal);

    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeOrderModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (modal.classList.contains('active')) {
                closeOrderModal();
            }
            if (addModal.classList.contains('active')) {
                closeAddModal();
            }
        }
    });

    addOrderBtn.addEventListener('click', openAddModal);

    addModalCloseBtn.addEventListener('click', closeAddModal);
    addModalCancelBtn.addEventListener('click', closeAddModal);

    addModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddModal();
        }
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = getAddFormData();
        
        if (!formData.client_id || !formData.address || !formData.date || !formData.manager_id) {
            showToast('Пожалуйста, заполните обязательные поля (Клиент, Адрес, Дата, Менеджер)');
            return;
        }

        fetch('/orders/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
                return;
            }
            if (data.success) {
                showToast(`Заказ #${data.order.id} успешно создан`);
                closeAddModal();
                renderOrders();
            }
        })
        .catch(error => {
            showToast('Ошибка при создании заказа');
            console.error(error);
        });
    });

    editOrderBtn.addEventListener('click', function() {
        if (!isEditMode) {
            openEditMode();
        }
    });

    editCancelBtn.addEventListener('click', cancelEdit);

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = getEditFormData();
        
        if (!formData.client_id || !formData.address || !formData.date || !formData.manager_id) {
            showToast('Пожалуйста, заполните обязательные поля (Клиент, Адрес, Дата, Менеджер)');
            return;
        }

        fetch(`/orders/${currentOrderId}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
                return;
            }
            if (data.success) {
                showToast(`Заказ #${data.order.id} успешно обновлён`);
                cancelEdit();
                renderOrders();
                // Обновляем просмотр
                openOrderModal(currentOrderId);
            }
        })
        .catch(error => {
            showToast('Ошибка при обновлении заказа');
            console.error(error);
        });
    });

    viewInScheduleBtn.addEventListener('click', function() {
        showToast('Открывается расписание для заказа #' + currentOrderId);
    });

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-client-id]')) {
            e.preventDefault();
            const id = e.target.closest('[data-client-id]').getAttribute('data-client-id');
            showToast(`Переход к клиенту #${id}`);
        }
        if (e.target.closest('[data-manager-id]')) {
            e.preventDefault();
            const id = e.target.closest('[data-manager-id]').getAttribute('data-manager-id');
            showToast(`Переход к сотруднику #${id}`);
        }
    });

    // Инициализация
    loadClientsAndEmployees();
    renderOrders();
})();