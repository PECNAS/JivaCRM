(function() {
    let currentClientId = null;
    let isEditMode = false;
    let currentAgencySelect = null;

    const tableBody = document.getElementById('clientsTableBody');
    const searchInput = document.getElementById('searchInput');
    const ratingFilter = document.getElementById('ratingFilter');
    const modal = document.getElementById('clientModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const addClientBtn = document.getElementById('addClientBtn');
    const addModal = document.getElementById('addClientModal');
    const addModalCloseBtn = document.getElementById('addModalCloseBtn');
    const addModalCancelBtn = document.getElementById('addModalCancelBtn');
    const addForm = document.getElementById('addClientForm');
    const addClientType = document.getElementById('addClientType');
    const addAgencyGroup = document.getElementById('addAgencyGroup');
    const addAgencySelect = document.getElementById('addAgency');
    const editClientType = document.getElementById('editClientType');
    const editAgencyGroup = document.getElementById('editAgencyGroup');
    const editAgencySelect = document.getElementById('editAgency');
    const phoneInput = document.getElementById('addPhone');
    const editPhoneInput = document.getElementById('editPhone');
    const editClientBtn = document.getElementById('editClientBtn');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editForm = document.getElementById('editClientForm');
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');

    const addAgencyModal = document.getElementById('addAgencyModal');
    const addAgencyModalCloseBtn = document.getElementById('addAgencyModalCloseBtn');
    const addAgencyCancelBtn = document.getElementById('addAgencyCancelBtn');
    const addAgencyForm = document.getElementById('addAgencyForm');
    const addAgencyName = document.getElementById('addAgencyName');

    const addAddAgencyBtn = document.getElementById('addAddAgencyBtn');
    const editAddAgencyBtn = document.getElementById('editAddAgencyBtn');

    function toggleAgencyField(clientType, agencyGroup, isAdd = true) {
        if (clientType === 'agency') {
            agencyGroup.style.display = 'block';
            if (isAdd) {
                addAgencySelect.required = true;
            } else {
                editAgencySelect.required = true;
            }
        } else {
            agencyGroup.style.display = 'none';
            if (isAdd) {
                addAgencySelect.required = false;
                addAgencySelect.value = '';
            } else {
                editAgencySelect.required = false;
                editAgencySelect.value = '';
            }
        }
    }

    if (addClientType) {
        addClientType.addEventListener('change', function() {
            toggleAgencyField(this.value, addAgencyGroup, true);
        });
    }

    if (editClientType) {
        editClientType.addEventListener('change', function() {
            toggleAgencyField(this.value, editAgencyGroup, false);
        });
    }

    function openAddAgencyModal(selectElement) {
        currentAgencySelect = selectElement;
        addAgencyModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addAgencyForm.reset();
        addAgencyName.focus();
    }

    function closeAddAgencyModal() {
        addAgencyModal.classList.remove('active');
        document.body.style.overflow = '';
        currentAgencySelect = null;
    }

    function addAgencyToSelect(select, agencyId, agencyName) {
        const option = document.createElement('option');
        option.value = agencyId;
        option.textContent = agencyName;
        option.selected = true;
        select.appendChild(option);
    }

    if (addAddAgencyBtn) {
        addAddAgencyBtn.addEventListener('click', function() {
            openAddAgencyModal(addAgencySelect);
        });
    }

    if (editAddAgencyBtn) {
        editAddAgencyBtn.addEventListener('click', function() {
            openAddAgencyModal(editAgencySelect);
        });
    }

    if (addAgencyModalCloseBtn) {
        addAgencyModalCloseBtn.addEventListener('click', closeAddAgencyModal);
    }
    if (addAgencyCancelBtn) {
        addAgencyCancelBtn.addEventListener('click', closeAddAgencyModal);
    }
    if (addAgencyModal) {
        addAgencyModal.addEventListener('click', function(e) {
            if (e.target === this) closeAddAgencyModal();
        });
    }

    if (addAgencyForm) {
        addAgencyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = addAgencyName.value.trim();
            if (!name) {
                showToast('Пожалуйста, введите название агентства');
                addAgencyName.focus();
                return;
            }

            fetch('/agencies/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({ name: name })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                if (data.success) {
                    showToast(`Агентство "${data.agency.name}" успешно создано`);
                    if (currentAgencySelect) {
                        addAgencyToSelect(currentAgencySelect, data.agency.id, data.agency.name);
                    }
                    if (currentAgencySelect === addAgencySelect && editAgencySelect) {
                        addAgencyToSelect(editAgencySelect, data.agency.id, data.agency.name);
                    } else if (currentAgencySelect === editAgencySelect && addAgencySelect) {
                        addAgencyToSelect(addAgencySelect, data.agency.id, data.agency.name);
                    }
                    closeAddAgencyModal();
                }
            })
            .catch(error => {
                showToast('Ошибка при создании агентства');
                console.error(error);
            });
        });
    }

    function phoneMask(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length > 0 && value[0] !== '7' && value[0] !== '8') {
            value = '7' + value;
        }
        
        if (value.length > 0 && value[0] === '8') {
            value = '7' + value.slice(1);
        }
        
        let formatted = '';
        if (value.length > 0) {
            formatted = '+7';
            let remaining = value.slice(1);
            
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
        return input.value;
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', function() { phoneMask(this); });
        phoneInput.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        phoneInput.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    if (editPhoneInput) {
        editPhoneInput.addEventListener('input', function() { phoneMask(this); });
        editPhoneInput.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        editPhoneInput.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    function validatePhone(phone) {
        const digits = phone.replace(/\D/g, '');
        return digits.length === 11 && (digits[0] === '7' || digits[0] === '8');
    }

    function openClientModal(clientId) {
        currentClientId = clientId;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        
        fetch(`/clients/${clientId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                document.getElementById('modalClientName').textContent = data.full_name;
                document.getElementById('viewFullName').textContent = data.full_name;
                document.getElementById('viewPhone').textContent = data.phone;
                document.getElementById('viewClientType').textContent = data.client_type_display || '—';
                document.getElementById('viewAgency').textContent = data.agency || '—';
                document.getElementById('viewRating').textContent = data.rating_display;
                document.getElementById('viewEmail').textContent = data.email || '—';
                document.getElementById('viewTelegram').textContent = data.telegram || '—';
                document.getElementById('viewCity').textContent = data.city || '—';

                const ordersContainer = document.getElementById('viewOrdersList');
                if (data.orders && data.orders.length > 0) {
                    ordersContainer.innerHTML = data.orders.map(order => `
                        <div class="order-item">
                            <div class="order-info">
                                <span class="order-name">${order.address}</span>
                                <span class="order-meta">${order.date} · ${order.status}</span>
                            </div>
                            <a href="#" class="order-link" data-order-id="${order.id}">Перейти к заказу →</a>
                        </div>
                    `).join('');

                    ordersContainer.querySelectorAll('.order-link').forEach(link => {
                        link.addEventListener('click', function(e) {
                            e.preventDefault();
                            const orderId = this.getAttribute('data-order-id');
                            showToast(`Переход к заказу #${orderId}`);
                        });
                    });
                } else {
                    ordersContainer.innerHTML = '<p class="orders-empty">Нет заказов</p>';
                }

                document.getElementById('editFullName').value = data.full_name;
                document.getElementById('editPhone').value = data.phone;
                document.getElementById('editClientType').value = data.client_type_key || 'organizer';
                document.getElementById('editAgency').value = data.agency_id || '';
                document.getElementById('editTelegram').value = data.telegram === '—' ? '' : data.telegram;
                document.getElementById('editEmail').value = data.email === '—' ? '' : data.email;
                document.getElementById('editCity').value = data.city === '—' ? '' : data.city;
                document.getElementById('editRating').value = data.rating_key || 'medium';

                toggleAgencyField(data.client_type_key || 'organizer', editAgencyGroup, false);

                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                showToast('Ошибка загрузки данных клиента');
                console.error(error);
            });
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentClientId = null;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    }

    function openEditMode() {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
    }

    function cancelEdit() {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    }

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addRating').value = 'medium';
        document.getElementById('addClientType').value = 'organizer';
        document.getElementById('addPhone').value = '';
        addAgencyGroup.style.display = 'none';
        addAgencySelect.value = '';
        addAgencySelect.required = false;
    }

    function closeAddModal() {
        addModal.classList.remove('active');
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
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 2000);
    }

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    editClientBtn.addEventListener('click', openEditMode);
    editCancelBtn.addEventListener('click', cancelEdit);

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const clientType = document.getElementById('editClientType').value;
        const agencyId = document.getElementById('editAgency').value;
        const fullName = document.getElementById('editFullName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const telegram = document.getElementById('editTelegram').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const city = document.getElementById('editCity').value.trim();
        const rating = document.getElementById('editRating').value;

        if (!fullName) {
            showToast('Пожалуйста, заполните поле ФИО');
            document.getElementById('editFullName').focus();
            return;
        }

        if (!phone || phone === '+7') {
            showToast('Пожалуйста, введите номер телефона');
            document.getElementById('editPhone').focus();
            return;
        }

        if (!validatePhone(phone)) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            document.getElementById('editPhone').focus();
            return;
        }

        if (clientType === 'agency' && !agencyId) {
            showToast('Пожалуйста, выберите агентство');
            document.getElementById('editAgency').focus();
            return;
        }

        const data = {
            full_name: fullName,
            phone: phone,
            client_type: clientType,
            agency_id: agencyId,
            telegram: telegram,
            email: email,
            city: city,
            rating: rating
        };

        fetch(`/clients/${currentClientId}/update/`, {
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
                showToast('Данные клиента успешно обновлены');
                cancelEdit();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при обновлении клиента');
            console.error(error);
        });
    });

    addClientBtn.addEventListener('click', openAddModal);
    addModalCloseBtn.addEventListener('click', closeAddModal);
    addModalCancelBtn.addEventListener('click', closeAddModal);
    addModal.addEventListener('click', function(e) {
        if (e.target === this) closeAddModal();
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const clientType = document.getElementById('addClientType').value;
        const agencyId = document.getElementById('addAgency').value;
        const fullName = document.getElementById('addFullName').value.trim();
        const phone = document.getElementById('addPhone').value.trim();
        const telegram = document.getElementById('addTelegram').value.trim();
        const email = document.getElementById('addEmail').value.trim();
        const city = document.getElementById('addCity').value.trim();
        const rating = document.getElementById('addRating').value;

        if (!fullName) {
            showToast('Пожалуйста, заполните поле ФИО');
            document.getElementById('addFullName').focus();
            return;
        }

        if (!phone || phone === '+7') {
            showToast('Пожалуйста, введите номер телефона');
            document.getElementById('addPhone').focus();
            return;
        }

        if (!validatePhone(phone)) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            document.getElementById('addPhone').focus();
            return;
        }

        if (clientType === 'agency' && !agencyId) {
            showToast('Пожалуйста, выберите агентство');
            document.getElementById('addAgency').focus();
            return;
        }

        const data = {
            full_name: fullName,
            phone: phone,
            client_type: clientType,
            agency_id: agencyId,
            telegram: telegram,
            email: email,
            city: city,
            rating: rating
        };

        fetch('/clients/', {
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
                showToast(`Клиент "${data.client.full_name}" успешно добавлен`);
                closeAddModal();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при добавлении клиента');
            console.error(error);
        });
    });

    tableBody.addEventListener('click', function(e) {
        const viewLink = e.target.closest('.view-link');
        if (viewLink) {
            e.stopPropagation();
            const id = parseInt(viewLink.getAttribute('data-id'));
            openClientModal(id);
            return;
        }

        const row = e.target.closest('tr[data-client-id]');
        if (row) {
            const id = parseInt(row.getAttribute('data-client-id'));
            openClientModal(id);
        }
    });

    function filterClients() {
        const search = searchInput.value.trim();
        const rating = ratingFilter.value;
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (rating && rating !== 'all') params.append('rating', rating);
        window.location.href = `/clients/?${params.toString()}`;
    }

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterClients, 500);
    });

    ratingFilter.addEventListener('change', filterClients);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (addAgencyModal && addAgencyModal.classList.contains('active')) {
                closeAddAgencyModal();
            }
            if (modal && modal.classList.contains('active')) closeModal();
            if (addModal && addModal.classList.contains('active')) closeAddModal();
        }
    });
})();