(function() {
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
    const phoneInput = document.getElementById('addPhone');

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

    phoneInput.addEventListener('input', function() {
        phoneMask(this);
    });

    phoneInput.addEventListener('focus', function() {
        if (this.value === '') {
            this.value = '+7';
        }
    });

    phoneInput.addEventListener('blur', function() {
        if (this.value === '+7') {
            this.value = '';
        }
    });

    function validatePhone(phone) {
        const digits = phone.replace(/\D/g, '');
        return digits.length === 11 && (digits[0] === '7' || digits[0] === '8');
    }

    function openClientModal(clientId) {
        fetch(`/clients/${clientId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                document.getElementById('modalClientName').textContent = data.full_name;
                document.getElementById('modalFullName').textContent = data.full_name;
                document.getElementById('modalPhone').textContent = data.phone;
                document.getElementById('modalAgency').textContent = data.agency || '—';
                document.getElementById('modalRating').textContent = data.rating;
                document.getElementById('modalEmail').textContent = data.email || '—';
                document.getElementById('modalTelegram').textContent = data.telegram || '—';
                document.getElementById('modalCity').textContent = data.city || '—';

                const ordersContainer = document.getElementById('modalOrdersList');
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
    }

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addRating').value = 'medium';
        document.getElementById('addPhone').value = '';
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
        if (e.target === this) {
            closeModal();
        }
    });

    addClientBtn.addEventListener('click', openAddModal);
    addModalCloseBtn.addEventListener('click', closeAddModal);
    addModalCancelBtn.addEventListener('click', closeAddModal);
    addModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddModal();
        }
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('addFullName').value.trim();
        const phone = document.getElementById('addPhone').value.trim();
        const telegram = document.getElementById('addTelegram').value.trim();
        const email = document.getElementById('addEmail').value.trim();
        const agency = document.getElementById('addAgency').value.trim();
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

        const data = {
            full_name: fullName,
            phone: phone,
            telegram: telegram,
            email: email,
            agency: agency,
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
            if (modal.classList.contains('active')) {
                closeModal();
            }
            if (addModal.classList.contains('active')) {
                closeAddModal();
            }
        }
    });
})();