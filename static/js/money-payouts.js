(function () {
    const panel = document.getElementById('moneyPayoutsMount') || document.getElementById('moneyPanelPayouts');
    const historyPanel = document.getElementById('moneyHistoryMount');
    const sidebarPanel = document.getElementById('moneyPayoutFilters');
    const mainFilters = document.getElementById('moneyFilters');

    if (!panel) return;

    const CHECK_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
    const CLOSE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    const KINDS = ['Остаток', 'Аванс', 'Премия'];
    const METHODS = [
        { key: 'cash', label: 'Наличными' },
        { key: 'transfer', label: 'Переводом' },
    ];
    const SCOPES = [
        { key: 'all', label: 'Все сотрудники' },
        { key: 'active', label: 'Активные' },
        { key: 'month', label: 'В этом месяце' },
        { key: 'debt', label: 'Не выплачено' },
    ];

    const COLUMNS = [
        { key: 'employee_name', label: 'Сотрудник', cls: '', type: 'text' },
        { key: 'orders', label: 'Заказы', cls: 'pay-c', type: 'num' },
        { key: 'accrued', label: 'Баланс', cls: 'pay-num', type: 'num' },
        { key: 'paid', label: 'Выплачено', cls: 'pay-num', type: 'num' },
        { key: 'balance', label: 'Осталось', cls: 'pay-num', type: 'num' },
    ];

    const state = {
        rows: [],
        totals: { accrued: 0, paid: 0, balance: 0, orders: 0 },
        history: [],
        selected: null,
        checked: [],
        kind: 'Остаток',
        method: 'cash',
        scope: 'month',
        search: '',
        month: '',
        sortKey: 'balance',
        sortDir: 'desc',
        loaded: false,
        loading: false,
    };

    function escapeHtml(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function money(value) {
        const number = Number(value) || 0;
        const rounded = Math.round(Math.abs(number));
        const text = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

        return (number < 0 && rounded > 0 ? '−' : '') + text + '₽';
    }

    function num(text) {
        const value = parseFloat(String(text === undefined || text === null ? '' : text).replace(/[^\d.,]/g, '').replace(',', '.'));

        return isNaN(value) ? 0 : value;
    }

    function rowById(id) {
        return state.rows.find(function (row) { return row.employee_id === id; }) || null;
    }

    function isChecked(id) {
        return state.checked.indexOf(id) !== -1;
    }

    function selectedRow() {
        return state.selected ? rowById(state.selected) : null;
    }

    function sortedRows() {
        const rows = state.rows.slice();
        const key = state.sortKey;
        const dir = state.sortDir === 'asc' ? 1 : -1;

        rows.sort(function (a, b) {
            let result;

            if (key === 'employee_name') {
                result = String(a.employee_name || '').localeCompare(String(b.employee_name || ''), 'ru');
            } else {
                result = (Number(a[key]) || 0) - (Number(b[key]) || 0);
            }

            return result * dir;
        });

        return rows;
    }

    function syncSearchToolbar() {
        const input = document.getElementById('moneySearch');

        if (input && input.value !== state.search) input.value = state.search;
    }

    function renderSidebarFilters() {
        if (!sidebarPanel) return;

        sidebarPanel.innerHTML = '' +
            '<label class="money-filter">' +
                '<span class="money-filter__label">Месяц</span>' +
                '<div class="money-filter__period">' +
                    '<button type="button" class="money-period__step" data-step="-1" aria-label="Предыдущий месяц">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
                    '</button>' +
                    '<input type="month" class="money-filter__input money-filter__month" id="payoutMonth" value="' + escapeHtml(state.month || '') + '">' +
                    '<button type="button" class="money-period__step" data-step="1" aria-label="Следующий месяц">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
                    '</button>' +
                '</div>' +
            '</label>' +
            '<label class="money-filter">' +
                '<span class="money-filter__label">Сотрудники</span>' +
                '<select class="form-select money-filter__control" id="payoutScope">' +
                    SCOPES.map(function (scope) {
                        return '<option value="' + scope.key + '"' + (scope.key === state.scope ? ' selected' : '') + '>' + scope.label + '</option>';
                    }).join('') +
                '</select>' +
            '</label>';

        const monthInput = sidebarPanel.querySelector('#payoutMonth');
        const scopeSelect = sidebarPanel.querySelector('#payoutScope');

        if (monthInput) {
            monthInput.addEventListener('change', function () {
                if (!monthInput.value) return;

                state.month = monthInput.value;
                load();
            });
        }

        if (scopeSelect) {
            scopeSelect.addEventListener('change', function () {
                state.scope = scopeSelect.value;
                load();
            });
        }
    }

    function shiftMonth(delta) {
        const monthInput = document.getElementById('payoutMonth');

        if (!monthInput || !monthInput.value) return;

        const parts = monthInput.value.split('-');
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);

        const value = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');

        state.month = value;
        monthInput.value = value;
        load();
    }

    function render() {
        if (!state.loaded) {
            panel.innerHTML = '<div class="money-loading">Загрузка...</div>';
            return;
        }

        panel.innerHTML = renderToolbar() + '<div class="pay-grid">' + renderLeft() + renderRight() + '</div>';

        bind();
        syncBulk();
    }

    function renderToolbar() {
        return '' +
            '<div class="pay-toolbar">' +
                '<div class="pay-period">' +
                    '<span class="pay-sec">Период</span>' +
                    '<b class="pay-period__value">' + escapeHtml(state.period_label || '') + '</b>' +
                '</div>' +
                '<div class="pay-sums">' +
                    '<span class="pay-sum"><span class="pay-sec">Баланс</span><b>' + money(state.totals.accrued) + '</b></span>' +
                    '<span class="pay-sum"><span class="pay-sec">Выплачено</span><b>' + money(state.totals.paid) + '</b></span>' +
                    '<span class="pay-sum"><span class="pay-sec">Остаток</span><b class="pay-sum--rest">' + money(state.totals.balance) + '</b></span>' +
                    '<button type="button" class="btn btn-primary btn-sm" id="payoutBulkBtn" disabled>Выплатить выбранным</button>' +
                '</div>' +
            '</div>';
    }

    function renderLeft() {
        return '<div class="pay-left">' + renderTable() + '</div>';
    }

    function renderRight() {
        return '<div class="pay-right">' + renderPayCard() + renderDrawer() + '</div>';
    }

    function renderPayCard() {
        const row = selectedRow();

        return '' +
            '<div class="pay-card' + (row ? '' : ' pay-card--idle') + '">' +
                '<div class="pay-card__head">' +
                    '<span class="pay-sec">Новая выплата</span>' +
                    '<span class="pay-card__who">' + escapeHtml(row ? row.employee_name : 'Выберите сотрудника') + '</span>' +
                '</div>' +
                '<div class="pay-card__body">' +
                    '<div class="pay-kinds">' +
                        KINDS.map(function (kind) {
                            return '<button type="button" class="pay-kind' + (kind === state.kind ? ' is-on' : '') + '" data-kind="' + escapeHtml(kind) + '">' + escapeHtml(kind) + '</button>';
                        }).join('') +
                    '</div>' +
                    '<div class="pay-row">' +
                        '<label class="pay-f pay-f--sum"><span>Сумма</span><input type="text" class="pay-input pay-input--sum" id="payoutAmount" inputmode="decimal" placeholder="0₽" value="' + escapeHtml(amountValue(row)) + '"' + (row ? '' : ' disabled') + '></label>' +
                        '<label class="pay-f"><span>Дата</span><input type="date" class="pay-input" id="payoutDate" value="' + escapeHtml(state.today || '') + '"' + (row ? '' : ' disabled') + '></label>' +
                    '</div>' +
                    '<div class="pay-row pay-row--method">' +
                        '<span class="pay-f"><span>Способ</span><span class="pay-seg">' +
                            METHODS.map(function (method) {
                                return '<button type="button" class="pay-seg__b' + (method.key === state.method ? ' is-on' : '') + '" data-method="' + method.key + '">' + method.label + '</button>';
                            }).join('') +
                        '</span></span>' +
                        '<button type="button" class="btn btn-primary pay-submit" id="payoutSubmit"' + (row ? '' : ' disabled') + '>Выплатить</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function amountValue(row) {
        if (!row) return '';

        if (state.kind !== 'Остаток') return state.amountInputs && state.amountInputs[row.employee_id] || '';

        return row.balance > 0 ? String(Math.round(row.balance * 100) / 100) : '';
    }

    function checkBox(id, on) {
        return '<span class="pay-check"><input type="checkbox" data-check="' + id + '"' + (on ? ' checked' : '') + '>' +
            '<span class="pay-check__box">' + CHECK_ICON + '</span></span>';
    }

    function sortIndicator(key) {
        if (state.sortKey !== key) return '<span class="pay-sort__arrow"></span>';

        return '<span class="pay-sort__arrow is-active">' + (state.sortDir === 'asc' ? '▲' : '▼') + '</span>';
    }

    function renderTable() {
        if (!state.rows.length) {
            return '<div class="pay-table-wrap"><div class="money-empty">Сотрудники не найдены</div></div>';
        }

        const head = '' +
            '<label class="pay-check">' +
                '<input type="checkbox" id="payoutCheckAll">' +
                '<span class="pay-check__box">' + CHECK_ICON + '</span>' +
            '</label>';

        const headCells = COLUMNS.map(function (column) {
            return '<th class="pay-sort ' + column.cls + '" data-sort="' + column.key + '">' +
                '<span class="pay-sort__label">' + escapeHtml(column.label) + '</span>' + sortIndicator(column.key) +
            '</th>';
        }).join('');

        const rows = sortedRows().map(function (row) {
            const selected = row.employee_id === state.selected;

            return '<tr class="pay-row-item' + (selected ? ' is-on' : '') + (isChecked(row.employee_id) ? ' is-checked' : '') + '" data-emp="' + row.employee_id + '">' +
                '<td class="pay-pick">' + checkBox(row.employee_id, isChecked(row.employee_id)) + '</td>' +
                '<td class="pay-who"><b>' + escapeHtml(row.employee_name) + '</b><span class="pay-dim">' +
                    escapeHtml(row.full_name || '') + '</span></td>' +
                '<td class="pay-c">' + row.orders + '</td>' +
                '<td class="pay-num">' + money(row.accrued) + '</td>' +
                '<td class="pay-num">' + money(row.paid) + '</td>' +
                '<td class="pay-num pay-num--rest">' + money(row.balance) + '</td>' +
            '</tr>';
        }).join('');

        return '' +
            '<div class="pay-table-wrap">' +
                '<table class="pay-table">' +
                    '<thead><tr>' +
                        '<th class="pay-pick">' + head + '</th>' +
                        headCells +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>';
    }

    function renderHistoryTab() {
        if (!historyPanel) return;

        if (!state.loaded) {
            historyPanel.innerHTML = '<div class="money-loading">Загрузка...</div>';
            return;
        }

        if (!state.history.length) {
            historyPanel.innerHTML = '<div class="pay-history"><div class="money-empty">Выплат пока нет</div></div>';
            return;
        }

        const sorted = state.history.slice().sort(function (a, b) {
            const left = String(a.date || a.date_display || '');
            const right = String(b.date || b.date_display || '');

            if (left === right) return Number(b.id) - Number(a.id);

            return left < right ? 1 : -1;
        });

        let lastDate = null;

        const rows = sorted.map(function (item) {
            const date = String(item.date || item.date_display || '');
            const divider = date !== lastDate
                ? '<div class="pay-history__day"><span>' + escapeHtml(item.date_display) + '</span></div>'
                : '';

            lastDate = date;

            return divider +
                '<div class="pay-history__row" data-payout="' + item.id + '">' +
                    '<span class="pay-history__date">' + escapeHtml(item.time_display || '') + '</span>' +
                    '<span class="pay-history__name">' + escapeHtml(item.employee_name) + '</span>' +
                    '<span class="pay-history__meta">' + escapeHtml(item.method_display) + '</span>' +
                    '<span class="pay-history__amount">' + money(item.amount) + '</span>' +
                '</div>';
        }).join('');

        historyPanel.innerHTML = '<div class="pay-history">' +
            '<div class="pay-sec pay-history__title">История выплат</div>' + rows + '</div>';
    }

    function renderDrawer() {
        const row = selectedRow();

        if (!row) {
            return '<aside class="pay-drawer"></aside>';
        }

        const shows = row.shows.length
            ? row.shows.map(function (item) {
                return '<div class="pay-show" data-order="' + item.order_id + '">' +
                    '<div class="pay-show__date">' + escapeHtml(item.date_display) + '</div>' +
                    '<div class="pay-show__main"><b>' + escapeHtml(item.order_name) + '</b><span class="pay-dim">' +
                        escapeHtml(item.service || '—') + (item.city ? ' · ' + escapeHtml(item.city) : '') + '</span></div>' +
                    '<div class="pay-show__pay">' + money(item.amount) + '</div>' +
                '</div>';
            }).join('')
            : '<div class="money-empty">За период начислений нет</div>';

        const payouts = row.payouts.length
            ? row.payouts.map(function (item) {
                return '<div class="pay-show">' +
                    '<div class="pay-show__date">' + escapeHtml(item.date_display) + '</div>' +
                    '<div class="pay-show__main"><b>' + escapeHtml(item.method_display) + '</b><span class="pay-dim">' + escapeHtml(item.comment || 'выплата') + '</span></div>' +
                    '<div class="pay-show__pay pay-show__pay--paid">−' + money(item.amount) + '</div>' +
                '</div>';
            }).join('')
            : '';

        return '' +
            '<aside class="pay-drawer is-open">' +
                '<div class="pay-drawer__head">' +
                    '<div>' +
                        '<div class="pay-drawer__name">' + escapeHtml(row.employee_name) + '</div>' +
                        '<div class="pay-drawer__sub">' + escapeHtml(state.period_label || '') + '</div>' +
                    '</div>' +
                    '<button type="button" class="pay-icon-btn" data-close-drawer title="Закрыть">' + CLOSE_ICON + '</button>' +
                '</div>' +
                '<div class="pay-drawer__nums">' +
                    '<div class="pay-dnum"><span class="pay-sec">Заказы</span><b>' + row.orders + '</b></div>' +
                    '<div class="pay-dnum"><span class="pay-sec">Баланс</span><b>' + money(row.accrued) + '</b></div>' +
                    '<div class="pay-dnum"><span class="pay-sec">Выплачено</span><b>' + money(row.paid) + '</b></div>' +
                    '<div class="pay-dnum pay-dnum--rest"><span class="pay-sec">Осталось</span><b>' + money(row.balance) + '</b></div>' +
                '</div>' +
                '<div class="pay-drawer__body">' +
                    '<div class="pay-shows__sum"><span class="pay-sec">Заказы и суммы</span><b>' + money(row.accrued) + '</b></div>' +
                    shows +
                    (payouts ? '<div class="pay-shows__sum"><span class="pay-sec">Выплаты</span><b>' + money(row.paid) + '</b></span></div>' + payouts : '') +
                '</div>' +
            '</aside>';
    }

    function syncBulk() {
        const button = document.getElementById('payoutBulkBtn');
        const all = document.getElementById('payoutCheckAll');
        const count = state.checked.length;

        if (button) {
            button.textContent = count ? 'Выплатить выбранным · ' + count : 'Выплатить выбранным';
            button.disabled = count === 0;
        }

        if (all) {
            all.checked = count > 0 && count === state.rows.length;
            all.indeterminate = count > 0 && count < state.rows.length;
        }
    }

    function toggleCheck(id, on) {
        state.checked = state.checked.filter(function (item) { return item !== id; });

        if (on) state.checked.push(id);

        const row = panel.querySelector('.pay-row-item[data-emp="' + id + '"]');

        if (row) row.classList.toggle('is-checked', on);

        const box = panel.querySelector('[data-check="' + id + '"]');

        if (box) box.checked = on;

        syncBulk();
    }

    function replaceNode(node, html) {
        if (!node) return null;

        const holder = document.createElement('div');
        holder.innerHTML = html;

        const fresh = holder.firstElementChild;

        node.replaceWith(fresh);

        return fresh;
    }

    function selectEmployee(id) {
        state.selected = id;

        if (!state.amountInputs) state.amountInputs = {};

        panel.querySelectorAll('.pay-row-item').forEach(function (row) {
            row.classList.toggle('is-on', Number(row.dataset.emp) === id);
        });

        replaceNode(panel.querySelector('.pay-drawer'), renderDrawer());
        replaceNode(panel.querySelector('.pay-card'), renderPayCard());
    }

    function openOrderInNewTab(orderId) {
        if (window.moneyOpenOrderInNewTab) {
            window.moneyOpenOrderInNewTab(orderId);
            return;
        }

        const link = document.createElement('a');

        link.href = window.location.origin + '/money/?tab=shows&order=' + encodeURIComponent(orderId);
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function bind() {
        if (panel.dataset.bound === '1') return;

        panel.dataset.bound = '1';

        panel.addEventListener('dblclick', function (event) {
            const row = event.target.closest('.pay-row-item');

            if (!row) return;

            const id = Number(row.dataset.emp);

            toggleCheck(id, !isChecked(id));
        });

        panel.addEventListener('contextmenu', function (event) {
            const show = event.target.closest('.pay-show[data-order]');

            if (!show) return;

            event.preventDefault();
            openOrderInNewTab(show.dataset.order);
        });

        panel.addEventListener('click', function (event) {
            if (event.target.closest('[data-close-drawer]')) {
                state.selected = null;
                render();
                return;
            }

            const sortHead = event.target.closest('[data-sort]');

            if (sortHead) {
                const key = sortHead.dataset.sort;

                if (state.sortKey === key) {
                    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortKey = key;
                    state.sortDir = key === 'employee_name' ? 'asc' : 'desc';
                }

                render();
                return;
            }

            if (event.target.closest('.pay-check')) return;

            const row = event.target.closest('.pay-row-item');

            if (row) {
                selectEmployee(Number(row.dataset.emp));
                return;
            }

            const kind = event.target.closest('[data-kind]');

            if (kind) {
                state.kind = kind.dataset.kind;
                panel.querySelectorAll('.pay-kind').forEach(function (button) {
                    button.classList.toggle('is-on', button === kind);
                });

                replaceNode(panel.querySelector('.pay-card'), renderPayCard());
                return;
            }

            const method = event.target.closest('[data-method]');

            if (method) {
                state.method = method.dataset.method;
                panel.querySelectorAll('.pay-seg__b').forEach(function (button) {
                    button.classList.toggle('is-on', button === method);
                });
                return;
            }

            if (event.target.closest('#payoutSubmit')) {
                submitPayout();
                return;
            }

            if (event.target.closest('#payoutBulkBtn')) {
                bulkPayout();
            }
        });

        panel.addEventListener('input', function (event) {
            if (event.target.id === 'payoutAmount') {
                event.target.value = String(event.target.value).replace(/[^\d.,\s]/g, '');

                if (state.selected) {
                    if (!state.amountInputs) state.amountInputs = {};
                    state.amountInputs[state.selected] = event.target.value;
                }
            }
        });

        panel.addEventListener('change', function (event) {
            const box = event.target.closest('[data-check]');

            if (box) {
                toggleCheck(Number(box.dataset.check), box.checked);
                return;
            }

            if (event.target.id === 'payoutCheckAll') {
                const on = event.target.checked;

                state.checked = on ? state.rows.map(function (row) { return row.employee_id; }) : [];

                panel.querySelectorAll('.pay-row-item').forEach(function (row) {
                    row.classList.toggle('is-checked', on);
                });

                panel.querySelectorAll('[data-check]').forEach(function (input) {
                    input.checked = on;
                });

                syncBulk();
            }
        });
    }

    function postPayout(items, method, periodDate, comment) {
        const body = new URLSearchParams();

        body.append('items', JSON.stringify(items));
        body.append('method', method);
        body.append('period_date', periodDate);
        body.append('comment', comment || '');

        return fetch('/money/payouts/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': window.UI ? window.UI.getCSRFToken() : '',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
            body: body.toString(),
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        });
    }

    function submitPayout() {
        const row = selectedRow();
        const amount = document.getElementById('payoutAmount');
        const dateInput = document.getElementById('payoutDate');
        const button = document.getElementById('payoutSubmit');

        if (!row || !amount) return;

        const value = num(amount.value);

        if (!value) {
            if (window.UI && window.UI.showToast) window.UI.showToast('Укажите сумму выплаты');
            amount.focus();
            return;
        }

        if (button) button.disabled = true;

        postPayout([{ employee_id: row.employee_id, amount: value }], state.method, (dateInput && dateInput.value) || state.today, state.kind)
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось создать выплату');
                }

                if (window.UI && window.UI.showToast) window.UI.showToast('Выплата создана');

                if (state.amountInputs) delete state.amountInputs[row.employee_id];

                load();
            })
            .catch(function (error) {
                if (window.UI && window.UI.showToast) window.UI.showToast(error.message || 'Ошибка');
                if (button) button.disabled = false;
            });
    }

    function bulkPayout() {
        if (!state.checked.length) return;

        const items = state.checked
            .map(function (id) {
                const row = rowById(id);

                if (!row) return null;

                const typed = state.amountInputs ? num(state.amountInputs[id]) : 0;
                const amount = row.balance > 0 ? row.balance : typed;

                if (!amount || amount <= 0) return null;

                return { employee_id: id, amount: amount };
            })
            .filter(Boolean);

        if (!items.length) {
            if (window.UI && window.UI.showToast) window.UI.showToast('Нет сумм к выплате');
            return;
        }

        const total = items.reduce(function (sum, item) { return sum + item.amount; }, 0);

        window.UI.confirm({
            title: 'Выплатить выбранным',
            text: 'Будет создано выплат: ' + items.length + ' на сумму ' + money(total) + '.',
            okText: 'Выплатить',
            cancelText: 'Отмена',
        }).then(function (confirmed) {
            if (!confirmed) return;

            const dateInput = document.getElementById('payoutDate');

            return postPayout(items, state.method, (dateInput && dateInput.value) || state.today, 'Массовая выплата')
                .then(function (result) {
                    if (!result.ok || !result.data.success) {
                        throw new Error((result.data && result.data.error) || 'Не удалось создать выплаты');
                    }

                    if (window.UI && window.UI.showToast) window.UI.showToast('Выплаты созданы: ' + result.data.count);

                    state.checked = [];
                    load();
                })
                .catch(function (error) {
                    if (window.UI && window.UI.showToast) window.UI.showToast(error.message || 'Ошибка');
                });
        });
    }

    function load() {
        if (state.loading) return;

        state.loading = true;

        const params = new URLSearchParams();

        if (state.month) params.set('date_from', state.month + '-01');
        if (state.scope) params.set('scope', state.scope);
        if (state.search) params.set('search', state.search);

        if (!state.loaded) {
            panel.innerHTML = '<div class="money-loading">Загрузка...</div>';
        }

        fetch('/money/payouts/?' + params.toString(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store',
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (!data.success) throw new Error(data.error || 'Не удалось загрузить выплаты');

                state.rows = data.rows || [];
                state.totals = data.totals || state.totals;
                state.history = data.history || [];
                state.today = data.today || state.today;
                state.period_label = data.period_start + ' — ' + data.period_end;
                state.month = String(data.date_from || '').slice(0, 7);
                state.loaded = true;
                state.loading = false;

                if (state.selected && !rowById(state.selected)) state.selected = null;

                state.checked = state.checked.filter(function (id) {
                    return !!rowById(id);
                });

                renderSidebarFilters();
                render();
                renderHistoryTab();
                syncSearchToolbar();

                const storedTab = (function () {
                    try {
                        return localStorage.getItem('jiva_money_tab');
                    } catch (error) {
                        return null;
                    }
                })();

                if ((storedTab === 'payouts' || storedTab === 'history') && typeof window.applyMoneyPayoutsTab === 'function') {
                    window.applyMoneyPayoutsTab(true);

                    if (storedTab === 'history') renderHistoryTab();
                }
            })
            .catch(function (error) {
                state.loading = false;
                panel.innerHTML = '<div class="money-empty">' + escapeHtml(error.message || 'Ошибка загрузки') + '</div>';
            });
    }

    function bindSearch() {
        const input = document.getElementById('moneySearch');
        const form = document.querySelector('.money-searchbar');

        if (!input) return;

        let timer = null;

        const run = function () {
            state.search = input.value.trim();
            load();
        };

        input.addEventListener('input', function () {
            clearTimeout(timer);
            timer = setTimeout(run, 350);
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                clearTimeout(timer);
                run();
            }
        });

        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                clearTimeout(timer);
                run();
            });
        }
    }

    function bindSidebarSteps() {
        if (!sidebarPanel || sidebarPanel.dataset.bound === '1') return;

        sidebarPanel.dataset.bound = '1';

        sidebarPanel.addEventListener('click', function (event) {
            const step = event.target.closest('[data-step]');

            if (step) shiftMonth(Number(step.dataset.step));
        });
    }

    function payoutById(id) {
        return state.history.find(function (item) { return Number(item.id) === Number(id); }) || null;
    }

    function closeHistoryMenu() {
        const menu = document.getElementById('payoutMenu');

        if (menu) menu.remove();
    }

    function openHistoryMenu(event, payoutId) {
        closeHistoryMenu();

        const menu = document.createElement('div');

        menu.className = 'pay-menu';
        menu.id = 'payoutMenu';
        menu.innerHTML = '<button type="button" class="pay-menu__item pay-menu__item--danger" data-payout-delete="' + payoutId + '">Удалить</button>';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';

        document.body.appendChild(menu);

        const rect = menu.getBoundingClientRect();

        if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (event.clientY - rect.height) + 'px';
    }

    function deletePayout(payoutId) {
        const payout = payoutById(payoutId);

        if (!payout) return;

        window.UI.confirm({
            title: 'Удалить выплату?',
            text: payout.employee_name + ' · ' + payout.date_display + ' · ' + money(payout.amount),
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true,
            checkLabel: 'Вернуть средства',
            checkDefault: false,
        }).then(function (result) {
            if (!result) return;

            const refund = !!result.checked;

            return removePayout(payoutId, refund);
        });
    }

    function removePayout(payoutId, refund) {
        const body = new URLSearchParams();

        body.append('refund', refund ? '1' : '0');

        if (state.month) body.append('date_from', state.month + '-01');
        if (state.scope) body.append('scope', state.scope);
        if (state.search) body.append('search', state.search);

        return fetch('/money/payouts/' + payoutId + '/delete/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': window.UI ? window.UI.getCSRFToken() : '',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
            body: body.toString(),
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось удалить выплату');
                }

                if (window.UI && window.UI.showToast) {
                    window.UI.showToast(refund ? 'Выплата удалена, средства возвращены' : 'Выплата удалена');
                }

                if (Array.isArray(result.data.history)) {
                    state.history = result.data.history;
                    renderHistoryTab();
                }

                load();
            })
            .catch(function (error) {
                if (window.UI && window.UI.showToast) window.UI.showToast(error.message || 'Ошибка');
            });
    }

    if (historyPanel) {
        historyPanel.addEventListener('contextmenu', function (event) {
            const row = event.target.closest('[data-payout]');

            if (!row) return;

            event.preventDefault();
            openHistoryMenu(event, row.dataset.payout);
        });

        historyPanel.addEventListener('click', closeHistoryMenu);
    }

    document.addEventListener('click', function (event) {
        const button = event.target.closest('[data-payout-delete]');

        if (button) {
            closeHistoryMenu();
            deletePayout(button.dataset.payoutDelete);
            return;
        }

        if (!event.target.closest('#payoutMenu')) closeHistoryMenu();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeHistoryMenu();
    });

    window.addEventListener('scroll', closeHistoryMenu, true);

    window.loadMoneyPayouts = function () {
        if (!state.loaded) load();
    };

    window.renderMoneyPayoutHistory = function () {
        renderHistoryTab();
    };

    window.showMoneyPayoutFilters = function (visible) {
        if (sidebarPanel) sidebarPanel.hidden = !visible;
        if (mainFilters) mainFilters.hidden = !!visible;
        if (visible) bindSidebarSteps();
    };

    window.applyMoneyPayoutsTab = function (visible) {
        if (mainFilters) mainFilters.hidden = !!visible;

        if (!visible) {
            if (sidebarPanel) sidebarPanel.hidden = true;
            return;
        }

        if (sidebarPanel) sidebarPanel.hidden = false;

        renderSidebarFilters();
        bindSidebarSteps();

        if (!state.loaded) load();
    };

    bindSearch();
    bindSidebarSteps();
    load();
})();
