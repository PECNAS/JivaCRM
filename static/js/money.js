(function() {
    'use strict';

    const STORAGE_EXPANDED = 'jiva_money_expanded_orders';

    const state = {
        month: '',
        range: 'month',
        sort: 'date_desc',
        accrualFilter: 'pending',
        data: null,
        employees: [],
        loading: false,
        expanded: {},
    };

    const monthInput = document.getElementById('moneyMonthInput');
    const searchInput = document.getElementById('moneySearchInput');
    const categoryFilter = document.getElementById('moneyCategoryFilter');
    const sortSelect = document.getElementById('moneySortSelect');
    const rangeBox = document.getElementById('moneyRange');
    const accrualFilterBox = document.getElementById('moneyAccrualFilter');
    const statsBox = document.getElementById('moneyStats');
    const tabs = document.querySelectorAll('.money-tab');
    const panels = {
        accruals: document.getElementById('moneyPanelAccruals'),
        payouts: document.getElementById('moneyPanelPayouts'),
        summary: document.getElementById('moneyPanelSummary'),
    };

    const accrualsList = document.getElementById('moneyAccrualsList');
    const payoutsList = document.getElementById('moneyPayoutsList');
    const summaryList = document.getElementById('moneySummaryList');

    const accrualModal = document.getElementById('moneyAccrualModal');
    const accrualForm = document.getElementById('moneyAccrualForm');
    const accrualEmployee = document.getElementById('moneyAccrualEmployee');
    const accrualCategory = document.getElementById('moneyAccrualCategory');
    const accrualAmount = document.getElementById('moneyAccrualAmount');
    const accrualDate = document.getElementById('moneyAccrualDate');
    const accrualTitle = document.getElementById('moneyAccrualTitleField');
    const accrualComment = document.getElementById('moneyAccrualComment');
    const accrualModalTitle = document.getElementById('moneyAccrualModalTitle');
    const accrualDeleteBtn = document.getElementById('moneyAccrualDeleteBtn');

    const payoutModal = document.getElementById('moneyPayoutModal');
    const payoutForm = document.getElementById('moneyPayoutForm');
    const payoutEmployee = document.getElementById('moneyPayoutEmployee');
    const payoutAmount = document.getElementById('moneyPayoutAmount');
    const payoutMethod = document.getElementById('moneyPayoutMethod');
    const payoutDate = document.getElementById('moneyPayoutDate');
    const payoutComment = document.getElementById('moneyPayoutComment');
    const payoutBalance = document.getElementById('moneyPayoutBalance');

    const monthModal = document.getElementById('moneyMonthModal');
    const monthList = document.getElementById('moneyMonthList');
    const monthTotal = document.getElementById('moneyMonthTotal');
    const monthMethod = document.getElementById('moneyMonthMethod');
    const monthDate = document.getElementById('moneyMonthDate');

    let editingAccrualId = null;
    let orderModalElement = null;

    const escapeHtml = function(text) {
        return window.UI.escapeHtml(text);
    };

    const showToast = function(message) {
        window.UI.showToast(message);
    };

    function formatMoney(value) {
        const num = parseFloat(value) || 0;
        return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽';
    }

    function formatAmountInput(value) {
        const num = parseFloat(value) || 0;
        return Number.isInteger(num) ? String(num) : num.toFixed(2);
    }

    function request(url, options) {
        const settings = options || {};

        if (settings.method && settings.method !== 'GET') {
            settings.headers = Object.assign({}, settings.headers, {
                'X-CSRFToken': window.UI.getCSRFToken(),
            });
        }

        return fetch(url, settings).then(r => r.json().then(data => ({ ok: r.ok, data: data })));
    }

    function currentMonthValue() {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }

    function shiftMonth(value, delta) {
        const parts = String(value || currentMonthValue()).split('-');
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) + delta;

        if (month < 1) {
            month = 12;
            year -= 1;
        } else if (month > 12) {
            month = 1;
            year += 1;
        }

        return year + '-' + String(month).padStart(2, '0');
    }

    function loadExpanded() {
        try {
            const raw = localStorage.getItem(STORAGE_EXPANDED);
            state.expanded = raw ? JSON.parse(raw) : {};
        } catch (error) {
            state.expanded = {};
        }
    }

    function saveExpanded() {
        try {
            localStorage.setItem(STORAGE_EXPANDED, JSON.stringify(state.expanded));
        } catch (error) {}
    }

    function isExpanded(orderId) {
        return !!state.expanded[orderId];
    }

    function toggleExpanded(orderId) {
        if (state.expanded[orderId]) {
            delete state.expanded[orderId];
        } else {
            state.expanded[orderId] = true;
        }

        saveExpanded();
        renderAccruals();
    }

    function switchTab(name) {
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));

        Object.keys(panels).forEach(key => {
            panels[key].classList.toggle('active', key === name);
        });
    }

    function setActiveButton(container, selector, matchAttr, value) {
        container.querySelectorAll(selector).forEach(btn => {
            btn.classList.toggle('active', btn.dataset[matchAttr] === value);
        });
    }

    function loadData() {
        if (state.loading) return;

        state.loading = true;

        if (accrualsList) {
            accrualsList.innerHTML = '<div class="money-loading">Загрузка...</div>';
        }

        const params = new URLSearchParams();
        params.set('month', state.month || currentMonthValue());
        params.set('range', state.range);
        params.set('sort', state.sort);
        params.set('accrual_filter', state.accrualFilter);

        if (searchInput && searchInput.value.trim()) {
            params.set('search', searchInput.value.trim());
        }

        if (categoryFilter && categoryFilter.value !== 'all') {
            params.set('category', categoryFilter.value);
        }

        request('/money/data/?' + params.toString())
            .then(result => {
                state.loading = false;

                if (!result.ok || result.data.error) {
                    const message = (result.data && result.data.error) || 'Не удалось загрузить данные';
                    accrualsList.innerHTML = '<div class="money-empty">' + escapeHtml(message) + '</div>';
                    return;
                }

                state.data = result.data;
                state.month = result.data.month;
                state.employees = result.data.employees || [];

                if (monthInput) monthInput.value = state.month;
                if (payoutDate && !payoutDate.value) payoutDate.value = result.data.today;
                if (monthDate && !monthDate.value) monthDate.value = result.data.today;

                renderStats();
                renderAccruals();
                renderPayouts();
                renderSummary();
                fillEmployeeSelects();
            })
            .catch(() => {
                state.loading = false;
                accrualsList.innerHTML = '<div class="money-empty">Ошибка загрузки данных</div>';
            });
    }

    function renderStats() {
        const stats = state.data.stats || {};
        const label = state.data.range_label || '';

        statsBox.innerHTML = `
            <div class="money-stat">
                <span class="money-stat__label">Начислено · ${escapeHtml(label)}</span>
                <span class="money-stat__value money-stat__value--accent">${formatMoney(stats.accrued)}</span>
            </div>
            <div class="money-stat">
                <span class="money-stat__label">Ждёт начисления</span>
                <span class="money-stat__value">${formatMoney(stats.pending_amount || 0)}</span>
            </div>
            <div class="money-stat">
                <span class="money-stat__label">Выплачено · ${escapeHtml(label)}</span>
                <span class="money-stat__value money-stat__value--paid">${formatMoney(stats.paid)}</span>
            </div>
            <div class="money-stat">
                <span class="money-stat__label">Баланс сотрудников</span>
                <span class="money-stat__value">${formatMoney(stats.balance_total)}</span>
            </div>
        `;
    }

    function renderAccruals() {
        const orders = (state.data && state.data.pending) || [];
        const accruals = (state.data && state.data.accruals) || [];
        const ordersHtml = orders.map(renderOrderCard).join('');

        const showAccrualRows = state.accrualFilter !== 'pending';

        const rowsHtml = showAccrualRows && accruals.length
            ? `
                <div class="money-group">
                    <div class="money-group__head">
                        <div class="money-group__title">
                            <span class="money-group__name">Начисления за период</span>
                        </div>
                        <span class="money-group__badge">${accruals.length}</span>
                    </div>
                    <div class="money-table-wrap">
                        <table class="money-table">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Сотрудник</th>
                                    <th>Статья</th>
                                    <th>За что</th>
                                    <th class="money-table__num">Сумма</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${accruals.map(accrualRow).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `
            : '';

        if (!ordersHtml && !rowsHtml) {
            accrualsList.innerHTML = '<div class="money-empty">Нет заказов и начислений за выбранный период</div>';
            return;
        }

        accrualsList.innerHTML = ordersHtml + rowsHtml;
        attachAccrualEvents();
    }

    function renderOrderCard(order) {
        const expanded = isExpanded(order.id);
        const badgeClass = order.is_full
            ? 'money-group__badge--done'
            : (order.is_accrued ? 'money-group__badge--accent' : '');

        const badgeText = order.is_full
            ? 'Начислено'
            : (order.is_accrued ? `Начислено ${order.employees_accrued} из ${order.employees_total}` : 'Ждёт начисления');

        const rows = order.employees.map(item => {
            const accrued = !!item.accrual_id;

            return `
                <tr class="${accrued ? 'money-row--accrued' : ''}">
                    <td data-label="Сотрудник">
                        <div class="money-order-employee">
                            <span class="money-order-employee__name">${escapeHtml(item.employee_name)}</span>
                            <span class="money-order-employee__meta">${escapeHtml(item.role_display || '')}</span>
                        </div>
                    </td>
                    <td data-label="Ставка" class="money-table__num">${formatMoney(item.payment)}</td>
                    <td data-label="Статус">
                        ${accrued
                            ? '<span class="money-group__badge money-group__badge--done">Начислено</span>'
                            : '<span class="money-group__badge">Ждёт</span>'}
                    </td>
                    <td data-label="Действие" class="money-table__actions">
                        ${accrued
                            ? '<span class="money-table__muted">—</span>'
                            : `<button class="btn btn-outline btn-sm money-accrue-btn" type="button" data-order-id="${order.id}" data-employee="${item.employee_id}">
                                Начислить
                            </button>`}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="money-group money-order ${expanded ? 'money-order--expanded' : ''}" data-order-card="${order.id}">
                <button class="money-order__toggle" type="button" data-order-toggle="${order.id}" aria-expanded="${expanded ? 'true' : 'false'}">
                    <span class="money-order__chevron">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </span>
                    <span class="money-order__main">
                        <span class="money-group__name">${escapeHtml(order.name)}</span>
                        <span class="money-group__meta">
                            <span>${escapeHtml(order.date_display || '—')}</span>
                            ${order.city_name ? '<span>' + escapeHtml(order.city_name) + '</span>' : ''}
                            ${order.client_name ? '<span>' + escapeHtml(order.client_name) + '</span>' : ''}
                            ${order.services.length ? '<span>' + escapeHtml(order.services.join(' · ')) + '</span>' : ''}
                        </span>
                    </span>
                    <span class="money-order__side">
                        <span class="money-order__amount">${formatMoney(order.total)}</span>
                        <span class="money-group__badge ${badgeClass}">${escapeHtml(badgeText)}</span>
                    </span>
                </button>
                <div class="money-order__body">
                    <div class="money-table-wrap">
                        <table class="money-table">
                            <thead>
                                <tr>
                                    <th>Сотрудник</th>
                                    <th class="money-table__num">Ставка</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <div class="money-order__footer">
                        <span class="money-order__total">Ставки сотрудников: <b>${formatMoney(order.total)}</b></span>
                        <div class="money-table__actions">
                            <a class="btn btn-outline btn-sm" href="/orders/?search=${encodeURIComponent(order.name)}&status=completed">Открыть заказ</a>
                            <button class="btn btn-primary btn-sm" type="button" data-order-all="${order.id}" ${order.is_full ? 'disabled' : ''}>
                                Начислить всем
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function accrualRow(row) {
        const amountClass = row.signed_amount < 0 ? 'money-amount money-amount--negative' : 'money-amount';

        return `
            <tr class="${row.is_active ? '' : 'money-row--cancelled'}">
                <td data-label="Дата" class="money-table__muted">${escapeHtml(row.period_date_display)}</td>
                <td data-label="Сотрудник">${escapeHtml(row.employee_name)}</td>
                <td data-label="Статья" class="money-table__muted">${escapeHtml(row.category_display)}</td>
                <td data-label="За что">
                    <div class="money-order-employee">
                        <span class="money-order-employee__name">${escapeHtml(row.title || '—')}</span>
                        ${row.comment ? '<span class="money-order-employee__meta">' + escapeHtml(row.comment) + '</span>' : ''}
                    </div>
                </td>
                <td data-label="Сумма" class="money-table__num ${amountClass}">${formatMoney(row.signed_amount)}</td>
                <td data-label="Действие" class="money-table__actions">
                    ${row.can_edit ? `
                        <button class="money-icon-btn" type="button" data-accrual-edit="${row.id}" aria-label="Изменить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="money-icon-btn money-icon-btn--danger" type="button" data-accrual-cancel="${row.id}" aria-label="Отменить начисление">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    function renderPayouts() {
        const rows = (state.data && state.data.payouts) || [];

        if (!rows.length) {
            payoutsList.innerHTML = '<div class="money-empty">За этот период выплат нет</div>';
            return;
        }

        payoutsList.innerHTML = `
            <div class="money-group">
                <div class="money-group__head">
                    <div class="money-group__title">
                        <span class="money-group__name">Выплаты за период</span>
                    </div>
                    <span class="money-group__badge">${rows.length}</span>
                </div>
                <div class="money-table-wrap">
                    <table class="money-table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Сотрудник</th>
                                <th>Тип</th>
                                <th>Способ</th>
                                <th class="money-table__num">Сумма</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(payoutRow).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        attachPayoutEvents();
    }

    function payoutRow(row) {
        const amountClass = row.is_reverted ? 'money-amount' : 'money-amount money-amount--paid';

        return `
            <tr class="${row.is_reverted ? 'money-row--cancelled' : ''}">
                <td data-label="Дата" class="money-table__muted">${escapeHtml(row.period_date_display)}</td>
                <td data-label="Сотрудник">${escapeHtml(row.employee_name)}</td>
                <td data-label="Тип" class="money-table__muted">${escapeHtml(row.kind_display)}</td>
                <td data-label="Способ" class="money-table__muted">${escapeHtml(row.method_display)}</td>
                <td data-label="Сумма" class="money-table__num ${amountClass}">${formatMoney(row.amount)}</td>
                <td data-label="Действие" class="money-table__actions">
                    ${row.is_reverted ? '<span class="money-group__badge money-group__badge--danger">Отменена</span>' : `
                        <button class="money-icon-btn money-icon-btn--danger" type="button" data-payout-revert="${row.id}" aria-label="Отменить выплату">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="1 4 1 10 7 10"/>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                            </svg>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }

    function renderSummary() {
        const rows = (state.data && state.data.summary) || [];

        if (!rows.length) {
            summaryList.innerHTML = '<div class="money-empty">За этот период данных нет</div>';
            return;
        }

        summaryList.innerHTML = `
            <div class="money-group">
                <div class="money-table-wrap">
                    <table class="money-table">
                        <thead>
                            <tr>
                                <th>Сотрудник</th>
                                <th class="money-table__num">Оклад</th>
                                <th class="money-table__num">Часы и %</th>
                                <th class="money-table__num">Заказы</th>
                                <th class="money-table__num">Прочее</th>
                                <th class="money-table__num">Вычеты</th>
                                <th class="money-table__num">Начислено</th>
                                <th class="money-table__num">Выплачено</th>
                                <th class="money-table__num">Баланс</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(summaryRow).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        attachSummaryEvents();
    }

    function summaryRow(row) {
        const balanceClass = row.balance < 0 ? 'money-amount money-amount--negative' : 'money-amount';

        return `
            <tr>
                <td data-label="Сотрудник">
                    <div class="money-order-employee">
                        <span class="money-order-employee__name">${escapeHtml(row.employee_name)}</span>
                        <span class="money-order-employee__meta">${escapeHtml(row.role_display || '')}</span>
                    </div>
                </td>
                <td data-label="Оклад" class="money-table__num">${row.salary ? formatMoney(row.salary) : '—'}</td>
                <td data-label="Часы и %" class="money-table__num">${row.hours ? formatMoney(row.hours) : '—'}</td>
                <td data-label="Заказы" class="money-table__num">${row.order ? formatMoney(row.order) : '—'}</td>
                <td data-label="Прочее" class="money-table__num">${row.extra ? formatMoney(row.extra) : '—'}</td>
                <td data-label="Вычеты" class="money-table__num">${row.deduction ? formatMoney(row.deduction) : '—'}</td>
                <td data-label="Начислено" class="money-table__num">${formatMoney(row.accrued)}</td>
                <td data-label="Выплачено" class="money-table__num">${row.paid ? formatMoney(row.paid) : '—'}</td>
                <td data-label="Баланс" class="money-table__num ${balanceClass}">${formatMoney(row.balance)}</td>
                <td data-label="Действие" class="money-table__actions">
                    <button class="btn btn-outline btn-sm" type="button" data-summary-payout="${row.employee_id}" ${row.balance > 0 ? '' : 'disabled'}>
                        Выплатить
                    </button>
                </td>
            </tr>
        `;
    }

    function fillEmployeeSelects() {
        const options = state.employees
            .map(item => `<option value="${item.id}">${escapeHtml(item.name)}${item.is_active ? '' : ' (деактивирован)'}</option>`)
            .join('');

        accrualEmployee.innerHTML = '<option value="">Выберите сотрудника</option>' + options;
        payoutEmployee.innerHTML = '<option value="">Выберите сотрудника</option>' + options;
    }

    function attachAccrualEvents() {
        accrualsList.querySelectorAll('[data-order-toggle]').forEach(btn => {
            btn.addEventListener('click', function() {
                toggleExpanded(parseInt(this.dataset.orderToggle, 10));
            });
        });

        accrualsList.querySelectorAll('[data-accrual-edit]').forEach(btn => {
            btn.addEventListener('click', function() {
                openAccrualModal(parseInt(this.dataset.accrualEdit, 10));
            });
        });

        accrualsList.querySelectorAll('[data-accrual-cancel]').forEach(btn => {
            btn.addEventListener('click', function() {
                cancelAccrual(parseInt(this.dataset.accrualCancel, 10));
            });
        });

        accrualsList.querySelectorAll('[data-employee]').forEach(btn => {
            btn.addEventListener('click', function() {
                openOrderAccrualModal(parseInt(this.dataset.orderId, 10), parseInt(this.dataset.employee, 10));
            });
        });

        accrualsList.querySelectorAll('[data-order-all]').forEach(btn => {
            btn.addEventListener('click', function() {
                openOrderAccrualModal(parseInt(this.dataset.orderAll, 10), null);
            });
        });
    }

    function attachPayoutEvents() {
        payoutsList.querySelectorAll('[data-payout-revert]').forEach(btn => {
            btn.addEventListener('click', function() {
                revertPayout(parseInt(this.dataset.payoutRevert, 10));
            });
        });
    }

    function attachSummaryEvents() {
        summaryList.querySelectorAll('[data-summary-payout]').forEach(btn => {
            btn.addEventListener('click', function() {
                openPayoutModal(parseInt(this.dataset.summaryPayout, 10));
            });
        });
    }

    function openAccrualModal(accrualId) {
        editingAccrualId = accrualId || null;
        accrualForm.reset();

        if (editingAccrualId) {
            const row = ((state.data && state.data.accruals) || []).find(item => item.id === editingAccrualId);

            if (!row) return;

            accrualModalTitle.textContent = 'Изменить начисление';
            accrualDeleteBtn.style.display = '';
            accrualEmployee.value = String(row.employee_id);
            accrualCategory.value = row.category;
            accrualAmount.value = row.amount;
            accrualDate.value = row.period_date;
            accrualTitle.value = row.title || '';
            accrualComment.value = row.comment || '';
        } else {
            accrualModalTitle.textContent = 'Новое начисление';
            accrualDeleteBtn.style.display = 'none';
            accrualCategory.value = 'salary';
            accrualDate.value = state.data ? state.data.today : '';
        }

        accrualModal.classList.add('active');
        setTimeout(() => accrualAmount.focus(), 60);
    }

    function closeAccrualModal() {
        accrualModal.classList.remove('active');
        editingAccrualId = null;
    }

    function submitAccrual(e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('employee_id', accrualEmployee.value);
        formData.append('category', accrualCategory.value);
        formData.append('amount', accrualAmount.value);
        formData.append('period_date', accrualDate.value);
        formData.append('title', accrualTitle.value);
        formData.append('comment', accrualComment.value);

        if (editingAccrualId) {
            formData.append('id', editingAccrualId);
        }

        request('/money/accrual/', { method: 'POST', body: formData })
            .then(result => {
                if (!result.ok) {
                    showToast((result.data && result.data.error) || 'Не удалось сохранить');
                    return;
                }

                showToast(editingAccrualId ? 'Начисление обновлено' : 'Начисление добавлено');
                closeAccrualModal();
                loadData();
            })
            .catch(() => showToast('Ошибка сохранения'));
    }

    function cancelAccrual(accrualId) {
        const row = ((state.data && state.data.accruals) || []).find(item => item.id === accrualId);

        window.UI.confirm({
            title: 'Отменить начисление',
            text: row
                ? 'Начисление ' + row.employee_name + ' на ' + formatMoney(row.amount) + ' будет отменено, в истории появится запись об откате.'
                : 'Начисление будет отменено.',
            okText: 'Отменить',
            cancelText: 'Назад',
            danger: true,
        }).then(confirmed => {
            if (!confirmed) return;

            request('/money/accrual/?id=' + accrualId, { method: 'DELETE' })
                .then(result => {
                    if (!result.ok) {
                        showToast((result.data && result.data.error) || 'Не удалось отменить');
                        return;
                    }

                    showToast('Начисление отменено');
                    loadData();
                })
                .catch(() => showToast('Ошибка отмены'));
        });
    }

    function openPayoutModal(employeeId) {
        payoutForm.reset();
        payoutMethod.value = 'cash';
        payoutDate.value = state.data ? state.data.today : '';
        payoutEmployee.value = employeeId ? String(employeeId) : '';
        updatePayoutBalance();

        payoutModal.classList.add('active');
        setTimeout(() => payoutAmount.focus(), 60);
    }

    function updatePayoutBalance() {
        const employeeId = parseInt(payoutEmployee.value, 10);
        const row = ((state.data && state.data.summary) || []).find(item => item.employee_id === employeeId);

        if (!row) {
            payoutBalance.innerHTML = '';
            return;
        }

        payoutBalance.innerHTML = 'Баланс сотрудника: <b>' + formatMoney(row.balance) + '</b>';

        if (!payoutAmount.value && row.balance > 0) {
            payoutAmount.value = formatAmountInput(row.balance);
        }
    }

    function closePayoutModal() {
        payoutModal.classList.remove('active');
    }

    function submitPayout(e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('employee_id', payoutEmployee.value);
        formData.append('amount', payoutAmount.value);
        formData.append('method', payoutMethod.value);
        formData.append('period_date', payoutDate.value);
        formData.append('comment', payoutComment.value);

        request('/money/payout/', { method: 'POST', body: formData })
            .then(result => {
                if (!result.ok) {
                    showToast((result.data && result.data.error) || 'Не удалось провести выплату');
                    return;
                }

                showToast('Выплата проведена');
                closePayoutModal();
                loadData();
            })
            .catch(() => showToast('Ошибка выплаты'));
    }

    function revertPayout(payoutId) {
        const row = ((state.data && state.data.payouts) || []).find(item => item.id === payoutId);

        window.UI.confirm({
            title: 'Отменить выплату',
            text: row
                ? 'Выплата ' + row.employee_name + ' на ' + formatMoney(row.amount) + ' будет отменена, сумма вернётся на баланс.'
                : 'Выплата будет отменена.',
            okText: 'Отменить выплату',
            cancelText: 'Назад',
            danger: true,
        }).then(confirmed => {
            if (!confirmed) return;

            request('/money/payout/?id=' + payoutId, { method: 'DELETE' })
                .then(result => {
                    if (!result.ok) {
                        showToast((result.data && result.data.error) || 'Не удалось отменить выплату');
                        return;
                    }

                    showToast('Выплата отменена, сумма возвращена на баланс');
                    loadData();
                })
                .catch(() => showToast('Ошибка отмены'));
        });
    }

    function buildOrderModal() {
        if (orderModalElement) return orderModalElement;

        orderModalElement = document.createElement('div');
        orderModalElement.className = 'modal-overlay';
        orderModalElement.id = 'moneyOrderModal';
        orderModalElement.innerHTML = `
            <div class="modal modal--money-order">
                <div class="modal__header">
                    <h2 class="modal__title" data-order-title>Начисление по заказу</h2>
                    <button class="modal__close" type="button" data-order-close>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal__body">
                    <div class="money-month-toolbar money-month-toolbar--single">
                        <div class="form-group">
                            <label class="form-label" for="moneyOrderDate">Дата начисления на баланс</label>
                            <input type="date" class="form-input" id="moneyOrderDate">
                        </div>
                    </div>
                    <div class="money-month-list" data-order-list></div>
                </div>
                <div class="modal__footer modal-footer-actions">
                    <div class="modal-footer-actions__left">
                        <span class="money-month-total" data-order-total></span>
                    </div>
                    <div class="modal-footer-actions__right">
                        <button type="button" class="btn btn-outline" data-order-cancel>Отмена</button>
                        <button type="button" class="btn btn-primary" data-order-submit>Начислить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(orderModalElement);

        orderModalElement.querySelector('[data-order-close]').addEventListener('click', closeOrderModal);
        orderModalElement.querySelector('[data-order-cancel]').addEventListener('click', closeOrderModal);
        orderModalElement.addEventListener('click', function(e) {
            if (e.target === orderModalElement) closeOrderModal();
        });

        orderModalElement.querySelector('[data-order-list]').addEventListener('input', recalcOrderTotal);

        return orderModalElement;
    }

    function openOrderAccrualModal(orderId, employeeId) {
        request('/money/orders/' + orderId + '/payment/')
            .then(result => {
                if (!result.ok) {
                    showToast((result.data && result.data.error) || 'Заказ не найден');
                    return;
                }

                const order = result.data.order;
                const selected = employeeId
                    ? order.employees.filter(item => item.employee_id === employeeId)
                    : order.employees;

                const available = selected.filter(item => !item.accrual_id);

                if (!available.length) {
                    showToast('По этому заказу уже всё начислено');
                    return;
                }

                renderOrderAccrualModal(order, available, orderId);
            })
            .catch(() => showToast('Ошибка загрузки заказа'));
    }

    function renderOrderAccrualModal(order, items, orderId) {
        const modal = buildOrderModal();

        modal.querySelector('[data-order-title]').textContent = order.name;
        modal.querySelector('[data-order-list]').innerHTML = items.map(item => `
            <div class="money-month-row">
                <div class="money-month-row__name">
                    <span class="money-month-row__title">${escapeHtml(item.employee_name)}</span>
                    <span class="money-month-row__meta">${escapeHtml(item.role_display || '')} · ставка в заказе ${formatMoney(item.payment)}</span>
                </div>
                <input type="number" class="form-input money-input-amount" min="0" step="0.01" value="${formatAmountInput(item.payment)}" data-employee-id="${item.employee_id}">
                <span class="money-month-row__meta">${escapeHtml(order.date_display || '')}</span>
            </div>
        `).join('');

        const dateInput = modal.querySelector('#moneyOrderDate');
        dateInput.value = order.date || (state.data ? state.data.today : '');

        modal.dataset.orderId = String(orderId);
        modal.classList.add('active');

        recalcOrderTotal();

        modal.querySelector('[data-order-submit]').onclick = function() {
            submitOrderAccrual(orderId, modal);
        };
    }

    function recalcOrderTotal() {
        const modal = orderModalElement;

        if (!modal) return;

        let total = 0;

        modal.querySelectorAll('[data-employee-id]').forEach(input => {
            total += parseFloat(input.value) || 0;
        });

        modal.querySelector('[data-order-total]').innerHTML = 'Итого к начислению: <b>' + formatMoney(total) + '</b>';
    }

    function closeOrderModal() {
        if (orderModalElement) orderModalElement.classList.remove('active');
    }

    function submitOrderAccrual(orderId, modal) {
        const formData = new FormData();
        formData.append('period_date', modal.querySelector('#moneyOrderDate').value);

        modal.querySelectorAll('[data-employee-id]').forEach(input => {
            formData.append('employee_id', input.dataset.employeeId);
            formData.append('amount', input.value);
        });

        const submitBtn = modal.querySelector('[data-order-submit]');
        submitBtn.disabled = true;

        request('/money/orders/' + orderId + '/pay/', { method: 'POST', body: formData })
            .then(result => {
                submitBtn.disabled = false;

                if (!result.ok) {
                    showToast((result.data && result.data.error) || 'Не удалось начислить');
                    return;
                }

                const names = result.data.accrued || [];

                closeOrderModal();

                if (names.length) {
                    showToast('Начислено ' + formatMoney(result.data.accrued_total) + ': ' + names.join(', '));
                } else {
                    showToast('Начислять нечего');
                }

                loadData();
            })
            .catch(() => {
                submitBtn.disabled = false;
                showToast('Ошибка начисления');
            });
    }

    function openMonthModal() {
        monthList.innerHTML = '<div class="money-loading">Загрузка...</div>';
        monthTotal.innerHTML = '';
        monthDate.value = state.data ? state.data.today : '';
        monthModal.classList.add('active');

        const month = state.month || currentMonthValue();

        request('/money/month/preview/?month=' + encodeURIComponent(month))
            .then(result => {
                if (!result.ok) {
                    monthList.innerHTML = '<div class="money-empty">Не удалось загрузить данные</div>';
                    return;
                }

                const rows = result.data.rows || [];

                if (!rows.length) {
                    monthList.innerHTML = '<div class="money-empty">Нет сотрудников с положительным балансом</div>';
                    monthTotal.innerHTML = 'Итого: <b>' + formatMoney(0) + '</b>';
                    return;
                }

                monthList.innerHTML = rows.map(row => `
                    <div class="money-month-row">
                        <div class="money-month-row__name">
                            <span class="money-month-row__title">${escapeHtml(row.employee_name)}</span>
                            <span class="money-month-row__meta">${escapeHtml(row.role_display || '')} · баланс ${formatMoney(row.balance)}</span>
                        </div>
                        <input type="number" class="form-input money-input-amount" min="0" step="0.01" value="${formatAmountInput(row.balance)}" data-month-employee="${row.employee_id}">
                        <span class="money-month-row__meta">${escapeHtml(result.data.period_label)}</span>
                    </div>
                `).join('');

                if (monthDate && !monthDate.value) monthDate.value = result.data.today;

                monthList.querySelectorAll('[data-month-employee]').forEach(input => {
                    input.addEventListener('input', recalcMonthTotal);
                });

                recalcMonthTotal();
            })
            .catch(() => {
                monthList.innerHTML = '<div class="money-empty">Ошибка загрузки</div>';
            });
    }

    function recalcMonthTotal() {
        let total = 0;

        monthList.querySelectorAll('[data-month-employee]').forEach(input => {
            total += parseFloat(input.value) || 0;
        });

        monthTotal.innerHTML = 'Итого: <b>' + formatMoney(total) + '</b>';
    }

    function closeMonthModal() {
        monthModal.classList.remove('active');
    }

    function submitMonthPay() {
        const inputs = monthList.querySelectorAll('[data-month-employee]');

        if (!inputs.length) {
            showToast('Нет сотрудников для выплаты');
            return;
        }

        window.UI.confirm({
            title: 'Выплатить всем',
            text: 'Будут проведены выплаты наличными или переводом всем сотрудникам с указанными суммами. Баланс обнулится. Продолжить?',
            okText: 'Выплатить',
            cancelText: 'Отмена',
        }).then(confirmed => {
            if (!confirmed) return;

            const formData = new FormData();
            formData.append('month', state.month || currentMonthValue());
            formData.append('method', monthMethod.value);
            formData.append('period_date', monthDate.value);

            inputs.forEach(input => {
                formData.append('employee_id', input.dataset.monthEmployee);
                formData.append('amount', input.value);
            });

            const btn = document.getElementById('moneyMonthPayBtn');
            btn.disabled = true;

            request('/money/month/pay/', { method: 'POST', body: formData })
                .then(result => {
                    btn.disabled = false;

                    if (!result.ok) {
                        showToast((result.data && result.data.error) || 'Не удалось провести выплаты');
                        return;
                    }

                    showToast('Выплачено ' + formatMoney(result.data.total) + ' (' + result.data.count + ')');
                    closeMonthModal();
                    loadData();
                })
                .catch(() => {
                    btn.disabled = false;
                    showToast('Ошибка выплаты');
                });
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    if (monthInput) {
        monthInput.value = currentMonthValue();
        state.month = currentMonthValue();

        monthInput.addEventListener('change', function() {
            if (!this.value) return;
            state.month = this.value;
            loadData();
        });
    }

    const prevBtn = document.getElementById('moneyPrevMonthBtn');
    const nextBtn = document.getElementById('moneyNextMonthBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            state.month = shiftMonth(state.month || currentMonthValue(), -1);
            loadData();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            state.month = shiftMonth(state.month || currentMonthValue(), 1);
            loadData();
        });
    }

    if (rangeBox) {
        rangeBox.querySelectorAll('[data-range]').forEach(btn => {
            btn.addEventListener('click', function() {
                state.range = this.dataset.range;
                setActiveButton(rangeBox, '[data-range]', 'range', state.range);
                loadData();
            });
        });
    }

    if (accrualFilterBox) {
        accrualFilterBox.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                state.accrualFilter = this.dataset.filter;
                setActiveButton(accrualFilterBox, '[data-filter]', 'filter', state.accrualFilter);
                loadData();
            });
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            state.sort = this.value;
            loadData();
        });
    }

    let searchTimer = null;

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(loadData, 350);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', loadData);
    }

    const addManualBtn = document.getElementById('moneyAddManualBtn');
    const addPayoutBtn = document.getElementById('moneyAddPayoutBtn');
    const payoutMonthBtn = document.getElementById('moneyPayoutMonthBtn');

    if (addManualBtn) addManualBtn.addEventListener('click', () => openAccrualModal(null));
    if (addPayoutBtn) addPayoutBtn.addEventListener('click', () => openPayoutModal(null));
    if (payoutMonthBtn) payoutMonthBtn.addEventListener('click', openMonthModal);

    document.getElementById('moneyAccrualCloseBtn').addEventListener('click', closeAccrualModal);
    document.getElementById('moneyAccrualCancelBtn').addEventListener('click', closeAccrualModal);
    document.getElementById('moneyPayoutCloseBtn').addEventListener('click', closePayoutModal);
    document.getElementById('moneyPayoutCancelBtn').addEventListener('click', closePayoutModal);
    document.getElementById('moneyMonthCloseBtn').addEventListener('click', closeMonthModal);
    document.getElementById('moneyMonthCancelBtn').addEventListener('click', closeMonthModal);
    document.getElementById('moneyMonthPayBtn').addEventListener('click', submitMonthPay);

    accrualForm.addEventListener('submit', submitAccrual);
    payoutForm.addEventListener('submit', submitPayout);
    payoutEmployee.addEventListener('change', updatePayoutBalance);

    accrualDeleteBtn.addEventListener('click', function() {
        if (!editingAccrualId) return;
        const id = editingAccrualId;
        closeAccrualModal();
        cancelAccrual(id);
    });

    accrualModal.addEventListener('click', function(e) {
        if (e.target === accrualModal) closeAccrualModal();
    });

    payoutModal.addEventListener('click', function(e) {
        if (e.target === payoutModal) closePayoutModal();
    });

    monthModal.addEventListener('click', function(e) {
        if (e.target === monthModal) closeMonthModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('uiConfirmModal')) return;

        if (orderModalElement && orderModalElement.classList.contains('active')) {
            e.preventDefault();
            closeOrderModal();
            return;
        }

        if (accrualModal.classList.contains('active')) {
            e.preventDefault();
            closeAccrualModal();
            return;
        }

        if (payoutModal.classList.contains('active')) {
            e.preventDefault();
            closePayoutModal();
            return;
        }

        if (monthModal.classList.contains('active')) {
            e.preventDefault();
            closeMonthModal();
        }
    }, true);

    setActiveButton(rangeBox, '[data-range]', 'range', state.range);
    setActiveButton(accrualFilterBox, '[data-filter]', 'filter', state.accrualFilter);

    loadExpanded();
    loadData();
})();
