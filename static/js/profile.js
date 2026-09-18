(function() {
    let loadedTabs = {
        info: false,
        schedule: false,
        tickets: false,
    };

    const tabButtons = document.querySelectorAll('.profile-tab-btn');
    const tabContents = document.querySelectorAll('.profile-tab-content');

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

    function switchTab(tabName) {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));

        if (!loadedTabs[tabName]) {
            loadTab(tabName);
        }
    }

    function loadTab(tabName) {
        if (tabName === 'info') {
            loadInfoTab();
        } else if (tabName === 'schedule') {
            loadScheduleTab();
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
                renderInfo(data);
            })
            .catch(err => {
                container.innerHTML = '<div class="profile-empty">Ошибка загрузки данных</div>';
                console.error(err);
            });
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
                        <div class="profile-field">
                            <span class="profile-field__label">Вес</span>
                            <span class="profile-field__value ${card.weight ? '' : 'profile-field__value--empty'}">${escapeHtml(card.weight || 'Не указано')}</span>
                        </div>
                        <div class="profile-field">
                            <span class="profile-field__label">Рост</span>
                            <span class="profile-field__value ${card.height ? '' : 'profile-field__value--empty'}">${escapeHtml(card.height || 'Не указано')}</span>
                        </div>
                        <div class="profile-field">
                            <span class="profile-field__label">Размер обуви</span>
                            <span class="profile-field__value ${card.shoe_size ? '' : 'profile-field__value--empty'}">${escapeHtml(card.shoe_size || 'Не указано')}</span>
                        </div>
                        <div class="profile-field profile-field--full">
                            <span class="profile-field__label">Навыки</span>
                            <span class="profile-field__value ${card.skills_text ? '' : 'profile-field__value--empty'}">${escapeHtml(card.skills_text || 'Не указано')}</span>
                        </div>
                        <div class="profile-field profile-field--full">
                            <span class="profile-field__label">Знание шоу</span>
                            ${showsHtml}
                        </div>
                        <div class="profile-field profile-field--full">
                            <span class="profile-field__label">Комментарий</span>
                            <span class="profile-field__value ${card.comment ? '' : 'profile-field__value--empty'}">${escapeHtml(card.comment || 'Не указано')}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="profile-card">
                <h3 class="profile-card__title">Личная информация</h3>
                <div class="profile-grid">
                    <div class="profile-field">
                        <span class="profile-field__label">ФИО</span>
                        <span class="profile-field__value">${escapeHtml(data.full_name)}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Логин</span>
                        <span class="profile-field__value">${escapeHtml(data.username)}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Роль</span>
                        <span class="profile-field__value">${escapeHtml(data.role_display)}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Телефон</span>
                        <span class="profile-field__value ${data.phone ? '' : 'profile-field__value--empty'}">${escapeHtml(data.phone || 'Не указан')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Телеграм</span>
                        <span class="profile-field__value ${data.telegram ? '' : 'profile-field__value--empty'}">${escapeHtml(data.telegram || 'Не указан')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Статус</span>
                        <span class="profile-field__value">${data.is_active ? 'Активен' : 'Неактивен'}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Дата регистрации</span>
                        <span class="profile-field__value">${escapeHtml(data.date_joined)}</span>
                    </div>
                    <div class="profile-field profile-field--full">
                        <span class="profile-field__label">Навыки (общие)</span>
                        ${skillsHtml}
                    </div>
                </div>
            </div>

            <div class="profile-card">
                <h3 class="profile-card__title">Паспортные данные</h3>
                <div class="profile-grid">
                    <div class="profile-field">
                        <span class="profile-field__label">Серия</span>
                        <span class="profile-field__value ${data.passport_series ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_series || 'Не указано')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Номер</span>
                        <span class="profile-field__value ${data.passport_number ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_number || 'Не указано')}</span>
                    </div>
                    <div class="profile-field profile-field--full">
                        <span class="profile-field__label">Кем выдан</span>
                        <span class="profile-field__value ${data.passport_issued_by ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_issued_by || 'Не указано')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Дата выдачи</span>
                        <span class="profile-field__value ${data.passport_issued_date ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_issued_date || 'Не указано')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">Код подразделения</span>
                        <span class="profile-field__value ${data.passport_department_code ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_department_code || 'Не указано')}</span>
                    </div>
                    <div class="profile-field profile-field--full">
                        <span class="profile-field__label">Адрес регистрации</span>
                        <span class="profile-field__value ${data.passport_registration ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_registration || 'Не указано')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">ИНН</span>
                        <span class="profile-field__value ${data.passport_inn ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_inn || 'Не указано')}</span>
                    </div>
                    <div class="profile-field">
                        <span class="profile-field__label">СНИЛС</span>
                        <span class="profile-field__value ${data.passport_snils ? '' : 'profile-field__value--empty'}">${escapeHtml(data.passport_snils || 'Не указано')}</span>
                    </div>
                </div>
            </div>

            ${artistCardHtml}
        `;
    }

    function loadScheduleTab() {
        const container = document.getElementById('tab-schedule');
        container.innerHTML = '<div class="profile-loading">Загрузка...</div>';

        fetch('/profile/schedule/')
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    container.innerHTML = `<div class="profile-empty">${escapeHtml(data.error)}</div>`;
                    return;
                }
                renderSchedule(data.events || []);
            })
            .catch(err => {
                container.innerHTML = '<div class="profile-empty">Ошибка загрузки расписания</div>';
                console.error(err);
            });
    }

    function renderSchedule(events) {
        const container = document.getElementById('tab-schedule');

        if (events.length === 0) {
            container.innerHTML = '<div class="profile-empty">Нет предстоящих мероприятий</div>';
            return;
        }

        container.innerHTML = `
            <div class="profile-events">
                ${events.map(e => `
                    <div class="profile-event profile-event--${e.status}">
                        <div class="profile-event__top">
                            <span class="profile-event__name">${escapeHtml(e.name)}</span>
                            <span class="profile-event__status">${escapeHtml(e.status_display)}</span>
                        </div>
                        <div class="profile-event__details">
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Дата</span>
                                <span class="profile-event__detail-value">${escapeHtml(e.date_display)}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Время чека</span>
                                <span class="profile-event__detail-value">${escapeHtml(e.setup_time || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Город</span>
                                <span class="profile-event__detail-value">${escapeHtml(e.city || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Адрес</span>
                                <span class="profile-event__detail-value">${escapeHtml(e.address || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Клиент</span>
                                <span class="profile-event__detail-value">${escapeHtml(e.client || '—')}</span>
                            </div>
                            <div class="profile-event__detail">
                                <span class="profile-event__detail-label">Моя оплата</span>
                                <span class="profile-event__detail-value">${e.payment.toFixed(2).replace('.', ',')} ₽</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
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

        if (tickets.length === 0) {
            container.innerHTML = `
                <div class="profile-tickets-placeholder">
                    <svg class="profile-tickets-placeholder__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z"/>
                        <line x1="9" y1="9" x2="9" y2="15" stroke-dasharray="2 2"/>
                    </svg>
                    <div class="profile-tickets-placeholder__title">Транспортные билеты</div>
                    <div class="profile-tickets-placeholder__text">Раздел находится в разработке</div>
                </div>
            `;
            return;
        }

        container.innerHTML = '<div class="profile-empty">Раздел находится в разработке</div>';
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    loadTab('info');
})();