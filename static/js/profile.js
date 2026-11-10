(function() {
    const TABS = ['info', 'availability', 'payments', 'tickets'];

    let loadedTabs = { info: false, availability: false, payments: false, tickets: false };
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
        return window.UI.formatMoney(value);
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
        } else if (tabName === 'availability') {
            loadAvailabilityTab();
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
                    ${renderField('Имя для обращения', data.nickname || 'Не задано')}
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

        const nicknameField = document.getElementById('profileNickname');
        if (nicknameField) nicknameField.value = profileData.nickname || '';

        window.UI.setPhoneValue(document.getElementById('profilePhone'), profileData.phone || '');
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

        document.getElementById('profileUsername').value = profileData.username || '';
        document.getElementById('profileCurrentPassword').value = '';
        document.getElementById('profileNewPassword').value = '';
        document.getElementById('profileNewPasswordRepeat').value = '';

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


    const credentialsForm = document.getElementById('profileCredentialsForm');
    const credentialsSaveBtn = document.getElementById('profileCredentialsSaveBtn');

    function submitCredentials(e) {
        e.preventDefault();

        if (!credentialsForm) return;

        const username = document.getElementById('profileUsername').value.trim();
        const currentPassword = document.getElementById('profileCurrentPassword').value;
        const newPassword = document.getElementById('profileNewPassword').value;
        const repeatPassword = document.getElementById('profileNewPasswordRepeat').value;

        if (!currentPassword) {
            showToast('Введите текущий пароль');
            document.getElementById('profileCurrentPassword').focus();
            return;
        }

        if (newPassword || repeatPassword) {
            if (newPassword.length < 6) {
                showToast('Пароль должен содержать минимум 6 символов');
                document.getElementById('profileNewPassword').focus();
                return;
            }

            if (newPassword !== repeatPassword) {
                showToast('Пароли не совпадают');
                document.getElementById('profileNewPasswordRepeat').focus();
                return;
            }
        }

        const formData = new FormData();
        formData.append('username', username);
        formData.append('current_password', currentPassword);
        formData.append('new_password', newPassword);
        formData.append('repeat_password', repeatPassword);

        if (credentialsSaveBtn) credentialsSaveBtn.disabled = true;

        fetch('/profile/credentials/', {
            method: 'POST',
            headers: { 'X-CSRFToken': window.UI.getCSRFToken() },
            body: formData
        })
            .then(r => r.json())
            .then(data => {
                if (credentialsSaveBtn) credentialsSaveBtn.disabled = false;

                if (data.error) {
                    showToast(data.error);
                    return;
                }

                if (profileData) profileData.username = data.username;

                document.getElementById('profileCurrentPassword').value = '';
                document.getElementById('profileNewPassword').value = '';
                document.getElementById('profileNewPasswordRepeat').value = '';

                showToast(data.password_changed ? 'Логин и пароль обновлены' : 'Логин обновлён');
            })
            .catch(() => {
                if (credentialsSaveBtn) credentialsSaveBtn.disabled = false;
                showToast('Ошибка сохранения');
            });
    }

    if (credentialsForm) {
        credentialsForm.addEventListener('submit', submitCredentials);
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
                nickname: (document.getElementById('profileNickname') || {}).value || '',
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
        const showRates = !!data.show_rates;

        const rowsHtml = operations.length
            ? operations.map(op => {
                const isPayout = op.type === 'payout';
                const amountClass = op.amount < 0 ? 'profile-money-table__amount--out' : 'profile-money-table__amount--in';

                return `
                    <tr class="${op.is_active ? '' : 'profile-money-table__row--cancelled'}">
                        <td class="profile-money-table__muted">${escapeHtml(op.date_display)}</td>
                        <td>
                            <div class="profile-money-table__main">
                                <span class="profile-money-table__title">${escapeHtml(op.title || '—')}</span>
                                <span class="profile-money-table__meta">${escapeHtml(op.subtitle || '')}</span>
                            </div>
                        </td>
                        <td class="profile-money-table__type">${isPayout ? 'Выплата' : 'Начисление'}</td>
                        <td class="profile-money-table__amount ${amountClass}">${formatMoney(op.amount)}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="4" class="profile-money-table__empty">Операций пока нет</td></tr>';

        const summaryHtml = showRates
            ? `
                <div class="profile-money-summary__item">
                    <span class="profile-money-summary__label">К выплате</span>
                    <span class="profile-money-summary__value ${balanceClass}">${formatMoney(balance)}</span>
                </div>
                <div class="profile-money-summary__item">
                    <span class="profile-money-summary__label">Начислено за месяц · ${escapeHtml(data.month_label || '')}</span>
                    <span class="profile-money-summary__value">${formatMoney(data.month_accrued || 0)}</span>
                </div>
                <div class="profile-money-summary__item">
                    <span class="profile-money-summary__label">Выплачено за месяц</span>
                    <span class="profile-money-summary__value">${formatMoney(data.month_paid || 0)}</span>
                </div>
            `
            : `
                <div class="profile-money-summary__item">
                    <span class="profile-money-summary__label">Начислено за месяц · ${escapeHtml(data.month_label || '')}</span>
                    <span class="profile-money-summary__value">${formatMoney(data.month_accrued || 0)}</span>
                </div>
                <div class="profile-money-summary__item">
                    <span class="profile-money-summary__label">Выплачено за месяц</span>
                    <span class="profile-money-summary__value">${formatMoney(data.month_paid || 0)}</span>
                </div>
            `;

        container.innerHTML = `
            <div class="profile-card">
                <h3 class="profile-card__title">${showRates ? 'Баланс' : 'Мои деньги'}</h3>
                <div class="profile-money-summary">${summaryHtml}</div>
            </div>
            <div class="profile-card">
                <h3 class="profile-card__title">История операций</h3>
                <div class="profile-money-table-wrap">
                    <table class="profile-money-table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Операция</th>
                                <th>Тип</th>
                                <th class="profile-money-table__amount">Сумма</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
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

    const availabilityWeekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const availabilityState = { weekly: {}, exceptions: [], calendar: [], editingId: null, kind: 'weekly', intervals: [] };

    const availabilityModal = document.getElementById('availabilityModal');
    const availabilityModalTitle = document.getElementById('availabilityModalTitle');
    const availabilityWeekday = document.getElementById('availabilityWeekday');
    const availabilityStart = document.getElementById('availabilityStart');
    const availabilityEnd = document.getElementById('availabilityEnd');
    const availabilityAction = document.getElementById('availabilityAction');
    const availabilityComment = document.getElementById('availabilityComment');
    const availabilityIntervals = document.getElementById('availabilityIntervals');
    const availabilityIntervalsList = document.getElementById('availabilityIntervalsList');
    const availabilityWeekdayGroup = document.getElementById('availabilityWeekdayGroup');
    const availabilityStartGroup = document.getElementById('availabilityStartGroup');
    const availabilityEndGroup = document.getElementById('availabilityEndGroup');

    function availabilityStatusClass(status) {
        if (status === 'off') return 'availability-day--off';
        if (status === 'partial') return 'availability-day--partial';
        return 'availability-day--free';
    }

    function loadAvailabilityTab() {
        const container = document.getElementById('tab-availability');

        if (!availabilityState.weekly || Object.keys(availabilityState.weekly).length === 0) {
            container.innerHTML = '<div class="profile-loading">Загрузка...</div>';
        }

        fetch('/profile/availability/detail/', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    container.innerHTML = `<div class="profile-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }

                availabilityState.weekly = data.weekly || {};
                availabilityState.exceptions = data.exceptions || [];
                availabilityState.calendar = data.calendar || [];

                renderAvailabilityTab(data);
            })
            .catch(error => {
                container.innerHTML = '<div class="profile-empty">Ошибка загрузки доступности</div>';
                console.error(error);
            });
    }

    function renderAvailabilityTab(data) {
        const container = document.getElementById('tab-availability');

        const weekdayCards = availabilityWeekdays.map((label, index) => {
            const rule = availabilityState.weekly[String(index)];
            const action = rule ? rule.action : 'day';
            const value = rule ? rule.label : 'Весь день';

            return `
                <button type="button" class="availability-week ${action === 'off' ? 'availability-week--off' : (action === 'partial' ? 'availability-week--partial' : '')}" data-weekday="${index}">
                    <span class="availability-week__name">${label}</span>
                    <span class="availability-week__value">${escapeHtml(value)}</span>
                </button>
            `;
        }).join('');

        const exceptionsHtml = availabilityState.exceptions.length
            ? availabilityState.exceptions.map(rule => `
                <div class="availability-exception">
                    <div class="availability-exception__main">
                        <span class="availability-exception__dates">${escapeHtml(rule.start_display)}${rule.end_display && rule.end_display !== rule.start_display ? ' — ' + escapeHtml(rule.end_display) : ''}</span>
                        <span class="availability-exception__value">${escapeHtml(rule.label)}${rule.comment ? ' · ' + escapeHtml(rule.comment) : ''}</span>
                    </div>
                    <div class="availability-exception__actions">
                        <button type="button" class="money-icon-btn" data-exception-edit="${rule.id}" aria-label="Изменить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button type="button" class="money-icon-btn money-icon-btn--danger" data-exception-delete="${rule.id}" aria-label="Удалить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('')
            : '<div class="profile-empty">Исключений нет — действует обычная неделя</div>';

        const calendarHeader = availabilityWeekdays.map(label => `
            <div class="availability-calendar__weekday">${escapeHtml(label.slice(0, 2))}</div>
        `).join('');

        const calendarHtml = availabilityState.calendar.map(day => {
            if (day.empty) {
                return '<div class="availability-day availability-day--empty"></div>';
            }

            return `
                <button type="button" class="availability-day ${availabilityStatusClass(day.status)} ${day.is_today ? 'availability-day--today' : ''}" data-day-date="${escapeHtml(day.date || '')}" data-day-action="${escapeHtml(day.action || 'day')}" data-day-source="${escapeHtml(String(day.source_id || ''))}" data-day-kind="${escapeHtml(day.source_kind || '')}" title="${escapeHtml(day.weekday_label)} · ${escapeHtml(day.label)}">
                    <span class="availability-day__date">${escapeHtml(day.day_label)}</span>
                    <span class="availability-day__value">${day.status === 'free' ? 'весь день' : escapeHtml(day.label)}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-card__header">
                    <h3 class="profile-card__title">Обычная неделя</h3>
                </div>
                <p class="profile-hint">Задайте, когда вы заняты в обычный день недели. Свободное время — всё остальное, оно действует каждый месяц автоматически.</p>
                <div class="availability-week-grid">${weekdayCards}</div>
            </div>

            <div class="profile-card">
                <div class="profile-card__header">
                    <h3 class="profile-card__title">Исключения на даты</h3>
                    <button type="button" class="btn btn-primary btn-sm" id="availabilityAddExceptionBtn">Добавить исключение</button>
                </div>
                <p class="profile-hint">Отпуск, гастроли, разовая занятость — дни, которые отличаются от обычной недели. Здесь указывается, когда вы заняты.</p>
                <div class="availability-exceptions">${exceptionsHtml}</div>
            </div>

            <div class="profile-card">
                <div class="profile-card__header">
                    <h3 class="profile-card__title">Календарь на месяц</h3>
                </div>
                <div class="availability-calendar">
                    <div class="availability-calendar__header">${calendarHeader}</div>
                    <div class="availability-calendar__grid">${calendarHtml}</div>
                </div>
            </div>
        `;

        container.querySelectorAll('[data-weekday]').forEach(btn => {
            btn.addEventListener('click', function() {
                openAvailabilityModal('weekly', parseInt(this.dataset.weekday, 10));
            });
        });

        const addExceptionBtn = document.getElementById('availabilityAddExceptionBtn');

        if (addExceptionBtn) {
            addExceptionBtn.addEventListener('click', function() {
                openAvailabilityModal('exception', null);
            });
        }

        container.querySelectorAll('[data-exception-edit]').forEach(btn => {
            btn.addEventListener('click', function() {
                openAvailabilityModal('exception', null, parseInt(this.dataset.exceptionEdit, 10));
            });
        });

        container.querySelectorAll('[data-exception-delete]').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteAvailabilityRule(parseInt(this.dataset.exceptionDelete, 10));
            });
        });

        container.querySelectorAll('[data-day-date]').forEach(btn => {
            btn.addEventListener('click', function() {
                openAvailabilityModal('day', null, null, {
                    date: this.dataset.dayDate,
                    action: this.dataset.dayAction,
                    sourceId: this.dataset.daySource,
                    sourceKind: this.dataset.dayKind
                });
            });
        });
    }

    function renderIntervals() {
        if (!availabilityIntervalsList) return;

        if (availabilityAction.value !== 'partial') {
            availabilityIntervals.style.display = 'none';
            return;
        }

        availabilityIntervals.style.display = 'block';

        availabilityIntervalsList.innerHTML = availabilityState.intervals.map((item, index) => `
            <div class="availability-interval">
                <input type="time" class="form-input" data-interval-start="${index}" value="${escapeHtml(item.start || '')}">
                <span class="availability-interval__sep">—</span>
                <input type="time" class="form-input" data-interval-end="${index}" value="${escapeHtml(item.end || '')}">
                <button type="button" class="money-icon-btn money-icon-btn--danger" data-interval-remove="${index}" aria-label="Удалить промежуток">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `).join('');

        availabilityIntervalsList.querySelectorAll('[data-interval-start]').forEach(input => {
            input.addEventListener('change', function() {
                availabilityState.intervals[parseInt(this.dataset.intervalStart, 10)].start = this.value;
            });
        });

        availabilityIntervalsList.querySelectorAll('[data-interval-end]').forEach(input => {
            input.addEventListener('change', function() {
                availabilityState.intervals[parseInt(this.dataset.intervalEnd, 10)].end = this.value;
            });
        });

        availabilityIntervalsList.querySelectorAll('[data-interval-remove]').forEach(btn => {
            btn.addEventListener('click', function() {
                availabilityState.intervals.splice(parseInt(this.dataset.intervalRemove, 10), 1);
                renderIntervals();
            });
        });
    }

    function openDayAvailabilityModal(preset) {
        const dateValue = preset.date || new Date().toISOString().slice(0, 10);

        availabilityStart.value = dateValue;
        availabilityEnd.value = dateValue;

        const existingRule = preset.sourceId
            ? availabilityState.exceptions.find(item => String(item.id) === String(preset.sourceId))
            : availabilityState.exceptions.find(item => item.start_date <= dateValue && item.end_date >= dateValue);

        if (existingRule) {
            availabilityState.editingId = existingRule.id;
            availabilityStart.value = existingRule.start_date;
            availabilityEnd.value = existingRule.end_date;
            availabilityAction.value = existingRule.action;

            if (existingRule.action === 'partial') {
                availabilityState.intervals = (existingRule.intervals || []).map(item => ({ start: item.start, end: item.end }));
            }

            availabilityComment.value = existingRule.comment || '';
            return;
        }

        availabilityState.editingId = null;
        availabilityAction.value = preset.action && preset.action !== 'day' ? preset.action : 'off';
        availabilityComment.value = '';

        if (availabilityAction.value === 'partial') {
            availabilityState.intervals = [{ start: '18:00', end: '22:00' }];
        }
    }

    function openAvailabilityModal(kind, weekday, ruleId, preset) {
        availabilityState.kind = kind;
        availabilityState.editingId = ruleId || null;
        availabilityState.intervals = [];

        const isWeekly = kind === 'weekly';
        const isDay = kind === 'day';
        availabilityModalTitle.textContent = isWeekly ? 'Обычный день недели' : (isDay ? 'Занятость на дату' : 'Исключение на даты');

        if (availabilityWeekdayGroup) availabilityWeekdayGroup.style.display = isWeekly ? '' : 'none';
        if (availabilityStartGroup) availabilityStartGroup.style.display = isWeekly ? 'none' : '';
        if (availabilityEndGroup) availabilityEndGroup.style.display = isWeekly ? 'none' : '';

        availabilityComment.value = '';

        if (isWeekly) {
            const rule = weekday !== null ? availabilityState.weekly[String(weekday)] : null;

            availabilityWeekday.value = String(weekday !== null ? weekday : 0);
            availabilityAction.value = rule ? rule.action : 'day';

            if (rule && rule.action === 'partial') {
                availabilityState.intervals = (rule.intervals || []).map(item => ({ start: item.start, end: item.end }));
            }

            if (rule) availabilityComment.value = rule.comment || '';
        } else if (isDay) {
            openDayAvailabilityModal(preset || {});
        } else {
            const rule = ruleId ? availabilityState.exceptions.find(item => item.id === ruleId) : null;

            availabilityStart.value = rule ? rule.start_date : new Date().toISOString().slice(0, 10);
            availabilityEnd.value = rule ? rule.end_date : '';
            availabilityAction.value = rule ? rule.action : 'off';

            if (rule && rule.action === 'partial') {
                availabilityState.intervals = (rule.intervals || []).map(item => ({ start: item.start, end: item.end }));
            }

            if (rule) availabilityComment.value = rule.comment || '';
        }

        renderIntervals();
        availabilityModal.classList.add('active');
    }

    function closeAvailabilityModal() {
        availabilityModal.classList.remove('active');
        availabilityState.editingId = null;
    }

    function saveAvailabilityRule() {
        const formData = new FormData();
        const isDay = availabilityState.kind === 'day';

        formData.append('kind', isDay ? 'exception' : availabilityState.kind);
        formData.append('action', availabilityAction.value);
        formData.append('comment', availabilityComment.value.trim());

        if (availabilityState.editingId) {
            formData.append('id', availabilityState.editingId);
        }

        if (availabilityState.kind === 'weekly') {
            formData.append('weekday', availabilityWeekday.value);
        } else {
            formData.append('start_date', availabilityStart.value);
            formData.append('end_date', availabilityEnd.value || availabilityStart.value);
        }

        if (availabilityAction.value === 'partial') {
            const intervals = availabilityState.intervals
                .filter(item => item.start && item.end)
                .map(item => ({ start: item.start, end: item.end }));

            formData.append('intervals', JSON.stringify(intervals));
        } else {
            formData.append('intervals', '[]');
        }

        fetch('/profile/availability/', {
            method: 'POST',
            headers: { 'X-CSRFToken': window.UI.getCSRFToken() },
            body: formData
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                showToast(isDay ? 'Занятость сохранена' : 'Доступность сохранена');
                closeAvailabilityModal();

                const savedRule = data.rule || {};

                if (savedRule.kind === 'weekly') {
                    availabilityState.weekly[String(savedRule.weekday)] = savedRule;
                } else if (savedRule.id) {
                    const index = availabilityState.exceptions.findIndex(item => item.id === savedRule.id);

                    if (index >= 0) {
                        availabilityState.exceptions[index] = savedRule;
                    } else {
                        availabilityState.exceptions.push(savedRule);
                    }
                }

                loadAvailabilityTab();
            })
            .catch(error => {
                showToast('Ошибка сохранения');
                console.error(error);
            });
    }

    function deleteAvailabilityRule(ruleId) {
        window.UI.confirm({
            title: 'Удалить исключение',
            text: 'Исключение будет удалено, в эти дни снова будет действовать обычная неделя.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(confirmed => {
            if (!confirmed) return;

            fetch('/profile/availability/?id=' + ruleId, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': window.UI.getCSRFToken() }
            })
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        showToast(data.error);
                        return;
                    }

                    showToast('Исключение удалено');
                    loadAvailabilityTab();
                })
                .catch(error => console.error(error));
        });
    }

    if (availabilityAction) {
        availabilityAction.addEventListener('change', function() {
            if (this.value === 'partial' && !availabilityState.intervals.length) {
                availabilityState.intervals = [{ start: '18:00', end: '22:00' }];
            }

            renderIntervals();
        });
    }

    const availabilityAddIntervalBtn = document.getElementById('availabilityAddIntervalBtn');
    if (availabilityAddIntervalBtn) {
        availabilityAddIntervalBtn.addEventListener('click', function() {
            availabilityState.intervals.push({ start: '', end: '' });
            renderIntervals();
        });
    }

    const availabilityCloseBtn = document.getElementById('availabilityCloseBtn');
    const availabilityCancelBtn = document.getElementById('availabilityCancelBtn');
    const availabilitySaveBtn = document.getElementById('availabilitySaveBtn');

    if (availabilityCloseBtn) availabilityCloseBtn.addEventListener('click', closeAvailabilityModal);
    if (availabilityCancelBtn) availabilityCancelBtn.addEventListener('click', closeAvailabilityModal);
    if (availabilitySaveBtn) availabilitySaveBtn.addEventListener('click', saveAvailabilityRule);

    if (availabilityModal) {
        availabilityModal.addEventListener('click', function(e) {
            if (e.target === availabilityModal) closeAvailabilityModal();
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;

        const confirmElement = document.getElementById('uiConfirmModal');

        if (confirmElement && confirmElement.classList.contains('active')) {
            if ((availabilityModal && availabilityModal.classList.contains('active')) ||
                (editModal && editModal.classList.contains('active'))) {
                e.preventDefault();
            }

            return;
        }

        if (availabilityModal && availabilityModal.classList.contains('active')) {
            e.preventDefault();
            closeAvailabilityModal();
            return;
        }

        if (editModal && editModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseEditModal();
        }
    }, true);

    loadTab('info');
})();
