(function() {
    let currentEmployeeId = null;
    let currentArtistCard = null;
    let allServices = [];
    let isEditMode = false;
    let formSnapshot = null;

    const tableBody = document.getElementById('employeesTableBody');
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const modal = document.getElementById('employeeModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const addModal = document.getElementById('addEmployeeModal');
    const addModalCloseBtn = document.getElementById('addModalCloseBtn');
    const addModalCancelBtn = document.getElementById('addModalCancelBtn');
    const addForm = document.getElementById('addEmployeeForm');
    const editForm = document.getElementById('editEmployeeForm');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editEmployeeBtn = document.getElementById('editEmployeeBtn');
    const deleteEmployeeBtn = document.getElementById('deleteEmployeeBtn');
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');
    const notificationContainer = document.getElementById('notificationContainer');

    const artistCardModal = document.getElementById('artistCardModal');
    const artistCardModalCloseBtn = document.getElementById('artistCardModalCloseBtn');
    const artistCardCancelBtn = document.getElementById('artistCardCancelBtn');
    const artistCardForm = document.getElementById('artistCardForm');
    const editArtistCardBtn = document.getElementById('editArtistCardBtn');
    const artistCardView = document.getElementById('artistCardView');
    const showsMultiSelect = document.getElementById('showsMultiSelect');

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
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, 2000);
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
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

    function attachPhoneMask(input) {
        if (!input) return;
        input.addEventListener('input', function() { phoneMask(this); });
        input.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        input.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    attachPhoneMask(document.getElementById('addPhone'));
    attachPhoneMask(document.getElementById('editPhone'));

    function switchTab(tabName) {
        const tabBtns = document.querySelectorAll('.modal-tab-btn');
        const tabContents = document.querySelectorAll('.modal-tab-content');
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.dataset.content === tabName));
    }

    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    function renderEmployees() {
        loadEmployees(true);
    }

    function attachRowEvents() {
        tableBody.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                openEmployeeModal(id);
            });
        });

        tableBody.querySelectorAll('tr[data-employee-id]').forEach(row => {
            row.addEventListener('click', function() {
                const id = parseInt(row.getAttribute('data-employee-id'));
                openEmployeeModal(id);
            });
        });
    }

    function openEmployeeModal(employeeId) {
        currentEmployeeId = employeeId;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';

        fetch(`/employees/${employeeId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                document.getElementById('modalEmployeeName').textContent = data.full_name;
                document.getElementById('viewFullName').textContent = data.full_name;
                document.getElementById('viewUsername').textContent = data.username;
                document.getElementById('viewRole').textContent = data.role_display;
                document.getElementById('viewPhone').textContent = data.phone || '—';
                document.getElementById('viewTelegram').textContent = data.telegram || '—';
                document.getElementById('viewStatus').textContent = data.is_active ? 'Активен' : 'Неактивен';
                document.getElementById('viewDateJoined').textContent = data.date_joined || '—';
                document.getElementById('viewLastLogin').textContent = data.last_login || '—';

                document.getElementById('viewPassportSeries').textContent = data.passport_series || '—';
                document.getElementById('viewPassportNumber').textContent = data.passport_number || '—';
                document.getElementById('viewPassportIssuedBy').textContent = data.passport_issued_by || '—';
                document.getElementById('viewPassportIssuedDate').textContent = data.passport_issued_date || '—';
                document.getElementById('viewPassportDepartmentCode').textContent = data.passport_department_code || '—';
                document.getElementById('viewPassportRegistration').textContent = data.passport_registration || '—';
                document.getElementById('viewPassportInn').textContent = data.passport_inn || '—';
                document.getElementById('viewPassportSnils').textContent = data.passport_snils || '—';

                const artistCardTab = document.getElementById('artistCardTab');
                if (data.is_artist) {
                    if (artistCardTab) artistCardTab.style.display = 'inline-flex';
                    currentArtistCard = data.artist_card;
                    renderArtistCardView(data.artist_card);
                } else {
                    if (artistCardTab) artistCardTab.style.display = 'none';
                    currentArtistCard = null;
                }

                document.getElementById('editUsername').value = data.username;
                document.getElementById('editPassword').value = '';
                document.getElementById('editFullName').value = data.full_name;
                document.getElementById('editRole').value = data.role;
                document.getElementById('editPhone').value = data.phone || '';
                document.getElementById('editTelegram').value = data.telegram || '';
                document.getElementById('editIsActive').checked = data.is_active;
                document.getElementById('editPassportSeries').value = data.passport_series || '';
                document.getElementById('editPassportNumber').value = data.passport_number || '';
                document.getElementById('editPassportIssuedBy').value = data.passport_issued_by || '';
                document.getElementById('editPassportIssuedDate').value = data.passport_issued_date || '';
                document.getElementById('editPassportDepartmentCode').value = data.passport_department_code || '';
                document.getElementById('editPassportRegistration').value = data.passport_registration || '';
                document.getElementById('editPassportInn').value = data.passport_inn || '';
                document.getElementById('editPassportSnils').value = data.passport_snils || '';

                switchTab('main');
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                showToast('Ошибка загрузки данных сотрудника');
                console.error(error);
            });
    }

    function renderArtistCardView(card) {
        if (!artistCardView) return;
        if (!card || (!card.weight && !card.height && !card.shoe_size && !card.skills_text && !card.comment && (!card.known_shows || card.known_shows.length === 0))) {
            artistCardView.innerHTML = '<p class="artist-card-empty">Карточка артиста не заполнена</p>';
            return;
        }

        let showsHtml = '—';
        if (card.known_shows && card.known_shows.length > 0) {
            showsHtml = card.known_shows.map(s => escapeHtml(s.name)).join(', ');
        }

        artistCardView.innerHTML = `
            <div class="artist-card-details">
                <div class="detail-row">
                    <span class="detail-label">Вес:</span>
                    <span class="detail-value">${escapeHtml(card.weight || '—')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Рост:</span>
                    <span class="detail-value">${escapeHtml(card.height || '—')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Размер обуви:</span>
                    <span class="detail-value">${escapeHtml(card.shoe_size || '—')}</span>
                </div>
                <div class="detail-row detail-row--full" style="grid-column: 1 / -1;">
                    <span class="detail-label">Навыки:</span>
                    <span class="detail-value">${escapeHtml(card.skills_text || '—')}</span>
                </div>
                <div class="detail-row detail-row--full" style="grid-column: 1 / -1;">
                    <span class="detail-label">Комментарий:</span>
                    <span class="detail-value">${escapeHtml(card.comment || '—')}</span>
                </div>
                <div class="detail-row detail-row--full" style="grid-column: 1 / -1;">
                    <span class="detail-label">Знание шоу:</span>
                    <span class="detail-value">${showsHtml}</span>
                </div>
            </div>
        `;
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentEmployeeId = null;
        currentArtistCard = null;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        isEditMode = false;
        formSnapshot = null;
    }

    function isEmployeeFormDirty() {
        if (!isEditMode) return false;
        return window.UI.isDirtyFromSnapshot(editForm, formSnapshot);
    }

    function requestCloseModal() {
        if (!isEmployeeFormDirty()) {
            closeModal();
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите завершить редактирование? Изменения не сохранятся.',
            okText: 'Завершить',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeModal();
        });
    }

    function requestCloseAddModal() {
        if (window.UI.isEmptyForm(addForm)) {
            closeAddModal();
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите закрыть окно? Введённые данные не сохранятся.',
            okText: 'Закрыть',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeAddModal();
        });
    }

    function openEditMode() {
        isEditMode = true;
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
        formSnapshot = window.UI.snapshot(editForm);
    }

    function cancelEdit() {
        isEditMode = false;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    }

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addIsActive').checked = true;
        document.getElementById('addRole').value = 'artist';
        document.getElementById('addPhone').value = '';
    }

    function closeAddModal() {
        addModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', requestCloseModal);
    }
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) requestCloseModal();
        });
    }

    const closeEmployeeBtn = document.getElementById('closeEmployeeBtn');

    if (closeEmployeeBtn) {
        closeEmployeeBtn.addEventListener('click', requestCloseModal);
    }

    if (editEmployeeBtn) {
        editEmployeeBtn.addEventListener('click', openEditMode);
    }
    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', cancelEdit);
    }

    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const data = {
                username: document.getElementById('editUsername').value.trim(),
                password: document.getElementById('editPassword').value.trim(),
                full_name: document.getElementById('editFullName').value.trim(),
                role: document.getElementById('editRole').value,
                phone: document.getElementById('editPhone').value.trim(),
                telegram: document.getElementById('editTelegram').value.trim(),
                is_active: document.getElementById('editIsActive').checked ? 'on' : 'off',
                passport_series: document.getElementById('editPassportSeries').value.trim(),
                passport_number: document.getElementById('editPassportNumber').value.trim(),
                passport_issued_by: document.getElementById('editPassportIssuedBy').value.trim(),
                passport_issued_date: document.getElementById('editPassportIssuedDate').value,
                passport_department_code: document.getElementById('editPassportDepartmentCode').value.trim(),
                passport_registration: document.getElementById('editPassportRegistration').value.trim(),
                passport_inn: document.getElementById('editPassportInn').value.trim(),
                passport_snils: document.getElementById('editPassportSnils').value.trim(),
            };

            if (!data.username || !data.full_name) {
                showToast('Заполните обязательные поля');
                return;
            }

            fetch(`/employees/${currentEmployeeId}/update/`, {
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
                    showToast('Данные сотрудника успешно обновлены');
                    cancelEdit();
                    renderEmployees();
                    openEmployeeModal(currentEmployeeId);
                }
            })
            .catch(error => {
                showToast('Ошибка при обновлении сотрудника');
                console.error(error);
            });
        });
    }

    function deactivateCurrentEmployee(sourceButton) {
        if (!currentEmployeeId) return;

        window.UI.confirm({
            title: 'Деактивировать сотрудника?',
            text: 'Сотрудник перестанет отображаться во всех списках и не будет доступен для назначения. В уже существующих заказах он останется.',
            okText: 'Деактивировать',
            cancelText: 'Отмена',
            danger: true
        }).then(confirmed => {
            if (!confirmed) return;

            fetch(`/employees/${currentEmployeeId}/delete/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() }
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                if (data.success) {
                    showToast('Сотрудник деактивирован');
                    closeModal();
                    renderEmployees();
                }
            })
            .catch(error => {
                showToast('Ошибка при деактивации сотрудника');
                console.error(error);
            });
        });
    }

    if (deleteEmployeeBtn) {
        deleteEmployeeBtn.addEventListener('click', function() {
            deactivateCurrentEmployee(this);
        });
    }

    const editDeactivateBtn = document.getElementById('editDeactivateBtn');

    if (editDeactivateBtn) {
        editDeactivateBtn.addEventListener('click', function() {
            deactivateCurrentEmployee(this);
        });
    }

    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', openAddModal);
    }
    if (addModalCloseBtn) {
        addModalCloseBtn.addEventListener('click', closeAddModal);
    }
    if (addModalCancelBtn) {
        addModalCancelBtn.addEventListener('click', closeAddModal);
    }
    if (addModal) {
        addModal.addEventListener('click', function(e) {
            if (e.target === this) closeAddModal();
        });
    }

    if (addForm) {
        addForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const data = {
                username: document.getElementById('addUsername').value.trim(),
                password: document.getElementById('addPassword').value.trim(),
                full_name: document.getElementById('addFullName').value.trim(),
                role: document.getElementById('addRole').value,
                phone: document.getElementById('addPhone').value.trim(),
                telegram: document.getElementById('addTelegram').value.trim(),
                is_active: document.getElementById('addIsActive').checked ? 'on' : 'off',
                passport_series: document.getElementById('addPassportSeries').value.trim(),
                passport_number: document.getElementById('addPassportNumber').value.trim(),
                passport_issued_by: document.getElementById('addPassportIssuedBy').value.trim(),
                passport_issued_date: document.getElementById('addPassportIssuedDate').value,
                passport_department_code: document.getElementById('addPassportDepartmentCode').value.trim(),
                passport_registration: document.getElementById('addPassportRegistration').value.trim(),
                passport_inn: document.getElementById('addPassportInn').value.trim(),
                passport_snils: document.getElementById('addPassportSnils').value.trim(),
            };

            if (!data.username || !data.password || !data.full_name) {
                showToast('Заполните обязательные поля');
                return;
            }

            fetch('/employees/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams(data)
            })
            .then(response => response.json())
            .then(res => {
                if (res.error) {
                    showToast(res.error);
                    return;
                }
                if (res.success) {
                    closeAddModal();
                    renderEmployees();
                    if (res.employee.is_artist) {
                        showArtistCardNotification(res.employee.id, res.employee.full_name);
                    } else {
                        showToast(`Сотрудник "${res.employee.full_name}" успешно создан`);
                    }
                }
            })
            .catch(error => {
                showToast('Ошибка при добавлении сотрудника');
                console.error(error);
            });
        });
    }

    function showArtistCardNotification(employeeId, employeeName) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification__content">
                <div class="notification__text">
                    Сотрудник "<strong>${escapeHtml(employeeName)}</strong>" успешно создан.<br>
                    Хотите отредактировать карточку артиста сейчас?
                </div>
                <div class="notification__actions">
                    <button class="notification__btn" data-action="edit-artist-card">
                        Редактировать
                    </button>
                    <button class="notification__btn notification__btn--outline" data-action="dismiss">
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

        notification.querySelector('[data-action="edit-artist-card"]').addEventListener('click', function() {
            clearTimeout(timeoutId);
            removeNotification(notification);
            openEmployeeModal(employeeId);
            setTimeout(() => {
                if (currentEmployeeId === employeeId) {
                    openArtistCardModal(employeeId);
                }
            }, 500);
        });

        notification.querySelector('[data-action="dismiss"]').addEventListener('click', function() {
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

    function loadServices() {
        fetch('/artist-card/services/')
            .then(r => r.json())
            .then(data => {
                if (data.services) {
                    allServices = data.services;
                }
            })
            .catch(err => console.error('Ошибка загрузки услуг:', err));
    }

    function renderShowsCheckboxes(selectedIds) {
        if (!showsMultiSelect) return;
        if (allServices.length === 0) {
            showsMultiSelect.innerHTML = '<span style="color: #7a7267; font-size: 0.85rem; padding: 0.5rem;">Нет доступных услуг</span>';
            return;
        }

        const selectedSet = new Set(selectedIds || []);

        showsMultiSelect.innerHTML = allServices.map(s => {
            const isChecked = selectedSet.has(s.id);
            return `
                <label class="show-checkbox-label ${isChecked ? 'checked' : ''}">
                    <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''}>
                    ${escapeHtml(s.name)}
                </label>
            `;
        }).join('');

        showsMultiSelect.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', function() {
                this.closest('.show-checkbox-label').classList.toggle('checked', this.checked);
            });
        });
    }

    function openArtistCardModal(employeeId) {
        fetch(`/employees/${employeeId}/artist-card/`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                const card = data.artist_card;

                document.getElementById('artistWeight').value = card.weight || '';
                document.getElementById('artistHeight').value = card.height || '';
                document.getElementById('artistShoeSize').value = card.shoe_size || '';
                document.getElementById('artistSkillsText').value = card.skills_text || '';
                document.getElementById('artistComment').value = card.comment || '';

                const selectedIds = (card.known_shows || []).map(s => s.id);
                renderShowsCheckboxes(selectedIds);

                artistCardModal.classList.add('active');
            })
            .catch(err => {
                showToast('Ошибка загрузки карточки артиста');
                console.error(err);
            });
    }

    function closeArtistCardModal() {
        if (artistCardModal) {
            artistCardModal.classList.remove('active');
        }
    }

    if (editArtistCardBtn) {
        editArtistCardBtn.addEventListener('click', function() {
            if (currentEmployeeId) {
                openArtistCardModal(currentEmployeeId);
            }
        });
    }

    if (artistCardModalCloseBtn) {
        artistCardModalCloseBtn.addEventListener('click', closeArtistCardModal);
    }
    if (artistCardCancelBtn) {
        artistCardCancelBtn.addEventListener('click', closeArtistCardModal);
    }
    if (artistCardModal) {
        artistCardModal.addEventListener('click', function(e) {
            if (e.target === this) closeArtistCardModal();
        });
    }

    if (artistCardForm) {
        artistCardForm.addEventListener('submit', function(e) {
            e.preventDefault();

            if (!currentEmployeeId) return;

            const selectedShows = [];
            showsMultiSelect.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                selectedShows.push(cb.value);
            });

            const data = {
                weight: document.getElementById('artistWeight').value.trim(),
                height: document.getElementById('artistHeight').value.trim(),
                shoe_size: document.getElementById('artistShoeSize').value.trim(),
                skills_text: document.getElementById('artistSkillsText').value.trim(),
                comment: document.getElementById('artistComment').value.trim(),
                known_shows: selectedShows.join(','),
            };

            fetch(`/employees/${currentEmployeeId}/artist-card/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams(data)
            })
            .then(r => r.json())
            .then(res => {
                if (res.error) {
                    showToast(res.error);
                    return;
                }
                if (res.success) {
                    showToast('Карточка артиста сохранена');
                    currentArtistCard = res.artist_card;
                    renderArtistCardView(res.artist_card);
                    closeArtistCardModal();
                }
            })
            .catch(err => {
                showToast('Ошибка сохранения карточки');
                console.error(err);
            });
        });
    }

    const EMPLOYEES_PAGE = 50;
    let employeesOffset = 0;

    const loadMoreBox = document.getElementById('employeesLoadMore');
    const loadMoreBtn = document.getElementById('employeesLoadMoreBtn');

    function employeeRow(emp) {
        return `
            <tr data-employee-id="${emp.id}">
                <td>${escapeHtml(emp.full_name)}</td>
                <td>${escapeHtml(emp.username)}</td>
                <td>${escapeHtml(emp.role_display)}</td>
                <td>${escapeHtml(emp.phone || '—')}</td>
                <td>
                    <span class="status-badge status-badge--${emp.is_active ? 'active' : 'inactive'}">
                        ${emp.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                </td>
                <td><button class="view-link" data-id="${emp.id}">Подробнее</button></td>
            </tr>
        `;
    }

    function loadEmployees(reset) {
        const search = searchInput.value.trim();
        const role = roleFilter.value;
        const params = new URLSearchParams();

        if (reset) {
            employeesOffset = 0;
            tableBody.innerHTML = '<tr><td colspan="6" class="load-more__empty">Загрузка...</td></tr>';
        }

        if (search) params.set('search', search);
        if (role && role !== 'all') params.set('role', role);
        params.set('limit', String(EMPLOYEES_PAGE));
        params.set('offset', String(employeesOffset));

        if (loadMoreBtn) loadMoreBtn.disabled = true;

        fetch(`/employees/list/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (loadMoreBtn) loadMoreBtn.disabled = false;

                if (data.error) {
                    window.UI.showToast(data.error);
                    return;
                }

                const rows = data.employees || [];

                if (reset) {
                    tableBody.innerHTML = '';
                }

                if (!reset && !rows.length) {
                    if (loadMoreBox) loadMoreBox.classList.add('load-more--done');
                    return;
                }

                if (reset && !rows.length) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="load-more__empty">Сотрудники не найдены</td></tr>';
                } else {
                    tableBody.insertAdjacentHTML('beforeend', rows.map(employeeRow).join(''));
                }

                employeesOffset += rows.length;

                if (loadMoreBox) {
                    loadMoreBox.classList.toggle('load-more--done', !data.has_more);
                }

                attachRowEvents();
            })
            .catch(error => {
                if (loadMoreBtn) loadMoreBtn.disabled = false;
                console.error('Ошибка загрузки сотрудников:', error);
            });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            loadEmployees(false);
        });
    }

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadEmployees(true), 400);
        });
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', function() {
            loadEmployees(true);
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('uiConfirmModal')) return;

        if (artistCardModal && artistCardModal.classList.contains('active')) {
            e.preventDefault();
            closeArtistCardModal();
        } else if (modal && modal.classList.contains('active')) {
            e.preventDefault();
            requestCloseModal();
        } else if (addModal && addModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseAddModal();
        }
    }, true);

    loadServices();
    attachRowEvents();

    if (loadMoreBox) {
        loadMoreBox.classList.toggle('load-more--done', loadMoreBox.dataset.hasMore !== '1');
    }

    employeesOffset = tableBody.querySelectorAll('tr[data-employee-id]').length;
})();