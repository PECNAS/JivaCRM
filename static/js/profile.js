(function() {
    const TABS = ['info', 'payments', 'tickets'];

    let loadedTabs = { info: false, payments: false, tickets: false };
    let profileData = null;
    let editSnapshot = null;
    let selectedShows = [];

    const tabButtons = document.querySelectorAll('.profile-tab-btn');
    const tabContents = document.querySelectorAll('.profile-tab-content');
    const profileSubtitle = document.getElementById('profileSubtitle');

    const editModal = document.getElementById('profileEditModal');
    const editForm = document.getElementById('profileEditForm');
    const editCloseBtn = document.getElementById('profileEditCloseBtn');
    const editCancelBtn = document.getElementById('profileEditCancelBtn');
    const showsPicker = document.getElementById('profileShowsPicker');
    const artistCardSection = document.getElementById('profileArtistCardSection');

    const phoneInput = document.getElementById('profilePhone');

    function showToast(message) {
        window.UI.showToast(message);
    }

    function escapeHtml(text) {
        return window.UI.escapeHtml(text);
    }

    function formatMoney(value) {
        const num = parseFloat(value) || 0;
        return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
    }

    function switchTab(tabName) {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.id === 'tab-' + tabName));

        if (!loadedTabs[tabName]) {
            loadTab(tabName);
        }
    }

    function loadTab(tabName) {
        if (tabName === 'info') {
            loadInfoTab();
        } else if (tabName === 'payments') {
            loadPaymentsTab();
        } else if (tabName === 'tickets') {
            loadTicketsTab();
        }

        loadedTabs[tabName] = true;
    }

    function loadInfoTab() {
        const container = document.getElementById('tab-info');
        container.innerHTML = '<div class="profile-loading">Загрузка...</div>';

        fetch('/profile/detail/')
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    container.innerHTML = `<div class="profile-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }

                profileData = data;

                if (profileSubtitle) {
                    profileSubtitle.textContent = `${data.role_display} · ${data.username}`;
                }

                renderInfo(data);
            })
            .catch(err => {
                container.innerHTML = '<div class="profile-empty">Ошибка загрузки данных</div>';
                console.error(err);
            });
    }

    function renderField(label, value, options) {
        const settings = options || {};
        const isEmpty = !value;
        const shown = isEmpty ? (settings.emptyText || 'Не указано') : escapeHtml(value);

        return `
            <div class="profile-field${settings.full ? ' profile-field--full' : ''}">
                <span class="profile-field__label">${escapeHtml(label)}</span>
                <span class="profile-field__value${isEmpty ? ' profile-field__value--empty' : ''}">${shown}</span>
            </div>
        `;
    }

    function renderInfo(data) {
        const container = document.getElementById('tab-info');

        let skillsHtml = '<span class="profile-field__value profile-field__value--empty">Не указаны</span>';

        if (data.skills && data.skills.length > 0) {
            skillsHtml = `<div class="profile-skills">${data.skills.map(s => `<span class="profile-skill-tag">${escapeHtml(s.name)}</span>`).join('')}</div>`;
        }

        let artistCardHtml = '';

        if (data.is_artist && data.artist_card) {
            const card = data.artist_card;

            let showsHtml = '<span class="profile-field__value profile-field__value--empty">Не указано</span>';

            if (card.known_shows && card.known_shows.length > 0) {
                showsHtml = `<div class="profile-shows">${card.known_shows.map(s => `<span class="profile-show-tag">${escapeHtml(s.name)}</span>`).join('')}</div>`;
            }

            artistCardHtml = `
                <div class="profile-card">
                    <h3 class="profile-card__title">Карточка артиста</h3>
                    <div class="profile-grid">
                        ${renderField('Вес', card.weight)}
                        ${renderField('Рост', card.height)}
                        ${renderField('Размер обуви', card.shoe_size)}
                        <div class="profile-field profile-field--full">
                            <span class="profile-field__label">Навыки</span>
                            <span class="profile-field__value${card.skills_text ? '' : ' profile-field__value--empty'}">${escapeHtml(card.skills_text || 'Не указано')}</span>
                        </div>
                        <div class="profile-field profile-field--full">
                            <span class="profile-field__label">Знание шоу</span>
                            ${showsHtml}
                        </div>
                        <div class="profile-field profile-field--full">
                            <span class="profile-field__label">Комментарий</span>
                            <span class="profile-field__value${card.comment ? '' : ' profile-field__value--empty'}">${escapeHtml(card.comment || 'Не указано')}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-card__header">
                    <h3 class="profile-card__title">Личная информация</h3>
                    <button type="button" class="btn btn-primary btn-sm" data-profile-edit>Редактировать</button>
                </div>
                <div class="profile-grid">
                    ${renderField('ФИО', data.full_name)}
                    ${renderField('Логин', data.username)}
                    ${renderField('Роль', data.role_display)}
                    ${renderField('Телефон', data.phone)}
                    ${renderField('Телеграм', data.telegram)}
                    ${renderField('Статус', data.is_active ? 'Активен' : 'Неактивен')}
                    ${renderField('Дата регистрации', data.date_joined)}
                    <div class="profile-field profile-field--full">
                        <span class="profile-field__label">Навыки (общие)</span>
                        ${skillsHtml}
                    </div>
                </div>
            </div>

            <div class="profile-card">
                <h3 class="profile-card__title">Паспортные данные</h3>
                <div class="profile-grid">
                    ${renderField('Серия', data.passport_series)}
                    ${renderField('Номер', data.passport_number)}
                    ${renderField('Кем выдан', data.passport_issued_by, { full: true })}
                    ${renderField('Дата выдачи', data.passport_issued_date_display)}
                    ${renderField('Код подразделения', data.passport_department_code)}
                    ${renderField('Адрес регистрации', data.passport_registration, { full: true })}
                    ${renderField('ИНН', data.passport_inn)}
                    ${renderField('СНИЛС', data.passport_snils)}
                </div>
            </div>

            ${artistCardHtml}
        `;

        container.querySelectorAll('[data-profile-edit]').forEach(btn => {
            btn.addEventListener('click', openEditModal);
        });
    }

    function renderShowsPicker() {
        if (!showsPicker) return;

        showsPicker.innerHTML = '';

        const shows = (profileData && profileData.available_shows) || [];

        if (!shows.length) {
            showsPicker.innerHTML = '<span class="profile-field__value profile-field__value--empty">Шоу пока не добавлены</span>';
            return;
        }

        shows.forEach(show => {
            const label = document.createElement('label');
            label.className = 'profile-show-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = String(show.id);
            checkbox.checked = selectedShows.indexOf(show.id) !== -1;

            checkbox.addEventListener('change', function() {
                const id = parseInt(this.value, 10);

                if (this.checked) {
                    if (selectedShows.indexOf(id) === -1) selectedShows.push(id);
                } else {
                    selectedShows = selectedShows.filter(item => item !== id);
                }
            });

            const text = document.createElement('span');
            text.textContent = show.name;

            label.appendChild(checkbox);
            label.appendChild(text);
            showsPicker.appendChild(label);
        });
    }

    function openEditModal() {
        if (!profileData) return;

        document.getElementById('profileFullName').value = profileData.full_name || '';
        document.getElementById('profilePhone').value = profileData.phone || '';
        document.getElementById('profileTelegram').value = profileData.telegram === '—' ? '' : (profileData.telegram || '');
        document.getElementById('profilePassportSeries').value = profileData.passport_series || '';
        document.getElementById('profilePassportNumber').value = profileData.passport_number || '';
        document.getElementById('profilePassportIssuedBy').value = profileData.passport_issued_by || '';
        document.getElementById('profilePassportIssuedDate').value = profileData.passport_issued_date || '';
        document.getElementById('profilePassportCode').value = profileData.passport_department_code || '';
        document.getElementById('profilePassportRegistration').value = profileData.passport_registration || '';
        document.getElementById('profilePassportInn').value = profileData.passport_inn || '';
        document.getElementById('profilePassportSnils').value = profileData.passport_snils || '';

        const card = profileData.artist_card;

        artistCardSection.style.display = profileData.is_artist && card ? 'block' : 'none';

        if (profileData.is_artist && card) {
            document.getElementById('profileWeight').value = card.weight || '';
            document.getElementById('profileHeight').value = card.height || '';
            document.getElementById('profileShoeSize').value = card.shoe_size || '';
            document.getElementById('profileSkillsText').value = card.skills_text || '';
            document.getElementById('profileComment').value = card.comment || '';

            selectedShows = (card.known_shows || []).map(show => show.id);
            renderShowsPicker();
        }

        editSnapshot = window.UI.snapshot(editForm);
        editModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => document.getElementById('profileFullName').focus(), 100);
    }

    function closeEditModal() {
        editModal.classList.remove('active');
        document.body.style.overflow = '';
        editSnapshot = null;
    }

    function requestCloseEditModal() {
        if (window.UI.isDirtyFromSnapshot(editForm, editSnapshot)) {
            window.UI.confirm({
                title: 'Завершить редактирование?',
                text: 'Вы действительно хотите завершить редактирование? Изменения не сохранятся.',
                okText: 'Завершить',
                cancelText: 'Остаться',
                danger: true
            }).then(confirmed => {
                if (confirmed) closeEditModal();
            });
            return;
        }

        closeEditModal();
    }

    function maskPhone(input) {
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
            const rest = digits.slice(1);

            if (rest.length > 0) {
                formatted += ' (' + rest.slice(0, 3);
                if (rest.length > 3) {
                    formatted += ') ' + rest.slice(3, 6);
                    if (rest.length > 6) {
                        formatted += '-' + rest.slice(6, 8);
                        if (rest.length > 8) {
                            formatted += '-' + rest.slice(8, 10);
                        }
                    }
                }
            }
        }

        input.value = formatted;
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', function() { maskPhone(this); });
        phoneInput.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        phoneInput.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const fullName = document.getElementById('profileFullName').value.trim();
            const phone = document.getElementById('profilePhone').value.trim();

            if (!fullName) {
                showToast('Пожалуйста, заполните ФИО');
                return;
            }

            const digits = phone.replace(/\D/g, '');

            if (digits && digits.length !== 11) {
                showToast('Номер телефона должен содержать 11 цифр');
                return;
            }

            const payload = {
                full_name: fullName,
                phone: phone,
                telegram_username: document.getElementById('profileTelegram').value.trim(),
                passport_series: document.getElementById('profilePassportSeries').value.trim(),
                passport_number: document.getElementById('profilePassportNumber').value.trim(),
                passport_issued_by: document.getElementById('profilePassportIssuedBy').value.trim(),
                passport_issued_date: document.getElementById('profilePassportIssuedDate').value,
                passport_department_code: document.getElementById('profilePassportCode').value.trim(),
                passport_registration: document.getElementById('profilePassportRegistration').value.trim(),
                passport_inn: document.getElementById('profilePassportInn').value.trim(),
                passport_snils: document.getElementById('profilePassportSnils').value.trim()
            };

            if (profileData && profileData.is_artist) {
                payload.weight = document.getElementById('profileWeight').value.trim();
                payload.height = document.getElementById('profileHeight').value.trim();
                payload.shoe_size = document.getElementById('profileShoeSize').value.trim();
                payload.skills_text = document.getElementById('profileSkillsText').value.trim();
                payload.comment = document.getElementById('profileComment').value.trim();
                payload.known_shows = selectedShows.join(',');
            }

            const saveBtn = document.getElementById('profileEditSaveBtn');

            if (saveBtn) saveBtn.disabled = true;

            fetch('/profile/update/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': window.UI.getCSRFToken()
                },
                body: new URLSearchParams(payload)
            })
            .then(r => r.json())
            .then(data => {
                if (saveBtn) saveBtn.disabled = false;

                if (data.error) {
                    showToast(data.error);
                    return;
                }

                showToast('Данные сохранены');
                closeEditModal();
                loadedTabs.info = false;
                loadInfoTab();
            })
            .catch(err => {
                if (saveBtn) saveBtn.disabled = false;
                showToast('Ошибка сохранения');
                console.error(err);
            });
        });
    }

    if (editCloseBtn) {
        editCloseBtn.addEventListener('click', requestCloseEditModal);
    }

    if (editCancelBtn) {
        editCancelBtn.addEventListener('click', requestCloseEditModal);
    }

    if (editModal) {
        editModal.addEventListener('click', function(e) {
            if (e.target === this) requestCloseEditModal();
        });
    }

    function loadPaymentsTab() {
        const container = document.getElementById('tab-payments');
        container.innerHTML = '<div class="profile-loading">Загрузка...</div>';

        fetch('/profile/payments/')
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    container.innerHTML = `<div class="profile-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }

                renderPayments(data);
            })
            .catch(err => {
                container.innerHTML = '<div class="profile-empty">Ошибка загрузки платежей</div>';
                console.error(err);
            });
    }

    function renderPayments(data) {
        const container = document.getElementById('tab-payments');
        const operations = data.operations || [];
        const balance = parseFloat(data.balance) || 0;
        const balanceClass = balance < 0 ? 'money-amount money-amount--negative' : 'money-amount';

        const operationsHtml = operations.length
            ? `<div class="profile-payment-list">
                ${operations.map(op => `
                    <div class="profile-payment-row ${op.is_active ? '' : 'profile-payment-row--cancelled'}">
                        <div class="profile-payment-row__main">
                            <span class="profile-payment-row__title">${escapeHtml(op.title || '—')}</span>
                            <span class="profile-payment-row__meta">${escapeHtml(op.date_display)} · ${escapeHtml(op.subtitle || '')}</span>
                        </div>
                        <span class="profile-payment-row__amount ${op.amount < 0 ? 'profile-payment-row__amount--out' : ''}">${formatMoney(op.amount)}</span>
                    </div>
                `).join('')}
            </div>`
            : '<div class="profile-placeholder__text">Операций пока нет</div>';

        container.innerHTML = `
            <div class="profile-card">
                <h3 class="profile-card__title">Баланс</h3>
                <div class="profile-payment-balance">
                    <span class="profile-payment-balance__value ${balanceClass}">${formatMoney(balance)}</span>
                    <span class="profile-payment-balance__hint">Сумма, которую ещё не выплатили</span>
                </div>
            </div>
            <div class="profile-card">
                <h3 class="profile-card__title">История операций</h3>
                ${operationsHtml}
            </div>
        `;
    }

    function loadTicketsTab() {
        const container = document.getElementById('tab-tickets');
        container.innerHTML = '<div class="profile-loading">Загрузка...</div>';

        fetch('/profile/tickets/')
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    container.innerHTML = `<div class="profile-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }

                renderTickets(data.tickets || []);
            })
            .catch(err => {
                container.innerHTML = '<div class="profile-empty">Ошибка загрузки билетов</div>';
                console.error(err);
            });
    }

    function renderTickets(tickets) {
        const container = document.getElementById('tab-tickets');

        if (!tickets.length) {
            container.innerHTML = `
                <div class="profile-card">
                    <div class="profile-placeholder">
                        <svg class="profile-placeholder__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z"/>
                            <line x1="9" y1="9" x2="9" y2="15" stroke-dasharray="2 2"/>
                        </svg>
                        <div class="profile-placeholder__title">Транспортные билеты</div>
                        <div class="profile-placeholder__text">Билеты привязываются к заказам</div>
                        <div class="profile-placeholder__badge">Раздел в разработке</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="profile-events">
                ${tickets.map(ticket => `
                    <div class="profile-event">
                        <div class="profile-event__top">
                            <span class="profile-event__name">${escapeHtml(ticket.from_city || '—')} → ${escapeHtml(ticket.to_city || '—')}</span>
                            <span class="profile-event__status">${escapeHtml(ticket.transport_type_display)}</span>
                        </div>
                        <div class="profile-event__details">
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Отправление</span>
                                <span class="profile-event__detail-value">${escapeHtml(ticket.departure_datetime || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Прибытие</span>
                                <span class="profile-event__detail-value">${escapeHtml(ticket.arrival_datetime || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Заказ</span>
                                <span class="profile-event__detail-value">${escapeHtml(ticket.order_name || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Стоимость</span>
                                <span class="profile-event__detail-value">${formatMoney(ticket.cost)}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('uiConfirmModal')) return;

        if (editModal && editModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseEditModal();
        }
    }, true);

    loadTab('info');
})();
